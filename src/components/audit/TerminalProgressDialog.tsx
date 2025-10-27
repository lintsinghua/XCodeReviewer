import { useEffect, useRef, useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Terminal, CheckCircle, XCircle, Loader2, X as XIcon } from "lucide-react";
import { cn, calculateTaskProgress } from "@/shared/utils/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { taskControl } from "@/shared/services/taskControl";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TerminalProgressDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    taskId: string | null;
    taskType: "repository" | "zip";
}

interface LogEntry {
    timestamp: string;
    message: string;
    type: "info" | "success" | "error" | "warning";
}

export default function TerminalProgressDialog({
    open,
    onOpenChange,
    taskId,
    taskType
}: TerminalProgressDialogProps) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [isFailed, setIsFailed] = useState(false);
    const [isCancelled, setIsCancelled] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    const logsEndRef = useRef<HTMLDivElement>(null);
    const pollIntervalRef = useRef<number | null>(null);
    const hasInitializedLogsRef = useRef(false);

    // 添加日志条目
    const addLog = (message: string, type: LogEntry["type"] = "info") => {
        const timestamp = new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        setLogs(prev => [...prev, { timestamp, message, type }]);
    };

    // 取消任务处理
    const handleCancel = async () => {
        if (!taskId) return;
        
        if (!confirm('确定要取消此任务吗？已分析的结果将被保留。')) {
            return;
        }
        
        // 1. 标记任务为取消状态
        taskControl.cancelTask(taskId);
        setIsCancelled(true);
        addLog("🛑 用户取消任务，正在停止...", "error");
        
        // 2. 立即更新数据库状态
        try {
            const { api } = await import("@/shared/config/database");
            await api.updateAuditTask(taskId, { status: 'cancelled' } as any);
            addLog("✓ 任务状态已更新为已取消", "warning");
            toast.success("任务已取消");
        } catch (error) {
            console.error('更新取消状态失败:', error);
            toast.warning("任务已标记取消，后台正在停止...");
        }
    };

    // 自动滚动到底部
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // 实时更新光标处的时间
    useEffect(() => {
        if (!open || isCompleted || isFailed || isCancelled) {
            return;
        }

        const timeInterval = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        }, 1000);

        return () => {
            clearInterval(timeInterval);
        };
    }, [open, isCompleted, isFailed]);

    // 轮询任务状态
    useEffect(() => {
        if (!open || !taskId) {
            // 清理状态
            setLogs([]);
            setIsCompleted(false);
            setIsFailed(false);
            hasInitializedLogsRef.current = false;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        // 只初始化日志一次（防止React严格模式重复）
        if (!hasInitializedLogsRef.current) {
            hasInitializedLogsRef.current = true;

            // 初始化日志
            addLog("🚀 审计任务已启动", "info");
            addLog(`� 任务任ID: ${taskId}`, "info");
            addLog(`� 任务类D型: ${taskType === "repository" ? "仓库审计" : "ZIP文件审计"}`, "info");
            addLog("⏳ 正在初始化审计环境...", "info");
        }

        let lastScannedFiles = 0;
        let lastIssuesCount = 0;
        let lastTotalLines = 0;
        let lastStatus = "";
        let pollCount = 0;
        let hasDataChange = false;
        let isFirstPoll = true;

        // 开始轮询
        const pollTask = async () => {
            // 如果任务已完成或失败，停止轮询
            if (isCompleted || isFailed) {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                return;
            }

            try {
                pollCount++;
                hasDataChange = false;

                const requestStartTime = Date.now();

                // 使用 api.getAuditTaskById 获取任务状态
                const { api } = await import("@/shared/config/database");
                const task = await api.getAuditTaskById(taskId);

                const requestDuration = Date.now() - requestStartTime;

                if (!task) {
                    addLog(`❌ 任务不存在 (${requestDuration}ms)`, "error");
                    throw new Error("任务不存在");
                }

                // 检查是否有数据变化
                const statusChanged = task.status !== lastStatus;
                const filesChanged = task.scanned_files !== lastScannedFiles;
                const issuesChanged = task.issues_count !== lastIssuesCount;
                const linesChanged = task.total_lines !== lastTotalLines;

                hasDataChange = statusChanged || filesChanged || issuesChanged || linesChanged;

                // 标记首次轮询已完成
                if (isFirstPoll) {
                    isFirstPoll = false;
                }

                // 只在有变化时显示请求/响应信息
                if (hasDataChange) {
                    addLog(`🔄 正在获取任务状态...`, "info");
                    addLog(
                        `✓ 状态: ${task.status} | 文件: ${task.scanned_files}/${task.total_files} | 问题: ${task.issues_count} (${requestDuration}ms)`,
                        "success"
                    );
                }

                // 更新上次状态
                if (statusChanged) {
                    lastStatus = task.status;
                }

                // 检查任务状态
                if (task.status === "pending") {
                    // 任务待处理（只在状态变化时显示）
                    if (statusChanged && logs.filter(l => l.message.includes("等待开始执行")).length === 0) {
                        addLog("⏳ 任务已创建，等待开始执行...", "info");
                    }
                } else if (task.status === "running") {
                    // 首次进入运行状态
                    if (statusChanged && logs.filter(l => l.message.includes("开始扫描")).length === 0) {
                        addLog("🔍 开始扫描代码文件...", "info");
                        if (task.project) {
                            addLog(`📁 项目: ${task.project.name}`, "info");
                            if (task.branch_name) {
                                addLog(`🌿 分支: ${task.branch_name}`, "info");
                            }
                        }
                    }

                    // 显示进度更新（仅在有变化时）
                    if (filesChanged && task.scanned_files > lastScannedFiles) {
                        const progress = calculateTaskProgress(task.scanned_files, task.total_files);
                        const filesProcessed = task.scanned_files - lastScannedFiles;
                        addLog(
                            `📊 扫描进度: ${task.scanned_files || 0}/${task.total_files || 0} 文件 (${progress}%) [+${filesProcessed}]`,
                            "info"
                        );
                        lastScannedFiles = task.scanned_files;
                    }

                    // 显示问题发现（仅在有变化时）
                    if (issuesChanged && task.issues_count > lastIssuesCount) {
                        const newIssues = task.issues_count - lastIssuesCount;
                        addLog(`⚠️  发现 ${newIssues} 个新问题 (总计: ${task.issues_count})`, "warning");
                        lastIssuesCount = task.issues_count;
                    }

                    // 显示代码行数（仅在有变化时）
                    if (linesChanged && task.total_lines > lastTotalLines) {
                        const newLines = task.total_lines - lastTotalLines;
                        addLog(`📝 已分析 ${task.total_lines.toLocaleString()} 行代码 [+${newLines.toLocaleString()}]`, "info");
                        lastTotalLines = task.total_lines;
                    }
                } else if (task.status === "completed") {
                    // 任务完成
                    if (!isCompleted) {
                        addLog("", "info"); // 空行分隔
                        addLog("✅ 代码扫描完成", "success");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
                        addLog(`📊 总计扫描: ${task.total_files} 个文件`, "success");
                        addLog(`📝 总计分析: ${task.total_lines.toLocaleString()} 行代码`, "success");
                        addLog(`⚠️  发现问题: ${task.issues_count} 个`, task.issues_count > 0 ? "warning" : "success");

                        // 解析问题类型分布
                        if (task.issues_count > 0) {
                            try {
                                const { api: apiImport } = await import("@/shared/config/database");
                                const issues = await apiImport.getAuditIssues(taskId);

                                const severityCounts = {
                                    critical: issues.filter(i => i.severity === 'critical').length,
                                    high: issues.filter(i => i.severity === 'high').length,
                                    medium: issues.filter(i => i.severity === 'medium').length,
                                    low: issues.filter(i => i.severity === 'low').length
                                };

                                if (severityCounts.critical > 0) {
                                    addLog(`  🔴 严重: ${severityCounts.critical} 个`, "error");
                                }
                                if (severityCounts.high > 0) {
                                    addLog(`  🟠 高: ${severityCounts.high} 个`, "warning");
                                }
                                if (severityCounts.medium > 0) {
                                    addLog(`  🟡 中等: ${severityCounts.medium} 个`, "warning");
                                }
                                if (severityCounts.low > 0) {
                                    addLog(`  🟢 低: ${severityCounts.low} 个`, "info");
                                }
                            } catch (e) {
                                // 静默处理错误
                            }
                        }

                        addLog(`⭐ 质量评分: ${task.quality_score.toFixed(1)}/100`, "success");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
                        addLog("🎉 审计任务已完成！", "success");

                        if (task.completed_at) {
                            const startTime = new Date(task.created_at).getTime();
                            const endTime = new Date(task.completed_at).getTime();
                            const duration = Math.round((endTime - startTime) / 1000);
                            addLog(`⏱️  总耗时: ${duration} 秒`, "info");
                        }

                        setIsCompleted(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                } else if (task.status === "cancelled") {
                    // 任务被取消
                    if (!isCancelled) {
                        addLog("", "info"); // 空行分隔
                        addLog("🛑 任务已被用户取消", "warning");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "warning");
                        addLog(`📊 完成统计:`, "info");
                        addLog(`  • 已分析文件: ${task.scanned_files}/${task.total_files}`, "info");
                        addLog(`  • 发现问题: ${task.issues_count} 个`, "info");
                        addLog(`  • 代码行数: ${task.total_lines.toLocaleString()} 行`, "info");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "warning");
                        addLog("✓ 已分析的结果已保存到数据库", "success");

                        setIsCancelled(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                } else if (task.status === "failed") {
                    // 任务失败
                    if (!isFailed) {
                        addLog("", "info"); // 空行分隔
                        addLog("❌ 审计任务执行失败", "error");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "error");
                        addLog("可能的原因:", "error");
                        addLog("  • 网络连接问题", "error");
                        addLog("  • 仓库访问权限不足（私有仓库需配置 Token）", "error");
                        addLog("  • GitHub/GitLab API 限流", "error");
                        addLog("  • 代码文件格式错误", "error");
                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "error");
                        addLog("💡 建议: 检查网络连接、仓库配置和 Token 设置后重试", "warning");

                        setIsFailed(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                }
            } catch (error: any) {
                addLog(`❌ ${error.message || "未知错误"}`, "error");
                // 不中断轮询，继续尝试
            }
        };

        // 立即执行一次
        pollTask();

        // 设置定时轮询（每2秒）
        pollIntervalRef.current = window.setInterval(pollTask, 2000);

        // 清理函数
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [open, taskId, taskType]);

    // 获取日志颜色 - 使用优雅的深红色主题
    const getLogColor = (type: LogEntry["type"]) => {
        switch (type) {
            case "success":
                return "text-emerald-400";
            case "error":
                return "text-rose-400";
            case "warning":
                return "text-amber-400";
            default:
                return "text-gray-200";
        }
    };

    // 获取状态图标
    const getStatusIcon = () => {
        if (isFailed) {
            return <XCircle className="w-5 h-5 text-rose-400" />;
        }
        if (isCompleted) {
            return <CheckCircle className="w-5 h-5 text-emerald-400" />;
        }
        return <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay />
                <DialogPrimitive.Content
                    className={cn(
                        "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                        "w-[90vw] aspect-[16/9]",
                        "max-w-[1600px] max-h-[900px]",
                        "p-0 gap-0 rounded-lg overflow-hidden",
                        "bg-gradient-to-br from-gray-900 via-red-950/30 to-gray-900 border border-red-900/50",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "duration-200 shadow-2xl"
                    )}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    {/* 无障碍访问标题 */}
                    <VisuallyHidden.Root>
                        <DialogPrimitive.Title>审计进度监控</DialogPrimitive.Title>
                        <DialogPrimitive.Description>
                            实时显示代码审计任务的执行进度和详细信息
                        </DialogPrimitive.Description>
                    </VisuallyHidden.Root>

                    {/* 终端头部 */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-950/50 to-gray-900/80 border-b border-red-900/30 backdrop-blur-sm">
                        <div className="flex items-center space-x-3">
                            <Terminal className="w-5 h-5 text-rose-400" />
                            <span className="text-sm font-medium text-gray-100">审计进度监控</span>
                            {getStatusIcon()}
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <button
                                className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 cursor-pointer transition-colors focus:outline-none"
                                onClick={() => onOpenChange(false)}
                                title="关闭"
                                aria-label="关闭"
                            />
                        </div>
                    </div>

                    {/* 终端内容 */}
                    <div className="p-6 bg-gradient-to-b from-gray-900/95 to-gray-950/95 overflow-y-auto h-[calc(100%-120px)] font-mono text-sm backdrop-blur-sm">
                        <div className="space-y-2">
                            {logs.map((log, index) => (
                                <div key={index} className="flex items-start space-x-3 hover:bg-red-950/10 px-2 py-1 rounded transition-colors">
                                    <span className="text-rose-800/70 text-xs flex-shrink-0 w-20">
                                        [{log.timestamp}]
                                    </span>
                                    <span className={`${getLogColor(log.type)} flex-1`}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}

                            {/* 光标旋转闪烁效果 */}
                            {!isCompleted && !isFailed && (
                                <div className="flex items-center space-x-2 mt-4">
                                    <span className="text-rose-800/70 text-xs w-20">[{currentTime}]</span>
                                    <span className="inline-block text-rose-400 animate-spinner font-bold text-base"></span>
                                </div>
                            )}

                            {/* 添加自定义动画 */}
                            <style>{`
                                @keyframes spinner {
                                    0% {
                                        content: '|';
                                        opacity: 1;
                                    }
                                    25% {
                                        content: '/';
                                        opacity: 0.8;
                                    }
                                    50% {
                                        content: '—';
                                        opacity: 0.6;
                                    }
                                    75% {
                                        content: '\\\\';
                                        opacity: 0.8;
                                    }
                                    100% {
                                        content: '|';
                                        opacity: 1;
                                    }
                                }
                                .animate-spinner::before {
                                    content: '|';
                                    animation: spinner-content 0.8s linear infinite;
                                }
                                .animate-spinner {
                                    animation: spinner-opacity 0.8s ease-in-out infinite;
                                }
                                @keyframes spinner-content {
                                    0% { content: '|'; }
                                    25% { content: '/'; }
                                    50% { content: '—'; }
                                    75% { content: '\\\\'; }
                                    100% { content: '|'; }
                                }
                                @keyframes spinner-opacity {
                                    0%, 100% { opacity: 1; }
                                    25%, 75% { opacity: 0.8; }
                                    50% { opacity: 0.6; }
                                }
                            `}</style>

                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* 底部控制和提示 */}
                    <div className="px-4 py-3 bg-gradient-to-r from-red-950/50 to-gray-900/80 border-t border-red-900/30 backdrop-blur-sm">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300">
                                {isCancelled ? "🛑 任务已取消，已分析的结果已保存" :
                                    isCompleted ? "✅ 任务已完成，可以关闭此窗口" :
                                    isFailed ? "❌ 任务失败，请检查配置后重试" :
                                        "⏳ 审计进行中，请勿关闭窗口，过程可能较慢，请耐心等待......"}
                            </span>
                            
                            <div className="flex items-center space-x-2">
                                {/* 运行中显示取消按钮 */}
                                {!isCompleted && !isFailed && !isCancelled && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancel}
                                        className="h-7 text-xs bg-gray-800 border-red-600 text-red-400 hover:bg-red-900 hover:text-red-200"
                                    >
                                        <XIcon className="w-3 h-3 mr-1" />
                                        取消任务
                                    </Button>
                                )}
                                
                                {/* 已完成/失败/取消显示关闭按钮 */}
                                {(isCompleted || isFailed || isCancelled) && (
                                    <button
                                        onClick={() => onOpenChange(false)}
                                        className="px-4 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded text-xs transition-all shadow-lg shadow-rose-900/50 font-medium"
                                    >
                                        关闭
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    );
}
