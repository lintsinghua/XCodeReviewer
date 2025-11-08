import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import {
  Activity, AlertTriangle, Clock, Code,
  FileText, GitBranch, Shield, TrendingUp, Zap,
  BarChart3, Target, ArrowUpRight, Calendar
} from "lucide-react";
import { api } from "@/shared/services/unified-api";
import { dbMode, isDemoMode } from "@/shared/config/database";
import type { Project, AuditTask, ProjectStats } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueTypeData, setIssueTypeData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [qualityTrendData, setQualityTrendData] = useState<Array<{ date: string; score: number }>>([]);

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

      // 统计数据 - 使用真实数据或空数据
      if (results[0].status === 'fulfilled') {
        setStats(results[0].value);
      } else {
        console.error('获取统计数据失败:', results[0].reason);
        // 使用空数据而不是假数据
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

      // 项目列表 - 使用真实数据
      if (results[1].status === 'fulfilled') {
        setRecentProjects(Array.isArray(results[1].value) ? results[1].value.slice(0, 5) : []);
      } else {
        console.error('获取项目列表失败:', results[1].reason);
        setRecentProjects([]);
      }

      // 任务列表 - 使用真实数据
      let tasks: AuditTask[] = [];
      if (results[2].status === 'fulfilled') {
        tasks = Array.isArray(results[2].value) ? results[2].value : [];
        setRecentTasks(tasks.slice(0, 10));
      } else {
        console.error('获取任务列表失败:', results[2].reason);
        setRecentTasks([]);
      }

      // 基于真实任务数据生成质量趋势
      if (tasks.length > 0) {
        // 按日期分组计算平均质量分
        const tasksByDate = tasks
          .filter(t => t.completed_at && t.quality_score > 0)
          .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
          .slice(-6); // 最近6个任务

        const trendData = tasksByDate.map((task, index) => ({
          date: new Date(task.completed_at!).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
          score: task.quality_score
        }));

        setQualityTrendData(trendData.length > 0 ? trendData : []);
      } else {
        setQualityTrendData([]);
      }

      // 基于真实数据生成问题类型分布
      // 需要获取所有问题数据来统计
      try {
        const allIssuesResponses = await Promise.all(
          tasks.map(task => api.getAuditIssues(task.id).catch(() => ({ items: [], total: 0 })))
        );
        
        // 从响应中提取 items 数组
        const flatIssues = allIssuesResponses.flatMap(response => 
          response && typeof response === 'object' && 'items' in response 
            ? response.items 
            : Array.isArray(response) 
              ? response 
              : []
        );

        if (flatIssues.length > 0) {
          const typeCount: Record<string, number> = {};
          flatIssues.forEach((issue: any) => {
            // 兼容不同的字段名称
            const type = issue.issue_type || issue.category || 'other';
            typeCount[type] = (typeCount[type] || 0) + 1;
          });

          const typeMap: Record<string, { name: string; color: string }> = {
            security: { name: '安全问题', color: '#ef4444' },
            quality: { name: '代码质量', color: '#f59e0b' },
            performance: { name: '性能问题', color: '#10b981' },
            maintainability: { name: '可维护性', color: '#3b82f6' },
            style: { name: '代码风格', color: '#8b5cf6' },
            documentation: { name: '文档问题', color: '#ec4899' },
            bug: { name: '潜在Bug', color: '#dc2626' },
            other: { name: '其他', color: '#6b7280' }
          };

          const issueData = Object.entries(typeCount)
            .map(([type, count]) => ({
              name: typeMap[type]?.name || type,
              value: count,
              color: typeMap[type]?.color || '#6b7280'
            }))
            .sort((a, b) => b.value - a.value); // 按数量降序排序

          setIssueTypeData(issueData);
        } else {
          setIssueTypeData([]);
        }
      } catch (error) {
        console.error('获取问题数据失败:', error);
        setIssueTypeData([]);
      }
    } catch (error) {
      console.error('仪表盘数据加载失败:', error);
      toast.error("数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'running': return 'bg-red-50 text-red-700 border-red-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600">加载仪表盘数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Simplified Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">仪表盘</h1>
          <p className="page-subtitle">
            实时监控项目状态，掌握代码质量动态
            {isDemoMode && <Badge variant="outline" className="ml-2">演示模式</Badge>}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/instant-analysis">
            <Button className="btn-primary">
              <Zap className="w-4 h-4 mr-2" />
              即时分析
            </Button>
          </Link>
          <Link to="/projects">
            <Button variant="outline" className="btn-secondary">
              <GitBranch className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </Link>
        </div>
      </div>

      {/* 数据库模式提示 */}
      {isDemoMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            当前使用<strong>演示模式</strong>，显示的是模拟数据。
            配置数据库后将显示真实数据。
            <Link to="/admin" className="ml-2 text-primary hover:underline">
              前往数据库管理 →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">总项目数</p>
                <p className="stat-value">{stats?.total_projects || 0}</p>
                <p className="text-xs text-gray-500 mt-1">活跃 {stats?.active_projects || 0} 个</p>
              </div>
              <div className="stat-icon from-primary to-accent group-hover:scale-110 transition-transform">
                <Code className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">审计任务</p>
                <p className="stat-value">{stats?.total_tasks || 0}</p>
                <p className="text-xs text-gray-500 mt-1">已完成 {stats?.completed_tasks || 0} 个</p>
              </div>
              <div className="stat-icon from-emerald-500 to-emerald-600 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">发现问题</p>
                <p className="stat-value">{stats?.total_issues || 0}</p>
                <p className="text-xs text-gray-500 mt-1">已解决 {stats?.resolved_issues || 0} 个</p>
              </div>
              <div className="stat-icon from-orange-500 to-orange-600 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">平均质量分</p>
                <p className="stat-value">
                  {stats?.avg_quality_score ? stats.avg_quality_score.toFixed(1) : '0.0'}
                </p>
                {stats?.avg_quality_score ? (
                  <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    <span>持续改进中</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">暂无数据</p>
                )}
              </div>
              <div className="stat-icon from-purple-500 to-purple-600 group-hover:scale-110 transition-transform">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - 重新设计为更紧凑的布局 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* 左侧主要内容区 */}
        <div className="xl:col-span-3 space-y-4">
          {/* 图表区域 - 使用更紧凑的网格布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 质量趋势图 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                  代码质量趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                {qualityTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={qualityTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无质量趋势数据</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 问题分布图 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <BarChart3 className="w-5 h-5 mr-2 text-accent" />
                  问题类型分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {issueTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={issueTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {issueTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无问题分布数据</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 项目概览 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                项目概览
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentProjects.length > 0 ? (
                  recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="block p-4 rounded-lg border border-gray-200 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 group-hover:text-primary transition-colors truncate">
                          {project.name}
                        </h4>
                        <Badge
                          variant={project.is_active ? "default" : "secondary"}
                          className="ml-2 flex-shrink-0"
                        >
                          {project.is_active ? '活跃' : '暂停'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                        {project.description || '暂无描述'}
                      </p>
                      <div className="flex items-center text-xs text-gray-400">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <Code className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无项目</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 最近任务 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-lg">
                  <Clock className="w-5 h-5 mr-2 text-emerald-600" />
                  最近任务
                </CardTitle>
                <Link to="/audit-tasks">
                  <Button variant="ghost" size="sm" className="hover:bg-emerald-50 hover:text-emerald-700">
                    查看全部
                    <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTasks.length > 0 ? (
                  recentTasks.slice(0, 6).map((task) => (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${task.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                          task.status === 'running' ? 'bg-red-50 text-red-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                          {task.status === 'completed' ? <Activity className="w-4 h-4" /> :
                            task.status === 'running' ? <Clock className="w-4 h-4" /> :
                              <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-900 group-hover:text-primary transition-colors">
                            {task.project?.name || '未知项目'}
                          </p>
                          <p className="text-xs text-gray-500">
                            质量分: {task.quality_score?.toFixed(1) || '0.0'}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status === 'completed' ? '完成' :
                          task.status === 'running' ? '运行中' : '失败'}
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无任务</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧边栏 - 紧凑设计 */}
        <div className="xl:col-span-1 space-y-4">
          {/* 快速操作 */}
          <Card className="card-modern bg-gradient-to-br from-red-50/30 via-background to-red-50/20 border border-red-100/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Zap className="w-5 h-5 mr-2 text-indigo-600" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/instant-analysis" className="block">
                <Button className="w-full justify-start btn-primary">
                  <Zap className="w-4 h-4 mr-2" />
                  即时代码分析
                </Button>
              </Link>
              <Link to="/projects" className="block">
                <Button variant="outline" className="w-full justify-start btn-secondary">
                  <GitBranch className="w-4 h-4 mr-2" />
                  创建新项目
                </Button>
              </Link>
              <Link to="/audit-tasks" className="block">
                <Button variant="outline" className="w-full justify-start btn-secondary">
                  <Shield className="w-4 h-4 mr-2" />
                  启动审计任务
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 系统状态 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Activity className="w-5 h-5 mr-2 text-emerald-600" />
                系统状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">数据库模式</span>
                <Badge className={
                  dbMode === 'local' ? 'bg-blue-100 text-blue-700' :
                    dbMode === 'supabase' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                }>
                  {dbMode === 'local' ? '本地' : dbMode === 'supabase' ? '云端' : '演示'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">活跃项目</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats?.active_projects || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">运行中任务</span>
                <span className="text-sm font-medium text-gray-900">
                  {recentTasks.filter(t => t.status === 'running').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">待解决问题</span>
                <span className="text-sm font-medium text-gray-900">
                  {stats ? stats.total_issues - stats.resolved_issues : 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 最新活动 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Clock className="w-5 h-5 mr-2 text-orange-600" />
                最新活动
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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

                  const bgColor =
                    task.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                      task.status === 'running' ? 'bg-blue-50 border-blue-200' :
                        task.status === 'failed' ? 'bg-red-50 border-red-200' :
                          'bg-gray-50 border-gray-200';

                  const textColor =
                    task.status === 'completed' ? 'text-emerald-900' :
                      task.status === 'running' ? 'text-blue-900' :
                        task.status === 'failed' ? 'text-red-900' :
                          'text-gray-900';

                  const descColor =
                    task.status === 'completed' ? 'text-emerald-700' :
                      task.status === 'running' ? 'text-blue-700' :
                        task.status === 'failed' ? 'text-red-700' :
                          'text-gray-700';

                  const timeColor =
                    task.status === 'completed' ? 'text-emerald-600' :
                      task.status === 'running' ? 'text-blue-600' :
                        task.status === 'failed' ? 'text-red-600' :
                          'text-gray-600';

                  const statusText =
                    task.status === 'completed' ? '任务完成' :
                      task.status === 'running' ? '任务运行中' :
                        task.status === 'failed' ? '任务失败' :
                          '任务待处理';

                  return (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className={`block p-3 rounded-lg border ${bgColor} hover:shadow-sm transition-shadow`}
                    >
                      <p className={`text-sm font-medium ${textColor}`}>{statusText}</p>
                      <p className={`text-xs ${descColor} mt-1 line-clamp-1`}>
                        项目 "{task.project?.name || '未知项目'}"
                        {task.status === 'completed' && task.issues_count > 0 &&
                          ` - 发现 ${task.issues_count} 个问题`
                        }
                      </p>
                      <p className={`text-xs ${timeColor} mt-1`}>{timeAgo}</p>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无活动记录</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 使用技巧 */}
          <Card className="card-modern bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Target className="w-5 h-5 mr-2 text-purple-600" />
                使用技巧
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-gray-700">定期运行代码审计可以及早发现潜在问题</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-gray-700">使用即时分析功能快速检查代码片段</p>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-gray-700">关注质量评分趋势，持续改进代码质量</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
