/**
 * Status Badge Component
 * Elegant status indicator with cassette futurism aesthetic
 * Features: Animated states, glow effects, refined typography
 */

import { memo } from "react";
import { CheckCircle2, XCircle, Clock, Loader2, Square, AlertCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "default";
}

const STATUS_CONFIG: Record<string, {
  icon: React.ReactNode;
  iconSm: React.ReactNode;
  bg: string;
  text: string;
  label: string;
  glow?: string;
  animate?: boolean;
}> = {
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    iconSm: <Clock className="w-3 h-3" />,
    bg: "bg-muted border-border",
    text: "text-foreground",
    label: "PENDING",
  },
  running: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    iconSm: <Loader2 className="w-3 h-3 animate-spin" />,
    bg: "bg-green-100 dark:bg-green-950/80 border-green-500/50",
    text: "text-green-700 dark:text-green-400",
    label: "RUNNING",
    glow: "dark:shadow-[0_0_8px_rgba(74,222,128,0.3)]",
    animate: true,
  },
  completed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    iconSm: <CheckCircle2 className="w-3 h-3" />,
    bg: "bg-green-100 dark:bg-green-950/60 border-green-600/50",
    text: "text-green-700 dark:text-green-400",
    label: "COMPLETED",
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    iconSm: <XCircle className="w-3 h-3" />,
    bg: "bg-red-100 dark:bg-red-950/60 border-red-600/50",
    text: "text-red-700 dark:text-red-400",
    label: "FAILED",
    glow: "dark:shadow-[0_0_8px_rgba(248,113,113,0.2)]",
  },
  cancelled: {
    icon: <Square className="w-3.5 h-3.5" />,
    iconSm: <Square className="w-3 h-3" />,
    bg: "bg-yellow-100 dark:bg-yellow-950/60 border-yellow-600/50",
    text: "text-yellow-700 dark:text-yellow-400",
    label: "CANCELLED",
  },
  error: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    iconSm: <AlertCircle className="w-3 h-3" />,
    bg: "bg-red-100 dark:bg-red-950/60 border-red-600/50",
    text: "text-red-700 dark:text-red-400",
    label: "ERROR",
    glow: "dark:shadow-[0_0_8px_rgba(248,113,113,0.2)]",
  },
};

export const StatusBadge = memo(function StatusBadge({ status, size = "default" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isSmall = size === "sm";

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded border font-mono uppercase tracking-wider
        transition-all duration-300
        ${config.bg}
        ${config.text}
        ${config.glow || ''}
        ${isSmall ? 'px-2 py-1 text-sm' : 'px-2.5 py-1.5 text-sm'}
      `}
    >
      {isSmall ? config.iconSm : config.icon}
      <span className="font-semibold">{config.label}</span>
    </div>
  );
});

export default StatusBadge;
