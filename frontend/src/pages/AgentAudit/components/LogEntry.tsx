/**
 * Log Entry Component
 * Terminal-style log entry with enhanced visual design
 * Professional log formatting with improved readability
 */

import { memo } from "react";
import {
  ChevronDown, ChevronUp, Loader2,
  CheckCircle2, Wifi, XOctagon, AlertTriangle,
  Play, ArrowRight, Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LOG_TYPE_CONFIG, SEVERITY_COLORS } from "../constants";
import type { LogEntryProps } from "../types";

// Log type labels for display with enhanced styling
const LOG_TYPE_LABELS: Record<string, string> = {
  thinking: 'THINK',
  tool: 'TOOL',
  phase: 'PHASE',
  finding: 'VULN',
  dispatch: 'AGENT',
  info: 'INFO',
  error: 'ERROR',
  user: 'USER',
  progress: 'PROG',
};

// Helper to format title (remove emojis and clean up)
function formatTitle(title: string, type: string): string {
  // Remove common emojis
  let cleaned = title
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/[✅🔗🛑✕⚠️❌⚡🔄🔍💡📁📄🐛🛡️]/g, '')
    .trim();

  // Remove leading punctuation/symbols
  cleaned = cleaned.replace(/^[:\-–—•·]\s*/, '');

  return cleaned || title;
}

// Get status icon for info/system messages
function getStatusIcon(title: string) {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('connect') || lowerTitle.includes('stream')) {
    return <Wifi className="w-3 h-3 text-green-400" />;
  }
  if (lowerTitle.includes('complete') || lowerTitle.includes('success') || lowerTitle.includes('done')) {
    return <CheckCircle2 className="w-3 h-3 text-green-400" />;
  }
  if (lowerTitle.includes('cancel') || lowerTitle.includes('stop') || lowerTitle.includes('abort')) {
    return <XOctagon className="w-3 h-3 text-yellow-400" />;
  }
  if (lowerTitle.includes('error') || lowerTitle.includes('fail')) {
    return <AlertTriangle className="w-3 h-3 text-red-400" />;
  }
  if (lowerTitle.includes('start') || lowerTitle.includes('begin') || lowerTitle.includes('init')) {
    return <Play className="w-3 h-3 text-cyan-400" />;
  }
  return null;
}

export const LogEntry = memo(function LogEntry({ item, isExpanded, onToggle }: LogEntryProps) {
  const config = LOG_TYPE_CONFIG[item.type] || LOG_TYPE_CONFIG.info;
  const isThinking = item.type === 'thinking';
  const isTool = item.type === 'tool';
  const isFinding = item.type === 'finding';
  const isError = item.type === 'error';
  const isInfo = item.type === 'info';
  const isProgress = item.type === 'progress';
  const isDispatch = item.type === 'dispatch';
  const showContent = isThinking || isExpanded;
  const isCollapsible = !isThinking && item.content;

  const formattedTitle = formatTitle(item.title, item.type);
  const statusIcon = isInfo ? getStatusIcon(formattedTitle) : null;

  return (
    <div
      className={`
        group relative transition-all duration-300 ease-out
        ${isCollapsible ? 'cursor-pointer' : ''}
      `}
      onClick={isCollapsible ? onToggle : undefined}
    >
      {/* Main card */}
      <div className={`
        relative rounded-lg border-l-3 overflow-hidden
        ${config.borderColor}
        ${isExpanded ? 'bg-slate-100 dark:bg-card/80' : 'bg-slate-50 dark:bg-card/40'}
        ${isCollapsible ? 'hover:bg-slate-100 dark:hover:bg-card/60' : ''}
        ${isFinding ? 'border border-rose-500/30 dark:border-rose-500/20 !bg-rose-50 dark:!bg-rose-950/20' : 'border border-slate-200 dark:border-transparent'}
        ${isError ? 'border border-red-500/30 dark:border-red-500/20 !bg-red-50 dark:!bg-red-950/20' : ''}
        ${isDispatch ? 'border-sky-500/30 dark:border-sky-500/20 !bg-sky-50 dark:!bg-sky-950/20' : ''}
        ${isThinking ? '!bg-violet-50 dark:!bg-violet-950/20 border-violet-500/30 dark:border-violet-500/20' : ''}
        ${isTool ? '!bg-amber-50 dark:!bg-amber-950/20 border-amber-500/30 dark:border-amber-500/20' : ''}
      `}>

        {/* Content */}
        <div className="relative px-4 py-3">
          {/* Header row */}
          <div className="flex items-center gap-2.5">
            {/* Type icon */}
            <div className="flex-shrink-0">
              {config.icon}
            </div>

            {/* Type label */}
            <span className={`
              text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md border
              ${isThinking ? 'bg-violet-500/20 text-violet-600 dark:text-violet-300 border-violet-500/30' : ''}
              ${isTool ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30' : ''}
              ${isFinding ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30' : ''}
              ${isError ? 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30' : ''}
              ${isInfo ? 'bg-muted/80 text-foreground border-border/50' : ''}
              ${isProgress ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30' : ''}
              ${isDispatch ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/30' : ''}
              ${item.type === 'phase' ? 'bg-teal-500/20 text-teal-600 dark:text-teal-300 border-teal-500/30' : ''}
              ${item.type === 'user' ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/30' : ''}
              flex-shrink-0
            `}>
              {LOG_TYPE_LABELS[item.type] || 'LOG'}
            </span>

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0 tabular-nums">
              {item.time}
            </span>

            {/* Separator */}
            <Zap className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />

            {/* Status icon for info messages */}
            {statusIcon && <span className="flex-shrink-0">{statusIcon}</span>}

            {/* Title - for non-thinking types */}
            {!isThinking && (
              <span className="text-sm text-foreground font-medium truncate flex-1">
                {formattedTitle}
              </span>
            )}

            {/* Streaming cursor */}
            {item.isStreaming && (
              <span className="w-2 h-5 bg-violet-500 rounded-sm flex-shrink-0" />
            )}

            {/* Tool status */}
            {item.tool?.status === 'running' && (
              <div className="flex items-center gap-2 flex-shrink-0 bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-500/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400" />
                <span className="text-xs text-amber-600 dark:text-amber-400 font-mono uppercase font-semibold">Running</span>
              </div>
            )}

            {item.tool?.status === 'completed' && (
              <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
                <span className="text-xs text-emerald-600 dark:text-emerald-500 font-mono uppercase">Done</span>
              </div>
            )}

            {/* Agent badge */}
            {item.agentName && (
              <Badge
                variant="outline"
                className="h-6 px-2.5 text-xs uppercase tracking-wider border-primary/40 text-primary bg-primary/10 flex-shrink-0 font-semibold"
              >
                {item.agentName}
              </Badge>
            )}

            {/* Right side info */}
            <div className="flex items-center gap-2.5 flex-shrink-0 ml-auto">
              {/* Duration badge */}
              {item.tool?.duration !== undefined && (
                <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded-md border border-border tabular-nums">
                  {item.tool.duration}ms
                </span>
              )}

              {/* Severity badge */}
              {item.severity && (
                <Badge
                  className={`
                    text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded-md
                    ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.info}
                  `}
                >
                  {item.severity}
                </Badge>
              )}

              {/* Expand indicator */}
              {isCollapsible && (
                <div className={`
                  w-6 h-6 flex items-center justify-center rounded-md
                  ${isExpanded ? 'bg-primary/20 border border-primary/30' : 'bg-muted border border-border'}
                `}>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-primary" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Thinking content - always visible */}
          {isThinking && item.content && (
            <div className="mt-3 relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-500/50 rounded-full" />
              <div className="pl-4 text-sm text-foreground/90 whitespace-pre-wrap break-words">
                {item.content}
              </div>
            </div>
          )}

          {/* Collapsible content */}
          {!isThinking && showContent && item.content && (
            <div className="mt-3 overflow-hidden">
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                {/* Mini header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground font-mono uppercase">
                      {isTool ? 'Output' : 'Details'}
                    </span>
                  </div>
                  {item.tool?.status === 'completed' && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-500 font-mono">Complete</span>
                    </div>
                  )}
                </div>
                {/* Content */}
                <pre className="p-4 text-sm font-mono text-foreground/85 max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words">
                  {item.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
});

export default LogEntry;
