/**
 * 数据库管理组件
 * 提供本地数据库的导出、导入、清空等功能
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Download,
	Upload,
	Trash2,
	Database,
	AlertCircle,
	CheckCircle2,
} from "lucide-react";
import { dbMode, isLocalMode } from "@/shared/config/database";
import {
	exportLocalDatabase,
	importLocalDatabase,
	clearLocalDatabase,
	initLocalDatabase,
} from "@/shared/utils/initLocalDB";

export function DatabaseManager() {
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	// 导出数据
	const handleExport = async () => {
		try {
			setLoading(true);
			setMessage(null);

			const jsonData = await exportLocalDatabase();
			const blob = new Blob([jsonData], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `xcodereviewer-backup-${new Date().toISOString().split("T")[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			setMessage({ type: "success", text: "数据导出成功！" });
		} catch (error) {
			console.error("导出失败:", error);
			setMessage({ type: "error", text: "数据导出失败，请重试" });
		} finally {
			setLoading(false);
		}
	};

	// 导入数据
	const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			setLoading(true);
			setMessage(null);

			const text = await file.text();
			await importLocalDatabase(text);

			setMessage({ type: "success", text: "数据导入成功！页面将刷新..." });
			setTimeout(() => window.location.reload(), 1500);
		} catch (error) {
			console.error("导入失败:", error);
			setMessage({ type: "error", text: "数据导入失败，请检查文件格式" });
		} finally {
			setLoading(false);
		}
	};

	// 清空数据
	const handleClear = async () => {
		if (!confirm("确定要清空所有本地数据吗？此操作不可恢复！")) {
			return;
		}

		try {
			setLoading(true);
			setMessage(null);

			await clearLocalDatabase();

			setMessage({ type: "success", text: "数据已清空！页面将刷新..." });
			setTimeout(() => window.location.reload(), 1500);
		} catch (error) {
			console.error("清空失败:", error);
			setMessage({ type: "error", text: "清空数据失败，请重试" });
		} finally {
			setLoading(false);
		}
	};

	// 初始化数据库
	const handleInit = async () => {
		try {
			setLoading(true);
			setMessage(null);

			await initLocalDatabase();

			setMessage({ type: "success", text: "数据库初始化成功！" });
		} catch (error) {
			console.error("初始化失败:", error);
			setMessage({ type: "error", text: "初始化失败，请重试" });
		} finally {
			setLoading(false);
		}
	};

	if (!isLocalMode) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Database className="h-5 w-5" />
						数据库管理
					</CardTitle>
					<CardDescription>
						当前使用 {dbMode === "supabase" ? "Supabase 云端" : "演示"} 模式
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							数据库管理功能仅在本地数据库模式下可用。
							{dbMode === "demo" &&
								"请在 .env 文件中配置 VITE_USE_LOCAL_DB=true 启用本地数据库。"}
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Database className="h-5 w-5" />
					本地数据库管理
				</CardTitle>
				<CardDescription>
					管理您的本地数据库，包括导出、导入和清空数据
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{message && (
					<Alert variant={message.type === "error" ? "destructive" : "default"}>
						{message.type === "success" ? (
							<CheckCircle2 className="h-4 w-4" />
						) : (
							<AlertCircle className="h-4 w-4" />
						)}
						<AlertDescription>{message.text}</AlertDescription>
					</Alert>
				)}

				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<h4 className="text-sm font-medium">导出数据</h4>
						<p className="text-sm text-muted-foreground">
							将本地数据导出为 JSON 文件，用于备份或迁移
						</p>
						<Button
							onClick={handleExport}
							disabled={loading}
							className="w-full"
							variant="outline"
						>
							<Download className="mr-2 h-4 w-4" />
							导出数据
						</Button>
					</div>

					<div className="space-y-2">
						<h4 className="text-sm font-medium">导入数据</h4>
						<p className="text-sm text-muted-foreground">
							从 JSON 文件恢复数据
						</p>
						<Button
							onClick={() => document.getElementById("import-file")?.click()}
							disabled={loading}
							className="w-full"
							variant="outline"
						>
							<Upload className="mr-2 h-4 w-4" />
							导入数据
						</Button>
						<input
							id="import-file"
							type="file"
							accept=".json"
							onChange={handleImport}
							className="hidden"
						/>
					</div>

					<div className="space-y-2">
						<h4 className="text-sm font-medium">初始化数据库</h4>
						<p className="text-sm text-muted-foreground">
							创建默认用户和基础数据
						</p>
						<Button
							onClick={handleInit}
							disabled={loading}
							className="w-full"
							variant="outline"
						>
							<Database className="mr-2 h-4 w-4" />
							初始化
						</Button>
					</div>

					<div className="space-y-2">
						<h4 className="text-sm font-medium text-destructive">清空数据</h4>
						<p className="text-sm text-muted-foreground">
							删除所有本地数据（不可恢复）
						</p>
						<Button
							onClick={handleClear}
							disabled={loading}
							className="w-full"
							variant="destructive"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							清空数据
						</Button>
					</div>
				</div>

				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						<strong>提示：</strong>
						本地数据存储在浏览器中，清除浏览器数据会导致数据丢失。
						建议定期导出备份。
					</AlertDescription>
				</Alert>
			</CardContent>
		</Card>
	);
}
