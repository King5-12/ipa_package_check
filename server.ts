import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import serve from 'koa-static';
import path from 'path';
import fs from 'fs-extra';
import multer from '@koa/multer';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

import { database } from './src/database';
import { FileUtils } from './src/utils/fileUtils';
import { RsyncUtils } from './src/utils/rsyncUtils';
import { Task, CreateTaskRequest, CreateTaskResponse, TaskStatusResponse, FileRequest } from './src/types';

const app = new Koa();
const router = new Router();

// 中间件配置
app.use(cors());
app.use(bodyParser({
  jsonLimit: '50mb',
  formLimit: '50mb'
}));

// 静态文件服务
app.use(serve(path.join(__dirname, 'public')));

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = FileUtils.getTempUploadPath();
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // 保持原始文件名，后续会移动到任务目录
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '209715200') // 200MB
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.ipa') {
      cb(null, true);
    } else {
      cb(new Error('Only .ipa files are allowed'));
    }
  }
});

// 创建任务接口
router.post('/api/tasks', upload.fields([
  { name: 'file1', maxCount: 1 },
  { name: 'file2', maxCount: 1 }
]), async (ctx) => {
  try {
    const files = ctx.request.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files.file1 || !files.file2) {
      ctx.status = 400;
      ctx.body = { error: 'Both file1 and file2 are required' };
      return;
    }

    const file1 = files.file1[0];
    const file2 = files.file2[0];

    // 验证文件
    const file1Valid = await FileUtils.validateIpaFile(file1.path);
    const file2Valid = await FileUtils.validateIpaFile(file2.path);

    if (!file1Valid || !file2Valid) {
      // 清理临时文件
      await FileUtils.removeFile(file1.path);
      await FileUtils.removeFile(file2.path);
      
      ctx.status = 400;
      ctx.body = { error: 'Invalid IPA files' };
      return;
    }

    // 生成任务ID和存储路径
    const taskId = FileUtils.generateTaskId();
    const storagePath = FileUtils.createTaskStoragePath(taskId);
    await FileUtils.ensureDirectoryExists(storagePath);

    // 移动文件到任务目录
    const file1Path = path.join(storagePath, file1.originalname);
    const file2Path = path.join(storagePath, file2.originalname);
    
    await FileUtils.moveFile(file1.path, file1Path);
    await FileUtils.moveFile(file2.path, file2Path);

    // 计算文件哈希
    const file1Hash = await FileUtils.calculateHash(file1Path);
    const file2Hash = await FileUtils.calculateHash(file2Path);

    // 创建任务记录
    const task = await database.createTask({
      task_id: taskId,
      file1_name: file1.originalname,
      file2_name: file2.originalname,
      storage_path: storagePath,
      file1_hash: file1Hash,
      file2_hash: file2Hash,
      status: 'pending'
    });

    console.log(`Task created: ${taskId}`);

    ctx.body = {
      task_id: taskId,
      message: 'Task created successfully'
    };
  } catch (error) {
    console.error('Error creating task:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 查询任务状态接口
router.get('/api/tasks/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await database.getTaskByTaskId(taskId);

    if (!task) {
      ctx.status = 404;
      ctx.body = { error: 'Task not found' };
      return;
    }

    const response: TaskStatusResponse = {
      task_id: task.task_id,
      status: task.status,
      similarity_score: task.similarity_score,
      error_message: task.error_message,
      created_at: task.created_at.toISOString(),
      updated_at: task.updated_at.toISOString()
    };

    // 计算进度
    if (task.status === 'pending') {
      response.progress = 0;
    } else if (task.status === 'processing') {
      response.progress = 50;
    } else {
      response.progress = 100;
    }

    ctx.body = response;
  } catch (error) {
    console.error('Error getting task status:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 文件传输请求接口（供Worker使用）
router.post('/api/files/request', async (ctx) => {
  try {
    const request = ctx.request.body as FileRequest;
    const { task_id, file_name, worker_ip } = request;

    const task = await database.getTaskByTaskId(task_id);
    if (!task) {
      ctx.status = 404;
      ctx.body = { error: 'Task not found' };
      return;
    }

    // 使用rsync传输文件到Worker
    await RsyncUtils.transferToWorker(task_id, file_name, worker_ip);

    ctx.body = { message: 'File transfer initiated' };
  } catch (error) {
    console.error('Error transferring file:', error);
    ctx.status = 500;
    ctx.body = { error: 'File transfer failed' };
  }
});

// 系统状态接口
router.get('/api/stats', async (ctx) => {
  try {
    const stats = await database.getTaskStats();
    ctx.body = stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 健康检查接口
router.get('/api/health', async (ctx) => {
  try {
    const rsyncAvailable = await RsyncUtils.checkRsyncAvailable();
    ctx.body = {
      status: 'ok',
      rsync_available: rsyncAvailable,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: 'Health check failed' };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

// 定期清理过期任务和文件
setInterval(async () => {
  try {
    await database.resetExpiredTasks();
    await FileUtils.cleanupExpiredFiles();
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}, 5 * 60 * 1000); // 每5分钟执行一次

// 启动服务器
const port = parseInt(process.env.API_PORT || '8080');
const host = process.env.API_HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`API Server running on http://${host}:${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
}); 