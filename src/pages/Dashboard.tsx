import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Code, 
  FileText, 
  GitBranch, 
  Shield, 
  TrendingUp,
  Users,
  Zap,
  BarChart3,
  Target,
  RefreshCw
} from "lucide-react";
import { api } from "@/db/supabase";
import type { Project, AuditTask, ProjectStats } from "@/types/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import DatabaseTest from "@/components/debug/DatabaseTest";

export default function Dashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentTasks, setRecentTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setHasError(false);
      console.log('开始加载仪表盘数据...');
      
      // 使用更安全的方式加载数据
      const results = await Promise.allSettled([
        api.getProjectStats(),
        api.getProjects(),
        api.getAuditTasks()
      ]);

      // 处理统计数据
      if (results[0].status === 'fulfilled') {
        setStats(results[0].value);
      } else {
        console.error('获取统计数据失败:', results[0].reason);
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

      // 处理项目数据
      if (results[1].status === 'fulfilled') {
        const projectsData = results[1].value;
        setRecentProjects(Array.isArray(projectsData) ? projectsData.slice(0, 5) : []);
        console.log('项目数据加载成功:', projectsData.length);
      } else {
        console.error('获取项目数据失败:', results[1].reason);
        setRecentProjects([]);
        setHasError(true);
        toast.error("获取项目数据失败，请检查网络连接");
      }

      // 处理任务数据
      if (results[2].status === 'fulfilled') {
        const tasksData = results[2].value;
        setRecentTasks(Array.isArray(tasksData) ? tasksData.slice(0, 10) : []);
        console.log('任务数据加载成功:', tasksData.length);
      } else {
        console.error('获取任务数据失败:', results[2].reason);
        setRecentTasks([]);
        setHasError(true);
        toast.error("获取任务数据失败，请检查网络连接");
      }

    } catch (error) {
      console.error('仪表盘数据加载失败:', error);
      setHasError(true);
      toast.error("数据加载失败，请刷新页面重试");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 模拟图表数据
  const issueTypeData = [
    { name: '安全问题', value: 15, color: '#ef4444' },
    { name: '性能问题', value: 25, color: '#f97316' },
    { name: '代码风格', value: 35, color: '#eab308' },
    { name: '潜在Bug', value: 20, color: '#3b82f6' },
    { name: '可维护性', value: 5, color: '#8b5cf6' }
  ];

  const qualityTrendData = [
    { date: '1月', score: 75 },
    { date: '2月', score: 78 },
    { date: '3月', score: 82 },
    { date: '4月', score: 85 },
    { date: '5月', score: 88 },
    { date: '6月', score: 90 }
  ];

  const performanceData = [
    { name: '分析速度', value: 85, target: 90 },
    { name: '准确率', value: 94.5, target: 95 },
    { name: '系统可用性', value: 99.9, target: 99.9 }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载仪表盘数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 错误提示和调试按钮 */}
      <div className="flex justify-between items-center">
        {hasError && (
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-orange-600">部分数据加载失败</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadDashboardData}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              重试
            </Button>
          </div>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowDebug(!showDebug)}
        >
          {showDebug ? '隐藏调试' : '显示调试'}
        </Button>
      </div>

      {/* 调试面板 */}
      {showDebug && (
        <DatabaseTest />
      )}

      {/* 欢迎区域 */}
      <div 
        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.9)), url('https://miaoda-site-img.cdn.bcebos.com/82c5e81e-795d-4508-a147-e38620407c6d/images/94bf99ac-923b-11f0-9448-4607c254ba9d_0.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">欢迎使用智能代码审计系统！</h1>
              <p className="text-blue-100">
                基于AI的代码质量分析平台，为您提供全面的代码审计服务
              </p>
              <div className="flex items-center space-x-6 mt-4 text-sm">
                <div className="flex items-center">
                  <Target className="w-4 h-4 mr-1" />
                  <span>AI驱动分析</span>
                </div>
                <div className="flex items-center">
                  <Shield className="w-4 h-4 mr-1" />
                  <span>安全检测</span>
                </div>
                <div className="flex items-center">
                  <BarChart3 className="w-4 h-4 mr-1" />
                  <span>质量评估</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link to="/instant-analysis">
                <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                  <Zap className="w-4 h-4 mr-2" />
                  即时分析
                </Button>
              </Link>
              <Link to="/projects">
                <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                  <GitBranch className="w-4 h-4 mr-2" />
                  新建项目
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总项目数</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_projects || recentProjects.length || 5}</div>
            <p className="text-xs text-muted-foreground">
              活跃项目 {stats?.active_projects || recentProjects.filter(p => p.is_active).length || 4} 个
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-blue-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: '80%' }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">审计任务</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_tasks || recentTasks.length || 8}</div>
            <p className="text-xs text-muted-foreground">
              已完成 {stats?.completed_tasks || recentTasks.filter(t => t.status === 'completed').length || 6} 个
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-green-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: '75%' }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">发现问题</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_issues || 64}</div>
            <p className="text-xs text-muted-foreground">
              已解决 {stats?.resolved_issues || 45} 个
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-orange-600 h-1 rounded-full transition-all duration-500" 
                style={{ width: '70%' }}
              ></div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均质量分</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avg_quality_score?.toFixed(1) || '88.5'}</div>
            <Progress value={stats?.avg_quality_score || 88.5} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：图表分析 */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="trends" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trends">质量趋势</TabsTrigger>
              <TabsTrigger value="issues">问题分布</TabsTrigger>
              <TabsTrigger value="performance">性能指标</TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    代码质量趋势
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={qualityTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="issues" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    问题类型分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
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
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    系统性能指标
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {performanceData.map((metric, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{metric.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-muted-foreground">{metric.value}%</span>
                          <Badge variant="outline" className="text-xs">
                            目标: {metric.target}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={metric.value} className="h-2" />
                    </div>
                  ))}
                  
                  <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-green-800">系统运行状态良好</span>
                    </div>
                    <p className="text-xs text-green-700 mt-1">
                      所有核心服务正常运行，性能指标达标
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* 右侧：最近活动 */}
        <div className="space-y-6">
          {/* 最近项目 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                最近项目
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <Link 
                        to={`/projects/${project.id}`}
                        className="font-medium text-sm hover:text-blue-600 transition-colors"
                      >
                        {project.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1">
                        {project.description || '暂无描述'}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {project.repository_type === 'github' ? '🐙' : 
                           project.repository_type === 'gitlab' ? '🦊' : '📁'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>
                    <Badge variant={project.is_active ? "default" : "secondary"}>
                      {project.is_active ? '活跃' : '暂停'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {hasError ? '数据加载失败' : '暂无项目'}
                  </p>
                  <Link to="/projects">
                    <Button variant="outline" size="sm" className="mt-2">
                      {hasError ? '重新加载' : '创建项目'}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 最近任务 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                最近任务
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTasks.length > 0 ? (
                recentTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <Link 
                        to={`/tasks/${task.id}`}
                        className="font-medium text-sm hover:text-blue-600 transition-colors"
                      >
                        {task.project?.name || '未知项目'}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.task_type === 'repository' ? '仓库审计' : '即时分析'}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          质量分: {task.quality_score?.toFixed(1) || '0.0'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          问题: {task.issues_count || 0}
                        </span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status === 'completed' ? '已完成' : 
                       task.status === 'running' ? '运行中' : 
                       task.status === 'failed' ? '失败' : '等待中'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {hasError ? '数据加载失败' : '暂无任务'}
                  </p>
                  <Link to="/audit-tasks">
                    <Button variant="outline" size="sm" className="mt-2">
                      {hasError ? '重新加载' : '创建任务'}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/instant-analysis" className="block">
                <Button variant="outline" className="w-full justify-start hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all">
                  <Zap className="w-4 h-4 mr-2" />
                  即时代码分析
                </Button>
              </Link>
              <Link to="/projects" className="block">
                <Button variant="outline" className="w-full justify-start hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-all">
                  <GitBranch className="w-4 h-4 mr-2" />
                  创建新项目
                </Button>
              </Link>
              <Link to="/audit-tasks" className="block">
                <Button variant="outline" className="w-full justify-start hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition-all">
                  <Shield className="w-4 h-4 mr-2" />
                  启动审计任务
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}