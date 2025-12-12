"""
Flask 框架安全知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


FLASK_SECURITY = KnowledgeDocument(
    id="framework_flask",
    title="Flask Security",
    category=KnowledgeCategory.FRAMEWORK,
    tags=["flask", "python", "web", "jinja2"],
    content="""
Flask 是一个轻量级框架，安全性很大程度上取决于开发者的实现。

## 常见漏洞模式

### 模板注入 (SSTI)
```python
# 危险 - 用户输入作为模板
from flask import render_template_string
@app.route('/hello')
def hello():
    name = request.args.get('name')
    return render_template_string(f'Hello {name}!')
    # 攻击: ?name={{config}}

# 安全 - 使用参数
@app.route('/hello')
def hello():
    name = request.args.get('name')
    return render_template_string('Hello {{ name }}!', name=name)
```

### XSS
```python
# 危险 - 禁用转义
from markupsafe import Markup
return Markup(user_input)

# 模板中
{{ user_input|safe }}

# 安全 - 默认转义
return render_template('page.html', content=user_input)
```

### SQL注入
```python
# 危险 - 字符串拼接
@app.route('/user/<name>')
def get_user(name):
    cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")

# 安全 - 参数化
@app.route('/user/<name>')
def get_user(name):
    cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
```

### 会话安全
```python
# 危险 - 弱密钥
app.secret_key = 'dev'

# 危险 - 硬编码密钥
app.secret_key = 'super-secret-key-12345'

# 安全
app.secret_key = os.environ.get('FLASK_SECRET_KEY')
```

### 文件上传
```python
# 危险 - 不验证文件
@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    file.save(f'/uploads/{file.filename}')

# 安全 - 验证和安全文件名
from werkzeug.utils import secure_filename
ALLOWED_EXTENSIONS = {'png', 'jpg', 'pdf'}

def allowed_file(filename):
    return '.' in filename and \\
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
```

### 开放重定向
```python
# 危险 - 未验证的重定向
@app.route('/redirect')
def redirect_url():
    url = request.args.get('url')
    return redirect(url)

# 安全 - 验证URL
from urllib.parse import urlparse

@app.route('/redirect')
def redirect_url():
    url = request.args.get('url', '/')
    # 只允许相对路径或同域名
    parsed = urlparse(url)
    if parsed.netloc and parsed.netloc != request.host:
        return redirect('/')
    return redirect(url)
```

### Debug模式
```python
# 危险 - 生产环境开启debug
if __name__ == '__main__':
    app.run(debug=True)  # 可能导致RCE

# 安全
if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_DEBUG', 'False') == 'True')
```

## 安全配置
```python
app.config.update(
    SECRET_KEY=os.environ.get('SECRET_KEY'),
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
)
```
""",
)
