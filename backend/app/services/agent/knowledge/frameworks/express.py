"""
Express.js 框架安全知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


EXPRESS_SECURITY = KnowledgeDocument(
    id="framework_express",
    title="Express.js Security",
    category=KnowledgeCategory.FRAMEWORK,
    tags=["express", "nodejs", "javascript", "api"],
    content="""
Express.js 是Node.js最流行的Web框架，需要注意多种安全问题。

## 常见漏洞模式

### NoSQL注入
```javascript
// 危险 - MongoDB查询注入
app.post('/login', async (req, res) => {
    const user = await User.findOne({
        username: req.body.username,
        password: req.body.password
    });
    // 攻击: {"username": {"$ne": ""}, "password": {"$ne": ""}}
});

// 安全 - 类型验证
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid input' });
    }
    const user = await User.findOne({ username, password });
});
```

### 原型污染
```javascript
// 危险 - 合并用户输入
const merge = require('lodash.merge');
app.post('/config', (req, res) => {
    merge(config, req.body);
    // 攻击: {"__proto__": {"isAdmin": true}}
});

// 安全 - 使用Object.assign或白名单
app.post('/config', (req, res) => {
    const allowed = ['theme', 'language'];
    allowed.forEach(key => {
        if (req.body[key]) config[key] = req.body[key];
    });
});
```

### 命令注入
```javascript
// 危险
const { exec } = require('child_process');
app.get('/ping', (req, res) => {
    exec(`ping ${req.query.host}`, (err, stdout) => {
        res.send(stdout);
    });
});

// 安全 - 使用execFile和参数数组
const { execFile } = require('child_process');
app.get('/ping', (req, res) => {
    execFile('ping', ['-c', '4', req.query.host], (err, stdout) => {
        res.send(stdout);
    });
});
```

### XSS
```javascript
// 危险 - 直接输出用户输入
app.get('/search', (req, res) => {
    res.send(`<h1>Results for: ${req.query.q}</h1>`);
});

// 安全 - 使用模板引擎或转义
const escape = require('escape-html');
app.get('/search', (req, res) => {
    res.send(`<h1>Results for: ${escape(req.query.q)}</h1>`);
});
```

### 路径遍历
```javascript
// 危险
app.get('/files/:name', (req, res) => {
    res.sendFile(`/uploads/${req.params.name}`);
});

// 安全 - 验证路径
const path = require('path');
app.get('/files/:name', (req, res) => {
    const safePath = path.join('/uploads', req.params.name);
    if (!safePath.startsWith('/uploads/')) {
        return res.status(400).send('Invalid path');
    }
    res.sendFile(safePath);
});
```

### 不安全的依赖
```javascript
// 危险 - 使用有漏洞的包
const serialize = require('node-serialize');
const obj = serialize.unserialize(userInput);  // RCE!

// 安全 - 使用JSON
const obj = JSON.parse(userInput);
```

## 安全中间件
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 安全头
app.use(helmet());

// 速率限制
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));

// CORS
const cors = require('cors');
app.use(cors({
    origin: 'https://example.com',
    credentials: true
}));
```

## 安全检查清单
1. 使用helmet设置安全头
2. 实现速率限制
3. 验证所有用户输入类型
4. 使用参数化查询
5. 定期更新依赖 (npm audit)
6. 不要在错误中暴露堆栈信息
""",
)
