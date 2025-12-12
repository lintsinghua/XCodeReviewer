"""
React 框架安全知识
"""

from ..base import KnowledgeDocument, KnowledgeCategory


REACT_SECURITY = KnowledgeDocument(
    id="framework_react",
    title="React Security",
    category=KnowledgeCategory.FRAMEWORK,
    tags=["react", "javascript", "frontend", "jsx"],
    content="""
React 默认对XSS有较好的防护，但仍有一些需要注意的安全问题。

## 安全特性
1. JSX自动转义
2. 虚拟DOM隔离

## 常见漏洞模式

### dangerouslySetInnerHTML
```jsx
// 危险 - 直接渲染HTML
function Comment({ content }) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
}

// 安全 - 使用DOMPurify
import DOMPurify from 'dompurify';
function Comment({ content }) {
    return <div dangerouslySetInnerHTML={{ 
        __html: DOMPurify.sanitize(content) 
    }} />;
}
```

### href/src注入
```jsx
// 危险 - javascript:协议
function Link({ url }) {
    return <a href={url}>Click</a>;
    // 攻击: url = "javascript:alert('XSS')"
}

// 安全 - 验证协议
function Link({ url }) {
    const safeUrl = url.startsWith('http') ? url : '#';
    return <a href={safeUrl}>Click</a>;
}
```

### eval和Function
```jsx
// 危险
function Calculator({ expression }) {
    const result = eval(expression);  // RCE风险
    return <div>{result}</div>;
}

// 安全 - 使用安全的表达式解析器
import { evaluate } from 'mathjs';
function Calculator({ expression }) {
    const result = evaluate(expression);
    return <div>{result}</div>;
}
```

### 服务端渲染(SSR) XSS
```jsx
// 危险 - Next.js中
export async function getServerSideProps({ query }) {
    return {
        props: {
            search: query.q  // 未转义
        }
    };
}

// 页面中
function Page({ search }) {
    return <script dangerouslySetInnerHTML={{
        __html: `window.search = "${search}"`  // XSS!
    }} />;
}

// 安全 - 使用JSON序列化
function Page({ search }) {
    return <script dangerouslySetInnerHTML={{
        __html: `window.search = ${JSON.stringify(search)}`
    }} />;
}
```

### 敏感数据暴露
```jsx
// 危险 - 前端存储敏感数据
localStorage.setItem('token', apiToken);
localStorage.setItem('user', JSON.stringify(userData));

// 危险 - 在状态中存储敏感信息
const [creditCard, setCreditCard] = useState(cardNumber);

// 安全 - 使用HttpOnly Cookie存储token
// 敏感数据只在需要时从后端获取
```

### 依赖安全
```jsx
// 危险 - 使用有漏洞的包
import serialize from 'serialize-javascript';
// 某些版本有XSS漏洞

// 安全 - 定期审计
// npm audit
// yarn audit
```

### 环境变量泄露
```jsx
// 危险 - 暴露服务端密钥
// .env
REACT_APP_API_KEY=secret_key  // 会被打包到前端！

// 安全 - 敏感密钥只在服务端使用
// 前端只使用公开的配置
```

## 安全最佳实践
1. 避免使用dangerouslySetInnerHTML
2. 验证所有URL协议
3. 不要在前端存储敏感数据
4. 使用Content Security Policy
5. 定期更新依赖
6. 使用TypeScript增强类型安全
""",
)
