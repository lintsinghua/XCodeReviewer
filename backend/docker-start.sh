#!/bin/bash

echo "🐳 启动 Docker 服务..."
echo ""

cd "$(dirname "$0")"

# 只启动基础服务（PostgreSQL, Redis, MinIO）
echo "📦 启动基础服务 (PostgreSQL, Redis, MinIO)..."
docker compose -f docker-compose.dev.yml up -d postgres redis minio

echo ""
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "📊 服务状态:"
docker compose -f docker-compose.dev.yml ps

echo ""
echo "✅ 基础服务已启动！"
echo ""
echo "📝 服务信息:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - MinIO: localhost:9000 (Console: localhost:9001)"
echo ""
echo "🚀 现在可以启动后端应用:"
echo "  cd backend"
echo "  conda activate code"
echo "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
