import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
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
import { api, dbMode } from "@/shared/config/database";
import { DatabaseManager } from "@/components/database/DatabaseManager";
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-none h-16 w-16 border-8 border-black border-t-transparent mx-auto"></div>
          <p className="text-black font-mono font-bold uppercase">加载数据库信息...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-0 pb-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 页面标题 */}
      <div className="relative z-10 flex items-center justify-between border-b-4 border-black pb-6 bg-white/50 backdrop-blur-sm p-4 retro-border">
        <div>
          <h1 className="text-3xl font-display font-bold text-black uppercase tracking-tighter flex items-center gap-3">
            <Settings className="h-8 w-8 text-black" />
            系统管理
          </h1>
          <p className="text-gray-600 mt-2 font-mono border-l-2 border-primary pl-2">
            管理系统配置、LLM设置、数据库和存储使用情况
          </p>
        </div>
        <Button variant="outline" onClick={loadStats} className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新数据
        </Button>
      </div>

      {/* 主要内容标签页 */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-transparent border-2 border-black p-0 h-auto gap-0 mb-6">
          <TabsTrigger value="config" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">系统配置</TabsTrigger>
          <TabsTrigger value="overview" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">数据概览</TabsTrigger>
          <TabsTrigger value="storage" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">存储管理</TabsTrigger>
          <TabsTrigger value="operations" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">数据操作</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">高级设置</TabsTrigger>
        </TabsList>

        {/* 系统配置 */}
        <TabsContent value="config" className="flex flex-col gap-6">
          <SystemConfig />
        </TabsContent>

        {/* 数据概览 */}
        <TabsContent value="overview" className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 任务完成率 */}
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
              <div className="p-4 border-b-2 border-black bg-gray-50">
                <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  任务完成率
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-1">审计任务的完成情况统计</p>
              </div>
              <div className="p-6 space-y-4 font-mono">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>已完成</span>
                    <span>
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
                    className="h-4 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-green-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-black border-dashed">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold">总任务数</p>
                    <p className="text-2xl font-bold">{stats.totalTasks}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold">已完成</p>
                    <p className="text-2xl font-bold text-green-600">{stats.completedTasks}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 问题解决率 */}
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
              <div className="p-4 border-b-2 border-black bg-gray-50">
                <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  问题解决率
                </h3>
                <p className="text-xs text-gray-500 font-mono mt-1">代码问题的解决情况统计</p>
              </div>
              <div className="p-6 space-y-4 font-mono">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>已解决</span>
                    <span>
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
                    className="h-4 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-orange-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t-2 border-black border-dashed">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold">总问题数</p>
                    <p className="text-2xl font-bold">{stats.totalIssues}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 uppercase font-bold">已解决</p>
                    <p className="text-2xl font-bold text-green-600">{stats.resolvedIssues}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 数据库表统计 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
                <Package className="h-5 w-5" />
                数据库表统计
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-1">各数据表的记录数量</p>
            </div>
            <div className="p-6 font-mono">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 border-2 border-black bg-blue-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-bold">项目</p>
                      <p className="text-2xl font-bold">{stats.totalProjects}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-2 border-black bg-green-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-bold">审计任务</p>
                      <p className="text-2xl font-bold">{stats.totalTasks}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-2 border-black bg-orange-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-bold">问题</p>
                      <p className="text-2xl font-bold">{stats.totalIssues}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 存储管理 */}
        <TabsContent value="storage" className="flex flex-col gap-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                存储空间使用情况
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-1">
                浏览器 IndexedDB 存储空间的使用详情
              </p>
            </div>
            <div className="p-6 flex flex-col gap-6 font-mono">
              {storageDetails ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>已使用空间</span>
                      <span>{storageDetails.percentage}%</span>
                    </div>
                    <Progress value={storageDetails.percentage} className="h-4 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-primary" />
                    <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                      <span>{stats.storageUsed} 已使用</span>
                      <span>{stats.storageQuota} 总配额</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    <div className="p-4 bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <p className="text-xs text-gray-600 uppercase font-bold mb-1">已使用</p>
                      <p className="text-xl font-bold">{stats.storageUsed}</p>
                    </div>
                    <div className="p-4 bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <p className="text-xs text-gray-600 uppercase font-bold mb-1">总配额</p>
                      <p className="text-xl font-bold">{stats.storageQuota}</p>
                    </div>
                    <div className="p-4 bg-gray-100 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <p className="text-xs text-gray-600 uppercase font-bold mb-1">剩余空间</p>
                      <p className="text-xl font-bold">
                        {((storageDetails.quota - storageDetails.usage) / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  {storageDetails.percentage > 80 && (
                    <div className="bg-red-50 border-2 border-red-500 p-4 flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-800 uppercase">警告</p>
                        <p className="text-sm text-red-700 font-medium">
                          存储空间使用率已超过 80%，建议清理不需要的数据或导出备份后清空数据库。
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-bold text-blue-800 uppercase">提示</p>
                    <p className="text-sm text-blue-700 font-medium">
                      无法获取存储空间信息。您的浏览器可能不支持 Storage API。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">存储优化建议</h3>
            </div>
            <div className="p-6 space-y-3 font-mono">
              <div className="flex items-start gap-3 p-3 bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-bold text-black uppercase text-sm">定期导出备份</p>
                  <p className="text-xs text-gray-600 font-medium">
                    建议定期导出数据为 JSON 文件，防止数据丢失
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-bold text-black uppercase text-sm">清理旧数据</p>
                  <p className="text-xs text-gray-600 font-medium">
                    删除不再需要的项目和任务可以释放存储空间
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-bold text-black uppercase text-sm">监控存储使用</p>
                  <p className="text-xs text-gray-600 font-medium">
                    定期检查存储使用情况，避免超出浏览器限制
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 数据操作 */}
        <TabsContent value="operations" className="flex flex-col gap-6">
          <DatabaseManager />
        </TabsContent>

        {/* 设置 */}
        <TabsContent value="settings" className="flex flex-col gap-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">数据库设置</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">配置数据库行为和性能选项</p>
            </div>
            <div className="p-6 space-y-4 font-mono">
              <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-800 uppercase text-sm">当前数据库模式</p>
                  <p className="text-sm text-blue-700 font-medium mt-1">
                    {
                      dbMode === 'api' ? '后端 PostgreSQL 数据库' :
                        dbMode === 'local' ? '本地 IndexedDB' :
                          dbMode === 'supabase' ? 'Supabase 云端（已废弃）' :
                            '演示模式'
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between p-4 border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <p className="font-bold text-black uppercase text-sm">自动备份</p>
                    <p className="text-xs text-gray-500 font-medium">
                      定期自动导出数据备份（开发中）
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-none border-black bg-gray-100 font-mono text-xs">即将推出</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <p className="font-bold text-black uppercase text-sm">数据压缩</p>
                    <p className="text-xs text-gray-500 font-medium">
                      压缩存储数据以节省空间（开发中）
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-none border-black bg-gray-100 font-mono text-xs">即将推出</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div>
                    <p className="font-bold text-black uppercase text-sm">数据同步</p>
                    <p className="text-xs text-gray-500 font-medium">
                      在多个设备间同步数据（开发中）
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-none border-black bg-gray-100 font-mono text-xs">即将推出</Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">关于本地数据库</h3>
            </div>
            <div className="p-6 space-y-3 text-sm text-gray-600 font-mono font-medium">
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
              <p className="pt-2 border-t-2 border-black border-dashed mt-4">
                <strong className="text-black uppercase">建议：</strong>定期导出数据备份，以防意外数据丢失。
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
