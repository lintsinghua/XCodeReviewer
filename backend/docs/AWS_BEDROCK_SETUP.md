# AWS Bedrock Claude 配置指南

## 概述

AWS Bedrock 是 Amazon 提供的托管式 AI 服务，支持多种 LLM 模型，包括 Anthropic Claude 系列。XCodeReviewer 现已支持通过 **AWS Bedrock API key** 方式使用 Claude 模型，提供更简单的认证方式。

**参考文档**: [How Amazon Bedrock API keys work](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-how.html)

## ⭐ API Key vs 传统认证方式

### 传统方式（使用 boto3 SDK）
1. 创建 IAM 用户/角色
2. 配置复杂的 IAM 策略
3. 管理 AWS Access Key ID 和 Secret Access Key
4. 设置多个环境变量

### API Key 方式（推荐✅）
1. 在 Bedrock 控制台生成 API key
2. 配置单个环境变量 `BEDROCK_API_KEY`
3. 开始使用 ✨

**XCodeReviewer 当前使用 API Key 方式**，更简单、更安全！

## 配置步骤

### 1. 启用 AWS Bedrock 模型访问

1. 登录 [AWS Console](https://console.aws.amazon.com/)
2. 导航到 **Bedrock** 服务
3. 选择目标区域（例如：`us-east-1`）
4. 进入 **Model access** 页面
5. 请求访问 Claude 模型：
   - ✅ `Claude 3.5 Sonnet v2` (推荐)
   - ✅ `Claude 3.5 Sonnet`
   - ✅ `Claude 3 Opus`
   - ✅ `Claude 3 Sonnet`
   - ✅ `Claude 3 Haiku`

### 2. 生成 Bedrock API Key

根据[官方文档](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-how.html)，有两种类型的 API key：

#### 选项 A: Short-term key（短期密钥）- 推荐用于生产 🔒

**特点**:
- ✅ 更安全
- ⏱️ 有效期：12小时或 IAM 会话持续时间（取较短者）
- 🔑 继承生成该 key 的 IAM 主体的权限
- 🌍 只能在生成的 AWS 区域使用

**生成步骤**:
1. 在 Bedrock 控制台选择 **API keys**
2. 点击 **Create API key**
3. 选择 **Short-term key**
4. 选择区域（us-east-1）
5. 复制生成的 API key

#### 选项 B: Long-term key（长期密钥）- 推荐用于开发 🧪

**特点**:
- 🕐 可自定义过期时间
- 🛠️ 适合探索和开发
- ⚠️ 生产环境建议使用 short-term key

**生成步骤**:
1. 在 Bedrock 控制台选择 **API keys**
2. 点击 **Create API key**
3. 选择 **Long-term key**
4. 设置过期时间（例如：30天、90天）
5. 选择权限策略（选择包含 `bedrock:InvokeModel` 的策略）
6. 复制生成的 API key

⚠️ **重要**: API key 只在生成时显示一次，请妥善保存！

### 3. 配置环境变量

在服务器或 `.env` 文件中设置：

```bash
# AWS Bedrock API Key
BEDROCK_API_KEY=your_bedrock_api_key_here

# 可选：自定义区域（默认 us-east-1）
# 注意：API key 只能在生成它的区域使用
# BEDROCK_REGION=us-east-1
```

#### Docker 环境

在 `docker-compose.yml` 或 `docker-compose.dev.yml` 中添加：

```yaml
services:
  backend:
    environment:
      - BEDROCK_API_KEY=${BEDROCK_API_KEY}
```

### 4. 在 XCodeReviewer 中使用

1. 🔧 登录 XCodeReviewer 管理后台
2. 📋 进入 **LLM 提供商** 页面
3. 🟧 找到 **AWS Bedrock Claude** 提供商
4. ✅ 确认状态为 **激活**
5. 🎨 **创建审计任务**或**即时分析**时，选择 **AWS Bedrock Claude**

## 支持的模型

| 模型 ID | 描述 | 输入定价 (USD/1M tokens) | 输出定价 (USD/1M tokens) | 推荐场景 |
|---------|------|--------------------------|--------------------------|----------|
| `anthropic.claude-3-5-sonnet-20241022-v2:0` | Claude 3.5 Sonnet v2 ⭐ | $3.00 | $15.00 | **推荐** - 性价比最高 |
| `anthropic.claude-3-5-sonnet-20240620-v1:0` | Claude 3.5 Sonnet v1 | $3.00 | $15.00 | 通用代码审查 |
| `anthropic.claude-3-opus-20240229-v1:0` | Claude 3 Opus 💎 | $15.00 | $75.00 | 高难度复杂任务 |
| `anthropic.claude-3-sonnet-20240229-v1:0` | Claude 3 Sonnet | $3.00 | $15.00 | 平衡性能与成本 |
| `anthropic.claude-3-haiku-20240307-v1:0` | Claude 3 Haiku ⚡ | $0.25 | $1.25 | 快速简单任务 |

## 技术实现细节

XCodeReviewer 使用 **httpx** 库通过 HTTPS REST API 调用 Bedrock Converse API，而不是 boto3 SDK：

```python
# Endpoint 格式
POST https://bedrock-runtime.{region}.amazonaws.com/model/{modelId}/converse

# 认证头
Authorization: Bearer {api_key}
x-amz-bedrock-api-key: {api_key}
```

**优势**:
- ✅ 无需 boto3 依赖
- ✅ 更轻量级
- ✅ 更简单的认证流程
- ✅ 支持异步调用和流式响应

## 区域支持

当前默认配置使用 `us-east-1` 区域。

**重要限制**: 
- 🌍 API key 只能在生成它的区域使用
- 📍 确保 `api_endpoint` 配置与 API key 的区域一致

如需使用其他区域：

1. 在 Bedrock 控制台切换到目标区域
2. 在该区域生成新的 API key
3. 在数据库中更新 LLM Provider 的 `api_endpoint` 字段
4. 或创建新的自定义 LLM Provider 配置

## 故障排查

### 错误：`401 Unauthorized`

**原因**: API key 无效或已过期

**解决方案**:
```bash
# 检查环境变量
echo $BEDROCK_API_KEY

# 验证 API key 格式（应该是一个长字符串）
# 如果是 short-term key，检查是否超过12小时
# 如果是 long-term key，检查是否已过期
```

重新生成 API key 并更新环境变量。

### 错误：`403 Forbidden` 或 `AccessDeniedException`

**原因**: API key 缺少必要权限

**解决方案**:
- 对于 short-term key：确保生成 key 的 IAM 主体有 `bedrock:InvokeModel` 权限
- 对于 long-term key：在创建时选择正确的权限策略

### 错误：`404 Not Found` 或 `ResourceNotFoundException`

**原因**: 
1. 模型在当前区域不可用
2. API key 的区域与请求的区域不匹配
3. 模型访问未启用

**解决方案**:
```bash
# 检查配置
# 1. 确认 API key 是在 us-east-1 生成的
# 2. 在 Bedrock 控制台确认模型访问已启用
# 3. 等待模型访问请求审批（通常几分钟）
```

### 错误：`429 ThrottlingException`

**原因**: 达到 API 调用速率限制

**解决方案**:
- ✅ BedrockAdapter 已内置重试逻辑
- 考虑升级 AWS 账户的服务配额
- 使用更快的模型（如 Claude 3 Haiku）减少调用时间

### 错误：`Connection timeout` 或 `HTTP errors`

**原因**: 网络连接问题或 Bedrock 服务不可用

**解决方案**:
```bash
# 测试网络连接
curl -I https://bedrock-runtime.us-east-1.amazonaws.com

# 检查后端日志
tail -f /home/ubuntu/XCodeReviewer/backend/backend.log | grep "Bedrock"
```

## 成本优化建议

### 1. 选择合适的模型

| 任务类型 | 推荐模型 | 原因 |
|---------|---------|------|
| 简单代码检查 | Claude 3 Haiku | 最便宜，速度快 |
| 常规代码审查 | Claude 3.5 Sonnet v2 ⭐ | **性价比最高** |
| 架构设计审查 | Claude 3.5 Sonnet v2 | 平衡性能与成本 |
| 安全审计 | Claude 3 Opus | 最准确，适合关键任务 |

### 2. 监控使用量

```bash
# 在 AWS Cost Explorer 中跟踪 Bedrock 费用
# 设置预算警报：
# AWS Console → Billing → Budgets → Create budget
```

### 3. 优化提示词

- ✅ 使用简洁明确的提示词
- ✅ 避免重复发送相同上下文
- ✅ 对于批量任务，考虑使用更便宜的模型

### 4. 使用 Short-term keys

- 🔒 更安全
- 💰 自动过期，避免长期暴露
- 🔄 配合 IAM 角色使用，无需长期存储凭证

## API Key 管理最佳实践

### 🔒 安全存储

```bash
# ❌ 不要这样做
export BEDROCK_API_KEY="abcd1234..."  # 明文存储

# ✅ 推荐方式
# 1. 使用 secrets 管理工具
kubectl create secret generic bedrock-api-key --from-literal=key=abcd1234...

# 2. 使用 AWS Secrets Manager
aws secretsmanager create-secret --name bedrock-api-key --secret-string "abcd1234..."

# 3. 使用 .env 文件（开发环境）
echo "BEDROCK_API_KEY=abcd1234..." >> .env
chmod 600 .env  # 限制文件权限
```

### 🔄 定期轮换

- Short-term key：自动过期，无需手动轮换
- Long-term key：建议每30-90天轮换一次

```bash
# 轮换步骤
# 1. 生成新的 API key
# 2. 更新环境变量
# 3. 重启服务
# 4. 删除旧的 API key
```

### 📊 审计使用情况

在 AWS CloudTrail 中查看 Bedrock API 调用日志：

```bash
# 查看最近的 Bedrock API 调用
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::Bedrock::Model \
  --max-results 50
```

## 性能优化

### 1. 连接池配置

BedrockAdapter 使用 httpx 的异步客户端，默认配置：

```python
# 默认超时: 300秒（5分钟）
# 连接超时: 30秒
# 支持连接复用和 HTTP/2
```

### 2. 流式响应

对于长响应，使用流式 API 获得更好的用户体验：

```python
# 在 InstantAnalysis 中使用流式响应
async for chunk in analyzer.stream(code, language):
    # 实时显示结果
    print(chunk, end='', flush=True)
```

### 3. 并发控制

```python
# 建议限制并发请求数量
# 避免触发速率限制
max_concurrent_requests = 10
```

## 参考链接

- 📘 [AWS Bedrock API Keys 文档](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-how.html)
- 📘 [Bedrock Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html)
- 💰 [Claude 模型定价](https://aws.amazon.com/bedrock/pricing/)
- 🔒 [IAM 最佳实践](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- 🔑 [长期访问密钥的替代方案](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html)

## 技术支持

如遇到配置问题，请：

1. 📋 查看后端日志：
```bash
tail -f /home/ubuntu/XCodeReviewer/backend/backend.log | grep "🟧 Bedrock"
```

2. 🔍 检查 API key 配置：
```bash
# 验证环境变量
env | grep BEDROCK

# 测试 API 连接
curl -H "Authorization: Bearer $BEDROCK_API_KEY" \
  https://bedrock-runtime.us-east-1.amazonaws.com/
```

3. 💬 提交 Issue 到项目 GitHub 仓库

## 快速开始示例

```bash
# 1. 生成 Bedrock API key（在 AWS Console）
# 2. 配置环境变量
export BEDROCK_API_KEY="your_api_key_here"

# 3. 重启后端服务
cd /home/ubuntu/XCodeReviewer/backend
source /home/ubuntu/miniconda3/bin/activate code
uvicorn app.main:app --reload

# 4. 验证配置
curl -s http://localhost:8000/api/v1/llm-providers | grep -A 10 "bedrock"

# 5. 在前端选择 AWS Bedrock Claude 🟧
# 6. 开始代码审查！🚀
```

祝您使用愉快！✨
