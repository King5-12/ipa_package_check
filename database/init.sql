-- 创建数据库
CREATE DATABASE IF NOT EXISTS ipa_check CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ipa_check;

-- 创建任务表
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 文件元数据
  task_id CHAR(36) NOT NULL,
  file1_name VARCHAR(255) NOT NULL,
  file2_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(512) NOT NULL,
  file1_hash VARCHAR(64) NULL,
  file2_hash VARCHAR(64) NULL,
  -- 任务状态
  status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
  similarity_score FLOAT NULL DEFAULT NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 节点信息
  worker_id VARCHAR(64) NULL DEFAULT NULL,
  worker_ip VARCHAR(45) NULL DEFAULT NULL,
  expire_at TIMESTAMP NULL DEFAULT NULL,
  -- 索引优化
  INDEX idx_status (status),
  INDEX idx_task_id (task_id),
  INDEX idx_worker_id (worker_id),
  INDEX idx_created_at (created_at),
  UNIQUE KEY uk_task_id (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; 