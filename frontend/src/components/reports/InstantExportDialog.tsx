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
import { FileJson, FileText, Download, Loader2 } from "lucide-react";
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

    const formats = [
        {
            value: "json" as ExportFormat,
            label: "JSON 格式",
            description: "结构化数据，适合程序处理和集成",
            icon: FileJson,
            disabled: false
        },
        {
            value: "pdf" as ExportFormat,
            label: "PDF 格式",
            description: analysisId ? "专业报告，适合打印和分享" : "需要先保存到历史记录",
            icon: FileText,
            disabled: !analysisId
        }
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white border-2 border-black p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
                <DialogHeader className="p-6 border-b-2 border-black bg-gray-50">
                    <DialogTitle className="flex items-center space-x-2 font-display font-bold uppercase text-xl">
                        <Download className="w-6 h-6 text-black" />
                        <span>导出分析报告</span>
                    </DialogTitle>
                    <DialogDescription className="font-mono text-xs text-gray-500 mt-2">
                        选择报告格式并导出代码分析结果
                    </DialogDescription>
                </DialogHeader>

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
                                        disabled={format.disabled}
                                    />
                                    <Label
                                        htmlFor={format.value}
                                        className={`flex items-start space-x-4 p-4 border-2 cursor-pointer transition-all rounded-none font-mono ${
                                            format.disabled 
                                                ? "border-gray-300 bg-gray-100 cursor-not-allowed opacity-60"
                                                : isSelected
                                                    ? "border-black bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]"
                                                    : "border-black bg-white hover:bg-gray-50 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        }`}
                                    >
                                        <div
                                            className={`w-12 h-12 border-2 border-black flex items-center justify-center rounded-none ${
                                                format.disabled
                                                    ? "bg-gray-200 text-gray-400"
                                                    : isSelected 
                                                        ? "bg-black text-white" 
                                                        : "bg-white text-black"
                                            }`}
                                        >
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-bold uppercase text-black">
                                                    {format.label}
                                                </h4>
                                                {isSelected && !format.disabled && (
                                                    <div className="w-4 h-4 bg-black border-2 border-black" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 font-bold">{format.description}</p>
                                        </div>
                                    </Label>
                                </div>
                            );
                        })}
                    </RadioGroup>

                    {/* 报告预览信息 */}
                    <div className="mt-6 p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h4 className="font-bold text-black uppercase mb-3 font-display border-b-2 border-black pb-2 w-fit">报告内容预览</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                                <span className="text-gray-600 font-bold">编程语言:</span>
                                <span className="font-bold text-black">{language.toUpperCase()}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                                <span className="text-gray-600 font-bold">质量评分:</span>
                                <span className="font-bold text-black">{(analysisResult.quality_score ?? 0).toFixed(1)}/100</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                                <span className="text-gray-600 font-bold">发现问题:</span>
                                <span className="font-bold text-orange-600">{analysisResult.issues?.length ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                                <span className="text-gray-600 font-bold">分析耗时:</span>
                                <span className="font-bold text-black">{(analysisTime ?? 0).toFixed(2)}s</span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 border-t-2 border-black bg-gray-50 flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isExporting}
                        className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 font-bold uppercase"
                    >
                        取消
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || (selectedFormat === "pdf" && !analysisId)}
                        className="retro-btn bg-primary text-white border-2 border-black hover:bg-primary/90 rounded-none h-10 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
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
