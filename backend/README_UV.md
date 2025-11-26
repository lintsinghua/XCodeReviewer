# 使用 uv 管理 Python 依赖

本项目已迁移到使用 [uv](https://github.com/astral-sh/uv) 作为 Python 依赖管理器。

## 快速开始

### 安装 uv

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 Homebrew
brew install uv
```

### 安装依赖

```bash
cd backend
uv sync
```

这会自动创建虚拟环境并安装所有依赖。

### 运行项目

```bash
# 激活虚拟环境（uv 会自动管理）
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 或使用 uv 直接运行
uv run python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 数据库迁移

```bash
uv run alembic upgrade head
```

### 添加新依赖

```bash
# 添加依赖
uv add package-name

# 添加开发依赖
uv add --dev package-name
```

### 更新依赖

```bash
uv sync --upgrade
```

### 其他常用命令

```bash
# 查看已安装的包
uv pip list

# 运行 Python 脚本
uv run python script.py

# 运行 Alembic 命令
uv run alembic <command>
```

## 从 pip/venv 迁移

如果你之前使用 pip 和 venv：

1. 删除旧的虚拟环境（可选）：
   ```bash
   rm -rf venv
   ```

2. 使用 uv 同步依赖：
   ```bash
   uv sync
   ```

3. 之后使用 `uv run` 运行命令，或激活 uv 创建的虚拟环境。

## 优势

- **速度快**：比 pip 快 10-100 倍
- **可复现**：自动生成锁文件
- **简单**：一个命令管理所有依赖
- **兼容**：完全兼容 pip 和 requirements.txt

