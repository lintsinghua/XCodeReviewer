#!/bin/sh
set -e

# 替换 API 地址占位符
# 默认为 /api/v1，这样即使用户不传参，也能配合默认的 nginx 代理工作
API_URL="${VITE_API_BASE_URL:-/api/v1}"

echo "Injecting API URL: $API_URL"

# 在所有 JS 文件中替换占位符
# 注意：这里路径必须是 nginx 实际存放文件的路径
ESCAPED_API_URL=$(echo "${API_URL}" | sed 's/[&/|]/\\&/g')
find /usr/share/nginx/html -name '*.js' -exec sed -i "s|__API_BASE_URL__|${ESCAPED_API_URL}|g" {} \;

# 执行原始命令
exec "$@"
