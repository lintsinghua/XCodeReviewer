/**
 * Audit Tasks Page
 * Cyberpunk Terminal Aesthetic
 * 支持普通审计任务和Agent审计任务
 */

import { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  FileText,
  Calendar,
  Plus,
  XCircle,
  ArrowUpRight,
  Shield,
  Terminal,
  Bot,
  Zap
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { AuditTask } from "@/shared/types";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CreateTaskDialog from "@/components/audit/CreateTaskDialog";
import TerminalProgressDialog from "@/components/audit/TerminalProgressDialog";
import { calculateTaskProgress } from "@/shared/utils/utils";
import { getAgentTasks, cancelAgentTask, type AgentTask } from "@/shared/api/agentTasks";

// Zombie task detection config
const ZOMBIE_TIMEOUT = 180000; // 3 minutes without progress is potentially stuck

// 任务类型标签
type TaskTab = "regular" | "agent";

export default function AuditTasks() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TaskTab>("agent"); // 默认显示Agent任务

  // 普通任务状态
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // Agent任务状态
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [agentLoading, setAgentLoading] = useState(true);
  const [cancellingAgentTaskId, setCancellingAgentTaskId] = useState<string | null>(null);

  // Zombie task detection: track progress and time for each task
  const taskProgressRef = useRef<Map<string, { progress: number; time: number }>>(new Map());

  useEffect(() => {
    loadTasks();
    loadAgentTasks();
  }, []);

  // 加载Agent任务
  const loadAgentTasks = async () => {
    try {
      setAgentLoading(true);
      const data = await getAgentTasks();
      setAgentTasks(data);
    } catch (error) {
      console.error('Failed to load agent tasks:', error);
      toast.error("加载Agent任务失败");
    } finally {
      setAgentLoading(false);
    }
  };

  // Silently update active tasks progress (no loading state trigger)
  useEffect(() => {
    const activeTasks = tasks.filter(
      task => task.status === 'running' || task.status === 'pending'
    );

    if (activeTasks.length === 0) {
      taskProgressRef.current.clear();
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const updatedData = await api.getAuditTasks();

        setTasks(prevTasks => {
          return prevTasks.map(prevTask => {
            const updated = updatedData.find(t => t.id === prevTask.id);
            if (!updated) return prevTask;

            // Zombie task detection
            if (updated.status === 'running') {
              const currentProgress = updated.scanned_files || 0;
              const lastRecord = taskProgressRef.current.get(updated.id);

              if (lastRecord) {
                if (currentProgress !== lastRecord.progress) {
                  taskProgressRef.current.set(updated.id, { progress: currentProgress, time: Date.now() });
                } else if (Date.now() - lastRecord.time > ZOMBIE_TIMEOUT) {
                  toast.warning(`任务 "${updated.project?.name || '未知'}" 可能已停止响应`, {
                    id: `zombie-${updated.id}`,
                    duration: 10000,
                    action: {
                      label: '取消任务',
                      onClick: () => handleCancelTask(updated.id),
                    },
                  });
                  taskProgressRef.current.set(updated.id, { progress: currentProgress, time: Date.now() });
                }
              } else {
                taskProgressRef.current.set(updated.id, { progress: currentProgress, time: Date.now() });
              }
            } else {
              taskProgressRef.current.delete(updated.id);
            }

            if (
              updated.status !== prevTask.status ||
              updated.scanned_files !== prevTask.scanned_files ||
              updated.issues_count !== prevTask.issues_count
            ) {
              return updated;
            }
            return prevTask;
          });
        });
      } catch (error) {
        console.error('静默更新任务列表失败:', error);
        toast.error("获取任务状态失败，请检查网络连接", {
          id: 'network-error',
          duration: 5000,
        });
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [tasks.map(t => t.id + t.status).join(',')]);

  // 自动刷新Agent任务
  useEffect(() => {
    const activeAgentTasks = agentTasks.filter(
      task => task.status === 'running' || task.status === 'pending'
    );

    if (activeAgentTasks.length === 0) return;

    const intervalId = setInterval(loadAgentTasks, 5000);
    return () => clearInterval(intervalId);
  }, [agentTasks.map(t => t.id + t.status).join(',')]);

  const handleCancelTask = async (taskId: string) => {
    if (cancellingTaskId) return;

    try {
      setCancellingTaskId(taskId);
      await api.cancelAuditTask(taskId);
      toast.success("任务已取消");
      await loadTasks();
    } catch (error: any) {
      console.error('取消任务失败:', error);
      toast.error(error?.response?.data?.detail || "取消任务失败");
    } finally {
      setCancellingTaskId(null);
    }
  };

  const handleCancelAgentTask = async (taskId: string) => {
    if (cancellingAgentTaskId) return;

    try {
      setCancellingAgentTaskId(taskId);
      await cancelAgentTask(taskId);
      toast.success("Agent任务已取消");
      await loadAgentTasks();
    } catch (error: any) {
      console.error('取消Agent任务失败:', error);
      toast.error(error?.response?.data?.detail || "取消Agent任务失败");
    } finally {
      setCancellingAgentTaskId(null);
    }
  };

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

  const handleFastScanStarted = (taskId: string) => {
    setCurrentTaskId(taskId);
    setShowTerminal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="cyber-badge-success">完成</Badge>;
      case 'running':
        return <Badge className="cyber-badge-info">运行中</Badge>;
      case 'failed':
        return <Badge className="cyber-badge-danger">失败</Badge>;
      case 'cancelled':
        return <Badge className="cyber-badge-muted">已取消</Badge>;
      default:
        return <Badge className="cyber-badge-muted">等待中</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'running': return <Activity className="w-4 h-4 text-sky-400" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-gray-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
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

  const filteredAgentTasks = agentTasks.filter(task => {
    const matchesSearch = (task.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.task_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // 统计数据
  const regularStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    running: tasks.filter(t => t.status === 'running').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  const agentStats = {
    total: agentTasks.length,
    completed: agentTasks.filter(t => t.status === 'completed').length,
    running: agentTasks.filter(t => t.status === 'running').length,
    failed: agentTasks.filter(t => t.status === 'failed').length,
  };

  const currentStats = activeTab === "agent" ? agentStats : regularStats;

  if ((activeTab === "regular" && loading) || (activeTab === "agent" && agentLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">加载任务数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-[#0a0a0f] min-h-screen font-mono relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* Tab 切换 - 卡片式设计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
        {/* Agent任务卡片 */}
        <button
          onClick={() => setActiveTab("agent")}
          className={`
            relative group text-left p-5 rounded-xl font-mono
            transition-all duration-300 border-2 overflow-hidden
            ${activeTab === "agent"
              ? "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary shadow-lg shadow-primary/20"
              : "bg-gray-900/50 border-gray-800 hover:border-primary/50 hover:bg-gray-900/80"
            }
          `}
        >
          {/* 背景装饰 */}
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-opacity duration-300 ${activeTab === "agent" ? "bg-primary/20 opacity-100" : "bg-primary/5 opacity-0 group-hover:opacity-50"
            }`} />

          <div className="relative flex items-start gap-4">
            {/* 图标区域 */}
            <div className={`
              flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center
              transition-all duration-300
              ${activeTab === "agent"
                ? "bg-primary/30 shadow-lg shadow-primary/30"
                : "bg-gray-800/80 group-hover:bg-primary/20"
              }
            `}>
              <Bot className={`w-7 h-7 transition-colors duration-300 ${activeTab === "agent" ? "text-primary" : "text-gray-400 group-hover:text-primary"
                }`} />
            </div>

            {/* 内容区域 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`text-lg font-mono font-bold uppercase tracking-[0.15em] transition-colors duration-300 ${activeTab === "agent" ? "text-primary text-glow-primary" : "text-gray-300 group-hover:text-primary"}`}>
                  Agent 智能审计
                </h3>
                {agentStats.running > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary/30 text-primary border border-primary/50 animate-pulse">
                    {agentStats.running} 运行中
                  </span>
                )}
                {activeTab === "agent" && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary text-black">
                    当前
                  </span>
                )}
              </div>
              <p className={`text-sm transition-colors duration-300 ${activeTab === "agent" ? "text-gray-300" : "text-gray-500 group-hover:text-gray-400"
                }`}>
                LLM 驱动的多 Agent 协同深度审计，支持智能漏洞挖掘与验证
              </p>

              {/* 统计数据 */}
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className={`transition-colors duration-300 ${activeTab === "agent" ? "text-gray-400" : "text-gray-600"}`}>
                  共 <span className="font-bold text-white">{agentStats.total}</span> 个任务
                </span>
                <span className="text-emerald-400">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  {agentStats.completed}
                </span>
                {agentStats.failed > 0 && (
                  <span className="text-rose-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {agentStats.failed}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 选中指示条 */}
          {activeTab === "agent" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary to-transparent" />
          )}
        </button>

        {/* 快速扫描任务卡片 */}
        <button
          onClick={() => setActiveTab("regular")}
          className={`
            relative group text-left p-5 rounded-xl font-mono
            transition-all duration-300 border-2 overflow-hidden
            ${activeTab === "regular"
              ? "bg-gradient-to-br from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-500 shadow-lg shadow-cyan-500/20"
              : "bg-gray-900/50 border-gray-800 hover:border-cyan-500/50 hover:bg-gray-900/80"
            }
          `}
        >
          {/* 背景装饰 */}
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transition-opacity duration-300 ${activeTab === "regular" ? "bg-cyan-500/20 opacity-100" : "bg-cyan-500/5 opacity-0 group-hover:opacity-50"
            }`} />

          <div className="relative flex items-start gap-4">
            {/* 图标区域 */}
            <div className={`
              flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center
              transition-all duration-300
              ${activeTab === "regular"
                ? "bg-cyan-500/30 shadow-lg shadow-cyan-500/30"
                : "bg-gray-800/80 group-hover:bg-cyan-500/20"
              }
            `}>
              <Zap className={`w-7 h-7 transition-colors duration-300 ${activeTab === "regular" ? "text-cyan-400" : "text-gray-400 group-hover:text-cyan-400"
                }`} />
            </div>

            {/* 内容区域 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`text-lg font-mono font-bold uppercase tracking-[0.15em] transition-colors duration-300 ${activeTab === "regular" ? "text-cyan-400 text-glow-cyan" : "text-gray-300 group-hover:text-cyan-400"}`}>
                  快速扫描任务
                </h3>
                {regularStats.running > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 animate-pulse">
                    {regularStats.running} 运行中
                  </span>
                )}
                {activeTab === "regular" && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500 text-black">
                    当前
                  </span>
                )}
              </div>
              <p className={`text-sm transition-colors duration-300 ${activeTab === "regular" ? "text-gray-300" : "text-gray-500 group-hover:text-gray-400"
                }`}>
                传统规则引擎驱动的快速代码扫描，适合大规模批量检测
              </p>

              {/* 统计数据 */}
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className={`transition-colors duration-300 ${activeTab === "regular" ? "text-gray-400" : "text-gray-600"}`}>
                  共 <span className="font-bold text-white">{regularStats.total}</span> 个任务
                </span>
                <span className="text-emerald-400">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  {regularStats.completed}
                </span>
                {regularStats.failed > 0 && (
                  <span className="text-rose-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {regularStats.failed}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 选中指示条 */}
          {activeTab === "regular" && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-cyan-500 to-transparent" />
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">总任务数</p>
              <p className="stat-value">{currentStats.total}</p>
            </div>
            <div className="stat-icon text-primary">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">已完成</p>
              <p className="stat-value">{currentStats.completed}</p>
            </div>
            <div className="stat-icon text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">运行中</p>
              <p className="stat-value">{currentStats.running}</p>
            </div>
            <div className="stat-icon text-sky-400">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">失败</p>
              <p className="stat-value">{currentStats.failed}</p>
            </div>
            <div className="stat-icon text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="cyber-card p-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 z-10" />
            <Input
              placeholder={activeTab === "agent" ? "搜索Agent任务名称..." : "搜索项目名称或任务类型..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="cyber-input !pl-10"
            />
          </div>
          {activeTab === "regular" && (
            <Button className="cyber-btn-primary h-10" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新建任务
            </Button>
          )}
          {activeTab === "agent" && (
            <Button className="cyber-btn-primary h-10" onClick={() => navigate("/")}>
              <Bot className="w-4 h-4 mr-2" />
              新建Agent审计
            </Button>
          )}
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Button
              size="sm"
              onClick={() => setStatusFilter("all")}
              className={`h-10 ${statusFilter === "all" ? "cyber-btn-primary" : "cyber-btn-outline"}`}
            >
              全部
            </Button>
            <Button
              size="sm"
              onClick={() => setStatusFilter("running")}
              className={`h-10 ${statusFilter === "running" ? "bg-sky-500/90 border-sky-500/50 text-white hover:bg-sky-500" : "cyber-btn-outline"}`}
            >
              运行中
            </Button>
            <Button
              size="sm"
              onClick={() => setStatusFilter("completed")}
              className={`h-10 ${statusFilter === "completed" ? "bg-emerald-500/90 border-emerald-500/50 text-white hover:bg-emerald-500" : "cyber-btn-outline"}`}
            >
              已完成
            </Button>
            <Button
              size="sm"
              onClick={() => setStatusFilter("failed")}
              className={`h-10 ${statusFilter === "failed" ? "bg-rose-500/90 border-rose-500/50 text-white hover:bg-rose-500" : "cyber-btn-outline"}`}
            >
              失败
            </Button>
          </div>
        </div>
      </div>

      {/* Agent Task List */}
      {activeTab === "agent" && (
        <>
          {filteredAgentTasks.length > 0 ? (
            <div className="space-y-4 relative z-10">
              {filteredAgentTasks.map((task) => (
                <div key={task.id} className="cyber-card p-6">
                  {/* Task Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${task.status === 'completed' ? 'bg-emerald-500/20' :
                        task.status === 'running' ? 'bg-sky-500/20' :
                          task.status === 'failed' ? 'bg-rose-500/20' :
                            'bg-gray-800/50'
                        }`}>
                        <Bot className={`w-6 h-6 ${task.status === 'completed' ? 'text-emerald-400' :
                          task.status === 'running' ? 'text-sky-400' :
                            task.status === 'failed' ? 'text-rose-400' :
                              'text-gray-400'
                          }`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-white uppercase tracking-wide">
                          {task.name || 'Agent审计任务'}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">
                          {task.current_phase || task.task_type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(task.status)}
                      {task.status === 'running' && (
                        <div className="flex items-center gap-1.5 text-green-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 font-mono">
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-white">{task.total_files}</p>
                      <p className="text-xs text-gray-500 uppercase">文件数</p>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-white">{task.analyzed_files}</p>
                      <p className="text-xs text-gray-500 uppercase">已分析</p>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-amber-400">{task.findings_count}</p>
                      <p className="text-xs text-gray-500 uppercase">发现问题</p>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-sky-400">{task.tool_calls_count || 0}</p>
                      <p className="text-xs text-gray-500 uppercase">工具调用</p>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-primary">{task.security_score?.toFixed(1) || '-'}</p>
                      <p className="text-xs text-gray-500 uppercase">安全评分</p>
                    </div>
                  </div>

                  {/* Severity Distribution */}
                  {task.findings_count > 0 && (
                    <div className="flex gap-4 mb-4 font-mono text-xs">
                      {task.critical_count > 0 && (
                        <span className="text-rose-500">Critical: {task.critical_count}</span>
                      )}
                      {task.high_count > 0 && (
                        <span className="text-orange-500">High: {task.high_count}</span>
                      )}
                      {task.medium_count > 0 && (
                        <span className="text-yellow-500">Medium: {task.medium_count}</span>
                      )}
                      {task.low_count > 0 && (
                        <span className="text-green-500">Low: {task.low_count}</span>
                      )}
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mb-4 font-mono">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-400 uppercase">审计进度</span>
                      <span className="text-sm text-gray-500">
                        {task.analyzed_files || 0} / {task.total_files || 0} 文件
                      </span>
                    </div>
                    <Progress
                      value={task.progress_percentage || 0}
                      className="h-2 bg-gray-800 [&>div]:bg-primary"
                    />
                    <div className="text-right mt-1">
                      <span className="text-xs text-gray-500">
                        {(task.progress_percentage || 0).toFixed(0)}% 完成
                      </span>
                    </div>
                  </div>

                  {/* Task Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <div className="flex items-center space-x-6 text-sm text-gray-500 font-mono">
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
                      {task.tokens_used > 0 && (
                        <div className="flex items-center text-gray-600">
                          <span>{task.tokens_used.toLocaleString()} tokens</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {(task.status === 'running' || task.status === 'pending') && (
                        <>
                          {/* 🔥 查看终端实时流按钮 */}
                          <Link to={`/agent-audit/${task.id}`}>
                            <Button size="sm" className="cyber-btn bg-sky-500/90 border-sky-500/50 text-white hover:bg-sky-500 h-9">
                              <Terminal className="w-4 h-4 mr-2" />
                              查看实时流
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            className="cyber-btn bg-rose-500/90 border-rose-500/50 text-white hover:bg-rose-500 h-9"
                            onClick={() => handleCancelAgentTask(task.id)}
                            disabled={cancellingAgentTaskId === task.id}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            {cancellingAgentTaskId === task.id ? '取消中...' : '取消'}
                          </Button>
                        </>
                      )}
                      {/* 任务详情按钮 */}
                      <Link to={`/agent-audit/${task.id}`}>
                        <Button size="sm" className="cyber-btn-outline h-9">
                          <FileText className="w-4 h-4 mr-2" />
                          查看详情
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cyber-card p-16 text-center relative z-10 border-dashed">
              <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-300 mb-2 uppercase">
                {searchTerm || statusFilter !== "all" ? '未找到匹配的Agent任务' : '暂无Agent审计任务'}
              </h3>
              <p className="text-gray-500 mb-6 font-mono">
                {searchTerm || statusFilter !== "all" ? '尝试调整搜索条件或筛选器' : '创建第一个Agent审计任务开始智能安全审计'}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button className="cyber-btn-primary" onClick={() => navigate("/")}>
                  <Bot className="w-4 h-4 mr-2" />
                  创建Agent审计
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Regular Task List */}
      {activeTab === "regular" && (
        <>
          {filteredTasks.length > 0 ? (
            <div className="space-y-4 relative z-10">
              {filteredTasks.map((task) => (
                <div key={task.id} className="cyber-card p-6">
                  {/* Task Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${task.status === 'completed' ? 'bg-emerald-500/20' :
                        task.status === 'running' ? 'bg-sky-500/20' :
                          task.status === 'failed' ? 'bg-rose-500/20' :
                            'bg-gray-800/50'
                        }`}>
                        {getStatusIcon(task.status)}
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-white uppercase tracking-wide">
                          {task.project?.name || '未知项目'}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">
                          {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(task.status)}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 font-mono">
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-white">{task.total_files}</p>
                      <p className="text-xs text-gray-500 uppercase">文件数</p>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-white">{task.total_lines.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 uppercase">代码行数</p>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-amber-400">{task.issues_count}</p>
                      <p className="text-xs text-gray-500 uppercase">发现问题</p>
                    </div>
                    <div className="text-center p-3 bg-gray-900/50 rounded-lg border border-gray-800">
                      <p className="text-2xl font-bold text-primary">{task.quality_score.toFixed(1)}</p>
                      <p className="text-xs text-gray-500 uppercase">质量评分</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4 font-mono">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-400 uppercase">扫描进度</span>
                      <span className="text-sm text-gray-500">
                        {task.scanned_files || 0} / {task.total_files || 0} 文件
                      </span>
                    </div>
                    <Progress
                      value={calculateTaskProgress(task.scanned_files, task.total_files)}
                      className="h-2 bg-gray-800 [&>div]:bg-primary"
                    />
                    <div className="text-right mt-1">
                      <span className="text-xs text-gray-500">
                        {calculateTaskProgress(task.scanned_files, task.total_files)}% 完成
                      </span>
                    </div>
                  </div>

                  {/* Task Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                    <div className="flex items-center space-x-6 text-sm text-gray-500 font-mono">
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
                      {(task.status === 'running' || task.status === 'pending') && (
                        <Button
                          size="sm"
                          className="cyber-btn bg-rose-500/90 border-rose-500/50 text-white hover:bg-rose-500 h-9"
                          onClick={() => handleCancelTask(task.id)}
                          disabled={cancellingTaskId === task.id}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {cancellingTaskId === task.id ? '取消中...' : '取消'}
                        </Button>
                      )}
                      <Link to={`/tasks/${task.id}`}>
                        <Button size="sm" className="cyber-btn-outline h-9">
                          <FileText className="w-4 h-4 mr-2" />
                          查看详情
                        </Button>
                      </Link>
                      {task.project && (
                        <Link to={`/projects/${task.project.id}`}>
                          <Button size="sm" className="cyber-btn-primary h-9">
                            查看项目
                            <ArrowUpRight className="w-3 h-3 ml-2" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cyber-card p-16 text-center relative z-10 border-dashed">
              <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-300 mb-2 uppercase">
                {searchTerm || statusFilter !== "all" ? '未找到匹配的任务' : '暂无审计任务'}
              </h3>
              <p className="text-gray-500 mb-6 font-mono">
                {searchTerm || statusFilter !== "all" ? '尝试调整搜索条件或筛选器' : '创建第一个审计任务开始代码质量分析'}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button className="cyber-btn-primary" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建任务
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onTaskCreated={loadTasks}
        onFastScanStarted={handleFastScanStarted}
      />

      {/* Terminal Progress Dialog for Fast Scan */}
      <TerminalProgressDialog
        open={showTerminal}
        onOpenChange={setShowTerminal}
        taskId={currentTaskId}
        taskType="repository"
      />
    </div>
  );
}
