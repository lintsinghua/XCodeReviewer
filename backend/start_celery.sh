#!/bin/bash
# Celery Worker 启动脚本
# 切换到 backend 目录
cd "$(dirname "$0")"

# 设置 Celery Worker 环境变量以使用 NullPool 连接池
export CELERY_WORKER=1

# 启动 Celery Worker
echo "🚀 启动 Celery Worker..."
celery -A tasks.celery_app worker --loglevel=info --concurrency=4

# 注意：
# - 确保 Redis 正在运行 (redis-server)
# - 确保已设置环境变量 CELERY_BROKER_URL 和 CELERY_RESULT_BACKEND
# - 可以添加 --detach 参数在后台运行
# - CELERY_WORKER=1 环境变量启用 NullPool 以避免数据库连接冲突

