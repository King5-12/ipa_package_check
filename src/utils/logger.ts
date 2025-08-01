import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// 日志工具函数
export const getTimestamp = (): string => {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
};

// 持久化日志类
export class Logger {
  private logDir: string;
  private logFile: string;
  private processLogFile: string;
  private writeStream: fs.WriteStream | null = null;
  private processWriteStream: fs.WriteStream | null = null;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `worker-${os.hostname()}-${new Date().toISOString().split('T')[0]}.log`);
    this.processLogFile = path.join(this.logDir, `process-monitor-${os.hostname()}-${new Date().toISOString().split('T')[0]}.log`);
    
    // 确保日志目录存在
    fs.ensureDirSync(this.logDir);
    
    // 初始化写入流
    this.initWriteStreams();
  }

  private initWriteStreams(): void {
    try {
      // 主日志流
      this.writeStream = fs.createWriteStream(this.logFile, { 
        flags: 'a',
        encoding: 'utf8'
      });

      // 进程监控日志流
      this.processWriteStream = fs.createWriteStream(this.processLogFile, { 
        flags: 'a',
        encoding: 'utf8'
      });

      // 写入日志头
      this.writeToFile(this.logFile, `=== Worker Log Started at ${getTimestamp()} ===\n`);
      this.writeToFile(this.processLogFile, `=== Process Monitor Started at ${getTimestamp()} ===\n`);
    } catch (error) {
      console.error('Failed to initialize log streams:', error);
    }
  }

  private writeToFile(filePath: string, message: string): void {
    try {
      fs.appendFileSync(filePath, message);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private writeToStream(stream: fs.WriteStream | null, message: string): void {
    if (stream && !stream.destroyed) {
      try {
        stream.write(message);
      } catch (error) {
        console.error('Failed to write to stream:', error);
      }
    }
  }

  log(message: string, ...args: any[]): void {
    const timestamp = getTimestamp();
    const logMessage = `[${timestamp}] ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;
    
    // 控制台输出
    console.log(`[${timestamp}] ${message}`, ...args);
    
    // 文件输出
    this.writeToStream(this.writeStream, logMessage);
  }

  logError(message: string, ...args: any[]): void {
    const timestamp = getTimestamp();
    const logMessage = `[${timestamp}] ERROR: ${message} ${args.length > 0 ? JSON.stringify(args) : ''}\n`;
    
    // 控制台输出
    console.error(`[${timestamp}] ${message}`, ...args);
    
    // 文件输出
    this.writeToStream(this.writeStream, logMessage);
  }

  logProcessMonitor(taskId: string, pid: number, memoryUsage: any, cpuUsage: any): void {
    const timestamp = getTimestamp();
    const logMessage = `[${timestamp}] TASK:${taskId} PID:${pid} MEMORY:${JSON.stringify(memoryUsage)} CPU:${JSON.stringify(cpuUsage)}\n`;
    
    this.writeToStream(this.processWriteStream, logMessage);
  }

  close(): void {
    if (this.writeStream && !this.writeStream.destroyed) {
      this.writeStream.end();
    }
    if (this.processWriteStream && !this.processWriteStream.destroyed) {
      this.processWriteStream.end();
    }
  }
}

// 创建全局日志实例
export const logger = new Logger();

// 导出便捷的日志函数
export const log = (message: string, ...args: any[]): void => {
  logger.log(message, ...args);
};

export const logError = (message: string, ...args: any[]): void => {
  logger.logError(message, ...args);
}; 