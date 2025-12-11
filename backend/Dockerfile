FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# 清除代理设置，避免容器内网络问题
ENV http_proxy=
ENV https_proxy=
ENV HTTP_PROXY=
ENV HTTPS_PROXY=

# 安装系统依赖（包含 WeasyPrint 所需的库和中文字体支持）
RUN rm -f /etc/apt/apt.conf.d/proxy.conf 2>/dev/null || true && \
    unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        curl \
        # WeasyPrint 完整依赖
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi-dev \
        libglib2.0-0 \
        shared-mime-info \
        # 字体支持（中文）
        fonts-noto-cjk \
        fonts-noto-cjk-extra \
        fontconfig \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# 复制依赖文件
COPY pyproject.toml uv.lock ./

# 使用 uv 安装依赖（确保无代理）
RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY && \
    uv sync --frozen --no-dev

# 复制应用代码
COPY . .

# 创建上传目录
RUN mkdir -p /app/uploads/zip_files

# 暴露端口
EXPOSE 8000

# 启动命令（开发模式由 docker-compose 覆盖）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]




