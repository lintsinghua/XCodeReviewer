/**
 * Instant Export Dialog
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
import { FileJson, FileText, Download, Loader2, Terminal, AlertTriangle } from "lucide-react";
import type { CodeAnalysisResult } from "@/shared/types";
import { exportInstantToPDF, exportInstantToJSON } from "@/features/reports/services/reportExport";
import { toast } from "sonner";

interface InstantExportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    analysisId: string | null;  // 数据库中的记录 ID
    analysisResult: CodeAnalysisResult;
    language: string;
    analysisTime: number;
}

type ExportFormat = "json" | "pdf";

export default function InstantExportDialog({
    open,
    onOpenChange,
    analysisId,
    analysisResult,
    language,
    analysisTime
}: InstantExportDialogProps) {
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            switch (selectedFormat) {
                case "json":
                    exportInstantToJSON(analysisResult, language, analysisTime);
                    toast.success("JSON 报告已导出");
                    break;
                case "pdf":
                    if (!analysisId) {
                        toast.error("请先保存分析结果到历史记录");
                        return;
                    }
                    await exportInstantToPDF(analysisId, language);
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

    const isPdfDisabled = !analysisId;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] cyber-dialog border-border">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-lg font-bold uppercase tracking-wider text-foreground">
                        <Download className="w-5 h-5 text-primary" />
                        导出分析报告
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-mono text-xs">
                        选择报告格式并导出代码分析结果
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
                        <div className={`flex items-center space-x-3 p-4 border border-border rounded bg-muted/50 ${isPdfDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted'}`}>
                            <RadioGroupItem value="pdf" id="pdf" disabled={isPdfDisabled} />
                            <Label htmlFor="pdf" className={`flex items-center gap-3 flex-1 ${isPdfDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                <FileText className="w-5 h-5 text-rose-400" />
                                <div>
                                    <div className="font-bold text-foreground">PDF 格式</div>
                                    <div className="text-xs text-muted-foreground">
                                        {isPdfDisabled && <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />}
                                        {isPdfDisabled ? "需要先保存到历史记录" : "专业报告，适合打印和分享"}
                                    </div>
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
                                <span className="text-muted-foreground">编程语言:</span>
                                <span className="font-bold text-sky-400">{language.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">质量评分:</span>
                                <span className="font-bold text-emerald-400">{(analysisResult.quality_score ?? 0).toFixed(1)}/100</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">发现问题:</span>
                                <span className="font-bold text-amber-400">{analysisResult.issues?.length ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <span className="text-muted-foreground">分析耗时:</span>
                                <span className="font-bold text-foreground">{(analysisTime ?? 0).toFixed(2)}s</span>
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
                        disabled={isExporting || (selectedFormat === "pdf" && !analysisId)}
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
