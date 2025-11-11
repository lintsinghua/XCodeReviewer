import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileJson, FileText, Download, Loader2 } from "lucide-react";
import type { AuditTask, AuditIssue } from "@/shared/types";
import {
	exportToJSON,
	exportToPDF,
} from "@/features/reports/services/reportExport";
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
	issues,
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
			color: "text-yellow-600",
			bgColor: "bg-yellow-50",
			borderColor: "border-yellow-200",
		},
		{
			value: "pdf" as ExportFormat,
			label: "PDF 格式",
			description: "专业报告，适合打印和分享",
			icon: FileText,
			color: "text-red-600",
			bgColor: "bg-red-50",
			borderColor: "border-red-200",
		},
	];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle className="flex items-center space-x-2">
						<Download className="w-5 h-5 text-primary" />
						<span>导出审计报告</span>
					</DialogTitle>
					<DialogDescription>
						选择报告格式并导出完整的代码审计结果
					</DialogDescription>
				</DialogHeader>

				<div className="py-6">
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
										className={`flex items-start space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
											isSelected
												? `${format.borderColor} ${format.bgColor} shadow-md`
												: "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
										}`}
									>
										<div
											className={`w-12 h-12 rounded-lg flex items-center justify-center ${
												isSelected ? format.bgColor : "bg-gray-50"
											}`}
										>
											<Icon
												className={`w-6 h-6 ${isSelected ? format.color : "text-gray-400"}`}
											/>
										</div>
										<div className="flex-1">
											<div className="flex items-center justify-between mb-1">
												<h4
													className={`font-semibold ${isSelected ? format.color : "text-gray-900"}`}
												>
													{format.label}
												</h4>
												{isSelected && (
													<div
														className={`w-5 h-5 rounded-full ${format.bgColor} flex items-center justify-center`}
													>
														<div
															className={`w-2.5 h-2.5 rounded-full ${format.color.replace("text-", "bg-")}`}
														/>
													</div>
												)}
											</div>
											<p className="text-sm text-gray-600">
												{format.description}
											</p>
										</div>
									</Label>
								</div>
							);
						})}
					</RadioGroup>

					{/* 报告预览信息 */}
					<div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
						<h4 className="font-medium text-gray-900 mb-3">报告内容预览</h4>
						<div className="grid grid-cols-2 gap-3 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-gray-600">项目名称:</span>
								<span className="font-medium text-gray-900">
									{task.project?.name || "未知"}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-gray-600">质量评分:</span>
								<span className="font-medium text-gray-900">
									{(task.quality_score || 0).toFixed(1)}/100
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-gray-600">扫描文件:</span>
								<span className="font-medium text-gray-900">
									{task.scanned_files || 0}/{task.total_files || 0}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-gray-600">发现问题:</span>
								<span className="font-medium text-orange-600">
									{issues.length}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-gray-600">代码行数:</span>
								<span className="font-medium text-gray-900">
									{(task.total_lines || 0).toLocaleString()}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-gray-600">严重问题:</span>
								<span className="font-medium text-red-600">
									{issues.filter((i) => i.severity === "critical").length}
								</span>
							</div>
						</div>
					</div>
				</div>

				<DialogFooter>
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
						className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
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
