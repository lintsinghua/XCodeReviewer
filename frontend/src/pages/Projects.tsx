import { useState, useEffect, useRef } from "react";

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
  Code,
  Shield,
  Activity,
  Upload,
  FileText,
  AlertCircle,
  Trash2,
  Edit,
  CheckCircle,
  Terminal,
  Github,
  Folder
} from "lucide-react";
import { api } from "@/shared/config/database";
import { validateZipFile } from "@/features/projects/services";
import type { Project, CreateProjectForm } from "@/shared/types";
import { uploadZipFile, getZipFileInfo, type ZipFileMeta } from "@/shared/utils/zipStorage";
import { isRepositoryProject, isZipProject, getSourceTypeBadge } from "@/shared/utils/projectUtils";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import { SUPPORTED_LANGUAGES } from "@/shared/constants";

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    source_type: "repository",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });
  const [createForm, setCreateForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    source_type: "repository",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // 编辑对话框中的ZIP文件状态
  const [editZipInfo, setEditZipInfo] = useState<ZipFileMeta | null>(null);
  const [editZipFile, setEditZipFile] = useState<File | null>(null);
  const [loadingEditZipInfo, setLoadingEditZipInfo] = useState(false);
  const editZipInputRef = useRef<HTMLInputElement>(null);

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

      // 记录用户操作
      import('@/shared/utils/logger').then(({ logger }) => {
        logger.logUserAction('创建项目', {
          projectName: createForm.name,
          repositoryType: createForm.repository_type,
          languages: createForm.programming_languages,
        });
      });

      toast.success("项目创建成功");
      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);

      // 记录错误并显示详细信息
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '创建项目失败');
      });

      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`创建项目失败: ${errorMessage}`);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      name: "",
      description: "",
      source_type: "repository",
      repository_url: "",
      repository_type: "github",
      default_branch: "main",
      programming_languages: []
    });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件
    const validation = validateZipFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSelectedFile(file);
    // 清空 input value 以便可以再次选择同一个文件（虽然状态已经处理了）
    event.target.value = '';
  };

  const handleUploadAndCreate = async () => {
    if (!selectedFile) {
      toast.error("请先选择ZIP文件");
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

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 20;
        });
      }, 100);

      // 创建项目 - ZIP上传类型
      const project = await api.createProject({
        ...createForm,
        source_type: "zip",
        repository_type: "other",
        repository_url: undefined
      } as any);

      // 保存ZIP文件到后端持久化存储
      try {
        await uploadZipFile(project.id, selectedFile);
      } catch (error) {
        console.error('保存ZIP文件失败:', error);
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      // 记录用户操作
      import('@/shared/utils/logger').then(({ logger }) => {
        logger.logUserAction('上传ZIP文件创建项目', {
          projectName: project.name,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
        });
      });

      // 关闭创建对话框
      setShowCreateDialog(false);
      resetCreateForm();
      loadProjects();

      toast.success(`项目 "${project.name}" 已创建`, {
        description: 'ZIP文件已保存，您可以启动代码审计',
        duration: 4000
      });

    } catch (error: any) {
      console.error('Upload failed:', error);

      // 记录错误并显示详细信息
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '上传ZIP文件失败');
      });

      const errorMessage = error?.message || '未知错误';
      toast.error(`上传失败: ${errorMessage}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRepositoryIcon = (type?: string) => {
    switch (type) {
      case 'github': return <Github className="w-5 h-5" />;
      case 'gitlab': return <GitBranch className="w-5 h-5 text-orange-500" />;
      default: return <Folder className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const handleCreateTask = (projectId: string) => {
    setSelectedProjectForTask(projectId);
    setShowCreateTaskDialog(true);
  };

  const handleEditClick = async (project: Project) => {
    setProjectToEdit(project);
    setEditForm({
      name: project.name,
      description: project.description || "",
      source_type: project.source_type || "repository",
      repository_url: project.repository_url || "",
      repository_type: project.repository_type || "github",
      default_branch: project.default_branch || "main",
      programming_languages: project.programming_languages ? JSON.parse(project.programming_languages) : []
    });
    setEditZipFile(null);
    setEditZipInfo(null);
    setShowEditDialog(true);
    
    // 如果是ZIP项目，加载ZIP文件信息
    if (project.source_type === 'zip') {
      setLoadingEditZipInfo(true);
      try {
        const zipInfo = await getZipFileInfo(project.id);
        setEditZipInfo(zipInfo);
      } catch (error) {
        console.error('加载ZIP文件信息失败:', error);
      } finally {
        setLoadingEditZipInfo(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!projectToEdit) return;

    if (!editForm.name.trim()) {
      toast.error("项目名称不能为空");
      return;
    }

    try {
      // 更新项目基本信息
      await api.updateProject(projectToEdit.id, editForm);
      
      // 如果有新的ZIP文件，上传它
      if (editZipFile && editForm.source_type === 'zip') {
        const result = await uploadZipFile(projectToEdit.id, editZipFile);
        if (result.success) {
          toast.success(`ZIP文件已更新: ${result.original_filename}`);
        } else {
          toast.error(`ZIP文件上传失败: ${result.message}`);
        }
      }
      
      toast.success(`项目 "${editForm.name}" 已更新`);
      setShowEditDialog(false);
      setProjectToEdit(null);
      setEditZipFile(null);
      setEditZipInfo(null);
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

      // 记录用户操作
      import('@/shared/utils/logger').then(({ logger }) => {
        logger.logUserAction('删除项目', {
          projectId: projectToDelete.id,
          projectName: projectToDelete.name,
        });
      });

      toast.success(`项目 "${projectToDelete.name}" 已移到回收站`, {
        description: '您可以在回收站中恢复此项目',
        duration: 4000
      });
      setShowDeleteDialog(false);
      setProjectToDelete(null);
      loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);

      // 记录错误并显示详细信息
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '删除项目失败');
      });

      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`删除项目失败: ${errorMessage}`);
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
    <div className="flex flex-col gap-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 创建项目对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild className="hidden">
            <Button className="terminal-btn-primary h-12 text-lg">
              <Plus className="w-5 h-5 mr-2" />
              初始化项目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
            <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
              <DialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                初始化_新_项目
              </DialogTitle>
            </DialogHeader>

            <div className="p-6">
              <Tabs defaultValue="repository" className="w-full">
                <TabsList className="flex w-full bg-gray-100 border border-border p-1 h-auto gap-1">
                  <TabsTrigger
                    value="repository"
                    className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase py-2 border-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-sm transition-all"
                  >
                    Git 仓库
                  </TabsTrigger>
                  <TabsTrigger
                    value="upload"
                    className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase py-2 border-2 border-transparent data-[state=active]:border-black data-[state=active]:shadow-sm transition-all"
                  >
                    上传源码
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="repository" className="flex flex-col gap-5 mt-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="font-mono font-bold uppercase text-xs">项目名称 *</Label>
                      <Input
                        id="name"
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        placeholder="输入项目名称"
                        className="terminal-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="repository_type" className="font-mono font-bold uppercase text-xs">仓库类型</Label>
                      <Select
                        value={createForm.repository_type}
                        onValueChange={(value: any) => setCreateForm({ ...createForm, repository_type: value })}
                      >
                        <SelectTrigger className="terminal-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="retro-card border border-border">
                          <SelectItem value="github">GITHUB</SelectItem>
                          <SelectItem value="gitlab">GITLAB</SelectItem>
                          <SelectItem value="other">OTHER</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="font-mono font-bold uppercase text-xs">描述</Label>
                    <Textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="// 项目描述..."
                      rows={3}
                      className="terminal-input min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="repository_url" className="font-mono font-bold uppercase text-xs">仓库地址</Label>
                      <Input
                        id="repository_url"
                        value={createForm.repository_url}
                        onChange={(e) => setCreateForm({ ...createForm, repository_url: e.target.value })}
                        placeholder="https://github.com/user/repo"
                        className="terminal-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="default_branch" className="font-mono font-bold uppercase text-xs">默认分支</Label>
                      <Input
                        id="default_branch"
                        value={createForm.default_branch}
                        onChange={(e) => setCreateForm({ ...createForm, default_branch: e.target.value })}
                        placeholder="main"
                        className="terminal-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-mono font-bold uppercase text-xs">技术栈</Label>
                    <div className="flex flex-wrap gap-2">
                      {supportedLanguages.map((lang) => (
                        <label key={lang} className={`flex items-center space-x-2 px-3 py-1.5 border cursor-pointer transition-all ${createForm.programming_languages.includes(lang)
                          ? 'border-black bg-primary/10 shadow-sm'
                          : 'border-gray-200 hover:border-black'
                          }`}>
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
                            className="rounded border border-border w-3.5 h-3.5 text-primary focus:ring-0"
                          />
                          <span className="text-xs font-mono font-bold uppercase">{lang}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4 border-t-2 border-dashed border-gray-200">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="terminal-btn-primary bg-white text-black hover:bg-gray-100">
                      取消
                    </Button>
                    <Button onClick={handleCreateProject} className="terminal-btn-primary">
                      执行创建
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="flex flex-col gap-5 mt-5">
                  {/* Upload Tab Content - Similar styling */}
                  <div className="space-y-1.5">
                    <Label htmlFor="upload-name" className="font-mono font-bold uppercase text-xs">项目名称 *</Label>
                    <Input
                      id="upload-name"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      placeholder="输入项目名称"
                      className="terminal-input"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="upload-description" className="font-mono font-bold uppercase text-xs">描述</Label>
                    <Textarea
                      id="upload-description"
                      value={createForm.description}
                      onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                      placeholder="// 项目描述..."
                      rows={3}
                      className="terminal-input min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-mono font-bold uppercase text-xs">技术栈</Label>
                    <div className="flex flex-wrap gap-2">
                      {supportedLanguages.map((lang) => (
                        <label key={lang} className={`flex items-center space-x-2 px-3 py-1.5 border cursor-pointer transition-all ${createForm.programming_languages.includes(lang)
                          ? 'border-black bg-primary/10 shadow-sm'
                          : 'border-gray-200 hover:border-black'
                          }`}>
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
                            className="rounded border border-border w-3.5 h-3.5 text-primary focus:ring-0"
                          />
                          <span className="text-xs font-mono font-bold uppercase">{lang}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="font-mono font-bold uppercase text-xs">源代码</Label>

                    {!selectedFile ? (
                      <div className="border-2 border-dashed border-black bg-gray-50 rounded-none p-6 text-center hover:bg-white transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-10 h-10 text-black mx-auto mb-3 group-hover:scale-110 transition-transform" />
                        <h3 className="text-base font-bold font-display uppercase mb-1">上传 ZIP 归档</h3>
                        <p className="text-[10px] font-mono text-gray-500 mb-3">
                          最大: 100MB // 格式: .ZIP
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".zip"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={uploading}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="terminal-btn-primary bg-white text-black h-8 text-xs"
                          disabled={uploading || !createForm.name.trim()}
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                        >
                          <FileText className="w-3 h-3 mr-2" />
                          选择文件
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-black bg-white p-4 flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="w-10 h-10 bg-gray-100 border border-black flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-sm truncate">{selectedFile.name}</p>
                            <p className="font-mono text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedFile(null)}
                          disabled={uploading}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {uploading && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span>上传并分析中...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-3 border border-border rounded-none bg-white [&>div]:bg-primary" />
                      </div>
                    )}

                    <div className="bg-yellow-50 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="w-4 h-4 text-black mt-0.5" />
                        <div className="text-[10px] font-mono text-black">
                          <p className="font-bold mb-1 uppercase">上传协议:</p>
                          <ul className="space-y-0.5 list-disc list-inside">
                            <li>确保完整的项目代码</li>
                            <li>移除 node_modules 等依赖目录</li>
                            <li>包含必要的配置文件</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4 border-t-2 border-dashed border-gray-200 mt-auto">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={uploading} className="terminal-btn-primary bg-white text-black hover:bg-gray-100">
                      取消
                    </Button>
                    <Button
                      onClick={handleUploadAndCreate}
                      className="terminal-btn-primary"
                      disabled={!selectedFile || uploading}
                    >
                      {uploading ? '上传中...' : '执行创建'}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>

      {/* Stats Section */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
          <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase text-gray-500">项目总数</p>
                <p className="font-display text-2xl font-bold">{projects.length}</p>
              </div>
              <div className="w-10 h-10 border border-border bg-primary flex items-center justify-center text-white shadow-sm">
                <Code className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase text-gray-500">活跃</p>
                <p className="font-display text-2xl font-bold">{projects.filter(p => p.is_active).length}</p>
              </div>
              <div className="w-10 h-10 border border-border bg-green-500 flex items-center justify-center text-white shadow-sm">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase text-gray-500">远程仓库</p>
                <p className="font-display text-2xl font-bold">{projects.filter(p => isRepositoryProject(p)).length}</p>
              </div>
              <div className="w-10 h-10 border border-border bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <GitBranch className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="retro-card p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase text-gray-500">ZIP上传</p>
                <p className="font-display text-2xl font-bold">{projects.filter(p => isZipProject(p)).length}</p>
              </div>
              <div className="w-10 h-10 border border-border bg-amber-500 flex items-center justify-center text-white shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="retro-card p-4 flex items-center gap-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative z-10">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 z-10" />
          <Input
            placeholder="搜索项目..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-background border border-input pr-3 py-2 rounded-sm font-mono text-sm w-full pl-10"
          />
        </div>
        <Button className="terminal-btn-primary h-10" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新建项目
        </Button>
      </div>

      {/* Project List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <div key={project.id} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-lg transition-all group flex flex-col h-full">
              <div className="p-4 border-b-2 border-black bg-gray-50 flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {getRepositoryIcon(project.repository_type)}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                      <Link to={`/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </h3>
                    <div className="flex items-center mt-1 space-x-2">
                      <Badge variant="outline" className={`text-[10px] font-mono border-black ${project.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {project.is_active ? '活跃' : '暂停'}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-mono border-black ${isRepositoryProject(project) ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {getSourceTypeBadge(project.source_type)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 flex-1 space-y-4">
                {project.description && (
                  <p className="text-sm text-gray-600 font-mono line-clamp-2 border-l-2 border-gray-300 pl-2">
                    {project.description}
                  </p>
                )}

                <div className="space-y-2">
                  {project.repository_url && (
                    <div className="flex items-center text-xs font-mono text-gray-500 bg-gray-100 p-1 border border-gray-300">
                      <GitBranch className="w-3 h-3 mr-2 flex-shrink-0" />
                      <a
                        href={project.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors truncate hover:underline"
                      >
                        {project.repository_url.replace('https://', '')}
                      </a>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs font-mono text-gray-500">
                    <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {formatDate(project.created_at)}</span>
                    <span className="flex items-center"><Users className="w-3 h-3 mr-1" /> {project.owner?.full_name || '未知'}</span>
                  </div>
                </div>

                {project.programming_languages && (
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(project.programming_languages).slice(0, 4).map((lang: string) => (
                      <span key={lang} className="text-[10px] font-mono font-bold border border-black px-1 bg-yellow-100">
                        {lang.toUpperCase()}
                      </span>
                    ))}
                    {JSON.parse(project.programming_languages).length > 4 && (
                      <span className="text-[10px] font-mono font-bold border border-black px-1 bg-gray-100">
                        +{JSON.parse(project.programming_languages).length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 border-t-2 border-black bg-gray-50 grid grid-cols-2 gap-2">
                <Link to={`/projects/${project.id}`} className="col-span-2">
                  <Button variant="outline" className="w-full terminal-btn-primary bg-white text-black h-8 text-xs">
                    <Code className="w-3 h-3 mr-2" />
                    查看详情
                  </Button>
                </Link>
                <Button size="sm" className="terminal-btn-primary h-8 text-xs" onClick={() => handleCreateTask(project.id)}>
                  <Shield className="w-3 h-3 mr-2" />
                  审计
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="terminal-btn-primary bg-white text-black h-8 px-0" onClick={() => handleEditClick(project)}>
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="terminal-btn-primary bg-white text-red-600 border-red-600 h-8 px-0 hover:bg-red-50" onClick={() => handleDeleteClick(project)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full">
            <div className="retro-card border border-border p-16 text-center bg-white border-dashed">
              <Code className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-display font-bold text-gray-900 mb-2">
                {searchTerm ? '未找到匹配项' : '未初始化项目'}
              </h3>
              <p className="text-gray-500 font-mono mb-6">
                {searchTerm ? '调整搜索参数' : '初始化第一个项目以开始'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowCreateDialog(true)} className="terminal-btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  初始化项目
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onTaskCreated={handleTaskCreated}
        preselectedProjectId={selectedProjectForTask}
      />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
              <Edit className="w-5 h-5" />
              编辑项目配置
              {projectToEdit && (
                <Badge className={`ml-2 ${editForm.source_type === 'repository' ? 'bg-blue-600' : 'bg-amber-500'}`}>
                  {editForm.source_type === 'repository' ? '远程仓库' : 'ZIP上传'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
            {/* 基本信息 */}
            <div className="space-y-4">
              <h3 className="font-mono font-bold uppercase text-sm border-b-2 border-black pb-1">基本信息</h3>
              <div>
                <Label htmlFor="edit-name" className="font-mono font-bold uppercase text-xs">项目名称 *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="terminal-input"
                />
              </div>
              <div>
                <Label htmlFor="edit-description" className="font-mono font-bold uppercase text-xs">描述</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="terminal-input"
                />
              </div>
            </div>

            {/* 仓库信息 - 仅远程仓库类型显示 */}
            {editForm.source_type === 'repository' && (
              <div className="space-y-4">
                <h3 className="font-mono font-bold uppercase text-sm border-b-2 border-black pb-1 flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  仓库信息
                </h3>

                <div>
                  <Label htmlFor="edit-repo-url" className="font-mono font-bold uppercase text-xs">仓库地址</Label>
                  <Input
                    id="edit-repo-url"
                    value={editForm.repository_url}
                    onChange={(e) => setEditForm({ ...editForm, repository_url: e.target.value })}
                    placeholder="https://github.com/user/repo"
                    className="terminal-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-repo-type" className="font-mono font-bold uppercase text-xs">仓库平台</Label>
                    <Select
                      value={editForm.repository_type}
                      onValueChange={(value: any) => setEditForm({ ...editForm, repository_type: value })}
                    >
                      <SelectTrigger id="edit-repo-type" className="terminal-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="retro-card border border-border">
                        <SelectItem value="github">GITHUB</SelectItem>
                        <SelectItem value="gitlab">GITLAB</SelectItem>
                        <SelectItem value="other">OTHER</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-default-branch" className="font-mono font-bold uppercase text-xs">默认分支</Label>
                    <Input
                      id="edit-default-branch"
                      value={editForm.default_branch}
                      onChange={(e) => setEditForm({ ...editForm, default_branch: e.target.value })}
                      placeholder="main"
                      className="terminal-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ZIP项目文件管理 */}
            {editForm.source_type === 'zip' && (
              <div className="space-y-4">
                <h3 className="font-mono font-bold uppercase text-sm border-b-2 border-black pb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  ZIP文件管理
                </h3>
                
                {loadingEditZipInfo ? (
                  <div className="flex items-center space-x-3 p-4 bg-blue-50 border-2 border-black">
                    <div className="animate-spin rounded-none h-5 w-5 border-4 border-blue-600 border-t-transparent"></div>
                    <p className="text-sm text-blue-800 font-bold font-mono">正在加载ZIP文件信息...</p>
                  </div>
                ) : editZipInfo?.has_file ? (
                  <div className="bg-green-50 border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-start space-x-3">
                      <FileText className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="flex-1 text-sm font-mono">
                        <p className="font-bold text-green-900 mb-1 uppercase">当前存储的ZIP文件</p>
                        <p className="text-green-700 text-xs">
                          文件名: {editZipInfo.original_filename}
                          {editZipInfo.file_size && (
                            <> ({editZipInfo.file_size >= 1024 * 1024
                              ? `${(editZipInfo.file_size / 1024 / 1024).toFixed(2)} MB`
                              : `${(editZipInfo.file_size / 1024).toFixed(2)} KB`
                            })</>
                          )}
                        </p>
                        {editZipInfo.uploaded_at && (
                          <p className="text-green-600 text-xs mt-0.5">
                            上传时间: {new Date(editZipInfo.uploaded_at).toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border-2 border-black p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="text-sm font-mono">
                        <p className="font-bold text-amber-900 mb-1 uppercase">暂无ZIP文件</p>
                        <p className="text-amber-700 text-xs">
                          此项目还没有上传ZIP文件，请上传文件以便进行代码审计。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 上传新文件 */}
                <div className="space-y-2">
                  <Label className="font-mono font-bold uppercase text-xs">
                    {editZipInfo?.has_file ? '更新ZIP文件' : '上传ZIP文件'}
                  </Label>
                  <input
                    ref={editZipInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const validation = validateZipFile(file);
                        if (!validation.valid) {
                          toast.error(validation.error || "文件无效");
                          e.target.value = '';
                          return;
                        }
                        setEditZipFile(file);
                        toast.success(`已选择文件: ${file.name}`);
                      }
                    }}
                  />
                  
                  {editZipFile ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 border-2 border-black">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-mono font-bold">{editZipFile.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(editZipFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditZipFile(null)}
                        className="terminal-btn-primary bg-white text-black h-7 text-xs"
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => editZipInputRef.current?.click()}
                      className="terminal-btn-primary bg-white text-black w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {editZipInfo?.has_file ? '选择新文件替换' : '选择ZIP文件'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 技术栈 */}
            <div className="space-y-4">
              <h3 className="font-mono font-bold uppercase text-sm border-b-2 border-black pb-1">技术栈</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {supportedLanguages.map((lang) => (
                  <div
                    key={lang}
                    className={`flex items-center space-x-2 p-2 border-2 cursor-pointer transition-all ${editForm.programming_languages?.includes(lang)
                      ? 'border-black bg-primary/10 shadow-sm'
                      : 'border-gray-200 hover:border-black'
                      }`}
                    onClick={() => handleToggleLanguage(lang)}
                  >
                    <div
                      className={`w-4 h-4 border-2 flex items-center justify-center ${editForm.programming_languages?.includes(lang)
                        ? 'bg-primary border-black'
                        : 'border-gray-300'
                        }`}
                    >
                      {editForm.programming_languages?.includes(lang) && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-mono font-bold uppercase">{lang}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 p-4 border-t-2 border-black bg-gray-50">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="terminal-btn-primary bg-white text-black hover:bg-gray-100">
              取消
            </Button>
            <Button onClick={handleSaveEdit} className="terminal-btn-primary">
              保存更改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <AlertDialogHeader className="bg-red-600 text-white p-4 border-b-4 border-black">
            <AlertDialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/90 font-mono">
              您确定要移动 <span className="font-bold underline">"{projectToDelete?.name}"</span> 到回收站吗？
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="p-6">
            <div className="bg-blue-50 border border-border p-4 shadow-md">
              <p className="text-blue-900 font-bold mb-2 font-mono uppercase">系统通知:</p>
              <ul className="list-disc list-inside text-blue-800 space-y-1 text-xs font-mono">
                <li>&gt; 项目移至回收站</li>
                <li>&gt; 可恢复</li>
                <li>&gt; 审计数据保留</li>
                <li>&gt; 在回收站中永久删除</li>
              </ul>
            </div>
          </div>

          <AlertDialogFooter className="p-4 border-t-2 border-black bg-gray-50">
            <AlertDialogCancel className="terminal-btn-primary bg-white text-black hover:bg-gray-100 border border-border">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="terminal-btn-primary bg-red-600 text-white hover:bg-red-700 border border-border"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}