/**
 * 认证页面 - 登录和注册
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '@/shared/services/auth-service';
import { toast } from 'sonner';

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 登录表单
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  
  // 注册表单
  const [registerForm, setRegisterForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });
  
  /**
   * 处理登录
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginForm.username || !loginForm.password) {
      setError('请输入用户名和密码');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await authService.login(loginForm.username, loginForm.password);
      toast.success('登录成功！');
      
      // 跳转到首页
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败，请检查用户名和密码');
      toast.error('登录失败');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 处理注册
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 表单验证
    if (!registerForm.email || !registerForm.username || !registerForm.password) {
      setError('请填写所有必填字段');
      return;
    }
    
    // 用户名格式验证（与后端要求一致）
    if (registerForm.username.length < 3 || registerForm.username.length > 50) {
      setError('用户名长度必须在 3-50 个字符之间');
      return;
    }
    
    const usernamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!usernamePattern.test(registerForm.username)) {
      setError('用户名只能包含字母、数字、下划线(_)和连字符(-)，不能使用邮箱格式');
      return;
    }
    
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    // 完整的密码强度验证（与后端要求一致）
    const passwordErrors = [];
    
    if (registerForm.password.length < 12) {
      passwordErrors.push('至少需要 12 个字符');
    }
    
    if (!/[A-Z]/.test(registerForm.password)) {
      passwordErrors.push('至少需要一个大写字母 (A-Z)');
    }
    
    if (!/[a-z]/.test(registerForm.password)) {
      passwordErrors.push('至少需要一个小写字母 (a-z)');
    }
    
    if (!/[0-9]/.test(registerForm.password)) {
      passwordErrors.push('至少需要一个数字 (0-9)');
    }
    
    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(registerForm.password)) {
      passwordErrors.push('至少需要一个特殊字符 (!@#$%^&* 等)');
    }
    
    if (passwordErrors.length > 0) {
      setError('密码不符合要求：\n• ' + passwordErrors.join('\n• '));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await authService.register({
        email: registerForm.email,
        username: registerForm.username,
        password: registerForm.password,
        full_name: registerForm.fullName || undefined
      });
      
      toast.success('注册成功，已自动登录！');
      
      // 跳转到首页
      navigate('/');
    } catch (err: any) {
      setError(err.message || '注册失败');
      toast.error('注册失败');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">XCodeReviewer</h1>
          <p className="text-gray-600">基于AI的代码质量分析平台</p>
        </div>
        
        {/* 登录/注册表单 */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>欢迎使用</CardTitle>
            <CardDescription>登录或注册以开始使用</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>
              
              {/* 登录表单 */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名或邮箱</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="输入用户名或邮箱"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="输入密码"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    登录
                  </Button>
                </form>
              </TabsContent>
              
              {/* 注册表单 */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">邮箱 *</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="输入邮箱地址"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">用户名 *</Label>
                    <Input
                      id="reg-username"
                      type="text"
                      placeholder="输入用户名（如：user_123）"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      disabled={loading}
                      required
                      minLength={3}
                      maxLength={50}
                      pattern="^[a-zA-Z0-9_-]+$"
                    />
                    <p className="text-xs text-gray-500">
                      3-50个字符，只能使用字母、数字、下划线(_)和连字符(-)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-fullname">姓名（可选）</Label>
                    <Input
                      id="reg-fullname"
                      type="text"
                      placeholder="输入真实姓名"
                      value={registerForm.fullName}
                      onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">密码 *</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="输入密码"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      disabled={loading}
                      required
                      minLength={12}
                    />
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <p className="font-medium">密码必须满足以下所有要求：</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-2">
                        <li>至少 12 个字符</li>
                        <li>包含大写字母 (A-Z)</li>
                        <li>包含小写字母 (a-z)</li>
                        <li>包含数字 (0-9)</li>
                        <li>包含特殊字符 (!@#$%^&* 等)</li>
                      </ul>
                      <p className="text-green-600 mt-1">
                        示例：MySecure@Pass123
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm-password">确认密码 *</Label>
                    <Input
                      id="reg-confirm-password"
                      type="password"
                      placeholder="再次输入密码"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      disabled={loading}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    注册
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        {/* 功能特性 */}
        <div className="text-center mt-6 text-sm text-gray-600 bg-white/80 backdrop-blur-sm rounded-lg p-3">
          <p>🔍 支持代码仓库审计和即时代码分析</p>
          <p>🛡️ 提供安全漏洞检测和性能优化建议</p>
        </div>
      </div>
    </div>
  );
}

