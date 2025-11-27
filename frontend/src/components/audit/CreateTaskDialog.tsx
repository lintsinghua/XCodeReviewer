import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GitBranch,
  Settings,
  FileText,
  AlertCircle,
  Info,
  Zap,
  Shield,
  Search
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { Project, CreateAuditTaskForm } from "@/shared/types";
import { toast } from "sonner";
import TerminalProgressDialog from "./TerminalProgressDialog";
import { runRepositoryAudit } from "@/features/projects/services/repoScan";
import { scanZipFile, validateZipFile } from "@/features/projects/services/repoZipScan";
import { loadZipFile } from "@/shared/utils/zipStorage";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: () => void;
  preselectedProjectId?: string;
}

export default function CreateTaskDialog({ open, onOpenChange, onTaskCreated, preselectedProjectId }: CreateTaskDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showTerminalDialog, setShowTerminalDialog] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loadingZipFile, setLoadingZipFile] = useState(false);
  const [hasLoadedZip, setHasLoadedZip] = useState(false);

  const [taskForm, setTaskForm] = useState<CreateAuditTaskForm>({
    project_id: "",
    task_type: "repository",
    branch_name: "main",
    exclude_patterns: ["node_modules/**", ".git/**", "dist/**", "build/**", "*.log"],
    scan_config: {
      include_tests: true,
      include_docs: false,
      max_file_size: 200, // KB (对齐后端默认值 200KB)
      analysis_depth: "standard"
    }
  });

  const commonExcludePatterns = [
    { label: "node_modules", value: "node_modules/**", description: "Node.js 依赖包" },
    { label: ".git", value: ".git/**", description: "Git 版本控制文件" },
    { label: "dist/build", value: "dist/**", description: "构建输出目录" },
    { label: "logs", value: "*.log", description: "日志文件" },
    { label: "cache", value: ".cache/**", description: "缓存文件" },
    { label: "temp", value: "temp/**", description: "临时文件" },
    { label: "vendor", value: "vendor/**", description: "第三方库" },
    { label: "coverage", value: "coverage/**", description: "测试覆盖率报告" }
  ];

  // 从后端加载默认配置
  useEffect(() => {
    const loadDefaultConfig = async () => {
      try {
        const defaultConfig = await api.getDefaultConfig();
        if (defaultConfig?.otherConfig) {
          // 后端 MAX_FILE_SIZE_BYTES 是 200 * 1024 = 204800 bytes = 200KB
          // 转换为KB用于前端显示
          const maxFileSizeKB = 200; // 后端默认值 200KB

          setTaskForm(prev => ({
            ...prev,
            scan_config: {
              ...prev.scan_config,
              max_file_size: maxFileSizeKB,
            }
          }));
        }
      } catch (error) {
        console.error('Failed to load default config:', error);
        // 使用硬编码的默认值作为后备（200KB）
      }
    };
    loadDefaultConfig();
  }, []);

  useEffect(() => {
    if (open) {
      loadProjects();
      // 如果有预选择的项目ID，设置到表单中
      if (preselectedProjectId) {
        setTaskForm(prev => ({ ...prev, project_id: preselectedProjectId }));
      }
      // 重置ZIP文件状态
      setZipFile(null);
      setHasLoadedZip(false);
    }
  }, [open, preselectedProjectId]);

  // 当项目ID变化时，尝试自动加载保存的ZIP文件
  useEffect(() => {
    const autoLoadZipFile = async () => {
      if (!taskForm.project_id || hasLoadedZip) return;

      const project = projects.find(p => p.id === taskForm.project_id);
      if (!project || project.repository_type !== 'other') return;

      try {
        setLoadingZipFile(true);
        const savedFile = await loadZipFile(taskForm.project_id);

        if (savedFile) {
          setZipFile(savedFile);
          setHasLoadedZip(true);
          console.log('✓ 已自动加载保存的ZIP文件:', savedFile.name);
          toast.success(`已加载保存的ZIP文件: ${savedFile.name}`);
        }
      } catch (error) {
        console.error('自动加载ZIP文件失败:', error);
      } finally {
        setLoadingZipFile(false);
      }
    };

    autoLoadZipFile();
  }, [taskForm.project_id, projects, hasLoadedZip]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data.filter(p => p.is_active));
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error("加载项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskForm.project_id) {
      toast.error("请选择项目");
      return;
    }

    if (taskForm.task_type === "repository" && !taskForm.branch_name?.trim()) {
      toast.error("请输入分支名称");
      return;
    }

    const project = selectedProject;
    if (!project) {
      toast.error("未找到选中的项目");
      return;
    }

    try {
      setCreating(true);

      console.log('🎯 开始创建审计任务...', {
        projectId: project.id,
        projectName: project.name,
        repositoryType: project.repository_type
      });

      let taskId: string;

      // 根据项目是否有repository_url判断使用哪种扫描方式
      if (!project.repository_url || project.repository_url.trim() === '') {
        // ZIP上传的项目：需要有ZIP文件才能扫描
        if (!zipFile) {
          toast.error("请上传ZIP文件进行扫描");
          return;
        }

        console.log('📦 调用 scanZipFile...');
        taskId = await scanZipFile({
          projectId: project.id,
          zipFile: zipFile,
          excludePatterns: taskForm.exclude_patterns,
          createdBy: 'local-user'
        });
      } else {
        // GitHub/GitLab等远程仓库
        console.log('📡 调用 runRepositoryAudit...');

        // 后端会从用户配置中读取 GitHub/GitLab Token，前端不需要传递
        taskId = await runRepositoryAudit({
          projectId: project.id,
          repoUrl: project.repository_url!,
          branch: taskForm.branch_name || project.default_branch || 'main',
          exclude: taskForm.exclude_patterns,
          createdBy: 'local-user'
        });
      }

      console.log('✅ 任务创建成功:', taskId);

      // 记录用户操作
      import('@/shared/utils/logger').then(({ logger }) => {
        logger.logUserAction('创建审计任务', {
          taskId,
          projectId: project.id,
          projectName: project.name,
          taskType: taskForm.task_type,
          branch: taskForm.branch_name,
          hasZipFile: !!zipFile,
        });
      });

      // 关闭创建对话框
      onOpenChange(false);
      resetForm();
      onTaskCreated();

      // 显示终端进度窗口
      setCurrentTaskId(taskId);
      setShowTerminalDialog(true);

      toast.success("审计任务已创建并启动");
    } catch (error) {
      console.error('❌ 创建任务失败:', error);

      // 记录错误并显示详细信息
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(error, '创建审计任务失败');
      });

      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`创建任务失败: ${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTaskForm({
      project_id: "",
      task_type: "repository",
      branch_name: "main",
      exclude_patterns: ["node_modules/**", ".git/**", "dist/**", "build/**", "*.log"],
      scan_config: {
        include_tests: true,
        include_docs: false,
        max_file_size: 200, // KB (对齐后端默认值 200KB)
        analysis_depth: "standard"
      }
    });
    setSearchTerm("");
  };

  const toggleExcludePattern = (pattern: string) => {
    const patterns = taskForm.exclude_patterns || [];
    if (patterns.includes(pattern)) {
      setTaskForm({
        ...taskForm,
        exclude_patterns: patterns.filter(p => p !== pattern)
      });
    } else {
      setTaskForm({
        ...taskForm,
        exclude_patterns: [...patterns, pattern]
      });
    }
  };

  const addCustomPattern = (pattern: string) => {
    if (pattern.trim() && !taskForm.exclude_patterns.includes(pattern.trim())) {
      setTaskForm({
        ...taskForm,
        exclude_patterns: [...taskForm.exclude_patterns, pattern.trim()]
      });
    }
  };

  const removeExcludePattern = (pattern: string) => {
    setTaskForm({
      ...taskForm,
      exclude_patterns: taskForm.exclude_patterns.filter(p => p !== pattern)
    });
  };

  const selectedProject = projects.find(p => p.id === taskForm.project_id);
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-2 border-black p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
        <DialogHeader className="p-6 border-b-2 border-black bg-gray-50">
          <DialogTitle className="flex items-center space-x-2 font-display font-bold uppercase text-xl">
            <Shield className="w-6 h-6 text-black" />
            <span>新建审计任务</span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* 项目选择 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-bold font-mono uppercase">选择项目</Label>
              <Badge variant="outline" className="text-xs rounded-none border-black font-mono">
                {filteredProjects.length} 个可用项目
              </Badge>
            </div>

            {/* 项目搜索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black w-4 h-4" />
              <Input
                placeholder="搜索项目名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 retro-input h-10"
              />
            </div>

            {/* 项目列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
              {loading ? (
                <div className="col-span-2 flex items-center justify-center py-8">
                  <div className="animate-spin rounded-none h-8 w-8 border-4 border-primary border-t-transparent"></div>
                </div>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`cursor-pointer transition-all border-2 p-4 relative ${taskForm.project_id === project.id
                      ? 'border-primary bg-blue-50 shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] translate-x-[-2px] translate-y-[-2px]'
                      : 'border-black bg-white hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                      }`}
                    onClick={() => setTaskForm({ ...taskForm, project_id: project.id })}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm font-display uppercase">{project.name}</h4>
                        {project.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2 font-mono">
                            {project.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 font-mono font-bold">
                          <span className="uppercase">{project.repository_type?.toUpperCase() || 'OTHER'}</span>
                          <span>{project.default_branch}</span>
                        </div>
                      </div>
                      {taskForm.project_id === project.id && (
                        <div className="w-5 h-5 bg-primary border-2 border-black flex items-center justify-center">
                          <div className="w-2 h-2 bg-white"></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-500 font-mono">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchTerm ? '未找到匹配的项目' : '暂无可用项目'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 任务配置 */}
          {selectedProject && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-100 border-2 border-black p-0 h-12 rounded-none">
                <TabsTrigger
                  value="basic"
                  className="flex items-center space-x-2 rounded-none border-r-2 border-black data-[state=active]:bg-primary data-[state=active]:text-white h-full font-bold uppercase transition-all"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>基础配置</span>
                </TabsTrigger>
                <TabsTrigger
                  value="exclude"
                  className="flex items-center space-x-2 rounded-none border-r-2 border-black data-[state=active]:bg-primary data-[state=active]:text-white h-full font-bold uppercase transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>排除规则</span>
                </TabsTrigger>
                <TabsTrigger
                  value="advanced"
                  className="flex items-center space-x-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-white h-full font-bold uppercase transition-all"
                >
                  <Settings className="w-4 h-4" />
                  <span>高级选项</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-6 font-mono">
                {/* ZIP项目文件上传 */}
                {(!selectedProject.repository_url || selectedProject.repository_url.trim() === '') && (
                  <div className="bg-amber-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="space-y-3">
                      {loadingZipFile ? (
                        <div className="flex items-center space-x-3 p-4 bg-blue-50 border-2 border-black">
                          <div className="animate-spin rounded-none h-5 w-5 border-4 border-blue-600 border-t-transparent"></div>
                          <p className="text-sm text-blue-800 font-bold">正在加载保存的ZIP文件...</p>
                        </div>
                      ) : zipFile ? (
                        <div className="flex items-start space-x-3 p-4 bg-green-50 border-2 border-black">
                          <Info className="w-5 h-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-bold text-green-900 text-sm uppercase">已准备就绪</p>
                            <p className="text-xs text-green-700 mt-1 font-bold">
                              使用保存的ZIP文件: {zipFile.name} (
                              {zipFile.size >= 1024 * 1024
                                ? `${(zipFile.size / 1024 / 1024).toFixed(2)} MB`
                                : zipFile.size >= 1024
                                  ? `${(zipFile.size / 1024).toFixed(2)} KB`
                                  : `${zipFile.size} B`
                              })
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setZipFile(null);
                              setHasLoadedZip(false);
                            }}
                            className="retro-btn bg-white text-black h-8 text-xs"
                          >
                            更换文件
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start space-x-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                              <p className="font-bold text-amber-900 text-sm uppercase">需要上传ZIP文件</p>
                              <p className="text-xs text-amber-700 mt-1 font-bold">
                                未找到保存的ZIP文件，请上传文件进行扫描
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="zipFile" className="font-bold uppercase">上传ZIP文件</Label>
                            <Input
                              id="zipFile"
                              type="file"
                              accept=".zip"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  console.log('📁 选择的文件:', {
                                    name: file.name,
                                    size: file.size,
                                    type: file.type,
                                    sizeMB: (file.size / 1024 / 1024).toFixed(2)
                                  });

                                  const validation = validateZipFile(file);
                                  if (!validation.valid) {
                                    toast.error(validation.error || "文件无效");
                                    e.target.value = '';
                                    return;
                                  }
                                  setZipFile(file);
                                  setHasLoadedZip(true);

                                  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                                  const sizeKB = (file.size / 1024).toFixed(2);
                                  const sizeText = file.size >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

                                  toast.success(`已选择文件: ${file.name} (${sizeText})`);
                                }
                              }}
                              className="cursor-pointer retro-input pt-1.5"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task_type" className="font-bold uppercase">任务类型</Label>
                    <Select
                      value={taskForm.task_type}
                      onValueChange={(value: any) => setTaskForm({ ...taskForm, task_type: value })}
                    >
                      <SelectTrigger className="retro-input h-10 rounded-none border-2 border-black shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <SelectItem value="repository">
                          <div className="flex items-center space-x-2">
                            <GitBranch className="w-4 h-4" />
                            <span className="font-mono">仓库审计</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="instant">
                          <div className="flex items-center space-x-2">
                            <Zap className="w-4 h-4" />
                            <span className="font-mono">即时分析</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {taskForm.task_type === "repository" && (selectedProject.repository_url) && (
                    <div className="space-y-2">
                      <Label htmlFor="branch_name" className="font-bold uppercase">目标分支</Label>
                      <Input
                        id="branch_name"
                        value={taskForm.branch_name || ""}
                        onChange={(e) => setTaskForm({ ...taskForm, branch_name: e.target.value })}
                        placeholder={selectedProject.default_branch || "main"}
                        className="retro-input h-10"
                      />
                    </div>
                  )}
                </div>

                {/* 项目信息展示 */}
                <div className="bg-blue-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-start space-x-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm font-mono">
                      <p className="font-bold text-blue-900 mb-1 uppercase">选中项目：{selectedProject.name}</p>
                      <div className="text-blue-800 space-y-1 font-bold">
                        {selectedProject.description && (
                          <p>描述：{selectedProject.description}</p>
                        )}
                        <p>默认分支：{selectedProject.default_branch}</p>
                        {selectedProject.programming_languages && (
                          <p>编程语言：{JSON.parse(selectedProject.programming_languages).join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="exclude" className="space-y-4 mt-6 font-mono">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-bold uppercase">排除模式</Label>
                    <p className="text-sm text-gray-500 mt-1 font-bold">
                      选择要从审计中排除的文件和目录模式
                    </p>
                  </div>

                  {/* 常用排除模式 */}
                  <div className="grid grid-cols-2 gap-3">
                    {commonExcludePatterns.map((pattern) => (
                      <div key={pattern.value} className="flex items-center space-x-3 p-3 border-2 border-black bg-white hover:bg-gray-50 transition-all">
                        <Checkbox
                          checked={taskForm.exclude_patterns.includes(pattern.value)}
                          onCheckedChange={() => toggleExcludePattern(pattern.value)}
                          className="rounded-none border-2 border-black data-[state=checked]:bg-primary data-[state=checked]:text-white"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold uppercase">{pattern.label}</p>
                          <p className="text-xs text-gray-500 font-bold">{pattern.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 自定义排除模式 */}
                  <div className="space-y-2">
                    <Label className="font-bold uppercase">自定义排除模式</Label>
                    <div className="flex space-x-2">
                      <Input
                        placeholder="例如: *.tmp, test/**"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addCustomPattern(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="retro-input h-10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          addCustomPattern(input.value);
                          input.value = '';
                        }}
                        className="retro-btn bg-white text-black h-10"
                      >
                        添加
                      </Button>
                    </div>
                  </div>

                  {/* 已选择的排除模式 */}
                  {taskForm.exclude_patterns.length > 0 && (
                    <div className="space-y-2">
                      <Label className="font-bold uppercase">已选择的排除模式</Label>
                      <div className="flex flex-wrap gap-2">
                        {taskForm.exclude_patterns.map((pattern) => (
                          <Badge
                            key={pattern}
                            variant="secondary"
                            className="cursor-pointer hover:bg-red-100 hover:text-red-800 rounded-none border-2 border-black bg-gray-100 text-black font-mono font-bold"
                            onClick={() => removeExcludePattern(pattern)}
                          >
                            {pattern} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-6 font-mono">
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-bold uppercase">扫描配置</Label>
                    <p className="text-sm text-gray-500 mt-1 font-bold">
                      配置代码扫描的详细参数
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 p-3 border-2 border-black bg-white">
                        <Checkbox
                          checked={taskForm.scan_config.include_tests}
                          onCheckedChange={(checked) =>
                            setTaskForm({
                              ...taskForm,
                              scan_config: { ...taskForm.scan_config, include_tests: !!checked }
                            })
                          }
                          className="rounded-none border-2 border-black data-[state=checked]:bg-primary data-[state=checked]:text-white"
                        />
                        <div>
                          <p className="text-sm font-bold uppercase">包含测试文件</p>
                          <p className="text-xs text-gray-500 font-bold">扫描 *test*, *spec* 等测试文件</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 border-2 border-black bg-white">
                        <Checkbox
                          checked={taskForm.scan_config.include_docs}
                          onCheckedChange={(checked) =>
                            setTaskForm({
                              ...taskForm,
                              scan_config: { ...taskForm.scan_config, include_docs: !!checked }
                            })
                          }
                          className="rounded-none border-2 border-black data-[state=checked]:bg-primary data-[state=checked]:text-white"
                        />
                        <div>
                          <p className="text-sm font-bold uppercase">包含文档文件</p>
                          <p className="text-xs text-gray-500 font-bold">扫描 README, docs 等文档文件</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="max_file_size" className="font-bold uppercase">最大文件大小 (KB)</Label>
                        <Input
                          id="max_file_size"
                          type="number"
                          value={taskForm.scan_config.max_file_size}
                          onChange={(e) =>
                            setTaskForm({
                              ...taskForm,
                              scan_config: {
                                ...taskForm.scan_config,
                                max_file_size: parseInt(e.target.value) || 200
                              }
                            })
                          }
                          min="1"
                          max="10240"
                          className="retro-input h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="analysis_depth" className="font-bold uppercase">分析深度</Label>
                        <Select
                          value={taskForm.scan_config.analysis_depth}
                          onValueChange={(value: any) =>
                            setTaskForm({
                              ...taskForm,
                              scan_config: { ...taskForm.scan_config, analysis_depth: value }
                            })
                          }
                        >
                          <SelectTrigger className="retro-input h-10 rounded-none border-2 border-black shadow-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <SelectItem value="basic" className="font-mono">基础扫描</SelectItem>
                            <SelectItem value="standard" className="font-mono">标准扫描</SelectItem>
                            <SelectItem value="deep" className="font-mono">深度扫描</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* 分析深度说明 */}
                  <div className="bg-amber-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div className="text-sm font-mono">
                        <p className="font-bold text-amber-900 mb-2 uppercase">分析深度说明：</p>
                        <ul className="text-amber-800 space-y-1 text-xs font-bold">
                          <li>• <strong>基础扫描</strong>：快速检查语法错误和基本问题</li>
                          <li>• <strong>标准扫描</strong>：包含代码质量、安全性和性能分析</li>
                          <li>• <strong>深度扫描</strong>：全面分析，包含复杂度、可维护性等高级指标</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end space-x-3 pt-6 border-t-2 border-black bg-gray-50 -mx-6 -mb-6 p-6">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
              className="retro-btn bg-white text-black h-12 px-6 font-bold uppercase"
            >
              取消
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!taskForm.project_id || creating}
              className="retro-btn bg-primary text-white h-12 px-6 font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-none h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  创建中...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  创建任务
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* 终端进度对话框 */}
      <TerminalProgressDialog
        open={showTerminalDialog}
        onOpenChange={setShowTerminalDialog}
        taskId={currentTaskId}
        taskType="repository"
      />
    </Dialog>
  );
}