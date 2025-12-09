/**
 * 提示词模板测试代码示例
 */

// 按编程语言分类的通用测试代码
export const TEST_CODE_SAMPLES: Record<string, string> = {
  python: `def login(username, password):
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor.execute(query)
    return cursor.fetchone()`,
  javascript: `function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId;
    return db.query(query);
}`,
  java: `public User findUser(String username) {
    String query = "SELECT * FROM users WHERE username = '" + username + "'";
    return jdbcTemplate.queryForObject(query, User.class);
}`,
};

// 按模板名称分类的测试代码（针对不同审计场景）
export const TEMPLATE_TEST_CODES: Record<string, Record<string, string>> = {
  // 默认代码审计 - 包含多种问题的综合示例
  '默认代码审计': {
    python: `import os
import pickle

API_KEY = "sk-1234567890abcdef"  # 硬编码密钥

def process_user_input(user_input):
    # SQL注入风险
    query = f"SELECT * FROM users WHERE name = '{user_input}'"
    cursor.execute(query)
    
    # 命令注入风险
    os.system(f"echo {user_input}")
    
    # 不安全的反序列化
    data = pickle.loads(user_input.encode())
    
    # 性能问题：循环中查询
    for item in items:
        db.query(f"SELECT * FROM orders WHERE item_id = {item.id}")
    
    return data`,
    javascript: `const API_SECRET = "secret123";  // 硬编码密钥

async function handleRequest(req, res) {
    // SQL注入
    const query = "SELECT * FROM users WHERE id = " + req.params.id;
    const user = await db.query(query);
    
    // XSS风险
    res.send("<div>" + req.body.content + "</div>");
    
    // 命令注入
    exec("ls " + req.query.path);
    
    // 性能问题
    for (let i = 0; i < users.length; i++) {
        await db.query("SELECT * FROM orders WHERE user_id = " + users[i].id);
    }
}`,
    java: `public class UserService {
    private static final String DB_PASSWORD = "admin123";  // 硬编码
    
    public User findUser(String input) {
        // SQL注入
        String sql = "SELECT * FROM users WHERE name = '" + input + "'";
        return jdbcTemplate.queryForObject(sql, User.class);
    }
    
    public void processFile(String filename) {
        // 路径遍历
        File file = new File("/data/" + filename);
        // 缺少错误处理
        FileInputStream fis = new FileInputStream(file);
    }
}`,
  },

  // 安全专项审计 - 专注安全漏洞的示例
  '安全专项审计': {
    python: `import os
import subprocess
import pickle
import xml.etree.ElementTree as ET

SECRET_KEY = "super_secret_key_12345"
DB_PASSWORD = "root:password123"

def authenticate(username, password):
    # SQL注入
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    return db.execute(query)

def run_command(cmd):
    # 命令注入
    os.system(cmd)
    subprocess.call(cmd, shell=True)

def load_data(data):
    # 不安全的反序列化
    return pickle.loads(data)

def parse_xml(xml_string):
    # XXE漏洞
    tree = ET.fromstring(xml_string)
    return tree

def fetch_url(url):
    # SSRF
    import requests
    return requests.get(url).text

def read_file(filename):
    # 路径遍历
    with open(f"/var/data/{filename}", "r") as f:
        return f.read()`,
    javascript: `const crypto = require('crypto');

const API_KEY = "sk-live-abcdef123456";
const JWT_SECRET = "mysecret";

function login(username, password) {
    // SQL注入
    const query = \`SELECT * FROM users WHERE username='\${username}' AND password='\${password}'\`;
    return db.query(query);
}

function renderPage(userInput) {
    // XSS
    document.innerHTML = userInput;
    return \`<div>\${userInput}</div>\`;
}

function executeCommand(cmd) {
    // 命令注入
    const { exec } = require('child_process');
    exec(cmd);
}

function hashPassword(password) {
    // 弱加密
    return crypto.createHash('md5').update(password).digest('hex');
}

function verifyToken(token) {
    // 硬编码密钥
    return jwt.verify(token, "hardcoded_secret");
}`,
    java: `import java.io.*;
import java.sql.*;

public class VulnerableService {
    private static final String API_KEY = "AIzaSyD-xxxxx";
    private static final String DB_PASS = "root123";
    
    // SQL注入
    public User getUser(String id) {
        String sql = "SELECT * FROM users WHERE id = '" + id + "'";
        return jdbcTemplate.queryForObject(sql, User.class);
    }
    
    // 命令注入
    public void runCommand(String cmd) {
        Runtime.getRuntime().exec(cmd);
    }
    
    // 路径遍历
    public String readFile(String name) throws IOException {
        return new String(Files.readAllBytes(Paths.get("/data/" + name)));
    }
    
    // 不安全的反序列化
    public Object deserialize(byte[] data) throws Exception {
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data));
        return ois.readObject();
    }
    
    // 弱加密
    public String hashPassword(String password) {
        return DigestUtils.md5Hex(password);
    }
}`,
  },

  // 性能优化审计 - 专注性能问题的示例
  '性能优化审计': {
    python: `import time

def get_user_orders(user_ids):
    # N+1查询问题
    results = []
    for user_id in user_ids:
        user = db.query(f"SELECT * FROM users WHERE id = {user_id}")
        orders = db.query(f"SELECT * FROM orders WHERE user_id = {user_id}")
        results.append({"user": user, "orders": orders})
    return results

def process_large_file(filename):
    # 一次性加载大文件到内存
    with open(filename, 'r') as f:
        content = f.read()  # 可能导致内存溢出
    return process(content)

def find_duplicates(items):
    # O(n²) 算法
    duplicates = []
    for i in range(len(items)):
        for j in range(len(items)):
            if i != j and items[i] == items[j]:
                duplicates.append(items[i])
    return duplicates

def create_reports(data):
    # 循环中创建对象
    for item in data:
        formatter = ReportFormatter()  # 应该移到循环外
        report = formatter.format(item)
        reports.append(report)

class DataProcessor:
    # 未关闭资源
    def process(self, filename):
        f = open(filename, 'r')
        data = f.read()
        return self.transform(data)
        # 文件未关闭`,
    javascript: `// N+1查询问题
async function getUsersWithOrders(userIds) {
    const results = [];
    for (const userId of userIds) {
        const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const orders = await db.query('SELECT * FROM orders WHERE user_id = ?', [userId]);
        results.push({ user, orders });
    }
    return results;
}

// 低效的数组操作
function findCommonElements(arr1, arr2) {
    const common = [];
    for (let i = 0; i < arr1.length; i++) {
        for (let j = 0; j < arr2.length; j++) {
            if (arr1[i] === arr2[j]) {
                common.push(arr1[i]);
            }
        }
    }
    return common;
}

// 内存泄漏风险
const cache = {};
function processData(key, data) {
    cache[key] = data;  // 缓存无限增长
    return transform(data);
}

// 同步阻塞
function readFiles(filenames) {
    const contents = [];
    for (const filename of filenames) {
        contents.push(fs.readFileSync(filename, 'utf8'));  // 同步阻塞
    }
    return contents;
}`,
    java: `public class PerformanceIssues {
    
    // N+1查询
    public List<UserDTO> getUsersWithOrders(List<Long> userIds) {
        List<UserDTO> results = new ArrayList<>();
        for (Long userId : userIds) {
            User user = userRepository.findById(userId);
            List<Order> orders = orderRepository.findByUserId(userId);
            results.add(new UserDTO(user, orders));
        }
        return results;
    }
    
    // 循环中创建对象
    public List<String> formatDates(List<Date> dates) {
        List<String> results = new ArrayList<>();
        for (Date date : dates) {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");  // 应复用
            results.add(sdf.format(date));
        }
        return results;
    }
    
    // 字符串拼接性能问题
    public String buildReport(List<String> items) {
        String result = "";
        for (String item : items) {
            result += item + "\\n";  // 应使用StringBuilder
        }
        return result;
    }
    
    // 未关闭资源
    public String readFile(String path) throws IOException {
        FileInputStream fis = new FileInputStream(path);
        byte[] data = fis.readAllBytes();
        return new String(data);  // fis未关闭
    }
}`,
  },

  // 代码质量审计 - 专注代码质量的示例
  '代码质量审计': {
    python: `# 魔法数字和命名问题
def calc(x, y, z):
    if x > 100:  # 魔法数字
        return y * 0.15 + z * 0.85  # 魔法数字
    return y + z

# 函数过长、职责不单一
def process_order(order):
    # 验证订单
    if not order.items:
        return None
    if not order.user_id:
        return None
    if order.total < 0:
        return None
    
    # 计算价格
    subtotal = 0
    for item in order.items:
        subtotal += item.price * item.quantity
    
    # 应用折扣
    if subtotal > 1000:
        discount = subtotal * 0.1
    elif subtotal > 500:
        discount = subtotal * 0.05
    else:
        discount = 0
    
    # 计算税费
    tax = (subtotal - discount) * 0.08
    
    # 保存订单
    order.subtotal = subtotal
    order.discount = discount
    order.tax = tax
    order.total = subtotal - discount + tax
    db.save(order)
    
    # 发送通知
    send_email(order.user.email, "Order confirmed")
    send_sms(order.user.phone, "Order confirmed")
    
    return order

# 嵌套过深
def check_permission(user, resource, action):
    if user:
        if user.is_active:
            if resource:
                if resource.owner_id == user.id:
                    if action in ['read', 'write']:
                        return True
    return False

# 重复代码
def get_admin_users():
    users = db.query("SELECT * FROM users WHERE role = 'admin'")
    result = []
    for u in users:
        result.append({"id": u.id, "name": u.name, "email": u.email})
    return result

def get_normal_users():
    users = db.query("SELECT * FROM users WHERE role = 'user'")
    result = []
    for u in users:
        result.append({"id": u.id, "name": u.name, "email": u.email})
    return result`,
    javascript: `// 命名不规范
function fn(a, b, c) {
    let x = a + b;
    let y = x * c;
    return y;
}

// 缺少错误处理
async function fetchData(url) {
    const response = await fetch(url);
    const data = await response.json();
    return data;
}

// 嵌套过深
function processData(data) {
    if (data) {
        if (data.items) {
            if (data.items.length > 0) {
                for (let item of data.items) {
                    if (item.active) {
                        if (item.value > 0) {
                            console.log(item);
                        }
                    }
                }
            }
        }
    }
}

// 重复代码
function validateEmail(email) {
    if (!email) return false;
    if (email.length < 5) return false;
    if (!email.includes('@')) return false;
    return true;
}

function validateUsername(username) {
    if (!username) return false;
    if (username.length < 3) return false;
    if (username.length > 20) return false;
    return true;
}

// 魔法数字
function calculatePrice(quantity, type) {
    if (type === 1) {
        return quantity * 9.99;
    } else if (type === 2) {
        return quantity * 19.99;
    } else {
        return quantity * 29.99;
    }
}`,
    java: `public class CodeQualityIssues {
    
    // 魔法数字
    public double calculate(int qty) {
        if (qty > 100) {
            return qty * 0.85;
        } else if (qty > 50) {
            return qty * 0.9;
        }
        return qty * 1.0;
    }
    
    // 函数过长 + 职责不单一
    public void processOrder(Order order) {
        // 验证
        if (order == null) return;
        if (order.getItems() == null) return;
        if (order.getItems().isEmpty()) return;
        
        // 计算
        double total = 0;
        for (OrderItem item : order.getItems()) {
            total += item.getPrice() * item.getQuantity();
        }
        
        // 折扣
        double discount = 0;
        if (total > 1000) discount = total * 0.1;
        else if (total > 500) discount = total * 0.05;
        
        // 保存
        order.setTotal(total - discount);
        orderRepository.save(order);
        
        // 通知
        emailService.send(order.getUser().getEmail(), "Confirmed");
        smsService.send(order.getUser().getPhone(), "Confirmed");
    }
    
    // 嵌套过深
    public boolean checkAccess(User user, Resource res) {
        if (user != null) {
            if (user.isActive()) {
                if (res != null) {
                    if (res.getOwnerId().equals(user.getId())) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    // 命名不规范
    public int fn(int a, int b) {
        int x = a + b;
        return x;
    }
}`,
  },
};

/**
 * 获取模板对应的测试代码
 */
export function getTestCodeForTemplate(templateName: string, language: string): string {
  const templateCodes = TEMPLATE_TEST_CODES[templateName];
  if (templateCodes && templateCodes[language]) {
    return templateCodes[language];
  }
  return TEST_CODE_SAMPLES[language] || TEST_CODE_SAMPLES.python;
}
