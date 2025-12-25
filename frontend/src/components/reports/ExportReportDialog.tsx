/**
 * Export Report Dialog
 * Cyberpunk Terminal Aesthetic
 */

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileJson, FileText, Download, Loader2, Terminal } from "lucide-react";
import type { AuditTask, AuditIssue } from "@/shared/types";
import { exportToJSON, exportToPDF } from "@/features/reports/services/reportExport";
import { toast } from "sonner";

interface ExportReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task: AuditTask;
    issues: AuditIssue[];
}

type ExportFormat = "json" | "pdf";

export default function ExportReportDialog({
    open,
    onOpenChange,
    task,
    issues
}: ExportReportDialogProps) {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            switch (selectedFormat) {
                case "json":
                    await exportToJSON(task, issues);
                    toast.success("JSON 报告已导出");
                    break;
                case "pdf":
                    await exportToPDF(task, issues);
                    toast.success("PDF 报告已导出");
                    break;
            }
            onOpenChange(false);
        } catch (error) {
            console.error("导出报告失败:", error);
            toast.error("导出报告失败，请重试");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] cyber-dialog border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-lg font-bold uppercase tracking-wider text-foreground">
                        <Download className="w-5 h-5 text-primary" />
                        导出审计报告
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-mono text-xs">
                        选择报告格式并导出完整的代码审计结果
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup
                        value={selectedFormat}
                        onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
                        className="space-y-4"
                    >
                        <div className="flex items-center space-x-3 p-4 border border-border rounded bg-muted/50 cursor-pointer hover:bg-muted">
                            <RadioGroupItem value="json" id="json" />
                            <Label htmlFor="json" className="flex items-center gap-3 cursor-pointer flex-1">
                                <FileJson className="w-5 h-5 text-amber-400" />
                                <div>
                                    <div className="font-bold text-foreground">JSON 格式</div>
                                    <div className="text-xs text-muted-foreground">结构化数据，适合程序处理和集成</div>
                                </div>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-4 border border-border rounded bg-muted/50 cursor-pointer hover:bg-muted">
                            <RadioGroupItem value="pdf" id="pdf" />
                            <Label htmlFor="pdf" className="flex items-center gap-3 cursor-pointer flex-1">
                                <FileText className="w-5 h-5 text-rose-400" />
                                <div>
                                    <div className="font-bold text-foreground">PDF 格式</div>
                                    <div className="text-xs text-muted-foreground">专业报告，适合打印和分享</div>
                                </div>
                            </Label>
                        </div>
                    </RadioGroup>

                    {/* 报告预览信息 */}
                    <div className="mt-6 border border-border rounded bg-muted/50">
                        <div className="px-4 py-2 border-b border-border bg-muted flex items-center gap-2">
                            <Terminal className="w-3 h-3 text-primary" />
                            <h4 className="font-bold text-foreground uppercase text-xs">报告内容预览</h4>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3 text-xs font-mono">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">项目名称:</span>
                                <span className="font-bold text-foreground">{task.project?.name || "未知"}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">质量评分:</span>
                                <span className="font-bold text-emerald-400">{task.quality_score.toFixed(1)}/100</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">扫描文件:</span>
                                <span className="font-bold text-foreground">{task.scanned_files}/{task.total_files}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">发现问题:</span>
                                <span className="font-bold text-amber-400">{issues.length}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">代码行数:</span>
                                <span className="font-bold text-foreground">{task.total_lines.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">严重问题:</span>
                                <span className="font-bold text-rose-400">
                                    {issues.filter(i => i.severity === "critical").length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="border-t border-border pt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isExporting}
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                导出中...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                导出报告
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
