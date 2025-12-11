FROM node:20-alpine AS builder

WORKDIR /app

# 清除代理设置
ENV http_proxy=
ENV https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=

# 安装 pnpm（确保无代理）
RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY && \
    npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖（确保无代理）
RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY && \
    pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建时使用占位符，运行时替换
ENV VITE_API_BASE_URL=__API_BASE_URL__

# 构建生产版本
RUN pnpm build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 清除代理设置
ENV http_proxy=
ENV https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=

# 安装 serve（确保无代理）
RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY && \
    npm install -g serve

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 复制启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["serve", "-s", "dist", "-l", "3000"]

