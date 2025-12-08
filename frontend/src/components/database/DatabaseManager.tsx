/**
 * 数据库管理组件
 * 提供数据库的导出、导入、清空、统计和健康检查等功能
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Activity,
  RefreshCw,
  Database,
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

  const handleExport = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const exportData = await api.exportDatabase();
      const fullData = {
        version: "1.0.0",
        export_date: exportData.export_date,
        data: exportData.data
      };
      const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deepaudit-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('数据导出成功！');
      setMessage({ type: 'success', text: '数据导出成功！' });
      loadStats();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || '数据导出失败，请重试';
      toast.error(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      toast.error('请选择 JSON 格式的文件');
      event.target.value = '';
      return;
    }
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
      event.target.value = '';
      loadStats();
      loadHealth();
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || '数据导入失败，请检查文件格式';
      toast.error(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
      event.target.value = '';
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('⚠️ 警告：确定要清空所有数据吗？\n\n此操作将删除：\n- 所有项目\n- 所有任务\n- 所有问题\n- 所有分析记录\n- 用户配置\n\n此操作不可恢复！')) {
      return;
    }
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
      loadStats();
      loadHealth();
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || '清空数据失败，请重试';
      toast.error(errorMsg);
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const getHealthStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="rounded-none border-black bg-green-100 text-green-800 font-bold uppercase">健康</Badge>;
      case 'warning':
        return <Badge className="rounded-none border-black bg-yellow-100 text-yellow-800 font-bold uppercase">警告</Badge>;
      case 'error':
        return <Badge className="rounded-none border-black bg-red-100 text-red-800 font-bold uppercase">错误</Badge>;
      default:
        return <Badge className="rounded-none border-black bg-gray-100 text-gray-800 font-bold uppercase">未知</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 健康检查 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
        <div className="p-4 border-b-2 border-black bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
              <Activity className="h-5 w-5" />
              数据库健康检查
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-1">检查数据库连接状态和数据完整性</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadHealth}
            disabled={healthLoading}
            className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-8 font-bold uppercase"
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
        <div className="p-6 font-mono">
          {healthLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : health ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {health.status === 'healthy' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : health.status === 'warning' ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase text-sm">状态：</span>
                  {getHealthStatusBadge(health.status)}
                </div>
                <span className="text-sm">
                  数据库连接：{health.database_connected ? '正常' : '异常'} | 总记录数：{health.total_records.toLocaleString()}
                </span>
              </div>

              {health.issues.length > 0 && (
                <div className="bg-red-50 border-2 border-red-500 p-4 shadow-[2px_2px_0px_0px_rgba(239,68,68,1)]">
                  <p className="font-bold text-red-800 uppercase text-sm mb-2">发现的问题：</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                    {health.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {health.warnings.length > 0 && (
                <div className="bg-yellow-50 border-2 border-yellow-500 p-4 shadow-[2px_2px_0px_0px_rgba(234,179,8,1)]">
                  <p className="font-bold text-yellow-800 uppercase text-sm mb-2">警告信息：</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                    {health.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-start gap-3 shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800 font-bold">无法加载健康检查信息</p>
            </div>
          )}
        </div>
      </div>

      {/* 详细统计 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
        <div className="p-4 border-b-2 border-black bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
              <Database className="h-5 w-5" />
              详细数据统计
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-1">查看数据库中的详细统计信息</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={statsLoading}
            className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-8 font-bold uppercase"
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
        <div className="p-6 font-mono">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border-2 border-black bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-gray-600 uppercase font-bold">项目</p>
                <p className="text-2xl font-bold">{stats.total_projects}</p>
                <p className="text-xs text-gray-500">活跃: {stats.active_projects}</p>
              </div>
              <div className="p-4 border-2 border-black bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-gray-600 uppercase font-bold">任务</p>
                <p className="text-2xl font-bold">{stats.total_tasks}</p>
                <p className="text-xs text-gray-500">完成: {stats.completed_tasks} | 进行中: {stats.running_tasks}</p>
              </div>
              <div className="p-4 border-2 border-black bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-gray-600 uppercase font-bold">问题</p>
                <p className="text-2xl font-bold">{stats.total_issues}</p>
                <p className="text-xs text-gray-500">未解决: {stats.open_issues} | 已解决: {stats.resolved_issues}</p>
              </div>
              <div className="p-4 border-2 border-black bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-xs text-gray-600 uppercase font-bold">分析记录</p>
                <p className="text-2xl font-bold">{stats.total_analyses}</p>
                <p className="text-xs text-gray-500">即时分析</p>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-start gap-3 shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800 font-bold">无法加载统计信息</p>
            </div>
          )}
        </div>
      </div>

      {/* 数据操作 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
        <div className="p-4 border-b-2 border-black bg-gray-50">
          <h3 className="text-lg font-display font-bold uppercase">数据操作</h3>
          <p className="text-xs text-gray-500 font-mono mt-1">管理您的数据，包括导出、导入和清空</p>
        </div>
        <div className="p-6 font-mono space-y-6">
          {message && (
            <div className={`p-4 border-2 flex items-start gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
              message.type === 'success' 
                ? 'bg-green-50 border-green-500' 
                : 'bg-red-50 border-red-500'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              )}
              <p className={`text-sm font-bold ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {message.text}
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase flex items-center gap-2">
                <Download className="h-4 w-4" />
                导出数据
              </h4>
              <p className="text-xs text-gray-500">将数据导出为 JSON 文件，用于备份或迁移</p>
              <Button
                onClick={handleExport}
                disabled={loading}
                className="w-full retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <Download className="mr-2 h-4 w-4" />
                导出数据
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase flex items-center gap-2">
                <Upload className="h-4 w-4" />
                导入数据
              </h4>
              <p className="text-xs text-gray-500">从 JSON 文件恢复数据（最大 50MB）</p>
              <Button
                onClick={() => document.getElementById('import-file')?.click()}
                disabled={loading}
                className="w-full retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
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

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase flex items-center gap-2 text-red-600">
                <Trash2 className="h-4 w-4" />
                清空数据
              </h4>
              <p className="text-xs text-gray-500">删除所有数据（不可恢复）</p>
              <Button
                onClick={handleClear}
                disabled={loading}
                className="w-full bg-red-500 hover:bg-red-600 text-white border-2 border-black rounded-none h-10 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                清空数据
              </Button>
            </div>
          </div>

          <div className="pt-6 border-t-2 border-black border-dashed">
            <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-start gap-3 shadow-[2px_2px_0px_0px_rgba(59,130,246,1)]">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">
                <strong className="uppercase">提示：</strong>
                {dbMode === 'api'
                  ? '数据存储在后端 PostgreSQL 数据库中，支持多用户、多设备同步。建议定期导出备份。'
                  : '建议定期导出数据备份，以防意外数据丢失。'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
