import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

export class RsyncUtils {
  static async transferFile(sourceFile: string, targetIp: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === 'win32';
      const rsyncCmd = isWindows ? 'rsync.exe' : 'rsync';
      
      // 构建rsync命令参数
      const args = [
        '-avz', // archive, verbose, compress
        '--progress',
        sourceFile,
        `${targetIp}:${targetPath}`
      ];

      // 如果配置了SSH密钥
      const sshKey = process.env.RSYNC_SSH_KEY_PATH;
      if (sshKey) {
        args.unshift('-e', `ssh -i ${sshKey}`);
      }

      console.log(`Executing rsync: ${rsyncCmd} ${args.join(' ')}`);

      const rsyncProcess = spawn(rsyncCmd, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      rsyncProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('rsync stdout:', data.toString());
      });

      rsyncProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('rsync stderr:', data.toString());
      });

      rsyncProcess.on('close', (code) => {
        if (code === 0) {
          console.log('File transfer completed successfully');
          resolve();
        } else {
          console.error(`rsync process exited with code ${code}`);
          console.error('Error output:', errorOutput);
          reject(new Error(`rsync failed with code ${code}: ${errorOutput}`));
        }
      });

      rsyncProcess.on('error', (error) => {
        console.error('rsync process error:', error);
        reject(error);
      });
    });
  }

  static async transferToWorker(taskId: string, fileName: string, workerIp: string): Promise<void> {
    try {
      const storagePath = process.env.STORAGE_PATH || './storage';
      const sourceFile = path.join(storagePath, 'ipa', taskId, fileName);
      const targetPath = `/tmp/ipa_worker/${taskId}/`;

      // 验证源文件存在
      if (!await fs.pathExists(sourceFile)) {
        throw new Error(`Source file not found: ${sourceFile}`);
      }

      // 创建目标目录（通过SSH）
      await this.ensureRemoteDirectory(workerIp, targetPath);

      // 传输文件
      await this.transferFile(sourceFile, workerIp, targetPath);

      console.log(`File ${fileName} transferred to worker ${workerIp} successfully`);
    } catch (error) {
      console.error(`Failed to transfer file ${fileName} to worker ${workerIp}:`, error);
      throw error;
    }
  }

  private static async ensureRemoteDirectory(targetIp: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sshKey = process.env.RSYNC_SSH_KEY_PATH;
      const sshCmd = sshKey ? `ssh -i ${sshKey}` : 'ssh';
      const command = `${sshCmd} ${targetIp} "mkdir -p ${targetPath}"`;

      const sshProcess = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      sshProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`SSH mkdir failed with code ${code}`));
        }
      });

      sshProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  static async checkRsyncAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const isWindows = os.platform() === 'win32';
      const rsyncCmd = isWindows ? 'rsync.exe' : 'rsync';

      const testProcess = spawn(rsyncCmd, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      testProcess.on('close', (code) => {
        resolve(code === 0);
      });

      testProcess.on('error', () => {
        resolve(false);
      });
    });
  }
} 