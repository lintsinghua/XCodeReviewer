/**
 * Agent Tree Node Component
 * Elegant tree visualization with enhanced visual design
 * Features: Animated connection lines, status indicators, smooth transitions
 * Premium visual effects with depth and hierarchy
 */

import { useState, memo } from "react";
import { ChevronDown, ChevronRight, Bot, Cpu, Scan, FileSearch, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AGENT_STATUS_CONFIG } from "../constants";
import type { AgentTreeNodeItemProps } from "../types";

// Agent type icons with enhanced colors and styling
const AGENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  orchestrator: <Cpu className="w-4 h-4 text-violet-500" />,
  recon: <Scan className="w-4 h-4 text-teal-500" />,
  analysis: <FileSearch className="w-4 h-4 text-amber-500" />,
  verification: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
};

// Agent type background colors for icon container
const AGENT_TYPE_BG: Record<string, string> = {
  orchestrator: 'bg-violet-500/15 border-violet-500/30',
  recon: 'bg-teal-500/15 border-teal-500/30',
  analysis: 'bg-amber-500/15 border-amber-500/30',
  verification: 'bg-emerald-500/15 border-emerald-500/30',
};

// Status colors for the glow effect
const STATUS_GLOW_COLORS: Record<string, string> = {
  running: 'shadow-[0_0_15px_rgba(52,211,153,0.3)]',
  completed: 'shadow-[0_0_10px_rgba(52,211,153,0.15)]',
  failed: 'shadow-[0_0_12px_rgba(244,63,94,0.25)]',
  waiting: 'shadow-[0_0_8px_rgba(251,191,36,0.2)]',
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
  const isCompleted = node.status === 'completed';
  const isFailed = node.status === 'failed';

  const statusConfig = AGENT_STATUS_CONFIG[node.status] || AGENT_STATUS_CONFIG.created;
  const typeIcon = AGENT_TYPE_ICONS[node.agent_type] || <Bot className="w-3.5 h-3.5 text-muted-foreground" />;
  const typeBg = AGENT_TYPE_BG[node.agent_type] || 'bg-muted/50 border-border/50';

  return (
    <div className="relative">
      {/* Connection line to parent - vertical line with gradient */}
      {depth > 0 && (
        <div
          className="absolute top-0 w-px bg-gradient-to-b from-border/80 via-border/50 to-border/30"
          style={{
            left: `${depth * 20 - 10}px`,
            height: '22px',
          }}
        />
      )}

      {/* Horizontal connector line with dot */}
      {depth > 0 && (
        <>
          <div
            className="absolute top-[22px] h-px bg-gradient-to-r from-border/60 to-border/30"
            style={{
              left: `${depth * 20 - 10}px`,
              width: '10px',
            }}
          />
          <div
            className="absolute top-[20px] w-1.5 h-1.5 rounded-full bg-border/60"
            style={{
              left: `${depth * 20 - 11}px`,
            }}
          />
        </>
      )}

      {/* Node item with enhanced styling */}
      <div
        className={`
          group relative flex items-center gap-2.5 py-2.5 px-3 cursor-pointer rounded-lg
          transition-all duration-300 ease-out backdrop-blur-sm
          ${isSelected
            ? 'bg-primary/15 border border-primary/50 shadow-[0_0_20px_rgba(255,107,44,0.15)]'
            : 'border border-transparent hover:bg-card/60 hover:border-border/50'
          }
          ${STATUS_GLOW_COLORS[node.status] || ''}
        `}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => onSelect(node.agent_id)}
      >
        {/* Expand/collapse button with enhanced styling */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`
              flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md
              transition-all duration-300
              ${expanded ? 'bg-muted/80 border border-border/50' : 'hover:bg-muted/50'}
            `}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        )}

        {/* Status indicator with enhanced glow */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-3 h-3 rounded-full transition-all duration-300
            ${isRunning ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : ''}
            ${isCompleted ? 'bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.4)]' : ''}
            ${isFailed ? 'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.4)]' : ''}
            ${node.status === 'waiting' ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]' : ''}
            ${node.status === 'created' ? 'bg-muted-foreground/50' : ''}
          `} />
          {isRunning && (
            <>
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-40" />
              <div className="absolute inset-[-2px] w-[calc(100%+4px)] h-[calc(100%+4px)] rounded-full border border-emerald-400/30 animate-pulse" />
            </>
          )}
        </div>

        {/* Agent type icon with background */}
        <div className={`flex-shrink-0 p-1.5 rounded-md border ${typeBg} transition-all duration-300 group-hover:scale-105`}>
          {typeIcon}
        </div>

        {/* Agent name with enhanced styling */}
        <span className={`
          text-sm font-mono truncate flex-1 transition-all duration-300
          ${isSelected ? 'text-foreground font-semibold' : 'text-foreground/90 group-hover:text-foreground'}
        `}>
          {node.agent_name}
        </span>

        {/* Metrics badges with enhanced styling */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Iterations with icon */}
          {(node.iterations ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted/80 px-2 py-1 rounded-md border border-border/50">
              <Zap className="w-3 h-3" />
              <span>{node.iterations}</span>
            </div>
          )}

          {/* Findings count - Only show for Orchestrator (root agent) */}
          {!node.parent_agent_id && node.findings_count > 0 && (
            <Badge className="h-6 px-2.5 text-xs bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40 font-mono font-bold shadow-[0_0_10px_rgba(244,63,94,0.15)]">
              {node.findings_count} findings
            </Badge>
          )}
        </div>
      </div>

      {/* Children with animated reveal */}
      {expanded && hasChildren && (
        <div
          className="relative animate-in slide-in-from-top-1 duration-300"
        >
          {/* Vertical connection line for children with gradient */}
          <div
            className="absolute w-px bg-gradient-to-b from-border/60 via-border/40 to-transparent"
            style={{
              left: `${(depth + 1) * 20 - 10}px`,
              top: '0',
              height: `calc(100% - 24px)`,
            }}
          />

          {node.children.map((child) => (
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
});

export default AgentTreeNodeItem;
