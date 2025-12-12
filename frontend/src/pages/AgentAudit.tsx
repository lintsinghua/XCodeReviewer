/**
 * Agent Audit Page - Simplified Professional Version
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Terminal, Bot, CheckCircle2, Loader2, XCircle,
  Bug, Square, ArrowLeft, Brain, Wrench,
  ChevronDown, ChevronUp, Clock, Eye, EyeOff, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAgentStream } from "@/hooks/useAgentStream";
import {
  type AgentTask,
  type AgentFinding,
  getAgentTask,
  getAgentFindings,
  cancelAgentTask,
} from "@/shared/api/agentTasks";

// ============ Types ============

interface LogItem {
  id: string;
  time: string;
  type: 'thinking' | 'tool' | 'phase' | 'finding' | 'info' | 'error';
  title: string;
  content?: string;
  isStreaming?: boolean;
  tool?: { name: string; duration?: number; status?: 'running' | 'completed' | 'failed' };
  severity?: string;
  agentName?: string;
}

// ============ Constants ============

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-950/50",
  high: "text-orange-400 bg-orange-950/50",
  medium: "text-yellow-400 bg-yellow-950/50",
  low: "text-blue-400 bg-blue-950/50",
  info: "text-gray-400 bg-gray-900/50",
};

const AGENT_COLORS: Record<string, string> = {
  Orchestrator: "text-purple-400 border-purple-500/30 bg-purple-950/20",
  Recon: "text-green-400 border-green-500/30 bg-green-950/20",
  Analysis: "text-blue-400 border-blue-500/30 bg-blue-950/20",
  Verification: "text-red-400 border-red-500/30 bg-red-950/20",
  default: "text-gray-400 border-gray-500/30 bg-gray-950/20",
};

// ============ Components ============

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; icon: React.ReactNode }> = {
    pending: { bg: "bg-gray-700", icon: <Clock className="w-3 h-3" /> },
    running: { bg: "bg-blue-700", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    completed: { bg: "bg-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { bg: "bg-red-700", icon: <XCircle className="w-3 h-3" /> },
    cancelled: { bg: "bg-yellow-700", icon: <Square className="w-3 h-3" /> },
  };
  const c = config[status] || config.pending;
  return (
    <Badge className={`${c.bg} text-white gap-1`}>
      {c.icon}
      {status.toUpperCase()}
    </Badge>
  );
}
function LogEntry({ item, isExpanded, onToggle }: {
  item: LogItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    thinking: <Brain className="w-4 h-4 text-purple-400" />,
    tool: <Wrench className="w-4 h-4 text-amber-400" />,
    phase: <Target className="w-4 h-4 text-cyan-400" />,
    finding: <Bug className="w-4 h-4 text-red-400" />,
    info: <Terminal className="w-4 h-4 text-gray-400" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const borderColors: Record<string, string> = {
    thinking: "border-l-purple-500",
    tool: "border-l-amber-500",
    phase: "border-l-cyan-500",
    finding: "border-l-red-500",
    info: "border-l-gray-600",
    error: "border-l-red-600",
  };

  // Thinking content is always shown, others are collapsible
  const isThinking = item.type === 'thinking';
  const showContent = isThinking || isExpanded;
  const isCollapsible = !isThinking && item.content;

  return (
    <div
      className={`mb-2 p-3 rounded-lg border-l-2 ${borderColors[item.type]} bg-gray-900/40 ${isCollapsible ? 'cursor-pointer hover:bg-gray-900/60' : ''} transition-colors`}
      onClick={isCollapsible ? onToggle : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icons[item.type]}
          <span className="text-xs text-gray-500 font-mono">{item.time}</span>
          {!isThinking && <span className="text-sm text-gray-200 truncate">{item.title}</span>}
          {item.isStreaming && <span className="w-2 h-4 bg-purple-400 animate-pulse" />}
          {item.tool?.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
          {item.agentName && (
            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] uppercase tracking-wider ${AGENT_COLORS[item.agentName] || AGENT_COLORS.default}`}>
              {item.agentName}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.tool?.duration !== undefined && (
            <span className="text-xs text-gray-500">{item.tool.duration}ms</span>
          )}
          {item.severity && (
            <Badge className={SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.info}>
              {item.severity.charAt(0).toUpperCase()}
            </Badge>
          )}
          {isCollapsible && (
            isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {showContent && item.content && (
        <div className={`mt-2 ${isThinking ? 'text-sm text-purple-200' : 'p-2 bg-gray-950 rounded text-xs font-mono text-gray-400'} whitespace-pre-wrap`}>
          {item.content}
        </div>
      )}
    </div>
  );
}

// ============ Main Component ============

export default function AgentAuditPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<AgentTask | null>(null);
  const [_findings, setFindings] = useState<AgentFinding[]>([]); // Loaded for future use
  const [isLoading, setIsLoading] = useState(true);

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const logEndRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);
  const currentThinkingId = useRef<string | null>(null);
  const currentAgentName = useRef<string | null>(null);

  const isRunning = task?.status === "running";
  const isComplete = task?.status === "completed" || task?.status === "failed" || task?.status === "cancelled";

  // Helper to add log
  const addLog = useCallback((item: Omit<LogItem, 'id' | 'time'>) => {
    const newItem: LogItem = {
      ...item,
      id: `log-${++logIdCounter.current}`,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLogs(prev => [...prev, newItem]);
    return newItem.id;
  }, []);

  // Load functions
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTask(taskId);
      setTask(data);
    } catch (err: unknown) {
      toast.error("Failed to load task");
    }
  }, [taskId]);

  const loadFindings = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentFindings(taskId);
      setFindings(data);
    } catch (err) {
      console.error(err);
    }
  }, [taskId]);

  // Stream options - SIMPLIFIED
  const streamOptions = useMemo(() => ({
    includeThinking: true,
    includeToolCalls: true,

    onEvent: (event: any) => {
      if (event.agent_name) {
        currentAgentName.current = event.agent_name;
      }
    },

    onThinkingStart: () => {
      // Ensure previous thinking is finalized
      if (currentThinkingId.current) {
        setLogs(prev => prev.map(log =>
          log.id === currentThinkingId.current
            ? { ...log, isStreaming: false }
            : log
        ));
      }
      currentThinkingId.current = null;
    },

    onThinkingToken: (_token: string, accumulated: string) => {
      if (!accumulated || accumulated.trim() === '') return; // Skip empty content

      // User Request: Action and Action Input should not be in Thinking box
      // Filter out "Action:" and everything after from the thinking log
      const cleanContent = accumulated.replace(/\nAction\s*:[\s\S]*$/, "").trim();

      if (!cleanContent) return;

      if (!currentThinkingId.current) {
        // Create new thinking entry on first non-empty token
        const id = addLog({
          type: 'thinking',
          title: 'Thinking...',
          content: cleanContent,
          isStreaming: true,
          agentName: currentAgentName.current || undefined,
        });
        currentThinkingId.current = id;
      } else {
        // Update existing entry
        setLogs(prev => prev.map(log =>
          log.id === currentThinkingId.current
            ? { ...log, content: cleanContent }
            : log
        ));
      }
    },

    onThinkingEnd: (response: string) => {
      const cleanResponse = (response || "").replace(/\nAction\s*:[\s\S]*$/, "").trim();

      if (!cleanResponse || cleanResponse === '') {
        // No content, remove the entry if it exists
        if (currentThinkingId.current) {
          setLogs(prev => prev.filter(log => log.id !== currentThinkingId.current));
        }
        currentThinkingId.current = null;
        return;
      }

      if (currentThinkingId.current) {
        setLogs(prev => prev.map(log =>
          log.id === currentThinkingId.current
            ? {
              ...log,
              title: cleanResponse.slice(0, 80) + (cleanResponse.length > 80 ? '...' : ''),
              content: cleanResponse,
              isStreaming: false
            }
            : log
        ));
        currentThinkingId.current = null;
      } else if (cleanResponse.trim()) {
        // No existing entry but we have content - create one
        addLog({
          type: 'thinking',
          title: cleanResponse.slice(0, 80) + (cleanResponse.length > 80 ? '...' : ''),
          content: cleanResponse,
          agentName: currentAgentName.current || undefined,
        });
      }
    },

    onToolStart: (name: string, input: Record<string, unknown>) => {
      // Force finalize any pending thinking log when a tool starts
      if (currentThinkingId.current) {
        setLogs(prev => prev.map(log =>
          log.id === currentThinkingId.current
            ? { ...log, isStreaming: false }
            : log
        ));
        currentThinkingId.current = null;
      }

      addLog({
        type: 'tool',
        title: `Action: ${name}`,
        content: `Input:\n${JSON.stringify(input, null, 2)}`,
        tool: { name, status: 'running' },
        agentName: currentAgentName.current || undefined,
      });
    },

    onToolEnd: (name: string, output: unknown, duration: number) => {
      // Update the last tool log with duration and output
      setLogs(prev => {
        // Find last matching tool (reverse search for compatibility)
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].type === 'tool' && prev[i].tool?.name === name) {
            idx = i;
            break;
          }
        }
        if (idx >= 0) {
          const newLogs = [...prev];
          // Preserve existing input content and append output
          const previousContent = newLogs[idx].content || '';
          const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);

          newLogs[idx] = {
            ...newLogs[idx],
            title: `Completed: ${name}`,
            content: `${previousContent}\n\nOutput:\n${outputStr}`,
            tool: { name, duration, status: 'completed' },
          };
          return newLogs;
        }
        return prev;
      });
    },

    onFinding: (finding: Record<string, unknown>) => {
      addLog({
        type: 'finding',
        title: (finding.title as string) || 'Vulnerability found',
        severity: (finding.severity as string) || 'medium',
      });
      loadFindings();
    },

    onComplete: () => {
      addLog({ type: 'info', title: 'Audit completed' });
      loadTask();
      loadFindings();
    },

    onError: (err: string) => {
      addLog({ type: 'error', title: `Error: ${err}` });
    },
  }), [addLog, loadTask, loadFindings]);

  const {
    connect: connectStream,
    disconnect: disconnectStream,
    isConnected,
  } = useAgentStream(taskId || null, streamOptions);

  // Init
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadTask(), loadFindings()]);
      setIsLoading(false);
    };
    init();
  }, [loadTask, loadFindings]);

  // Connect
  useEffect(() => {
    if (!taskId || isComplete) return;
    connectStream();
    return () => disconnectStream();
  }, [taskId, isComplete, connectStream, disconnectStream]);

  // Auto-scroll
  useEffect(() => {
    if (isAutoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  const handleCancel = async () => {
    if (!taskId) return;
    try {
      await cancelAgentTask(taskId);
      toast.success("Task cancelled");
      loadTask();
    } catch {
      toast.error("Failed to cancel");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading || !task) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] text-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-gray-800 bg-gray-900/50 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-gray-400">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span className="font-medium">Security Audit</span>
            <span className="text-xs text-gray-500 font-mono">{taskId?.slice(0, 8)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isConnected && (
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          )}
          <StatusBadge status={task.status} />
          {isRunning && (
            <Button variant="outline" size="sm" onClick={handleCancel} className="text-red-400 border-red-800">
              <Square className="w-3 h-3 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Activity Log */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-800 bg-gray-900/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Terminal className="w-4 h-4" />
              <span>Activity Log</span>
              <Badge variant="outline" className="bg-gray-800 border-gray-700">{logs.length}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={isAutoScroll ? "text-cyan-400" : "text-gray-500"}
            >
              {isAutoScroll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="ml-1 text-xs">Auto-scroll</span>
            </Button>
          </div>

          {/* Logs */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0f]">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Waiting for agent activity...</p>
              </div>
            ) : (
              logs
                .filter(item => {
                  // Filter out empty/placeholder entries
                  if (item.title === 'Thinking...' && (!item.content || item.content.trim() === '')) {
                    return false;
                  }
                  return true;
                })
                .map(item => (
                  <LogEntry
                    key={item.id}
                    item={item}
                    isExpanded={expandedIds.has(item.id)}
                    onToggle={() => toggleExpand(item.id)}
                  />
                ))
            )}
            <div ref={logEndRef} className="h-4" />
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="flex-shrink-0 px-4 py-2 border-t border-gray-800 bg-gray-900/30">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{task.progress_percentage?.toFixed(0) || 0}%</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${task.progress_percentage || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
