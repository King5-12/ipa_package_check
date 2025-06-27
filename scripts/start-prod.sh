#!/bin/bash

# IPA检测平台生产环境启动脚本

echo "🚀 启动IPA包代码相似度检测平台 - 生产环境"

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装PM2..."
    npm install -g pm2
fi

# 构建前端
echo "🔨 构建前端应用..."
cd frontend && npm run build && cd ..

# 停止现有进程
echo "🛑 停止现有进程..."
pm2 delete ipa-api ipa-worker 2>/dev/null || true

# 启动API服务器
echo "🌟 启动API服务器..."
pm2 start server.ts --name ipa-api --interpreter ts-node -- --env production

# 启动Worker
echo "🔧 启动Worker进程..."
pm2 start worker.ts --name ipa-worker --interpreter ts-node -- --env production

# 保存PM2配置
pm2 save

# 显示状态
echo "📊 服务状态:"
pm2 status

echo ""
echo "🎉 生产环境启动完成!"
echo "📱 访问地址: http://localhost:8080"
echo "📋 管理命令:"
echo "  - 查看日志: pm2 logs"
echo "  - 重启服务: pm2 restart all"
echo "  - 停止服务: pm2 stop all"
echo "  - 删除服务: pm2 delete all" 