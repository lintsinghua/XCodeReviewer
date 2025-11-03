import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Edit, 
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
import { api } from "@/shared/services/unified-api";
import { runRepositoryAudit, scanZipFile } from "@/features/projects/services";
import type { Project, AuditTask, CreateProjectForm } from "@/shared/types";
import { loadZipFile } from "@/shared/utils/zipStorage";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";
import { SUPPORTED_LANGUAGES } from "@/shared/constants";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showTerminalDialog, setShowTerminalDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });

  // 将小写语言名转换为显示格式
  const formatLanguageName = (lang: string): string => {
    const nameMap: Record<string, string> = {
      'javascript': 'JavaScript',
      'typescript': 'TypeScript',
      'python': 'Python',
      'java': 'Java',
      'go': 'Go',
      'rust': 'Rust',
      'cpp': 'C++',
      'csharp': 'C#',
      'php': 'PHP',
      'ruby': 'Ruby',
      'swift': 'Swift',
      'kotlin': 'Kotlin'
    };
    return nameMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const supportedLanguages = SUPPORTED_LANGUAGES.map(formatLanguageName);

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
    
    // 检查是否有仓库地址
    if (project.repository_url) {
      // 有仓库地址，启动仓库审计
      try {
        setScanning(true);
        console.log('开始启动仓库审计任务...');
        const taskId = await runRepositoryAudit({
          projectId: id,
          repoUrl: project.repository_url,
          branch: project.default_branch || 'main',
          githubToken: undefined,
          gitlabToken: undefined,
          createdBy: undefined
        });
        
        console.log('审计任务创建成功，taskId:', taskId);
        
        // 显示终端进度窗口
        setCurrentTaskId(taskId);
        setShowTerminalDialog(true);
        
        // 重新加载项目数据
        loadProjectData();
      } catch (e: any) {
        console.error('启动审计失败:', e);
        toast.error(e?.message || '启动审计失败');
      } finally {
        setScanning(false);
      }
    } else {
      // 没有仓库地址，尝试从IndexedDB加载保存的ZIP文件
      try {
        setScanning(true);
        const file = await loadZipFile(id);
        
        if (file) {
          console.log('找到保存的ZIP文件，开始启动审计...');
          try {
            // 启动ZIP文件审计
            const taskId = await scanZipFile({
              projectId: id,
              zipFile: file,
              excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
              createdBy: 'local-user'
            });
            
            console.log('审计任务创建成功，taskId:', taskId);
            
            // 显示终端进度窗口
            setCurrentTaskId(taskId);
            setShowTerminalDialog(true);
            
            // 重新加载项目数据
            loadProjectData();
          } catch (e: any) {
            console.error('启动审计失败:', e);
            toast.error(e?.message || '启动审计失败');
          } finally {
            setScanning(false);
          }
        } else {
          setScanning(false);
          toast.warning('此项目未配置仓库地址，也未上传ZIP文件。请先在项目设置中配置仓库地址，或通过"新建任务"上传ZIP文件。');
          // 不自动打开对话框，让用户自己选择
        }
      } catch (error) {
        console.error('启动审计失败:', error);
        setScanning(false);
        toast.error('读取ZIP文件失败，请检查项目配置');
      }
    }
  };

  const handleOpenSettings = () => {
    if (!project) return;
    
    // 初始化编辑表单
    setEditForm({
      name: project.name,
      description: project.description || "",
      repository_url: project.repository_url || "",
      repository_type: project.repository_type || "github",
      default_branch: project.default_branch || "main",
      programming_languages: project.programming_languages ? JSON.parse(project.programming_languages) : []
    });
    
    setShowSettingsDialog(true);
  };

  const handleSaveSettings = async () => {
    if (!id) return;
    
    if (!editForm.name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }

    try {
      await api.updateProject(id, editForm);
      toast.success("项目信息已保存");
      setShowSettingsDialog(false);
      loadProjectData();
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error("保存失败");
    }
  };

  const handleToggleLanguage = (lang: string) => {
    const currentLanguages = editForm.programming_languages || [];
    const newLanguages = currentLanguages.includes(lang)
      ? currentLanguages.filter(l => l !== lang)
      : [...currentLanguages, lang];
    
    setEditForm({ ...editForm, programming_languages: newLanguages });
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

  const handleCreateTask = () => {
    setShowCreateTaskDialog(true);
  };

  const handleTaskCreated = () => {
    toast.success("审计任务已创建", {
      description: '因为网络和代码文件大小等因素，审计时长通常至少需要1分钟，请耐心等待...',
      duration: 5000
    });
    loadProjectData(); // 重新加载项目数据以显示新任务
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
          <Button variant="outline" onClick={handleOpenSettings}>
            <Edit className="w-4 h-4 mr-2" />
            编辑
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
            <Button onClick={handleCreateTask}>
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
                        <p className="text-2xl font-bold">{task.issues_count || 0}</p>
                        <p className="text-sm text-muted-foreground">发现问题</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{(task.quality_score || 0).toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">质量评分</p>
                      </div>
                    </div>

                    {task.status === 'completed' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>质量评分</span>
                          <span>{(task.quality_score || 0).toFixed(1)}/100</span>
                        </div>
                        <Progress value={task.quality_score || 0} />
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
                <Button onClick={handleCreateTask}>
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
            <Edit className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">项目编辑</h3>
            <p className="text-sm text-muted-foreground">此功能正在开发中</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* 创建任务对话框 */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        preselectedProjectId={id}
      />

      {/* 终端进度对话框 */}
      <TerminalProgressDialog
        open={showTerminalDialog}
        onOpenChange={setShowTerminalDialog}
        taskId={currentTaskId}
        taskType="repository"
      />

      {/* 项目编辑对话框 */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 基本信息 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">项目名称 *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="输入项目名称"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">项目描述</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="输入项目描述"
                  rows={3}
                />
              </div>
            </div>

            {/* 仓库信息 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">仓库信息</h3>
              
              <div>
                <Label htmlFor="edit-repo-url">仓库地址</Label>
                <Input
                  id="edit-repo-url"
                  value={editForm.repository_url}
                  onChange={(e) => setEditForm({ ...editForm, repository_url: e.target.value })}
                  placeholder="https://github.com/username/repo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-repo-type">仓库类型</Label>
                  <Select
                    value={editForm.repository_type}
                    onValueChange={(value: any) => setEditForm({ ...editForm, repository_type: value })}
                  >
                    <SelectTrigger id="edit-repo-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="gitlab">GitLab</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-branch">默认分支</Label>
                  <Input
                    id="edit-branch"
                    value={editForm.default_branch}
                    onChange={(e) => setEditForm({ ...editForm, default_branch: e.target.value })}
                    placeholder="main"
                  />
                </div>
              </div>
            </div>

            {/* 编程语言 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">编程语言</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {supportedLanguages.map((lang) => (
                  <div
                    key={lang}
                    className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      editForm.programming_languages?.includes(lang)
                        ? 'border-primary bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleLanguage(lang)}
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        editForm.programming_languages?.includes(lang)
                          ? 'bg-primary border-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {editForm.programming_languages?.includes(lang) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{lang}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSettings}>
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}