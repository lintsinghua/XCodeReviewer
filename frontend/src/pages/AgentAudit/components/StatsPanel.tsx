/**
 * Stats Panel Component
 * Dashboard-style statistics with premium visual design
 * Features: Animated progress, metric gauges, severity indicators
 * Enhanced visual effects with depth and polish
 */

import { memo } from "react";
import { Activity, FileCode, Repeat, Zap, Bug, Shield, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StatsPanelProps } from "../types";

// Enhanced Circular progress component with glow effect
function CircularProgress({ value, size = 52, strokeWidth = 4, color = "primary" }: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const colorMap: Record<string, { stroke: string; glow: string }> = {
    primary: { stroke: '#FF6B2C', glow: 'rgba(255,107,44,0.4)' },
    emerald: { stroke: '#34d399', glow: 'rgba(52,211,153,0.4)' },
    rose: { stroke: '#fb7185', glow: 'rgba(251,113,133,0.4)' },
    amber: { stroke: '#fbbf24', glow: 'rgba(251,191,36,0.4)' },
  };

  const colors = colorMap[color] || colorMap.primary;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle with subtle gradient */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Glow effect circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeWidth + 4}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out opacity-20 blur-sm"
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
        style={{
          filter: `drop-shadow(0 0 8px ${colors.glow})`,
        }}
      />
    </svg>
  );
}

// Enhanced Metric card component with premium styling
function MetricCard({ icon, label, value, suffix = "", colorClass = "text-muted-foreground", bgClass = "" }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  colorClass?: string;
  bgClass?: string;
}) {
  return (
    <div className={`
      group relative flex items-center gap-3 p-3.5 rounded-lg
      bg-card/80 border border-border/50 backdrop-blur-sm
      hover:bg-card hover:border-border/80 hover:shadow-md
      transition-all duration-300
      ${bgClass}
    `}>
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className={`relative z-10 p-2 rounded-md bg-muted/50 border border-border/50 ${colorClass} transition-transform duration-300 group-hover:scale-105`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="text-xs text-muted-foreground uppercase tracking-wider truncate font-medium mb-0.5">{label}</div>
        <div className="text-lg text-foreground font-mono font-bold leading-tight">
          {value}<span className="text-muted-foreground text-sm ml-0.5">{suffix}</span>
        </div>
      </div>
    </div>
  );
}

export const StatsPanel = memo(function StatsPanel({ task, findings }: StatsPanelProps) {
  if (!task) return null;

  // 🔥 Use task's reliable statistics instead of computing from findings array
  // This ensures consistency even when findings array is empty or not loaded
  const severityCounts = {
    critical: task.critical_count || 0,
    high: task.high_count || 0,
    medium: task.medium_count || 0,
    low: task.low_count || 0,
  };
  const totalFindings = task.findings_count || 0;
  const progressPercent = task.progress_percentage || 0;

  // Determine score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'emerald';
    if (score >= 60) return 'amber';
    return 'rose';
  };

  return (
    <div className="space-y-3">
      {/* Progress Section with enhanced styling */}
      <div className="p-4 rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-primary/15 border border-primary/30">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-foreground uppercase tracking-wider font-semibold">Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-primary font-mono font-bold">{progressPercent.toFixed(0)}</span>
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {/* Enhanced Progress bar */}
          <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden border border-border/30">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-primary/80 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Animated shine effect */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"
              style={{
                width: `${progressPercent}%`,
                animation: 'shine 2s ease-in-out infinite',
              }}
            />
            {/* Glow effect */}
            <div
              className="absolute inset-y-0 left-0 rounded-full blur-sm opacity-50"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(to right, #FF6B2C, #FF6B2C)',
              }}
            />
          </div>

          {/* File progress with enhanced styling */}
          <div className="flex items-center justify-between mt-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileCode className="w-4 h-4" />
              <span className="font-medium">Files scanned</span>
            </div>
            <span className="text-foreground font-mono font-bold">
              {task.analyzed_files}<span className="text-muted-foreground font-normal"> / {task.total_files}</span>
            </span>
          </div>
          {/* Files with findings */}
          {task.files_with_findings > 0 && (
            <div className="flex items-center justify-between mt-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="font-medium">Files with findings</span>
              </div>
              <span className="text-rose-500 font-mono font-bold">
                {task.files_with_findings}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid with enhanced styling */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          icon={<Repeat className="w-4 h-4" />}
          label="Iterations"
          value={task.total_iterations || 0}
          colorClass="text-teal-500"
        />
        <MetricCard
          icon={<Zap className="w-4 h-4" />}
          label="Tool Calls"
          value={task.tool_calls_count || 0}
          colorClass="text-amber-500"
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Tokens"
          value={((task.tokens_used || 0) / 1000).toFixed(1)}
          suffix="k"
          colorClass="text-violet-500"
        />
        <MetricCard
          icon={<Bug className="w-4 h-4" />}
          label="Findings"
          value={totalFindings}
          colorClass={totalFindings > 0 ? "text-rose-500" : "text-muted-foreground"}
          bgClass={totalFindings > 0 ? "border-rose-500/20" : ""}
        />
      </div>

      {/* Findings breakdown with enhanced styling */}
      {totalFindings > 0 && (
        <div className="p-4 rounded-lg border border-rose-500/20 bg-card/80 backdrop-blur-sm relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1.5 rounded-md bg-rose-500/15 border border-rose-500/30">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <span className="text-sm text-foreground uppercase tracking-wider font-semibold">Severity Breakdown</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {severityCounts.critical > 0 && (
                <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40 text-xs font-mono font-bold px-2.5 py-1 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                  CRITICAL: {severityCounts.critical}
                </Badge>
              )}
              {severityCounts.high > 0 && (
                <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-300 border border-orange-500/40 text-xs font-mono font-bold px-2.5 py-1 shadow-[0_0_10px_rgba(249,115,22,0.15)]">
                  HIGH: {severityCounts.high}
                </Badge>
              )}
              {severityCounts.medium > 0 && (
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 text-xs font-mono font-bold px-2.5 py-1 shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                  MEDIUM: {severityCounts.medium}
                </Badge>
              )}
              {severityCounts.low > 0 && (
                <Badge className="bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40 text-xs font-mono font-bold px-2.5 py-1 shadow-[0_0_10px_rgba(14,165,233,0.15)]">
                  LOW: {severityCounts.low}
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Security Score with enhanced styling */}
      {task.security_score !== null && task.security_score !== undefined && (
        <div className="p-4 rounded-lg border border-emerald-500/20 bg-card/80 backdrop-blur-sm relative overflow-hidden">
          {/* Background gradient based on score */}
          <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${
            task.security_score >= 80 ? 'from-emerald-500/5' :
            task.security_score >= 60 ? 'from-amber-500/5' :
            'from-rose-500/5'
          } to-transparent`} />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-md border ${
                task.security_score >= 80 ? 'bg-emerald-500/15 border-emerald-500/30' :
                task.security_score >= 60 ? 'bg-amber-500/15 border-amber-500/30' :
                'bg-rose-500/15 border-rose-500/30'
              }`}>
                <Shield className={`w-4 h-4 ${
                  task.security_score >= 80 ? 'text-emerald-500' :
                  task.security_score >= 60 ? 'text-amber-500' :
                  'text-rose-500'
                }`} />
              </div>
              <div>
                <span className="text-sm text-foreground uppercase tracking-wider font-semibold block">Security Score</span>
                <span className="text-xs text-muted-foreground">
                  {task.security_score >= 80 ? 'Excellent' :
                   task.security_score >= 60 ? 'Good' :
                   'Needs Attention'}
                </span>
              </div>
            </div>
            <div className="relative">
              <CircularProgress
                value={task.security_score}
                size={56}
                strokeWidth={4}
                color={getScoreColor(task.security_score)}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-base font-bold font-mono ${
                  task.security_score >= 80 ? 'text-emerald-500' :
                  task.security_score >= 60 ? 'text-amber-500' :
                  'text-rose-500'
                }`}>
                  {task.security_score.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline animation */}
      <style>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
});

export default StatsPanel;
