#!/bin/sh

# 替换 API 地址占位符
API_URL="${VITE_API_BASE_URL:-http://localhost:8000/api/v1}"

# 在所有 JS 文件中替换占位符
find /app/dist -name '*.js' -exec sed -i "s|__API_BASE_URL__|${API_URL}|g" {} \;

# 执行原始命令
exec "$@"
