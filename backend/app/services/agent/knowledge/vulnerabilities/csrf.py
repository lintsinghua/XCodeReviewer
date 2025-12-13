"""
CSRF（跨站请求伪造）漏洞知识模块
"""

from ..base import KnowledgeDocument, KnowledgeCategory

CSRF = KnowledgeDocument(
    id="vuln_csrf",
    title="跨站请求伪造 (CSRF)",
    category=KnowledgeCategory.VULNERABILITY,
    tags=["csrf", "cross-site", "request-forgery", "state-changing"],
    content="""
# 跨站请求伪造 (CSRF)

## 概述

CSRF（Cross-Site Request Forgery）攻击允许攻击者诱导用户在已经认证的Web应用程序上执行非预期的操作。

## 漏洞模式

### 1. 缺少CSRF Token
```python
# 危险模式 - 无CSRF保护
@app.route('/transfer', methods=['POST'])
def transfer():
    to_account = request.form['to']
    amount = request.form['amount']
    # 直接执行转账，没有CSRF验证
    execute_transfer(to_account, amount)
```

### 2. Token验证绕过
```python
# 危险模式 - Token可预测或未正确验证
def verify_csrf(request):
    token = request.form.get('csrf_token')
    # 只检查token存在，不验证值
    return token is not None  # 应该比较实际值
```

### 3. 敏感操作使用GET请求
```python
# 危险模式 - 状态更改操作使用GET
@app.route('/delete/<id>', methods=['GET'])
def delete_item(id):
    Item.query.filter_by(id=id).delete()
```

## 发现技术

1. 检查状态更改操作的HTTP方法
2. 验证是否存在CSRF Token
3. 检查Token验证逻辑
4. 查找SameSite Cookie配置
5. 分析敏感操作的保护机制

## 测试步骤

1. 识别状态更改端点（POST/PUT/DELETE）
2. 检查请求中是否包含CSRF Token
3. 尝试重放请求（不带Token或使用过期Token）
4. 检查Referrer验证
5. 测试跨域请求

## 修复建议

```python
# 安全模式 - 使用CSRF Token
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect(app)

@app.route('/transfer', methods=['POST'])
@csrf.exempt  # 不要使用exempt
def transfer():
    # Token自动验证
    pass

# 安全模式 - SameSite Cookie
response.set_cookie(
    'session',
    value=session_id,
    samesite='Strict',  # 或 'Lax'
    secure=True,
    httponly=True
)
```

## 严重性评估

- 涉及资金操作：Critical
- 涉及账户设置：High
- 涉及数据修改：Medium
- 仅影响个人偏好：Low
""",
)

__all__ = ["CSRF"]
