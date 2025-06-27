#!/bin/bash

# IPA检测平台开发环境启动脚本

echo "🚀 启动IPA包代码相似度检测平台 - 开发环境"

# 检查Node.js版本
node_version=$(node -v)
echo "Node.js版本: $node_version"

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装后端依赖..."
    npm install
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd frontend && npm install && cd ..
fi

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到.env文件，从.env.example复制..."
    cp .env.example .env
    echo "请编辑.env文件配置数据库等参数"
fi

# 检查MySQL连接
echo "🔍 检查MySQL连接..."
mysql_host=${DB_HOST:-localhost}
mysql_port=${DB_PORT:-3306}
mysql_user=${DB_USER:-root}

if command -v mysql &> /dev/null; then
    if mysql -h $mysql_host -P $mysql_port -u $mysql_user -e "SELECT 1;" &> /dev/null; then
        echo "✅ MySQL连接正常"
    else
        echo "❌ MySQL连接失败，请检查配置"
        echo "提示：运行 mysql -u root -p < database/init.sql 初始化数据库"
    fi
else
    echo "⚠️  MySQL客户端未安装，跳过连接检查"
fi

# 启动服务
echo "🌟 启动服务..."

# 使用tmux或screen启动多个服务（如果可用）
if command -v tmux &> /dev/null; then
    echo "使用tmux启动服务..."
    
    # 创建新会话
    tmux new-session -d -s ipa-dev
    
    # API服务器
    tmux new-window -t ipa-dev -n api
    tmux send-keys -t ipa-dev:api "npm run dev:api" C-m
    
    # 前端开发服务器
    tmux new-window -t ipa-dev -n frontend
    tmux send-keys -t ipa-dev:frontend "npm run dev:frontend" C-m
    
    # Worker
    tmux new-window -t ipa-dev -n worker
    tmux send-keys -t ipa-dev:worker "npm run dev:worker" C-m
    
    echo "✅ 所有服务已在tmux会话中启动"
    echo "📋 查看服务状态: tmux attach -t ipa-dev"
    echo "🔄 切换窗口: Ctrl+B → 窗口编号"
    echo "🚪 退出tmux: tmux kill-session -t ipa-dev"
    
elif command -v screen &> /dev/null; then
    echo "使用screen启动服务..."
    
    # API服务器
    screen -dmS ipa-api bash -c "npm run dev:api"
    
    # 前端开发服务器
    screen -dmS ipa-frontend bash -c "npm run dev:frontend"
    
    # Worker
    screen -dmS ipa-worker bash -c "npm run dev:worker"
    
    echo "✅ 所有服务已在screen会话中启动"
    echo "📋 查看API服务: screen -r ipa-api"
    echo "📋 查看前端服务: screen -r ipa-frontend"
    echo "📋 查看Worker服务: screen -r ipa-worker"
    
else
    echo "⚠️  未安装tmux/screen，手动启动服务..."
    echo "请在不同终端中运行："
    echo "1. npm run dev:api"
    echo "2. npm run dev:frontend"
    echo "3. npm run dev:worker"
fi

echo ""
echo "🎉 启动完成!"
echo "📱 前端地址: http://localhost:3000"
echo "🚀 API地址: http://localhost:8080"
echo "📚 API文档: http://localhost:8080/api/health" 