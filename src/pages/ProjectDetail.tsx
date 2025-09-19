import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  GitBranch, 
  Calendar, 
  Users, 
  Settings, 
  ExternalLink,
  Code,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  FileText
} from "lucide-react";
import { api } from "@/db/supabase";
import { runRepositoryAudit } from "@/services/repoScan";
import type { Project, AuditTask, AuditIssue } from "@/types/types";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);

  const loadProjectData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const [projectData, tasksData] = await Promise.all([
        api.getProjectById(id),
        api.getAuditTasks(id)
      ]);
      
      setProject(projectData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Failed to load project data:', error);
      toast.error("加载项目数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = async () => {
    if (!project || !id) return;
    if (!project.repository_url || project.repository_type !== 'github') {
      toast.error('请在项目中配置 GitHub 仓库地址');
      return;
    }
    try {
      setScanning(true);
      await runRepositoryAudit({
        projectId: id,
        repoUrl: project.repository_url,
        branch: project.default_branch || 'main',
        githubToken: undefined,
        createdBy: undefined
      });
      toast.success('已启动仓库审计');
      await loadProjectData();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || '启动审计失败');
    } finally {
      setScanning(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">项目未找到</h2>
          <p className="text-gray-600 mb-4">请检查项目ID是否正确</p>
          <Link to="/projects">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回项目列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-600 mt-1">
              {project.description || '暂无项目描述'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge variant={project.is_active ? "default" : "secondary"}>
            {project.is_active ? '活跃' : '暂停'}
          </Badge>
          <Button onClick={handleRunAudit} disabled={scanning}>
            <Shield className="w-4 h-4 mr-2" />
            {scanning ? '正在启动...' : '启动审计'}
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            设置
          </Button>
        </div>
      </div>

      {/* 项目概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">审计任务</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">已完成</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">发现问题</p>
                <p className="text-2xl font-bold">
                  {tasks.reduce((sum, task) => sum + task.issues_count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Code className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">平均质量分</p>
                <p className="text-2xl font-bold">
                  {tasks.length > 0 
                    ? (tasks.reduce((sum, task) => sum + task.quality_score, 0) / tasks.length).toFixed(1)
                    : '0.0'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">项目概览</TabsTrigger>
          <TabsTrigger value="tasks">审计任务</TabsTrigger>
          <TabsTrigger value="issues">问题管理</TabsTrigger>
          <TabsTrigger value="settings">项目设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 项目信息 */}
            <Card>
              <CardHeader>
                <CardTitle>项目信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {project.repository_url && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">仓库地址</span>
                      <a 
                        href={project.repository_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center"
                      >
                        查看仓库
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">仓库类型</span>
                    <Badge variant="outline">
                      {project.repository_type === 'github' ? 'GitHub' : 
                       project.repository_type === 'gitlab' ? 'GitLab' : '其他'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">默认分支</span>
                    <span className="text-sm text-muted-foreground">{project.default_branch}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">创建时间</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(project.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">所有者</span>
                    <span className="text-sm text-muted-foreground">
                      {project.owner?.full_name || project.owner?.phone || '未知'}
                    </span>
                  </div>
                </div>

                {/* 编程语言 */}
                {project.programming_languages && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">支持的编程语言</h4>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(project.programming_languages).map((lang: string) => (
                        <Badge key={lang} variant="outline">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 最近活动 */}
            <Card>
              <CardHeader>
                <CardTitle>最近活动</CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(task.status)}
                          <div>
                            <p className="text-sm font-medium">
                              {task.task_type === 'repository' ? '仓库审计' : '即时分析'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(task.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status === 'completed' ? '已完成' : 
                           task.status === 'running' ? '运行中' : 
                           task.status === 'failed' ? '失败' : '等待中'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">暂无活动记录</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">审计任务列表</h3>
            <Button>
              <Play className="w-4 h-4 mr-2" />
              新建任务
            </Button>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <h4 className="font-medium">
                            {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            创建于 {formatDate(task.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status === 'completed' ? '已完成' : 
                         task.status === 'running' ? '运行中' : 
                         task.status === 'failed' ? '失败' : '等待中'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.total_files}</p>
                        <p className="text-sm text-muted-foreground">总文件数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.total_lines}</p>
                        <p className="text-sm text-muted-foreground">代码行数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.issues_count}</p>
                        <p className="text-sm text-muted-foreground">发现问题</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{task.quality_score.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">质量评分</p>
                      </div>
                    </div>

                    {task.status === 'completed' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>质量评分</span>
                          <span>{task.quality_score.toFixed(1)}/100</span>
                        </div>
                        <Progress value={task.quality_score} />
                      </div>
                    )}

                    <div className="flex justify-end space-x-2 mt-4">
                      <Link to={`/tasks/${task.id}`}>
                        <Button variant="outline" size="sm">
                          <FileText className="w-4 h-4 mr-2" />
                          查看详情
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">暂无审计任务</h3>
                <p className="text-sm text-muted-foreground mb-4">创建第一个审计任务开始代码质量分析</p>
                <Button>
                  <Play className="w-4 h-4 mr-2" />
                  创建任务
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">问题管理</h3>
            <p className="text-sm text-muted-foreground">此功能正在开发中</p>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="text-center py-12">
            <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">项目设置</h3>
            <p className="text-sm text-muted-foreground">此功能正在开发中</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}