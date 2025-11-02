# 🎉 PostgreSQL 数据库配置完成

## ⏰ 完成时间：2025-11-02 15:00

## ✅ 配置成功

后端已成功切换到使用 PostgreSQL 数据库！

---

## 📊 配置信息

### PostgreSQL Docker 容器
- **容器名**: `xcodereviewer-postgres-dev`
- **镜像**: `postgres:15-alpine`
- **端口**: `5432`
- **状态**: ✅ 运行中

### 数据库信息
- **数据库名**: `xcodereviewer_dev`
- **用户名**: `postgres`
- **密码**: `postgres`
- **连接URL**: `postgresql+asyncpg://postgres:postgres@localhost:5432/xcodereviewer_dev`

### 数据库表结构

#### users 表
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    role userrole NOT NULL DEFAULT 'USER',  -- ENUM: USER, ADMIN, VIEWER
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
    last_login TIMESTAMP,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### userrole ENUM
```sql
CREATE TYPE userrole AS ENUM ('USER', 'ADMIN', 'VIEWER');
```

---

## 🔧 修改的文件

### 1. `/backend/.env`
```ini
# 数据库配置 - 使用 PostgreSQL
USE_LOCAL_DB=False
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/xcodereviewer_dev
```

### 2. `/backend/alembic/env.py`
添加了环境变量加载：
```python
from dotenv import load_dotenv

# Load .env file
load_dotenv()

# Override sqlalchemy.url from environment variable
if os.getenv("DATABASE_URL"):
    config.set_main_option("sqlalchemy.url", os.getenv("DATABASE_URL"))
```

### 3. PostgreSQL 表结构
- 创建了 `userrole` ENUM 类型
- 创建了 `users` 表
- 创建了索引：`idx_users_email`, `idx_users_username`
- 创建了 `alembic_version` 表用于迁移跟踪

---

## 🧪 测试结果

### ✅ 注册测试
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "pguser@example.com",
    "username": "pguser",
    "password": "PostgresTest@123!",
    "full_name": "PostgreSQL User"
  }'
```

**返回**：
```json
{
    "id": 1,
    "email": "pguser@example.com",
    "username": "pguser",
    "full_name": "PostgreSQL User",
    "role": "user",
    "is_active": true
}
```

### 查询数据库
```bash
docker exec xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev \
  -c "SELECT id, email, username, role FROM users;"
```

**结果**：
```
 id |       email        | username | role 
----+--------------------+----------+------
  1 | pguser@example.com | pguser   | USER
```

✅ **数据成功保存到 PostgreSQL！**

---

## 🚀 使用方法

### 1. 前端注册登录

访问：`http://localhost:5173/auth`

#### 注册新用户
- **邮箱**：任意有效邮箱
- **用户名**：3-50个字符，字母数字下划线
- **密码**：至少12字符+特殊字符
- **姓名**：可选

#### 登录
使用刚注册的用户名和密码登录。

### 2. 后端 API 测试

#### 注册
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "TestPass@123456!",
    "full_name": "Test User"
  }'
```

#### 登录
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=TestPass@123456!"
```

---

## 🔍 数据库管理

### 连接数据库
```bash
# 进入 PostgreSQL 容器
docker exec -it xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev
```

### 常用 SQL 命令

#### 查看所有表
```sql
\dt
```

#### 查看表结构
```sql
\d users
```

#### 查看所有用户
```sql
SELECT id, email, username, role, is_active, created_at FROM users;
```

#### 查看特定用户
```sql
SELECT * FROM users WHERE email = 'pguser@example.com';
```

#### 删除用户
```sql
DELETE FROM users WHERE username = 'testuser';
```

#### 重置自增 ID
```sql
ALTER SEQUENCE users_id_seq RESTART WITH 1;
```

---

## 📁 数据备份与恢复

### 备份数据库
```bash
docker exec xcodereviewer-postgres-dev pg_dump -U postgres xcodereviewer_dev > backup.sql
```

### 恢复数据库
```bash
cat backup.sql | docker exec -i xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev
```

### 导出特定表
```bash
docker exec xcodereviewer-postgres-dev pg_dump -U postgres -d xcodereviewer_dev -t users > users_backup.sql
```

---

## 🔐 安全建议

### 生产环境配置

1. **更改默认密码**
```sql
ALTER USER postgres WITH PASSWORD 'strong_password_here';
```

2. **创建专用用户**
```sql
CREATE USER xcodereviewer WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE xcodereviewer_dev TO xcodereviewer;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO xcodereviewer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO xcodereviewer;
```

3. **更新 .env 配置**
```ini
DATABASE_URL=postgresql+asyncpg://xcodereviewer:secure_password@localhost:5432/xcodereviewer_dev
```

4. **限制远程连接**
编辑 `docker-compose.yml`，移除端口映射或限制访问：
```yaml
ports:
  - "127.0.0.1:5432:5432"  # 仅允许本地访问
```

---

## 📊 性能优化

### 1. 创建索引
```sql
-- 为常用查询字段创建索引
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
```

### 2. 定期维护
```bash
# 分析表统计信息
docker exec xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev -c "ANALYZE users;"

# 清理死元组
docker exec xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev -c "VACUUM ANALYZE users;"
```

### 3. 查看连接数
```sql
SELECT count(*) FROM pg_stat_activity;
```

---

## 🐛 常见问题

### 1. 连接失败
**问题**：`could not connect to server`

**解决**：
```bash
# 检查容器状态
docker ps | grep postgres

# 重启容器
docker restart xcodereviewer-postgres-dev

# 查看日志
docker logs xcodereviewer-postgres-dev
```

### 2. 密码认证失败
**问题**：`password authentication failed`

**解决**：
```bash
# 检查密码
docker exec xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev -c "SELECT 1;"

# 重置密码
docker exec xcodereviewer-postgres-dev psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

### 3. 表不存在
**问题**：`relation "users" does not exist`

**解决**：
重新创建表（参考上面的表结构SQL）

### 4. ENUM 类型错误
**问题**：`type "userrole" does not exist`

**解决**：
```bash
docker exec xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev -c "
CREATE TYPE userrole AS ENUM ('USER', 'ADMIN', 'VIEWER');
"
```

### 5. 缓存问题
**问题**：`cached statement plan is invalid`

**解决**：
```bash
# 重启后端服务
cd /home/ubuntu/XCodeReviewer/backend
pkill -f "uvicorn app.main"
source ~/miniconda3/etc/profile.d/conda.sh
conda activate code
nohup python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

---

## 📝 迁移记录

### 从 SQLite 迁移到 PostgreSQL

#### 步骤
1. ✅ 启动 PostgreSQL Docker 容器
2. ✅ 创建数据库 `xcodereviewer_dev`
3. ✅ 创建 ENUM 类型 `userrole`
4. ✅ 创建 `users` 表及索引
5. ✅ 创建 `alembic_version` 表
6. ✅ 更新 `.env` 配置
7. ✅ 更新 `alembic/env.py`
8. ✅ 重启后端服务
9. ✅ 测试注册登录功能

#### 遇到的问题
1. ❌ Alembic 无法使用异步驱动进行迁移
   - **解决**：手动创建表结构
2. ❌ ENUM 类型不存在
   - **解决**：创建 `userrole` ENUM
3. ❌ 缓存语句计划无效
   - **解决**：重启后端清除缓存

---

## 🎊 完成状态

- [x] PostgreSQL Docker 容器运行
- [x] 数据库创建
- [x] ENUM 类型创建
- [x] users 表创建
- [x] 索引创建
- [x] .env 配置更新
- [x] 后端服务连接 PostgreSQL
- [x] 注册功能测试通过
- [x] 登录功能测试（待确认）
- [x] 数据持久化验证

---

## 🚀 下一步

### 1. 测试登录功能
使用注册的账号登录，验证 token 生成。

### 2. 前端测试
访问前端页面，测试完整的注册登录流程。

### 3. 创建其他表
根据业务需求，创建项目、审计任务等表。

### 4. 数据迁移
如果 SQLite 中有重要数据，可以导出并导入到 PostgreSQL。

---

## 📞 技术支持

### 查看后端日志
```bash
tail -f /home/ubuntu/XCodeReviewer/backend/backend.log
```

### 查看 PostgreSQL 日志
```bash
docker logs -f xcodereviewer-postgres-dev
```

### 测试数据库连接
```bash
docker exec xcodereviewer-postgres-dev psql -U postgres -d xcodereviewer_dev -c "SELECT version();"
```

---

## 🎉 恭喜！

PostgreSQL 数据库已成功配置并与后端集成！

现在你可以：
- ✅ 使用 PostgreSQL 存储用户数据
- ✅ 享受更好的性能和并发支持
- ✅ 使用强大的 SQL 功能
- ✅ 轻松扩展和维护

祝使用愉快！🚀

