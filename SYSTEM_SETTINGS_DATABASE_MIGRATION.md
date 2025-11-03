# 系统配置数据库迁移指南

## 概述

系统配置已从前端 localStorage 迁移到后端数据库，实现配置的持久化和跨设备共享。

## 数据库变更

### 新增表：`system_settings`

```sql
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    updated_by INTEGER,
    
    INDEX idx_key (key),
    INDEX idx_category (category)
);
```

### 字段说明

- `id`: 主键
- `key`: 配置键（唯一），格式：`category.name`，例如：`llm.provider`
- `value`: 配置值（字符串）
- `category`: 配置分类（`llm`, `platform`, `analysis`, `github`, `gitlab`）
- `description`: 配置描述
- `is_sensitive`: 是否为敏感数据（如 API Key）
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `updated_by`: 更新用户 ID

## 数据库迁移

### 1. 创建迁移脚本

创建文件：`backend/alembic/versions/xxxx_add_system_settings.py`

```python
"""Add system_settings table

Revision ID: xxxx
Revises: yyyy
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers
revision = 'xxxx'
down_revision = 'yyyy'  # 上一个迁移的revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create system_settings table
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_sensitive', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('updated_by', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key')
    )
    
    # Create indexes
    op.create_index('ix_system_settings_key', 'system_settings', ['key'])
    op.create_index('ix_system_settings_category', 'system_settings', ['category'])
    
    # Insert default LLM settings (optional)
    op.execute("""
        INSERT INTO system_settings (key, value, category, description, is_sensitive, created_at, updated_at)
        VALUES 
        ('llm.provider', 'gemini', 'llm', 'Current LLM provider', 0, datetime('now'), datetime('now')),
        ('llm.temperature', '0.2', 'llm', 'LLM temperature parameter', 0, datetime('now'), datetime('now')),
        ('llm.timeout', '150', 'llm', 'LLM request timeout (seconds)', 0, datetime('now'), datetime('now'))
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_system_settings_category', table_name='system_settings')
    op.drop_index('ix_system_settings_key', table_name='system_settings')
    
    # Drop table
    op.drop_table('system_settings')
```

### 2. 运行迁移

```bash
cd backend

# 生成迁移（自动）
alembic revision --autogenerate -m "Add system_settings table"

# 或手动创建上面的迁移文件

# 执行迁移
alembic upgrade head
```

### 3. 验证迁移

```bash
# 连接到数据库（SQLite示例）
sqlite3 backend/xcodereviewer.db

# 查看表结构
.schema system_settings

# 查看数据
SELECT * FROM system_settings;
```

## API 接口

### 后端 API

#### 获取 LLM 配置

```
GET /api/v1/system/llm-settings
Authorization: Bearer <token>

Response:
{
  "provider": "ollama",
  "model": "qwen3-coder:30b",
  "api_key": null,
  "base_url": "http://localhost:11434",
  "temperature": 0.2,
  "max_tokens": 4000,
  "timeout": 60
}
```

#### 更新 LLM 配置

```
PUT /api/v1/system/llm-settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider": "ollama",
  "model": "qwen3-coder:30b",
  "base_url": "http://localhost:11434",
  "temperature": 0.2
}

Response:
{
  "provider": "ollama",
  ...
}
```

#### 获取所有配置

```
GET /api/v1/system/settings?category=llm
Authorization: Bearer <token>

Response:
[
  {
    "id": 1,
    "key": "llm.provider",
    "value": "ollama",
    "category": "llm",
    "description": "Current LLM provider",
    "is_sensitive": false,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  },
  ...
]
```

#### 批量更新配置

```
POST /api/v1/system/settings/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "settings": {
    "llm.provider": "ollama",
    "llm.model": "qwen3-coder:30b",
    "llm.temperature": "0.2"
  }
}

Response:
{
  "status": "success",
  "updated_count": "3",
  "updated_keys": "llm.provider,llm.model,llm.temperature"
}
```

### 前端 API 调用

```typescript
import { api } from '@/shared/services/api';

// 获取 LLM 配置
const llmSettings = await api.systemSettings.getLLMSettings();

// 更新 LLM 配置
await api.systemSettings.updateLLMSettings({
  provider: 'ollama',
  model: 'qwen3-coder:30b',
  temperature: 0.2
});

// 获取所有配置
const settings = await api.systemSettings.getSettings('llm');

// 批量更新
await api.systemSettings.batchUpdateSettings({
  'llm.provider': 'ollama',
  'llm.model': 'qwen3-coder:30b'
});
```

## 配置键约定

### LLM 配置（category: llm）

- `llm.provider` - LLM 提供商（gemini, openai, claude, ollama等）
- `llm.model` - 模型名称
- `llm.api_key` - API 密钥（敏感）
- `llm.base_url` - API 基础 URL
- `llm.temperature` - 温度参数（0-2）
- `llm.max_tokens` - 最大 token 数
- `llm.timeout` - 超时时间（秒）

### 平台配置（category: platform）

- `platform.gemini_api_key` - Gemini API Key（敏感）
- `platform.openai_api_key` - OpenAI API Key（敏感）
- `platform.claude_api_key` - Claude API Key（敏感）
- `platform.ollama_base_url` - Ollama 基础 URL

### 分析配置（category: analysis）

- `analysis.max_files` - 最大分析文件数
- `analysis.concurrency` - 并发数
- `analysis.gap_ms` - 请求间隔（毫秒）
- `analysis.output_language` - 输出语言（zh-CN, en-US）

### GitHub 配置（category: github）

- `github.token` - GitHub Token（敏感）

### GitLab 配置（category: gitlab）

- `gitlab.token` - GitLab Token（敏感）

## 数据迁移

### 从 localStorage 迁移到数据库

前端代码已自动处理迁移：

1. 首次访问系统管理页面时，检查 localStorage 是否有配置
2. 如果有，自动上传到后端数据库
3. 上传成功后，清除 localStorage 中的配置
4. 后续从数据库读取配置

用户无需手动操作。

## 安全性

### 敏感数据处理

1. **后端**：
   - API Key 等敏感数据标记为 `is_sensitive=True`
   - 非管理员用户读取时，敏感值被掩码为 `***`
   - 管理员可以读取完整的敏感值

2. **前端**：
   - 敏感输入框默认显示为密码类型
   - 提供"显示/隐藏"切换按钮
   - 不在控制台或日志中打印敏感信息

3. **传输**：
   - 使用 HTTPS 加密传输
   - 需要用户登录认证（JWT token）
   - 管理员权限才能修改配置

### 备份建议

1. 定期备份数据库：
   ```bash
   # SQLite
   cp backend/xcodereviewer.db backend/xcodereviewer.db.backup
   
   # PostgreSQL
   pg_dump xcodereviewer > backup.sql
   ```

2. 导出配置（JSON格式）：
   ```bash
   # 可以通过后端API导出
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8000/api/v1/system/settings > settings_backup.json
   ```

## 故障排查

### 问题：无法保存配置

1. 检查后端服务是否运行
2. 检查数据库连接是否正常
3. 检查用户是否有管理员权限
4. 查看后端日志：`backend/logs/app.log`

### 问题：配置未生效

1. 确认配置已保存到数据库
2. 检查后端是否使用了正确的配置
3. 重启后端服务
4. 清除浏览器缓存并刷新

### 问题：迁移失败

1. 检查数据库文件权限
2. 确认 Alembic 配置正确
3. 查看迁移日志
4. 如有必要，手动创建表（使用上面的 SQL）

## 兼容性

### 向后兼容

- 前端仍然支持从 localStorage 读取配置（作为备选）
- 如果后端 API 不可用，自动降级到本地存储
- 旧的环境变量配置仍然有效（作为默认值）

### 配置优先级

1. 数据库配置（最高优先级）
2. 后端 .env 文件配置
3. 前端 localStorage 配置（备用）
4. 前端 .env 文件配置（默认值）

## 后续优化

1. **配置版本控制**：记录配置修改历史
2. **配置模板**：预设常用配置模板
3. **配置验证**：在保存前验证配置有效性
4. **配置导入/导出**：支持批量导入导出配置
5. **配置加密**：对敏感数据进行加密存储

## 总结

✅ 数据库表已创建  
✅ 后端 API 已实现  
✅ 前端 API 调用已添加  
⏳ 前端组件需要修改（下一步）  

配置现在存储在数据库中，更安全、可靠且可跨设备共享！

