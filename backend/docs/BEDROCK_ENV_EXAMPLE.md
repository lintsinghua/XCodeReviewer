# AWS Bedrock API Key 环境变量配置示例

## 环境变量配置

将以下内容添加到您的 `.env` 文件或系统环境变量中：

```bash
# AWS Bedrock API Key
# 参考: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-how.html
BEDROCK_API_KEY=your_bedrock_api_key_here

# 可选: 自定义区域 (默认: us-east-1)
# 注意: API key 只能在生成它的区域使用
# BEDROCK_REGION=us-east-1
```

## 如何生成 Bedrock API Key

### 步骤 1: 登录 AWS Console
访问 [AWS Console](https://console.aws.amazon.com/) 并登录

### 步骤 2: 导航到 Bedrock 服务
在服务搜索栏中输入 "Bedrock" 并选择该服务

### 步骤 3: 进入 API keys 页面
在左侧菜单中选择 **"API keys"**

### 步骤 4: 创建 API key
点击 **"Create API key"** 按钮

### 步骤 5: 选择 Key 类型

#### Short-term key（推荐用于生产）
- ✅ 有效期：12小时
- ✅ 更安全
- ✅ 自动过期
- 适用于生产环境

#### Long-term key（推荐用于开发）
- 🕐 自定义过期时间
- 🛠️ 适合开发和测试
- ⚠️ 需要定期手动轮换

### 步骤 6: 配置权限（仅 Long-term key）
如果选择 Long-term key，需要选择 IAM 策略，确保包含以下权限：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/*"
    }
  ]
}
```

### 步骤 7: 复制 API key
⚠️ **重要**: API key 只会显示一次！请立即复制并妥善保存。

API key 格式示例（这不是真实的 key）：
```
bdr_1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ...
```

## 配置方式

### 方法 1: 直接设置环境变量

```bash
export BEDROCK_API_KEY="your_bedrock_api_key_here"
```

### 方法 2: 使用 .env 文件

创建或编辑 `/home/ubuntu/XCodeReviewer/backend/.env` 文件：

```bash
# 在 backend 目录下
cd /home/ubuntu/XCodeReviewer/backend

# 创建 .env 文件（如果不存在）
cat >> .env << EOF
# AWS Bedrock API Key
BEDROCK_API_KEY=your_bedrock_api_key_here
EOF

# 设置文件权限
chmod 600 .env
```

### 方法 3: Docker Compose

在 `docker-compose.yml` 中添加：

```yaml
services:
  backend:
    environment:
      - BEDROCK_API_KEY=${BEDROCK_API_KEY}
```

然后在宿主机设置环境变量或创建 `.env` 文件。

### 方法 4: Kubernetes Secret

```bash
# 创建 secret
kubectl create secret generic bedrock-api-key \
  --from-literal=BEDROCK_API_KEY=your_bedrock_api_key_here

# 在 deployment 中使用
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xcodereview-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: BEDROCK_API_KEY
          valueFrom:
            secretKeyRef:
              name: bedrock-api-key
              key: BEDROCK_API_KEY
```

## 验证配置

### 1. 检查环境变量

```bash
# 验证环境变量已设置
echo $BEDROCK_API_KEY

# 应该显示您的 API key（前几位）
# bdr_1234567890abcdef...
```

### 2. 测试后端服务

```bash
# 启动后端服务
cd /home/ubuntu/XCodeReviewer/backend
source /home/ubuntu/miniconda3/bin/activate code
uvicorn app.main:app --reload

# 检查日志中是否有 Bedrock 注册信息
# 应该看到: "Registered LLM adapter: bedrock"
```

### 3. 测试 API 连接

```bash
# 查看 Bedrock provider 配置
curl -s http://localhost:8000/api/v1/llm-providers | \
  jq '.items[] | select(.name=="bedrock")'

# 应该显示 Bedrock provider 的详细信息
```

## 安全最佳实践

### 🔒 1. 不要将 API key 提交到版本控制

确保 `.env` 文件在 `.gitignore` 中：

```bash
# 检查 .gitignore
cat .gitignore | grep ".env"

# 如果不存在，添加
echo ".env" >> .gitignore
```

### 🔄 2. 定期轮换 API key

**Short-term key**: 自动过期，无需手动轮换

**Long-term key**: 建议每 30-90 天轮换：

```bash
# 轮换步骤
# 1. 在 AWS Console 生成新的 API key
# 2. 更新环境变量
export BEDROCK_API_KEY="new_api_key_here"

# 3. 重启服务
# 4. 在 AWS Console 删除旧的 API key
```

### 🔐 3. 使用 Secrets Manager（生产环境）

```bash
# 存储到 AWS Secrets Manager
aws secretsmanager create-secret \
  --name xcodereview/bedrock-api-key \
  --secret-string "your_bedrock_api_key_here"

# 在应用中读取
aws secretsmanager get-secret-value \
  --secret-id xcodereview/bedrock-api-key \
  --query SecretString \
  --output text
```

### 👥 4. 限制访问权限

```bash
# 设置 .env 文件权限
chmod 600 .env
chown $(whoami):$(whoami) .env

# 确保只有当前用户可以读取
ls -la .env
# 应该显示: -rw------- 1 username username ...
```

### 📊 5. 监控使用情况

在 AWS Console 中监控 Bedrock API 调用：

1. 导航到 **CloudTrail**
2. 查看 **Event history**
3. 筛选 Bedrock 相关事件
4. 设置异常使用警报

## 常见问题

### Q: API key 格式是什么？

A: Bedrock API key 通常以 `bdr_` 开头，后跟一长串字母和数字。

### Q: API key 可以在多个区域使用吗？

A: 不可以。API key 只能在生成它的区域使用。如果需要在其他区域使用，请在目标区域生成新的 API key。

### Q: 如何知道 API key 是否有效？

A: 可以通过后端日志查看。如果 API key 无效，会看到 401 或 403 错误。

### Q: Short-term key 过期后怎么办？

A: Short-term key 会在 12 小时后自动过期。您需要重新生成新的 key。对于长期运行的服务，建议使用 Long-term key 或实现自动刷新机制。

### Q: 我可以使用 AWS Access Key ID 和 Secret 吗？

A: XCodeReviewer 的 Bedrock adapter 专门设计为使用 **API key** 方式，以简化配置。如果您需要使用传统的 AWS 凭证，需要修改 adapter 代码。

## 相关文档

- 📘 [AWS Bedrock API Keys 官方文档](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-how.html)
- 📘 [完整配置指南](./AWS_BEDROCK_SETUP.md)
- 🔒 [AWS 安全最佳实践](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)

## 获取帮助

如果您在配置过程中遇到问题：

1. 查看后端日志：`tail -f backend.log | grep "Bedrock"`
2. 检查 API key 格式和有效期
3. 确认 Bedrock 服务在您的区域可用
4. 提交 Issue 到项目 GitHub 仓库

