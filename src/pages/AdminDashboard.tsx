import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users, 
  Settings, 
  Shield, 
  Activity, 
  AlertTriangle, 
  Search,
  Edit,
  Trash2,
  UserPlus,
  Database,
  Server,
  BarChart3
} from "lucide-react";
import { api } from "@/db/supabase";
import type { Profile } from "@/types/types";
import { toast } from "sonner";

export default function AdminDashboard() {
  const user = null as any;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await api.getAllProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      toast.error("加载用户数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'member') => {
    try {
      await api.updateProfile(userId, { role: newRole });
      toast.success("用户角色更新成功");
      loadProfiles();
    } catch (error) {
      console.error('Failed to update user role:', error);
      toast.error("更新用户角色失败");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 检查当前用户是否为管理员
  const isAdmin = true;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">访问被拒绝</h2>
          <p className="text-gray-600 mb-4">您没有权限访问管理员面板</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">系统管理</h1>
          <p className="text-gray-600 mt-2">
            管理系统用户、配置和监控系统状态
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          <Shield className="w-4 h-4 mr-2" />
          管理员权限
        </Badge>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">总用户数</p>
                <p className="text-2xl font-bold">{profiles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">管理员</p>
                <p className="text-2xl font-bold">
                  {profiles.filter(p => p.role === 'admin').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">活跃用户</p>
                <p className="text-2xl font-bold">
                  {profiles.filter(p => p.role === 'member').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Server className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">系统状态</p>
                <p className="text-2xl font-bold text-green-600">正常</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容 */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="system">系统监控</TabsTrigger>
          <TabsTrigger value="settings">系统设置</TabsTrigger>
          <TabsTrigger value="logs">操作日志</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* 搜索和操作 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 relative mr-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="搜索用户姓名、手机号或邮箱..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  添加用户
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 用户列表 */}
          <Card>
            <CardHeader>
              <CardTitle>用户列表 ({filteredProfiles.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredProfiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                        {profile.full_name?.charAt(0) || profile.phone?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {profile.full_name || '未设置姓名'}
                        </h4>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          {profile.phone && (
                            <span>📱 {profile.phone}</span>
                          )}
                          {profile.email && (
                            <span>📧 {profile.email}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          注册时间：{formatDate(profile.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                        {profile.role === 'admin' ? '管理员' : '普通用户'}
                      </Badge>
                      
                      {profile.id !== user?.id && (
                        <Select
                          value={profile.role}
                          onValueChange={(value: 'admin' | 'member') => 
                            handleUpdateUserRole(profile.id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">普通用户</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 系统性能 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  系统性能
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CPU 使用率</span>
                    <span className="text-sm text-muted-foreground">15%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '15%' }}></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">内存使用率</span>
                    <span className="text-sm text-muted-foreground">32%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '32%' }}></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">磁盘使用率</span>
                    <span className="text-sm text-muted-foreground">58%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-orange-600 h-2 rounded-full" style={{ width: '58%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 数据库状态 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  数据库状态
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">连接状态</span>
                  <Badge className="bg-green-100 text-green-800">正常</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">活跃连接</span>
                  <span className="text-sm text-muted-foreground">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">查询响应时间</span>
                  <span className="text-sm text-muted-foreground">45ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">存储使用量</span>
                  <span className="text-sm text-muted-foreground">2.3GB</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 系统日志 */}
          <Card>
            <CardHeader>
              <CardTitle>系统日志</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">系统启动成功</p>
                    <p className="text-xs text-muted-foreground">2024-01-15 09:00:00</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">新用户注册</p>
                    <p className="text-xs text-muted-foreground">2024-01-15 08:45:00</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">数据库连接超时</p>
                    <p className="text-xs text-muted-foreground">2024-01-15 08:30:00</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="text-center py-12">
            <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">系统设置</h3>
            <p className="text-sm text-muted-foreground">此功能正在开发中</p>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">操作日志</h3>
            <p className="text-sm text-muted-foreground">此功能正在开发中</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}