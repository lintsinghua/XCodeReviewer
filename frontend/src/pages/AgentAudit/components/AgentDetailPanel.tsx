/**
 * Agent Detail Panel Component
 * Professional agent information panel with cassette futurism aesthetic
 * Features: Detailed metrics, task info, visual hierarchy
 */

import { memo } from "react";
import { X, Cpu, Scan, FileSearch, ShieldCheck, Bot, Repeat, Zap, Bug, FileCode, Clock, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AGENT_STATUS_CONFIG } from "../constants";
import { findAgentInTree } from "../utils";
import type { AgentDetailPanelProps } from "../types";

// Agent type configurations
const AGENT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  orchestrator: {
    icon: <Cpu className="w-4 h-4" />,
    label: "Orchestrator",
    color: "purple"
  },
  recon: {
    icon: <Scan className="w-4 h-4" />,
    label: "Reconnaissance",
    color: "cyan"
  },
  analysis: {
    icon: <FileSearch className="w-4 h-4" />,
    label: "Analysis",
    color: "amber"
  },
  verification: {
    icon: <ShieldCheck className="w-4 h-4" />,
    label: "Verification",
    color: "green"
  },
};

export const AgentDetailPanel = memo(function AgentDetailPanel({ agentId, treeNodes, onClose }: AgentDetailPanelProps) {
  const agent = findAgentInTree(treeNodes, agentId);
  if (!agent) return null;

  const statusConfig = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.created;
  const typeConfig = AGENT_TYPE_CONFIG[agent.agent_type] || {
    icon: <Bot className="w-4 h-4" />,
    label: "Agent",
    color: "gray"
  };

  const isRunning = agent.status === 'running';

  return (
    <div className="relative rounded border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2.5">
          {/* Agent type icon with color */}
          <div className={`text-${typeConfig.color}-400`}>
            {typeConfig.icon}
          </div>

          {/* Agent name */}
          <div>
            <span className="text-sm font-medium text-white block">{agent.agent_name}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{typeConfig.label}</span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Status indicator */}
      <div className="px-3 py-2 border-b border-gray-800/50 bg-gray-900/20">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className={`
              w-2.5 h-2.5 rounded-full
              ${isRunning ? 'bg-green-400 animate-pulse' : ''}
              ${agent.status === 'completed' ? 'bg-green-500' : ''}
              ${agent.status === 'failed' ? 'bg-red-400' : ''}
              ${agent.status === 'waiting' ? 'bg-yellow-400' : ''}
              ${agent.status === 'created' ? 'bg-gray-500' : ''}
            `} />
            {isRunning && (
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping opacity-30" />
            )}
          </div>
          <span className={`text-xs font-mono uppercase tracking-wider ${statusConfig.color}`}>
            {statusConfig.text}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {/* Iterations */}
        <div className="flex items-center gap-2 p-2 rounded bg-gray-900/30 border border-gray-800/30">
          <Repeat className="w-3.5 h-3.5 text-cyan-400/70" />
          <div>
            <div className="text-[9px] text-gray-600 uppercase">Iterations</div>
            <div className="text-sm text-white font-mono">{agent.iterations || 0}</div>
          </div>
        </div>

        {/* Tool Calls */}
        <div className="flex items-center gap-2 p-2 rounded bg-gray-900/30 border border-gray-800/30">
          <Zap className="w-3.5 h-3.5 text-amber-400/70" />
          <div>
            <div className="text-[9px] text-gray-600 uppercase">Tool Calls</div>
            <div className="text-sm text-white font-mono">{agent.tool_calls || 0}</div>
          </div>
        </div>

        {/* Findings */}
        <div className="flex items-center gap-2 p-2 rounded bg-gray-900/30 border border-gray-800/30">
          <Bug className={`w-3.5 h-3.5 ${agent.findings_count > 0 ? 'text-red-400/70' : 'text-gray-500/70'}`} />
          <div>
            <div className="text-[9px] text-gray-600 uppercase">Findings</div>
            <div className={`text-sm font-mono ${agent.findings_count > 0 ? 'text-red-400' : 'text-white'}`}>
              {agent.findings_count}
            </div>
          </div>
        </div>

        {/* Tokens */}
        <div className="flex items-center gap-2 p-2 rounded bg-gray-900/30 border border-gray-800/30">
          <FileCode className="w-3.5 h-3.5 text-purple-400/70" />
          <div>
            <div className="text-[9px] text-gray-600 uppercase">Tokens</div>
            <div className="text-sm text-white font-mono">
              {((agent.tokens_used || 0) / 1000).toFixed(1)}k
            </div>
          </div>
        </div>
      </div>

      {/* Task description */}
      {agent.task_description && (
        <div className="px-3 pb-3">
          <div className="p-2.5 rounded bg-gray-900/30 border border-gray-800/30">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Current Task</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
              {agent.task_description}
            </p>
          </div>
        </div>
      )}

      {/* Sub-agents indicator */}
      {agent.children && agent.children.length > 0 && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <Network className="w-3 h-3" />
            <span className="uppercase tracking-wider">
              {agent.children.length} Sub-agent{agent.children.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default AgentDetailPanel;
