FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装系统依赖（包含 WeasyPrint 所需的库和中文字体支持）
RUN for i in 1 2 3; do \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        # WeasyPrint 依赖
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libcairo2 \
        libgdk-pixbuf2.0-0 \
        libffi-dev \
        shared-mime-info \
        # 字体支持（中文）
        fonts-noto-cjk \
        fonts-noto-cjk-extra \
        fontconfig \
        && fc-cache -fv \
        && rm -rf /var/lib/apt/lists/* \
        && break || sleep 5; \
    done

# 复制依赖文件
COPY pyproject.toml .
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建上传目录
RUN mkdir -p /app/uploads/zip_files

# 暴露端口
EXPOSE 8000

# 启动命令（开发模式由 docker-compose 覆盖）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]



