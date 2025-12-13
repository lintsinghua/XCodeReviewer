"""
开放重定向漏洞知识模块
"""

from ..base import KnowledgeDocument, KnowledgeCategory

OPEN_REDIRECT = KnowledgeDocument(
    id="vuln_open_redirect",
    title="开放重定向",
    category=KnowledgeCategory.VULNERABILITY,
    tags=["open-redirect", "url", "phishing", "unvalidated-redirect"],
    content="""
# 开放重定向漏洞

## 概述

开放重定向允许攻击者将用户从合法网站重定向到恶意网站，常用于钓鱼攻击或绕过安全检查。

## 漏洞模式

### 1. 直接重定向
```python
# 危险模式 - 未验证的重定向
@app.route('/redirect')
def redirect_page():
    url = request.args.get('url')
    return redirect(url)  # 可重定向到任意URL
```

### 2. 登录后重定向
```python
# 危险模式 - 登录后重定向
@app.route('/login', methods=['POST'])
def login():
    next_url = request.args.get('next', '/')
    if authenticate(request.form):
        return redirect(next_url)  # 可能被利用
```

### 3. 协议相对URL
```python
# 危险模式 - 协议相对URL未处理
url = request.args.get('goto')
# //evil.com 会被解析为 http://evil.com
return redirect(url)
```

### 4. JavaScript重定向
```javascript
// 危险模式 - JS中的开放重定向
var url = new URLSearchParams(window.location.search).get('redirect');
window.location = url;  // 未验证
```

## 常见绕过技术

```
# 基本绕过
?url=https://evil.com
?url=//evil.com
?url=\/\/evil.com
?url=https:evil.com

# 域名混淆
?url=https://legitimate.com@evil.com
?url=https://legitimate.com.evil.com
?url=https://evil.com?legitimate.com

# 编码绕过
?url=%68%74%74%70%73%3a%2f%2f%65%76%69%6c%2e%63%6f%6d
?url=https://evil。com  # Unicode句号
```

## 发现技术

1. 搜索redirect、url、next、goto等参数
2. 检查响应头中的Location
3. 分析JavaScript中的location赋值
4. 查找URL处理相关函数

## 修复建议

```python
from urllib.parse import urlparse

ALLOWED_HOSTS = ['example.com', 'app.example.com']

def is_safe_url(url):
    if not url:
        return False
    
    # 检查协议
    parsed = urlparse(url)
    
    # 只允许相对路径
    if not parsed.netloc:
        return url.startswith('/')
    
    # 检查域名白名单
    return parsed.netloc in ALLOWED_HOSTS

@app.route('/redirect')
def redirect_page():
    url = request.args.get('url', '/')
    if not is_safe_url(url):
        url = '/'
    return redirect(url)

# Django内置函数
from django.utils.http import url_has_allowed_host_and_scheme

if url_has_allowed_host_and_scheme(url, allowed_hosts=ALLOWED_HOSTS):
    return redirect(url)
```

## 严重性评估

- 可用于OAuth/SSO绕过：High
- 一般钓鱼场景：Medium
- 受限场景：Low
""",
)

__all__ = ["OPEN_REDIRECT"]
