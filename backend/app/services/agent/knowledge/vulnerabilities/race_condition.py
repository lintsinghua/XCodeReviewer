"""
竞态条件漏洞知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


RACE_CONDITION = KnowledgeDocument(
    id="vuln_race_condition",
    title="Race Condition",
    category=KnowledgeCategory.VULNERABILITY,
    tags=["race", "condition", "toctou", "concurrency", "thread"],
    severity="medium",
    cwe_ids=["CWE-362", "CWE-367"],
    owasp_ids=["A04:2021"],
    content="""
竞态条件发生在多个操作之间存在时间窗口，攻击者可以利用这个窗口改变系统状态。

## 危险模式

### TOCTOU (Time-of-Check to Time-of-Use)
```python
# 危险 - 检查和使用之间有时间窗口
if os.path.exists(filepath):  # 检查
    # 攻击者可在此时替换文件
    with open(filepath) as f:  # 使用
        data = f.read()

# 危险 - 余额检查
if user.balance >= amount:  # 检查
    # 并发请求可能同时通过检查
    user.balance -= amount  # 使用
    db.commit()
```

### 双重支付/提现
```python
# 危险 - 无锁的余额操作
@app.route('/withdraw', methods=['POST'])
def withdraw():
    amount = request.json['amount']
    if current_user.balance >= amount:
        current_user.balance -= amount
        db.commit()
        return transfer_money(amount)
```

### 文件操作竞态
```python
# 危险 - 临时文件
import tempfile
fd, path = tempfile.mkstemp()
# 攻击者可能在此时访问或替换文件
os.chmod(path, 0o644)
```

### 会话竞态
```python
# 危险 - 会话更新
session['cart_total'] = calculate_total()
# 并发请求可能覆盖
apply_discount(session['cart_total'])
```

## 检测要点
1. 检查-使用模式（if exists then use）
2. 余额/库存等数值操作
3. 文件创建和权限设置
4. 无锁的数据库操作
5. 会话状态修改

## 安全实践
1. 使用数据库事务和锁
2. 原子操作
3. 使用文件锁
4. 乐观锁/悲观锁
5. 幂等性设计

## 修复示例

### 数据库锁
```python
# 安全 - 使用SELECT FOR UPDATE
from sqlalchemy import select

@app.route('/withdraw', methods=['POST'])
def withdraw():
    amount = request.json['amount']
    
    with db.begin():
        # 行级锁
        user = db.execute(
            select(User).where(User.id == current_user.id).with_for_update()
        ).scalar_one()
        
        if user.balance >= amount:
            user.balance -= amount
            return transfer_money(amount)
        else:
            return "Insufficient balance", 400
```

### 原子操作
```python
# 安全 - 原子更新
from sqlalchemy import update

result = db.execute(
    update(User)
    .where(User.id == user_id)
    .where(User.balance >= amount)  # 条件更新
    .values(balance=User.balance - amount)
)
if result.rowcount == 0:
    return "Insufficient balance", 400
```

### 文件锁
```python
# 安全 - 使用文件锁
import fcntl

with open(filepath, 'r+') as f:
    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
    try:
        data = f.read()
        # 处理数据
        f.seek(0)
        f.write(new_data)
    finally:
        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
```
""",
)
