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
import { api } from "@/shared/config/database";
import type { Project, AuditTask, ProjectStats } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Dashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);

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
          total_projects: 5,
          active_projects: 4,
          total_tasks: 8,
          completed_tasks: 6,
          total_issues: 64,
          resolved_issues: 45,
          avg_quality_score: 88.5
        });
      }

      if (results[1].status === 'fulfilled') {
        setRecentProjects(Array.isArray(results[1].value) ? results[1].value.slice(0, 5) : []);
      } else {
        setRecentProjects([]);
      }

      if (results[2].status === 'fulfilled') {
        setRecentTasks(Array.isArray(results[2].value) ? results[2].value.slice(0, 10) : []);
      } else {
        setRecentTasks([]);
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

  const issueTypeData = [
    { name: '安全问题', value: 15, color: '#dc2626' },
    { name: '性能问题', value: 25, color: '#b91c1c' },
    { name: '代码风格', value: 35, color: '#991b1b' },
    { name: '潜在Bug', value: 20, color: '#7f1d1d' },
    { name: '可维护性', value: 5, color: '#450a0a' }
  ];

  const qualityTrendData = [
    { date: '1月', score: 75 },
    { date: '2月', score: 78 },
    { date: '3月', score: 82 },
    { date: '4月', score: 85 },
    { date: '5月', score: 88 },
    { date: '6月', score: 90 }
  ];

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
          <p className="page-subtitle">实时监控项目状态，掌握代码质量动态</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">总项目数</p>
                <p className="stat-value">{stats?.total_projects || 5}</p>
                <p className="text-xs text-gray-500 mt-1">活跃 {stats?.active_projects || 4} 个</p>
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
                <p className="stat-value">{stats?.total_tasks || 8}</p>
                <p className="text-xs text-gray-500 mt-1">已完成 {stats?.completed_tasks || 6} 个</p>
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
                <p className="stat-value">{stats?.total_issues || 64}</p>
                <p className="text-xs text-gray-500 mt-1">已解决 {stats?.resolved_issues || 45} 个</p>
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
                <p className="stat-value">{stats?.avg_quality_score?.toFixed(1) || '88.5'}</p>
                <div className="flex items-center text-xs text-emerald-600 font-medium mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span>+5.2%</span>
                </div>
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
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={qualityTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
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
                <span className="text-sm text-gray-600">服务状态</span>
                <Badge className="bg-emerald-100 text-emerald-700">正常</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">API响应</span>
                <span className="text-sm font-medium text-gray-900">45ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">在线用户</span>
                <span className="text-sm font-medium text-gray-900">1,234</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">今日分析</span>
                <span className="text-sm font-medium text-gray-900">89</span>
              </div>
            </CardContent>
          </Card>

          {/* 最新通知 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
                最新通知
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-900">系统更新</p>
                <p className="text-xs text-red-700 mt-1">新增代码安全检测功能</p>
                <p className="text-xs text-red-600 mt-1">2小时前</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-sm font-medium text-emerald-900">任务完成</p>
                <p className="text-xs text-emerald-700 mt-1">项目 "Web应用" 审计完成</p>
                <p className="text-xs text-emerald-600 mt-1">1天前</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm font-medium text-orange-900">安全警告</p>
                <p className="text-xs text-orange-700 mt-1">发现高危漏洞，请及时处理</p>
                <p className="text-xs text-orange-600 mt-1">2天前</p>
              </div>
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
