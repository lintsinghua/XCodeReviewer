/**
 * Agent 流式事件 React Hook
 * 
 * 用于在 React 组件中消费 Agent 审计的实时事件流
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AgentStreamHandler,
  StreamEventData,
  StreamOptions,
  AgentStreamState,
} from '../shared/api/agentStream';

export interface UseAgentStreamOptions extends StreamOptions {
  autoConnect?: boolean;
  maxEvents?: number;
}

export interface UseAgentStreamReturn extends AgentStreamState {
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
  clearEvents: () => void;
}

/**
 * Agent 流式事件 Hook
 * 
 * @example
 * ```tsx
 * function AgentAuditPanel({ taskId }: { taskId: string }) {
 *   const {
 *     events,
 *     thinking,
 *     isThinking,
 *     toolCalls,
 *     currentPhase,
 *     progress,
 *     findings,
 *     isComplete,
 *     error,
 *     connect,
 *     disconnect,
 *     isConnected,
 *   } = useAgentStream(taskId);
 * 
 *   useEffect(() => {
 *     connect();
 *     return () => disconnect();
 *   }, [taskId]);
 * 
 *   return (
 *     <div>
 *       {isThinking && <ThinkingIndicator text={thinking} />}
 *       {toolCalls.map(tc => <ToolCallCard key={tc.name} {...tc} />)}
 *       {findings.map(f => <FindingCard key={f.id} {...f} />)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgentStream(
  taskId: string | null,
  options: UseAgentStreamOptions = {}
): UseAgentStreamReturn {
  const {
    autoConnect = false,
    maxEvents = 500,
    includeThinking = true,
    includeToolCalls = true,
    afterSequence = 0,
    ...callbackOptions
  } = options;

  // 🔥 使用 ref 存储 callback options，避免 connect 函数依赖变化导致重连
  const callbackOptionsRef = useRef(callbackOptions);
  callbackOptionsRef.current = callbackOptions;

  // 状态
  const [events, setEvents] = useState<StreamEventData[]>([]);
  const [thinking, setThinking] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [toolCalls, setToolCalls] = useState<AgentStreamState['toolCalls']>([]);
  const [currentPhase, setCurrentPhase] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 100, percentage: 0 });
  const [findings, setFindings] = useState<Record<string, unknown>[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Handler ref
  const handlerRef = useRef<AgentStreamHandler | null>(null);
  const thinkingBufferRef = useRef<string[]>([]);

  // 连接
  const connect = useCallback(() => {
    if (!taskId) return;

    // 断开现有连接
    if (handlerRef.current) {
      handlerRef.current.disconnect();
    }

    // 重置状态
    setEvents([]);
    setThinking('');
    setIsThinking(false);
    setToolCalls([]);
    setCurrentPhase('');
    setProgress({ current: 0, total: 100, percentage: 0 });
    setFindings([]);
    setIsComplete(false);
    setError(null);
    thinkingBufferRef.current = [];

    // 创建新的 handler
    handlerRef.current = new AgentStreamHandler(taskId, {
      includeThinking,
      includeToolCalls,
      afterSequence,

      onEvent: (event) => {
        // Pass to custom callback first (important for capturing metadata like agent_name)
        callbackOptionsRef.current.onEvent?.(event);

        // 忽略 thinking 事件，防止污染日志列表 (它们会通过 onThinking* 回调单独处理)
        if (
          event.type === 'thinking_token' ||
          event.type === 'thinking_start' ||
          event.type === 'thinking_end'
        ) return;
        setEvents((prev) => [...prev.slice(-maxEvents + 1), event]);
      },

      onThinkingStart: () => {
        thinkingBufferRef.current = [];
        setIsThinking(true);
        setThinking('');
        callbackOptionsRef.current.onThinkingStart?.();
      },

      onThinkingToken: (token, accumulated) => {
        thinkingBufferRef.current.push(token);
        setThinking(accumulated);
        callbackOptionsRef.current.onThinkingToken?.(token, accumulated);
      },

      onThinkingEnd: (response) => {
        setIsThinking(false);
        setThinking(response);
        thinkingBufferRef.current = [];
        callbackOptionsRef.current.onThinkingEnd?.(response);
      },

      onToolStart: (name, input) => {
        setToolCalls((prev) => [
          ...prev,
          { name, input, status: 'running' as const },
        ]);
        callbackOptionsRef.current.onToolStart?.(name, input);
      },

      onToolEnd: (name, output, durationMs) => {
        setToolCalls((prev) =>
          prev.map((tc) =>
            tc.name === name && tc.status === 'running'
              ? { ...tc, output, durationMs, status: 'success' as const }
              : tc
          )
        );
        callbackOptionsRef.current.onToolEnd?.(name, output, durationMs);
      },

      onNodeStart: (nodeName, phase) => {
        setCurrentPhase(phase);
        callbackOptionsRef.current.onNodeStart?.(nodeName, phase);
      },

      onNodeEnd: (nodeName, summary) => {
        callbackOptionsRef.current.onNodeEnd?.(nodeName, summary);
      },

      onProgress: (current, total, message) => {
        setProgress({
          current,
          total,
          percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        });
        callbackOptionsRef.current.onProgress?.(current, total, message);
      },

      onFinding: (finding, isVerified) => {
        setFindings((prev) => [...prev, finding]);
        callbackOptionsRef.current.onFinding?.(finding, isVerified);
      },

      onComplete: (data) => {
        setIsComplete(true);
        setIsConnected(false);
        callbackOptionsRef.current.onComplete?.(data);
      },

      onError: (err) => {
        setError(err);
        setIsComplete(true);
        setIsConnected(false);
        callbackOptionsRef.current.onError?.(err);
      },

      onHeartbeat: () => {
        callbackOptionsRef.current.onHeartbeat?.();
      },
    });

    handlerRef.current.connect();
    setIsConnected(true);
  }, [taskId, includeThinking, includeToolCalls, afterSequence, maxEvents]); // 🔥 移除 callbackOptions 依赖

  // 断开连接
  const disconnect = useCallback(() => {
    if (handlerRef.current) {
      handlerRef.current.disconnect();
      handlerRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // 清空事件
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // 自动连接
  useEffect(() => {
    if (autoConnect && taskId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [taskId, autoConnect, connect, disconnect]);

  // 清理
  useEffect(() => {
    return () => {
      if (handlerRef.current) {
        handlerRef.current.disconnect();
      }
    };
  }, []);

  return {
    events,
    thinking,
    isThinking,
    toolCalls,
    currentPhase,
    progress,
    findings,
    isComplete,
    error,
    connect,
    disconnect,
    isConnected,
    clearEvents,
  };
}

/**
 * 简化版 Hook - 只获取思考过程
 */
export function useAgentThinking(taskId: string | null) {
  const { thinking, isThinking, connect, disconnect } = useAgentStream(taskId, {
    includeToolCalls: false,
  });

  return { thinking, isThinking, connect, disconnect };
}

/**
 * 简化版 Hook - 只获取工具调用
 */
export function useAgentToolCalls(taskId: string | null) {
  const { toolCalls, connect, disconnect } = useAgentStream(taskId, {
    includeThinking: false,
  });

  return { toolCalls, connect, disconnect };
}

export default useAgentStream;
