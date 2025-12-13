/**
 * Dashboard Page
 * Cyberpunk Terminal Aesthetic
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Activity, AlertTriangle, Clock, Code,
  FileText, GitBranch, Shield, TrendingUp, Zap,
  BarChart3, Target, ArrowUpRight, Calendar,
  MessageSquare, Bot, Cpu, Terminal
} from "lucide-react";
import { api, dbMode, isDemoMode } from "@/shared/config/database";
import type { Project, AuditTask, ProjectStats } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getRuleSets } from "@/shared/api/rules";
import { getPromptTemplates } from "@/shared/api/prompts";

export default function Dashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueTypeData, setIssueTypeData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [qualityTrendData, setQualityTrendData] = useState<Array<{ date: string; score: number }>>([]);
  const [ruleStats, setRuleStats] = useState({ total: 0, enabled: 0 });
  const [templateStats, setTemplateStats] = useState({ total: 0, active: 0 });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const results = await Promise.allSettled([
        api.getProjectStats(),
        api.getProjects(),
        api.getAuditTasks()
      ]);

      if (results[0].status === 'fulfilled') {
        setStats(results[0].value);
      } else {
        setStats({
          total_projects: 0,
          active_projects: 0,
          total_tasks: 0,
          completed_tasks: 0,
          total_issues: 0,
          resolved_issues: 0,
          avg_quality_score: 0
        });
      }

      if (results[1].status === 'fulfilled') {
        setRecentProjects(Array.isArray(results[1].value) ? results[1].value.slice(0, 6) : []);
      } else {
        setRecentProjects([]);
      }

      let tasks: AuditTask[] = [];
      if (results[2].status === 'fulfilled') {
        tasks = Array.isArray(results[2].value) ? results[2].value : [];
        setRecentTasks(tasks.slice(0, 10));
      } else {
        setRecentTasks([]);
      }

      if (tasks.length > 0) {
        const tasksByDate = tasks
          .filter(t => t.completed_at && t.quality_score > 0)
          .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
          .slice(-6);

        const trendData = tasksByDate.map((task) => ({
          date: new Date(task.completed_at!).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          score: task.quality_score
        }));

        setQualityTrendData(trendData.length > 0 ? trendData : []);
      } else {
        setQualityTrendData([]);
      }

      try {
        const allIssues = await Promise.all(
          tasks.map(task => api.getAuditIssues(task.id).catch(() => []))
        );
        const flatIssues = allIssues.flat();

        if (flatIssues.length > 0) {
          const typeCount: Record<string, number> = {};
          flatIssues.forEach(issue => {
            typeCount[issue.issue_type] = (typeCount[issue.issue_type] || 0) + 1;
          });

          const typeMap: Record<string, { name: string; color: string }> = {
            security: { name: '安全问题', color: '#f43f5e' },
            bug: { name: '潜在Bug', color: '#f97316' },
            performance: { name: '性能问题', color: '#eab308' },
            style: { name: '代码风格', color: '#3b82f6' },
            maintainability: { name: '可维护性', color: '#8b5cf6' }
          };

          const issueData = Object.entries(typeCount).map(([type, count]) => ({
            name: typeMap[type]?.name || type,
            value: count,
            color: typeMap[type]?.color || '#6b7280'
          }));

          setIssueTypeData(issueData);
        } else {
          setIssueTypeData([]);
        }
      } catch (error) {
        setIssueTypeData([]);
      }

      try {
        const [rulesRes, promptsRes] = await Promise.all([
          getRuleSets(),
          getPromptTemplates(),
        ]);
        const totalRules = rulesRes.items.reduce((acc, rs) => acc + rs.rules_count, 0);
        const enabledRules = rulesRes.items.reduce((acc, rs) => acc + rs.enabled_rules_count, 0);
        setRuleStats({ total: totalRules, enabled: enabledRules });
        setTemplateStats({
          total: promptsRes.items.length,
          active: promptsRes.items.filter(t => t.is_active).length
        });
      } catch (error) {
        console.error('获取规则和模板统计失败:', error);
      }
    } catch (error) {
      console.error('仪表盘数据加载失败:', error);
      toast.error("数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="cyber-badge-success">完成</Badge>;
      case 'running':
        return <Badge className="cyber-badge-info">运行中</Badge>;
      case 'failed':
        return <Badge className="cyber-badge-danger">失败</Badge>;
      default:
        return <Badge className="cyber-badge-muted">待处理</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-[#0a0a0f] min-h-screen font-mono relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* Demo Mode Warning */}
      {isDemoMode && (
        <div className="relative z-10 cyber-card p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="text-sm text-gray-300">
              当前使用<span className="text-amber-400 font-bold">演示模式</span>，显示的是模拟数据。
              <Link to="/admin" className="ml-2 text-primary font-bold hover:underline">
                前往配置 →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {/* Total Projects */}
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">总项目数</p>
              <p className="stat-value">{stats?.total_projects || 0}</p>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                活跃: {stats?.active_projects || 0}
              </p>
            </div>
            <div className="stat-icon text-primary">
              <Code className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Audit Tasks */}
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">审计任务</p>
              <p className="stat-value">{stats?.total_tasks || 0}</p>
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                已完成: {stats?.completed_tasks || 0}
              </p>
            </div>
            <div className="stat-icon text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Issues Found */}
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">发现问题</p>
              <p className="stat-value">{stats?.total_issues || 0}</p>
              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                已解决: {stats?.resolved_issues || 0}
              </p>
            </div>
            <div className="stat-icon text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Quality Score */}
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">平均质量分</p>
              <p className="stat-value">
                {stats?.avg_quality_score ? stats.avg_quality_score.toFixed(1) : '0.0'}
              </p>
              {stats?.avg_quality_score ? (
                <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  持续改进
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">暂无数据</p>
              )}
            </div>
            <div className="stat-icon text-violet-400">
              <Target className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 relative z-10">
        {/* Left Content */}
        <div className="xl:col-span-3 space-y-4">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Quality Trend */}
            <div className="cyber-card p-4">
              <div className="section-header">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="section-title">代码质量趋势</h3>
              </div>
              {qualityTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={qualityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tick={{ fontFamily: 'monospace' }} />
                    <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} tick={{ fontFamily: 'monospace' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0c0c12',
                        border: '1px solid #2a2a35',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#FF6B2C"
                      strokeWidth={2}
                      dot={{ fill: '#FF6B2C', stroke: '#0c0c12', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#FF6B2C' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state h-[220px]">
                  <TrendingUp className="empty-state-icon" />
                  <p className="empty-state-description">暂无质量趋势数据</p>
                </div>
              )}
            </div>

            {/* Issue Distribution */}
            <div className="cyber-card p-4">
              <div className="section-header">
                <BarChart3 className="w-5 h-5 text-violet-400" />
                <h3 className="section-title">问题类型分布</h3>
              </div>
              {issueTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={issueTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={70}
                      dataKey="value"
                      stroke="#0c0c12"
                      strokeWidth={2}
                    >
                      {issueTypeData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0c0c12',
                        border: '1px solid #2a2a35',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state h-[220px]">
                  <BarChart3 className="empty-state-icon" />
                  <p className="empty-state-description">暂无问题分布数据</p>
                </div>
              )}
            </div>
          </div>

          {/* Projects Overview */}
          <div className="cyber-card p-4">
            <div className="section-header">
              <FileText className="w-5 h-5 text-primary" />
              <h3 className="section-title">项目概览</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="block p-4 bg-gray-900/50 border border-gray-800/50 rounded-lg hover:bg-gray-800/50 hover:border-gray-700 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-200 group-hover:text-primary transition-colors truncate">
                        {project.name}
                      </h4>
                      <Badge className={`ml-2 flex-shrink-0 ${project.is_active ? 'cyber-badge-success' : 'cyber-badge-muted'}`}>
                        {project.is_active ? '活跃' : '暂停'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {project.description || '暂无描述'}
                    </p>
                    <div className="flex items-center text-xs text-gray-600">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(project.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full empty-state">
                  <Code className="empty-state-icon" />
                  <p className="empty-state-title">暂无项目</p>
                  <p className="empty-state-description">创建您的第一个项目开始审计</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Tasks */}
          <div className="cyber-card p-4">
            <div className="section-header">
              <Clock className="w-5 h-5 text-emerald-400" />
              <h3 className="section-title">最近任务</h3>
              <Link to="/audit-tasks" className="ml-auto">
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  查看全部 <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {recentTasks.length > 0 ? (
                recentTasks.slice(0, 6).map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="flex items-center justify-between p-3 bg-gray-900/30 rounded-lg hover:bg-gray-800/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        task.status === 'running' ? 'bg-sky-500/20 text-sky-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {task.status === 'completed' ? <Activity className="w-4 h-4" /> :
                         task.status === 'running' ? <Clock className="w-4 h-4" /> :
                         <AlertTriangle className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200 group-hover:text-primary transition-colors">
                          {task.project?.name || '未知项目'}
                        </p>
                        <p className="text-xs text-gray-500">
                          质量分: <span className="text-white">{task.quality_score?.toFixed(1) || '0.0'}</span>
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(task.status)}
                  </Link>
                ))
              ) : (
                <div className="empty-state">
                  <Activity className="empty-state-icon" />
                  <p className="empty-state-title">暂无任务</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="xl:col-span-1 space-y-4">
          {/* Quick Actions */}
          <div className="cyber-card p-4">
            <div className="section-header">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="section-title">快速操作</h3>
            </div>
            <div className="space-y-2">
              <Link to="/agent-audit" className="block">
                <Button className="w-full justify-start cyber-btn-primary h-10">
                  <Bot className="w-4 h-4 mr-2" />
                  Agent 智能审计
                </Button>
              </Link>
              <Link to="/instant-analysis" className="block">
                <Button variant="outline" className="w-full justify-start cyber-btn-outline h-10">
                  <Zap className="w-4 h-4 mr-2" />
                  即时代码分析
                </Button>
              </Link>
              <Link to="/projects" className="block">
                <Button variant="outline" className="w-full justify-start cyber-btn-outline h-10">
                  <GitBranch className="w-4 h-4 mr-2" />
                  创建新项目
                </Button>
              </Link>
              <Link to="/audit-tasks" className="block">
                <Button variant="outline" className="w-full justify-start cyber-btn-outline h-10">
                  <Shield className="w-4 h-4 mr-2" />
                  启动审计任务
                </Button>
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="cyber-card p-4">
            <div className="section-header">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <h3 className="section-title">系统状态</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">数据库模式</span>
                <Badge className={`
                  ${dbMode === 'api' ? 'cyber-badge-primary' :
                    dbMode === 'local' ? 'cyber-badge-info' :
                    dbMode === 'supabase' ? 'cyber-badge-success' :
                    'cyber-badge-muted'}
                `}>
                  {dbMode === 'api' ? '后端' : dbMode === 'local' ? '本地' : dbMode === 'supabase' ? '云端' : '演示'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">活跃项目</span>
                <span className="text-sm font-bold text-white">{stats?.active_projects || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">运行中任务</span>
                <span className="text-sm font-bold text-sky-400">
                  {recentTasks.filter(t => t.status === 'running').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">待解决问题</span>
                <span className="text-sm font-bold text-amber-400">
                  {stats ? stats.total_issues - stats.resolved_issues : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  审计规则
                </span>
                <span className="text-sm font-bold text-violet-400">
                  {ruleStats.enabled}/{ruleStats.total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  提示词模板
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {templateStats.active}/{templateStats.total}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="cyber-card p-4">
            <div className="section-header">
              <Terminal className="w-5 h-5 text-amber-400" />
              <h3 className="section-title">最新活动</h3>
            </div>
            <div className="space-y-2">
              {recentTasks.length > 0 ? (
                recentTasks.slice(0, 3).map((task) => {
                  const timeAgo = (() => {
                    const now = new Date();
                    const taskDate = new Date(task.created_at);
                    const diffMs = now.getTime() - taskDate.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 60) return `${diffMins}分钟前`;
                    if (diffHours < 24) return `${diffHours}小时前`;
                    return `${diffDays}天前`;
                  })();

                  const statusText =
                    task.status === 'completed' ? '任务完成' :
                    task.status === 'running' ? '任务运行中' :
                    task.status === 'failed' ? '任务失败' : '任务待处理';

                  return (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className={`block p-3 rounded-lg border transition-all hover:border-gray-700 ${
                        task.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/20' :
                        task.status === 'running' ? 'bg-sky-500/5 border-sky-500/20' :
                        task.status === 'failed' ? 'bg-rose-500/5 border-rose-500/20' :
                        'bg-gray-800/30 border-gray-800/50'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-200">{statusText}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        项目 "{task.project?.name || '未知项目'}"
                        {task.status === 'completed' && task.issues_count > 0 &&
                          ` - 发现 ${task.issues_count} 个问题`
                        }
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1">{timeAgo}</p>
                    </Link>
                  );
                })
              ) : (
                <div className="empty-state py-6">
                  <Clock className="w-8 h-8 text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500">暂无活动记录</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
