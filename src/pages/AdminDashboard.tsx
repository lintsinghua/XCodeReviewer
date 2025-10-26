import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  HardDrive,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Clock,
  AlertTriangle,
  TrendingUp,
  Package,
  Settings
} from "lucide-react";
import { api, dbMode, isLocalMode } from "@/shared/config/database";
import { DatabaseManager } from "@/components/database/DatabaseManager";
import { DatabaseStatusDetail } from "@/components/database/DatabaseStatus";
import { SystemConfig } from "@/components/system/SystemConfig";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalIssues: 0,
    resolvedIssues: 0,
    storageUsed: '计算中...',
    storageQuota: '未知'
  });
  const [loading, setLoading] = useState(true);
  const [storageDetails, setStorageDetails] = useState<{
    usage: number;
    quota: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const projectStats = await api.getProjectStats();

      // 获取存储使用量（IndexedDB）
      let storageUsed = '未知';
      let storageQuota = '未知';
      let details = null;

      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          const usedMB = ((estimate.usage || 0) / 1024 / 1024).toFixed(2);
          const quotaMB = ((estimate.quota || 0) / 1024 / 1024).toFixed(2);
          const percentage = estimate.quota ? ((estimate.usage || 0) / estimate.quota * 100) : 0;

          storageUsed = `${usedMB} MB`;
          storageQuota = `${quotaMB} MB`;

          details = {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
            percentage: Math.round(percentage)
          };
        } catch (e) {
          console.error('Failed to estimate storage:', e);
        }
      }

      setStats({
        totalProjects: projectStats.total_projects || 0,
        activeProjects: projectStats.active_projects || 0,
        totalTasks: projectStats.total_tasks || 0,
        completedTasks: projectStats.completed_tasks || 0,
        totalIssues: projectStats.total_issues || 0,
        resolvedIssues: projectStats.resolved_issues || 0,
        storageUsed,
        storageQuota
      });

      setStorageDetails(details);
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error("加载统计数据失败");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">加载数据库信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            系统管理
          </h1>
          <p className="text-gray-600 mt-2">
            管理系统配置、LLM设置、数据库和存储使用情况
          </p>
        </div>
        <Button variant="outline" onClick={loadStats}>
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新数据
        </Button>
      </div>

      {/* 数据库模式提示 */}
      {!isLocalMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            当前使用 <strong>{dbMode === 'supabase' ? 'Supabase 云端' : '演示'}</strong> 模式。
            数据库管理功能仅在本地数据库模式下完全可用。
            {dbMode === 'demo' && ' 请在 .env 文件中配置 VITE_USE_LOCAL_DB=true 启用本地数据库。'}
          </AlertDescription>
        </Alert>
      )}

      {/* 数据库状态卡片 */}
      <DatabaseStatusDetail />

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">项目总数</p>
                <p className="text-3xl font-bold mt-2">{stats.totalProjects}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  活跃: {stats.activeProjects}
                </p>
              </div>
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">审计任务</p>
                <p className="text-3xl font-bold mt-2">{stats.totalTasks}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  已完成: {stats.completedTasks}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">发现问题</p>
                <p className="text-3xl font-bold mt-2">{stats.totalIssues}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  已解决: {stats.resolvedIssues}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">存储使用</p>
                <p className="text-3xl font-bold mt-2">{stats.storageUsed}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  配额: {stats.storageQuota}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <HardDrive className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容标签页 */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="config">系统配置</TabsTrigger>
          <TabsTrigger value="overview">数据概览</TabsTrigger>
          <TabsTrigger value="storage">存储管理</TabsTrigger>
          <TabsTrigger value="operations">数据操作</TabsTrigger>
          <TabsTrigger value="settings">高级设置</TabsTrigger>
        </TabsList>

        {/* 系统配置 */}
        <TabsContent value="config" className="space-y-6">
          <SystemConfig />
        </TabsContent>

        {/* 数据概览 */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 任务完成率 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  任务完成率
                </CardTitle>
                <CardDescription>审计任务的完成情况统计</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>已完成</span>
                    <span className="font-medium">
                      {stats.totalTasks > 0
                        ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={stats.totalTasks > 0
                      ? (stats.completedTasks / stats.totalTasks) * 100
                      : 0
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">总任务数</p>
                    <p className="text-2xl font-bold">{stats.totalTasks}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">已完成</p>
                    <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 问题解决率 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  问题解决率
                </CardTitle>
                <CardDescription>代码问题的解决情况统计</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>已解决</span>
                    <span className="font-medium">
                      {stats.totalIssues > 0
                        ? Math.round((stats.resolvedIssues / stats.totalIssues) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={stats.totalIssues > 0
                      ? (stats.resolvedIssues / stats.totalIssues) * 100
                      : 0
                    }
                    className="bg-orange-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">总问题数</p>
                    <p className="text-2xl font-bold">{stats.totalIssues}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">已解决</p>
                    <p className="text-2xl font-bold text-green-600">{stats.resolvedIssues}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 数据库表统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                数据库表统计
              </CardTitle>
              <CardDescription>各数据表的记录数量</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">项目</p>
                      <p className="text-2xl font-bold">{stats.totalProjects}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">审计任务</p>
                      <p className="text-2xl font-bold">{stats.totalTasks}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">问题</p>
                      <p className="text-2xl font-bold">{stats.totalIssues}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 存储管理 */}
        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                存储空间使用情况
              </CardTitle>
              <CardDescription>
                浏览器 IndexedDB 存储空间的使用详情
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {storageDetails ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>已使用空间</span>
                      <span className="font-medium">{storageDetails.percentage}%</span>
                    </div>
                    <Progress value={storageDetails.percentage} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{stats.storageUsed} 已使用</span>
                      <span>{stats.storageQuota} 总配额</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">已使用</p>
                      <p className="text-xl font-bold">{stats.storageUsed}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">总配额</p>
                      <p className="text-xl font-bold">{stats.storageQuota}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">剩余空间</p>
                      <p className="text-xl font-bold">
                        {((storageDetails.quota - storageDetails.usage) / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  {storageDetails.percentage > 80 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        存储空间使用率已超过 80%，建议清理不需要的数据或导出备份后清空数据库。
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    无法获取存储空间信息。您的浏览器可能不支持 Storage API。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>存储优化建议</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">定期导出备份</p>
                  <p className="text-sm text-muted-foreground">
                    建议定期导出数据为 JSON 文件，防止数据丢失
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">清理旧数据</p>
                  <p className="text-sm text-muted-foreground">
                    删除不再需要的项目和任务可以释放存储空间
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">监控存储使用</p>
                  <p className="text-sm text-muted-foreground">
                    定期检查存储使用情况，避免超出浏览器限制
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 数据操作 */}
        <TabsContent value="operations" className="space-y-6">
          <DatabaseManager />
        </TabsContent>

        {/* 设置 */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>数据库设置</CardTitle>
              <CardDescription>配置数据库行为和性能选项</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>当前数据库模式：</strong> {dbMode === 'local' ? '本地 IndexedDB' : dbMode === 'supabase' ? 'Supabase 云端' : '演示模式'}
                </AlertDescription>
              </Alert>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">自动备份</p>
                    <p className="text-sm text-muted-foreground">
                      定期自动导出数据备份（开发中）
                    </p>
                  </div>
                  <Badge variant="outline">即将推出</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">数据压缩</p>
                    <p className="text-sm text-muted-foreground">
                      压缩存储数据以节省空间（开发中）
                    </p>
                  </div>
                  <Badge variant="outline">即将推出</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">数据同步</p>
                    <p className="text-sm text-muted-foreground">
                      在多个设备间同步数据（开发中）
                    </p>
                  </div>
                  <Badge variant="outline">即将推出</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>关于本地数据库</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                本地数据库使用浏览器的 IndexedDB 技术存储数据，具有以下特点：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>数据完全存储在本地，不会上传到服务器</li>
                <li>支持离线访问，无需网络连接</li>
                <li>存储容量取决于浏览器和设备</li>
                <li>清除浏览器数据会删除所有本地数据</li>
                <li>不同浏览器的数据相互独立</li>
              </ul>
              <p className="pt-2">
                <strong>建议：</strong>定期导出数据备份，以防意外数据丢失。
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
