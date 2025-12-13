"""
业务逻辑漏洞知识模块
"""

from ..base import KnowledgeDocument, KnowledgeCategory

BUSINESS_LOGIC = KnowledgeDocument(
    id="vuln_business_logic",
    title="业务逻辑漏洞",
    category=KnowledgeCategory.VULNERABILITY,
    tags=["business-logic", "logic-flaw", "workflow", "abuse"],
    content="""
# 业务逻辑漏洞

## 概述

业务逻辑漏洞是应用程序设计或实现中的缺陷，允许攻击者操纵合法功能以达到恶意目的。这类漏洞通常无法通过自动化工具检测。

## 漏洞模式

### 1. 价格操纵
```python
# 危险模式 - 客户端传递价格
@app.route('/checkout', methods=['POST'])
def checkout():
    price = request.form['price']  # 从客户端获取价格
    process_payment(price)
```

### 2. 数量验证缺失
```python
# 危险模式 - 未验证负数
def apply_discount(cart):
    quantity = int(request.form['quantity'])
    # 未检查负数，可能导致退款
    total = item_price * quantity  
```

### 3. 流程跳过
```python
# 危险模式 - 可跳过验证步骤
@app.route('/step3')
def step3():
    # 未验证是否完成了step1和step2
    complete_order()
```

### 4. 竞态条件滥用
```python
# 危险模式 - 优惠券使用无并发控制
def use_coupon(user_id, coupon_code):
    coupon = get_coupon(coupon_code)
    if coupon.remaining > 0:
        apply_coupon(user_id)
        coupon.remaining -= 1  # 竞态条件
```

### 5. 权限升级
```python
# 危险模式 - 角色检查可绕过
def update_user_role(target_user):
    new_role = request.form['role']
    # 只验证了用户登录，未验证权限
    target_user.role = new_role
```

## 发现技术

1. 理解业务流程和规则
2. 分析状态转换图
3. 检查多步骤流程的验证
4. 查找价格/数量等关键字段的验证
5. 分析优惠/折扣逻辑
6. 检查并发操作的处理

## 常见测试场景

### 电商场景
- 修改订单金额
- 负数商品数量
- 重复使用优惠券
- 跳过支付验证

### 金融场景
- 转账金额操纵
- 双重支付
- 余额竞态条件
- 货币舍入滥用

### 认证场景
- 密码重置流程滥用
- 账户接管
- 权限升级
- 会话固定

## 修复建议

```python
# 安全模式 - 服务端价格计算
def checkout():
    cart = get_user_cart()
    price = calculate_price_server_side(cart)  # 服务端计算
    process_payment(price)

# 安全模式 - 数量验证
def apply_discount(cart):
    quantity = int(request.form['quantity'])
    if quantity <= 0 or quantity > MAX_QUANTITY:
        raise ValidationError("无效数量")

# 安全模式 - 流程状态验证
def step3():
    if not session.get('step1_completed') or not session.get('step2_completed'):
        return redirect('/step1')

# 安全模式 - 并发控制
def use_coupon(user_id, coupon_code):
    with db.transaction():
        coupon = Coupon.query.with_for_update().get(coupon_code)
        if coupon.remaining > 0:
            apply_coupon(user_id)
            coupon.remaining -= 1
            db.commit()
```

## 严重性评估

- 导致财务损失：Critical
- 绕过关键业务规则：High
- 影响数据完整性：Medium
- 仅用户体验问题：Low
""",
)

RATE_LIMITING = KnowledgeDocument(
    id="vuln_rate_limiting",
    title="速率限制缺失",
    category=KnowledgeCategory.VULNERABILITY,
    tags=["rate-limiting", "brute-force", "dos", "enumeration"],
    content="""
# 速率限制缺失

## 概述

速率限制缺失允许攻击者无限次调用敏感端点，导致暴力破解、资源耗尽或信息枚举。

## 漏洞模式

### 1. 无登录限制
```python
# 危险模式 - 登录无限重试
@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    if authenticate(username, password):
        return create_session()
    return "失败"  # 可无限重试
```

### 2. API无频率限制
```python
# 危险模式 - API无限调用
@app.route('/api/search')
def search():
    # 资源密集操作，无速率限制
    return expensive_search(request.args['q'])
```

### 3. 短信/邮件发送无限制
```python
# 危险模式 - 可滥用发送功能
@app.route('/send-code', methods=['POST'])
def send_code():
    phone = request.form['phone']
    send_sms(phone, generate_code())  # 无频率限制
```

## 修复建议

```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=get_remote_address)

# 登录限制
@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    pass

# API限制
@app.route('/api/search')
@limiter.limit("100 per hour")
def search():
    pass

# 基于用户的限制
@app.route('/send-code', methods=['POST'])
@limiter.limit("3 per 10 minutes", key_func=lambda: request.form['phone'])
def send_code():
    pass
```

## 严重性评估

- 登录/密码重置无限制：High
- 敏感API无限制：Medium
- 一般API无限制：Low
""",
)

__all__ = ["BUSINESS_LOGIC", "RATE_LIMITING"]
