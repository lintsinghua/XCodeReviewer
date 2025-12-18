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
        group relative mb-2 transition-all duration-300 ease-out
        ${isCollapsible ? 'cursor-pointer' : ''}
      `}
      onClick={isCollapsible ? onToggle : undefined}
    >
      {/* Main card with enhanced styling */}
      <div className={`
        relative rounded-lg border-l-3 overflow-hidden backdrop-blur-sm
        ${config.borderColor}
        ${isExpanded ? 'bg-card/80 shadow-lg' : 'bg-card/40'}
        ${isCollapsible ? 'hover:bg-card/60 hover:shadow-md' : ''}
        ${isFinding ? 'border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border border-transparent'}
        ${isError ? 'border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}
        ${isDispatch ? 'border border-sky-500/20' : ''}
        transition-all duration-300
      `}>
        {/* Enhanced gradient overlay */}
        <div className={`absolute inset-0 opacity-30 pointer-events-none bg-gradient-to-r ${config.bgColor} to-transparent`} />

        {/* Content */}
        <div className="relative px-4 py-3">
          {/* Header row */}
          <div className="flex items-center gap-2.5">
            {/* Type icon with glow effect */}
            <div className="relative flex-shrink-0">
              <div className={`${item.isStreaming ? 'animate-pulse' : ''} transition-transform duration-300 group-hover:scale-110`}>
                {config.icon}
              </div>
              {item.isStreaming && (
                <div className="absolute inset-0 blur-md opacity-60">
                  {config.icon}
                </div>
              )}
            </div>

            {/* Type label with enhanced styling */}
            <span className={`
              text-xs font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md
              border transition-all duration-300
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

            {/* Timestamp with subtle styling */}
            <span className="text-xs text-muted-foreground/80 font-mono flex-shrink-0 tabular-nums">
              {item.time}
            </span>

            {/* Separator with animation */}
            <Zap className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />

            {/* Status icon for info messages */}
            {statusIcon && <span className="flex-shrink-0">{statusIcon}</span>}

            {/* Title - for non-thinking types */}
            {!isThinking && (
              <span className="text-sm text-foreground font-medium truncate flex-1 leading-relaxed">
                {formattedTitle}
              </span>
            )}

            {/* Streaming cursor with enhanced animation */}
            {item.isStreaming && (
              <span className="w-2 h-5 bg-gradient-to-b from-violet-400 to-violet-600 animate-[blink_1s_ease-in-out_infinite] rounded-sm flex-shrink-0 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
            )}

            {/* Tool status with enhanced styling */}
            {item.tool?.status === 'running' && (
              <div className="flex items-center gap-2 flex-shrink-0 bg-amber-500/15 px-2.5 py-1 rounded-md border border-amber-500/30">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span className="text-xs text-amber-400 font-mono uppercase font-semibold">Running</span>
              </div>
            )}

            {item.tool?.status === 'completed' && (
              <div className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs text-emerald-500 font-mono uppercase">Done</span>
              </div>
            )}

            {/* Agent badge with enhanced styling */}
            {item.agentName && (
              <Badge
                variant="outline"
                className="h-6 px-2.5 text-xs uppercase tracking-wider border-primary/40 text-primary bg-primary/10 flex-shrink-0 font-semibold shadow-[0_0_10px_rgba(255,107,44,0.1)]"
              >
                {item.agentName}
              </Badge>
            )}

            {/* Right side info */}
            <div className="flex items-center gap-2.5 flex-shrink-0 ml-auto">
              {/* Duration badge with enhanced styling */}
              {item.tool?.duration !== undefined && (
                <span className="text-xs text-muted-foreground font-mono bg-muted/80 px-2 py-1 rounded-md border border-border/50 tabular-nums">
                  {item.tool.duration}ms
                </span>
              )}

              {/* Severity badge with enhanced styling */}
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

              {/* Expand indicator with enhanced styling */}
              {isCollapsible && (
                <div className={`
                  w-6 h-6 flex items-center justify-center rounded-md transition-all duration-300
                  ${isExpanded ? 'bg-primary/20 border border-primary/30' : 'bg-muted/50 border border-transparent group-hover:border-border/50'}
                `}>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-primary" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Thinking content - always visible with enhanced styling */}
          {isThinking && item.content && (
            <div className="mt-3 relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-500/60 via-violet-500/30 to-transparent rounded-full" />
              <div className="pl-4 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                {item.content}
              </div>
            </div>
          )}

          {/* Collapsible content with enhanced styling */}
          {!isThinking && showContent && item.content && (
            <div className="mt-3 overflow-hidden animate-in slide-in-from-top-2 duration-300">
              <div className="bg-card/80 rounded-lg border border-border/50 overflow-hidden backdrop-blur-sm shadow-inner">
                {/* Mini header with enhanced styling */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                    <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                      {isTool ? 'Output' : 'Details'}
                    </span>
                  </div>
                  {item.tool?.status === 'completed' && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs text-emerald-500 font-mono">Complete</span>
                    </div>
                  )}
                </div>
                {/* Content with enhanced styling */}
                <pre className="p-4 text-sm font-mono text-foreground/85 max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words leading-relaxed bg-gradient-to-b from-transparent to-muted/20">
                  {item.content}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline styles for cursor blink */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
});

export default LogEntry;
