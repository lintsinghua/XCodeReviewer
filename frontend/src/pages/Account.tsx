import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Save,
  Loader2,
  KeyRound,
  LogOut,
  UserPlus,
  GitBranch
} from "lucide-react";
import { apiClient } from "@/shared/api/serverClient";
import { toast } from "sonner";
import type { Profile } from "@/shared/types";

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    github_username: "",
    gitlab_username: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/users/me');
      setProfile(res.data);
      setForm({
        full_name: res.data.full_name || "",
        phone: res.data.phone || "",
        github_username: res.data.github_username || "",
        gitlab_username: res.data.gitlab_username || "",
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error("加载账号信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await apiClient.put('/users/me', form);
      setProfile(res.data);
      toast.success("账号信息已更新");
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error("更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error("请填写新密码");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("两次输入的密码不一致");
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error("密码长度至少6位");
      return;
    }

    try {
      setChangingPassword(true);
      await apiClient.put('/users/me', { password: passwordForm.new_password });
      toast.success("密码已更新");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      console.error('Failed to change password:', error);
      toast.error("密码更新失败");
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return "U";
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    toast.success("已退出登录");
    navigate('/login');
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem('access_token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-0 pb-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-4 border-black pb-6 bg-white/50 backdrop-blur-sm p-4 retro-border">
        <div>
          <h1 className="text-3xl font-display font-bold text-black uppercase tracking-tighter">
            账号<span className="text-primary">_管理</span>
          </h1>
          <p className="text-gray-600 mt-1 font-mono border-l-2 border-primary pl-2">管理您的个人账号信息</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleSwitchAccount}
            className="terminal-btn-primary bg-white text-black hover:bg-gray-100"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            切换账号
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowLogoutDialog(true)}
            className="bg-red-500 hover:bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="text-center pb-2">
            <Avatar className="w-24 h-24 mx-auto border-4 border-black">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary text-white text-2xl font-bold">
                {getInitials(profile?.full_name, profile?.email)}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-4 font-display uppercase">{profile?.full_name || "未设置姓名"}</CardTitle>
            <CardDescription className="font-mono">{profile?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">角色:</span>
                <span className="font-bold uppercase">{profile?.role === 'admin' ? '管理员' : '成员'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">注册时间:</span>
                <span className="font-bold">{formatDate(profile?.created_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="lg:col-span-2 retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="font-display uppercase flex items-center gap-2">
              <User className="w-5 h-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-mono font-bold uppercase text-xs flex items-center gap-2">
                  <Mail className="w-3 h-3" /> 邮箱
                </Label>
                <Input
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="terminal-input bg-gray-100"
                />
                <p className="text-xs text-gray-500">邮箱不可修改</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name" className="font-mono font-bold uppercase text-xs flex items-center gap-2">
                  <User className="w-3 h-3" /> 姓名
                </Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="请输入姓名"
                  className="terminal-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-mono font-bold uppercase text-xs flex items-center gap-2">
                  <Phone className="w-3 h-3" /> 手机号
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="请输入手机号"
                  className="terminal-input"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-display font-bold uppercase text-sm">代码托管账号</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github" className="font-mono font-bold uppercase text-xs flex items-center gap-2">
                    <GitBranch className="w-3 h-3" /> GitHub 用户名
                  </Label>
                  <Input
                    id="github"
                    value={form.github_username}
                    onChange={(e) => setForm({ ...form, github_username: e.target.value })}
                    placeholder="your-github-username"
                    className="terminal-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gitlab" className="font-mono font-bold uppercase text-xs flex items-center gap-2">
                    <GitBranch className="w-3 h-3" /> GitLab 用户名
                  </Label>
                  <Input
                    id="gitlab"
                    value={form.gitlab_username}
                    onChange={(e) => setForm({ ...form, gitlab_username: e.target.value })}
                    placeholder="your-gitlab-username"
                    className="terminal-input"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving} className="terminal-btn-primary">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                保存修改
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card className="lg:col-span-3 retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle className="font-display uppercase flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              修改密码
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_password" className="font-mono font-bold uppercase text-xs">新密码</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="输入新密码"
                  className="terminal-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="font-mono font-bold uppercase text-xs">确认密码</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="再次输入新密码"
                  className="terminal-input"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleChangePassword} disabled={changingPassword} variant="outline" className="terminal-btn-primary bg-white text-black hover:bg-gray-100">
                  {changingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  更新密码
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase">确认退出登录？</AlertDialogTitle>
            <AlertDialogDescription className="font-mono">
              退出后需要重新登录才能访问系统。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="terminal-btn-primary bg-white text-black hover:bg-gray-100">
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white border-2 border-black"
            >
              确认退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
