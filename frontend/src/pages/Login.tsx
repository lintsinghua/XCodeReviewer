import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { apiClient } from '@/shared/api/serverClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { toast } from 'sonner';
import { Lock, Cpu } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const from = location.state?.from?.pathname || '/';

  // 监听认证状态，登录成功后自动跳转
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from, loading]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      await login(response.data.access_token);
      toast.success('访问已授予');
      // 跳转由 useEffect 监听 isAuthenticated 状态变化自动处理
    } catch (error: any) {
      toast.error(error.response?.data?.detail || '访问被拒绝');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="absolute top-10 left-10 font-mono text-xs text-gray-400 hidden md:block">
        <div>系统ID: 0x84F2</div>
        <div>状态: 等待输入</div>
        <div>加密: AES-256</div>
      </div>

      <div className="absolute bottom-10 right-10 font-mono text-xs text-gray-400 hidden md:block text-right">
        <div>安全连接</div>
        <div>端口: 443</div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-10 p-4">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-white border border-border shadow-md mb-4 rounded-sm">
            <img src="/logo_xcodereviewer.png" alt="XCodeReviewer" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tighter uppercase">
            XCode<span className="text-primary">Reviewer</span>
          </h1>
          <p className="text-sm font-mono text-gray-500 mt-2">输入凭据以继续</p>
        </div>

        <div className="terminal-card p-8 relative">
          {/* Decorative Corner Markers - Subtle */}
          <div className="absolute top-3 left-3 w-1.5 h-1.5 bg-primary/20 rounded-sm" />
          <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary/20 rounded-sm" />
          <div className="absolute bottom-3 left-3 w-1.5 h-1.5 bg-primary/20 rounded-sm" />
          <div className="absolute bottom-3 right-3 w-1.5 h-1.5 bg-primary/20 rounded-sm" />

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono uppercase text-xs font-bold">身份 / 邮箱</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="USER@DOMAIN.COM"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="terminal-input font-mono pl-10"
                />
                <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono uppercase text-xs font-bold">通行码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="terminal-input font-mono pl-10"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full terminal-btn-primary text-lg h-12 mt-4"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">/</span> 认证中...
                </span>
              ) : '初始化会话'}
            </Button>
          </form>

          <div className="mt-6 pt-6 terminal-divider text-center">
            <div className="text-xs font-mono text-gray-500">
              没有访问令牌？ <span className="text-primary font-bold cursor-pointer hover:underline" onClick={() => navigate('/register')}>申请访问</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
