# =============================================
# DeepAudit Frontend Docker 构建
# =============================================
# 使用 Nginx 提供静态文件和反向代理 (支持 SSE 流式传输)

FROM node:20-alpine AS builder

WORKDIR /app

# 清除代理设置
ENV http_proxy=
ENV https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=

RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY && \
    npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY && \
    pnpm install --no-frozen-lockfile

# 复制源代码
COPY . .

# 🔥 构建时使用相对路径 /api - Nginx 会处理代理
ENV VITE_API_BASE_URL=/api/v1

# 构建生产版本
RUN pnpm build

# =============================================
# 生产镜像 - 使用 Nginx (支持 SSE 反向代理)
# =============================================
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置 (包含 SSE 反向代理配置)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
