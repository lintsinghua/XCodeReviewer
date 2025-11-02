/**
 * 超级简单的认证页面 - 用于测试路由
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthSimple() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('登录:', username, password);
    alert(`尝试登录: ${username}`);
    // navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* Logo 和标题 */}
        <div style={{ textAlign: 'center', marginBottom: '30px', color: 'white' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '50%',
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px'
          }}>
            🛡️
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            XCodeReviewer
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.9 }}>
            基于AI的代码质量分析平台
          </p>
        </div>

        {/* 登录表单卡片 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '30px',
            color: '#333',
            textAlign: 'center'
          }}>
            登录
          </h2>

          <form onSubmit={handleLogin}>
            {/* 用户名输入 */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#555'
              }}>
                用户名或邮箱
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入用户名或邮箱"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            {/* 密码输入 */}
            <div style={{ marginBottom: '30px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#555'
              }}>
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              登录
            </button>
          </form>

          {/* 注册链接 */}
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#666'
          }}>
            还没有账号？{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert('注册功能开发中...');
              }}
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontWeight: '500'
              }}
            >
              立即注册
            </a>
          </div>
        </div>

        {/* 功能说明 */}
        <div style={{
          marginTop: '30px',
          textAlign: 'center',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.9)',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          padding: '15px'
        }}>
          <p style={{ margin: '5px 0' }}>🔍 支持代码仓库审计和即时代码分析</p>
          <p style={{ margin: '5px 0' }}>🛡️ 提供安全漏洞检测和性能优化建议</p>
        </div>

        {/* 测试信息 */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: 'rgba(255,255,0,0.1)',
          border: '2px solid rgba(255,255,0,0.3)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '12px'
        }}>
          <strong>🧪 简化版测试组件</strong>
          <br />
          这是一个不依赖任何 UI 库的简化版本，用于测试路由是否正常工作。
          <br />
          路径: <code>/auth-simple</code>
        </div>
      </div>
    </div>
  );
}

