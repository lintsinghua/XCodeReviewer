# DeepAudit Agent Sandbox
# 安全沙箱环境用于漏洞验证和 PoC 执行

FROM python:3.11-slim-bookworm

LABEL maintainer="XCodeReviewer Team"
LABEL description="Secure sandbox environment for vulnerability verification"

# 安装基本工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    netcat-openbsd \
    dnsutils \
    iputils-ping \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# 安装 Node.js (用于 JavaScript/TypeScript 代码执行)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# 安装常用的安全测试 Python 库
RUN pip install --no-cache-dir \
    requests \
    httpx \
    aiohttp \
    beautifulsoup4 \
    lxml \
    pycryptodome \
    paramiko \
    pyjwt \
    python-jose \
    sqlparse

# 创建非 root 用户
RUN groupadd -g 1000 sandbox && \
    useradd -u 1000 -g sandbox -m -s /bin/bash sandbox

# 创建工作目录
RUN mkdir -p /workspace /tmp/sandbox && \
    chown -R sandbox:sandbox /workspace /tmp/sandbox

# 设置环境变量
ENV HOME=/home/sandbox
ENV PATH=/home/sandbox/.local/bin:$PATH
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 限制 Python 导入路径
ENV PYTHONPATH=/workspace

# 切换到非 root 用户
USER sandbox

WORKDIR /workspace

# 默认命令
CMD ["/bin/bash"]

