#!/bin/bash
# Celery Worker 启动脚本
# 用于本地开发环境

# 激活 conda 环境
source ~/miniconda3/etc/profile.d/conda.sh
conda activate code

# 切换到 backend 目录
cd "$(dirname "$0")"

# 启动 Celery Worker
echo "🚀 启动 Celery Worker..."
celery -A tasks.celery_app worker --loglevel=info --concurrency=4

# 注意：
# - 确保 Redis 正在运行 (redis-server)
# - 确保已设置环境变量 CELERY_BROKER_URL 和 CELERY_RESULT_BACKEND
# - 可以添加 --detach 参数在后台运行

