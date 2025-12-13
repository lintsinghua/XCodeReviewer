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

    const formats = [
        {
            value: "json" as ExportFormat,
            label: "JSON 格式",
            description: "结构化数据，适合程序处理和集成",
            icon: FileJson,
            color: "text-amber-400",
            bgColor: "bg-amber-500/20",
            borderColor: "border-amber-500/30"
        },
        {
            value: "pdf" as ExportFormat,
            label: "PDF 格式",
            description: "专业报告，适合打印和分享",
            icon: FileText,
            color: "text-rose-400",
            bgColor: "bg-rose-500/20",
            borderColor: "border-rose-500/30"
        }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] cyber-card p-0 bg-[#0c0c12]">
                <DialogHeader className="cyber-card-header">
                    <div className="flex items-center gap-3">
                        <Download className="w-5 h-5 text-primary" />
                        <DialogTitle className="text-lg font-bold uppercase tracking-wider text-white">
                            导出审计报告
                        </DialogTitle>
                    </div>
                </DialogHeader>
                <DialogDescription className="px-6 pt-4 text-gray-400 font-mono text-xs">
                    选择报告格式并导出完整的代码审计结果
                </DialogDescription>

                <div className="p-6">
                    <RadioGroup
                        value={selectedFormat}
                        onValueChange={(value) => setSelectedFormat(value as ExportFormat)}
                        className="space-y-4"
                    >
                        {formats.map((format) => {
                            const Icon = format.icon;
                            const isSelected = selectedFormat === format.value;

                            return (
                                <div key={format.value} className="relative">
                                    <RadioGroupItem
                                        value={format.value}
                                        id={format.value}
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor={format.value}
                                        className={`flex items-start space-x-4 p-4 border cursor-pointer transition-all rounded font-mono ${isSelected
                                            ? "border-primary bg-primary/10"
                                            : "border-gray-700 bg-gray-900/30 hover:bg-gray-800/50 hover:border-gray-600"
                                            }`}
                                    >
                                        <div
                                            className={`w-12 h-12 flex items-center justify-center rounded ${isSelected ? "bg-primary/20 border border-primary/50" : format.bgColor + " border " + format.borderColor
                                                }`}
                                        >
                                            <Icon className={`w-6 h-6 ${isSelected ? "text-primary" : format.color}`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className={`font-bold uppercase ${isSelected ? "text-primary" : "text-gray-200"}`}>
                                                    {format.label}
                                                </h4>
                                                {isSelected && (
                                                    <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_rgba(255,107,44,0.5)]" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500">{format.description}</p>
                                        </div>
                                    </Label>
                                </div>
                            );
                        })}
                    </RadioGroup>

                    {/* 报告预览信息 */}
                    <div className="mt-6 cyber-card p-0">
                        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex items-center gap-2">
                            <Terminal className="w-3 h-3 text-primary" />
                            <h4 className="font-bold text-gray-300 uppercase text-xs">报告内容预览</h4>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3 text-xs font-mono">
                            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-600">项目名称:</span>
                                <span className="font-bold text-white">{task.project?.name || "未知"}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-600">质量评分:</span>
                                <span className="font-bold text-emerald-400">{task.quality_score.toFixed(1)}/100</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-600">扫描文件:</span>
                                <span className="font-bold text-white">{task.scanned_files}/{task.total_files}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-600">发现问题:</span>
                                <span className="font-bold text-amber-400">{issues.length}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-600">代码行数:</span>
                                <span className="font-bold text-white">{task.total_lines.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                                <span className="text-gray-600">严重问题:</span>
                                <span className="font-bold text-rose-400">
                                    {issues.filter(i => i.severity === "critical").length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isExporting}
                        className="cyber-btn-outline h-10"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="cyber-btn-primary h-10 font-bold uppercase"
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
