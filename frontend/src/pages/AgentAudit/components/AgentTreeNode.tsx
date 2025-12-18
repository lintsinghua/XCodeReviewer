/**
 * Agent Tree Node Component
 * Elegant tree visualization with cassette futurism aesthetic
 * Features: Animated connection lines, status indicators, smooth transitions
 * Enhanced color palette for better visibility
 */

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, Bot, Cpu, Scan, FileSearch, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AGENT_STATUS_CONFIG } from "../constants";
import type { AgentTreeNodeItemProps } from "../types";

// Agent type icons with enhanced colors (light/dark mode compatible)
const AGENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  orchestrator: <Cpu className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
  recon: <Scan className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
  analysis: <FileSearch className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
  verification: <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
};

// Status colors for the glow effect
const STATUS_GLOW_COLORS: Record<string, string> = {
  running: 'shadow-[0_0_10px_rgba(52,211,153,0.4)]',
  completed: '',
  failed: 'shadow-[0_0_8px_rgba(251,113,133,0.3)]',
  waiting: '',
  created: '',
};

export const AgentTreeNodeItem = memo(function AgentTreeNodeItem({
  node,
  depth = 0,
  selectedId,
  onSelect
}: AgentTreeNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.agent_id;
  const isRunning = node.status === 'running';

  const statusConfig = AGENT_STATUS_CONFIG[node.status] || AGENT_STATUS_CONFIG.created;
  const typeIcon = AGENT_TYPE_ICONS[node.agent_type] || <Bot className="w-3.5 h-3.5 text-muted-foreground" />;

  return (
    <div className="relative">
      {/* Connection line to parent - vertical line */}
      {depth > 0 && (
        <div
          className="absolute top-0 w-px bg-gradient-to-b from-border to-border"
          style={{
            left: `${depth * 16 - 8}px`,
            height: '20px',
          }}
        />
      )}

      {/* Horizontal connector line */}
      {depth > 0 && (
        <div
          className="absolute top-[20px] h-px bg-muted-foreground"
          style={{
            left: `${depth * 16 - 8}px`,
            width: '8px',
          }}
        />
      )}

      {/* Node item */}
      <div
        className={`
          group relative flex items-center gap-2 py-2 px-2.5 cursor-pointer rounded-sm
          transition-all duration-200 ease-out
          ${isSelected
            ? 'bg-primary/15 border border-primary/40'
            : 'border border-transparent hover:bg-white/5 hover:border-border/50'
          }
          ${STATUS_GLOW_COLORS[node.status] || ''}
        `}
        style={{ marginLeft: `${depth * 16}px` }}
        onClick={() => onSelect(node.agent_id)}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Status indicator with glow */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-2.5 h-2.5 rounded-full transition-all duration-300
            ${isRunning ? 'bg-emerald-400 animate-pulse' : ''}
            ${node.status === 'completed' ? 'bg-emerald-500' : ''}
            ${node.status === 'failed' ? 'bg-rose-400' : ''}
            ${node.status === 'waiting' ? 'bg-amber-400' : ''}
            ${node.status === 'created' ? 'bg-muted' : ''}
          `} />
          {isRunning && (
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-30" />
          )}
        </div>

        {/* Agent type icon */}
        <div className="flex-shrink-0">
          {typeIcon}
        </div>

        {/* Agent name */}
        <span className={`
          text-sm font-mono truncate flex-1 transition-colors duration-200
          ${isSelected ? 'text-foreground font-medium' : 'text-foreground group-hover:text-foreground'}
        `}>
          {node.agent_name}
        </span>

        {/* Metrics badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Iterations */}
          {(node.iterations ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
              {node.iterations}x
            </span>
          )}

          {/* Findings count - Only show for Orchestrator (root agent) */}
          {!node.parent_agent_id && node.findings_count > 0 && (
            <Badge className="h-5 px-2 text-sm bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 font-mono font-semibold">
              {node.findings_count}
            </Badge>
          )}
        </div>
      </div>

      {/* Children with animated reveal */}
      {expanded && hasChildren && (
        <div
          className="relative"
          style={{
            animation: 'slideDown 0.2s ease-out',
          }}
        >
          {/* Vertical connection line for children */}
          <div
            className="absolute w-px bg-gradient-to-b from-border via-border to-transparent"
            style={{
              left: `${(depth + 1) * 16 - 8}px`,
              top: '0',
              height: `calc(100% - 20px)`,
            }}
          />

          {node.children.map((child, index) => (
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

      {/* Inline animation */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
});

export default AgentTreeNodeItem;
