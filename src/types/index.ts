export interface Task {
  id: number;
  task_id: string;
  file1_name: string;
  file2_name: string;
  storage_path: string;
  file1_hash?: string;
  file2_hash?: string;
  status: TaskStatus;
  similarity_score?: number;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
  worker_id?: string;
  worker_ip?: string;
  expire_at?: Date;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface CreateTaskRequest {
  file1_name: string;
  file2_name: string;
}

export interface CreateTaskResponse {
  task_id: string;
  upload_urls: {
    file1: string;
    file2: string;
  };
}

export interface TaskStatusResponse {
  task_id: string;
  status: TaskStatus;
  similarity_score?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  progress?: number;
  file1_name: string;
  file2_name: string;
}

export interface WorkerConfig {
  worker_id: string;
  worker_ip: string;
  max_concurrent: number;
  local_storage: string;
}

export interface DetectionResult {
  similarity_score: number;
  details?: any;
}

export interface FileRequest {
  task_id: string;
  file_name: string;
  worker_ip: string;
  worker_storage_path: string;
} 