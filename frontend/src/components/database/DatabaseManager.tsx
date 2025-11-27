/**
 * 数据库管理组件
 * 提供数据库的导出、导入、清空、统计和健康检查等功能
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Server,
  Activity,
  RefreshCw,
  Database,
  FileText,
  AlertTriangle,
  Info
} from 'lucide-react';
import { dbMode } from '@/shared/config/database';
import { api } from '@/shared/api/database';
import { toast } from 'sonner';

export function DatabaseManager() {
  const [loading, setLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [health, setHealth] = useState<{
    status: 'healthy' | 'warning' | 'error';
    database_connected: boolean;
    total_records: number;
    last_backup_date: string | null;
    issues: string[];
    warnings: string[];
  } | null>(null);
  const [stats, setStats] = useState<{
    total_projects: number;
    active_projects: number;
    total_tasks: number;
    completed_tasks: number;
    pending_tasks: number;
    running_tasks: number;
    failed_tasks: number;
    total_issues: number;
    open_issues: number;
    resolved_issues: number;
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
    total_analyses: number;
    total_members: number;
    has_config: boolean;
  } | null>(null);

  // 加载健康检查和统计信息
  useEffect(() => {
    loadHealth();
    loadStats();
  }, []);

  const loadHealth = async () => {
    try {
      setHealthLoading(true);
      const healthData = await api.checkDatabaseHealth();
      setHealth(healthData);
    } catch (error) {
      console.error('加载健康检查失败:', error);
    } finally {
      setHealthLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const statsData = await api.getDatabaseStats();
      setStats(statsData);
    } catch (error) {
      console.error('加载统计信息失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 导出数据
  const handleExport = async () => {
    try {
      setLoading(true);
      setMessage(null);

      const exportData = await api.exportDatabase();

      // 构建完整的导出数据
      const fullData = {
        version: "1.0.0",
        export_date: exportData.export_date,
        data: exportData.data
      };

      const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xcodereviewer-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('数据导出成功！');
      setMessage({ type: 'success', text: '数据导出成功！' });

      // 刷新统计信息
      loadStats();
    } catch (error: any) {
      console.error('导出失败:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '数据导出失败，请重试';
      toast.error(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  // 导入数据
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.name.endsWith('.json')) {
      toast.error('请选择 JSON 格式的文件');
      event.target.value = '';
      return;
    }

    // 验证文件大小（最大 50MB）
    if (file.size > 50 * 1024 * 1024) {
      toast.error('文件大小不能超过 50MB');
      event.target.value = '';
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const result = await api.importDatabase(file);

      const imported = result.imported;
      const summary = [
        imported.projects > 0 && `${imported.projects} 个项目`,
        imported.tasks > 0 && `${imported.tasks} 个任务`,
        imported.issues > 0 && `${imported.issues} 个问题`,
        imported.analyses > 0 && `${imported.analyses} 条分析记录`,
        imported.config > 0 && '用户配置',
      ].filter(Boolean).join('、');

      toast.success(`数据导入成功！已导入：${summary}`);
      setMessage({ type: 'success', text: `数据导入成功！已导入：${summary}` });

      // 清空文件输入
      event.target.value = '';

      // 刷新统计信息和健康检查
      loadStats();
      loadHealth();

      // 延迟刷新页面
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('导入失败:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '数据导入失败，请检查文件格式';
      toast.error(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      // 清空文件输入
      event.target.value = '';
    } finally {
      setLoading(false);
    }
  };

  // 清空数据
  const handleClear = async () => {
    if (!window.confirm('⚠️ 警告：确定要清空所有数据吗？\n\n此操作将删除：\n- 所有项目\n- 所有任务\n- 所有问题\n- 所有分析记录\n- 用户配置\n\n此操作不可恢复！')) {
      return;
    }

    // 二次确认
    if (!window.confirm('请再次确认：您真的要清空所有数据吗？')) {
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const result = await api.clearDatabase();

      const deleted = result.deleted;
      const summary = [
        deleted.projects > 0 && `${deleted.projects} 个项目`,
        deleted.tasks > 0 && `${deleted.tasks} 个任务`,
        deleted.issues > 0 && `${deleted.issues} 个问题`,
        deleted.analyses > 0 && `${deleted.analyses} 条分析记录`,
        deleted.config > 0 && '用户配置',
      ].filter(Boolean).join('、');

      toast.success(`数据已清空！已删除：${summary}`);
      setMessage({ type: 'success', text: `数据已清空！已删除：${summary}` });

      // 刷新统计信息和健康检查
      loadStats();
      loadHealth();

      // 延迟刷新页面
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error('清空失败:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || '清空数据失败，请重试';
      toast.error(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return '健康';
      case 'warning':
        return '警告';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  return (
    <div className="space-y-6">
      {/* 健康检查 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <CardTitle>数据库健康检查</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHealth}
              disabled={healthLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
          <CardDescription>
            检查数据库连接状态和数据完整性
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : health ? (
            <>
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${getHealthStatusColor(health.status)}`}>
                {health.status === 'healthy' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : health.status === 'warning' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">状态：</span>
                    <Badge variant={health.status === 'healthy' ? 'default' : health.status === 'warning' ? 'secondary' : 'destructive'}>
                      {getHealthStatusText(health.status)}
                    </Badge>
                  </div>
                  <div className="text-sm mt-1">
                    数据库连接：{health.database_connected ? '正常' : '异常'} |
                    总记录数：{health.total_records.toLocaleString()}
                  </div>
                </div>
              </div>

              {health.issues.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">发现的问题：</div>
                    <ul className="list-disc list-inside space-y-1">
                      {health.issues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {health.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">警告信息：</div>
                    <ul className="list-disc list-inside space-y-1">
                      {health.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>无法加载健康检查信息</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>数据统计</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStats}
              disabled={statsLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
          <CardDescription>
            查看数据库中的数据统计信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">项目</div>
                <div className="text-2xl font-bold">{stats.total_projects}</div>
                <div className="text-xs text-muted-foreground">活跃: {stats.active_projects}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">任务</div>
                <div className="text-2xl font-bold">{stats.total_tasks}</div>
                <div className="text-xs text-muted-foreground">
                  完成: {stats.completed_tasks} | 进行中: {stats.running_tasks}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">问题</div>
                <div className="text-2xl font-bold">{stats.total_issues}</div>
                <div className="text-xs text-muted-foreground">
                  未解决: {stats.open_issues} | 已解决: {stats.resolved_issues}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">分析记录</div>
                <div className="text-2xl font-bold">{stats.total_analyses}</div>
                <div className="text-xs text-muted-foreground">即时分析</div>
              </div>
            </div>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>无法加载统计信息</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 数据操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            数据操作
          </CardTitle>
          <CardDescription>
            管理您的数据，包括导出、导入和清空。数据存储在后端 PostgreSQL 数据库中。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Download className="h-4 w-4" />
                导出数据
              </h4>
              <p className="text-sm text-muted-foreground">
                将数据导出为 JSON 文件，用于备份或迁移
              </p>
              <Button
                onClick={handleExport}
                disabled={loading}
                className="w-full"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                导出数据
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                导入数据
              </h4>
              <p className="text-sm text-muted-foreground">
                从 JSON 文件恢复数据（最大 50MB）
              </p>
              <Button
                onClick={() => document.getElementById('import-file')?.click()}
                disabled={loading}
                className="w-full"
                variant="outline"
              >
                <Upload className="mr-2 h-4 w-4" />
                导入数据
              </Button>
              <input
                id="import-file"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                清空数据
              </h4>
              <p className="text-sm text-muted-foreground">
                删除所有数据（不可恢复）
              </p>
              <Button
                onClick={handleClear}
                disabled={loading}
                className="w-full"
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                清空数据
              </Button>
            </div>
          </div>

          <Separator />

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>提示：</strong>
              {dbMode === 'api'
                ? '数据存储在后端 PostgreSQL 数据库中，支持多用户、多设备同步。建议定期导出备份。'
                : '建议定期导出数据备份，以防意外数据丢失。'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
