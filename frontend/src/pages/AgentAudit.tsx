/**
 * Agent Audit Page - Strix-inspired Terminal UI
 * 参考 Strix 的 TUI 设计：左侧活动日志 + 右侧 Agent 树和统计
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Terminal, Bot, CheckCircle2, Loader2, XCircle,
  Bug, Square, Brain, Wrench, Play,
  ChevronDown, ChevronUp, Clock, Target, Zap,
  Shield, Activity, ChevronRight,
  FileCode, AlertTriangle, Search
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
  getAgentTree,
  type AgentTreeResponse,
  type AgentTreeNode,
} from "@/shared/api/agentTasks";
import CreateAgentTaskDialog from "@/components/agent/CreateAgentTaskDialog";

// ============ Types ============
interface LogItem {
  id: string;
  time: string;
  type: 'thinking' | 'tool' | 'phase' | 'finding' | 'info' | 'error' | 'user' | 'dispatch';
  title: string;
  content?: string;
  isStreaming?: boolean;
  tool?: { name: string; duration?: number; status?: 'running' | 'completed' | 'failed' };
  severity?: string;
  agentName?: string;
}

// ============ Utilities ============

/**
 * 将扁平的 Agent 节点列表转换为树结构
 * 后端返回的是扁平列表，需要根据 parent_agent_id 构建树
 */
function buildAgentTree(flatNodes: AgentTreeNode[]): AgentTreeNode[] {
  if (!flatNodes || flatNodes.length === 0) return [];
  
  // 创建节点映射（使用 agent_id 作为 key）
  const nodeMap = new Map<string, AgentTreeNode>();
  
  // 首先克隆所有节点并重置 children
  flatNodes.forEach(node => {
    nodeMap.set(node.agent_id, { ...node, children: [] });
  });
  
  // 构建树结构
  const rootNodes: AgentTreeNode[] = [];
  
  flatNodes.forEach(node => {
    const currentNode = nodeMap.get(node.agent_id)!;
    
    if (node.parent_agent_id && nodeMap.has(node.parent_agent_id)) {
      // 有父节点，添加到父节点的 children
      const parentNode = nodeMap.get(node.parent_agent_id)!;
      parentNode.children.push(currentNode);
    } else {
      // 没有父节点或父节点不存在，作为根节点
      rootNodes.push(currentNode);
    }
  });
  
  return rootNodes;
}

// ============ Constants ============
const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-950/50 border-red-500",
  high: "text-orange-400 bg-orange-950/50 border-orange-500",
  medium: "text-yellow-400 bg-yellow-950/50 border-yellow-500",
  low: "text-blue-400 bg-blue-950/50 border-blue-500",
  info: "text-gray-400 bg-gray-900/50 border-gray-500",
};

const ACTION_VERBS = [
  "Analyzing", "Scanning", "Probing", "Investigating",
  "Examining", "Auditing", "Testing", "Exploring"
];

// ============ Sub Components ============

// 启动画面 - Strix 风格
function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [dots, setDots] = useState(0);
  const [verb, setVerb] = useState(ACTION_VERBS[0]);

  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  useEffect(() => {
    const dotTimer = setInterval(() => setDots(d => (d + 1) % 4), 400);
    const verbTimer = setInterval(() => {
      setVerb(ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)]);
    }, 2000);
    return () => {
      clearInterval(dotTimer);
      clearInterval(verbTimer);
    };
  }, []);

  return (
    <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center space-y-6">
        <pre className="text-primary font-mono text-xs sm:text-sm leading-tight select-none">
{`
 ██████╗ ███████╗███████╗██████╗  █████╗ ██╗   ██╗██████╗ ██╗████████╗
 ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██║   ██║██╔══██╗██║╚══██╔══╝
 ██║  ██║█████╗  █████╗  ██████╔╝███████║██║   ██║██║  ██║██║   ██║   
 ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██╔══██║██║   ██║██║  ██║██║   ██║   
 ██████╔╝███████╗███████╗██║     ██║  ██║╚██████╔╝██████╔╝██║   ██║   
 ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝   ╚═╝   
`}
        </pre>
        <div className="space-y-2">
          <p className="text-white font-bold text-lg">
            Welcome to <span className="text-primary">DeepAudit</span>!
          </p>
          <p className="text-gray-500 text-sm">AI-Powered Security Audit Agent</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm font-mono">
            {verb}{'.'.repeat(dots)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Agent 树节点 - 增强版
function AgentTreeNodeItem({ 
  node, 
  depth = 0, 
  selectedId, 
  onSelect 
}: { 
  node: AgentTreeNode; 
  depth?: number; 
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.agent_id;
  
  // 状态图标和颜色
  const statusConfig: Record<string, { icon: React.ReactNode; color: string; animate?: boolean }> = {
    running: { 
      icon: <div className="w-2 h-2 rounded-full bg-green-400" />, 
      color: "text-green-400",
      animate: true 
    },
    completed: { 
      icon: <CheckCircle2 className="w-3 h-3" />, 
      color: "text-green-400" 
    },
    failed: { 
      icon: <XCircle className="w-3 h-3" />, 
      color: "text-red-400" 
    },
    waiting: { 
      icon: <Clock className="w-3 h-3" />, 
      color: "text-yellow-400" 
    },
    created: { 
      icon: <div className="w-2 h-2 rounded-full bg-gray-500" />, 
      color: "text-gray-400" 
    },
  };

  const config = statusConfig[node.status] || statusConfig.created;

  // Agent 类型图标
  const typeIcons: Record<string, React.ReactNode> = {
    orchestrator: <Brain className="w-3 h-3 text-purple-400" />,
    recon: <Search className="w-3 h-3 text-cyan-400" />,
    analysis: <FileCode className="w-3 h-3 text-amber-400" />,
    verification: <Shield className="w-3 h-3 text-green-400" />,
  };

  return (
    <div>
      <div
        className={`
          flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded
          hover:bg-white/5 transition-all duration-150
          ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'border-l-2 border-transparent'}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.agent_id)}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="hover:bg-white/10 rounded p-0.5"
          >
            {expanded ? 
              <ChevronDown className="w-3 h-3 text-gray-500" /> : 
              <ChevronRight className="w-3 h-3 text-gray-500" />
            }
          </button>
        ) : <span className="w-4" />}
        
        {/* 状态指示器 */}
        <span className={`${config.color} ${config.animate ? 'animate-pulse' : ''}`}>
          {config.icon}
        </span>
        
        {/* Agent 类型图标 */}
        {typeIcons[node.agent_type] || <Bot className="w-3 h-3 text-gray-400" />}
        
        {/* Agent 名称 */}
        <span className={`text-xs font-mono truncate flex-1 ${isSelected ? 'text-white font-semibold' : 'text-gray-300'}`}>
          {node.agent_name}
        </span>
        
        {/* 发现数量 */}
        {node.findings_count > 0 && (
          <Badge className="h-4 px-1 text-[10px] bg-red-500/20 text-red-400 border-0">
            {node.findings_count}
          </Badge>
        )}
      </div>
      
      {expanded && hasChildren && (
        <div className="border-l border-gray-800 ml-4">
          {node.children.map(child => (
            <AgentTreeNodeItem 
              key={child.agent_id} 
              node={child} 
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 日志条目组件 - 增强版
function LogEntry({ item, isExpanded, onToggle }: {
  item: LogItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config: Record<string, { 
    icon: React.ReactNode; 
    borderColor: string;
    bgColor: string;
  }> = {
    thinking: { 
      icon: <Brain className="w-4 h-4 text-purple-400" />, 
      borderColor: "border-l-purple-500",
      bgColor: "bg-purple-950/20"
    },
    tool: { 
      icon: <Wrench className="w-4 h-4 text-amber-400" />, 
      borderColor: "border-l-amber-500",
      bgColor: "bg-amber-950/20"
    },
    phase: { 
      icon: <Target className="w-4 h-4 text-cyan-400" />, 
      borderColor: "border-l-cyan-500",
      bgColor: "bg-cyan-950/20"
    },
    finding: { 
      icon: <Bug className="w-4 h-4 text-red-400" />, 
      borderColor: "border-l-red-500",
      bgColor: "bg-red-950/20"
    },
    dispatch: { 
      icon: <Zap className="w-4 h-4 text-blue-400" />, 
      borderColor: "border-l-blue-500",
      bgColor: "bg-blue-950/20"
    },
    info: { 
      icon: <Terminal className="w-4 h-4 text-gray-400" />, 
      borderColor: "border-l-gray-600",
      bgColor: "bg-gray-900/30"
    },
    error: { 
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />, 
      borderColor: "border-l-red-600",
      bgColor: "bg-red-950/30"
    },
    user: { 
      icon: <Shield className="w-4 h-4 text-blue-400" />, 
      borderColor: "border-l-blue-500",
      bgColor: "bg-blue-950/20"
    },
  };

  const c = config[item.type] || config.info;
  const isThinking = item.type === 'thinking';
  const showContent = isThinking || isExpanded;
  const isCollapsible = !isThinking && item.content;

  return (
    <div
      className={`
        mb-2 p-3 rounded-lg border-l-2 transition-all duration-150
        ${c.borderColor} ${c.bgColor}
        ${isCollapsible ? 'cursor-pointer hover:brightness-110' : ''} 
      `}
      onClick={isCollapsible ? onToggle : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {c.icon}
          <span className="text-xs text-gray-500 font-mono flex-shrink-0">{item.time}</span>
          
          {!isThinking && (
            <span className="text-sm text-gray-200 truncate">{item.title}</span>
          )}
          
          {item.isStreaming && (
            <span className="w-2 h-4 bg-purple-400 animate-pulse rounded-sm" />
          )}
          
          {item.tool?.status === 'running' && (
            <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
          )}
          
          {item.agentName && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wider border-gray-700 text-gray-400 flex-shrink-0">
              {item.agentName}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.tool?.duration !== undefined && (
            <span className="text-xs text-gray-500 font-mono">{item.tool.duration}ms</span>
          )}
          {item.severity && (
            <Badge className={`text-[10px] ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.info}`}>
              {item.severity.charAt(0).toUpperCase()}
            </Badge>
          )}
          {isCollapsible && (
            isExpanded ? 
              <ChevronUp className="w-4 h-4 text-gray-500" /> : 
              <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>
      
      {showContent && item.content && (
        <div className={`
          mt-2 text-sm whitespace-pre-wrap break-words
          ${isThinking ? 'text-purple-200/90' : 'p-2 bg-black/30 rounded text-xs font-mono text-gray-400 max-h-64 overflow-y-auto'}
        `}>
          {item.content}
        </div>
      )}
    </div>
  );
}

// 选中 Agent 详情面板
function AgentDetailPanel({ 
  agentId, 
  treeNodes, 
  onClose 
}: { 
  agentId: string; 
  treeNodes: AgentTreeNode[];
  onClose: () => void;
}) {
  // 递归查找 agent
  const findAgent = (nodes: AgentTreeNode[], id: string): AgentTreeNode | null => {
    for (const node of nodes) {
      if (node.agent_id === id) return node;
      const found = findAgent(node.children, id);
      if (found) return found;
    }
    return null;
  };

  const agent = findAgent(treeNodes, agentId);
  if (!agent) return null;

  const statusConfig: Record<string, { color: string; text: string }> = {
    running: { color: "text-green-400", text: "Running" },
    completed: { color: "text-green-400", text: "Completed" },
    failed: { color: "text-red-400", text: "Failed" },
    waiting: { color: "text-yellow-400", text: "Waiting" },
    created: { color: "text-gray-400", text: "Created" },
  };

  const typeIcons: Record<string, { icon: React.ReactNode; label: string }> = {
    orchestrator: { icon: <Brain className="w-4 h-4 text-purple-400" />, label: "Orchestrator" },
    recon: { icon: <Search className="w-4 h-4 text-cyan-400" />, label: "Reconnaissance" },
    analysis: { icon: <FileCode className="w-4 h-4 text-amber-400" />, label: "Analysis" },
    verification: { icon: <Shield className="w-4 h-4 text-green-400" />, label: "Verification" },
  };

  const config = statusConfig[agent.status] || statusConfig.created;
  const typeInfo = typeIcons[agent.agent_type] || { icon: <Bot className="w-4 h-4" />, label: "Agent" };

  return (
    <div className="p-3 border border-primary/30 rounded-lg bg-primary/5 space-y-3 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {typeInfo.icon}
          <span className="text-sm font-bold text-white">{agent.agent_name}</span>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Type</span>
          <span className="text-gray-300">{typeInfo.label}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Status</span>
          <span className={config.color}>{config.text}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Iterations</span>
          <span className="text-white font-mono">{agent.iterations || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Findings</span>
          <span className={`font-mono ${agent.findings_count > 0 ? 'text-red-400' : 'text-white'}`}>
            {agent.findings_count}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tool Calls</span>
          <span className="text-white font-mono">{agent.tool_calls || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tokens</span>
          <span className="text-white font-mono">{((agent.tokens_used || 0) / 1000).toFixed(1)}k</span>
        </div>
      </div>

      {agent.task_description && (
        <div className="pt-2 border-t border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase block mb-1">Task</span>
          <p className="text-xs text-gray-400 line-clamp-2">{agent.task_description}</p>
        </div>
      )}

      {agent.children && agent.children.length > 0 && (
        <div className="pt-2 border-t border-gray-800">
          <span className="text-[10px] text-gray-500 uppercase">Sub-agents: {agent.children.length}</span>
        </div>
      )}
    </div>
  );
}

// 实时统计面板 - 增强版
function StatsPanel({ task, findings }: { task: AgentTask | null; findings: AgentFinding[] }) {
  if (!task) return null;
  
  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  const totalFindings = Object.values(severityCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="p-3 border border-gray-800 rounded-lg bg-gray-900/30 space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-400 border-b border-gray-800 pb-2">
        <Activity className="w-4 h-4 text-primary" />
        <span className="font-bold uppercase tracking-wider">Live Stats</span>
      </div>
      
      {/* 进度条 */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Progress</span>
          <span className="text-white font-mono">{task.progress_percentage?.toFixed(0) || 0}%</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${task.progress_percentage || 0}%` }}
          />
        </div>
      </div>
      
      {/* 统计数据 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Files</span>
          <span className="text-white font-mono">{task.analyzed_files}/{task.total_files}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Iterations</span>
          <span className="text-white font-mono">{task.total_iterations || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tokens</span>
          <span className="text-white font-mono">{((task.tokens_used || 0) / 1000).toFixed(1)}k</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tool Calls</span>
          <span className="text-white font-mono">{task.tool_calls_count || 0}</span>
        </div>
      </div>

      {/* 发现统计 */}
      {totalFindings > 0 && (
        <div className="pt-2 border-t border-gray-800 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Findings</span>
            <span className="text-white font-mono">{totalFindings}</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {severityCounts.critical > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px]">
                Critical: {severityCounts.critical}
              </Badge>
            )}
            {severityCounts.high > 0 && (
              <Badge className="bg-orange-500/20 text-orange-400 border-0 text-[10px]">
                High: {severityCounts.high}
              </Badge>
            )}
            {severityCounts.medium > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-[10px]">
                Medium: {severityCounts.medium}
              </Badge>
            )}
            {severityCounts.low > 0 && (
              <Badge className="bg-blue-500/20 text-blue-400 border-0 text-[10px]">
                Low: {severityCounts.low}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* 安全评分 */}
      {task.security_score !== null && task.security_score !== undefined && (
        <div className="pt-2 border-t border-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Security Score</span>
            <span className={`text-lg font-bold font-mono ${
              task.security_score >= 80 ? 'text-green-400' :
              task.security_score >= 60 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {task.security_score.toFixed(0)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}



// 状态徽章
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; icon: React.ReactNode; text: string }> = {
    pending: { bg: "bg-gray-700", icon: <Clock className="w-3 h-3" />, text: "PENDING" },
    running: { bg: "bg-green-700", icon: <Loader2 className="w-3 h-3 animate-spin" />, text: "RUNNING" },
    completed: { bg: "bg-green-600", icon: <CheckCircle2 className="w-3 h-3" />, text: "COMPLETED" },
    failed: { bg: "bg-red-700", icon: <XCircle className="w-3 h-3" />, text: "FAILED" },
    cancelled: { bg: "bg-yellow-700", icon: <Square className="w-3 h-3" />, text: "CANCELLED" },
  };
  const c = config[status] || config.pending;
  return (
    <Badge className={`${c.bg} text-white gap-1 border-0`}>
      {c.icon}
      {c.text}
    </Badge>
  );
}


// ============ Main Component ============
export default function AgentAuditPage() {
  const { taskId } = useParams<{ taskId: string }>();

  // 状态
  const [showSplash, setShowSplash] = useState(!taskId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [task, setTask] = useState<AgentTask | null>(null);
  const [findings, setFindings] = useState<AgentFinding[]>([]);
  const [agentTree, setAgentTree] = useState<AgentTreeResponse | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!taskId);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [statusVerb, setStatusVerb] = useState(ACTION_VERBS[0]);
  const [statusDots, setStatusDots] = useState(0);
  const [showAllLogs, setShowAllLogs] = useState(true); // 是否显示所有日志

  const logEndRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);
  const currentThinkingId = useRef<string | null>(null);
  const currentAgentName = useRef<string | null>(null);

  const isRunning = task?.status === "running";
  const isComplete = task?.status === "completed" || task?.status === "failed" || task?.status === "cancelled";

  // 构建 Agent 树结构（将扁平列表转换为树）
  const treeNodes = useMemo(() => {
    if (!agentTree?.nodes) return [];
    return buildAgentTree(agentTree.nodes);
  }, [agentTree?.nodes]);

  // 根据选中的 Agent 过滤日志
  const filteredLogs = useMemo(() => {
    if (showAllLogs || !selectedAgentId) {
      return logs;
    }
    // 根据 agentName 或 agentId 过滤
    // 需要找到选中 agent 的名称（在树结构中递归查找）
    const findAgentName = (nodes: AgentTreeNode[], id: string): string | null => {
      for (const node of nodes) {
        if (node.agent_id === id) return node.agent_name;
        const found = findAgentName(node.children, id);
        if (found) return found;
      }
      return null;
    };
    const selectedAgentName = findAgentName(treeNodes, selectedAgentId);
    if (!selectedAgentName) return logs;
    
    return logs.filter(log => 
      log.agentName?.toLowerCase() === selectedAgentName.toLowerCase() ||
      log.agentName?.toLowerCase().includes(selectedAgentName.toLowerCase().split('_')[0])
    );
  }, [logs, selectedAgentId, showAllLogs, treeNodes]);

  // 选中 Agent 时的处理
  const handleAgentSelect = useCallback((agentId: string) => {
    if (selectedAgentId === agentId) {
      // 再次点击同一个 agent，切换回显示全部
      setShowAllLogs(true);
      setSelectedAgentId(null);
    } else {
      setSelectedAgentId(agentId);
      setShowAllLogs(false);
    }
  }, [selectedAgentId]);

  // 动态状态动画
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

  // Helper: 添加日志
  const addLog = useCallback((item: Omit<LogItem, 'id' | 'time'>) => {
    const newItem: LogItem = {
      ...item,
      id: `log-${++logIdCounter.current}`,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLogs(prev => [...prev, newItem]);
    return newItem.id;
  }, []);

  // 加载任务数据
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTask(taskId);
      setTask(data);
    } catch (err) {
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

  const loadAgentTree = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getAgentTree(taskId);
      setAgentTree(data);
    } catch (err) {
      console.error(err);
    }
  }, [taskId]);

  // 流式事件处理
  const streamOptions = useMemo(() => ({
    includeThinking: true,
    includeToolCalls: true,
    onEvent: (event: any) => {
      // 捕获 agent_name
      if (event.metadata?.agent_name) {
        currentAgentName.current = event.metadata.agent_name;
      }
      
      // 处理 dispatch 事件
      if (event.type === 'dispatch' || event.type === 'dispatch_complete') {
        addLog({
          type: 'dispatch',
          title: event.message || `Agent dispatch: ${event.metadata?.agent || 'unknown'}`,
          agentName: currentAgentName.current || undefined,
        });
        // 🔥 刷新 Agent 树，显示新创建的子 Agent
        loadAgentTree();
      }
    },
    onThinkingStart: () => {
      if (currentThinkingId.current) {
        setLogs(prev => prev.map(log =>
          log.id === currentThinkingId.current ? { ...log, isStreaming: false } : log
        ));
      }
      currentThinkingId.current = null;
    },
    onThinkingToken: (_token: string, accumulated: string) => {
      if (!accumulated?.trim()) return;
      // 清理 Action 部分，只显示 Thought
      const cleanContent = accumulated.replace(/\nAction\s*:[\s\S]*$/, "").trim();
      if (!cleanContent) return;

      if (!currentThinkingId.current) {
        const id = addLog({
          type: 'thinking',
          title: 'Thinking...',
          content: cleanContent,
          isStreaming: true,
          agentName: currentAgentName.current || undefined,
        });
        currentThinkingId.current = id;
      } else {
        setLogs(prev => prev.map(log =>
          log.id === currentThinkingId.current ? { ...log, content: cleanContent } : log
        ));
      }
    },
    onThinkingEnd: (response: string) => {
      const cleanResponse = (response || "").replace(/\nAction\s*:[\s\S]*$/, "").trim();
      if (!cleanResponse) {
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
                title: cleanResponse.slice(0, 100) + (cleanResponse.length > 100 ? '...' : ''), 
                content: cleanResponse, 
                isStreaming: false 
              }
            : log
        ));
        currentThinkingId.current = null;
      }
    },
    onToolStart: (name: string, input: Record<string, unknown>) => {
      if (currentThinkingId.current) {
        setLogs(prev => prev.map(log =>
          log.id === currentThinkingId.current ? { ...log, isStreaming: false } : log
        ));
        currentThinkingId.current = null;
      }
      addLog({
        type: 'tool',
        title: `Tool: ${name}`,
        content: `Input:\n${JSON.stringify(input, null, 2)}`,
        tool: { name, status: 'running' },
        agentName: currentAgentName.current || undefined,
      });
    },
    onToolEnd: (name: string, output: unknown, duration: number) => {
      setLogs(prev => {
        let idx = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].type === 'tool' && prev[i].tool?.name === name && prev[i].tool?.status === 'running') { 
            idx = i; 
            break; 
          }
        }
        if (idx >= 0) {
          const newLogs = [...prev];
          const previousContent = newLogs[idx].content || '';
          const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
          // 截断过长输出
          const truncatedOutput = outputStr.length > 1000 ? outputStr.slice(0, 1000) + '\n... (truncated)' : outputStr;
          newLogs[idx] = {
            ...newLogs[idx],
            title: `Completed: ${name}`,
            content: `${previousContent}\n\nOutput:\n${truncatedOutput}`,
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
        agentName: currentAgentName.current || undefined,
      });
      loadFindings();
    },
    onComplete: () => {
      addLog({ type: 'info', title: '✅ Audit completed' });
      loadTask();
      loadFindings();
      loadAgentTree();
    },
    onError: (err: string) => {
      addLog({ type: 'error', title: `Error: ${err}` });
    },
  }), [addLog, loadTask, loadFindings, loadAgentTree]);

  const { connect: connectStream, disconnect: disconnectStream, isConnected } = useAgentStream(taskId || null, streamOptions);

  // 初始化
  useEffect(() => {
    if (!taskId) {
      setShowSplash(true);
      return;
    }
    setShowSplash(false);
    setIsLoading(true);
    
    Promise.all([loadTask(), loadFindings(), loadAgentTree()])
      .finally(() => setIsLoading(false));
  }, [taskId, loadTask, loadFindings, loadAgentTree]);

  // 连接流
  useEffect(() => {
    if (taskId && task?.status === 'running') {
      connectStream();
      addLog({ type: 'info', title: '🔗 Connected to audit stream' });
    }
    return () => disconnectStream();
  }, [taskId, task?.status, connectStream, disconnectStream, addLog]);

  // 定期刷新 Agent 树
  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadAgentTree, 3000);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadAgentTree]);

  // 定期刷新 Task 统计数据（Files, Iterations, Tokens, Tool Calls）
  useEffect(() => {
    if (!taskId || !isRunning) return;
    const interval = setInterval(loadTask, 2000);
    return () => clearInterval(interval);
  }, [taskId, isRunning, loadTask]);

  // 自动滚动
  useEffect(() => {
    if (isAutoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  // 取消任务
  const handleCancel = async () => {
    if (!taskId) return;
    try {
      await cancelAgentTask(taskId);
      toast.success("Task cancelled");
      loadTask();
    } catch {
      toast.error("Failed to cancel task");
    }
  };

  // 切换日志展开
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ============ Render ============

  // Splash 画面 (无 taskId)
  if (showSplash && !taskId) {
    return (
      <>
        <SplashScreen onComplete={() => setShowCreateDialog(true)} />
        <CreateAgentTaskDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </>
    );
  }

  // 加载中
  if (isLoading && !task) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="font-mono">Loading audit task...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#0d0d12]">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-primary" />
          <span className="font-bold text-white">DeepAudit</span>
          {task && (
            <>
              <span className="text-gray-600">/</span>
              <span className="text-gray-400 text-sm font-mono truncate max-w-[200px]">
                {task.name || task.id.slice(0, 8)}
              </span>
              <StatusBadge status={task.status} />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="text-gray-400 hover:text-white"
          >
            <Play className="w-4 h-4 mr-1" />
            New Audit
          </Button>
        </div>
      </header>

      {/* Main Content - Strix Layout: 75% left / 25% right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Activity Log (75%) */}
        <div className="w-3/4 flex flex-col border-r border-gray-800">
          {/* Log Header */}
          <div className="flex-shrink-0 h-10 border-b border-gray-800 flex items-center justify-between px-4 bg-[#0d0d12]/50">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Terminal className="w-4 h-4" />
              <span className="uppercase font-bold tracking-wider">Activity Log</span>
              {isConnected && (
                <span className="flex items-center gap-1 text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Live
                </span>
              )}
              {/* 显示日志数量 */}
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-gray-700">
                {filteredLogs.length}{!showAllLogs && logs.length !== filteredLogs.length ? `/${logs.length}` : ''}
              </Badge>
            </div>
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isAutoScroll ? 'bg-primary/20 text-primary' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Auto-scroll {isAutoScroll ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Log Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {/* 过滤提示 */}
            {selectedAgentId && !showAllLogs && (
              <div className="mb-3 px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-between">
                <span className="text-xs text-primary">
                  Filtering logs for selected agent
                </span>
                <button
                  onClick={() => { setShowAllLogs(true); setSelectedAgentId(null); }}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Clear filter
                </button>
              </div>
            )}
            {filteredLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                {isRunning ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {selectedAgentId && !showAllLogs 
                      ? 'Waiting for activity from selected agent...'
                      : 'Waiting for agent activity...'}
                  </span>
                ) : selectedAgentId && !showAllLogs ? (
                  'No activity from selected agent'
                ) : (
                  'No activity yet'
                )}
              </div>
            ) : (
              filteredLogs.map(item => (
                <LogEntry
                  key={item.id}
                  item={item}
                  isExpanded={expandedIds.has(item.id)}
                  onToggle={() => toggleExpand(item.id)}
                />
              ))
            )}
            <div ref={logEndRef} />
          </div>

          {/* Status Bar */}
          {task && (
            <div className="flex-shrink-0 h-8 border-t border-gray-800 flex items-center justify-between px-4 text-xs text-gray-500 bg-[#0d0d12]/50">
              <span>
                {isRunning ? (
                  <span className="flex items-center gap-2 text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    {statusVerb}{'.'.repeat(statusDots)}
                  </span>
                ) : isComplete ? (
                  <span className="text-gray-400">Audit {task.status}</span>
                ) : (
                  'Ready'
                )}
              </span>
              <span className="font-mono">
                {task.progress_percentage?.toFixed(0) || 0}% • {task.analyzed_files}/{task.total_files} files • {task.tool_calls_count || 0} tools
              </span>
            </div>
          )}
        </div>

        {/* Right Panel - Agent Tree + Stats (25%) */}
        <div className="w-1/4 flex flex-col bg-[#0d0d12]">
          {/* Agent Tree */}
          <div className="flex-1 flex flex-col border-b border-gray-800 overflow-hidden">
            <div className="flex-shrink-0 h-10 border-b border-gray-800 flex items-center justify-between px-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Bot className="w-4 h-4" />
                <span className="uppercase font-bold tracking-wider">Agent Tree</span>
                {agentTree && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-gray-700">
                    {agentTree.total_agents}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedAgentId && !showAllLogs && (
                  <button
                    onClick={() => { setShowAllLogs(true); setSelectedAgentId(null); }}
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                  >
                    Show All
                  </button>
                )}
                {agentTree && agentTree.running_agents > 0 && (
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    {agentTree.running_agents} active
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
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
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Initializing agents...
                    </span>
                  ) : (
                    'No agents yet'
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Agent Detail + Stats Panel */}
          <div className="flex-shrink-0 p-3 space-y-3">
            {/* 选中 Agent 详情 */}
            {selectedAgentId && !showAllLogs && (
              <AgentDetailPanel 
                agentId={selectedAgentId} 
                treeNodes={treeNodes}
                onClose={() => { setShowAllLogs(true); setSelectedAgentId(null); }}
              />
            )}
            <StatsPanel task={task} findings={findings} />
          </div>
        </div>
      </div>

      {/* Create Agent Task Dialog */}
      <CreateAgentTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}
