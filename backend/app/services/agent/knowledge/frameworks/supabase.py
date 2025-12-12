"""
Supabase 安全知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


SUPABASE_SECURITY = KnowledgeDocument(
    id="framework_supabase",
    title="Supabase Security",
    category=KnowledgeCategory.FRAMEWORK,
    tags=["supabase", "postgresql", "rls", "auth", "baas"],
    content="""
Supabase 是一个开源的Firebase替代品，安全性主要依赖于Row Level Security (RLS)。

## 核心安全机制
1. Row Level Security (RLS)
2. JWT认证
3. PostgreSQL权限系统

## 常见漏洞模式

### RLS未启用
```sql
-- 危险 - 表没有启用RLS
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    content TEXT
);
-- 任何人都可以访问所有数据！

-- 安全 - 启用RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own posts"
ON posts FOR SELECT
USING (auth.uid() = user_id);
```

### RLS策略不完整
```sql
-- 危险 - 只有SELECT策略
CREATE POLICY "select_policy" ON posts FOR SELECT
USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE没有策略，可能被绕过

-- 安全 - 完整的CRUD策略
CREATE POLICY "insert_policy" ON posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_policy" ON posts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "delete_policy" ON posts FOR DELETE
USING (auth.uid() = user_id);
```

### 服务端密钥泄露
```javascript
// 危险 - 在前端使用service_role密钥
const supabase = createClient(url, 'service_role_key');
// service_role绕过RLS！

// 安全 - 前端只使用anon key
const supabase = createClient(url, 'anon_key');
```

### 不安全的函数
```sql
-- 危险 - SECURITY DEFINER函数
CREATE FUNCTION get_all_users()
RETURNS SETOF users
LANGUAGE sql
SECURITY DEFINER  -- 以函数所有者权限执行
AS $$
    SELECT * FROM users;
$$;

-- 安全 - 使用SECURITY INVOKER或添加检查
CREATE FUNCTION get_user_data(target_user_id UUID)
RETURNS SETOF users
LANGUAGE sql
SECURITY INVOKER
AS $$
    SELECT * FROM users WHERE id = target_user_id;
$$;
```

### 存储桶权限
```sql
-- 危险 - 公开存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true);
-- 任何人都可以访问所有文件

-- 安全 - 私有存储桶 + RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false);

CREATE POLICY "Users can access own files"
ON storage.objects FOR SELECT
USING (auth.uid()::text = (storage.foldername(name))[1]);
```

### JWT验证绕过
```javascript
// 危险 - 不验证JWT
const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userIdFromRequest);  // 用户可以伪造

// 安全 - 使用auth.uid()
// RLS策略中使用auth.uid()自动从JWT获取用户ID
```

### Edge Functions安全
```typescript
// 危险 - 不验证请求来源
Deno.serve(async (req) => {
    const { userId } = await req.json();
    // 直接使用用户提供的userId
});

// 安全 - 从JWT获取用户
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(url, anonKey, {
        global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await supabase.auth.getUser();
    // 使用验证过的user.id
});
```

## 安全检查清单
1. 所有表都启用了RLS
2. 每个表都有完整的CRUD策略
3. 前端只使用anon key
4. service_role key只在服务端使用
5. 存储桶有适当的访问策略
6. 函数使用SECURITY INVOKER
7. Edge Functions验证JWT
""",
)
