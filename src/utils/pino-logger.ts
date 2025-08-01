import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// 注意：需要先安装 pino 和 pino-rotate-file
// npm install pino pino-rotate-file

// 模拟 pino 的基本功能，如果 pino 未安装则使用原生实现
let pino: any = null;
let pinoRotate: any = null;

try {
  pino = require('pino');
  pinoRotate = require('pino-rotate-file');
} catch (error) {
  console.log('Pino not installed, using fallback implementation');
}

// 日志级别
export enum LogLevel {
  TRACE = 10,
  DEBUG = 20,
  INFO = 30,
  WARN = 40,
  ERROR = 50,
  FATAL = 60
}

// 日志配置接口
export interface LoggerConfig {
  level?: LogLevel;
  maxFileSize?: string; // 如 '10m', '100m'
  maxFiles?: number;    // 保留的文件数量
  logDir?: string;
  workerName?: string;
}

// 高性能日志类
export class PinoLogger {
  private logger: any;
  private config: LoggerConfig;
  private logDir: string;
  private workerName: string;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: LogLevel.INFO,
      maxFileSize: '10m',
      maxFiles: 5,
      logDir: path.join(process.cwd(), 'logs'),
      workerName: os.hostname(),
      ...config
    };

    this.logDir = this.config.logDir!;
    this.workerName = this.config.workerName!;

    // 确保日志目录存在
    fs.ensureDirSync(this.logDir);

    this.initLogger();
  }

  private initLogger(): void {
    if (pino && pinoRotate) {
      // 使用真实的 pino
      this.initPinoLogger();
    } else {
      // 使用轻量级实现
      this.initFallbackLogger();
    }
  }

  private initPinoLogger(): void {
    try {
      // 尝试使用 pino-rotate-file
      const transport = pinoRotate({
        file: path.join(this.logDir, `${this.workerName}-%Y-%m-%d.log`),
        size: this.config.maxFileSize,
        interval: '1d',
        maxFiles: this.config.maxFiles,
        teeToStdout: true
      });

      this.logger = pino({
        level: this.getLevelString(this.config.level!),
        transport: {
          target: 'pino/file',
          options: {
            destination: transport
          }
        }
      });
    } catch (error) {
      // 如果 pino-rotate-file 不可用，使用基础的 pino
      this.logger = pino({
        level: this.getLevelString(this.config.level!),
        transport: {
          target: 'pino/file',
          options: {
            destination: path.join(this.logDir, `${this.workerName}-${new Date().toISOString().split('T')[0]}.log`)
          }
        }
      });
    }
  }

  private initFallbackLogger(): void {
    // 轻量级实现，模拟 pino 的 API
    this.logger = {
      trace: (msg: string, obj?: any) => this.log(LogLevel.TRACE, msg, obj),
      debug: (msg: string, obj?: any) => this.log(LogLevel.DEBUG, msg, obj),
      info: (msg: string, obj?: any) => this.log(LogLevel.INFO, msg, obj),
      warn: (msg: string, obj?: any) => this.log(LogLevel.WARN, msg, obj),
      error: (msg: string, obj?: any) => this.log(LogLevel.ERROR, msg, obj),
      fatal: (msg: string, obj?: any) => this.log(LogLevel.FATAL, msg, obj)
    };
  }

  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.TRACE: return 'trace';
      case LogLevel.DEBUG: return 'debug';
      case LogLevel.INFO: return 'info';
      case LogLevel.WARN: return 'warn';
      case LogLevel.ERROR: return 'error';
      case LogLevel.FATAL: return 'fatal';
      default: return 'info';
    }
  }

  private log(level: LogLevel, message: string, obj?: any): void {
    if (level < this.config.level!) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      time: timestamp,
      level: this.getLevelString(level),
      msg: message,
      ...(obj && { data: obj })
    };

    // 控制台输出
    const consoleMsg = `[${timestamp}] ${this.getLevelString(level).toUpperCase()}: ${message}`;
    if (level >= LogLevel.ERROR) {
      console.error(consoleMsg, obj || '');
    } else {
      console.log(consoleMsg, obj || '');
    }

    // 文件输出（轻量级实现）
    this.writeToFile(logEntry);
  }

  private writeToFile(logEntry: any): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDir, `${this.workerName}-${today}.log`);
      
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(logFile, logLine);

      // 简单的文件大小控制
      this.rotateLogFile(logFile);
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
  }

  private rotateLogFile(logFile: string): void {
    try {
      const stats = fs.statSync(logFile);
      const maxSize = this.parseSize(this.config.maxFileSize!);
      
      if (stats.size > maxSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = `${logFile}.${timestamp}`;
        fs.renameSync(logFile, rotatedFile);
        
        // 清理旧文件
        this.cleanOldFiles();
      }
    } catch (error) {
      // 文件不存在或其他错误，忽略
    }
  }

  private parseSize(sizeStr: string): number {
    const units: { [key: string]: number } = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = sizeStr.toLowerCase().match(/^(\d+)([kmgb]?)$/);
    if (!match) return 10 * 1024 * 1024; // 默认10MB

    const size = parseInt(match[1]);
    const unit = match[2] || 'b';
    return size * (units[unit] || 1);
  }

  private cleanOldFiles(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith(`${this.workerName}-`) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          time: fs.statSync(path.join(this.logDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // 保留最新的文件
      const filesToDelete = files.slice(this.config.maxFiles!);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          // 忽略删除错误
        }
      });
    } catch (error) {
      // 忽略清理错误
    }
  }

  // 公共API
  trace(message: string, obj?: any): void {
    this.logger.trace(message, obj);
  }

  debug(message: string, obj?: any): void {
    this.logger.debug(message, obj);
  }

  info(message: string, obj?: any): void {
    this.logger.info(message, obj);
  }

  warn(message: string, obj?: any): void {
    this.logger.warn(message, obj);
  }

  error(message: string, obj?: any): void {
    this.logger.error(message, obj);
  }

  fatal(message: string, obj?: any): void {
    this.logger.fatal(message, obj);
  }

  // 进程监控日志
  logProcessMonitor(taskId: string, pid: number, memoryUsage: any, cpuUsage: any): void {
    this.info('Process monitor', {
      taskId,
      pid,
      memoryUsage,
      cpuUsage,
      type: 'process_monitor'
    });
  }

  // 关闭日志
  close(): void {
    if (this.logger && typeof this.logger.flush === 'function') {
      this.logger.flush();
    }
  }
}

// 创建默认日志实例
export const logger = new PinoLogger();

// 便捷函数
export const log = (message: string, obj?: any): void => {
  logger.info(message, obj);
};

export const logError = (message: string, obj?: any): void => {
  logger.error(message, obj);
};

export const logWarn = (message: string, obj?: any): void => {
  logger.warn(message, obj);
};

export const logDebug = (message: string, obj?: any): void => {
  logger.debug(message, obj);
}; 