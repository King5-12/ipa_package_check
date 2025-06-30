import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { FileUtils } from './fileUtils';

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

  static async transferToWorker(taskId: string, fileName: string, workerIp: string, workerStoragePath?: string): Promise<void> {
    try {
      // 使用FileUtils获取API服务器存储的绝对路径
      const storageRootPath = FileUtils.getStorageRootPath();
      const sourceFile = path.join(storageRootPath, 'ipa', taskId, fileName);
      
      // 构建Worker端的绝对目标路径
      let targetPath: string;
      if (workerStoragePath) {
        // 使用Worker提供的绝对路径
        targetPath = path.join(workerStoragePath, taskId, fileName);
      } else {
        // 降级到临时目录
        targetPath = `/tmp/ipa_worker/${taskId}/${fileName}`;
      }

      console.log(`Transferring file:`);
      console.log(`  Source (API): ${sourceFile}`);
      console.log(`  Target (Worker): ${workerIp}:${targetPath}`);

      // 验证源文件存在
      if (!await fs.pathExists(sourceFile)) {
        throw new Error(`Source file not found: ${sourceFile}`);
      }

      // 创建目标目录（通过SSH）
      const targetDir = path.dirname(targetPath);
      await this.ensureRemoteDirectory(workerIp, targetDir);

      // 传输文件到Worker的绝对路径
      await this.transferFile(sourceFile, workerIp, targetPath);

      console.log(`File ${fileName} transferred to worker ${workerIp} successfully`);
      console.log(`  Final location: ${targetPath}`);
    } catch (error) {
      console.error(`Failed to transfer file ${fileName} to worker ${workerIp}:`, error);
      throw error;
    }
  }

  // 保持向后兼容的方法
  static async transferToWorkerLegacy(taskId: string, fileName: string, workerIp: string): Promise<void> {
    return this.transferToWorker(taskId, fileName, workerIp);
  }

  private static async ensureRemoteDirectory(targetIp: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sshKey = process.env.RSYNC_SSH_KEY_PATH;
      const sshCmd = sshKey ? `ssh -i ${sshKey}` : 'ssh';
      const command = `${sshCmd} ${targetIp} "mkdir -p '${targetPath}'"`;

      console.log(`Creating remote directory: ${targetPath}`);

      const sshProcess = spawn('sh', ['-c', command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let errorOutput = '';

      sshProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      sshProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ Remote directory created: ${targetPath}`);
          resolve();
        } else {
          console.error(`✗ SSH mkdir failed: ${errorOutput}`);
          reject(new Error(`SSH mkdir failed with code ${code}: ${errorOutput}`));
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