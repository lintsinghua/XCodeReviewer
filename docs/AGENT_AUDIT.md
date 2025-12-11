# DeepAudit Agent 审计模块

## 概述

Agent 审计模块是 DeepAudit 的高级安全审计功能，基于 **LangGraph** 状态图构建的混合 AI Agent 架构，实现自主代码安全分析和漏洞验证。

## LangGraph 工作流架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LangGraph 审计工作流                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│    START                                                            │
│      │                                                              │
│      ▼                                                              │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                     Recon Node (信息收集)                       ││
│  │  • 项目结构分析          • 技术栈识别                          ││
│  │  • 入口点发现            • 依赖扫描                            ││
│  │                                                                ││
│  │  使用工具: list_files, npm_audit, safety_scan, gitleaks_scan   ││
│  └────────────────────────────┬───────────────────────────────────┘│
│                               │                                    │
│                               ▼                                    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                    Analysis Node (漏洞分析)                     ││
│  │  • Semgrep 静态分析      • RAG 语义搜索                        ││
│  │  • 模式匹配              • LLM 深度分析                        ││
│  │  • 数据流追踪                                                  ││
│  │                                                  ◄─────┐       ││
│  │  使用工具: semgrep_scan, bandit_scan, rag_query,      │       ││
│  │            code_analysis, pattern_match               │       ││
│  └────────────────────────────┬──────────────────────────┘───────┘│
│                               │                          │        │
│                               ▼                          │        │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                  Verification Node (漏洞验证)                   ││
│  │  • LLM 漏洞验证          • 沙箱测试                            ││
│  │  • PoC 生成              • 误报过滤                            ││
│  │                                               ────────┘        ││
│  │  使用工具: vulnerability_validation, sandbox_exec,             ││
│  │            verify_vulnerability                                ││
│  └────────────────────────────┬───────────────────────────────────┘│
│                               │                                    │
│                               ▼                                    │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                     Report Node (报告生成)                      ││
│  │  • 漏洞汇总              • 安全评分                            ││
│  │  • 修复建议              • 统计分析                            ││
│  └────────────────────────────┬───────────────────────────────────┘│
│                               │                                    │
│                               ▼                                    │
│                              END                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

状态流转:
  • Recon → Analysis: 收集到入口点后进入分析
  • Analysis → Analysis: 发现较多问题时继续迭代
  • Analysis → Verification: 有发现时进入验证
  • Verification → Analysis: 误报率高时回溯分析
  • Verification → Report: 验证完成后生成报告
```

## 核心特性

### 1. LangGraph 状态图

- **声明式工作流**: 使用图结构定义 Agent 协作流程
- **状态自动合并**: `Annotated[List, operator.add]` 实现发现累加
- **条件路由**: 基于状态动态决定下一步
- **检查点恢复**: 支持任务中断后继续

### 2. Agent 工具集

#### 内置工具

| 工具 | 功能 | 节点 |
|------|------|------|
| `list_files` | 目录浏览 | Recon |
| `read_file` | 文件读取 | All |
| `search_code` | 代码搜索 | Analysis |
| `rag_query` | 语义检索 | Analysis |
| `security_search` | 安全代码搜索 | Analysis |
| `function_context` | 函数上下文 | Analysis |
| `pattern_match` | 模式匹配 | Analysis |
| `code_analysis` | LLM 分析 | Analysis |
| `dataflow_analysis` | 数据流追踪 | Analysis |
| `vulnerability_validation` | 漏洞验证 | Verification |
| `sandbox_exec` | 沙箱执行 | Verification |
| `verify_vulnerability` | 自动验证 | Verification |

#### 外部安全工具

| 工具 | 功能 | 适用场景 |
|------|------|----------|
| `semgrep_scan` | Semgrep 静态分析 | 多语言快速扫描 |
| `bandit_scan` | Bandit Python 扫描 | Python 安全分析 |
| `gitleaks_scan` | Gitleaks 密钥检测 | 密钥泄露检测 |
| `trufflehog_scan` | TruffleHog 扫描 | 深度密钥扫描 |
| `npm_audit` | npm 依赖审计 | Node.js 依赖漏洞 |
| `safety_scan` | Safety Python 审计 | Python 依赖漏洞 |
| `osv_scan` | OSV 漏洞扫描 | 多语言依赖漏洞 |

### 3. RAG 系统

- **代码分块**: 基于 Tree-sitter AST 的智能分块
- **向量存储**: ChromaDB 持久化
- **多语言支持**: Python, JavaScript, TypeScript, Java, Go, PHP, Rust 等
- **嵌入模型**: 独立配置，支持 OpenAI、Ollama、Cohere、HuggingFace

### 4. 安全沙箱

- **Docker 隔离**: 安全容器执行
- **资源限制**: 内存、CPU 限制
- **网络隔离**: 可配置网络访问
- **seccomp 策略**: 系统调用白名单

## 配置

### 环境变量

```bash
# LLM 配置
DEFAULT_LLM_MODEL=gpt-4-turbo-preview
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1

# 嵌入模型配置（独立于 LLM）
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# 向量数据库
VECTOR_DB_PATH=./data/vectordb

# 沙箱配置
SANDBOX_IMAGE=deepaudit-sandbox:latest
SANDBOX_MEMORY_LIMIT=512m
SANDBOX_CPU_LIMIT=1.0
SANDBOX_NETWORK_DISABLED=true
```

### Agent 任务配置

```json
{
  "target_vulnerabilities": [
    "sql_injection",
    "xss", 
    "command_injection",
    "path_traversal",
    "ssrf"
  ],
  "verification_level": "sandbox",
  "exclude_patterns": ["node_modules", "__pycache__", ".git"],
  "max_iterations": 3,
  "timeout_seconds": 1800
}
```

## 部署

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt

# 可选：安装外部工具
pip install semgrep bandit safety
brew install gitleaks trufflehog osv-scanner  # macOS
```

### 2. 构建沙箱镜像

```bash
cd docker/sandbox
./build.sh
```

### 3. 数据库迁移

```bash
alembic upgrade head
```

### 4. 启动服务

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## API 接口

### 创建任务

```http
POST /api/v1/agent-tasks/
Content-Type: application/json

{
  "project_id": "xxx",
  "name": "安全审计",
  "target_vulnerabilities": ["sql_injection", "xss"],
  "verification_level": "sandbox",
  "max_iterations": 3
}
```

### 事件流

```http
GET /api/v1/agent-tasks/{task_id}/events
Accept: text/event-stream
```

### 获取发现

```http
GET /api/v1/agent-tasks/{task_id}/findings?verified_only=true
```

### 任务摘要

```http
GET /api/v1/agent-tasks/{task_id}/summary
```

## 支持的漏洞类型

| 类型 | 说明 |
|------|------|
| `sql_injection` | SQL 注入 |
| `xss` | 跨站脚本 |
| `command_injection` | 命令注入 |
| `path_traversal` | 路径遍历 |
| `ssrf` | 服务端请求伪造 |
| `xxe` | XML 外部实体 |
| `insecure_deserialization` | 不安全反序列化 |
| `hardcoded_secret` | 硬编码密钥 |
| `weak_crypto` | 弱加密 |
| `authentication_bypass` | 认证绕过 |
| `authorization_bypass` | 授权绕过 |
| `idor` | 不安全直接对象引用 |

## 目录结构

```
backend/app/services/agent/
├── __init__.py              # 模块导出
├── event_manager.py         # 事件管理
├── agents/                  # Agent 实现
│   ├── __init__.py
│   ├── base.py             # Agent 基类
│   ├── recon.py            # 信息收集 Agent
│   ├── analysis.py         # 漏洞分析 Agent
│   ├── verification.py     # 漏洞验证 Agent
│   └── orchestrator.py     # 编排 Agent
├── graph/                   # LangGraph 工作流
│   ├── __init__.py
│   ├── audit_graph.py      # 状态定义和图构建
│   ├── nodes.py            # 节点实现
│   └── runner.py           # 执行器
├── tools/                   # Agent 工具
│   ├── __init__.py
│   ├── base.py             # 工具基类
│   ├── rag_tool.py         # RAG 工具
│   ├── pattern_tool.py     # 模式匹配工具
│   ├── code_analysis_tool.py
│   ├── file_tool.py        # 文件操作
│   ├── sandbox_tool.py     # 沙箱工具
│   └── external_tools.py   # 外部安全工具
└── prompts/                 # 系统提示词
    ├── __init__.py
    └── system_prompts.py
```

## 故障排除

### 沙箱镜像检查

```bash
docker images | grep deepaudit-sandbox
```

### 日志查看

```bash
tail -f logs/agent.log
```

### 常见问题

1. **RAG 初始化失败**: 检查嵌入模型配置和 API Key
2. **沙箱启动失败**: 确保 Docker 正常运行
3. **外部工具不可用**: 检查 semgrep/bandit 等是否已安装

