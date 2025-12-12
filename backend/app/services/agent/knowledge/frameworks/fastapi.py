"""
FastAPI 框架安全知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


FASTAPI_SECURITY = KnowledgeDocument(
    id="framework_fastapi",
    title="FastAPI Security",
    category=KnowledgeCategory.FRAMEWORK,
    tags=["fastapi", "python", "api", "async", "pydantic"],
    content="""
FastAPI 是一个现代Python Web框架，内置了许多安全特性，但仍需注意一些常见问题。

## 安全特性
1. Pydantic自动数据验证
2. 自动生成OpenAPI文档
3. 内置OAuth2/JWT支持
4. 依赖注入系统

## 常见漏洞模式

### SQL注入
```python
# 危险 - 原始SQL
@app.get("/users")
async def get_users(name: str):
    query = f"SELECT * FROM users WHERE name = '{name}'"
    return await database.fetch_all(query)

# 安全 - 参数化查询
@app.get("/users")
async def get_users(name: str):
    query = "SELECT * FROM users WHERE name = :name"
    return await database.fetch_all(query, {"name": name})
```

### IDOR
```python
# 危险 - 无权限检查
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    return await User.get(user_id)

# 安全 - 验证权限
@app.get("/users/{user_id}")
async def get_user(user_id: int, current_user: User = Depends(get_current_user)):
    if user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403)
    return await User.get(user_id)
```

### 路径遍历
```python
# 危险
@app.get("/files/{filename}")
async def get_file(filename: str):
    return FileResponse(f"/uploads/{filename}")

# 安全 - 验证路径
@app.get("/files/{filename}")
async def get_file(filename: str):
    safe_path = Path("/uploads").resolve() / filename
    if not str(safe_path.resolve()).startswith(str(Path("/uploads").resolve())):
        raise HTTPException(status_code=400)
    return FileResponse(safe_path)
```

### JWT配置问题
```python
# 危险 - 弱密钥
SECRET_KEY = "secret"

# 危险 - 不验证签名
jwt.decode(token, options={"verify_signature": False})

# 安全
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
```

### CORS配置
```python
# 危险 - 允许所有来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # 危险组合！
)

# 安全 - 指定来源
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://example.com"],
    allow_credentials=True,
)
```

## 安全检查清单
1. 所有端点是否有适当的认证
2. 是否使用Depends进行权限检查
3. 文件操作是否验证路径
4. SQL查询是否参数化
5. CORS配置是否合理
6. JWT密钥是否安全存储
7. 敏感数据是否在响应中暴露
""",
)
