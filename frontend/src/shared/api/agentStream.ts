/**
 * Agent 流式事件处理
 * 
 * 最佳实践:
 * 1. 使用 EventSource API 或 fetch + ReadableStream
 * 2. 支持重连机制
 * 3. 分类处理不同事件类型
 */

// 事件类型定义
export type StreamEventType =
  // LLM 相关
  | 'thinking' // General thinking event
  | 'thinking_start'
  | 'thinking_token'
  | 'thinking_end'
  // 工具调用相关
  | 'tool_call_start'
  | 'tool_call_input'
  | 'tool_call_output'
  | 'tool_call_end'
  | 'tool_call_error'
  | 'tool_call'      // Backend sends this
  | 'tool_result'    // Backend sends this
  // 节点相关
  | 'node_start'
  | 'node_end'
  // 阶段相关
  | 'phase_start'
  | 'phase_end'
  | 'phase_complete'
  // 发现相关
  | 'finding_new'
  | 'finding_verified'
  // 状态相关
  | 'progress'
  | 'info'
  | 'warning'
  | 'error'
  // 任务相关
  | 'task_start'
  | 'task_complete'
  | 'task_error'
  | 'task_cancel'
  | 'task_end'
  // 心跳
  | 'heartbeat';

// 工具调用详情
export interface ToolCallDetail {
  name: string;
  input?: Record<string, unknown>;
  output?: unknown;
  duration_ms?: number;
}

// 流式事件数据
export interface StreamEventData {
  id?: string;
  type: StreamEventType;
  phase?: string;
  message?: string;
  sequence?: number;
  timestamp?: string;
  tool?: ToolCallDetail;
  metadata?: Record<string, unknown>;
  tokens_used?: number;
  // 特定类型数据
  token?: string;           // thinking_token
  accumulated?: string;     // thinking_token/thinking_end
  status?: string;          // task_end
  error?: string;           // task_error
  findings_count?: number;  // task_complete
  security_score?: number;  // task_complete
  // Backend tool event fields
  tool_name?: string;       // tool_call, tool_result
  tool_input?: Record<string, unknown>;  // tool_call
  tool_output?: unknown;    // tool_result
  tool_duration_ms?: number; // tool_result
  agent_name?: string;      // Extracted from metadata
}

// 事件回调类型
export type StreamEventCallback = (event: StreamEventData) => void;

// 流式选项
export interface StreamOptions {
  includeThinking?: boolean;
  includeToolCalls?: boolean;
  afterSequence?: number;
  onThinkingStart?: () => void;
  onThinkingToken?: (token: string, accumulated: string) => void;
  onThinkingEnd?: (fullResponse: string) => void;
  onToolStart?: (toolName: string, input: Record<string, unknown>) => void;
  onToolEnd?: (toolName: string, output: unknown, durationMs: number) => void;
  onNodeStart?: (nodeName: string, phase: string) => void;
  onNodeEnd?: (nodeName: string, summary: Record<string, unknown>) => void;
  onFinding?: (finding: Record<string, unknown>, isVerified: boolean) => void;
  onProgress?: (current: number, total: number, message: string) => void;
  onComplete?: (data: { findingsCount: number; securityScore: number }) => void;
  onError?: (error: string) => void;
  onHeartbeat?: () => void;
  onEvent?: StreamEventCallback;  // 通用事件回调
}

/**
 * Agent 流式事件处理器
 */
export class AgentStreamHandler {
  private taskId: string;
  private eventSource: EventSource | null = null;
  private options: StreamOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private thinkingBuffer: string[] = [];
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null; // 🔥 保存 reader 引用
  private abortController: AbortController | null = null; // 🔥 用于取消请求
  private isDisconnecting = false; // 🔥 标记是否正在断开

  constructor(taskId: string, options: StreamOptions = {}) {
    this.taskId = taskId;
    this.options = {
      includeThinking: true,
      includeToolCalls: true,
      afterSequence: 0,
      ...options,
    };
  }

  /**
   * 开始监听事件流
   */
  connect(): void {
    // 🔥 如果已经连接，不重复连接
    if (this.isConnected || this.isDisconnecting) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      this.options.onError?.('未登录');
      return;
    }

    const params = new URLSearchParams({
      include_thinking: String(this.options.includeThinking),
      include_tool_calls: String(this.options.includeToolCalls),
      after_sequence: String(this.options.afterSequence),
    });

    // 使用 EventSource (不支持自定义 headers，需要通过 URL 传递 token)
    // 或者使用 fetch + ReadableStream
    this.connectWithFetch(token, params);
  }

  /**
   * 使用 fetch 连接（支持自定义 headers）
   */
  private async connectWithFetch(token: string, params: URLSearchParams): Promise<void> {
    // 🔥 如果正在断开，不连接
    if (this.isDisconnecting) {
      return;
    }

    const url = `/api/v1/agent-tasks/${this.taskId}/stream?${params}`;

    // 🔥 创建 AbortController 用于取消请求
    this.abortController = new AbortController();

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        signal: this.abortController.signal, // 🔥 支持取消
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.reader = response.body?.getReader() || null;
      if (!this.reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        // 🔥 检查是否正在断开
        if (this.isDisconnecting) {
          break;
        }

        const { done, value } = await this.reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件
        const events = this.parseSSE(buffer);
        buffer = events.remaining;

        // 🔥 逐个处理事件，添加微延迟确保 React 能逐个渲染
        for (const event of events.parsed) {
          this.handleEvent(event);
          // 为 thinking_token 添加微延迟确保打字效果
          if (event.type === 'thinking_token') {
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }
      }

      // 🔥 正常结束，清理 reader
      if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
    } catch (error: any) {
      // 🔥 如果是取消错误，不处理
      if (error.name === 'AbortError') {
        return;
      }

      this.isConnected = false;
      console.error('Stream connection error:', error);

      // 🔥 只有在未断开时才尝试重连
      if (!this.isDisconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          if (!this.isDisconnecting) {
            this.connect();
          }
        }, this.reconnectDelay * this.reconnectAttempts);
      } else {
        this.options.onError?.(`连接失败: ${error}`);
      }
    } finally {
      // 🔥 清理 reader
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
          // 忽略释放错误
        }
        this.reader = null;
      }
    }
  }

  /**
   * 解析 SSE 格式
   */
  private parseSSE(buffer: string): { parsed: StreamEventData[]; remaining: string } {
    const parsed: StreamEventData[] = [];
    const lines = buffer.split('\n');
    let remaining = '';
    let currentEvent: Partial<StreamEventData> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 空行表示事件结束
      if (line === '') {
        if (currentEvent.type) {
          parsed.push(currentEvent as StreamEventData);
          currentEvent = {};
        }
        continue;
      }

      // 检查是否是最后一行（可能不完整）
      if (i === lines.length - 1 && !buffer.endsWith('\n')) {
        remaining = line;
        break;
      }

      // 解析 event: 行
      if (line.startsWith('event:')) {
        currentEvent.type = line.slice(6).trim() as StreamEventType;
      }
      // 解析 data: 行
      else if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.slice(5).trim());
          currentEvent = { ...currentEvent, ...data };
        } catch {
          // 忽略解析错误
        }
      }
    }

    return { parsed, remaining };
  }

  /**
   * 处理事件
   */
  private handleEvent(event: StreamEventData): void {
    // Extract agent_name from metadata if present
    if (event.metadata?.agent_name && !event.agent_name) {
      event.agent_name = event.metadata.agent_name as string;
    }

    // 通用回调
    this.options.onEvent?.(event);

    // 分类处理
    switch (event.type) {
      // LLM 思考
      case 'thinking_start':
        this.thinkingBuffer = [];
        this.options.onThinkingStart?.();
        break;

      case 'thinking_token':
        // 兼容处理：token 可能在顶层，也可能在 metadata 中
        const token = event.token || (event.metadata?.token as string);
        const accumulated = event.accumulated || (event.metadata?.accumulated as string);

        if (token) {
          this.thinkingBuffer.push(token);
          this.options.onThinkingToken?.(
            token,
            accumulated || this.thinkingBuffer.join('')
          );
        }
        break;

      case 'thinking_end':
        const fullResponse = event.accumulated || (event.metadata?.accumulated as string) || this.thinkingBuffer.join('');
        this.thinkingBuffer = [];
        this.options.onThinkingEnd?.(fullResponse);
        break;

      // 工具调用
      case 'tool_call_start':
        if (event.tool) {
          this.options.onToolStart?.(
            event.tool.name,
            event.tool.input || {}
          );
        }
        break;

      case 'tool_call_end':
        if (event.tool) {
          this.options.onToolEnd?.(
            event.tool.name,
            event.tool.output,
            event.tool.duration_ms || 0
          );
        }
        break;

      // Alternative event names (backend sends these)
      case 'tool_call':
        this.options.onToolStart?.(
          event.tool_name || 'unknown',
          event.tool_input || {}
        );
        break;

      case 'tool_result':
        this.options.onToolEnd?.(
          event.tool_name || 'unknown',
          event.tool_output,
          event.tool_duration_ms || 0
        );
        break;

      // 节点
      case 'node_start':
        this.options.onNodeStart?.(
          event.metadata?.node as string || 'unknown',
          event.phase || ''
        );
        break;

      case 'node_end':
        this.options.onNodeEnd?.(
          event.metadata?.node as string || 'unknown',
          event.metadata?.summary as Record<string, unknown> || {}
        );
        break;

      // 发现
      case 'finding':  // 🔥 向后兼容旧的事件类型
      case 'finding_new':
      case 'finding_verified':
        this.options.onFinding?.(
          event.metadata || {},
          event.type === 'finding_verified'
        );
        break;

      // 进度
      case 'progress':
        this.options.onProgress?.(
          event.metadata?.current as number || 0,
          event.metadata?.total as number || 100,
          event.message || ''
        );
        break;

      // 任务完成
      case 'task_complete':
      case 'task_end':
        if (event.status !== 'cancelled' && event.status !== 'failed') {
          this.options.onComplete?.({
            findingsCount: event.findings_count || event.metadata?.findings_count as number || 0,
            securityScore: event.security_score || event.metadata?.security_score as number || 100,
          });
        }
        this.disconnect();
        break;

      // 错误
      case 'task_error':
      case 'error':
        this.options.onError?.(event.error || event.message || '未知错误');
        this.disconnect();
        break;

      // 心跳
      case 'heartbeat':
        this.options.onHeartbeat?.();
        break;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    // 🔥 标记正在断开，防止重连
    this.isDisconnecting = true;
    this.isConnected = false;

    // 🔥 取消 fetch 请求
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // 🔥 清理 reader
    if (this.reader) {
      try {
        this.reader.cancel();
        this.reader.releaseLock();
      } catch {
        // 忽略清理错误
      }
      this.reader = null;
    }

    // 清理 EventSource（如果使用）
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // 重置重连计数
    this.reconnectAttempts = 0;
  }

  /**
   * 检查是否已连接
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * 创建流式事件处理器的便捷函数
 */
export function createAgentStream(
  taskId: string,
  options: StreamOptions = {}
): AgentStreamHandler {
  return new AgentStreamHandler(taskId, options);
}

/**
 * React Hook 风格的使用示例
 * 
 * ```tsx
 * const { events, thinking, toolCalls, connect, disconnect } = useAgentStream(taskId);
 * 
 * useEffect(() => {
 *   connect();
 *   return () => disconnect();
 * }, [taskId]);
 * ```
 */
export interface AgentStreamState {
  events: StreamEventData[];
  thinking: string;
  isThinking: boolean;
  thinkingAgent?: string; // Who is thinking
  toolCalls: Array<{
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
    durationMs?: number;
    status: 'running' | 'success' | 'error';
  }>;
  currentPhase: string;
  progress: { current: number; total: number; percentage: number };
  findings: Array<Record<string, unknown>>;
  isComplete: boolean;
  error: string | null;
}

/**
 * 创建用于 React 状态管理的流式处理器
 */
export function createAgentStreamWithState(
  taskId: string,
  onStateChange: (state: AgentStreamState) => void
): AgentStreamHandler {
  const state: AgentStreamState = {
    events: [],
    thinking: '',
    isThinking: false,
    thinkingAgent: undefined,
    toolCalls: [],
    currentPhase: '',
    progress: { current: 0, total: 100, percentage: 0 },
    findings: [],
    isComplete: false,
    error: null,
  };

  const updateState = (updates: Partial<AgentStreamState>) => {
    Object.assign(state, updates);
    onStateChange({ ...state });
  };

  return new AgentStreamHandler(taskId, {
    onEvent: (event) => {
      const updates: Partial<AgentStreamState> = {
        events: [...state.events, event].slice(-500),
      };

      // Update thinking agent if available
      if (event.agent_name && (event.type === 'thinking' || event.type === 'thinking_start' || event.type === 'thinking_token')) {
        updates.thinkingAgent = event.agent_name;
      }

      updateState(updates);
    },
    onThinkingStart: () => {
      updateState({ isThinking: true, thinking: '' });
    },
    onThinkingToken: (_, accumulated) => {
      updateState({ thinking: accumulated });
    },
    onThinkingEnd: (response) => {
      updateState({ isThinking: false, thinking: response });
    },
    onToolStart: (name, input) => {
      updateState({
        toolCalls: [
          ...state.toolCalls,
          { name, input, status: 'running' },
        ],
      });
    },
    onToolEnd: (name, output, durationMs) => {
      updateState({
        toolCalls: state.toolCalls.map((tc) =>
          tc.name === name && tc.status === 'running'
            ? { ...tc, output, durationMs, status: 'success' as const }
            : tc
        ),
      });
    },
    onNodeStart: (_, phase) => {
      updateState({ currentPhase: phase });
    },
    onProgress: (current, total, _) => {
      updateState({
        progress: {
          current,
          total,
          percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        },
      });
    },
    onFinding: (finding, _) => {
      updateState({
        findings: [...state.findings, finding],
      });
    },
    onComplete: () => {
      updateState({ isComplete: true });
    },
    onError: (error) => {
      updateState({ error, isComplete: true });
    },
  });
}

