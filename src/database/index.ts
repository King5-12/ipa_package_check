import mysql from 'mysql2/promise';
import { Task, TaskStatus } from '../types';

class Database {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'ipa_check',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00'
    });
  }

  async createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    const connection = await this.pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO tasks (task_id, file1_name, file2_name, storage_path, file1_hash, file2_hash, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [task.task_id, task.file1_name, task.file2_name, task.storage_path, task.file1_hash, task.file2_hash, task.status]
      );
      
      const insertResult = result as mysql.ResultSetHeader;
      return await this.getTaskById(insertResult.insertId);
    } finally {
      connection.release();
    }
  }

  async getTaskById(id: number): Promise<Task> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM tasks WHERE id = ?', [id]);
      const tasks = rows as Task[];
      if (tasks.length === 0) {
        throw new Error('Task not found');
      }
      return tasks[0];
    } finally {
      connection.release();
    }
  }

  async getTaskByTaskId(taskId: string): Promise<Task | null> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
      const tasks = rows as Task[];
      return tasks.length > 0 ? tasks[0] : null;
    } finally {
      connection.release();
    }
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, errorMessage?: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        'UPDATE tasks SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?',
        [status, errorMessage || null, taskId]
      );
    } finally {
      connection.release();
    }
  }

  async updateTaskResult(taskId: string, status: TaskStatus, similarityScore?: number, errorMessage?: string): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        'UPDATE tasks SET status = ?, similarity_score = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?',
        [status, similarityScore || null, errorMessage || null, taskId]
      );
    } finally {
      connection.release();
    }
  }

  async assignTaskToWorker(taskId: string, workerId: string, workerIp: string, expireAt: Date): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        'UPDATE tasks SET worker_id = ?, worker_ip = ?, expire_at = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?',
        [workerId, workerIp, expireAt, 'processing', taskId]
      );
    } finally {
      connection.release();
    }
  }

  async getNextPendingTask(): Promise<Task | null> {
    const connection = await this.pool.getConnection();
    try {
      // 获取下一个待处理的任务，使用行锁避免并发问题
      await connection.beginTransaction();
      
      const [rows] = await connection.execute(
        'SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC LIMIT 1 FOR UPDATE',
        ['pending']
      );
      
      const tasks = rows as Task[];
      if (tasks.length === 0) {
        await connection.commit();
        return null;
      }

      await connection.commit();
      return tasks[0];
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getExpiredTasks(): Promise<Task[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM tasks WHERE status = ? AND expire_at < CURRENT_TIMESTAMP',
        ['processing']
      );
      return rows as Task[];
    } finally {
      connection.release();
    }
  }

  async resetExpiredTasks(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute(
        `UPDATE tasks SET status = 'pending', worker_id = NULL, worker_ip = NULL, expire_at = NULL, 
         updated_at = CURRENT_TIMESTAMP 
         WHERE status = 'processing' AND expire_at < CURRENT_TIMESTAMP`
      );
    } finally {
      connection.release();
    }
  }

  async getAllTasks(limit: number = 50, offset: number = 0): Promise<{ tasks: Task[]; total: number }> {
    const connection = await this.pool.getConnection();
    try {
      // 获取总数
      const [countRows] = await connection.query('SELECT COUNT(*) as total FROM tasks');
      const total = (countRows as any[])[0].total;

      // 获取分页数据
      const [rows] = await connection.query(
        `SELECT * FROM tasks ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      );
      
      return {
        tasks: rows as Task[],
        total: total
      };
    } finally {
      connection.release();
    }
  }

  async getTaskStats(): Promise<{ total: number; pending: number; processing: number; completed: number; failed: number }> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM tasks
      `);
      const stats = rows as any[];
      return stats[0];
    } finally {
      connection.release();
    }
  }

  async retryTask(taskId: string): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      // 首先检查任务是否存在且状态为失败
      const [checkRows] = await connection.execute(
        'SELECT status FROM tasks WHERE task_id = ?',
        [taskId]
      );
      
      const tasks = checkRows as Task[];
      if (tasks.length === 0) {
        return false; // 任务不存在
      }
      
      if (tasks[0].status !== 'failed') {
        return false; // 任务状态不是失败，不能重试
      }
      
      // 重置任务状态为pending，清除worker信息和错误信息
      const [result] = await connection.execute(
        `UPDATE tasks SET 
         status = 'pending', 
         worker_id = NULL, 
         worker_ip = NULL, 
         expire_at = NULL, 
         error_message = NULL, 
         updated_at = CURRENT_TIMESTAMP 
         WHERE task_id = ? AND status = 'failed'`,
        [taskId]
      );
      
      const updateResult = result as mysql.ResultSetHeader;
      return updateResult.affectedRows > 0;
    } finally {
      connection.release();
    }
  }
}

export const database = new Database(); 