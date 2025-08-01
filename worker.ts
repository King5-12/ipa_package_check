import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import os from 'os';
import iconv from 'iconv-lite';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
// 加载环境变量
dotenv.config({ path: envFile });

import { database } from './src/database';
import { FileUtils } from './src/utils/fileUtils';
import { Task, DetectionResult, WorkerConfig } from './src/types';
import { PinoLogger, LogLevel } from './src/utils/pino-logger';
import { systemMonitor } from './src/utils/system-monitor';

// 获取检测结果基础路径，支持环境变量配置
const getBasePath = (): string => {
  let defaultPath: string;

  // 根据平台设置默认路径
  if (os.platform() === 'win32') {
    defaultPath = 'D:\\upload\\dist';
  } else {
    defaultPath = '/var/lib/detection/results';
  }

  const configuredPath = process.env.DETECTION_BASE_PATH || defaultPath;
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
};

const basePath = getBasePath();

class Worker {
  private config: WorkerConfig;
  private running = false;
  private activeTasks = new Map<string, boolean>();
  private systemMonitorInterval: NodeJS.Timeout | null = null;
  private workerLogger: PinoLogger;

  constructor() {
    // 获取本地存储的绝对路径
    const localStoragePath = FileUtils.getWorkerStoragePath(process.env.LOCAL_STORAGE);

    this.config = {
      worker_id: `worker-${os.hostname()}`,
      worker_ip: this.getLocalIP(),
      max_concurrent: parseInt(process.env.MAX_CONCURRENT_TASKS || '2'),
      local_storage: localStoragePath,
    };

    // 确保本地存储目录存在
    fs.ensureDirSync(this.config.local_storage);

    // 初始化高性能日志系统
    this.workerLogger = new PinoLogger({
      level: LogLevel.INFO,
      maxFileSize: process.env.LOG_MAX_FILE_SIZE || '50m',
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
      workerName: this.config.worker_id,
      logDir: path.join(process.cwd(), 'logs'),
    });
  }

  private getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name];
      if (nets) {
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal) {
            return net.address;
          }
        }
      }
    }
    return '127.0.0.1';
  }

  async start(): Promise<void> {
    this.running = true;

    // 打印启动信息和路径配置
    this.workerLogger.info('='.repeat(60));
    this.workerLogger.info(`Worker ${this.config.worker_id} starting...`);
    this.workerLogger.info(`Worker IP: ${this.config.worker_ip}`);
    this.workerLogger.info(`Max concurrent tasks: ${this.config.max_concurrent}`);
    this.workerLogger.info('');
    this.workerLogger.info('Storage configuration:');
    this.workerLogger.info(`  - Local storage (absolute): ${this.config.local_storage}`);
    this.workerLogger.info(`  - Detection base path: ${basePath}`);
    this.workerLogger.info(`  - Current working directory: ${process.cwd()}`);

    // 确保本地存储目录存在
    try {
      await FileUtils.ensureDirectoryExists(this.config.local_storage);
      this.workerLogger.info('✓ Local storage directory initialized successfully');

      // 检查检测结果基础路径是否存在
      if (await fs.pathExists(basePath)) {
        this.workerLogger.info('✓ Detection base path exists');
      } else {
        this.workerLogger.warn('⚠ Detection base path does not exist, detection may fail');
        this.workerLogger.info(`  Expected path: ${basePath}`);
      }
    } catch (error) {
      this.workerLogger.error('✗ Failed to initialize storage directories:', error);
      throw error;
    }

    this.workerLogger.info('='.repeat(60));
    this.workerLogger.info(`Worker ${this.config.worker_id} started successfully`);

    // 启动系统监控
    this.startSystemMonitoring();

    // 主处理循环
    while (this.running) {
      try {
        if (this.activeTasks.size < this.config.max_concurrent) {
          await this.processNextTask();
        }

        // 短暂休息避免CPU占用过高
        await this.sleep(parseInt(process.env.POLLING_INTERVAL_MS || '5000'));
      } catch (error) {
        this.workerLogger.error('Worker error:', error);
        await this.sleep(10000); // 错误时等待更长时间
      }
    }
  }

  stop(): void {
    this.running = false;
    this.workerLogger.info(`Worker ${this.config.worker_id} stopping...`);

    // 停止系统监控
    if (this.systemMonitorInterval) {
      clearInterval(this.systemMonitorInterval);
      this.workerLogger.info('System monitoring stopped');
    }

    // 关闭日志流
    this.workerLogger.close();
  }

  private async processNextTask(): Promise<void> {
    // 获取下一个待处理任务
    const task = await database.getNextPendingTask();
    if (!task) {
      return; // 没有待处理任务
    }

    const taskId = task.task_id;
    this.workerLogger.info(`Processing task: ${taskId}`);

    // 标记任务为活跃状态
    this.activeTasks.set(taskId, true);

    try {
      // 设置任务超时时间
      const expireAt = new Date();
      expireAt.setMinutes(expireAt.getMinutes() + parseInt(process.env.TASK_TIMEOUT_MINUTES || '30'));

      // 分配任务给当前Worker
      await database.assignTaskToWorker(taskId, this.config.worker_id, this.config.worker_ip, expireAt);

      // 异步处理任务
      this.handleTaskAsync(task);
    } catch (error: any) {
      this.workerLogger.error(`Error processing task ${taskId}:`, error);
      this.activeTasks.delete(taskId);
      await database.updateTaskStatus(taskId, 'failed', error?.message || 'Unknown error');
    }
  }

  private async handleTaskAsync(task: Task): Promise<void> {
    const taskId = task.task_id;

    try {
      // 确保文件可用
      await this.ensureFiles(task);

      // 执行检测
      const result = await this.runDetection(task);

      // 更新任务结果
      await database.updateTaskResult(taskId, 'completed', result.similarity_score);

      this.workerLogger.info(`Task ${taskId} completed with similarity score: ${result.similarity_score}`);
    } catch (error: any) {
      this.workerLogger.error(`Task ${taskId} failed:`, error);
      await database.updateTaskStatus(taskId, 'failed', error?.message || 'Unknown error');
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  private async ensureFiles(task: Task): Promise<void> {
    const localTaskDir = path.join(this.config.local_storage, task.task_id);
    await fs.ensureDir(localTaskDir);

    const file1Path = path.join(localTaskDir, task.file1_name);
    const file2Path = path.join(localTaskDir, task.file2_name);

    // 检查文件是否已存在且有效
    const file1Exists = await this.isFileValid(file1Path, task.file1_hash);
    const file2Exists = await this.isFileValid(file2Path, task.file2_hash);

    this.workerLogger.info('file1Path', { path: file1Path, hash: task.file1_hash });
    this.workerLogger.info('file2Path', { path: file2Path, hash: task.file2_hash });

    // 请求缺失的文件
    if (!file1Exists) {
      throw new Error('File 1 not found');
    }

    if (!file2Exists) {
      throw new Error('File 2 not found');
    }

    // 等待文件传输完成
    await this.waitForFiles(file1Path, file2Path, task.file1_hash, task.file2_hash);
  }

  private async isFileValid(filePath: string, expectedHash?: string): Promise<boolean> {
    try {
      if (!(await fs.pathExists(filePath))) {
        return false;
      }

      if (expectedHash) {
        const actualHash = await FileUtils.calculateHash(filePath);
        return actualHash === expectedHash;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // private async requestFile(taskId: string, fileName: string): Promise<void> {
  //   try {
  //     const apiUrl = process.env.API_URL || 'http://localhost:8080';
  //     await axios.post(`${apiUrl}/api/files/request`, {
  //       task_id: taskId,
  //       file_name: fileName,
  //       worker_ip: this.config.worker_ip,
  //       worker_storage_path: this.config.local_storage,
  //     });
  //     log(`Requested file: ${fileName} for task: ${taskId}`);
  //     log(`  Worker storage path: ${this.config.local_storage}`);
  //   } catch (error) {
  //     logError(`Failed to request file ${fileName}:`, error);
  //     throw error;
  //   }
  // }

  private async waitForFiles(file1Path: string, file2Path: string, hash1?: string, hash2?: string): Promise<void> {
    const maxWaitTime = 5 * 60 * 1000; // 5分钟超时
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const file1Valid = await this.isFileValid(file1Path, hash1);
      const file2Valid = await this.isFileValid(file2Path, hash2);

      if (file1Valid && file2Valid) {
        this.workerLogger.info('All files are ready for processing');
        return;
      }

      await this.sleep(2000); // 等待2秒后重新检查
    }

    throw new Error('Timeout waiting for files to be transferred');
  }

  private async runDetection(task: Task): Promise<DetectionResult> {
    const localTaskDir = path.join(this.config.local_storage, task.task_id);
    const file1Path = path.join(localTaskDir, task.file1_name);
    const file2Path = path.join(localTaskDir, task.file2_name);

    return new Promise((resolve, reject) => {
      // 根据平台选择检测工具
      const toolPath = path.join(basePath, 'main.exe');

      // 构建命令参数
      const args = [task.task_id, file1Path, file2Path];

      this.workerLogger.info(`Running detection tool: ${toolPath} ${args.join(' ')}`);

      this.workerLogger.info('basePath', { basePath });

      const commandLine = `&  '${toolPath}' '-u' ${args.map((a) => `'${a.replace(/'/g, "''")}'`).join(' ')}`;

      this.workerLogger.info('commandLine', { commandLine });

      const detectionProcess = spawn('powershell.exe', ['-Command', commandLine], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: basePath,
      });

      // 系统监控已在启动时开始

      // const detectionProcess = spawn(toolPath, args, {
      //   stdio: ['pipe', 'pipe', 'pipe'],
      //   cwd: basePath,
      // });

      let output = '';
      let errorOutput = '';

      detectionProcess.stdout.on('data', (data) => {
        const utfData = iconv.decode(data, 'gbk');
        const str = utfData.toString();
        const now = new Date().toLocaleString();
        process.stdout.write(`[${now}] ${str}`);
        output += str;
      });

      detectionProcess.stderr.on('data', (data) => {
        const utfData = iconv.decode(data, 'gbk');
        const str = utfData.toString();
        const now = new Date().toLocaleString();
        process.stderr.write(`[${now}] ${str}`);
        errorOutput += str;
      });

      detectionProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // 解析输出结果
            const result = this.getResult(task.task_id);
            resolve(result);
          } catch (parseError: any) {
            reject(new Error(`Failed to parse detection output: ${parseError?.message || 'Unknown error'}`));
          }
        } else {
          reject(new Error(`Detection tool failed with code ${code}: ${errorOutput}`));
        }
      });

      detectionProcess.on('error', (error: any) => {
        this.workerLogger.error('Detection tool error:', error?.message);
        reject(new Error(`Detection tool error: ${error?.message || 'Unknown error'}`));
      });

      // 设置超时
      setTimeout(() => {
        detectionProcess.kill();
        reject(new Error('Detection tool timeout'));
      }, 24 * 60 * 60 * 1000); // 24小时超时
    });
  }

  private startSystemMonitoring(): void {
    // 启动系统监控，每分钟记录一次
    this.systemMonitorInterval = setInterval(() => {
      try {
        const metrics = systemMonitor.getSystemMetrics();
        this.workerLogger.info('System metrics', {
          type: 'system_monitor',
          timestamp: metrics.timestamp,
          memory: {
            total: systemMonitor.formatBytes(metrics.memory.total),
            used: systemMonitor.formatBytes(metrics.memory.used),
            free: systemMonitor.formatBytes(metrics.memory.free),
            usagePercent: metrics.memory.usagePercent,
          },
          cpu: {
            usagePercent: metrics.cpu.usagePercent,
            loadAverage: metrics.cpu.loadAverage,
          },
          uptime: Math.round(metrics.uptime / 60), // 转换为分钟
        });
      } catch (error) {
        this.workerLogger.error('Failed to get system metrics:', error);
      }
    }, 60000); // 每分钟执行一次

    this.workerLogger.info('System monitoring started');
  }

  private async getResult(taskId: string): Promise<DetectionResult> {
    try {
      // 构建结果文件路径: basePath/result/{taskId}/result.json
      const resultDir = path.join(basePath, 'result', taskId);
      const resultFilePath = path.join(resultDir, 'result.json');

      this.workerLogger.info(`Reading detection result from: ${resultFilePath}`);

      // 检查结果文件是否存在
      if (!(await fs.pathExists(resultFilePath))) {
        throw new Error(`Result file not found: ${resultFilePath}`);
      }

      // 读取并解析JSON文件
      const resultContent = await fs.readFile(resultFilePath, 'utf-8');
      const result = JSON.parse(resultContent);

      this.workerLogger.info(`Detection result read successfully:`, result);

      // 验证结果格式
      if (typeof result.sim !== 'number') {
        throw new Error(`Invalid result format: 'sim' field must be a number, got ${typeof result.sim}`);
      }

      // 转换为标准的DetectionResult格式
      const detectionResult: DetectionResult = {
        similarity_score: result.sim,
      };

      // 如果有其他字段，也包含进去
      if (result.details) {
        detectionResult.details = result.details;
      }

      this.workerLogger.info(`Converted detection result:`, detectionResult);

      return detectionResult;
    } catch (error: any) {
      this.workerLogger.error(`Failed to read detection result for task ${taskId}:`, error);
      throw new Error(`Detection failed: ${error?.message || 'Unknown error'}`);
    }
  }

  private parseDetectionOutput(output: string): DetectionResult {
    try {
      // 尝试解析JSON输出
      const jsonMatch = output.match(/\{.*\}/s);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.similarity_score !== undefined) {
          return result;
        }
      }

      // 尝试解析简单的数字输出
      const numberMatch = output.match(/(\d+\.?\d*)/);
      if (numberMatch) {
        const score = parseFloat(numberMatch[1]);
        if (score >= 0 && score <= 1) {
          return { similarity_score: score };
        } else if (score > 1 && score <= 100) {
          return { similarity_score: score / 100 };
        }
      }

      // 默认返回随机相似度用于测试
      this.workerLogger.info('Could not parse detection output, using random score for testing');
      return { similarity_score: Math.random() };
    } catch (error) {
      this.workerLogger.error('Error parsing detection output:', error);
      throw new Error('Invalid detection output format');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 优雅关闭处理
const worker = new Worker();

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

// 启动Worker
if (require.main === module) {
  worker.start().catch((error) => {
    console.error('Worker startup error:', error);
    process.exit(1);
  });
}
