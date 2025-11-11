import { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
	Plus,
	Edit,
	Trash2,
	Save,
	X,
	CheckCircle2,
	XCircle,
	Key,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/shared/services/api/client";
import { ApiKeyDialog } from "./ApiKeyDialog";

interface LLMProvider {
	id: number;
	name: string;
	display_name: string;
	description?: string;
	icon?: string;
	provider_type: string;
	api_endpoint?: string;
	default_model?: string;
	supported_models?: string[];
	requires_api_key: boolean;
	supports_streaming: boolean;
	max_tokens_limit?: number;
	category: string;
	is_active: boolean;
	is_builtin: boolean;
	created_at: string;
	updated_at: string;
}

interface ProviderFormData {
	name: string;
	display_name: string;
	description: string;
	icon: string;
	provider_type: string;
	api_endpoint: string;
	default_model: string;
	supported_models: string;
	requires_api_key: boolean;
	supports_streaming: boolean;
	max_tokens_limit: string;
	category: string;
	is_active: boolean;
}

const CATEGORIES = [
	{ value: "international", label: "国际平台" },
	{ value: "domestic", label: "国内平台" },
	{ value: "local", label: "本地部署" },
];

export function LLMProviderManager() {
	const [providers, setProviders] = useState<LLMProvider[]>([]);
	const [loading, setLoading] = useState(true);
	const [showDialog, setShowDialog] = useState(false);
	const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(
		null,
	);
	const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
	const [selectedProviderForKey, setSelectedProviderForKey] = useState<{
		id: number;
		name: string;
	} | null>(null);
	const [formData, setFormData] = useState<ProviderFormData>({
		name: "",
		display_name: "",
		description: "",
		icon: "",
		provider_type: "",
		api_endpoint: "",
		default_model: "",
		supported_models: "",
		requires_api_key: true,
		supports_streaming: true,
		max_tokens_limit: "",
		category: "international",
		is_active: true,
	});

	useEffect(() => {
		loadProviders();
	}, []);

	const loadProviders = async () => {
		try {
			setLoading(true);
			const response = await apiClient.get("/llm-providers?page_size=100");
			setProviders(response.items || []);
		} catch (error) {
			console.error("Failed to load providers:", error);
			toast.error("加载 LLM 提供商失败");
		} finally {
			setLoading(false);
		}
	};

	const handleCreate = () => {
		setEditingProvider(null);
		setFormData({
			name: "",
			display_name: "",
			description: "",
			icon: "",
			provider_type: "",
			api_endpoint: "",
			default_model: "",
			supported_models: "",
			requires_api_key: true,
			supports_streaming: true,
			max_tokens_limit: "",
			category: "international",
			is_active: true,
		});
		setShowDialog(true);
	};

	const handleEdit = (provider: LLMProvider) => {
		setEditingProvider(provider);
		setFormData({
			name: provider.name,
			display_name: provider.display_name,
			description: provider.description || "",
			icon: provider.icon || "",
			provider_type: provider.provider_type,
			api_endpoint: provider.api_endpoint || "",
			default_model: provider.default_model || "",
			supported_models: provider.supported_models?.join(", ") || "",
			requires_api_key: provider.requires_api_key,
			supports_streaming: provider.supports_streaming,
			max_tokens_limit: provider.max_tokens_limit?.toString() || "",
			category: provider.category,
			is_active: provider.is_active,
		});
		setShowDialog(true);
	};

	const handleSave = async () => {
		try {
			const data: any = {
				...formData,
				supported_models: formData.supported_models
					.split(",")
					.map((m) => m.trim())
					.filter((m) => m),
				max_tokens_limit: formData.max_tokens_limit
					? parseInt(formData.max_tokens_limit)
					: undefined,
			};

			if (editingProvider) {
				await apiClient.put(`/llm-providers/${editingProvider.id}`, data);
				toast.success("更新成功");
			} else {
				await apiClient.post("/llm-providers", data);
				toast.success("创建成功");
			}

			setShowDialog(false);
			loadProviders();
		} catch (error: any) {
			console.error("Failed to save provider:", error);
			toast.error(error?.message || error?.detail || "保存失败");
		}
	};

	const handleDelete = async (provider: LLMProvider) => {
		if (provider.is_builtin) {
			toast.error("内置提供商不能删除");
			return;
		}

		if (!confirm(`确定要删除 ${provider.display_name} 吗？`)) {
			return;
		}

		try {
			await apiClient.delete(`/llm-providers/${provider.id}`);
			toast.success("删除成功");
			loadProviders();
		} catch (error) {
			console.error("Failed to delete provider:", error);
			toast.error("删除失败");
		}
	};

	const getCategoryBadge = (category: string) => {
		const map: Record<string, { label: string; variant: any }> = {
			international: { label: "国际", variant: "default" },
			domestic: { label: "国内", variant: "secondary" },
			local: { label: "本地", variant: "outline" },
		};
		const config = map[category] || map.international;
		return <Badge variant={config.variant}>{config.label}</Badge>;
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-lg font-semibold">LLM 提供商管理</h3>
					<p className="text-sm text-muted-foreground">
						管理可用的大语言模型提供商
					</p>
				</div>
				<Button onClick={handleCreate}>
					<Plus className="w-4 h-4 mr-2" />
					添加提供商
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{providers.map((provider) => (
					<Card key={provider.id} className="relative">
						<CardHeader className="pb-3">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2">
									{provider.icon && (
										<span className="text-2xl">{provider.icon}</span>
									)}
									<div>
										<CardTitle className="text-base">
											{provider.display_name}
										</CardTitle>
										<p className="text-xs text-muted-foreground mt-1">
											{provider.name}
										</p>
									</div>
								</div>
								<div className="flex gap-1">
									{provider.is_active ? (
										<CheckCircle2 className="w-4 h-4 text-green-600" />
									) : (
										<XCircle className="w-4 h-4 text-gray-400" />
									)}
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="text-sm text-muted-foreground">
								{provider.description || "无描述"}
							</div>

							<div className="flex flex-wrap gap-2">
								{getCategoryBadge(provider.category)}
								{provider.is_builtin && <Badge variant="outline">内置</Badge>}
								{provider.requires_api_key && (
									<Badge variant="outline" className="text-xs">
										需要API Key
									</Badge>
								)}
							</div>

							{provider.default_model && (
								<div className="text-xs text-muted-foreground">
									默认模型: {provider.default_model}
								</div>
							)}

							<div className="flex flex-col gap-2 pt-2">
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										className="flex-1"
										onClick={() => handleEdit(provider)}
									>
										<Edit className="w-3 h-3 mr-1" />
										编辑
									</Button>
									{!provider.is_builtin && (
										<Button
											variant="outline"
											size="sm"
											className="text-red-600 hover:text-red-700"
											onClick={() => handleDelete(provider)}
										>
											<Trash2 className="w-3 h-3" />
										</Button>
									)}
								</div>
								{provider.requires_api_key && (
									<Button
										variant="secondary"
										size="sm"
										className="w-full"
										onClick={() => {
											setSelectedProviderForKey({
												id: provider.id,
												name: provider.display_name,
											});
											setShowApiKeyDialog(true);
										}}
									>
										<Key className="w-3 h-3 mr-1" />
										配置 API Key
									</Button>
								)}
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* 创建/编辑对话框 */}
			<Dialog open={showDialog} onOpenChange={setShowDialog}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingProvider ? "编辑提供商" : "添加提供商"}
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="name">标识名称 *</Label>
								<Input
									id="name"
									value={formData.name}
									onChange={(e) =>
										setFormData({ ...formData, name: e.target.value })
									}
									placeholder="例如: custom-gpt"
									disabled={!!editingProvider}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="display_name">显示名称 *</Label>
								<Input
									id="display_name"
									value={formData.display_name}
									onChange={(e) =>
										setFormData({ ...formData, display_name: e.target.value })
									}
									placeholder="例如: 自定义 GPT"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">描述</Label>
							<Textarea
								id="description"
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								placeholder="提供商描述"
								rows={2}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="icon">图标 Emoji</Label>
								<Input
									id="icon"
									value={formData.icon}
									onChange={(e) =>
										setFormData({ ...formData, icon: e.target.value })
									}
									placeholder="🤖"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="category">分类</Label>
								<Select
									value={formData.category}
									onValueChange={(value) =>
										setFormData({ ...formData, category: value })
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CATEGORIES.map((cat) => (
											<SelectItem key={cat.value} value={cat.value}>
												{cat.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="provider_type">提供商类型 *</Label>
								<Input
									id="provider_type"
									value={formData.provider_type}
									onChange={(e) =>
										setFormData({ ...formData, provider_type: e.target.value })
									}
									placeholder="例如: openai"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="api_endpoint">API 端点</Label>
								<Input
									id="api_endpoint"
									value={formData.api_endpoint}
									onChange={(e) =>
										setFormData({ ...formData, api_endpoint: e.target.value })
									}
									placeholder="https://api.example.com/v1"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="default_model">默认模型</Label>
								<Input
									id="default_model"
									value={formData.default_model}
									onChange={(e) =>
										setFormData({ ...formData, default_model: e.target.value })
									}
									placeholder="gpt-4"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="max_tokens_limit">最大 Tokens</Label>
								<Input
									id="max_tokens_limit"
									type="number"
									value={formData.max_tokens_limit}
									onChange={(e) =>
										setFormData({
											...formData,
											max_tokens_limit: e.target.value,
										})
									}
									placeholder="8192"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="supported_models">支持的模型（逗号分隔）</Label>
							<Input
								id="supported_models"
								value={formData.supported_models}
								onChange={(e) =>
									setFormData({ ...formData, supported_models: e.target.value })
								}
								placeholder="gpt-4, gpt-3.5-turbo"
							/>
						</div>

						<div className="flex gap-6">
							<div className="flex items-center space-x-2">
								<Switch
									id="requires_api_key"
									checked={formData.requires_api_key}
									onCheckedChange={(checked) =>
										setFormData({ ...formData, requires_api_key: checked })
									}
								/>
								<Label htmlFor="requires_api_key">需要 API Key</Label>
							</div>

							<div className="flex items-center space-x-2">
								<Switch
									id="supports_streaming"
									checked={formData.supports_streaming}
									onCheckedChange={(checked) =>
										setFormData({ ...formData, supports_streaming: checked })
									}
								/>
								<Label htmlFor="supports_streaming">支持流式输出</Label>
							</div>

							<div className="flex items-center space-x-2">
								<Switch
									id="is_active"
									checked={formData.is_active}
									onCheckedChange={(checked) =>
										setFormData({ ...formData, is_active: checked })
									}
								/>
								<Label htmlFor="is_active">启用</Label>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowDialog(false)}>
							<X className="w-4 h-4 mr-2" />
							取消
						</Button>
						<Button onClick={handleSave}>
							<Save className="w-4 h-4 mr-2" />
							保存
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* API Key 配置对话框 */}
			<ApiKeyDialog
				providerId={selectedProviderForKey?.id || null}
				providerName={selectedProviderForKey?.name || ""}
				open={showApiKeyDialog}
				onOpenChange={setShowApiKeyDialog}
			/>
		</div>
	);
}
