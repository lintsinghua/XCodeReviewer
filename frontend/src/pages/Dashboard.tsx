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
  BarChart3, Target, ArrowUpRight, Calendar, Terminal
} from "lucide-react";
import { api, dbMode, isDemoMode } from "@/shared/config/database";
import type { Project, AuditTask, ProjectStats } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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

        const trendData = tasksByDate.map((task) => ({
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
            security: { name: '安全问题', color: '#dc2626' },
            bug: { name: '潜在Bug', color: '#7f1d1d' },
            performance: { name: '性能问题', color: '#b91c1c' },
            style: { name: '代码风格', color: '#991b1b' },
            maintainability: { name: '可维护性', color: '#450a0a' }
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
      <div className="flex items-center justify-center min-h-[60vh] font-mono">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-none"></div>
            <div className="absolute inset-0 border-4 border-primary rounded-none border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600 uppercase font-bold">加载仪表盘数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Header Section */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b-4 border-black pb-6 bg-white/50 backdrop-blur-sm p-4 retro-border">
        <div>
          <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-2">
            系统<span className="text-primary">_仪表盘</span>
          </h1>
          <p className="text-gray-500 font-mono text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            // 监控状态 // 代码质量概览
            {isDemoMode && <Badge variant="outline" className="ml-2 border-black bg-yellow-100 text-yellow-800 rounded-none">演示模式</Badge>}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/instant-analysis">
            <Button className="retro-btn h-12">
              <Zap className="w-4 h-4 mr-2" />
              即时分析
            </Button>
          </Link>
          <Link to="/projects">
            <Button variant="outline" className="retro-btn bg-white text-black hover:bg-gray-100 h-12">
              <GitBranch className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </Link>
        </div>
      </div>

      {/* 数据库模式提示 */}
      {isDemoMode && (
        <div className="relative z-10 bg-yellow-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3">
          <Info className="h-5 w-5 text-black mt-0.5" />
          <div className="text-sm font-mono text-black">
            当前使用<strong>演示模式</strong>，显示的是模拟数据。
            配置数据库后将显示真实数据。
            <Link to="/admin" className="ml-2 text-primary font-bold hover:underline uppercase">
              前往数据库管理 &gt;
            </Link>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase text-gray-500">总项目数</p>
              <p className="font-display text-3xl font-bold">{stats?.total_projects || 0}</p>
              <p className="text-xs font-mono mt-1 border-l-2 border-primary pl-2">活跃: {stats?.active_projects || 0}</p>
            </div>
            <div className="w-12 h-12 border-2 border-black bg-primary flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Code className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase text-gray-500">审计任务</p>
              <p className="font-display text-3xl font-bold">{stats?.total_tasks || 0}</p>
              <p className="text-xs font-mono mt-1 border-l-2 border-green-500 pl-2">已完成: {stats?.completed_tasks || 0}</p>
            </div>
            <div className="w-12 h-12 border-2 border-black bg-green-500 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase text-gray-500">发现问题</p>
              <p className="font-display text-3xl font-bold">{stats?.total_issues || 0}</p>
              <p className="text-xs font-mono mt-1 border-l-2 border-orange-500 pl-2">已解决: {stats?.resolved_issues || 0}</p>
            </div>
            <div className="w-12 h-12 border-2 border-black bg-orange-500 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase text-gray-500">平均质量分</p>
              <p className="font-display text-3xl font-bold">
                {stats?.avg_quality_score ? stats.avg_quality_score.toFixed(1) : '0.0'}
              </p>
              {stats?.avg_quality_score ? (
                <div className="flex items-center text-xs font-mono font-bold text-emerald-600 mt-1">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span>持续改进</span>
                </div>
              ) : (
                <p className="text-xs font-mono text-gray-500 mt-1">暂无数据</p>
              )}
            </div>
            <div className="w-12 h-12 border-2 border-black bg-purple-500 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Target className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 重新设计为更紧凑的布局 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* 左侧主要内容区 */}
        <div className="xl:col-span-3 space-y-4">
          {/* 图表区域 - 使用更紧凑的网格布局 */}
          {/* 图表区域 - 使用更紧凑的网格布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 质量趋势图 */}
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
              <div className="pb-3 border-b-2 border-black mb-4">
                <h3 className="flex items-center text-lg font-display font-bold uppercase">
                  <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                  代码质量趋势
                </h3>
              </div>
              <div>
                {qualityTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={qualityTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#000" fontSize={12} tick={{ fontFamily: 'Space Mono' }} />
                      <YAxis stroke="#000" fontSize={12} domain={[0, 100]} tick={{ fontFamily: 'Space Mono' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '2px solid #000',
                          borderRadius: '0px',
                          boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                          fontFamily: 'Space Mono'
                        }}
                      />
                      <Line
                        type="step"
                        dataKey="score"
                        stroke="#000"
                        strokeWidth={3}
                        dot={{ fill: '#fff', stroke: '#000', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#000' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400 border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-mono uppercase">暂无质量趋势数据</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 问题分布图 */}
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
              <div className="pb-3 border-b-2 border-black mb-4">
                <h3 className="flex items-center text-lg font-display font-bold uppercase">
                  <BarChart3 className="w-5 h-5 mr-2 text-black" />
                  问题类型分布
                </h3>
              </div>
              <div>
                {issueTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={issueTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="#000"
                        strokeWidth={2}
                      >
                        {issueTypeData.map((entry) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '2px solid #000',
                          borderRadius: '0px',
                          boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                          fontFamily: 'Space Mono'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-gray-400 border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-mono uppercase">暂无问题分布数据</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 项目概览 */}
          {/* 项目概览 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
            <div className="pb-3 border-b-2 border-black mb-4">
              <h3 className="flex items-center text-lg font-display font-bold uppercase">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                项目概览
              </h3>
            </div>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentProjects.length > 0 ? (
                  recentProjects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}`}
                      className="block p-4 border-2 border-black bg-gray-50 hover:bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-mono font-bold text-black group-hover:text-primary transition-colors truncate uppercase">
                          {project.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`ml-2 flex-shrink-0 border-black rounded-none ${project.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {project.is_active ? '活跃' : '暂停'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 font-mono line-clamp-2 mb-3 border-l-2 border-gray-300 pl-2">
                        {project.description || '暂无描述'}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 font-mono">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-gray-500 border-2 border-dashed border-black">
                    <Code className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-mono uppercase">暂无项目</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 最近任务 */}
          {/* 最近任务 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
            <div className="pb-3 border-b-2 border-black mb-4 flex items-center justify-between">
              <h3 className="flex items-center text-lg font-display font-bold uppercase">
                <Clock className="w-5 h-5 mr-2 text-green-600" />
                最近任务
              </h3>
              <Link to="/audit-tasks">
                <Button variant="ghost" size="sm" className="hover:bg-green-50 hover:text-green-700 font-mono uppercase text-xs">
                  查看全部
                  <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div>
              <div className="space-y-3">
                {recentTasks.length > 0 ? (
                  recentTasks.slice(0, 6).map((task) => (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className="flex items-center justify-between p-3 border-2 border-transparent hover:border-black hover:bg-gray-50 transition-all group"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${task.status === 'completed' ? 'bg-green-100 text-green-600' :
                          task.status === 'running' ? 'bg-blue-100 text-blue-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                          {task.status === 'completed' ? <Activity className="w-4 h-4" /> :
                            task.status === 'running' ? <Clock className="w-4 h-4" /> :
                              <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-mono font-bold text-sm text-black group-hover:text-primary transition-colors uppercase">
                            {task.project?.name || '未知项目'}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            质量分: <span className="font-bold text-black">{task.quality_score?.toFixed(1) || '0.0'}</span>
                          </p>
                        </div>
                      </div>
                      <Badge className={`rounded-none border-black border ${getStatusColor(task.status)}`}>
                        {task.status === 'completed' ? '完成' :
                          task.status === 'running' ? '运行中' : '失败'}
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed border-black">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-mono uppercase">暂无任务</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧边栏 - 紧凑设计 */}
        <div className="xl:col-span-1 space-y-4">
          {/* 快速操作 */}
          {/* 快速操作 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
            <div className="pb-3 border-b-2 border-black mb-4">
              <h3 className="flex items-center text-lg font-display font-bold uppercase">
                <Zap className="w-5 h-5 mr-2 text-primary" />
                快速操作
              </h3>
            </div>
            <div className="space-y-3">
              <Link to="/instant-analysis" className="block">
                <Button className="w-full justify-start retro-btn h-10">
                  <Zap className="w-4 h-4 mr-2" />
                  即时代码分析
                </Button>
              </Link>
              <Link to="/projects" className="block">
                <Button variant="outline" className="w-full justify-start retro-btn bg-white text-black hover:bg-gray-100 h-10">
                  <GitBranch className="w-4 h-4 mr-2" />
                  创建新项目
                </Button>
              </Link>
              <Link to="/audit-tasks" className="block">
                <Button variant="outline" className="w-full justify-start retro-btn bg-white text-black hover:bg-gray-100 h-10">
                  <Shield className="w-4 h-4 mr-2" />
                  启动审计任务
                </Button>
              </Link>
            </div>
          </div>

          {/* 系统状态 */}
          {/* 系统状态 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
            <div className="pb-3 border-b-2 border-black mb-4">
              <h3 className="flex items-center text-lg font-display font-bold uppercase">
                <Activity className="w-5 h-5 mr-2 text-green-600" />
                系统状态
              </h3>
            </div>
            <div className="space-y-4 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 uppercase">数据库模式</span>
                <Badge className={`rounded-none border border-black ${dbMode === 'api' ? 'bg-purple-100 text-purple-700' :
                  dbMode === 'local' ? 'bg-blue-100 text-blue-700' :
                    dbMode === 'supabase' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                  }`}>
                  {dbMode === 'api' ? '后端' : dbMode === 'local' ? '本地' : dbMode === 'supabase' ? '云端' : '演示'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 uppercase">活跃项目</span>
                <span className="text-sm font-bold text-black border-2 border-black px-2 bg-yellow-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {stats?.active_projects || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 uppercase">运行中任务</span>
                <span className="text-sm font-bold text-black border-2 border-black px-2 bg-blue-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {recentTasks.filter(t => t.status === 'running').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 uppercase">待解决问题</span>
                <span className="text-sm font-bold text-black border-2 border-black px-2 bg-red-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {stats ? stats.total_issues - stats.resolved_issues : 0}
                </span>
              </div>
            </div>
          </div>

          {/* 最新活动 */}
          {/* 最新活动 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
            <div className="pb-3 border-b-2 border-black mb-4">
              <h3 className="flex items-center text-lg font-display font-bold uppercase">
                <Clock className="w-5 h-5 mr-2 text-orange-600" />
                最新活动
              </h3>
            </div>
            <div className="space-y-3">
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
                    task.status === 'completed' ? 'bg-green-50 border-black' :
                      task.status === 'running' ? 'bg-blue-50 border-black' :
                        task.status === 'failed' ? 'bg-red-50 border-black' :
                          'bg-gray-50 border-black';

                  const statusText =
                    task.status === 'completed' ? '任务完成' :
                      task.status === 'running' ? '任务运行中' :
                        task.status === 'failed' ? '任务失败' :
                          '任务待处理';

                  return (
                    <Link
                      key={task.id}
                      to={`/tasks/${task.id}`}
                      className={`block p-3 border-2 ${bgColor} hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all`}
                    >
                      <p className="text-sm font-bold font-mono uppercase text-black">{statusText}</p>
                      <p className="text-xs text-gray-700 mt-1 line-clamp-1 font-mono">
                        项目 "{task.project?.name || '未知项目'}"
                        {task.status === 'completed' && task.issues_count > 0 &&
                          ` - 发现 ${task.issues_count} 个问题`
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">{timeAgo}</p>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-black">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-mono uppercase">暂无活动记录</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
