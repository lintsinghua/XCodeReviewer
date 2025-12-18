/**
 * Header Component
 * Minimalist mechanical terminal header
 * Features: Subtle glow effects, refined controls
 */

import { Bot, Square, Download, Play, Loader2, Radio, Cpu } from "lucide-react";
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
    <header className="flex-shrink-0 h-14 border-b border-border flex items-center justify-between px-5 bg-card relative overflow-hidden">
      {/* Subtle animated line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Left side - Brand and task info */}
      <div className="flex items-center gap-4">
        {/* Logo section */}
        <div className="flex items-center gap-2.5 pr-4 border-r border-border">
          <div className="relative">
            <Cpu className="w-5 h-5 text-primary" />
            {isRunning && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </div>
          <span className="font-bold text-foreground tracking-wide text-sm">
            DEEP<span className="text-primary">AUDIT</span>
          </span>
        </div>

        {/* Task info */}
        {task && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radio className="w-3 h-3" />
              <span className="text-xs font-mono uppercase tracking-wider">Task</span>
            </div>
            <span className="text-foreground text-sm font-mono truncate max-w-[180px]">
              {task.name || task.id.slice(0, 8)}
            </span>
            <StatusBadge status={task.status} />
          </div>
        )}
      </div>

      {/* Right side - Controls */}
      <div className="flex items-center gap-2">
        {isRunning && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isCancelling}
            className="h-8 px-3 text-xs font-mono uppercase tracking-wider text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-900/50 transition-all duration-200 disabled:opacity-50"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                <span>Stopping</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 mr-1.5" />
                <span>Abort</span>
              </>
            )}
          </Button>
        )}

        <div className="h-6 w-px bg-muted mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onExport}
          disabled={!task}
          className="h-8 px-3 text-xs font-mono uppercase tracking-wider text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/30 border border-transparent hover:border-cyan-900/50 transition-all duration-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          <span>Export</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNewAudit}
          className="h-8 px-3 text-xs font-mono uppercase tracking-wider text-primary hover:text-primary/80 hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all duration-200"
        >
          <Play className="w-3.5 h-3.5 mr-1.5" />
          <span>New Audit</span>
        </Button>
      </div>

      {/* Subtle bottom glow when running */}
      {isRunning && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-px bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
      )}
    </header>
  );
}

export default Header;
