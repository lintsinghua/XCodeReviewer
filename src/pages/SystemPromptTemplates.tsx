import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	FileText,
	Edit,
	Save,
	X,
	AlertCircle,
	CheckCircle,
} from "lucide-react";
import { api } from "@/shared/services/unified-api";
import { toast } from "sonner";

interface SystemPromptTemplate {
	id: number;
	key: string;
	value: string;
	category: string;
	description: string;
	is_sensitive: boolean;
	created_at: string;
	updated_at: string;
}

export default function SystemPromptTemplates() {
	const [templates, setTemplates] = useState<SystemPromptTemplate[]>([]);
	const [loading, setLoading] = useState(true);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [selectedTemplate, setSelectedTemplate] =
		useState<SystemPromptTemplate | null>(null);
	const [editValue, setEditValue] = useState("");

	useEffect(() => {
		loadTemplates();
	}, []);

	const loadTemplates = async () => {
		try {
			setLoading(true);
			const response = await api.systemSettings.getPromptTemplates();
			setTemplates(response);
		} catch (error) {
			console.error("Failed to load templates:", error);
			toast.error("加载系统提示词模版失败");
		} finally {
			setLoading(false);
		}
	};

	const openEditDialog = (template: SystemPromptTemplate) => {
		setSelectedTemplate(template);
		setEditValue(template.value || "");
		setShowEditDialog(true);
	};

	const handleUpdateTemplate = async () => {
		if (!selectedTemplate) return;

		try {
			await api.systemSettings.updatePromptTemplate(selectedTemplate.key, {
				value: editValue,
			});
			toast.success("系统提示词模版更新成功");
			setShowEditDialog(false);
			setSelectedTemplate(null);
			loadTemplates();
		} catch (error) {
			console.error("Failed to update template:", error);
			toast.error("更新系统提示词模版失败");
		}
	};

	const getTemplateLabel = (key: string): string => {
		const labels: Record<string, string> = {
			"system_prompt.code_review.worker": "系统提示词 - 代码审查工作节点",
			"system_prompt.code_review.manager": "系统提示词 - 代码审查管理节点",
			"system_prompt.instant_analysis.zh": "系统提示词 - 即时分析（中文）",
			"system_prompt.instant_analysis.en": "系统提示词 - 即时分析（英文）",
			"worker_prompt.code_review": "用户提示词 - 代码审查",
		};
		return labels[key] || key;
	};

	const getTemplateIcon = (key: string) => {
		if (key.includes("code_review") || key.includes("worker_prompt")) {
			return <FileText className="w-5 h-5 text-blue-500" />;
		}
		if (key.includes("instant_analysis")) {
			return <AlertCircle className="w-5 h-5 text-purple-500" />;
		}
		return <FileText className="w-5 h-5 text-gray-500" />;
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-gray-900">系统提示词模版</h1>
					<p className="text-gray-600 mt-1">统一管理所有系统提示词模版</p>
				</div>
				<Badge variant="secondary" className="text-sm">
					<CheckCircle className="w-4 h-4 mr-1" />
					{templates.length} 个模版
				</Badge>
			</div>

			{/* Info Card */}
			<Card className="border-blue-200 bg-blue-50">
				<CardContent className="p-4">
					<div className="flex items-start gap-3">
						<AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
						<div className="text-sm text-blue-900">
							<p className="font-semibold mb-2">关于提示词模版</p>
							<div className="space-y-2">
								<p>
									<strong>系统提示词（System Prompt）：</strong>定义 AI
									助手的角色、行为规范和输出格式。在对话开始时发送给 AI。
								</p>
								<p>
									<strong>用户提示词（User Prompt）：</strong>
									包含具体的任务内容和代码，支持占位符动态替换。在每次分析时与代码一起发送。
								</p>
								<p className="text-xs text-blue-700">
									💡 修改后立即生效，无需重启服务
								</p>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Templates List */}
			{loading ? (
				<Card>
					<CardContent className="p-12 text-center">
						<div className="text-gray-500">加载中...</div>
					</CardContent>
				</Card>
			) : templates.length === 0 ? (
				<Card>
					<CardContent className="p-12 text-center">
						<FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
						<p className="text-gray-500">暂无系统提示词模版</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{templates.map((template) => (
						<Card
							key={template.id}
							className="hover:shadow-md transition-shadow"
						>
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<div className="flex items-start gap-3 flex-1">
										{getTemplateIcon(template.key)}
										<div className="flex-1">
											<CardTitle className="text-lg">
												{getTemplateLabel(template.key)}
											</CardTitle>
											<p className="text-sm text-gray-600 mt-1">
												{template.description}
											</p>
											<div className="flex gap-2 mt-2">
												<Badge variant="outline" className="text-xs">
													{template.key}
												</Badge>
											</div>
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => openEditDialog(template)}
										className="ml-2"
									>
										<Edit className="w-4 h-4" />
									</Button>
								</div>
							</CardHeader>
							<CardContent>
								<div className="bg-gray-50 p-3 rounded border border-gray-200 max-h-32 overflow-y-auto">
									<pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
										{template.value?.substring(0, 200)}
										{template.value && template.value.length > 200 && "..."}
									</pre>
								</div>
								<div className="text-xs text-gray-500 mt-2">
									最后更新:{" "}
									{new Date(template.updated_at).toLocaleString("zh-CN")}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Edit Dialog */}
			<Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							编辑系统提示词模版:{" "}
							{selectedTemplate && getTemplateLabel(selectedTemplate.key)}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<label className="text-sm font-medium text-gray-700 block mb-2">
								模版内容
							</label>
							<Textarea
								value={editValue}
								onChange={(e) => setEditValue(e.target.value)}
								placeholder="输入系统提示词模版内容..."
								rows={20}
								className="font-mono text-sm"
							/>
							{selectedTemplate?.key.includes("worker_prompt") ? (
								<div className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded">
									<strong>用户提示词 - 支持的占位符：</strong>
									<ul className="mt-1 ml-4 list-disc">
										<li>
											<code>{"{code_to_review}"}</code> - 要审查的代码内容
										</li>
										<li>
											<code>{"{context_section}"}</code> -
											上下文信息（可选，自动生成）
										</li>
										<li>
											<code>{"{category}"}</code> - 扫描类别（如 SECURITY,
											PERFORMANCE 等）
										</li>
									</ul>
								</div>
							) : (
								<div className="text-xs text-green-600 mt-2 bg-green-50 p-2 rounded">
									<strong>系统提示词 - 支持的占位符：</strong>
									<ul className="mt-1 ml-4 list-disc">
										<li>
											<code>{"{category}"}</code> - 扫描类别（如 SECURITY,
											PERFORMANCE 等）
										</li>
										<li>
											<code>{"{subcategories}"}</code> - 子类别描述（来自 Prompt
											的 description 字段）
										</li>
									</ul>
									<p className="mt-2 text-xs">
										用于定义 AI 助手的角色、行为规范和输出格式
									</p>
								</div>
							)}
						</div>
						{selectedTemplate && (
							<div className="bg-gray-50 p-3 rounded border border-gray-200">
								<p className="text-xs text-gray-600 mb-1">
									<strong>模版 Key:</strong> {selectedTemplate.key}
								</p>
								<p className="text-xs text-gray-600">
									<strong>说明:</strong> {selectedTemplate.description}
								</p>
							</div>
						)}
					</div>
					<div className="flex justify-end gap-2 mt-4">
						<Button
							variant="outline"
							onClick={() => {
								setShowEditDialog(false);
								setSelectedTemplate(null);
							}}
						>
							<X className="w-4 h-4 mr-2" />
							取消
						</Button>
						<Button onClick={handleUpdateTemplate}>
							<Save className="w-4 h-4 mr-2" />
							保存
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
