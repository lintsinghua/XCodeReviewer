/**
 * Report Export Dialog Component
 * Full-featured report export with preview and multi-format support
 * Cassette futurism aesthetic
 */

import { useState, useEffect, useCallback, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  FileJson,
  FileCode,
  Download,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Eye,
  Terminal,
  Shield,
  Bug,
  CheckCircle2,
} from "lucide-react";
import { apiClient } from "@/shared/api/serverClient";
import { downloadAgentReport } from "@/shared/api/agentTasks";
import type { AgentTask, AgentFinding } from "@/shared/api/agentTasks";

// ============ Types ============

type ReportFormat = "markdown" | "json" | "html";

interface ReportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: AgentTask | null;
  findings: AgentFinding[];
}

interface ReportPreview {
  content: string;
  format: ReportFormat;
  loading: boolean;
  error: string | null;
}

// ============ Constants ============

const FORMAT_CONFIG: Record<ReportFormat, {
  label: string;
  icon: React.ReactNode;
  extension: string;
  mime: string;
}> = {
  markdown: {
    label: "Markdown",
    icon: <FileText className="w-4 h-4" />,
    extension: ".md",
    mime: "text/markdown",
  },
  json: {
    label: "JSON",
    icon: <FileJson className="w-4 h-4" />,
    extension: ".json",
    mime: "application/json",
  },
  html: {
    label: "HTML",
    icon: <FileCode className="w-4 h-4" />,
    extension: ".html",
    mime: "text/html",
  },
};

// ============ Helper Functions ============

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: "text-rose-400",
    high: "text-orange-400",
    medium: "text-amber-400",
    low: "text-sky-400",
    info: "text-slate-400",
  };
  return colors[severity.toLowerCase()] || colors.info;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ============ Sub Components ============

// Report stats summary
const ReportStats = memo(function ReportStats({
  task,
  findings,
}: {
  task: AgentTask;
  findings: AgentFinding[];
}) {
  const severityCounts = {
    critical: findings.filter(f => f.severity.toLowerCase() === "critical").length,
    high: findings.filter(f => f.severity.toLowerCase() === "high").length,
    medium: findings.filter(f => f.severity.toLowerCase() === "medium").length,
    low: findings.filter(f => f.severity.toLowerCase() === "low").length,
  };

  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      <div className="p-2.5 rounded bg-slate-900/60 border border-slate-700/40">
        <div className="flex items-center gap-1.5 mb-1">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Score</span>
        </div>
        <div className="text-lg font-bold font-mono text-emerald-400">
          {task.security_score?.toFixed(0) || "N/A"}
        </div>
      </div>

      <div className="p-2.5 rounded bg-slate-900/60 border border-slate-700/40">
        <div className="flex items-center gap-1.5 mb-1">
          <Bug className="w-3 h-3 text-rose-400" />
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Findings</span>
        </div>
        <div className="text-lg font-bold font-mono text-white">
          {findings.length}
        </div>
      </div>

      <div className="p-2.5 rounded bg-slate-900/60 border border-slate-700/40">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle className="w-3 h-3 text-orange-400" />
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Critical</span>
        </div>
        <div className="text-lg font-bold font-mono text-rose-400">
          {severityCounts.critical + severityCounts.high}
        </div>
      </div>

      <div className="p-2.5 rounded bg-slate-900/60 border border-slate-700/40">
        <div className="flex items-center gap-1.5 mb-1">
          <CheckCircle2 className="w-3 h-3 text-teal-400" />
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Verified</span>
        </div>
        <div className="text-lg font-bold font-mono text-teal-400">
          {findings.filter(f => f.is_verified).length}
        </div>
      </div>
    </div>
  );
});

// Markdown preview renderer
const MarkdownPreview = memo(function MarkdownPreview({
  content,
}: {
  content: string;
}) {
  // Simple markdown to styled elements renderer
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];
    let codeLanguage = "";

    lines.forEach((line, index) => {
      // Code block handling
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <div key={`code-${index}`} className="my-3 rounded bg-black/50 border border-slate-700/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/50">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                  {codeLanguage || "code"}
                </span>
              </div>
              <pre className="p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                {codeContent.join("\n")}
              </pre>
            </div>
          );
          codeContent = [];
          codeLanguage = "";
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim();
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Headers
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={index} className="text-xl font-bold text-white mt-6 mb-3 pb-2 border-b border-slate-700/50">
            {line.slice(2)}
          </h1>
        );
        return;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={index} className="text-lg font-bold text-white mt-5 mb-2">
            {line.slice(3)}
          </h2>
        );
        return;
      }
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={index} className="text-base font-semibold text-slate-200 mt-4 mb-2">
            {line.slice(4)}
          </h3>
        );
        return;
      }

      // Horizontal rule
      if (line.match(/^---+$/)) {
        elements.push(
          <hr key={index} className="my-4 border-slate-700/50" />
        );
        return;
      }

      // List items
      if (line.match(/^[-*]\s/)) {
        elements.push(
          <div key={index} className="flex gap-2 text-sm text-slate-300 ml-2 my-0.5">
            <span className="text-primary">•</span>
            <span>{line.slice(2)}</span>
          </div>
        );
        return;
      }

      // Bold text handling
      let processedLine = line;
      if (line.includes("**")) {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        const lineElements = parts.map((part, i) => {
          if (i % 2 === 1) {
            return <strong key={i} className="text-white font-semibold">{part}</strong>;
          }
          return part;
        });
        elements.push(
          <p key={index} className="text-sm text-slate-300 my-1">
            {lineElements}
          </p>
        );
        return;
      }

      // Empty lines
      if (line.trim() === "") {
        elements.push(<div key={index} className="h-2" />);
        return;
      }

      // Regular paragraphs
      elements.push(
        <p key={index} className="text-sm text-slate-300 my-1">
          {processedLine}
        </p>
      );
    });

    return elements;
  };

  return (
    <div className="prose prose-invert max-w-none">
      {renderMarkdown(content)}
    </div>
  );
});

// JSON preview with syntax highlighting
const JsonPreview = memo(function JsonPreview({
  content,
}: {
  content: string;
}) {
  const highlightJson = (json: string) => {
    try {
      const parsed = JSON.parse(json);
      const formatted = JSON.stringify(parsed, null, 2);

      return formatted
        .replace(/"([^"]+)":/g, '<span class="text-violet-400">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span class="text-emerald-400">"$1"</span>')
        .replace(/: (\d+)/g, ': <span class="text-amber-400">$1</span>')
        .replace(/: (true|false)/g, ': <span class="text-sky-400">$1</span>')
        .replace(/: (null)/g, ': <span class="text-slate-500">$1</span>');
    } catch {
      return json;
    }
  };

  return (
    <pre
      className="text-xs font-mono text-slate-300 whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: highlightJson(content) }}
    />
  );
});

// ============ Main Component ============

export const ReportExportDialog = memo(function ReportExportDialog({
  open,
  onOpenChange,
  task,
  findings,
}: ReportExportDialogProps) {
  const [activeFormat, setActiveFormat] = useState<ReportFormat>("markdown");
  const [preview, setPreview] = useState<ReportPreview>({
    content: "",
    format: "markdown",
    loading: false,
    error: null,
  });
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch report content for preview
  const fetchPreview = useCallback(async (format: ReportFormat) => {
    if (!task) return;

    setPreview(prev => ({ ...prev, loading: true, error: null }));

    try {
      // For JSON, we can generate it client-side
      if (format === "json") {
        const reportData = {
          report_metadata: {
            task_id: task.id,
            project_id: task.project_id,
            generated_at: new Date().toISOString(),
            task_status: task.status,
            duration_seconds: task.completed_at && task.started_at
              ? Math.round((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000)
              : null,
          },
          summary: {
            security_score: task.security_score,
            total_files_analyzed: task.analyzed_files,
            total_findings: findings.length,
            verified_findings: findings.filter(f => f.is_verified).length,
            severity_distribution: {
              critical: task.critical_count,
              high: task.high_count,
              medium: task.medium_count,
              low: task.low_count,
            },
          },
          findings: findings.map(f => ({
            id: f.id,
            vulnerability_type: f.vulnerability_type,
            severity: f.severity,
            title: f.title,
            description: f.description,
            file_path: f.file_path,
            line_start: f.line_start,
            line_end: f.line_end,
            code_snippet: f.code_snippet,
            is_verified: f.is_verified,
            has_poc: f.has_poc,
            suggestion: f.suggestion,
            ai_confidence: f.ai_confidence,
          })),
        };

        setPreview({
          content: JSON.stringify(reportData, null, 2),
          format: "json",
          loading: false,
          error: null,
        });
        return;
      }

      // For HTML, generate from markdown
      if (format === "html") {
        const mdResponse = await apiClient.get(`/agent-tasks/${task.id}/report`, {
          params: { format: "markdown" },
          responseType: "text",
        });

        const htmlContent = generateHtmlReport(mdResponse.data, task);
        setPreview({
          content: htmlContent,
          format: "html",
          loading: false,
          error: null,
        });
        return;
      }

      // For Markdown, fetch from server
      const response = await apiClient.get(`/agent-tasks/${task.id}/report`, {
        params: { format: "markdown" },
        responseType: "text",
      });

      setPreview({
        content: response.data,
        format: "markdown",
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Failed to fetch report preview:", err);
      setPreview(prev => ({
        ...prev,
        loading: false,
        error: "Failed to load report preview",
      }));
    }
  }, [task, findings]);

  // Generate HTML report from markdown
  const generateHtmlReport = (markdown: string, task: AgentTask): string => {
    // Convert markdown to HTML with styling
    let html = markdown
      .replace(/^# (.+)$/gm, '<h1 class="report-h1">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="report-h2">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 class="report-h3">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="report-code">$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr class="report-hr">')
      .replace(/\n\n/g, '</p><p class="report-p">');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Audit Report - ${task.name || task.id}</title>
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #0d0d12;
      --text-primary: #ffffff;
      --text-secondary: #94a3b8;
      --accent: #FF6B2C;
      --success: #34d399;
      --warning: #fbbf24;
      --error: #fb7185;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-secondary);
      line-height: 1.6;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }
    .report-h1 {
      color: var(--text-primary);
      font-size: 1.75rem;
      margin: 2rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .report-h2 {
      color: var(--text-primary);
      font-size: 1.25rem;
      margin: 1.5rem 0 0.75rem;
    }
    .report-h3 {
      color: var(--accent);
      font-size: 1rem;
      margin: 1rem 0 0.5rem;
    }
    .report-p { margin: 0.75rem 0; }
    .report-code {
      background: var(--bg-secondary);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.875em;
    }
    .report-hr {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin: 1.5rem 0;
    }
    li {
      margin: 0.25rem 0;
      margin-left: 1.5rem;
    }
    pre {
      background: var(--bg-secondary);
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      font-size: 0.875rem;
    }
    .header {
      text-align: center;
      padding: 2rem;
      background: var(--bg-secondary);
      border-radius: 0.75rem;
      margin-bottom: 2rem;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .header h1 {
      color: var(--text-primary);
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .header .subtitle {
      color: var(--accent);
      font-size: 0.875rem;
    }
    .severity-critical { color: #fb7185; }
    .severity-high { color: #fb923c; }
    .severity-medium { color: #fbbf24; }
    .severity-low { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="header">
    <h1>DEEPAUDIT Security Report</h1>
    <p class="subtitle">Generated ${new Date().toLocaleString()}</p>
  </div>
  <main>
    <p class="report-p">${html}</p>
  </main>
</body>
</html>`;
  };

  // Load preview when format changes or dialog opens
  useEffect(() => {
    if (open && task) {
      fetchPreview(activeFormat);
    }
  }, [open, activeFormat, task, fetchPreview]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!task) return;

    setDownloading(true);
    try {
      if (activeFormat === "markdown" || activeFormat === "json") {
        await downloadAgentReport(task.id, activeFormat);
      } else {
        // HTML download
        const blob = new Blob([preview.content], { type: "text/html" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-report-${task.id.slice(0, 8)}.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] bg-[#0a0a0f] border-slate-700/50 p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/50 bg-gradient-to-r from-[#0d0d12] to-[#0a0a0f]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-primary/10 border border-primary/30">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white">
                  Export Audit Report
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Task: {task.name || task.id.slice(0, 8)}
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Stats Summary */}
        <div className="px-5 py-3 border-b border-slate-700/40 bg-[#0b0b10]">
          <ReportStats task={task} findings={findings} />
        </div>

        {/* Format Tabs & Content */}
        <Tabs
          value={activeFormat}
          onValueChange={(v) => setActiveFormat(v as ReportFormat)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Tab List */}
          <div className="px-5 py-2 border-b border-slate-700/40 bg-[#0d0d12]">
            <div className="flex items-center justify-between">
              <TabsList className="bg-slate-800/50 p-1 h-9">
                {(Object.keys(FORMAT_CONFIG) as ReportFormat[]).map((format) => {
                  const config = FORMAT_CONFIG[format];
                  return (
                    <TabsTrigger
                      key={format}
                      value={format}
                      className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        {config.icon}
                        {config.label}
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={preview.loading || !preview.content}
                  className="h-8 px-2.5 text-xs text-slate-400 hover:text-white"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchPreview(activeFormat)}
                  disabled={preview.loading}
                  className="h-8 px-2.5 text-xs text-slate-400 hover:text-white"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${preview.loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 overflow-hidden">
            {(Object.keys(FORMAT_CONFIG) as ReportFormat[]).map((format) => (
              <TabsContent
                key={format}
                value={format}
                className="h-full m-0 data-[state=inactive]:hidden"
              >
                <ScrollArea className="h-full">
                  <div className="p-5">
                    {preview.loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-sm text-slate-500">Loading preview...</span>
                        </div>
                      </div>
                    ) : preview.error ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <AlertTriangle className="w-8 h-8 text-amber-400" />
                          <span className="text-sm text-slate-400">{preview.error}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchPreview(activeFormat)}
                            className="mt-2"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Retry
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#0d0d12] rounded-lg border border-slate-700/40 overflow-hidden">
                        {/* Preview header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/30 border-b border-slate-700/40">
                          <div className="flex items-center gap-2">
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                              Preview
                            </span>
                          </div>
                          <Badge className="text-[9px] bg-slate-700/50 text-slate-400 border-0">
                            {formatBytes(preview.content.length)}
                          </Badge>
                        </div>

                        {/* Preview content */}
                        <div className="p-4 max-h-[45vh] overflow-y-auto custom-scrollbar">
                          {format === "markdown" && <MarkdownPreview content={preview.content} />}
                          {format === "json" && <JsonPreview content={preview.content} />}
                          {format === "html" && (
                            <div className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
                              {preview.content.slice(0, 3000)}
                              {preview.content.length > 3000 && (
                                <span className="text-slate-600">... (truncated for preview)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </div>
        </Tabs>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700/50 bg-[#0d0d12]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Terminal className="w-3.5 h-3.5" />
              <span className="font-mono">
                Export as {FORMAT_CONFIG[activeFormat].label} ({FORMAT_CONFIG[activeFormat].extension})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-9 px-4 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </Button>

              <Button
                onClick={handleDownload}
                disabled={downloading || preview.loading || !preview.content}
                className="h-9 px-5 bg-primary hover:bg-primary/90 text-sm font-medium"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download {FORMAT_CONFIG[activeFormat].label}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

export default ReportExportDialog;
