import { useState, FormEvent, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/shared/context/AuthContext";
import { apiClient } from "@/shared/api/serverClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Lock, Mail, Terminal, Shield, Fingerprint } from "lucide-react";
import { version } from "../../package.json";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    // 检查是否有保存的邮箱
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

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
      formData.append("username", email);
      formData.append("password", password);

      const response = await apiClient.post("/auth/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      // 记住邮箱
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }

      await login(response.data.access_token);
      toast.success("登录成功");
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      // 处理 Pydantic 验证错误（数组格式）
      if (Array.isArray(detail)) {
        const messages = detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join('; ');
        toast.error(messages || "登录失败");
      } else if (typeof detail === 'object') {
        toast.error(detail.msg || detail.message || JSON.stringify(detail));
      } else {
        toast.error(detail || "登录失败，请检查邮箱和密码");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Decorative Elements */}
      <div className="absolute top-8 left-8 font-mono text-[10px] text-gray-400 hidden lg:block space-y-1">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3" />
          <span>SYS_ID: 0x84F2</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3" />
          <span>ENCRYPT: AES-256</span>
        </div>
        <div className="flex items-center gap-2">
          <Fingerprint className="w-3 h-3" />
          <span>AUTH: READY</span>
        </div>
      </div>

      <div className="absolute bottom-8 right-8 font-mono text-[10px] text-gray-400 hidden lg:block text-right space-y-1">
        <div>SECURE_CONN: TRUE</div>
        <div>PORT: 443</div>
        <div>TLS: 1.3</div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-10 px-4">
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
            <img
              src="/logo_deepaudit.png"
              alt="DeepAudit"
              className="w-14 h-14 object-contain"
            />
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tighter uppercase">
            Deep<span className="text-primary">Audit</span>
          </h1>
          <p className="text-sm font-mono text-gray-500 mt-2">
            // 代码审计平台
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 relative">
          {/* Card Header */}
          <div className="flex items-center gap-2 mb-6 pb-4 border-b-2 border-dashed border-gray-200">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="ml-2 font-mono text-xs text-gray-500 uppercase">
              身份验证
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="font-mono uppercase text-xs font-bold"
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
                  className="h-12 pl-11 font-mono border-2 border-gray-200 focus:border-black transition-colors"
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="font-mono uppercase text-xs font-bold"
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
                  className="h-12 pl-11 font-mono border-2 border-gray-200 focus:border-black transition-colors"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
                  className="border-2 border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-mono text-gray-600 cursor-pointer"
                >
                  记住我
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-bold uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">◌</span> 验证中...
                </span>
              ) : (
                "登 录"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t-2 border-dashed border-gray-200 text-center">
            <p className="text-sm font-mono text-gray-500">
              还没有账号？{" "}
              <span
                className="text-primary font-bold cursor-pointer hover:underline"
                onClick={() => navigate("/register")}
              >
                立即注册
              </span>
            </p>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[10px] text-gray-400 uppercase">
            Version {version} · Secure Connection
          </p>
        </div>
      </div>
    </div>
  );
}
