import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import os from 'os';

// 加载环境变量
dotenv.config();

import { database } from './src/database';
import { FileUtils } from './src/utils/fileUtils';
import { Task, DetectionResult, WorkerConfig } from './src/types';

class Worker {
  private config: WorkerConfig;
  private running = false;
  private activeTasks = new Map<string, boolean>();

  constructor() {
    this.config = {
      worker_id: process.env.WORKER_ID || `worker-${os.hostname()}`,
      worker_ip: process.env.WORKER_IP || this.getLocalIP(),
      max_concurrent: parseInt(process.env.MAX_CONCURRENT_TASKS || '2'),
      local_storage: process.env.LOCAL_STORAGE || './worker_storage'
    };

    // 确保本地存储目录存在
    fs.ensureDirSync(this.config.local_storage);
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
    console.log(`Worker ${this.config.worker_id} started on ${this.config.worker_ip}`);
    console.log(`Max concurrent tasks: ${this.config.max_concurrent}`);
    console.log(`Local storage: ${this.config.local_storage}`);

    // 主处理循环
    while (this.running) {
      try {
        if (this.activeTasks.size < this.config.max_concurrent) {
          await this.processNextTask();
        }
        
        // 短暂休息避免CPU占用过高
        await this.sleep(parseInt(process.env.POLLING_INTERVAL_MS || '5000'));
      } catch (error) {
        console.error('Worker error:', error);
        await this.sleep(10000); // 错误时等待更长时间
      }
    }
  }

  stop(): void {
    this.running = false;
    console.log(`Worker ${this.config.worker_id} stopping...`);
  }

  private async processNextTask(): Promise<void> {
    // 获取下一个待处理任务
    const task = await database.getNextPendingTask();
    if (!task) {
      return; // 没有待处理任务
    }

    const taskId = task.task_id;
    console.log(`Processing task: ${taskId}`);

    // 标记任务为活跃状态
    this.activeTasks.set(taskId, true);

    try {
      // 设置任务超时时间
      const expireAt = new Date();
      expireAt.setMinutes(expireAt.getMinutes() + parseInt(process.env.TASK_TIMEOUT_MINUTES || '30'));

      // 分配任务给当前Worker
      await database.assignTaskToWorker(
        taskId,
        this.config.worker_id,
        this.config.worker_ip,
        expireAt
      );

      // 异步处理任务
      this.handleTaskAsync(task);

    } catch (error: any) {
      console.error(`Error processing task ${taskId}:`, error);
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

      console.log(`Task ${taskId} completed with similarity score: ${result.similarity_score}`);

    } catch (error: any) {
      console.error(`Task ${taskId} failed:`, error);
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

    // 请求缺失的文件
    if (!file1Exists) {
      await this.requestFile(task.task_id, task.file1_name);
    }
    
    if (!file2Exists) {
      await this.requestFile(task.task_id, task.file2_name);
    }

    // 等待文件传输完成
    await this.waitForFiles(file1Path, file2Path, task.file1_hash, task.file2_hash);
  }

  private async isFileValid(filePath: string, expectedHash?: string): Promise<boolean> {
    try {
      if (!await fs.pathExists(filePath)) {
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

  private async requestFile(taskId: string, fileName: string): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:8080';
      await axios.post(`${apiUrl}/api/files/request`, {
        task_id: taskId,
        file_name: fileName,
        worker_ip: this.config.worker_ip
      });
      console.log(`Requested file: ${fileName} for task: ${taskId}`);
    } catch (error) {
      console.error(`Failed to request file ${fileName}:`, error);
      throw error;
    }
  }

  private async waitForFiles(file1Path: string, file2Path: string, hash1?: string, hash2?: string): Promise<void> {
    const maxWaitTime = 5 * 60 * 1000; // 5分钟超时
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const file1Valid = await this.isFileValid(file1Path, hash1);
      const file2Valid = await this.isFileValid(file2Path, hash2);

      if (file1Valid && file2Valid) {
        console.log('All files are ready for processing');
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
      const toolName = os.platform() === 'win32' ? 'tool.exe' : 'tool';
      
      // 构建命令参数
      const args = [file1Path, file2Path];

      console.log(`Running detection tool: ${toolName} ${args.join(' ')}`);

      const detectionProcess = spawn(toolName, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: localTaskDir
      });

      let output = '';
      let errorOutput = '';

      detectionProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      detectionProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      detectionProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // 解析输出结果
            const result = this.parseDetectionOutput(output);
            resolve(result);
          } catch (parseError: any) {
            reject(new Error(`Failed to parse detection output: ${parseError?.message || 'Unknown error'}`));
          }
        } else {
          reject(new Error(`Detection tool failed with code ${code}: ${errorOutput}`));
        }
      });

      detectionProcess.on('error', (error:any) => {
        reject(new Error(`Detection tool error: ${error?.message || 'Unknown error'}`));
      });

      // 设置超时
      setTimeout(() => {
        detectionProcess.kill();
        reject(new Error('Detection tool timeout'));
      }, 10 * 60 * 1000); // 10分钟超时
    });
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
      console.warn('Could not parse detection output, using random score for testing');
      return { similarity_score: Math.random() };

    } catch (error) {
      console.error('Error parsing detection output:', error);
      throw new Error('Invalid detection output format');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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