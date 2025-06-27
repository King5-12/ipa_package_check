import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class FileUtils {
  static async calculateHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  static async validateIpaFile(filePath: string): Promise<boolean> {
    try {
      // 基本文件存在检查
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        return false;
      }

      // 检查文件大小
      const stats = await fs.stat(filePath);
      const maxSize = parseInt(process.env.MAX_FILE_SIZE || '209715200'); // 200MB
      if (stats.size > maxSize) {
        return false;
      }

      // 检查文件扩展名
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.ipa') {
        return false;
      }

      // TODO: 可以添加更多的IPA文件格式验证，比如ZIP文件头检查

      return true;
    } catch (error) {
      console.error('File validation error:', error);
      return false;
    }
  }

  static createTaskStoragePath(taskId: string): string {
    const storagePath = process.env.STORAGE_PATH || './storage';
    return path.join(storagePath, 'ipa', taskId);
  }

  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  static async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    await fs.move(sourcePath, targetPath);
  }

  static async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    await fs.copy(sourcePath, targetPath);
  }

  static async removeFile(filePath: string): Promise<void> {
    try {
      await fs.remove(filePath);
    } catch (error) {
      console.error('Error removing file:', error);
    }
  }

  static async cleanupExpiredFiles(): Promise<void> {
    try {
      const storagePath = process.env.STORAGE_PATH || './storage';
      const ipaDir = path.join(storagePath, 'ipa');
      
      if (!await fs.pathExists(ipaDir)) {
        return;
      }

      const expireDays = parseInt(process.env.TEMP_FILE_CLEANUP_DAYS || '3');
      const expireTime = Date.now() - (expireDays * 24 * 60 * 60 * 1000);

      const directories = await fs.readdir(ipaDir);
      
      for (const dir of directories) {
        const dirPath = path.join(ipaDir, dir);
        const stats = await fs.stat(dirPath);
        
        if (stats.isDirectory() && stats.mtime.getTime() < expireTime) {
          await fs.remove(dirPath);
          console.log(`Cleaned up expired directory: ${dirPath}`);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  static generateTaskId(): string {
    return uuidv4();
  }

  static getTempUploadPath(): string {
    const storagePath = process.env.STORAGE_PATH || './storage';
    return path.join(storagePath, 'temp');
  }
} 