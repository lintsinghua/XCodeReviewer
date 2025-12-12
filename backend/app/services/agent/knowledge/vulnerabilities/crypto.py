"""
加密相关漏洞知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


WEAK_CRYPTO = KnowledgeDocument(
    id="vuln_weak_crypto",
    title="Weak Cryptography",
    category=KnowledgeCategory.VULNERABILITY,
    tags=["crypto", "encryption", "hash", "md5", "sha1"],
    severity="medium",
    cwe_ids=["CWE-327", "CWE-328"],
    owasp_ids=["A02:2021"],
    content="""
使用弱加密算法或不当的加密实现可能导致数据泄露。

## 危险模式

### 弱哈希算法
```python
# 危险 - MD5/SHA1用于密码
password_hash = hashlib.md5(password.encode()).hexdigest()
password_hash = hashlib.sha1(password.encode()).hexdigest()

# 危险 - 无盐哈希
hash = hashlib.sha256(password.encode()).hexdigest()
```

### 弱加密算法
```python
# 危险 - DES/3DES
from Crypto.Cipher import DES
cipher = DES.new(key, DES.MODE_ECB)

# 危险 - ECB模式
cipher = AES.new(key, AES.MODE_ECB)

# 危险 - 弱密钥
key = "12345678"  # 短密钥
key = password.encode()[:16]  # 从密码派生
```

### 不安全的随机数
```python
# 危险 - 使用random模块
import random
token = ''.join(random.choices(string.ascii_letters, k=32))
session_id = random.randint(0, 999999)
```

## 检测关键词
- md5, sha1, des, 3des, rc4
- MODE_ECB
- random.random, random.randint
- 硬编码的密钥/IV

## 安全实践
1. 密码使用bcrypt/argon2/scrypt
2. 加密使用AES-256-GCM
3. 使用secrets模块生成随机数
4. 使用KDF派生密钥

## 修复示例
```python
# 安全 - 密码哈希
import bcrypt
password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

# 安全 - 加密
from cryptography.fernet import Fernet
key = Fernet.generate_key()
cipher = Fernet(key)

# 安全 - 随机数
import secrets
token = secrets.token_urlsafe(32)
```
""",
)


HARDCODED_SECRETS = KnowledgeDocument(
    id="vuln_hardcoded_secrets",
    title="Hardcoded Secrets",
    category=KnowledgeCategory.VULNERABILITY,
    tags=["secrets", "password", "credentials", "api-key", "token", "leak"],
    severity="high",
    cwe_ids=["CWE-798", "CWE-259"],
    owasp_ids=["A07:2021"],
    content="""
硬编码的凭证可能被攻击者从源代码、日志或配置文件中提取。

## 危险模式

### 硬编码密码
```python
# 危险
password = "admin123"
db_password = "P@ssw0rd!"
root_password = "toor"
```

### 硬编码API密钥
```python
# 危险
api_key = "sk-1234567890abcdef"
aws_access_key = "AKIAIOSFODNN7EXAMPLE"
stripe_key = "sk_live_xxxxx"
github_token = "ghp_xxxxxxxxxxxx"
```

### 硬编码连接字符串
```python
# 危险
connection_string = "mysql://root:password@localhost/db"
redis_url = "redis://:password@localhost:6379"
mongodb_uri = "mongodb://admin:pass@localhost:27017"
```

### 配置文件中的密钥
```yaml
# 危险 - config.yaml
database:
  password: "secret123"
jwt:
  secret: "my-jwt-secret"
```

## 检测正则
```regex
# API Keys
(api[_-]?key|apikey)['\"]?\\s*[:=]\\s*['\"][a-zA-Z0-9]{16,}['\"]
# AWS Keys
AKIA[0-9A-Z]{16}
# Private Keys
-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----
# JWT Secrets
(jwt[_-]?secret|secret[_-]?key)['\"]?\\s*[:=]\\s*['\"][^'\"]+['\"]
```

## 安全实践
1. 使用环境变量
2. 使用密钥管理服务(AWS Secrets Manager, HashiCorp Vault)
3. 使用.gitignore排除敏感文件
4. 使用git-secrets防止提交
5. 定期轮换密钥

## 修复示例
```python
# 安全 - 环境变量
import os
password = os.environ.get("DB_PASSWORD")
api_key = os.environ.get("API_KEY")

# 安全 - 配置文件引用环境变量
# config.yaml
database:
  password: ${DB_PASSWORD}
```
""",
)
