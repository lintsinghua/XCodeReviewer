/**
 * Agent 审计页面
 * 机械终端风格的 AI Agent 审计界面
 * 支持 LLM 思考过程和工具调用的实时流式展示
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Terminal, Bot, Cpu, Shield, AlertTriangle, CheckCircle2,
  Loader2, Code, Zap, Activity, ChevronRight, XCircle,
  FileCode, Search, Bug, Lock, Play, Square, RefreshCw,
  ArrowLeft, Download, ExternalLink, Brain, Wrench, 
  ChevronDown, ChevronUp, Clock, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAgentStream } from "@/hooks/useAgentStream";
import {
  type AgentTask,
  type AgentEvent,
  type AgentFinding,
  getAgentTask,
  getAgentEvents,
  getAgentFindings,
  cancelAgentTask,
  streamAgentEvents,
} from "@/shared/api/agentTasks";

// 事件类型图标映射
const eventTypeIcons: Record<string, React.ReactNode> = {
  phase_start: <Zap className="w-3 h-3 text-cyan-400" />,
  phase_complete: <CheckCircle2 className="w-3 h-3 text-green-400" />,
  thinking: <Cpu className="w-3 h-3 text-purple-400" />,
  tool_call: <Code className="w-3 h-3 text-yellow-400" />,
  tool_result: <CheckCircle2 className="w-3 h-3 text-green-400" />,
  tool_error: <XCircle className="w-3 h-3 text-red-400" />,
  finding_new: <Bug className="w-3 h-3 text-orange-400" />,
  finding_verified: <Shield className="w-3 h-3 text-red-400" />,
  info: <Activity className="w-3 h-3 text-blue-400" />,
  warning: <AlertTriangle className="w-3 h-3 text-yellow-400" />,
  error: <XCircle className="w-3 h-3 text-red-500" />,
  progress: <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />,
  task_complete: <CheckCircle2 className="w-3 h-3 text-green-500" />,
  task_error: <XCircle className="w-3 h-3 text-red-500" />,
  task_cancel: <Square className="w-3 h-3 text-yellow-500" />,
};

// 事件类型颜色映射
const eventTypeColors: Record<string, string> = {
  phase_start: "text-cyan-400 font-bold",
  phase_complete: "text-green-400",
  thinking: "text-purple-300",
  tool_call: "text-yellow-300",
  tool_result: "text-green-300",
  tool_error: "text-red-400",
  finding_new: "text-orange-300",
  finding_verified: "text-red-300",
  info: "text-gray-300",
  warning: "text-yellow-300",
  error: "text-red-400",
  progress: "text-cyan-300",
  task_complete: "text-green-400 font-bold",
  task_error: "text-red-400 font-bold",
  task_cancel: "text-yellow-400",
};

// 严重程度颜色
const severityColors: Record<string, string> = {
  critical: "bg-red-900/50 border-red-500 text-red-300",
  high: "bg-orange-900/50 border-orange-500 text-orange-300",
  medium: "bg-yellow-900/50 border-yellow-500 text-yellow-300",
  low: "bg-blue-900/50 border-blue-500 text-blue-300",
  info: "bg-gray-900/50 border-gray-500 text-gray-300",
};

const severityIcons: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
  info: "⚪",
};

export default function AgentAuditPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<AgentTask | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [findings, setFindings] = useState<AgentFinding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
  const [showThinking, setShowThinking] = useState(true);
  const [showToolDetails, setShowToolDetails] = useState(true);
  
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const thinkingEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 使用增强版流式 Hook
  const {
    thinking,
    isThinking,
    toolCalls,
    currentPhase: streamPhase,
    progress: streamProgress,
    connect: connectStream,
    disconnect: disconnectStream,
    isConnected: isStreamConnected,
  } = useAgentStream(taskId || null, {
    includeThinking: true,
    includeToolCalls: true,
    onFinding: () => loadFindings(),
    onComplete: () => {
      loadTask();
      loadFindings();
    },
    onError: (err) => {
      console.error("Stream error:", err);
    },
  });
  
  // 是否完成
  const isComplete = task?.status === "completed" || task?.status === "failed" || task?.status === "cancelled";
  
  // 加载任务信息
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    
    try {
      const taskData = await getAgentTask(taskId);
      setTask(taskData);
    } catch (error) {
      console.error("Failed to load task:", error);
      toast.error("加载任务失败");
    }
  }, [taskId]);
  
  // 加载事件
  const loadEvents = useCallback(async () => {
    if (!taskId) return;
    
    try {
      const eventsData = await getAgentEvents(taskId, { limit: 500 });
      setEvents(eventsData);
    } catch (error) {
      console.error("Failed to load events:", error);
    }
  }, [taskId]);
  
  // 加载发现
  const loadFindings = useCallback(async () => {
    if (!taskId) return;
    
    try {
      const findingsData = await getAgentFindings(taskId);
      setFindings(findingsData);
    } catch (error) {
      console.error("Failed to load findings:", error);
    }
  }, [taskId]);
  
  // 初始化加载
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadTask(), loadEvents(), loadFindings()]);
      setIsLoading(false);
    };
    
    init();
  }, [loadTask, loadEvents, loadFindings]);
  
  // 连接增强版流式 API
  useEffect(() => {
    if (!taskId || isComplete || isLoading) return;
    
    connectStream();
    setIsStreaming(true);
    
    return () => {
      disconnectStream();
      setIsStreaming(false);
    };
  }, [taskId, isComplete, isLoading, connectStream, disconnectStream]);
  
  // 旧版事件流（作为后备）
  useEffect(() => {
    if (!taskId || isComplete || isLoading) return;
    
    const startStreaming = async () => {
      abortControllerRef.current = new AbortController();
      
      try {
        const lastSequence = events.length > 0 ? Math.max(...events.map(e => e.sequence)) : 0;
        
        for await (const event of streamAgentEvents(taskId, lastSequence, abortControllerRef.current.signal)) {
          setEvents(prev => {
            // 避免重复
            if (prev.some(e => e.id === event.id)) return prev;
            return [...prev, event];
          });
          
          // 如果是发现事件，刷新发现列表
          if (event.event_type.startsWith("finding_")) {
            loadFindings();
          }
          
          // 如果是结束事件，刷新任务状态
          if (["task_complete", "task_error", "task_cancel"].includes(event.event_type)) {
            loadTask();
            loadFindings();
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Event stream error:", error);
        }
      }
    };
    
    startStreaming();
    
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [taskId, isComplete, isLoading, loadTask, loadFindings]);
  
  // 自动滚动
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);
  
  // 更新时间
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // 定期轮询任务状态（作为 SSE 的后备机制）
  useEffect(() => {
    if (!taskId || isComplete || isLoading) return;
    
    // 每 3 秒轮询一次任务状态
    const pollInterval = setInterval(async () => {
      try {
        const taskData = await getAgentTask(taskId);
        setTask(taskData);
        
        // 如果任务已完成/失败/取消，刷新其他数据
        if (taskData.status === "completed" || taskData.status === "failed" || taskData.status === "cancelled") {
          await loadEvents();
          await loadFindings();
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Failed to poll task status:", error);
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [taskId, isComplete, isLoading, loadEvents, loadFindings]);
  
  // 取消任务
  const handleCancel = async () => {
    if (!taskId) return;
    
    if (!confirm("确定要取消此任务吗？已分析的结果将被保留。")) {
      return;
    }
    
    try {
      await cancelAgentTask(taskId);
      toast.success("任务已取消");
      loadTask();
    } catch (error) {
      toast.error("取消失败");
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-mono">正在加载...</p>
        </div>
      </div>
    );
  }
  
  if (!task) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-400 font-mono">任务不存在</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/tasks")}
          >
            返回任务列表
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      {/* 顶部状态栏 */}
      <div className="h-14 bg-[#12121a] border-b-2 border-cyan-900/50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-cyan-900/30 rounded border border-cyan-700/50">
              <Bot className={`w-5 h-5 text-cyan-400 ${!isComplete && "animate-pulse"}`} />
            </div>
            <div>
              <span className="text-xs text-gray-500 block">AGENT_AUDIT</span>
              <span className="text-sm font-bold tracking-wider text-cyan-400">
                {task.name || `任务 ${task.id.slice(0, 8)}`}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* 阶段指示器 */}
          <PhaseIndicator phase={task.current_phase} status={task.status} />
          
          {/* 状态徽章 */}
          <StatusBadge status={task.status} />
          
          {/* 时间 */}
          <span className="text-gray-500 text-sm">{currentTime}</span>
        </div>
      </div>
      
      {/* 错误提示 */}
      {task.status === "failed" && task.error_message && (
        <div className="mx-4 mt-2 p-3 bg-red-900/30 border border-red-700 rounded-lg">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-semibold text-sm">任务执行失败</p>
              <p className="text-red-300/80 text-xs mt-1 font-mono break-all">{task.error_message}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex h-[calc(100vh-56px)]">
        {/* 左侧：执行日志 */}
        <div className="flex-1 p-4 flex flex-col min-w-0">
          
          {/* 思考过程展示区域 */}
          {(isThinking || thinking) && showThinking && (
            <div className="mb-4 bg-purple-950/30 rounded-lg border border-purple-800/50 overflow-hidden">
              <div 
                className="flex items-center justify-between px-3 py-2 bg-purple-900/30 border-b border-purple-800/30 cursor-pointer"
                onClick={() => setShowThinking(!showThinking)}
              >
                <div className="flex items-center gap-2 text-xs text-purple-400">
                  <Brain className={`w-4 h-4 ${isThinking ? "animate-pulse" : ""}`} />
                  <span className="uppercase tracking-wider">AI Thinking</span>
                  {isThinking && (
                    <span className="flex items-center gap-1 text-purple-300">
                      <Sparkles className="w-3 h-3 animate-spin" />
                      <span className="text-[10px]">Processing...</span>
                    </span>
                  )}
                </div>
                {showThinking ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />}
              </div>
              
              <div className="max-h-40 overflow-y-auto">
                <div className="p-3 text-sm text-purple-200/80 font-mono whitespace-pre-wrap">
                  {thinking || "正在思考..."}
                  {isThinking && <span className="animate-pulse text-purple-400">▌</span>}
                </div>
                <div ref={thinkingEndRef} />
              </div>
            </div>
          )}
          
          {/* 工具调用展示区域 */}
          {toolCalls.length > 0 && showToolDetails && (
            <div className="mb-4 bg-yellow-950/20 rounded-lg border border-yellow-800/30 overflow-hidden">
              <div 
                className="flex items-center justify-between px-3 py-2 bg-yellow-900/20 border-b border-yellow-800/20 cursor-pointer"
                onClick={() => setShowToolDetails(!showToolDetails)}
              >
                <div className="flex items-center gap-2 text-xs text-yellow-500">
                  <Wrench className="w-4 h-4" />
                  <span className="uppercase tracking-wider">Tool Calls</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-900/30 border-yellow-700 text-yellow-400">
                    {toolCalls.length}
                  </Badge>
                </div>
                {showToolDetails ? <ChevronUp className="w-4 h-4 text-yellow-500" /> : <ChevronDown className="w-4 h-4 text-yellow-500" />}
              </div>
              
              <div className="max-h-48 overflow-y-auto">
                <div className="p-2 space-y-2">
                  {toolCalls.slice(-5).map((tc, idx) => (
                    <ToolCallCard key={`${tc.name}-${idx}`} toolCall={tc} />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs text-cyan-400">
              <Terminal className="w-4 h-4" />
              <span className="uppercase tracking-wider">Execution Log</span>
              {(isStreaming || isStreamConnected) && (
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">{events.length} events</span>
          </div>
          
          {/* 终端窗口 */}
          <div className="flex-1 bg-[#0d0d12] rounded-lg border border-gray-800 overflow-hidden relative">
            {/* CRT 效果 */}
            <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
              style={{
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 255, 255, 0.03) 1px, rgba(0, 255, 255, 0.03) 2px)",
              }}
            />
            
            <ScrollArea className="h-full">
              <div className="p-4 space-y-1">
                {events.map((event) => (
                  <EventLine key={event.id} event={event} />
                ))}
                
                {/* 光标 */}
                {!isComplete && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-gray-600 text-xs">{currentTime}</span>
                    <span className="text-cyan-400 animate-pulse">▌</span>
                  </div>
                )}
                
                <div ref={eventsEndRef} />
              </div>
            </ScrollArea>
          </div>
          
          {/* 底部控制栏 */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* 进度 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Progress</span>
                <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300"
                    style={{ width: `${task.progress_percentage ?? 0}%` }}
                  />
                </div>
                <span className="text-xs text-cyan-400">{(task.progress_percentage ?? 0).toFixed(0)}%</span>
              </div>
              
              {/* Token 消耗 */}
              {task.total_chunks > 0 && (
                <div className="text-xs text-gray-500">
                  Chunks: <span className="text-gray-300">{task.total_chunks}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {!isComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-8 bg-transparent border-red-800 text-red-400 hover:bg-red-900/30 font-mono text-xs"
                >
                  <Square className="w-3 h-3 mr-1" />
                  取消任务
                </Button>
              )}
              
              {isComplete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/tasks/${taskId}`)}
                  className="h-8 bg-transparent border-cyan-800 text-cyan-400 hover:bg-cyan-900/30 font-mono text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  查看报告
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* 右侧：发现面板 */}
        <div className="w-80 bg-[#12121a] border-l border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-red-400">
                <Shield className="w-4 h-4" />
                <span className="uppercase tracking-wider">Findings</span>
              </div>
              <Badge variant="outline" className="bg-red-900/30 border-red-700 text-red-400">
                {findings.length}
              </Badge>
            </div>
            
            {/* 严重程度统计 */}
            <div className="flex items-center gap-3 mt-3 text-xs">
              {task.critical_count > 0 && (
                <span className="text-red-400">🔴 {task.critical_count}</span>
              )}
              {task.high_count > 0 && (
                <span className="text-orange-400">🟠 {task.high_count}</span>
              )}
              {task.medium_count > 0 && (
                <span className="text-yellow-400">🟡 {task.medium_count}</span>
              )}
              {task.low_count > 0 && (
                <span className="text-blue-400">🟢 {task.low_count}</span>
              )}
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {findings.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无发现</p>
                </div>
              ) : (
                findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))
              )}
            </div>
          </ScrollArea>
          
          {/* 评分 */}
          {isComplete && (
            <div className="p-4 border-t border-gray-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">安全评分</span>
                <span className={`font-bold ${
                  (task.security_score ?? 0) >= 80 ? "text-green-400" :
                  (task.security_score ?? 0) >= 60 ? "text-yellow-400" :
                  "text-red-400"
                }`}>
                  {(task.security_score ?? 0).toFixed(0)}/100
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">已验证</span>
                <span className="text-cyan-400">{task.verified_count}/{task.findings_count}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 阶段指示器组件
function PhaseIndicator({ phase, status }: { phase: string | null; status: string }) {
  const phases = ["planning", "indexing", "analysis", "verification", "reporting"];
  const currentIndex = phase ? phases.indexOf(phase) : -1;
  const isComplete = status === "completed";
  const isFailed = status === "failed";
  
  return (
    <div className="flex items-center gap-1">
      {phases.map((p, idx) => {
        const isActive = p === phase;
        const isPast = isComplete || (currentIndex >= 0 && idx < currentIndex);
        
        return (
          <div
            key={p}
            className={`w-2 h-2 rounded-full transition-all ${
              isActive ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse" :
              isPast ? "bg-cyan-600" :
              isFailed ? "bg-red-900" :
              "bg-gray-700"
            }`}
            title={p}
          />
        );
      })}
      {phase && (
        <span className="ml-2 text-xs text-gray-400 uppercase">{phase}</span>
      )}
    </div>
  );
}

// 状态徽章组件
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { text: string; className: string }> = {
    pending: { text: "PENDING", className: "bg-gray-800 text-gray-400 border-gray-600" },
    initializing: { text: "INIT", className: "bg-blue-900/50 text-blue-400 border-blue-600 animate-pulse" },
    running: { text: "RUNNING", className: "bg-green-900/50 text-green-400 border-green-600 animate-pulse" },
    planning: { text: "PLANNING", className: "bg-purple-900/50 text-purple-400 border-purple-600 animate-pulse" },
    indexing: { text: "INDEXING", className: "bg-cyan-900/50 text-cyan-400 border-cyan-600 animate-pulse" },
    analyzing: { text: "ANALYZING", className: "bg-yellow-900/50 text-yellow-400 border-yellow-600 animate-pulse" },
    verifying: { text: "VERIFYING", className: "bg-orange-900/50 text-orange-400 border-orange-600 animate-pulse" },
    reporting: { text: "REPORTING", className: "bg-indigo-900/50 text-indigo-400 border-indigo-600 animate-pulse" },
    completed: { text: "COMPLETED", className: "bg-green-900/50 text-green-400 border-green-600" },
    failed: { text: "FAILED", className: "bg-red-900/50 text-red-400 border-red-600" },
    cancelled: { text: "CANCELLED", className: "bg-yellow-900/50 text-yellow-400 border-yellow-600" },
  };
  
  const config = statusConfig[status] || statusConfig.pending;
  
  return (
    <Badge variant="outline" className={`${config.className} font-mono text-xs px-2`}>
      {config.text}
    </Badge>
  );
}

// 事件行组件
function EventLine({ event }: { event: AgentEvent }) {
  const icon = eventTypeIcons[event.event_type] || <ChevronRight className="w-3 h-3 text-gray-500" />;
  const colorClass = eventTypeColors[event.event_type] || "text-gray-400";
  
  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString("zh-CN", { hour12: false })
    : "";
  
  return (
    <div className={`flex items-start gap-2 py-0.5 group hover:bg-white/5 px-1 rounded ${colorClass}`}>
      <span className="text-gray-600 text-xs w-20 flex-shrink-0 group-hover:text-gray-500">
        {timestamp}
      </span>
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <span className="flex-1 text-sm break-all">
        {event.message}
        {event.tool_duration_ms && (
          <span className="text-gray-600 ml-2">({event.tool_duration_ms}ms)</span>
        )}
      </span>
    </div>
  );
}

// 工具调用卡片组件
interface ToolCallProps {
  toolCall: {
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
    durationMs?: number;
    status: 'running' | 'success' | 'error';
  };
}

function ToolCallCard({ toolCall }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);
  
  const statusConfig = {
    running: {
      icon: <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />,
      badge: "bg-yellow-900/30 border-yellow-700 text-yellow-400",
      text: "Running",
    },
    success: {
      icon: <CheckCircle2 className="w-3 h-3 text-green-400" />,
      badge: "bg-green-900/30 border-green-700 text-green-400",
      text: "Done",
    },
    error: {
      icon: <XCircle className="w-3 h-3 text-red-400" />,
      badge: "bg-red-900/30 border-red-700 text-red-400",
      text: "Error",
    },
  };
  
  const config = statusConfig[toolCall.status];
  
  return (
    <div className="bg-gray-900/50 rounded border border-gray-700/50 overflow-hidden">
      <div 
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-gray-800/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {config.icon}
          <span className="text-xs font-mono text-gray-300">{toolCall.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {toolCall.durationMs && (
            <span className="text-[10px] text-gray-500">
              <Clock className="w-2.5 h-2.5 inline mr-0.5" />
              {toolCall.durationMs}ms
            </span>
          )}
          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${config.badge}`}>
            {config.text}
          </Badge>
          {expanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-gray-700/50 text-[11px] font-mono">
          {/* 输入 */}
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <div className="p-2 border-b border-gray-800/50">
              <span className="text-gray-500 text-[10px] uppercase">Input:</span>
              <pre className="mt-1 text-cyan-300/80 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                {JSON.stringify(toolCall.input, null, 2).slice(0, 500)}
              </pre>
            </div>
          )}
          
          {/* 输出 */}
          {toolCall.output && (
            <div className="p-2">
              <span className="text-gray-500 text-[10px] uppercase">Output:</span>
              <pre className="mt-1 text-green-300/80 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                {typeof toolCall.output === 'string' 
                  ? toolCall.output.slice(0, 500)
                  : JSON.stringify(toolCall.output, null, 2).slice(0, 500)
                }
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 发现卡片组件
function FindingCard({ finding }: { finding: AgentFinding }) {
  const colorClass = severityColors[finding.severity] || severityColors.info;
  const icon = severityIcons[finding.severity] || "⚪";
  
  return (
    <div className={`p-3 rounded border-l-4 ${colorClass} transition-all hover:brightness-110`}>
      <div className="flex items-start gap-2">
        <span>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{finding.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{finding.vulnerability_type}</p>
          {finding.file_path && (
            <p className="text-xs text-gray-500 mt-1 truncate" title={finding.file_path}>
              <FileCode className="w-3 h-3 inline mr-1" />
              {finding.file_path}:{finding.line_start}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        {finding.is_verified && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-green-900/30 border-green-700 text-green-400">
            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
            已验证
          </Badge>
        )}
        {finding.has_poc && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-900/30 border-red-700 text-red-400">
            <Code className="w-2.5 h-2.5 mr-0.5" />
            PoC
          </Badge>
        )}
      </div>
    </div>
  );
}

