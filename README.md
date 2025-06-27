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