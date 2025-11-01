#!/bin/bash
# 启动完整版 XCodeReviewer Backend API

echo "🚀 启动 XCodeReviewer Backend API..."
echo ""

# 激活 conda 环境并启动服务器
conda run -n code uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
