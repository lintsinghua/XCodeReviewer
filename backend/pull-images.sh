#!/bin/bash

echo "📥 拉取 Docker 镜像..."
echo ""

# 拉取镜像
echo "1️⃣ 拉取 PostgreSQL 15..."
docker pull postgres:18-alpine

echo ""
echo "2️⃣ 拉取 Redis 7..."
docker pull redis:7-alpine

echo ""
echo "3️⃣ 拉取 MinIO..."
docker pull minio/minio:latest

echo ""
echo "✅ 所有镜像拉取完成！"
echo ""
echo "📋 已拉取的镜像:"
docker images | grep -E "postgres|redis|minio"

echo ""
echo "🚀 现在可以运行: ./docker-start.sh"
