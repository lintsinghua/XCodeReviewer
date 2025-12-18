/**
 * Stats Panel Component
 * Dashboard-style statistics with cassette futurism aesthetic
 * Features: Animated progress, metric gauges, severity indicators
 * Enhanced color palette for better visibility
 */

import { memo } from "react";
import { Activity, FileCode, Repeat, Zap, Bug, Shield, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StatsPanelProps } from "../types";

// Circular progress component
function CircularProgress({ value, size = 48, strokeWidth = 3, color = "primary" }: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const colorMap: Record<string, string> = {
    primary: '#FF6B2C',
    emerald: '#34d399',
    rose: '#fb7185',
    amber: '#fbbf24',
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={colorMap[color] || colorMap.primary}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
        style={{
          filter: `drop-shadow(0 0 6px ${colorMap[color] || colorMap.primary}50)`,
        }}
      />
    </svg>
  );
}

// Metric card component with enhanced colors
function MetricCard({ icon, label, value, suffix = "", colorClass = "text-muted-foreground" }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  colorClass?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded bg-card border border-border">
      <div className={colorClass}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground uppercase tracking-wider truncate font-medium">{label}</div>
        <div className="text-lg text-foreground font-mono font-bold">
          {value}<span className="text-muted-foreground text-base">{suffix}</span>
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
      {/* Progress Section */}
      <div className="p-4 rounded border border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Progress</span>
          </div>
          <span className="text-xs text-primary font-mono font-bold">{progressPercent.toFixed(0)}%</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Shine effect */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"
            style={{
              width: `${progressPercent}%`,
              animation: 'shine 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* File progress */}
        <div className="flex items-center justify-between mt-3 text-base">
          <span className="text-muted-foreground font-medium">Files scanned</span>
          <span className="text-foreground font-mono font-bold">
            {task.analyzed_files}<span className="text-muted-foreground font-normal">/{task.total_files}</span>
          </span>
        </div>
        {/* Files with findings */}
        {task.files_with_findings > 0 && (
          <div className="flex items-center justify-between mt-2 text-base">
            <span className="text-muted-foreground font-medium">Files with findings</span>
            <span className="text-rose-500 dark:text-rose-400 font-mono font-bold">
              {task.files_with_findings}
            </span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          icon={<Repeat className="w-4 h-4" />}
          label="Iterations"
          value={task.total_iterations || 0}
          colorClass="text-teal-600 dark:text-teal-400"
        />
        <MetricCard
          icon={<Zap className="w-4 h-4" />}
          label="Tool Calls"
          value={task.tool_calls_count || 0}
          colorClass="text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          icon={<FileCode className="w-4 h-4" />}
          label="Tokens"
          value={((task.tokens_used || 0) / 1000).toFixed(1)}
          suffix="k"
          colorClass="text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          icon={<Bug className="w-4 h-4" />}
          label="Findings"
          value={totalFindings}
          colorClass={totalFindings > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}
        />
      </div>

      {/* Findings breakdown */}
      {totalFindings > 0 && (
        <div className="p-4 rounded border border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Severity Breakdown</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {severityCounts.critical > 0 && (
              <Badge className="bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 text-sm font-mono font-semibold">
                CRIT: {severityCounts.critical}
              </Badge>
            )}
            {severityCounts.high > 0 && (
              <Badge className="bg-orange-500/25 text-orange-700 dark:text-orange-300 border border-orange-500/40 text-sm font-mono font-semibold">
                HIGH: {severityCounts.high}
              </Badge>
            )}
            {severityCounts.medium > 0 && (
              <Badge className="bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 text-sm font-mono font-semibold">
                MED: {severityCounts.medium}
              </Badge>
            )}
            {severityCounts.low > 0 && (
              <Badge className="bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/40 text-sm font-mono font-semibold">
                LOW: {severityCounts.low}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Security Score */}
      {task.security_score !== null && task.security_score !== undefined && (
        <div className="p-4 rounded border border-border bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Security Score</span>
            </div>
            <div className="relative">
              <CircularProgress
                value={task.security_score}
                size={44}
                strokeWidth={3}
                color={getScoreColor(task.security_score)}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold font-mono ${task.security_score >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                  task.security_score >= 60 ? 'text-amber-600 dark:text-amber-400' :
                    'text-rose-600 dark:text-rose-400'
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
