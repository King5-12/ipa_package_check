import axios from 'axios';

const api = axios.create({
  baseURL: 'http://10.10.11.71:8080/api',
  timeout: 30000,
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      // 服务器响应错误
      throw new Error(error.response.data?.error || '请求失败');
    } else if (error.request) {
      // 网络错误
      throw new Error('网络连接失败');
    } else {
      throw new Error('请求配置错误');
    }
  }
);

export interface TaskStatus {
  task_id: string;
  file1_name?: string;
  file2_name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  similarity_score?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  progress?: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface CreateTaskResponse {
  task_id: string;
  message: string;
}

export interface TaskListResponse {
  tasks: TaskStatus[];
  total: number;
  limit: number;
  offset: number;
}

// API方法
export const taskApi = {
  // 创建任务
  createTask: async (file1: File, file2: File): Promise<CreateTaskResponse> => {
    const formData = new FormData();
    formData.append('file1', file1);
    formData.append('file2', file2);

    return api.post('/tasks', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 0,
    });
  },

  // 获取任务列表
  getAllTasks: async (limit: number = 50, offset: number = 0): Promise<TaskListResponse> => {
    return api.get('/tasks', {
      params: { limit, offset },
    });
  },

  // 获取任务状态
  getTaskStatus: async (taskId: string): Promise<TaskStatus> => {
    return api.get(`/tasks/${taskId}`);
  },

  // 获取系统统计
  getStats: async (): Promise<TaskStats> => {
    return api.get('/stats');
  },

  // 健康检查
  healthCheck: async () => {
    return api.get('/health');
  },
};

export default api;
