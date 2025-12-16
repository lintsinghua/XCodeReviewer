/**
 * Log Entry Component
 * Terminal-style log entry with cassette futurism aesthetic
 * Professional log formatting without emojis
 */

import { memo } from "react";
import {
  ChevronDown, ChevronUp, Loader2, Clock,
  CheckCircle2, Wifi, XOctagon, AlertTriangle,
  Play, Square, ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LOG_TYPE_CONFIG, SEVERITY_COLORS } from "../constants";
import type { LogEntryProps } from "../types";

// Log type labels for display
const LOG_TYPE_LABELS: Record<string, string> = {
  thinking: 'THINK',
  tool: 'TOOL',
  phase: 'PHASE',
  finding: 'VULN',
  dispatch: 'DISPATCH',
  info: 'INFO',
  error: 'ERROR',
  user: 'USER',
  progress: 'PROGRESS',
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
  const showContent = isThinking || isExpanded;
  const isCollapsible = !isThinking && item.content;

  const formattedTitle = formatTitle(item.title, item.type);
  const statusIcon = isInfo ? getStatusIcon(formattedTitle) : null;

  return (
    <div
      className={`
        group relative mb-1.5 transition-all duration-200 ease-out
        ${isCollapsible ? 'cursor-pointer' : ''}
      `}
      onClick={isCollapsible ? onToggle : undefined}
    >
      {/* Main card */}
      <div className={`
        relative rounded border-l-2 overflow-hidden
        ${config.borderColor}
        ${isExpanded ? 'bg-gray-900/60' : 'bg-gray-900/30'}
        ${isCollapsible ? 'hover:bg-gray-900/50' : ''}
        ${isFinding ? 'border-r border-r-red-900/30' : ''}
        ${isError ? 'border-r border-r-red-900/30' : ''}
        transition-all duration-200
      `}>
        {/* Subtle gradient overlay */}
        <div className={`absolute inset-0 opacity-20 pointer-events-none ${config.bgColor}`} />

        {/* Content */}
        <div className="relative px-3 py-2.5">
          {/* Header row */}
          <div className="flex items-center gap-2">
            {/* Type icon */}
            <div className="relative flex-shrink-0">
              <div className={`${item.isStreaming ? 'animate-pulse' : ''}`}>
                {config.icon}
              </div>
              {item.isStreaming && (
                <div className="absolute inset-0 blur-sm opacity-50">
                  {config.icon}
                </div>
              )}
            </div>

            {/* Type label */}
            <span className={`
              text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
              ${isThinking ? 'bg-violet-500/25 text-violet-300' : ''}
              ${isTool ? 'bg-amber-500/25 text-amber-300' : ''}
              ${isFinding ? 'bg-rose-500/25 text-rose-300' : ''}
              ${isError ? 'bg-red-500/25 text-red-300' : ''}
              ${isInfo ? 'bg-slate-500/25 text-slate-300' : ''}
              ${isProgress ? 'bg-cyan-500/25 text-cyan-300' : ''}
              ${item.type === 'dispatch' ? 'bg-sky-500/25 text-sky-300' : ''}
              ${item.type === 'phase' ? 'bg-teal-500/25 text-teal-300' : ''}
              ${item.type === 'user' ? 'bg-indigo-500/25 text-indigo-300' : ''}
              flex-shrink-0
            `}>
              {LOG_TYPE_LABELS[item.type] || 'LOG'}
            </span>

            {/* Timestamp */}
            <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">
              {item.time}
            </span>

            {/* Separator */}
            <ArrowRight className="w-3 h-3 text-gray-700 flex-shrink-0" />

            {/* Status icon for info messages */}
            {statusIcon && <span className="flex-shrink-0">{statusIcon}</span>}

            {/* Title - for non-thinking types */}
            {!isThinking && (
              <span className="text-sm text-gray-300 truncate flex-1">
                {formattedTitle}
              </span>
            )}

            {/* Streaming cursor */}
            {item.isStreaming && (
              <span className="w-1.5 h-4 bg-purple-400 animate-[blink_1s_ease-in-out_infinite] rounded-sm flex-shrink-0" />
            )}

            {/* Tool status */}
            {item.tool?.status === 'running' && (
              <div className="flex items-center gap-1.5 flex-shrink-0 bg-amber-500/10 px-2 py-0.5 rounded">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span className="text-[9px] text-amber-400 font-mono uppercase">Running</span>
              </div>
            )}

            {item.tool?.status === 'completed' && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              </div>
            )}

            {/* Agent badge */}
            {item.agentName && (
              <Badge
                variant="outline"
                className="h-5 px-2 text-[9px] uppercase tracking-wider border-primary/40 text-primary bg-primary/10 flex-shrink-0 font-semibold"
              >
                {item.agentName}
              </Badge>
            )}

            {/* Right side info */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              {/* Duration badge */}
              {item.tool?.duration !== undefined && (
                <span className="text-[10px] text-gray-500 font-mono bg-gray-800/50 px-1.5 py-0.5 rounded">
                  {item.tool.duration}ms
                </span>
              )}

              {/* Severity badge */}
              {item.severity && (
                <Badge
                  className={`
                    text-[9px] uppercase tracking-wider font-bold px-1.5 py-0
                    ${SEVERITY_COLORS[item.severity] || SEVERITY_COLORS.info}
                  `}
                >
                  {item.severity}
                </Badge>
              )}

              {/* Expand indicator */}
              {isCollapsible && (
                <div className="w-5 h-5 flex items-center justify-center rounded bg-gray-800/30 group-hover:bg-gray-800/50 transition-colors">
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Thinking content - always visible with special styling */}
          {isThinking && item.content && (
            <div className="mt-2.5 relative">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-purple-500/20 to-transparent" />
              <div className="pl-3 text-sm text-purple-200/90 leading-relaxed whitespace-pre-wrap break-words">
                {item.content}
              </div>
            </div>
          )}

          {/* Collapsible content */}
          {!isThinking && showContent && item.content && (
            <div className="mt-2.5 overflow-hidden">
              <div className="bg-[#08080c] rounded border border-gray-800/50 overflow-hidden">
                {/* Mini header */}
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-800/50 bg-gray-900/50">
                  <div className="flex items-center gap-2">
                    <Square className="w-2.5 h-2.5 text-gray-600" />
                    <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">
                      {isTool ? 'Output' : 'Details'}
                    </span>
                  </div>
                  {item.tool?.status === 'completed' && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500/70" />
                      <span className="text-[9px] text-green-500/70 font-mono">Complete</span>
                    </div>
                  )}
                </div>
                {/* Content */}
                <pre className="p-3 text-xs font-mono text-gray-400 max-h-56 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words leading-relaxed">
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
