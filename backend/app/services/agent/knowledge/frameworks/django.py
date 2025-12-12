"""
Django 框架安全知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


DJANGO_SECURITY = KnowledgeDocument(
    id="framework_django",
    title="Django Security",
    category=KnowledgeCategory.FRAMEWORK,
    tags=["django", "python", "web", "orm"],
    content="""
Django 内置了许多安全保护，但不当使用仍可能引入漏洞。

## 内置安全特性
1. CSRF保护
2. XSS防护（模板自动转义）
3. SQL注入防护（ORM）
4. 点击劫持防护
5. 安全的密码哈希

## 常见漏洞模式

### SQL注入
```python
# 危险 - raw()和extra()
User.objects.raw(f"SELECT * FROM users WHERE name = '{name}'")
User.objects.extra(where=[f"name = '{name}'"])

# 危险 - RawSQL
from django.db.models.expressions import RawSQL
User.objects.annotate(val=RawSQL(f"SELECT {user_input}"))

# 安全 - 使用ORM
User.objects.filter(name=name)
User.objects.raw("SELECT * FROM users WHERE name = %s", [name])
```

### XSS
```python
# 危险 - 禁用自动转义
{{ user_input|safe }}
{% autoescape off %}{{ user_input }}{% endautoescape %}
mark_safe(user_input)

# 安全 - 默认转义
{{ user_input }}
```

### CSRF绕过
```python
# 危险 - 禁用CSRF
@csrf_exempt
def my_view(request):
    pass

# 危险 - 全局禁用
MIDDLEWARE = [
    # 'django.middleware.csrf.CsrfViewMiddleware',  # 被注释
]
```

### 不安全的反序列化
```python
# 危险 - 签名数据可被篡改
from django.core import signing
data = signing.loads(user_input)  # 如果SECRET_KEY泄露

# 危险 - pickle
import pickle
data = pickle.loads(request.body)
```

### 敏感信息泄露
```python
# 危险 - DEBUG模式在生产环境
DEBUG = True  # settings.py

# 危险 - 详细错误信息
ALLOWED_HOSTS = []  # 空列表在DEBUG=False时会报错
```

### 文件上传
```python
# 危险 - 不验证文件类型
def upload(request):
    file = request.FILES['file']
    with open(f'/uploads/{file.name}', 'wb') as f:
        f.write(file.read())

# 安全 - 验证和重命名
import uuid
def upload(request):
    file = request.FILES['file']
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ['.jpg', '.png', '.pdf']:
        raise ValidationError("Invalid file type")
    safe_name = f"{uuid.uuid4()}{ext}"
    # 使用Django的文件存储
    default_storage.save(safe_name, file)
```

## 安全配置检查
```python
# settings.py 安全配置
DEBUG = False
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
ALLOWED_HOSTS = ['example.com']
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
X_FRAME_OPTIONS = 'DENY'
```
""",
)
