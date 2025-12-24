/**
 * Account Page
 * Cyberpunk Terminal Aesthetic
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  Save,
  KeyRound,
  LogOut,
  UserPlus,
  GitBranch,
  Terminal,
  Key,
  Copy,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { apiClient } from "@/shared/api/serverClient";
import { toast } from "sonner";
import type { Profile } from "@/shared/types";
import { generateSSHKey, getSSHKey, deleteSSHKey, testSSHKey } from "@/shared/api/sshKeys";

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

  // SSH Key states
  const [sshKey, setSSHKey] = useState<{ has_key: boolean; public_key?: string; fingerprint?: string }>({ has_key: false });
  const [generatingKey, setGeneratingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testRepoUrl, setTestRepoUrl] = useState("");
  const [showDeleteKeyDialog, setShowDeleteKeyDialog] = useState(false);

  useEffect(() => {
    loadProfile();
    loadSSHKey();
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

  const loadSSHKey = async () => {
    try {
      const data = await getSSHKey();
      setSSHKey(data);
    } catch (error) {
      console.error('Failed to load SSH key:', error);
    }
  };

  const handleGenerateSSHKey = async () => {
    try {
      setGeneratingKey(true);
      const data = await generateSSHKey();
      setSSHKey({ has_key: true, public_key: data.public_key, fingerprint: data.fingerprint });
      toast.success(data.message);
    } catch (error: any) {
      console.error('Failed to generate SSH key:', error);
      toast.error(error.response?.data?.detail || "生成SSH密钥失败");
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleDeleteSSHKey = async () => {
    try {
      setDeletingKey(true);
      await deleteSSHKey();
      setSSHKey({ has_key: false });
      toast.success("SSH密钥已删除");
      setShowDeleteKeyDialog(false);
    } catch (error: any) {
      console.error('Failed to delete SSH key:', error);
      toast.error(error.response?.data?.detail || "删除SSH密钥失败");
    } finally {
      setDeletingKey(false);
    }
  };

  const handleTestSSHKey = async () => {
    if (!testRepoUrl) {
      toast.error("请输入仓库URL");
      return;
    }
    try {
      setTestingKey(true);
      const result = await testSSHKey(testRepoUrl);
      if (result.success) {
        toast.success("SSH连接测试成功");
        // 在控制台输出详细信息
        if (result.output) {
          console.log("SSH测试输出:", result.output);
        }
      } else {
        // 显示详细的错误信息
        toast.error(result.message || "SSH连接测试失败", {
          description: result.output ? `详情: ${result.output.substring(0, 100)}...` : undefined,
          duration: 5000,
        });
        // 在控制台输出完整错误信息
        if (result.output) {
          console.error("SSH测试失败:", result.output);
        }
      }
    } catch (error: any) {
      console.error('Failed to test SSH key:', error);
      toast.error(error.response?.data?.detail || "测试SSH密钥失败");
    } finally {
      setTestingKey(false);
    }
  };

  const handleCopyPublicKey = () => {
    if (sshKey.public_key) {
      navigator.clipboard.writeText(sshKey.public_key);
      toast.success("公钥已复制到剪贴板");
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
      <div className="flex items-center justify-center min-h-screen cyber-bg-elevated">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-wider">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 cyber-bg-elevated min-h-screen font-mono relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="cyber-card p-0">
          <div className="cyber-card-header">
            <User className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">用户信息</h3>
          </div>
          <div className="p-6 text-center">
            <div className="relative inline-block mb-4">
              <Avatar className="w-24 h-24 border-2 border-primary/30">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                  {getInitials(profile?.full_name, profile?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                <div className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
              </div>
            </div>
            <h4 className="text-lg font-bold text-foreground uppercase mb-1">
              {profile?.full_name || "未设置姓名"}
            </h4>
            <p className="text-muted-foreground text-sm">{profile?.email}</p>

            <div className="mt-6 pt-6 border-t border-border space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-4 h-4 text-violet-400" />
                <span className="text-muted-foreground">角色:</span>
                <span className="text-violet-400 font-bold uppercase">
                  {profile?.role === 'admin' ? '管理员' : '成员'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span className="text-muted-foreground">注册时间:</span>
                <span className="text-foreground font-mono">{formatDate(profile?.created_at)}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border space-y-2">
              <Button
                variant="outline"
                onClick={handleSwitchAccount}
                className="w-full cyber-btn-outline h-10"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                切换账号
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowLogoutDialog(true)}
                className="w-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 h-10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2 cyber-card p-0">
          <div className="cyber-card-header">
            <Terminal className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">基本信息</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                  <Mail className="w-3 h-3" /> 邮箱
                </Label>
                <Input
                  id="email"
                  value={profile?.email || ""}
                  disabled
                  className="cyber-input bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">邮箱不可修改</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                  <User className="w-3 h-3" /> 姓名
                </Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="请输入姓名"
                  className="cyber-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                  <Phone className="w-3 h-3" /> 手机号
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="请输入手机号"
                  className="cyber-input"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="section-title text-sm mb-4 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                代码托管账号
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <GitBranch className="w-3 h-3" /> GitHub 用户名
                  </Label>
                  <Input
                    id="github"
                    value={form.github_username}
                    onChange={(e) => setForm({ ...form, github_username: e.target.value })}
                    placeholder="your-github-username"
                    className="cyber-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gitlab" className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <GitBranch className="w-3 h-3" /> GitLab 用户名
                  </Label>
                  <Input
                    id="gitlab"
                    value={form.gitlab_username}
                    onChange={(e) => setForm({ ...form, gitlab_username: e.target.value })}
                    placeholder="your-gitlab-username"
                    className="cyber-input"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving} className="cyber-btn-primary h-10">
                {saving ? (
                  <>
                    <div className="loading-spinner w-4 h-4 mr-2" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存修改
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* SSH Key Management */}
        <div className="lg:col-span-3 cyber-card p-0">
          <div className="cyber-card-header">
            <Key className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">SSH 密钥管理</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Key className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium mb-1">
                  使用 SSH 密钥访问 Git 仓库
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  生成 SSH 密钥对后，将公钥添加到 GitHub/GitLab，即可使用 SSH URL 访问私有仓库。私钥将被加密存储。
                </p>
              </div>
            </div>

            {!sshKey.has_key ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                  <Key className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">尚未生成 SSH 密钥</p>
                <Button
                  onClick={handleGenerateSSHKey}
                  disabled={generatingKey}
                  className="cyber-btn-primary h-10"
                >
                  {generatingKey ? (
                    <>
                      <div className="loading-spinner w-4 h-4 mr-2" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      生成 SSH 密钥
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Public Key Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      SSH 公钥
                    </Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyPublicKey}
                      className="h-8 text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      复制
                    </Button>
                  </div>
                  <Textarea
                    value={sshKey.public_key || ""}
                    readOnly
                    className="cyber-input font-mono text-xs h-24 resize-none"
                  />

                  {/* 显示指纹 */}
                  {sshKey.fingerprint && (
                    <div className="p-3 bg-muted/50 rounded border border-border">
                      <Label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">
                        公钥指纹 (SHA256)
                      </Label>
                      <code className="text-xs text-emerald-400 font-mono break-all">
                        {sshKey.fingerprint}
                      </code>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    请将此公钥添加到 <a href="https://github.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitHub</a> 或 <a href="https://gitlab.com/-/profile/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">GitLab</a> 或 <a href="https://codeup.aliyun.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CodeUp</a> 账户
                  </p>
                </div>

                {/* Test SSH Connection */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">
                    测试 SSH 连接
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="git@github.com:username/repo.git"
                      value={testRepoUrl}
                      onChange={(e) => setTestRepoUrl(e.target.value)}
                      className="cyber-input font-mono text-xs"
                    />
                    <Button
                      onClick={handleTestSSHKey}
                      disabled={testingKey}
                      className="cyber-btn-outline whitespace-nowrap"
                    >
                      {testingKey ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2" />
                          测试中...
                        </>
                      ) : (
                        <>
                          <Terminal className="w-4 h-4 mr-2" />
                          测试连接
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Delete Key */}
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteKeyDialog(true)}
                    className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 h-10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除密钥
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Password Change */}
        <div className="lg:col-span-3 cyber-card p-0">
          <div className="cyber-card-header">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">修改密码</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_password" className="text-xs font-bold text-muted-foreground uppercase">新密码</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="输入新密码"
                  className="cyber-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-xs font-bold text-muted-foreground uppercase">确认密码</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="再次输入新密码"
                  className="cyber-input"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="cyber-btn-outline h-10"
                >
                  {changingPassword ? (
                    <>
                      <div className="loading-spinner w-4 h-4 mr-2" />
                      更新中...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      更新密码
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="cyber-card border-rose-500/30 cyber-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold uppercase text-foreground flex items-center gap-2">
              <LogOut className="w-5 h-5 text-rose-400" />
              确认退出登录？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              退出后需要重新登录才能访问系统。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cyber-btn-outline">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30"
            >
              确认退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete SSH Key Confirmation Dialog */}
      <AlertDialog open={showDeleteKeyDialog} onOpenChange={setShowDeleteKeyDialog}>
        <AlertDialogContent className="cyber-card border-rose-500/30 cyber-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold uppercase text-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              确认删除 SSH 密钥？
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              删除后将无法使用 SSH 方式访问 Git 仓库，需要重新生成密钥。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cyber-btn-outline" disabled={deletingKey}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSSHKey}
              disabled={deletingKey}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30"
            >
              {deletingKey ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
