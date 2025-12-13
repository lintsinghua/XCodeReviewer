/**
 * Agent Audit Page - Modular Implementation
 * Main entry point for the Agent Audit feature
 * Cassette Futurism / Terminal Retro aesthetic
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Terminal, Bot, Loader2, Radio, Filter, Maximize2, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAgentStream } from "@/hooks/useAgentStream";

import {
  getAgentTask,
  getAgentFindings,
  cancelAgentTask,
  getAgentTree,
  getAgentEvents,
  AgentEvent,
} from "@/shared/api/agentTasks";
import CreateAgentTaskDialog from "@/components/agent/CreateAgentTaskDialog";

// Local imports
import {
  SplashScreen,
  Header,
  LogEntry,
  AgentTreeNodeItem,
  AgentDetailPanel,
  StatsPanel,
  AgentErrorBoundary,
} from "./components";
import ReportExportDialog from "./components/ReportExportDialog";
import { useAgentAuditState } from "./hooks";
import { ACTION_VERBS, POLLING_INTERVALS } from "./constants";
import { cleanThinkingContent, truncateOutput, createLogItem } from "./utils";
import type { LogItem } from "./types";

function AgentAuditPageContent() {
  const { taskId } = useParams<{ taskId: string }>();
  const {
    task, findings, agentTree, logs, selectedAgentId, showAllLogs,
    isLoading, connectionStatus, isAutoScroll, expandedLogIds,
    treeNodes, filteredLogs, isRunning, isComplete,
    setTask, setFindings, setAgentTree, addLog, updateLog, removeLog,
    selectAgent, setLoading, setConnectionStatus, setAutoScroll, toggleLogExpanded,
    setCurrentAgentName, getCurrentAgentName, setCurrentThinkingId, getCurrentThinkingId,
    dispatch, reset,
  } = useAgentAuditState();

  // Local state
  const [showSplash, setShowSplash] = useState(!taskId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [statusVerb, setStatusVerb] = useState(ACTION_VERBS[0]);
  const [statusDots, setStatusDots] = useState(0);

  const logEndRef = useRef<HTMLDivElement>(null);
  const agentTreeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAgentTreeRefreshTime = useRef<number>(0);
  const previousTaskIdRef = useRef<string | undefined>(undefined);
  const disconnectStreamRef = useRef<(() => void) | null>(null);
  const lastEventSequenceRef = useRef<number>(0);
  const hasConnectedRef = useRef<boolean>(false); // 🔥 追踪是否已连接 SSE
  const hasLoadedHistoricalEventsRef = useRef<boolean>(false); // 🔥 追踪是否已加载历史事件
  // 🔥 使用 state 来标记历史事件加载状态和触发 streamOptions 重新计算
  const [afterSequence, setAfterSequence] = useState<number>(0);
  const [historicalEventsLoaded, setHistoricalEventsLoaded] = useState<boolean>(false);

  // 🔥 当 taskId 变化时立即重置状态（新建任务时清理旧日志）
  useEffect(() => {
    // 如果 taskId 发生变化，立即重置
    if (taskId !== previousTaskIdRef.current) {
      // 1. 先断开旧的 SSE 流连接
      if (disconnectStreamRef.current) {
        disconnectStreamRef.current();
        disconnectStreamRef.current = null;
      }
      // 2. 重置所有状态
      reset();
      setShowSplash(!taskId);
      // 3. 重置事件序列号和加载状态
      lastEventSequenceRef.current = 0;
      hasConnectedRef.current = false; // 🔥 重置 SSE 连接标志
      hasLoadedHistoricalEventsRef.current = false; // 🔥 重置历史事件加载标志
      setHistoricalEventsLoaded(false); // 🔥 重置历史事件加载状态
      setAfterSequence(0); // 🔥 重置 afterSequence state
    }
    previousTaskIdRef.current = taskId;
  }, [taskId, reset]);

  // ============ Data Loading ============

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTask(taskId);
      setTask(data);
    } catch {
      toast.error("Failed to load task");
    }
  }, [taskId, setTask]);

  const loadFindings = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentFindings(taskId);
      setFindings(data);
    } catch (err) {
      console.error(err);
    }
  }, [taskId, setFindings]);

  const loadAgentTree = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTree(taskId);
      setAgentTree(data);
    } catch (err) {
      console.error(err);
    }
  }, [taskId, setAgentTree]);

  const debouncedLoadAgentTree = useCallback(() => {
    const now = Date.now();
    const minInterval = POLLING_INTERVALS.AGENT_TREE_DEBOUNCE;

    if (agentTreeRefreshTimer.current) {
      clearTimeout(agentTreeRefreshTimer.current);
    }

    const timeSinceLastRefresh = now - lastAgentTreeRefreshTime.current;
    if (timeSinceLastRefresh < minInterval) {
      agentTreeRefreshTimer.current = setTimeout(() => {
        lastAgentTreeRefreshTime.current = Date.now();
        loadAgentTree();
      }, minInterval - timeSinceLastRefresh);
    } else {
      agentTreeRefreshTimer.current = setTimeout(() => {
        lastAgentTreeRefreshTime.current = Date.now();
        loadAgentTree();
      }, POLLING_INTERVALS.AGENT_TREE_MIN_DELAY);
    }
  }, [loadAgentTree]);

  // 🔥 NEW: 加载历史事件并转换为日志项
  const loadHistoricalEvents = useCallback(async () => {
    if (!taskId) return 0;

    // 🔥 防止重复加载历史事件
    if (hasLoadedHistoricalEventsRef.current) {
      console.log('[AgentAudit] Historical events already loaded, skipping');
      return 0;
    }
    hasLoadedHistoricalEventsRef.current = true;

    try {
      console.log(`[AgentAudit] Fetching historical events for task ${taskId}...`);
      const events = await getAgentEvents(taskId, { limit: 500 });
      console.log(`[AgentAudit] Received ${events.length} events from API`);

      if (events.length === 0) {
        console.log('[AgentAudit] No historical events found');
        return 0;
      }

      // 按 sequence 排序确保顺序正确
      events.sort((a, b) => a.sequence - b.sequence);

      // 转换事件为日志项
      let processedCount = 0;
      events.forEach((event: AgentEvent) => {
        // 更新最后的事件序列号
        if (event.sequence > lastEventSequenceRef.current) {
          lastEventSequenceRef.current = event.sequence;
        }

        // 提取 agent_name
        const agentName = (event.metadata?.agent_name as string) ||
                          (event.metadata?.agent as string) ||
                          undefined;

        // 根据事件类型创建日志项
        switch (event.event_type) {
          // LLM 思考相关
          case 'thinking':
          case 'llm_thought':
          case 'llm_decision':
          case 'llm_start':
          case 'llm_complete':
          case 'llm_action':
          case 'llm_observation':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'thinking',
                title: event.message?.slice(0, 100) + (event.message && event.message.length > 100 ? '...' : '') || 'Thinking...',
                content: event.message || (event.metadata?.thought as string) || '',
                agentName,
              }
            });
            processedCount++;
            break;

          // 工具调用相关
          case 'tool_call':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'tool',
                title: `Tool: ${event.tool_name || 'unknown'}`,
                content: event.tool_input ? `Input:\n${JSON.stringify(event.tool_input, null, 2)}` : '',
                tool: {
                  name: event.tool_name || 'unknown',
                  status: 'running' as const,
                },
                agentName,
              }
            });
            processedCount++;
            break;

          case 'tool_result':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'tool',
                title: `Completed: ${event.tool_name || 'unknown'}`,
                content: event.tool_output
                  ? `Output:\n${truncateOutput(typeof event.tool_output === 'string' ? event.tool_output : JSON.stringify(event.tool_output, null, 2))}`
                  : '',
                tool: {
                  name: event.tool_name || 'unknown',
                  duration: event.tool_duration_ms || 0,
                  status: 'completed' as const,
                },
                agentName,
              }
            });
            processedCount++;
            break;

          // 发现漏洞 - 🔥 包含所有 finding 相关事件类型
          case 'finding':
          case 'finding_new':
          case 'finding_verified':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'finding',
                title: event.message || (event.metadata?.title as string) || 'Vulnerability found',
                severity: (event.metadata?.severity as string) || 'medium',
                agentName,
              }
            });
            processedCount++;
            break;

          // 调度和阶段相关
          case 'dispatch':
          case 'dispatch_complete':
          case 'phase_start':
          case 'phase_complete':
          case 'node_start':
          case 'node_complete':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'dispatch',
                title: event.message || `Event: ${event.event_type}`,
                agentName,
              }
            });
            processedCount++;
            break;

          // 任务完成
          case 'task_complete':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'info',
                title: event.message || 'Task completed',
                agentName,
              }
            });
            processedCount++;
            break;

          // 任务错误
          case 'task_error':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'error',
                title: event.message || 'Task error',
                agentName,
              }
            });
            processedCount++;
            break;

          // 任务取消
          case 'task_cancel':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: 'info',
                title: event.message || 'Task cancelled',
                agentName,
              }
            });
            processedCount++;
            break;

          // 进度事件
          case 'progress':
            // 进度事件可以选择显示或跳过
            if (event.message) {
              dispatch({
                type: 'ADD_LOG',
                payload: {
                  type: 'info',
                  title: event.message,
                  agentName,
                }
              });
              processedCount++;
            }
            break;

          // 信息和错误
          case 'info':
          case 'complete':
          case 'error':
          case 'warning':
            dispatch({
              type: 'ADD_LOG',
              payload: {
                type: event.event_type === 'error' ? 'error' : 'info',
                title: event.message || `${event.event_type}`,
                agentName,
              }
            });
            processedCount++;
            break;

          // 跳过 thinking_token 等高频事件（它们不会被保存到数据库）
          case 'thinking_token':
          case 'thinking_start':
          case 'thinking_end':
            // 这些事件是流式传输用的，不保存到数据库
            break;

          default:
            // 其他事件类型也显示为 info（如果有消息）
            if (event.message) {
              dispatch({
                type: 'ADD_LOG',
                payload: {
                  type: 'info',
                  title: event.message,
                  agentName,
                }
              });
              processedCount++;
            }
        }
      });

      console.log(`[AgentAudit] Processed ${processedCount} events into logs, last sequence: ${lastEventSequenceRef.current}`);
      // 🔥 更新 afterSequence state，触发 streamOptions 重新计算
      setAfterSequence(lastEventSequenceRef.current);
      return events.length;
    } catch (err) {
      console.error('[AgentAudit] Failed to load historical events:', err);
      return 0;
    }
  }, [taskId, dispatch, setAfterSequence]);

  // ============ Stream Event Handling ============

  const streamOptions = useMemo(() => ({
    includeThinking: true,
    includeToolCalls: true,
    // 🔥 使用 state 变量，确保在历史事件加载后能获取最新值
    afterSequence: afterSequence,
    onEvent: (event: { type: string; message?: string; metadata?: { agent_name?: string; agent?: string } }) => {
      if (event.metadata?.agent_name) {
        setCurrentAgentName(event.metadata.agent_name);
      }

      const dispatchEvents = ['dispatch', 'dispatch_complete', 'node_start', 'phase_start'];
      if (dispatchEvents.includes(event.type)) {
        if (event.type === 'dispatch' || event.type === 'dispatch_complete') {
          dispatch({
            type: 'ADD_LOG',
            payload: {
              type: 'dispatch',
              title: event.message || `Agent dispatch: ${event.metadata?.agent || 'unknown'}`,
              agentName: getCurrentAgentName() || undefined,
            }
          });
        }
        debouncedLoadAgentTree();
      }
    },
    onThinkingStart: () => {
      const currentId = getCurrentThinkingId();
      if (currentId) {
        updateLog(currentId, { isStreaming: false });
      }
      setCurrentThinkingId(null);
    },
    onThinkingToken: (_token: string, accumulated: string) => {
      if (!accumulated?.trim()) return;
      const cleanContent = cleanThinkingContent(accumulated);
      if (!cleanContent) return;

      const currentId = getCurrentThinkingId();
      if (!currentId) {
        // 预生成 ID，这样我们可以跟踪这个日志
        const newLogId = `thinking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        dispatch({ type: 'ADD_LOG', payload: {
          id: newLogId,
          type: 'thinking',
          title: 'Thinking...',
          content: cleanContent,
          isStreaming: true,
          agentName: getCurrentAgentName() || undefined,
        }});
        setCurrentThinkingId(newLogId);
      } else {
        updateLog(currentId, { content: cleanContent });
      }
    },
    onThinkingEnd: (response: string) => {
      const cleanResponse = cleanThinkingContent(response || "");
      const currentId = getCurrentThinkingId();

      if (!cleanResponse) {
        if (currentId) {
          removeLog(currentId);
        }
        setCurrentThinkingId(null);
        return;
      }

      if (currentId) {
        updateLog(currentId, {
          title: cleanResponse.slice(0, 100) + (cleanResponse.length > 100 ? '...' : ''),
          content: cleanResponse,
          isStreaming: false
        });
        setCurrentThinkingId(null);
      }
    },
    onToolStart: (name: string, input: Record<string, unknown>) => {
      const currentId = getCurrentThinkingId();
      if (currentId) {
        updateLog(currentId, { isStreaming: false });
        setCurrentThinkingId(null);
      }
      dispatch({
        type: 'ADD_LOG',
        payload: {
          type: 'tool',
          title: `Tool: ${name}`,
          content: `Input:\n${JSON.stringify(input, null, 2)}`,
          tool: { name, status: 'running' },
          agentName: getCurrentAgentName() || undefined,
        }
      });
    },
    onToolEnd: (name: string, output: unknown, duration: number) => {
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
      dispatch({
        type: 'COMPLETE_TOOL_LOG',
        payload: {
          toolName: name,
          output: truncateOutput(outputStr),
          duration,
        }
      });
    },
    onFinding: (finding: Record<string, unknown>) => {
      dispatch({
        type: 'ADD_LOG',
        payload: {
          type: 'finding',
          title: (finding.title as string) || 'Vulnerability found',
          severity: (finding.severity as string) || 'medium',
          agentName: getCurrentAgentName() || undefined,
        }
      });
      // 🔥 直接将 finding 添加到状态，不依赖 API（因为运行时数据库还没有数据）
      dispatch({
        type: 'ADD_FINDING',
        payload: {
          id: (finding.id as string) || `finding-${Date.now()}`,
          title: (finding.title as string) || 'Vulnerability found',
          severity: (finding.severity as string) || 'medium',
          vulnerability_type: (finding.vulnerability_type as string) || 'unknown',
          file_path: finding.file_path as string,
          line_start: finding.line_start as number,
          description: finding.description as string,
          is_verified: (finding.is_verified as boolean) || false,
        }
      });
    },
    onComplete: () => {
      dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: 'Audit completed successfully' } });
      loadTask();
      loadFindings();
      loadAgentTree();
    },
    onError: (err: string) => {
      dispatch({ type: 'ADD_LOG', payload: { type: 'error', title: `Error: ${err}` } });
    },
  }), [afterSequence, dispatch, loadTask, loadFindings, loadAgentTree, debouncedLoadAgentTree,
      updateLog, removeLog, getCurrentAgentName, getCurrentThinkingId,
      setCurrentAgentName, setCurrentThinkingId]);

  const { connect: connectStream, disconnect: disconnectStream, isConnected } = useAgentStream(taskId || null, streamOptions);

  // 保存 disconnect 函数到 ref，以便在 taskId 变化时使用
  useEffect(() => {
    disconnectStreamRef.current = disconnectStream;
  }, [disconnectStream]);

  // ============ Effects ============

  // Status animation
  useEffect(() => {
    if (!isRunning) return;
    const dotTimer = setInterval(() => setStatusDots(d => (d + 1) % 4), 500);
    const verbTimer = setInterval(() => {
      setStatusVerb(ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)]);
    }, 5000);
    return () => {
      clearInterval(dotTimer);
      clearInterval(verbTimer);
    };
  }, [isRunning]);

  // Initial load - 🔥 加载任务数据和历史事件
  useEffect(() => {
    if (!taskId) {
      setShowSplash(true);
      return;
    }
    setShowSplash(false);
    setLoading(true);
    setHistoricalEventsLoaded(false);

    const loadAllData = async () => {
      try {
        // 先加载任务基本信息
        await Promise.all([loadTask(), loadFindings(), loadAgentTree()]);

        // 🔥 加载历史事件 - 无论任务是否运行都需要加载
        const eventsLoaded = await loadHistoricalEvents();
        console.log(`[AgentAudit] Loaded ${eventsLoaded} historical events for task ${taskId}`);

        // 标记历史事件已加载完成 (setAfterSequence 已在 loadHistoricalEvents 中调用)
        setHistoricalEventsLoaded(true);
      } catch (error) {
        console.error('[AgentAudit] Failed to load data:', error);
        setHistoricalEventsLoaded(true); // 即使出错也标记为完成，避免无限等待
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [taskId, loadTask, loadFindings, loadAgentTree, loadHistoricalEvents, setLoading]);

  // Stream connection - 🔥 在历史事件加载完成后连接
  useEffect(() => {
    // 等待历史事件加载完成，且任务正在运行
    if (!taskId || !task?.status || task.status !== 'running') return;

    // 🔥 使用 state 变量确保在历史事件加载完成后才连接
    if (!historicalEventsLoaded) return;

    // 🔥 避免重复连接 - 只连接一次
    if (hasConnectedRef.current) return;

    hasConnectedRef.current = true;
    console.log(`[AgentAudit] Connecting to stream with afterSequence=${afterSequence}`);
    connectStream();
    dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: 'Connected to audit stream' } });

    return () => {
      disconnectStream();
    };
  }, [taskId, task?.status, historicalEventsLoaded, connectStream, disconnectStream, dispatch, afterSequence]);

  // Polling
  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadAgentTree, POLLING_INTERVALS.AGENT_TREE);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadAgentTree]);

  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadTask, POLLING_INTERVALS.TASK_STATS);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadTask]);

  // Auto scroll
  useEffect(() => {
    if (isAutoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  // ============ Handlers ============

  const handleAgentSelect = useCallback((agentId: string) => {
    if (selectedAgentId === agentId) {
      selectAgent(null);
    } else {
      selectAgent(agentId);
    }
  }, [selectedAgentId, selectAgent]);

  const handleCancel = async () => {
    if (!taskId || isCancelling) return;
    setIsCancelling(true);
    dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: 'Requesting task cancellation...' } });

    try {
      await cancelAgentTask(taskId);
      toast.success("Task cancellation requested");
      dispatch({ type: 'ADD_LOG', payload: { type: 'info', title: 'Task cancellation confirmed' } });
      await loadTask();
      disconnectStream();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to cancel task: ${errorMessage}`);
      dispatch({ type: 'ADD_LOG', payload: { type: 'error', title: `Failed to cancel: ${errorMessage}` } });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExportReport = () => {
    if (!task) return;
    setShowExportDialog(true);
  };

  // ============ Render ============

  if (showSplash && !taskId) {
    return (
      <>
        <SplashScreen onComplete={() => setShowCreateDialog(true)} />
        <CreateAgentTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      </>
    );
  }

  if (isLoading && !task) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,107,44,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,107,44,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
          }}
        />
        <div className="flex items-center gap-3 text-gray-400 relative z-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="font-mono text-sm">Loading audit task...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,107,44,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,107,44,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header */}
      <Header
        task={task}
        isRunning={isRunning}
        isCancelling={isCancelling}
        onCancel={handleCancel}
        onExport={handleExportReport}
        onNewAudit={() => setShowCreateDialog(true)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - Activity Log */}
        <div className="w-3/4 flex flex-col border-r border-gray-800/50">
          {/* Log header */}
          <div className="flex-shrink-0 h-11 border-b border-gray-800/50 flex items-center justify-between px-4 bg-[#0d0d12]/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-gray-500" />
                <span className="uppercase font-bold tracking-wider text-gray-300">Activity Log</span>
              </div>
              {isConnected && (
                <div className="flex items-center gap-1.5 text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                  </span>
                  <span className="text-[10px] font-mono uppercase">Live</span>
                </div>
              )}
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-gray-700/50 text-gray-500 font-mono">
                {filteredLogs.length}{!showAllLogs && logs.length !== filteredLogs.length ? ` / ${logs.length}` : ''}
              </Badge>
            </div>

            <button
              onClick={() => setAutoScroll(!isAutoScroll)}
              className={`
                flex items-center gap-1.5 text-[10px] px-2 py-1 rounded font-mono uppercase tracking-wider
                transition-all duration-200
                ${isAutoScroll
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700'
                }
              `}
            >
              <ArrowDown className="w-3 h-3" />
              Auto-scroll
            </button>
          </div>

          {/* Log content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {/* Filter indicator */}
            {selectedAgentId && !showAllLogs && (
              <div className="mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtering logs for selected agent</span>
                </div>
                <button
                  onClick={() => selectAgent(null)}
                  className="text-[10px] text-gray-400 hover:text-white transition-colors font-mono uppercase"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Logs */}
            {filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-600">
                  {isRunning ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                      <span className="text-sm">
                        {selectedAgentId && !showAllLogs
                          ? 'Waiting for activity from selected agent...'
                          : 'Waiting for agent activity...'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm">
                      {selectedAgentId && !showAllLogs
                        ? 'No activity from selected agent'
                        : 'No activity yet'}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredLogs.map(item => (
                  <LogEntry
                    key={item.id}
                    item={item}
                    isExpanded={expandedLogIds.has(item.id)}
                    onToggle={() => toggleLogExpanded(item.id)}
                  />
                ))}
              </div>
            )}
            <div ref={logEndRef} />
          </div>

          {/* Status bar */}
          {task && (
            <div className="flex-shrink-0 h-9 border-t border-gray-800/50 flex items-center justify-between px-4 text-xs bg-[#0d0d12]/80 backdrop-blur-sm">
              <span>
                {isRunning ? (
                  <span className="flex items-center gap-2 text-green-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
                    </span>
                    <span className="font-mono">{statusVerb}{'.'.repeat(statusDots)}</span>
                  </span>
                ) : isComplete ? (
                  <span className="text-gray-500 font-mono">Audit {task.status}</span>
                ) : (
                  <span className="text-gray-600 font-mono">Ready</span>
                )}
              </span>
              <div className="flex items-center gap-4 font-mono text-gray-500">
                <span>
                  <span className="text-primary">{task.progress_percentage?.toFixed(0) || 0}</span>
                  <span className="text-gray-600">%</span>
                </span>
                <span className="text-gray-700">|</span>
                <span>
                  <span className="text-gray-400">{task.analyzed_files}</span>
                  <span className="text-gray-600">/{task.total_files} files</span>
                </span>
                <span className="text-gray-700">|</span>
                <span>
                  <span className="text-gray-400">{task.tool_calls_count || 0}</span>
                  <span className="text-gray-600"> tools</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Agent Tree + Stats */}
        <div className="w-1/4 flex flex-col bg-[#0b0b10]">
          {/* Agent Tree section */}
          <div className="flex-1 flex flex-col border-b border-gray-800/50 overflow-hidden">
            {/* Tree header */}
            <div className="flex-shrink-0 h-11 border-b border-gray-800/50 flex items-center justify-between px-4 bg-[#0d0d12]/80">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Bot className="w-4 h-4 text-gray-500" />
                <span className="uppercase font-bold tracking-wider text-gray-300">Agent Tree</span>
                {agentTree && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-gray-700/50 text-gray-500 font-mono">
                    {agentTree.total_agents}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedAgentId && !showAllLogs && (
                  <button
                    onClick={() => selectAgent(null)}
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors font-mono uppercase"
                  >
                    Show All
                  </button>
                )}
                {agentTree && agentTree.running_agents > 0 && (
                  <div className="flex items-center gap-1.5 text-green-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
                    </span>
                    <span className="text-[10px] font-mono">{agentTree.running_agents}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tree content */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {treeNodes.length > 0 ? (
                treeNodes.map(node => (
                  <AgentTreeNodeItem
                    key={node.agent_id}
                    node={node}
                    selectedId={selectedAgentId}
                    onSelect={handleAgentSelect}
                  />
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600 text-xs">
                  {isRunning ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Initializing agents...</span>
                    </div>
                  ) : (
                    'No agents yet'
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom section - Details + Stats */}
          <div className="flex-shrink-0 p-3 space-y-3 max-h-[50%] overflow-y-auto custom-scrollbar">
            {/* Agent detail panel */}
            {selectedAgentId && !showAllLogs && (
              <AgentDetailPanel
                agentId={selectedAgentId}
                treeNodes={treeNodes}
                onClose={() => selectAgent(null)}
              />
            )}

            {/* Stats panel */}
            <StatsPanel task={task} findings={findings} />
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <CreateAgentTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />

      {/* Export dialog */}
      <ReportExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        task={task}
        findings={findings}
      />
    </div>
  );
}

// Wrapped export with Error Boundary
export default function AgentAuditPage() {
  const { taskId } = useParams<{ taskId: string }>();

  return (
    <AgentErrorBoundary
      taskId={taskId}
      onRetry={() => window.location.reload()}
    >
      <AgentAuditPageContent />
    </AgentErrorBoundary>
  );
}
