# 🚀 启动开发服务器

## ✅ 环境已配置完成

你的开发环境已经准备就绪！

### 已完成的配置：

1. ✅ Conda 环境 `code` (Python 3.11.14)
2. ✅ 所有依赖已安装
3. ✅ 数据库已初始化 (SQLite)
4. ✅ Alembic 迁移已运行
5. ✅ 环境变量已配置

---

## 🎯 启动服务器

### 方式一：简单版本（推荐用于快速测试）

```bash
cd backend
conda activate code
uvicorn simple_start:app --reload --host 0.0.0.0 --port 8000
```

这将启动一个简化版的 API，包含基本的健康检查端点。

**访问地址：**
- 主页: http://localhost:8000
- 健康检查: http://localhost:8000/health
- API 状态: http://localhost:8000/api/v1/status

### 方式二：完整版本（需要修复缺失模块）

完整的应用程序需要一些额外的模块。当前缺少：
- `services.agent.coordinator`
- 其他一些服务模块

要运行完整版本，需要先实现这些缺失的模块。

---

## 🧪 测试 API

### 使用 curl 测试

```bash
# 测试健康检查
curl http://localhost:8000/health

# 测试根端点
curl http://localhost:8000/

# 测试 API 状态
curl http://localhost:8000/api/v1/status
```

### 使用浏览器

直接访问：
- http://localhost:8000
- http://localhost:8000/health

---

## 📊 当前状态

### ✅ 已完成
- Python 环境配置
- 依赖安装
- 数据库初始化
- 基本 API 框架

### ⚠️ 待完成
- 实现缺失的服务模块
- 完整的 API 端点
- Agent 协调器
- LLM 服务集成

---

## 🔧 下一步

### 1. 测试简单版本

```bash
conda activate code
cd backend
uvicorn simple_start:app --reload --port 8000
```

### 2. 实现缺失模块

需要创建以下模块：
- `services/agent/coordinator.py`
- `services/agent/base_agent.py`
- 其他相关服务

### 3. 逐步集成功能

一旦基本服务运行，可以逐步添加：
- 认证系统
- 项目管理
- 代码分析
- 报告生成

---

## 💡 提示

1. **使用简单版本开始**：先确保基本的 API 可以运行
2. **逐步添加功能**：不要一次性启动所有功能
3. **检查日志**：如果遇到问题，查看终端输出
4. **使用 API 文档**：访问 `/docs` 查看 Swagger UI（如果启用）

---

## 📞 需要帮助？

如果遇到问题：
1. 检查 conda 环境是否激活：`conda info --envs`
2. 检查端口是否被占用：`lsof -i:8000`
3. 查看错误日志
4. 参考 [开发者指南](docs/DEVELOPER_GUIDE.md)

---

**祝开发顺利！** 🎉
