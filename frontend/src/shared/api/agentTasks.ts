/**
 * Agent Tasks API
 * Agent 审计任务相关的 API 调用
 */

import { apiClient } from "./serverClient";

// ============ Types ============

export interface AgentTask {
  id: string;
  project_id: string;
  name: string | null;
  description: string | null;
  task_type: string;
  status: string;
  current_phase: string | null;
  current_step: string | null;
  
  // 统计
  total_files: number;
  indexed_files: number;
  analyzed_files: number;
  total_chunks: number;
  findings_count: number;
  verified_count: number;
  false_positive_count: number;
  
  // 严重程度统计
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  
  // 评分
  quality_score: number;
  security_score: number;
  
  // 时间
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  
  // 进度
  progress_percentage: number;
  
  // 错误信息
  error_message: string | null;
}

export interface AgentFinding {
  id: string;
  task_id: string;
  vulnerability_type: string;
  severity: string;
  title: string;
  description: string | null;
  
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  code_snippet: string | null;
  
  status: string;
  is_verified: boolean;
  has_poc: boolean;
  poc_code: string | null;
  
  suggestion: string | null;
  fix_code: string | null;
  ai_explanation: string | null;
  ai_confidence: number | null;
  
  created_at: string;
}

export interface AgentEvent {
  id: string;
  task_id: string;
  event_type: string;
  phase: string | null;
  message: string | null;
  tool_name: string | null;
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  tool_duration_ms: number | null;
  finding_id: string | null;
  tokens_used?: number;
  metadata?: Record<string, unknown>;
  sequence: number;
  timestamp: string;
}

export interface CreateAgentTaskRequest {
  project_id: string;
  name?: string;
  description?: string;
  audit_scope?: Record<string, unknown>;
  target_vulnerabilities?: string[];
  verification_level?: "analysis_only" | "sandbox" | "generate_poc";
  branch_name?: string;
  exclude_patterns?: string[];
  target_files?: string[];
  max_iterations?: number;
  token_budget?: number;
  timeout_seconds?: number;
}

export interface AgentTaskSummary {
  task_id: string;
  status: string;
  progress_percentage: number;
  security_score: number;
  quality_score: number;
  statistics: {
    total_files: number;
    indexed_files: number;
    analyzed_files: number;
    total_chunks: number;
    findings_count: number;
    verified_count: number;
    false_positive_count: number;
  };
  severity_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  vulnerability_types: Record<string, { total: number; verified: number }>;
  duration_seconds: number | null;
}

// ============ API Functions ============

/**
 * 创建 Agent 审计任务
 */
export async function createAgentTask(data: CreateAgentTaskRequest): Promise<AgentTask> {
  const response = await apiClient.post("/agent-tasks/", data);
  return response.data;
}

/**
 * 获取 Agent 任务列表
 */
export async function getAgentTasks(params?: {
  project_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<AgentTask[]> {
  const response = await apiClient.get("/agent-tasks/", { params });
  return response.data;
}

/**
 * 获取 Agent 任务详情
 */
export async function getAgentTask(taskId: string): Promise<AgentTask> {
  const response = await apiClient.get(`/agent-tasks/${taskId}`);
  return response.data;
}

/**
 * 启动 Agent 任务
 */
export async function startAgentTask(taskId: string): Promise<{ message: string; task_id: string }> {
  const response = await apiClient.post(`/agent-tasks/${taskId}/start`);
  return response.data;
}

/**
 * 取消 Agent 任务
 */
export async function cancelAgentTask(taskId: string): Promise<{ message: string; task_id: string }> {
  const response = await apiClient.post(`/agent-tasks/${taskId}/cancel`);
  return response.data;
}

/**
 * 获取 Agent 任务事件列表
 */
export async function getAgentEvents(
  taskId: string,
  params?: { after_sequence?: number; limit?: number }
): Promise<AgentEvent[]> {
  const response = await apiClient.get(`/agent-tasks/${taskId}/events/list`, { params });
  return response.data;
}

/**
 * 获取 Agent 任务发现列表
 */
export async function getAgentFindings(
  taskId: string,
  params?: {
    severity?: string;
    vulnerability_type?: string;
    is_verified?: boolean;
  }
): Promise<AgentFinding[]> {
  const response = await apiClient.get(`/agent-tasks/${taskId}/findings`, { params });
  return response.data;
}

/**
 * 获取单个发现详情
 */
export async function getAgentFinding(taskId: string, findingId: string): Promise<AgentFinding> {
  const response = await apiClient.get(`/agent-tasks/${taskId}/findings/${findingId}`);
  return response.data;
}

/**
 * 更新发现状态
 */
export async function updateAgentFinding(
  taskId: string,
  findingId: string,
  data: { status?: string }
): Promise<AgentFinding> {
  const response = await apiClient.patch(`/agent-tasks/${taskId}/findings/${findingId}`, data);
  return response.data;
}

/**
 * 获取任务摘要
 */
export async function getAgentTaskSummary(taskId: string): Promise<AgentTaskSummary> {
  const response = await apiClient.get(`/agent-tasks/${taskId}/summary`);
  return response.data;
}

/**
 * 创建 SSE 事件源
 */
export function createAgentEventSource(taskId: string, afterSequence = 0): EventSource {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const url = `${baseUrl}/api/v1/agent-tasks/${taskId}/events?after_sequence=${afterSequence}`;
  
  // 注意：EventSource 不支持自定义 headers，需要通过 URL 参数或 cookie 传递认证
  // 如果需要认证，可以考虑使用 fetch + ReadableStream 替代
  return new EventSource(url, { withCredentials: true });
}

/**
 * 使用 fetch 流式获取事件（支持自定义 headers）
 */
export async function* streamAgentEvents(
  taskId: string,
  afterSequence = 0,
  signal?: AbortSignal
): AsyncGenerator<AgentEvent, void, unknown> {
  const token = localStorage.getItem("access_token");
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const url = `${baseUrl}/api/v1/agent-tasks/${taskId}/events?after_sequence=${afterSequence}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    signal,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to connect to event stream: ${response.statusText}`);
  }
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }
  
  const decoder = new TextDecoder();
  let buffer = "";
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      // 解析 SSE 格式
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data) as AgentEvent;
            yield event;
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

