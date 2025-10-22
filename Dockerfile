# 多阶段构建 - 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 禁用代理并安装 pnpm
ENV HTTP_PROXY=""
ENV HTTPS_PROXY=""
ENV http_proxy=""
ENV https_proxy=""
ENV NO_PROXY="*"
ENV no_proxy="*"

RUN npm config set registry https://registry.npmjs.org/ && \
    npm config delete proxy 2>/dev/null || true && \
    npm config delete https-proxy 2>/dev/null || true && \
    npm config delete http-proxy 2>/dev/null || true && \
    npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --no-frozen-lockfile

# 复制项目文件（包括 .env）
COPY . .

# 构建应用（环境变量会在构建时被读取）
RUN pnpm build

# 生产阶段 - 使用 nginx 提供静态文件服务
FROM nginx:alpine

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
