import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Search,
  GitBranch,
  Calendar,
  Users,
  ExternalLink,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Inbox
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { Project } from "@/shared/types";
import { toast } from "sonner";
import { isRepositoryProject, getSourceTypeBadge } from "@/shared/utils/projectUtils";

export default function RecycleBin() {
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    loadDeletedProjects();
  }, []);

  const loadDeletedProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getDeletedProjects();
      setDeletedProjects(data);
    } catch (error) {
      console.error('Failed to load deleted projects:', error);
      toast.error("加载已删除项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (project: Project) => {
    setSelectedProject(project);
    setShowRestoreDialog(true);
  };

  const handlePermanentDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setShowPermanentDeleteDialog(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedProject) return;

    try {
      await api.restoreProject(selectedProject.id);
      toast.success(`项目 "${selectedProject.name}" 已恢复`);
      setShowRestoreDialog(false);
      setSelectedProject(null);
      loadDeletedProjects();
    } catch (error) {
      console.error('Failed to restore project:', error);
      toast.error("恢复项目失败");
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!selectedProject) return;

    try {
      // 删除项目数据（后端会同时删除关联的ZIP文件）
      await api.permanentlyDeleteProject(selectedProject.id);

      toast.success(`项目 "${selectedProject.name}" 已永久删除`);
      setShowPermanentDeleteDialog(false);
      setSelectedProject(null);
      loadDeletedProjects();
    } catch (error) {
      console.error('Failed to permanently delete project:', error);
      toast.error("永久删除项目失败");
    }
  };

  const filteredProjects = deletedProjects.filter(project =>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-none h-12 w-12 border-4 border-border border-t-transparent mx-auto mb-4"></div>
          <p className="text-foreground font-mono font-bold uppercase">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 搜索 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black w-4 h-4" />
            <Input
              placeholder="搜索已删除的项目..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* 项目列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <div key={project.id} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all group">
              <div className="p-4 border-b-2 border-black bg-gray-50 flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center text-black text-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {getRepositoryIcon(project.repository_type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display uppercase truncate max-w-[150px]">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1 font-mono">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="flex-shrink-0 bg-red-100 text-red-700 border-2 border-black rounded-none font-bold uppercase text-xs">
                    已删除
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] font-mono border-black ${isRepositoryProject(project) ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                    {getSourceTypeBadge(project.source_type)}
                  </Badge>
                </div>
              </div>

              <div className="p-4 space-y-4 font-mono">
                {/* 项目信息 */}
                <div className="space-y-3">
                  {isRepositoryProject(project) && project.repository_url && (
                    <div className="flex items-center text-xs text-gray-600 font-bold">
                      <GitBranch className="w-4 h-4 mr-2 flex-shrink-0" />
                      <a
                        href={project.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors flex items-center truncate hover:underline"
                      >
                        <span className="truncate">{project.repository_url.replace('https://', '')}</span>
                        <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      删除于 {formatDate(project.updated_at)}
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
                      <Badge key={lang} variant="outline" className="text-xs rounded-none border-black bg-gray-100 font-mono">
                        {lang}
                      </Badge>
                    ))}
                    {JSON.parse(project.programming_languages).length > 4 && (
                      <Badge variant="outline" className="text-xs rounded-none border-black bg-gray-100 font-mono">
                        +{JSON.parse(project.programming_languages).length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-2 border-t-2 border-black mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-green-700 hover:text-white hover:bg-green-600 border-2 border-black rounded-none h-9 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                    onClick={() => handleRestoreClick(project)}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    恢复
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-red-700 hover:text-white hover:bg-red-600 border-2 border-black rounded-none h-9 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                    onClick={() => handlePermanentDeleteClick(project)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    永久删除
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full">
            <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-gray-100 border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Inbox className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-black uppercase mb-2 font-display">
                  {searchTerm ? '未找到匹配的项目' : '回收站为空'}
                </h3>
                <p className="text-gray-500 font-mono max-w-md">
                  {searchTerm ? '尝试调整搜索条件' : '回收站中没有已删除的项目'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 恢复项目确认对话框 */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent className="retro-card border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 bg-white max-w-md">
          <AlertDialogHeader className="p-6 border-b-2 border-black bg-gray-50">
            <AlertDialogTitle className="text-xl font-display font-bold uppercase flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-green-600" />
              确认恢复项目
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-4 font-mono text-gray-600">
              您确定要恢复项目 <span className="font-bold text-black">"{selectedProject?.name}"</span> 吗？
              <br />
              <br />
              恢复后，该项目将重新出现在项目列表中，您可以继续使用该项目的所有功能。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-6 bg-white flex gap-3">
            <AlertDialogCancel className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 font-bold uppercase">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              className="retro-btn bg-green-600 text-white border-2 border-black hover:bg-green-700 rounded-none h-10 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 永久删除确认对话框 */}
      <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
        <AlertDialogContent className="retro-card border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 bg-white max-w-md">
          <AlertDialogHeader className="p-6 border-b-2 border-black bg-red-50">
            <AlertDialogTitle className="text-xl font-display font-bold uppercase flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              警告：永久删除项目
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-4 font-mono text-gray-600">
              您确定要<span className="font-bold text-red-600 uppercase">永久删除</span>项目 <span className="font-bold text-black">"{selectedProject?.name}"</span> 吗？
              <br />
              <br />
              <div className="bg-red-100 border-2 border-red-500 p-4 my-3 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                <p className="text-red-800 font-bold mb-2 uppercase flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  此操作不可撤销！
                </p>
                <ul className="list-disc list-inside text-red-700 space-y-1 text-xs font-bold">
                  <li>项目数据将被永久删除</li>
                  <li>相关的审计任务可能会受影响</li>
                  <li>无法通过任何方式恢复</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-6 bg-white flex gap-3">
            <AlertDialogCancel className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 font-bold uppercase">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPermanentDelete}
              className="retro-btn bg-red-600 text-white border-2 border-black hover:bg-red-700 rounded-none h-10 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              确认永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

