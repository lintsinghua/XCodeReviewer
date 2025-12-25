/**
 * Agent Audit Constants
 * Shared constants for the Agent Audit page
 * Cassette Futurism / Terminal Retro aesthetic
 * Enhanced color palette for better visibility
 */

import React from "react";
import {
  Brain, Wrench, Target, Bug, Zap, Terminal,
  AlertTriangle, Shield, Search, FileCode,
  CheckCircle2, XCircle, Clock, Loader2, Square, Bot,
  Cpu, Scan, FileSearch, ShieldCheck
} from "lucide-react";

// ============ Severity Colors (Enhanced contrast) ============

export const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-rose-700 dark:text-rose-300 bg-rose-500/20 border border-rose-500/40",
  high: "text-orange-700 dark:text-orange-300 bg-orange-500/20 border border-orange-500/40",
  medium: "text-amber-700 dark:text-amber-300 bg-amber-500/20 border border-amber-500/40",
  low: "text-sky-700 dark:text-sky-300 bg-sky-500/20 border border-sky-500/40",
  info: "text-foreground bg-muted/20 border border-border",
};

// ============ Action Verbs for Animation ============

export const ACTION_VERBS = [
  "Analyzing", "Scanning", "Probing", "Investigating",
  "Examining", "Auditing", "Testing", "Exploring",
  "Processing", "Evaluating", "Tracing", "Mapping"
];

// ============ Log Type Configurations (Enhanced colors) ============

export const LOG_TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  borderColor: string;
  bgColor: string;
}> = {
  thinking: {
    icon: React.createElement(Brain, { className: "w-4 h-4 text-violet-600 dark:text-violet-400" }),
    borderColor: "border-l-violet-500",
    bgColor: "bg-violet-500/10"
  },
  tool: {
    icon: React.createElement(Wrench, { className: "w-4 h-4 text-amber-600 dark:text-amber-400" }),
    borderColor: "border-l-amber-500",
    bgColor: "bg-amber-500/10"
  },
  phase: {
    icon: React.createElement(Target, { className: "w-4 h-4 text-teal-600 dark:text-teal-400" }),
    borderColor: "border-l-teal-500",
    bgColor: "bg-teal-500/10"
  },
  finding: {
    icon: React.createElement(Bug, { className: "w-4 h-4 text-rose-600 dark:text-rose-400" }),
    borderColor: "border-l-rose-500",
    bgColor: "bg-rose-500/10"
  },
  dispatch: {
    icon: React.createElement(Zap, { className: "w-4 h-4 text-sky-600 dark:text-sky-400" }),
    borderColor: "border-l-sky-500",
    bgColor: "bg-sky-500/10"
  },
  info: {
    icon: React.createElement(Terminal, { className: "w-4 h-4 text-muted-foreground" }),
    borderColor: "border-l-muted-foreground",
    bgColor: "bg-muted/10"
  },
  error: {
    icon: React.createElement(AlertTriangle, { className: "w-4 h-4 text-red-600 dark:text-red-400" }),
    borderColor: "border-l-red-500",
    bgColor: "bg-red-500/15"
  },
  user: {
    icon: React.createElement(Shield, { className: "w-4 h-4 text-indigo-600 dark:text-indigo-400" }),
    borderColor: "border-l-indigo-500",
    bgColor: "bg-indigo-500/10"
  },
  progress: {
    icon: React.createElement(Loader2, { className: "w-4 h-4 text-cyan-600 dark:text-cyan-400 animate-spin" }),
    borderColor: "border-l-cyan-500",
    bgColor: "bg-cyan-500/10"
  },
};

// ============ Agent Status Configurations ============

export const AGENT_STATUS_CONFIG: Record<string, {
  icon: React.ReactNode;
  color: string;
  text: string;
  animate?: boolean;
}> = {
  running: {
    icon: React.createElement("div", { className: "w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" }),
    color: "text-emerald-600 dark:text-emerald-400",
    text: "Running",
    animate: true
  },
  completed: {
    icon: React.createElement(CheckCircle2, { className: "w-3 h-3 text-emerald-600 dark:text-emerald-400" }),
    color: "text-emerald-600 dark:text-emerald-400",
    text: "Completed"
  },
  failed: {
    icon: React.createElement(XCircle, { className: "w-3 h-3 text-rose-600 dark:text-rose-400" }),
    color: "text-rose-600 dark:text-rose-400",
    text: "Failed"
  },
  waiting: {
    icon: React.createElement(Clock, { className: "w-3 h-3 text-amber-600 dark:text-amber-400" }),
    color: "text-amber-600 dark:text-amber-400",
    text: "Waiting"
  },
  created: {
    icon: React.createElement("div", { className: "w-2 h-2 rounded-full bg-muted" }),
    color: "text-muted-foreground",
    text: "Created"
  },
};

// ============ Agent Type Configurations ============

export const AGENT_TYPE_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  color: string;
}> = {
  orchestrator: {
    icon: React.createElement(Cpu, { className: "w-4 h-4 text-violet-600 dark:text-violet-400" }),
    label: "Orchestrator",
    color: "violet"
  },
  recon: {
    icon: React.createElement(Scan, { className: "w-4 h-4 text-teal-600 dark:text-teal-400" }),
    label: "Reconnaissance",
    color: "teal"
  },
  analysis: {
    icon: React.createElement(FileSearch, { className: "w-4 h-4 text-amber-600 dark:text-amber-400" }),
    label: "Analysis",
    color: "amber"
  },
  verification: {
    icon: React.createElement(ShieldCheck, { className: "w-4 h-4 text-emerald-600 dark:text-emerald-400" }),
    label: "Verification",
    color: "emerald"
  },
};

// ============ Task Status Configurations ============

export const TASK_STATUS_CONFIG: Record<string, {
  bg: string;
  icon: React.ReactNode;
  text: string;
}> = {
  pending: {
    bg: "bg-muted",
    icon: React.createElement(Clock, { className: "w-3 h-3" }),
    text: "PENDING"
  },
  running: {
    bg: "bg-emerald-600",
    icon: React.createElement(Loader2, { className: "w-3 h-3 animate-spin" }),
    text: "RUNNING"
  },
  completed: {
    bg: "bg-emerald-600",
    icon: React.createElement(CheckCircle2, { className: "w-3 h-3" }),
    text: "COMPLETED"
  },
  failed: {
    bg: "bg-rose-600",
    icon: React.createElement(XCircle, { className: "w-3 h-3" }),
    text: "FAILED"
  },
  cancelled: {
    bg: "bg-amber-600",
    icon: React.createElement(Square, { className: "w-3 h-3" }),
    text: "CANCELLED"
  },
};

// ============ Polling Intervals ============

export const POLLING_INTERVALS = {
  AGENT_TREE: 2000,
  TASK_STATS: 2000,
  AGENT_TREE_DEBOUNCE: 500,
  AGENT_TREE_MIN_DELAY: 100,
};

// ============ Timeouts ============

export const TIMEOUTS = {
  SPLASH_SCREEN: 2800,
  HEARTBEAT: 45000,
  RECONNECT_BASE: 1000,
  MAX_RECONNECT_ATTEMPTS: 5,
};

// ============ UI Configuration ============

export const UI_CONFIG = {
  LOG_MAX_HEIGHT: 256,
  TREE_INDENT: 16,
  ANIMATION_DURATION: 200,
  SCROLL_BEHAVIOR: 'smooth' as const,
};

// ============ Color Palette ============

export const COLORS = {
  primary: '#FF6B2C',
  success: '#34d399',  // emerald-400
  error: '#fb7185',    // rose-400
  warning: '#fbbf24',  // amber-400
  info: '#38bdf8',     // sky-400
  background: {
    primary: '#0a0a0f',
    secondary: '#0d0d12',
    tertiary: '#0b0b10',
  },
  border: {
    primary: 'rgba(255,255,255,0.1)',
    secondary: 'rgba(255,255,255,0.05)',
  }
};

// ============ ASCII Art ============

export const DEEPAUDIT_ASCII = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ____  _____ _____ ____   _   _   _ ____ ___ _____         ║
║    |  _ \\| ____| ____|  _ \\ / \\ | | | |  _ \\_ _|_   _|        ║
║    | | | |  _| |  _| | |_) / _ \\| | | | | | | |  | |          ║
║    | |_| | |___| |___|  __/ ___ \\ |_| | |_| | |  | |          ║
║    |____/|_____|_____|_| /_/   \\_\\___/|____/___| |_|          ║
║                                                               ║
║                 [ Autonomous Security Agent ]                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝`;
