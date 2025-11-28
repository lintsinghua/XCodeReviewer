import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { api } from "@/shared/config/database";
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
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });
  const [activeTab, setActiveTab] = useState("overview");
  const [latestIssues, setLatestIssues] = useState<any[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);

  useEffect(() => {
    if (activeTab === 'issues' && tasks.length > 0) {
      loadLatestIssues();
    }
  }, [activeTab, tasks]);

  const loadLatestIssues = async () => {
    const completedTasks = tasks.filter(t => t.status === 'completed').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (completedTasks.length > 0) {
      setLoadingIssues(true);
      try {
        const issues = await api.getAuditIssues(completedTasks[0].id);
        setLatestIssues(issues);
      } catch (error) {
        console.error('Failed to load issues:', error);
        toast.error("加载问题列表失败");
      } finally {
        setLoadingIssues(false);
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

    setActiveTab("settings");
  };

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

  const handleSaveSettings = async () => {
    if (!id) return;

    if (!editForm.name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }

    try {
      await api.updateProject(id, editForm);
      toast.success("项目信息已保存");
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
      <div className="flex items-center justify-center min-h-screen font-mono">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-gray-200 rounded-none"></div>
            <div className="absolute inset-0 border-4 border-primary rounded-none border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-600 uppercase font-bold">加载项目数据...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen font-mono">
        <div className="text-center border-2 border-black p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-black mb-2 uppercase">项目未找到</h2>
          <p className="text-gray-600 mb-4 uppercase">请检查项目ID是否正确</p>
          <Link to="/projects">
            <Button className="retro-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回项目列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }



  return (
    <div className="flex flex-col gap-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 顶部操作栏 */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/projects">
            <Button variant="outline" size="sm" className="retro-btn bg-white text-black hover:bg-gray-100 h-10 w-10 p-0 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-black uppercase tracking-tighter">{project.name}</h1>
            <Badge variant="outline" className={`rounded-none border-2 border-black ${project.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
              {project.is_active ? '活跃' : '暂停'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button onClick={handleRunAudit} disabled={scanning} className="retro-btn bg-primary text-white hover:bg-primary/90">
            <Shield className="w-4 h-4 mr-2" />
            {scanning ? '正在启动...' : '启动审计'}
          </Button>
          <Button variant="outline" onClick={handleOpenSettings} className="retro-btn bg-white text-black hover:bg-gray-100">
            <Edit className="w-4 h-4 mr-2" />
            编辑
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* ... (stats cards content) ... */}
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">审计任务</p>
              <p className="text-3xl font-display font-bold">{tasks.length}</p>
            </div>
            <div className="w-12 h-12 border-2 border-black bg-blue-500 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">已完成</p>
              <p className="text-3xl font-display font-bold">
                {tasks.filter(t => t.status === 'completed').length}
              </p>
            </div>
            <div className="w-12 h-12 border-2 border-black bg-green-500 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">发现问题</p>
              <p className="text-3xl font-display font-bold">
                {tasks.reduce((sum, task) => sum + task.issues_count, 0)}
              </p>
            </div>
            <div className="w-12 h-12 border-2 border-black bg-orange-500 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">平均质量分</p>
              <p className="text-3xl font-display font-bold">
                {tasks.length > 0
                  ? (tasks.reduce((sum, task) => sum + task.quality_score, 0) / tasks.length).toFixed(1)
                  : '0.0'
                }
              </p>
            </div>
            <div className="w-12 h-12 border-2 border-black bg-purple-500 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Code className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-transparent border-2 border-black p-0 h-auto gap-0">
          <TabsTrigger value="overview" className="rounded-none border-r-2 border-black data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase h-10">项目概览</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-none border-r-2 border-black data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase h-10">审计任务</TabsTrigger>
          <TabsTrigger value="issues" className="rounded-none border-r-2 border-black data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase h-10">问题管理</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase h-10">项目设置</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6 mt-6">
          {/* ... (overview content remains same) ... */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 项目信息 */}
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
              <div className="pb-3 border-b-2 border-black mb-4">
                <h3 className="text-lg font-display font-bold uppercase">项目信息</h3>
              </div>
              <div className="space-y-4 font-mono">
                <div className="space-y-3">
                  {project.repository_url && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-600 uppercase">仓库地址</span>
                      <a
                        href={project.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center font-bold"
                      >
                        查看仓库
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600 uppercase">仓库类型</span>
                    <Badge variant="outline" className="rounded-none border-black bg-gray-100 text-black">
                      {project.repository_type === 'github' ? 'GitHub' :
                        project.repository_type === 'gitlab' ? 'GitLab' : '其他'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600 uppercase">默认分支</span>
                    <span className="text-sm font-bold text-black bg-gray-100 px-2 border border-black">{project.default_branch}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600 uppercase">创建时间</span>
                    <span className="text-sm text-black">
                      {formatDate(project.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-600 uppercase">所有者</span>
                    <span className="text-sm text-black">
                      {project.owner?.full_name || project.owner?.phone || '未知'}
                    </span>
                  </div>
                </div>

                {/* 编程语言 */}
                {project.programming_languages && (
                  <div className="pt-4 border-t-2 border-dashed border-gray-300">
                    <h4 className="text-sm font-bold mb-2 uppercase text-gray-600">支持的编程语言</h4>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(project.programming_languages).map((lang: string) => (
                        <Badge key={lang} variant="outline" className="rounded-none border-black bg-yellow-100 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 最近活动 */}
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
              <div className="pb-3 border-b-2 border-black mb-4">
                <h3 className="text-lg font-display font-bold uppercase">最近活动</h3>
              </div>
              <div>
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.slice(0, 5).map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-3 border-2 border-black bg-gray-50 hover:bg-white hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all">
                        <div className="flex items-center space-x-3">
                          <div className="border-2 border-black p-1 bg-white">
                            {getStatusIcon(task.status)}
                          </div>
                          <div>
                            <p className="text-sm font-bold font-mono uppercase">
                              {task.task_type === 'repository' ? '仓库审计' : '即时分析'}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {formatDate(task.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge className={`rounded-none border-black border ${getStatusColor(task.status)}`}>
                          {task.status === 'completed' ? '已完成' :
                            task.status === 'running' ? '运行中' :
                              task.status === 'failed' ? '失败' : '等待中'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-black">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 font-mono uppercase">暂无活动记录</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="flex flex-col gap-6 mt-6">
          {/* ... (tasks content remains same) ... */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold uppercase">审计任务列表</h3>
            <Button onClick={handleCreateTask} className="retro-btn bg-primary text-white hover:bg-primary/90">
              <Play className="w-4 h-4 mr-2" />
              新建任务
            </Button>
          </div>

          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-dashed border-gray-300">
                    <div className="flex items-center space-x-3">
                      <div className="border-2 border-black p-1 bg-white">
                        {getStatusIcon(task.status)}
                      </div>
                      <div>
                        <h4 className="font-bold font-mono uppercase">
                          {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                        </h4>
                        <p className="text-sm text-gray-500 font-mono">
                          创建于 {formatDate(task.created_at)}
                        </p>
                      </div>
                    </div>
                    <Badge className={`rounded-none border-black border ${getStatusColor(task.status)}`}>
                      {task.status === 'completed' ? '已完成' :
                        task.status === 'running' ? '运行中' :
                          task.status === 'failed' ? '失败' : '等待中'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 font-mono">
                    <div className="text-center p-2 bg-gray-50 border border-gray-200">
                      <p className="text-2xl font-bold">{task.total_files}</p>
                      <p className="text-xs text-gray-500 uppercase">总文件数</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 border border-gray-200">
                      <p className="text-2xl font-bold">{task.total_lines}</p>
                      <p className="text-xs text-gray-500 uppercase">代码行数</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 border border-gray-200">
                      <p className="text-2xl font-bold text-orange-600">{task.issues_count}</p>
                      <p className="text-xs text-gray-500 uppercase">发现问题</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 border border-gray-200">
                      <p className="text-2xl font-bold text-primary">{task.quality_score.toFixed(1)}</p>
                      <p className="text-xs text-gray-500 uppercase">质量评分</p>
                    </div>
                  </div>

                  {task.status === 'completed' && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm font-mono font-bold">
                        <span>质量评分</span>
                        <span>{task.quality_score.toFixed(1)}/100</span>
                      </div>
                      <Progress value={task.quality_score} className="h-3 border-2 border-black rounded-none bg-gray-100 [&>div]:bg-primary" />
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 mt-4 pt-4 border-t-2 border-black">
                    <Link to={`/tasks/${task.id}`}>
                      <Button variant="outline" size="sm" className="retro-btn bg-white text-black hover:bg-gray-100">
                        <FileText className="w-4 h-4 mr-2" />
                        查看详情
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-12 flex flex-col items-center justify-center">
              <Activity className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-bold text-gray-600 mb-2 uppercase">暂无审计任务</h3>
              <p className="text-sm text-gray-500 mb-6 font-mono">创建第一个审计任务开始代码质量分析</p>
              <Button onClick={handleCreateTask} className="retro-btn bg-primary text-white hover:bg-primary/90">
                <Play className="w-4 h-4 mr-2" />
                创建任务
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues" className="flex flex-col gap-6 mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-display font-bold uppercase">最新发现的问题</h3>
            {tasks.length > 0 && (
              <p className="text-sm text-gray-500 font-mono">
                来自最近一次审计 ({formatDate(tasks[0].created_at)})
              </p>
            )}
          </div>

          {loadingIssues ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500 font-mono">正在加载问题列表...</p>
            </div>
          ) : latestIssues.length > 0 ? (
            <div className="space-y-4">
              {latestIssues.map((issue, index) => (
                <div key={index} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`w-8 h-8 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${issue.severity === 'critical' ? 'bg-red-500 text-white' :
                        issue.severity === 'high' ? 'bg-orange-500 text-white' :
                          issue.severity === 'medium' ? 'bg-yellow-400 text-black' :
                            'bg-blue-400 text-white'
                        }`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-black mb-1 font-mono uppercase">{issue.title}</h4>
                        <div className="flex items-center space-x-2 text-xs text-gray-600 font-mono">
                          <span className="bg-gray-100 px-1 border border-gray-300">{issue.file_path}:{issue.line_number}</span>
                          <span>{issue.category}</span>
                        </div>
                      </div>
                    </div>
                    <Badge className={`rounded-none border-2 border-black ${issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      issue.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                      } font-bold uppercase`}>
                      {issue.severity === 'critical' ? '严重' :
                        issue.severity === 'high' ? '高' :
                          issue.severity === 'medium' ? '中等' : '低'}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-gray-700 font-mono border-t-2 border-dashed border-gray-200 pt-2">
                    {issue.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-12 flex flex-col items-center justify-center">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-bold text-gray-600 mb-2 uppercase">未发现问题</h3>
              <p className="text-sm text-gray-500 font-mono">最近一次审计未发现明显问题，或尚未进行审计。</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="flex flex-col gap-6 mt-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="pb-4 border-b-2 border-black mb-6">
              <h3 className="text-lg font-display font-bold uppercase flex items-center">
                <Edit className="w-5 h-5 mr-2" />
                编辑项目配置
              </h3>
            </div>

            <div className="flex flex-col gap-6">
              {/* 基本信息 */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name" className="font-bold font-mono uppercase">项目名称 *</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="输入项目名称"
                    className="retro-input mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description" className="font-bold font-mono uppercase">项目描述</Label>
                  <Textarea
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="输入项目描述"
                    rows={3}
                    className="retro-input mt-1 min-h-[80px]"
                  />
                </div>
              </div>

              {/* 仓库信息 */}
              <div className="space-y-4 border-t-2 border-dashed border-gray-300 pt-4">
                <h3 className="text-sm font-bold font-mono uppercase text-gray-900 bg-gray-100 inline-block px-2 border border-black">仓库信息</h3>

                <div>
                  <Label htmlFor="edit-repo-url" className="font-bold font-mono uppercase">仓库地址</Label>
                  <Input
                    id="edit-repo-url"
                    value={editForm.repository_url}
                    onChange={(e) => setEditForm({ ...editForm, repository_url: e.target.value })}
                    placeholder="https://github.com/username/repo"
                    className="retro-input mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-repo-type" className="font-bold font-mono uppercase">仓库类型</Label>
                    <Select
                      value={editForm.repository_type}
                      onValueChange={(value: any) => setEditForm({ ...editForm, repository_type: value })}
                    >
                      <SelectTrigger id="edit-repo-type" className="retro-input mt-1 rounded-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-branch" className="font-bold font-mono uppercase">默认分支</Label>
                    <Input
                      id="edit-branch"
                      value={editForm.default_branch}
                      onChange={(e) => setEditForm({ ...editForm, default_branch: e.target.value })}
                      placeholder="main"
                      className="retro-input mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* 编程语言 */}
              <div className="space-y-4 border-t-2 border-dashed border-gray-300 pt-4">
                <h3 className="text-sm font-bold font-mono uppercase text-gray-900 bg-gray-100 inline-block px-2 border border-black">编程语言</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {supportedLanguages.map((lang) => (
                    <div
                      key={lang}
                      className={`flex items-center space-x-2 p-3 border-2 cursor-pointer transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] ${editForm.programming_languages?.includes(lang)
                        ? 'border-black bg-yellow-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'border-gray-300 hover:border-black'
                        }`}
                      onClick={() => handleToggleLanguage(lang)}
                    >
                      <div
                        className={`w-4 h-4 border-2 flex items-center justify-center ${editForm.programming_languages?.includes(lang)
                          ? 'bg-black border-black'
                          : 'border-gray-400 bg-white'
                          }`}
                      >
                        {editForm.programming_languages?.includes(lang) && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-bold font-mono">{lang}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t-2 border-black">
                <Button onClick={handleSaveSettings} className="retro-btn bg-primary text-white hover:bg-primary/90 w-full md:w-auto">
                  <Edit className="w-4 h-4 mr-2" />
                  保存修改
                </Button>
              </div>
            </div>
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
    </div>
  );
}