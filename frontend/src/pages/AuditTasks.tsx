import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  FileText,
  Calendar,
  Plus
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { AuditTask } from "@/shared/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import { calculateTaskProgress } from "@/shared/utils/utils";

export default function AuditTasks() {
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  // 静默更新活动任务的进度（不触发loading状态）
  useEffect(() => {
    const activeTasks = tasks.filter(
      task => task.status === 'running' || task.status === 'pending'
    );

    if (activeTasks.length === 0) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        // 只获取活动任务的最新数据
        const updatedData = await api.getAuditTasks();

        // 使用函数式更新，确保基于最新状态
        setTasks(prevTasks => {
          return prevTasks.map(prevTask => {
            const updated = updatedData.find(t => t.id === prevTask.id);
            // 只有在进度、状态或问题数真正变化时才更新
            if (updated && (
              updated.status !== prevTask.status ||
              updated.scanned_files !== prevTask.scanned_files ||
              updated.issues_count !== prevTask.issues_count
            )) {
              return updated;
            }
            return prevTask;
          });
        });
      } catch (error) {
        console.error('静默更新任务列表失败:', error);
      }
    }, 3000); // 每3秒静默更新一次

    return () => clearInterval(intervalId);
  }, [tasks.map(t => t.id + t.status).join(',')]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error("加载任务失败");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-red-50 text-red-800';
      case 'failed': return 'bg-red-100 text-red-900';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'cancelled': return <Clock className="w-4 h-4" />;
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-none h-32 w-32 border-8 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">总任务数</p>
              <p className="text-3xl font-bold text-black font-mono">{tasks.length}</p>
            </div>
            <div className="w-10 h-10 bg-primary border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">已完成</p>
              <p className="text-3xl font-bold text-green-600 font-mono">{tasks.filter(t => t.status === 'completed').length}</p>
            </div>
            <div className="w-10 h-10 bg-green-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">运行中</p>
              <p className="text-3xl font-bold text-orange-600 font-mono">{tasks.filter(t => t.status === 'running').length}</p>
            </div>
            <div className="w-10 h-10 bg-orange-500 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">失败</p>
              <p className="text-3xl font-bold text-red-600 font-mono">{tasks.filter(t => t.status === 'failed').length}</p>
            </div>
            <div className="w-10 h-10 bg-red-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4">
        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-black w-4 h-4" />
            <Input
              placeholder="搜索项目名称或任务类型..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 retro-input h-10"
            />
          </div>
          <Button className="retro-btn bg-primary text-white hover:bg-primary/90 h-10 px-4 font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建任务
          </Button>
          <div className="flex space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className={`retro-btn h-10 ${statusFilter === "all" ? "bg-black text-white" : "bg-white text-black hover:bg-gray-100"}`}
            >
              全部
            </Button>
            <Button
              variant={statusFilter === "running" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("running")}
              className={`retro-btn h-10 ${statusFilter === "running" ? "bg-orange-500 text-white" : "bg-white text-black hover:bg-orange-100"}`}
            >
              运行中
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
              className={`retro-btn h-10 ${statusFilter === "completed" ? "bg-green-600 text-white" : "bg-white text-black hover:bg-green-100"}`}
            >
              已完成
            </Button>
            <Button
              variant={statusFilter === "failed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("failed")}
              className={`retro-btn h-10 ${statusFilter === "failed" ? "bg-red-600 text-white" : "bg-white text-black hover:bg-red-100"}`}
            >
              失败
            </Button>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <div key={task.id} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
              <div className="flex items-center justify-between mb-6 border-b-2 border-dashed border-gray-300 pb-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${task.status === 'completed' ? 'bg-green-100 text-green-600' :
                    task.status === 'running' ? 'bg-orange-100 text-orange-600' :
                      task.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {getStatusIcon(task.status)}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-black font-display uppercase">
                      {task.project?.name || '未知项目'}
                    </h3>
                    <p className="text-sm text-gray-600 font-mono font-bold">
                      {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                    </p>
                  </div>
                </div>
                <Badge className={`rounded-none border-2 border-black font-bold uppercase ${getStatusColor(task.status)}`}>
                  {task.status === 'completed' ? '已完成' :
                    task.status === 'running' ? '运行中' :
                      task.status === 'failed' ? '失败' :
                        task.status === 'cancelled' ? '已取消' : '等待中'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 font-mono">
                <div className="text-center p-3 bg-blue-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{task.total_files}</div>
                  <p className="text-xs text-blue-800 font-bold uppercase">文件数</p>
                </div>
                <div className="text-center p-3 bg-purple-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-2xl font-bold text-purple-600 mb-1">{task.total_lines.toLocaleString()}</div>
                  <p className="text-xs text-purple-800 font-bold uppercase">代码行数</p>
                </div>
                <div className="text-center p-3 bg-orange-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-2xl font-bold text-orange-600 mb-1">{task.issues_count}</div>
                  <p className="text-xs text-orange-800 font-bold uppercase">发现问题</p>
                </div>
                <div className="text-center p-3 bg-green-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-2xl font-bold text-green-600 mb-1">{task.quality_score.toFixed(1)}</div>
                  <p className="text-xs text-green-800 font-bold uppercase">质量评分</p>
                </div>
              </div>

              {/* 扫描进度 */}
              <div className="mb-6 font-mono">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-black uppercase">扫描进度</span>
                  <span className="text-sm font-bold text-gray-600">
                    {task.scanned_files || 0} / {task.total_files || 0} 文件
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-4 border-2 border-black">
                  <div
                    className="bg-primary h-full transition-all duration-300 border-r-2 border-black"
                    style={{ width: `${calculateTaskProgress(task.scanned_files, task.total_files)}%` }}
                  ></div>
                </div>
                <div className="text-right mt-1">
                  <span className="text-xs font-bold text-gray-600">
                    {calculateTaskProgress(task.scanned_files, task.total_files)}% 完成
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t-2 border-black bg-gray-50 -mx-6 -mb-6 p-6 mt-6">
                <div className="flex items-center space-x-6 text-sm text-gray-600 font-mono font-bold">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(task.created_at)}
                  </div>
                  {task.completed_at && (
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {formatDate(task.completed_at)}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Link to={`/tasks/${task.id}`}>
                    <Button variant="outline" size="sm" className="retro-btn bg-white text-black hover:bg-gray-100 h-9">
                      <FileText className="w-4 h-4 mr-2" />
                      查看详情
                    </Button>
                  </Link>
                  {task.project && (
                    <Link to={`/projects/${task.project.id}`}>
                      <Button size="sm" className="retro-btn bg-black text-white hover:bg-gray-800 h-9">
                        查看项目
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-gray-100 border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Activity className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-black uppercase mb-2 font-display">
            {searchTerm || statusFilter !== "all" ? '未找到匹配的任务' : '暂无审计任务'}
          </h3>
          <p className="text-gray-500 mb-8 max-w-md font-mono">
            {searchTerm || statusFilter !== "all" ? '尝试调整搜索条件或筛选器' : '创建第一个审计任务开始代码质量分析'}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Button className="retro-btn bg-primary text-white hover:bg-primary/90 h-12 px-8 text-lg font-bold uppercase" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-5 h-5 mr-2" />
              创建任务
            </Button>
          )}
        </div>
      )}

      {/* 新建任务对话框 */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTaskCreated={loadTasks}
      />
    </div>
  );
}