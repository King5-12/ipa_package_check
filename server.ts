const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const serve = require('koa-static');
const path = require('path');
const fs = require('fs-extra');
const multer = require('@koa/multer');
const dotenv = require('dotenv');

// TypeScript 类型定义
interface KoaContext {
  request: {
    body?: any;
    files?: { [fieldname: string]: any[] };
  };
  params: { [key: string]: string };
  query: { [key: string]: string | string[] };
  body: any;
  status: number;
  throw: (status: number, message?: string) => never;
}

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
// 加载环境变量
dotenv.config({ path: envFile });

import { database } from './src/database';
import { FileUtils } from './src/utils/fileUtils';
// import { RsyncUtils } from './src/utils/rsyncUtils';
import { Task, CreateTaskRequest, CreateTaskResponse, TaskStatusResponse, FileRequest } from './src/types';

const app = new Koa();
const router = new Router();

// 中间件配置
app.use(cors());
app.use(
  bodyParser({
    jsonLimit: '50mb',
    formLimit: '50mb',
  })
);

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
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '209715200'), // 200MB
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.ipa') {
      cb(null, true);
    } else {
      cb(new Error('Only .ipa files are allowed'), false);
    }
  },
});

// 创建任务接口
router.post(
  '/api/tasks',
  upload.fields([
    { name: 'file1', maxCount: 1 },
    { name: 'file2', maxCount: 1 },
  ]),
  async (ctx: KoaContext) => {
    try {
      const files = ctx.request.files as { [fieldname: string]: any[] };

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
        status: 'pending',
      });

      console.log(`Task created: ${taskId}`);

      ctx.body = {
        task_id: taskId,
        message: 'Task created successfully',
      };
    } catch (error) {
      console.error('Error creating task:', error);
      ctx.status = 500;
      ctx.body = { error: 'Internal server error' };
    }
  }
);

// 获取任务列表接口
router.get('/api/tasks', async (ctx: KoaContext) => {
  try {
    const limit = parseInt(ctx.query.limit as string) || 50;
    const offset = parseInt(ctx.query.offset as string) || 0;

    const result = await database.getAllTasks(limit, offset);

    const tasks = result.tasks.map((task) => ({
      task_id: task.task_id,
      file1_name: task.file1_name,
      file2_name: task.file2_name,
      status: task.status,
      similarity_score: task.similarity_score,
      error_message: task.error_message,
      created_at: task.created_at.toISOString(),
      updated_at: task.updated_at.toISOString(),
    }));

    ctx.body = {
      tasks: tasks,
      total: result.total,
      limit: limit,
      offset: offset,
    };
  } catch (error) {
    console.error('Error getting tasks:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 查询任务状态接口
router.get('/api/tasks/:taskId', async (ctx: KoaContext) => {
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
      updated_at: task.updated_at.toISOString(),
      file1_name: task.file1_name,
      file2_name: task.file2_name,
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

// /history 和 / 和 /task/d2ba3775-7af6-4b62-95dc-21883c3285f5 都代理到 /index.html
// 前端路由处理 - 所有前端路由都返回index.html
// 这样可以支持前端的History路由模式,让前端处理实际的路由逻辑
// 包括 /, /history, /task/:id 等路径都会返回同一个index.html
router.get('/', async (ctx: KoaContext) => {
  // 读取并返回前端入口文件index.html
  console.log('前端路由处理:', path.join(__dirname, 'public', 'index.html'));
  ctx.body = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
});
router.get('/history', async (ctx: KoaContext) => {
  // 读取并返回前端入口文件index.html
  console.log('前端路由处理:', path.join(__dirname, 'public', 'index.html'));
  ctx.body = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
});
router.get('/task/:taskId', async (ctx: KoaContext) => {
  // 读取并返回前端入口文件index.html
  console.log('前端路由处理:', path.join(__dirname, 'public', 'index.html'));
  ctx.body = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
});

// 文件传输请求接口（供Worker使用）
// router.post('/api/files/request', async (ctx) => {
//   try {
//     const request = ctx.request.body as FileRequest;
//     const { task_id, file_name, worker_ip, worker_storage_path } = request;

//     console.log(`File transfer request received:`);
//     console.log(`  Task ID: ${task_id}`);
//     console.log(`  File: ${file_name}`);
//     console.log(`  Worker IP: ${worker_ip}`);
//     console.log(`  Worker storage path: ${worker_storage_path || 'not provided (using fallback)'}`);

//     const task = await database.getTaskByTaskId(task_id);
//     if (!task) {
//       ctx.status = 404;
//       ctx.body = { error: 'Task not found' };
//       return;
//     }

//     // 使用rsync传输文件到Worker，传递Worker的存储绝对路径
//     await RsyncUtils.transferToWorker(task_id, file_name, worker_ip, worker_storage_path);

//     ctx.body = {
//       message: 'File transfer initiated',
//       source_path: `${FileUtils.getStorageRootPath()}/ipa/${task_id}/${file_name}`,
//       target_path: worker_storage_path
//         ? `${worker_storage_path}/${task_id}/${file_name}`
//         : `/tmp/ipa_worker/${task_id}/${file_name}`,
//     };
//   } catch (error) {
//     console.error('Error transferring file:', error);
//     ctx.status = 500;
//     ctx.body = { error: 'File transfer failed' };
//   }
// });

// 系统状态接口
router.get('/api/stats', async (ctx: KoaContext) => {
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
// router.get('/api/health', async (ctx) => {
//   try {
//     const rsyncAvailable = await RsyncUtils.checkRsyncAvailable();
//     ctx.body = {
//       status: 'ok',
//       rsync_available: rsyncAvailable,
//       timestamp: new Date().toISOString(),
//     };
//   } catch (error) {
//     ctx.status = 500;
//     ctx.body = { error: 'Health check failed' };
//   }
// });

app.use(router.routes());
app.use(router.allowedMethods());

// 定期清理过期任务和文件
// setInterval(async () => {
//   try {
//     await database.resetExpiredTasks();
//     await FileUtils.cleanupExpiredFiles();
//   } catch (error) {
//     console.error('Cleanup error:', error);
//   }
// }, 5 * 60 * 1000); // 每5分钟执行一次

// 启动服务器
const port = parseInt(process.env.API_PORT || '8080');
const host = process.env.API_HOST || '0.0.0.0';

app.listen(port, host, async () => {
  // 打印服务器信息
  console.log(`API Server running on http://${host}:${port}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');

  // 初始化并打印存储目录的绝对路径
  const storageRootPath = FileUtils.getStorageRootPath();
  const tempUploadPath = FileUtils.getTempUploadPath();

  console.log('Storage configuration:');
  console.log(`  - Storage root: ${storageRootPath}`);
  console.log(`  - Temp upload: ${tempUploadPath}`);

  // 确保存储目录存在
  try {
    await FileUtils.ensureDirectoryExists(storageRootPath);
    await FileUtils.ensureDirectoryExists(tempUploadPath);
    await FileUtils.ensureDirectoryExists(path.join(storageRootPath, 'ipa'));
    console.log('✓ Storage directories initialized successfully');
  } catch (error) {
    console.error('✗ Failed to initialize storage directories:', error);
  }
});
