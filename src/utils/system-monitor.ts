import * as os from 'os';
import { spawn } from 'child_process';

export interface SystemMetrics {
  timestamp: number;
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  cpu: {
    usagePercent: number;
    loadAverage: number[];
  };
  uptime: number;
}

export class SystemMonitor {
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastCpuTime: number = 0;

  /**
   * 获取系统内存信息
   */
  getMemoryInfo(): SystemMetrics['memory'] {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;

    return {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: Math.round(usagePercent * 100) / 100
    };
  }

  /**
   * 获取系统CPU信息
   */
  getCpuInfo(): SystemMetrics['cpu'] {
    const loadAverage = os.loadavg();
    
    // 计算CPU使用率
    const currentCpuUsage = process.cpuUsage();
    const currentTime = Date.now();
    
    let cpuUsagePercent = 0;
    
    if (this.lastCpuUsage && this.lastCpuTime) {
      const timeDiff = currentTime - this.lastCpuTime;
      const cpuDiff = {
        user: currentCpuUsage.user - this.lastCpuUsage.user,
        system: currentCpuUsage.system - this.lastCpuUsage.system
      };
      
      const totalCpuTime = cpuDiff.user + cpuDiff.system;
      cpuUsagePercent = (totalCpuTime / timeDiff) * 100;
    }
    
    this.lastCpuUsage = currentCpuUsage;
    this.lastCpuTime = currentTime;
    
    return {
      usagePercent: Math.round(cpuUsagePercent * 100) / 100,
      loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
    };
  }

  /**
   * 获取完整的系统指标
   */
  getSystemMetrics(): SystemMetrics {
    return {
      timestamp: Date.now(),
      memory: this.getMemoryInfo(),
      cpu: this.getCpuInfo(),
      uptime: os.uptime()
    };
  }

  /**
   * 格式化内存大小
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 获取系统信息摘要
   */
  getSystemSummary(): string {
    const metrics = this.getSystemMetrics();
    const mem = metrics.memory;
    const cpu = metrics.cpu;
    
    return `CPU: ${cpu.usagePercent}% | Memory: ${this.formatBytes(mem.used)}/${this.formatBytes(mem.total)} (${mem.usagePercent}%) | Load: ${cpu.loadAverage.join(', ')}`;
  }

  /**
   * 跨平台获取更详细的系统信息（使用系统命令）
   */
  async getDetailedSystemInfo(): Promise<any> {
    return new Promise((resolve) => {
      const platform = os.platform();
      let command: string;
      let args: string[];

      if (platform === 'win32') {
        // Windows
        command = 'powershell.exe';
        args = ['-Command', 'Get-Counter "\\Processor(_Total)\\% Processor Time", "\\Memory\\Available MBytes" | ConvertTo-Json'];
      } else {
        // Unix/Linux/macOS
        command = 'top';
        args = ['-l', '1', '-n', '0'];
      }

      const process = spawn(command, args);
      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            if (platform === 'win32') {
              const result = JSON.parse(output);
              resolve({
                platform: 'windows',
                data: result
              });
            } else {
              // 解析 top 输出
              const lines = output.split('\n');
              const cpuLine = lines.find(line => line.includes('CPU usage:'));
              const memLine = lines.find(line => line.includes('PhysMem:'));
              
              resolve({
                platform: 'unix',
                cpuLine,
                memLine,
                raw: output
              });
            }
          } catch (error) {
            resolve({
              platform,
              error: 'Failed to parse output',
              raw: output
            });
          }
        } else {
          resolve({
            platform,
            error: errorOutput,
            code
          });
        }
      });
    });
  }
}

// 导出单例实例
export const systemMonitor = new SystemMonitor(); 