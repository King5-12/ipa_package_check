# IPA包代码相似度检测平台

基于TypeScript全栈开发的iOS应用代码相似度检测平台，支持内网部署和分布式处理。

## 项目特性

- **全栈TypeScript**: 前后端统一使用TypeScript开发
- **分布式架构**: 支持多Worker节点分布式检测处理  
- **跨平台支持**: 支持Windows/Linux检测节点
- **智能文件分发**: 基于rsync的高效文件传输机制
- **实时状态追踪**: 前端实时轮询任务处理状态
- **现代化UI**: 基于Vue3 + Element Plus的响应式界面

## 技术栈

### 前端
- Vue 3 + TypeScript
- Element Plus UI框架
- Vite构建工具
- Vue Router路由管理

### 后端
- Koa2 + TypeScript API服务
- MySQL数据库
- Multer文件上传
- rsync文件分发

### Worker
- TypeScript后台处理程序
- 跨平台检测工具调用
- 智能本地缓存

## 快速开始

### 1. 环境准备

确保已安装以下软件：
- Node.js 16+
- MySQL 8.0+
- rsync (Linux原生 / Windows需安装cwRsync或WSL)

### 2. 数据库初始化

```bash
# 连接MySQL并执行初始化脚本
mysql -u root -p < database/init.sql
```

### 3. 环境变量配置

复制环境变量模板并配置：
```bash
cp config/default.env .env
```

编辑 `.env` 文件，配置数据库连接等参数。

### 4. 安装依赖

```bash
# 后端依赖
npm install

# 前端依赖  
cd frontend
npm install
cd ..
```

### 5. 启动服务

#### 开发环境

```bash
# 使用启动脚本（推荐）
./scripts/start-dev.sh

# 或手动启动
npm run dev:api      # 启动API服务器
npm run dev:frontend # 启动前端开发服务器（新终端）
npm run dev:worker   # 启动Worker节点（新终端）
```

#### 生产环境

```bash
# 构建并启动生产环境
./scripts/start-prod.sh
```

## 使用指南

### 上传检测

1. 访问首页 http://localhost:3000
2. 选择两个IPA文件（拖拽或点击上传）
3. 点击"开始检测"提交任务
4. 系统自动跳转到任务详情页面
5. 实时查看检测进度和结果

### 检测结果

- **相似度评分**: 0-100%的相似度百分比
- **状态追踪**: 等待中 → 检测中 → 已完成
- **可视化展示**: 进度条和圆形图表展示

### 历史记录

- 查看所有历史检测任务
- 按状态筛选任务
- 快速跳转到任务详情

## 部署架构

```
[用户] → [Nginx] → [Koa API服务] → [MySQL数据库]
                         ↓
                    [文件存储] → [rsync] → [Worker节点池]
                                             ↓
                                        [检测工具]
```

### 扩展Worker节点

1. 在新机器上部署代码
2. 配置环境变量（WORKER_ID, WORKER_IP等）
3. 确保rsync连通性
4. 启动Worker进程

```bash
# Windows示例
set WORKER_ID=worker-win-01
set WORKER_IP=192.168.1.100
set LOCAL_STORAGE=D:\ipa_storage
npm run start:worker

# Linux示例  
export WORKER_ID=worker-linux-01
export WORKER_IP=192.168.1.101
export LOCAL_STORAGE=/opt/ipa_storage
npm run start:worker
```

## 系统监控

### 健康检查

```bash
curl http://localhost:8080/api/health
```

### 系统统计

```bash
curl http://localhost:8080/api/stats
```

## 开发说明

### 目录结构

```
ipa_package_check/
├── frontend/          # Vue3前端应用
│   ├── src/
│   │   ├── views/     # 页面组件
│   │   ├── api/       # API调用
│   │   ├── router/    # 路由配置
│   │   └── main.ts    # 入口文件
├── src/               # 后端源码
│   ├── database/      # 数据库操作
│   ├── utils/         # 工具模块
│   │   ├── fileUtils.ts    # 文件处理工具
│   │   └── rsyncUtils.ts   # rsync传输工具
│   └── types/         # 类型定义
├── server.ts          # API服务器入口
├── worker.ts          # Worker处理程序
├── database/          # 数据库脚本
├── scripts/           # 启动脚本
└── config/            # 配置文件
```

### API接口

- `POST /api/tasks` - 创建检测任务
- `GET /api/tasks/:taskId` - 获取任务状态  
- `POST /api/files/request` - 文件传输请求
- `GET /api/stats` - 系统统计信息
- `GET /api/health` - 健康检查

### 数据库表结构

主要数据表 `tasks` 包含：
- 任务基本信息（ID、文件名、路径）
- 状态管理（pending/processing/completed/failed）
- Worker分配信息（worker_id、worker_ip）
- 检测结果（similarity_score）

## 验证安装

### 检查文件完整性

```bash
# 检查关键文件是否存在内容
wc -l src/utils/fileUtils.ts src/utils/rsyncUtils.ts frontend/src/main.ts

# 应该显示类似输出：
#      108 src/utils/fileUtils.ts
#      128 src/utils/rsyncUtils.ts  
#       16 frontend/src/main.ts
```

### 检查依赖安装

```bash
# 检查Node.js版本
node --version

# 检查MySQL连接
mysql -h localhost -u root -p -e "SELECT 1;"
```

## 故障排除

### 常见问题

1. **文件上传失败**
   - 检查文件大小限制（200MB）
   - 确认文件格式为.ipa
   - 检查存储空间

2. **Worker无法获取任务**
   - 确认数据库连接正常
   - 检查Worker节点配置
   - 查看API服务器日志

3. **文件传输失败**
   - 确认rsync安装和配置
   - 检查网络连通性
   - 验证SSH密钥配置

4. **TypeScript编译错误**
   - 这些是正常的，因为依赖包未安装
   - 运行 `npm install` 安装依赖后即可解决

### 日志查看

```bash
# API服务器日志（使用PM2时）
pm2 logs ipa-api

# Worker日志
pm2 logs ipa-worker

# 开发环境日志直接在终端显示
```

## 开发调试

### 测试检测工具

创建一个简单的检测工具用于测试：

```bash
# 创建测试工具
cat > tool << 'EOF'
#!/bin/bash
echo "Analyzing files: $1 and $2"
score=$(echo "scale=2; $RANDOM / 32767" | bc)
echo "Similarity score: $score"
EOF

chmod +x tool
```

## 许可证

MIT License - 详见 LICENSE 文件

## 技术支持

如有问题，请查看文档或提交Issue。

## 🏗️ 系统架构

- **前端**: Vue3 + TypeScript + Element Plus + Vite
- **API服务器**: Koa2 + TypeScript
- **Worker节点**: TypeScript + 跨平台文件传输
- **数据库**: MySQL 8.0+
- **文件传输**: rsync (跨平台支持)

## 🔄 Rsync文件传输机制

系统使用rsync进行分布式文件传输，完全基于绝对路径：

### 传输流程
1. **Worker请求文件**: Worker向API发送文件请求，包含其本地存储绝对路径
2. **API处理请求**: API使用源文件绝对路径和Worker提供的目标绝对路径
3. **Rsync执行**: 在两个绝对路径之间传输文件
4. **路径验证**: 传输前后验证文件完整性

### Worker文件请求格式
```typescript
interface FileRequest {
  task_id: string;              // 任务ID
  file_name: string;            // 文件名
  worker_ip: string;            // Worker IP地址
  worker_storage_path: string;  // Worker本地存储绝对路径
}
```

### 示例传输场景
```bash
# Worker请求文件
POST /api/files/request
{
  "task_id": "12345",
  "file_name": "app.ipa", 
  "worker_ip": "192.168.1.100",
  "worker_storage_path": "/var/lib/ipa_worker/storage"
}

# 执行的rsync命令
rsync -avz --progress \
  "/var/lib/ipa_api/storage/ipa/12345/app.ipa" \
  "192.168.1.100:/var/lib/ipa_worker/storage/12345/app.ipa"
```

### 路径构建逻辑
```typescript
// API服务器端
const sourceFile = path.join(
  FileUtils.getStorageRootPath(),  // API存储根目录绝对路径
  'ipa', 
  taskId, 
  fileName
);

// Worker端
const targetFile = path.join(
  workerStoragePath,  // Worker存储根目录绝对路径（由Worker提供）
  taskId,
  fileName
);
```

## 📁 绝对路径配置

系统已完全配置为使用绝对路径，确保跨平台兼容性和部署一致性：

### API服务器路径配置
- **存储根目录**: 自动转换为绝对路径
- **临时上传目录**: `{存储根目录}/temp`
- **IPA文件存储**: `{存储根目录}/ipa/{任务ID}/{文件名}.ipa`

### Worker节点路径配置
- **本地存储目录**: 自动转换为绝对路径
- **缓存文件路径**: `{本地存储目录}/{任务ID}/{文件名}.ipa`
- **Rsync目标路径**: Worker主动提供给API服务器

### 路径转换机制
```typescript
// 自动绝对路径转换函数
private static getAbsolutePath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;  // 已经是绝对路径
  }
  return path.resolve(process.cwd(), relativePath);  // 转换为绝对路径
}
```

### 环境变量配置
```bash
# 存储路径 - 支持相对路径和绝对路径
STORAGE_PATH=./storage                    # 相对路径，将转换为绝对路径
# STORAGE_PATH=/var/lib/ipa_check/storage # 绝对路径示例

# Worker本地存储 - 支持相对路径和绝对路径
LOCAL_STORAGE=./worker_storage                        # 相对路径，将转换为绝对路径
# LOCAL_STORAGE=/var/lib/ipa_check/worker_storage     # 绝对路径示例
```

## 🚀 启动和路径信息

### API服务器启动信息
```
API Server running on http://0.0.0.0:8080
Environment: development

Storage configuration:
  - Storage root: /Users/username/project/storage
  - Temp upload: /Users/username/project/storage/temp

✓ Storage directories initialized successfully
```

### Worker启动信息
```
============================================================
Worker worker-hostname starting...
Worker IP: 192.168.1.100
Max concurrent tasks: 2

Storage configuration:
  - Local storage (absolute): /Users/username/project/worker_storage
  - Current working directory: /Users/username/project

✓ Local storage directory initialized successfully
============================================================
Worker worker-hostname started successfully
```

## 📂 文件路径示例

以任务ID `12345` 和文件 `app.ipa` 为例：

### API服务器存储
```
/Users/username/project/storage/ipa/12345/app.ipa
```

### Worker缓存
```
/Users/username/project/worker_storage/12345/app.ipa
```

### rsync传输路径
```bash
# 源文件 (API服务器)
/Users/username/project/storage/ipa/12345/app.ipa

# 目标文件 (Worker节点)
worker-ip:/Users/username/project/worker_storage/12345/app.ipa
```

## ✅ 路径配置验证

运行演示脚本查看路径配置：
```bash
node demo.js
```

输出示例：
```
================================================================================
IPA Package Check - Path Configuration Demo
================================================================================

📁 API Server Storage Configuration:
Current working directory: /Users/username/project
Storage root (relative): ./storage
Storage root (absolute): /Users/username/project/storage
Temp upload path: /Users/username/project/storage/temp
IPA storage path: /Users/username/project/storage/ipa

🔧 Worker Storage Configuration:
Local storage (relative): ./worker_storage
Local storage (absolute): /Users/username/project/worker_storage

🚀 Rsync File Transfer Path Demo:
File Transfer Scenario:
  Task ID: sample-task-12345
  File Name: app.ipa

Source (API Server):
  /Users/username/project/storage/ipa/sample-task-12345/app.ipa

Target (Worker Node):
  worker-ip:/Users/username/project/worker_storage/sample-task-12345/app.ipa

Rsync Command:
  rsync -avz --progress "source_path" "worker-ip:target_path"

Worker File Request Payload:
{
  "task_id": "sample-task-12345",
  "file_name": "app.ipa",
  "worker_ip": "192.168.1.100", 
  "worker_storage_path": "/absolute/worker/storage/path"
}
```

## 🛠️ 开发环境启动

```bash
# 安装依赖
npm install

# 启动API服务器和Worker (开发模式)
npm run dev

# 启动前端 (另一个终端)
cd frontend
npm install
npm run dev
```

## 🏭 生产环境部署

```bash
# 生产环境启动脚本
./scripts/start-prod.sh
```

生产环境建议使用绝对路径配置：
```bash
export STORAGE_PATH="/var/lib/ipa_check/storage"
export LOCAL_STORAGE="/var/lib/ipa_check/worker_storage"
```

## 📋 系统状态检查

```bash
# API健康检查
curl http://localhost:8080/api/health

# 存储目录状态
ls -la storage/
ls -la worker_storage/
```

## 🔧 关键特性

- ✅ **绝对路径支持**: 所有文件路径自动转换为绝对路径
- ✅ **跨平台兼容**: 支持Windows、Linux、macOS
- ✅ **自动路径转换**: 相对路径自动转换为基于工作目录的绝对路径
- ✅ **启动时验证**: 启动时打印所有关键路径信息
- ✅ **目录自动创建**: 启动时自动创建必要的存储目录
- ✅ **分布式缓存**: Worker节点智能文件缓存，避免重复传输
- ✅ **Rsync绝对路径**: 文件传输使用完整的绝对路径
- ✅ **Worker路径通信**: Worker主动告知API其存储绝对路径

## 🎯 路径配置最佳实践

1. **开发环境**: 使用相对路径，便于项目移植
2. **生产环境**: 使用绝对路径，确保部署一致性
3. **容器部署**: 挂载卷到绝对路径，如 `/data/storage`
4. **分布式部署**: 每个Worker节点使用独立的本地存储路径
5. **Rsync配置**: 确保Worker与API之间SSH免密登录
6. **路径权限**: 确保rsync目标路径有足够的写权限

## 📄 API接口

- `POST /api/tasks` - 创建任务
- `GET /api/tasks` - 获取任务列表  
- `GET /api/tasks/:taskId` - 查询任务状态
- `POST /api/files/request` - 文件传输请求 (Worker使用)
- `GET /api/stats` - 系统统计
- `GET /api/health` - 健康检查

## 🔍 检测结果配置

系统从预定义的JSON文件中读取检测结果，而不是执行外部检测工具：

### 结果文件路径
检测结果文件位于：`{DETECTION_BASE_PATH}/result/{taskId}/result.json`

### 环境变量配置
```bash
# 检测结果基础路径
DETECTION_BASE_PATH=/var/lib/detection/results  # Linux/macOS
# DETECTION_BASE_PATH=D:\upload\dist            # Windows
```

### 默认路径
- **Windows**: `D:\upload\dist`
- **Linux/macOS**: `/var/lib/detection/results`
- **开发环境**: 可使用相对路径如 `./detection_results`

### 结果文件格式
```json
{
  "sim": 0.7252
}
```

### 检测流程
1. Worker接收任务并下载IPA文件到本地存储
2. Worker从 `{DETECTION_BASE_PATH}/result/{taskId}/result.json` 读取预计算的结果
3. 提取 `sim` 字段作为相似度分数
4. 更新数据库中的任务状态

### 目录结构示例
```
{DETECTION_BASE_PATH}/
├── result/
│   ├── task-001/
│   │   └── result.json      # {"sim": 0.8543}
│   ├── task-002/
│   │   └── result.json      # {"sim": 0.6234}
│   └── task-003/
│       └── result.json      # {"sim": 0.9125}
```

## 🚀 启动和路径信息

### API服务器启动信息
```
API Server running on http://0.0.0.0:8080
Environment: development

Storage configuration:
  - Storage root: /Users/username/project/storage
  - Temp upload: /Users/username/project/storage/temp

✓ Storage directories initialized successfully
```

### Worker启动信息
```
============================================================
Worker worker-hostname starting...
Worker IP: 192.168.1.100
Max concurrent tasks: 2

Storage configuration:
  - Local storage (absolute): /Users/username/project/worker_storage
  - Detection base path: /Users/username/project/detection_results
  - Current working directory: /Users/username/project

✓ Local storage directory initialized successfully
✓ Detection base path exists
============================================================
Worker worker-hostname started successfully
```

## 📂 文件路径示例

以任务ID `12345` 和文件 `app.ipa` 为例：

### API服务器存储
```
/Users/username/project/storage/ipa/12345/app.ipa
```

### Worker缓存
```
/Users/username/project/worker_storage/12345/app.ipa
```

### 检测结果文件
```
/Users/username/project/detection_results/result/12345/result.json
```

### rsync传输路径
```bash
# 源文件 (API服务器)
/Users/username/project/storage/ipa/12345/app.ipa

# 目标文件 (Worker节点)
worker-ip:/Users/username/project/worker_storage/12345/app.ipa
```

## ✅ 路径配置验证

运行演示脚本查看路径配置：
```bash
node demo.js
```

输出示例：
```
================================================================================
IPA Package Check - Path Configuration Demo
================================================================================

📁 API Server Storage Configuration:
Current working directory: /Users/username/project
Storage root (relative): ./storage
Storage root (absolute): /Users/username/project/storage
Temp upload path: /Users/username/project/storage/temp
IPA storage path: /Users/username/project/storage/ipa

🔧 Worker Storage Configuration:
Local storage (relative): ./worker_storage
Local storage (absolute): /Users/username/project/worker_storage
Detection base path: /Users/username/project/detection_results

🔍 Detection Result Configuration:
Detection result file structure:
/Users/username/project/detection_results/
├── result/
│   └── sample-task-12345/
│       └── result.json

Expected result.json format:
{
  "sim": 0.7252
}

Detection process:
1. Worker receives task
2. Worker downloads IPA files to local storage
3. Worker reads result from basePath/result/{taskId}/result.json
4. Worker extracts "sim" field as similarity_score
5. Worker updates task status in database
```

## 🛠️ 开发环境启动

```bash
# 安装依赖
npm install

# 启动API服务器和Worker (开发模式)
npm run dev

# 启动前端 (另一个终端)
cd frontend
npm install
npm run dev
```

## 🏭 生产环境部署

```bash
# 生产环境启动脚本
./scripts/start-prod.sh
```

生产环境建议使用绝对路径配置：
```bash
export STORAGE_PATH="/var/lib/ipa_check/storage"
export LOCAL_STORAGE="/var/lib/ipa_check/worker_storage"
export DETECTION_BASE_PATH="/var/lib/detection/results"
```

## 📋 系统状态检查

```bash
# API健康检查
curl http://localhost:8080/api/health

# 存储目录状态
ls -la storage/
ls -la worker_storage/

# 检测结果目录状态
ls -la detection_results/result/
```

## 🔧 关键特性

- ✅ **绝对路径支持**: 所有文件路径自动转换为绝对路径
- ✅ **跨平台兼容**: 支持Windows、Linux、macOS
- ✅ **自动路径转换**: 相对路径自动转换为基于工作目录的绝对路径
- ✅ **启动时验证**: 启动时打印所有关键路径信息
- ✅ **目录自动创建**: 启动时自动创建必要的存储目录
- ✅ **分布式缓存**: Worker节点智能文件缓存，避免重复传输
- ✅ **Rsync绝对路径**: 文件传输使用完整的绝对路径
- ✅ **Worker路径通信**: Worker主动告知API其存储绝对路径
- ✅ **JSON结果读取**: 从预定义JSON文件读取检测结果
- ✅ **检测路径配置**: 可配置的检测结果基础路径

## 🎯 路径配置最佳实践

1. **开发环境**: 使用相对路径，便于项目移植
2. **生产环境**: 使用绝对路径，确保部署一致性
3. **容器部署**: 挂载卷到绝对路径，如 `/data/storage`
4. **分布式部署**: 每个Worker节点使用独立的本地存储路径
5. **Rsync配置**: 确保Worker与API之间SSH免密登录
6. **路径权限**: 确保rsync目标路径有足够的写权限
7. **检测结果**: 确保检测结果目录存在且包含正确格式的JSON文件
8. **平台兼容**: 不同平台使用合适的默认路径

## 📄 API接口

- `POST /api/tasks` - 创建任务
- `GET /api/tasks` - 获取任务列表  
- `GET /api/tasks/:taskId` - 查询任务状态
- `POST /api/files/request` - 文件传输请求 (Worker使用)
- `GET /api/stats` - 系统统计
- `GET /api/health` - 健康检查 