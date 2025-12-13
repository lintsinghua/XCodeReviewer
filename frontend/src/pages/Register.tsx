/**
 * Register Page
 * Cyberpunk Terminal Aesthetic
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/shared/api/serverClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Mail, Lock, Terminal, Shield, Cpu } from 'lucide-react';
import { version } from '../../package.json';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post('/auth/register', {
        email,
        password,
        full_name: fullName,
      });
      toast.success('注册成功，请登录');
      navigate('/login');
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (Array.isArray(detail)) {
        const messages = detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join('; ');
        toast.error(messages || '注册失败');
      } else if (typeof detail === 'object') {
        toast.error(detail.msg || detail.message || JSON.stringify(detail));
      } else {
        toast.error(detail || '注册失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
          }}
        />
      </div>

      {/* Vignette effect */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,107,44,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,107,44,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Corner Decorations */}
      <div className="absolute top-4 left-4 text-[10px] font-mono text-gray-700 z-30 space-y-1">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3" />
          <span>REG_MODULE: ACTIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3" />
          <span>ENCRYPT: AES-256</span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3" />
          <span>NEW_USER: INIT</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 text-[10px] font-mono text-gray-700 text-right z-30 space-y-1">
        <div>SECURE_CONN: TRUE</div>
        <div>VALIDATION: ENABLED</div>
        <div>HASH: SHA-256</div>
      </div>

      <div className="absolute bottom-4 left-4 text-[10px] font-mono text-gray-700 z-30">
        DEEPAUDIT_REG_v3
      </div>

      <div className="absolute bottom-4 right-4 text-[10px] font-mono text-gray-700 z-30">
        {new Date().toISOString().split("T")[0]}
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-30 px-4">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-[#0c0c12] border border-gray-800/60 rounded-lg mb-6"
               style={{ boxShadow: '0 0 30px rgba(255,107,44,0.1)' }}>
            <img
              src="/logo_deepaudit.png"
              alt="DeepAudit"
              className="w-14 h-14 object-contain"
            />
          </div>
          <div
            className="text-3xl font-bold tracking-wider mb-2 font-mono"
            style={{ textShadow: "0 0 30px rgba(255,107,44,0.5), 0 0 60px rgba(255,107,44,0.3)" }}
          >
            <span className="text-primary">DEEP</span>
            <span className="text-white">AUDIT</span>
          </div>
          <p className="text-sm font-mono text-gray-500">
            // Create New Account
          </p>
        </div>

        {/* Register Form Card */}
        <div className="bg-[#0c0c12] border border-gray-800/60 rounded-lg overflow-hidden"
             style={{ boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }}>
          {/* Card Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0a0f] border-b border-gray-800/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <span className="ml-2 font-mono text-[11px] text-gray-500 tracking-wider">
              register@deepaudit
            </span>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label
                  htmlFor="fullName"
                  className="font-mono text-xs text-gray-400 uppercase tracking-wider"
                >
                  姓名
                </Label>
                <div className="relative">
                  <Input
                    id="fullName"
                    placeholder="您的姓名"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-12 pl-11 font-mono bg-[#0a0a0f] border-gray-700/50 text-gray-200 placeholder:text-gray-600 focus:border-primary/50 focus:ring-0"
                  />
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="font-mono text-xs text-gray-400 uppercase tracking-wider"
                >
                  邮箱地址
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-11 font-mono bg-[#0a0a0f] border-gray-700/50 text-gray-200 placeholder:text-gray-600 focus:border-primary/50 focus:ring-0"
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="font-mono text-xs text-gray-400 uppercase tracking-wider"
                >
                  密码
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pl-11 font-mono bg-[#0a0a0f] border-gray-700/50 text-gray-200 placeholder:text-gray-600 focus:border-primary/50 focus:ring-0"
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-white border border-primary/50 transition-all"
                style={{ boxShadow: '0 0 20px rgba(255,107,44,0.3)' }}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    注册中...
                  </span>
                ) : (
                  "注 册"
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-6 pt-5 border-t border-gray-800/50 text-center">
              <p className="text-sm font-mono text-gray-500">
                已有账号？{" "}
                <span
                  className="text-primary font-bold cursor-pointer hover:underline"
                  onClick={() => navigate('/login')}
                >
                  直接登录
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[10px] text-gray-600 uppercase">
            Version {version} · Secure Registration
          </p>
        </div>
      </div>
    </div>
  );
}
