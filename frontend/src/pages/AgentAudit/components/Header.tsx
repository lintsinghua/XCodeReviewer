/**
 * Header Component
 * Minimalist mechanical terminal header
 * Features: Enhanced glow effects, refined controls, premium feel
 */

import { Square, Download, Play, Loader2, Radio, Cpu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import type { HeaderProps } from "../types";

export function Header({
  task,
  isRunning,
  isCancelling,
  onCancel,
  onExport,
  onNewAudit
}: HeaderProps) {
  return (
    <header className="flex-shrink-0 h-16 border-b border-border/50 flex items-center justify-between px-6 bg-card/80 backdrop-blur-md relative overflow-hidden">
      {/* Animated gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />

      {/* Left side - Brand and task info */}
      <div className="flex items-center gap-5 relative z-10">
        {/* Logo section with enhanced styling */}
        <div className="flex items-center gap-3 pr-5 border-r border-border/50">
          <div className="relative group">
            {/* Logo background glow */}
            <div className="absolute inset-0 bg-primary/20 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
              <Cpu className="w-5 h-5 text-primary" />
              {isRunning && (
                <>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.6)]" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground tracking-wider text-base leading-tight">
              DEEP<span className="text-primary">AUDIT</span>
            </span>
            <span className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase">Security Agent</span>
          </div>
        </div>

        {/* Task info with enhanced styling */}
        {task && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-muted/50 border border-border/50">
              <Radio className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Task</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-foreground text-sm font-mono truncate max-w-[200px] font-medium">
                {task.name || task.id.slice(0, 8)}
              </span>
              <StatusBadge status={task.status} />
            </div>
          </div>
        )}
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-3 relative z-10">
        {isRunning && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
            className="h-9 px-4 text-xs font-mono uppercase tracking-wider text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 transition-all duration-300 disabled:opacity-50 rounded-md shadow-[0_0_15px_rgba(244,63,94,0.1)] hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                <span>Stopping</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 mr-2" />
                <span>Abort</span>
              </>
            )}
          </Button>
        )}

        <div className="h-8 w-px bg-border/50 mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          disabled={!task}
          className="h-9 px-4 text-xs font-mono uppercase tracking-wider text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 transition-all duration-300 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent rounded-md shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
        >
          <Download className="w-3.5 h-3.5 mr-2" />
          <span>Export</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNewAudit}
          className="h-9 px-4 text-xs font-mono uppercase tracking-wider text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all duration-300 rounded-md shadow-[0_0_15px_rgba(255,107,44,0.15)] hover:shadow-[0_0_25px_rgba(255,107,44,0.25)]"
        >
          <Sparkles className="w-3.5 h-3.5 mr-2" />
          <span>New Audit</span>
        </Button>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

      {/* Enhanced bottom glow when running */}
      {isRunning && (
        <>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-4 bg-gradient-to-t from-emerald-500/10 to-transparent pointer-events-none" />
        </>
      )}
    </header>
  );
}

export default Header;
