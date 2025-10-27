import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  GitBranch,
  Calendar,
  Users,
  Settings,
  ExternalLink,
  Code,
  Shield,
  Activity,
  Upload,
  FileText,
  AlertCircle,
  Trash2,
  Edit,
  CheckCircle
} from "lucide-react";
import { api } from "@/shared/config/database";
import { scanZipFile, validateZipFile } from "@/features/projects/services";
import type { Project, CreateProjectForm } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [selectedProjectForTask, setSelectedProjectForTask] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTerminalDialog, setShowTerminalDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });
  const [createForm, setCreateForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });

  const supportedLanguages = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby'
  ];

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error("加载项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!createForm.name.trim()) {
      toast.error("请输入项目名称");
      return;
    }

    try {
      await api.createProject({
        ...createForm,
        // 无登录场景下不传 owner_id，由后端置为 null
      } as any);

      toast.success("项目创建成功");
      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error("创建项目失败");
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      description: "",
      repository_url: "",
      repository_type: "github",
      default_branch: "main",
      programming_languages: []
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件
    const validation = validateZipFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // 检查是否有项目名称
    if (!createForm.name.trim()) {
      toast.error("请先输入项目名称");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // 创建项目
      const project = await api.createProject({
        ...createForm,
        repository_type: "other"
      } as any);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 扫描ZIP文件
      const taskId = await scanZipFile({
        projectId: project.id,
        zipFile: file,
        excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        createdBy: 'local-user' // 使用默认本地用户ID
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // 关闭创建对话框
      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();

      // 显示终端进度窗口
      setCurrentTaskId(taskId);
      setShowTerminalDialog(true);

    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(error.message || "上传失败");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRepositoryIcon = (type?: string) => {
    switch (type) {
      case 'github': return '🐙';
      case 'gitlab': return '🦊';
      default: return '📁';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const handleCreateTask = (projectId: string) => {
    setSelectedProjectForTask(projectId);
    setShowCreateTaskDialog(true);
  };

  const handleEditClick = (project: Project) => {
    setProjectToEdit(project);
    setEditForm({
      name: project.name,
      description: project.description || "",
      repository_url: project.repository_url || "",
      repository_type: project.repository_type || "github",
      default_branch: project.default_branch || "main",
      programming_languages: project.programming_languages ? JSON.parse(project.programming_languages) : []
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!projectToEdit) return;

    if (!editForm.name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }

    try {
      await api.updateProject(projectToEdit.id, editForm);
      toast.success(`项目 "${editForm.name}" 已更新`);
      setShowEditDialog(false);
      setProjectToEdit(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to update project:', error);
      toast.error("更新项目失败");
    }
  };

  const handleToggleLanguage = (lang: string) => {
    const currentLanguages = editForm.programming_languages || [];
    const newLanguages = currentLanguages.includes(lang)
      ? currentLanguages.filter(l => l !== lang)
      : [...currentLanguages, lang];
    
    setEditForm({ ...editForm, programming_languages: newLanguages });
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      await api.deleteProject(projectToDelete.id);
      toast.success(`项目 "${projectToDelete.name}" 已移到回收站`, {
        description: '您可以在回收站中恢复此项目',
        duration: 4000
      });
      setShowDeleteDialog(false);
      setProjectToDelete(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error("删除项目失败");
    }
  };

  const handleTaskCreated = () => {
    toast.success("审计任务已创建", {
      description: '因为网络和代码文件大小等因素，审计时长通常至少需要1分钟，请耐心等待...',
      duration: 5000
    });
    // 任务创建后会自动跳转到项目详情页面
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题和操作 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">项目管理</h1>
          <p className="page-subtitle">管理您的代码项目，配置审计规则和查看分析结果</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>创建新项目</DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="repository" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="repository">Git 仓库</TabsTrigger>
                <TabsTrigger value="upload">上传代码</TabsTrigger>
              </TabsList>

              <TabsContent value="repository" className="space-y-4 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">项目名称 *</Label>
                    <Input
                      id="name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="输入项目名称"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="repository_type">仓库类型</Label>
                    <Select
                      value={createForm.repository_type}
                      onValueChange={(value: any) => setCreateForm({ ...createForm, repository_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="github">GitHub</SelectItem>
                        <SelectItem value="gitlab">GitLab</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">项目描述</Label>
                  <Textarea
                    id="description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="简要描述项目内容和目标"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="repository_url">仓库地址</Label>
                    <Input
                      id="repository_url"
                      value={createForm.repository_url}
                      onChange={(e) => setCreateForm({ ...createForm, repository_url: e.target.value })}
                      placeholder="https://github.com/user/repo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_branch">默认分支</Label>
                    <Input
                      id="default_branch"
                      value={createForm.default_branch}
                      onChange={(e) => setCreateForm({ ...createForm, default_branch: e.target.value })}
                      placeholder="main"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>编程语言</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {supportedLanguages.map((lang) => (
                      <label key={lang} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={createForm.programming_languages.includes(lang)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                programming_languages: [...createForm.programming_languages, lang]
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                programming_languages: createForm.programming_languages.filter(l => l !== lang)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{lang}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateProject}>
                    创建项目
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="upload-name">项目名称 *</Label>
                  <Input
                    id="upload-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="输入项目名称"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upload-description">项目描述</Label>
                  <Textarea
                    id="upload-description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="简要描述项目内容和目标"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>编程语言</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {supportedLanguages.map((lang) => (
                      <label key={lang} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={createForm.programming_languages.includes(lang)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                programming_languages: [...createForm.programming_languages, lang]
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                programming_languages: createForm.programming_languages.filter(l => l !== lang)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{lang}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 文件上传区域 */}
                <div className="space-y-4">
                  <Label>上传代码文件</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">上传 ZIP 文件</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      支持 ZIP 格式，最大 100MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || !createForm.name.trim()}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      选择文件
                    </Button>
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>上传并分析中...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                      <div className="text-sm text-red-800">
                        <p className="font-medium mb-1">上传说明：</p>
                        <ul className="space-y-1 text-xs">
                          <li>• 请确保 ZIP 文件包含完整的项目代码</li>
                          <li>• 系统会自动排除 node_modules、.git 等目录</li>
                          <li>• 上传后将立即开始代码分析</li>
                          <li>• 分析完成后可在任务详情页查看结果</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={uploading}>
                    取消
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索项目名称或描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 项目列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <Card key={project.id} className="card-modern group">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg">
                      {getRepositoryIcon(project.repository_type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        <Link to={`/projects/${project.id}`}>
                          {project.name}
                        </Link>
                      </CardTitle>
                      {project.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={project.is_active ? "default" : "secondary"} className="flex-shrink-0">
                    {project.is_active ? '活跃' : '暂停'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* 项目信息 */}
                <div className="space-y-3">
                  {project.repository_url && (
                    <div className="flex items-center text-sm text-gray-500">
                      <GitBranch className="w-4 h-4 mr-2 flex-shrink-0" />
                      <a
                        href={project.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors flex items-center truncate"
                      >
                        <span className="truncate">{project.repository_url.replace('https://', '')}</span>
                        <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(project.created_at)}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {project.owner?.full_name || '未知'}
                    </div>
                  </div>
                </div>

                {/* 编程语言 */}
                {project.programming_languages && (
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(project.programming_languages).slice(0, 4).map((lang: string) => (
                      <Badge key={lang} variant="outline" className="text-xs">
                        {lang}
                      </Badge>
                    ))}
                    {JSON.parse(project.programming_languages).length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{JSON.parse(project.programming_languages).length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 快速操作 */}
                <div className="flex gap-2 pt-2">
                  <Link to={`/projects/${project.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full btn-secondary">
                      <Code className="w-4 h-4 mr-2" />
                      查看详情
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    className="btn-primary"
                    onClick={() => handleCreateTask(project.id)}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    新建任务
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    onClick={() => handleEditClick(project)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDeleteClick(project)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card className="card-modern">
              <CardContent className="empty-state py-16">
                <div className="empty-icon">
                  <Code className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? '未找到匹配的项目' : '暂无项目'}
                </h3>
                <p className="text-gray-500 mb-6 max-w-md">
                  {searchTerm ? '尝试调整搜索条件' : '创建您的第一个项目开始代码审计'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowCreateDialog(true)} className="btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    创建项目
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 项目统计 */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">总项目数</p>
                  <p className="stat-value text-xl">{projects.length}</p>
                </div>
                <div className="stat-icon from-primary to-accent">
                  <Code className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">活跃项目</p>
                  <p className="stat-value text-xl">{projects.filter(p => p.is_active).length}</p>
                </div>
                <div className="stat-icon from-emerald-500 to-emerald-600">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">GitHub</p>
                  <p className="stat-value text-xl">{projects.filter(p => p.repository_type === 'github').length}</p>
                </div>
                <div className="stat-icon from-purple-500 to-purple-600">
                  <GitBranch className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label">GitLab</p>
                  <p className="stat-value text-xl">{projects.filter(p => p.repository_type === 'gitlab').length}</p>
                </div>
                <div className="stat-icon from-orange-500 to-orange-600">
                  <Shield className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 创建任务对话框 */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        preselectedProjectId={selectedProjectForTask}
      />

      {/* 终端进度对话框 */}
      <TerminalProgressDialog
        open={showTerminalDialog}
        onOpenChange={setShowTerminalDialog}
        taskId={currentTaskId}
        taskType="zip"
      />

      {/* 编辑项目对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveEdit}>
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移到回收站</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除项目 <span className="font-semibold text-gray-900">"{projectToDelete?.name}"</span> 吗？
              <br />
              <br />
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-3">
                <p className="text-blue-800 font-semibold mb-2">💡 温馨提示</p>
                <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
                  <li>项目将被移到<span className="font-semibold">回收站</span>，不会立即删除</li>
                  <li>您可以在回收站中随时恢复此项目</li>
                  <li>相关的审计任务和报告将会保留</li>
                  <li>如需永久删除，请在回收站中操作</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
            >
              移到回收站
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}