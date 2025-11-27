import { useEffect, useRef, useState } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Terminal, X as XIcon } from "lucide-react";
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
            addLog(`任务ID: ${taskId}`, "info");
            addLog(`任务类型: ${taskType === "repository" ? "仓库审计" : "ZIP文件审计"}`, "info");
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

                // 只在有变化时显示请求/响应信息（跳过 pending 状态）
                if (hasDataChange && task.status !== "pending") {
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
                    // 静默跳过 pending 状态，不显示任何日志
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

                        // 尝试从日志系统获取具体错误信息
                        try {
                            const { logger } = await import("@/shared/utils/logger");
                            const recentLogs = logger.getLogs({
                                startTime: Date.now() - 60000, // 最近1分钟
                            });

                            // 查找与当前任务相关的错误
                            const taskErrors = recentLogs
                                .filter(log =>
                                    log.level === 'ERROR' &&
                                    (log.message.includes(taskId) ||
                                        log.message.includes('审计') ||
                                        log.message.includes('API'))
                                )
                                .slice(-3); // 最近3条错误

                            if (taskErrors.length > 0) {
                                addLog("具体错误信息:", "error");
                                taskErrors.forEach(log => {
                                    addLog(`  • ${log.message}`, "error");
                                    if (log.data?.error) {
                                        const errorMsg = typeof log.data.error === 'string'
                                            ? log.data.error
                                            : log.data.error.message || JSON.stringify(log.data.error);
                                        addLog(`    ${errorMsg}`, "error");
                                    }
                                });
                            } else {
                                // 如果没有找到具体错误，显示常见原因
                                addLog("可能的原因:", "error");
                                addLog("  • 网络连接问题", "error");
                                addLog("  • 仓库访问权限不足（私有仓库需配置 Token）", "error");
                                addLog("  • GitHub/GitLab API 限流", "error");
                                addLog("  • LLM API 配置错误或额度不足", "error");
                            }
                        } catch (e) {
                            // 如果获取日志失败，显示常见原因
                            addLog("可能的原因:", "error");
                            addLog("  • 网络连接问题", "error");
                            addLog("  • 仓库访问权限不足（私有仓库需配置 Token）", "error");
                            addLog("  • GitHub/GitLab API 限流", "error");
                            addLog("  • LLM API 配置错误或额度不足", "error");
                        }

                        addLog("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "error");
                        addLog("💡 建议: 检查系统配置和网络连接后重试", "warning");
                        addLog("📋 查看完整日志: 导航栏 -> 系统日志", "warning");

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
                return "text-green-500";
            case "error":
                return "text-red-500";
            case "warning":
                return "text-yellow-500";
            default:
                return "text-gray-300";
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay className="bg-black/50 backdrop-blur-sm" />
                <DialogPrimitive.Content
                    className={cn(
                        "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                        "w-[90vw] aspect-[16/9]",
                        "max-w-[1200px] max-h-[800px]",
                        "p-0 gap-0 rounded-none overflow-hidden",
                        "bg-black border-4 border-gray-500 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.5)]",
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "duration-200"
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
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-300 border-b-4 border-gray-500">
                        <div className="flex items-center space-x-3">
                            <Terminal className="w-5 h-5 text-black" />
                            <span className="text-sm font-bold text-black uppercase font-display tracking-wider">TERMINAL // 审计进度监控</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* 模拟窗口控制按钮 */}
                            <div className="w-4 h-4 border-2 border-black bg-white flex items-center justify-center">
                                <div className="w-2 h-0.5 bg-black"></div>
                            </div>
                            <div className="w-4 h-4 border-2 border-black bg-white flex items-center justify-center">
                                <div className="w-2 h-2 border border-black"></div>
                            </div>
                            <button
                                className="w-4 h-4 border-2 border-black bg-primary hover:bg-red-600 cursor-pointer transition-colors focus:outline-none flex items-center justify-center"
                                onClick={() => onOpenChange(false)}
                                title="关闭"
                                aria-label="关闭"
                            >
                                <XIcon className="w-3 h-3 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* 终端内容 */}
                    <div className="p-6 bg-black overflow-y-auto h-[calc(100%-100px)] font-mono text-sm relative">
                        {/* 扫描线效果 */}
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%]"></div>

                        <div className="space-y-1 relative z-20">
                            {logs.map((log, index) => (
                                <div key={index} className="flex items-start space-x-3 hover:bg-white/5 px-2 py-0.5 transition-colors">
                                    <span className="text-gray-500 text-xs flex-shrink-0 w-24 font-bold">
                                        [{log.timestamp}]
                                    </span>
                                    <span className={`${getLogColor(log.type)} flex-1 font-bold tracking-wide`}>
                                        {log.type === 'info' && '> '}
                                        {log.type === 'success' && '✓ '}
                                        {log.type === 'error' && '✗ '}
                                        {log.type === 'warning' && '! '}
                                        {log.message}
                                    </span>
                                </div>
                            ))}

                            {/* 光标旋转闪烁效果 */}
                            {!isCompleted && !isFailed && (
                                <div className="flex items-center space-x-2 mt-4 px-2">
                                    <span className="text-gray-500 text-xs w-24 font-bold">[{currentTime}]</span>
                                    <span className="inline-block text-green-500 animate-pulse font-bold text-base">_</span>
                                </div>
                            )}

                            <div ref={logsEndRef} />
                        </div>
                    </div>

                    {/* 底部控制和提示 */}
                    <div className="px-4 py-3 bg-gray-200 border-t-4 border-gray-500 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 border-2 border-black ${isFailed ? 'bg-red-500' : isCompleted ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'}`}></div>
                            <span className="text-xs font-bold text-black uppercase font-mono tracking-tight">
                                {isCancelled ? "STATUS: CANCELLED // 任务已取消" :
                                    isCompleted ? "STATUS: COMPLETED // 任务已完成" :
                                        isFailed ? "STATUS: FAILED // 任务失败" :
                                            "STATUS: RUNNING // 审计进行中..."}
                            </span>
                        </div>

                        <div className="flex items-center space-x-3">
                            {/* 运行中显示取消按钮 */}
                            {!isCompleted && !isFailed && !isCancelled && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancel}
                                    className="h-8 text-xs bg-white border-2 border-black text-black hover:bg-red-100 hover:text-red-900 font-bold uppercase rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                >
                                    <XIcon className="w-3 h-3 mr-1" />
                                    取消任务
                                </Button>
                            )}

                            {/* 失败时显示查看日志按钮 */}
                            {isFailed && (
                                <button
                                    onClick={() => {
                                        window.open('/logs', '_blank');
                                    }}
                                    className="px-4 py-1.5 bg-yellow-400 border-2 border-black text-black hover:bg-yellow-500 text-xs font-bold uppercase rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                                >
                                    📋 查看日志
                                </button>
                            )}

                            {/* 已完成/失败/取消显示关闭按钮 */}
                            {(isCompleted || isFailed || isCancelled) && (
                                <button
                                    onClick={() => onOpenChange(false)}
                                    className="px-4 py-1.5 bg-primary border-2 border-black text-white hover:bg-primary/90 text-xs font-bold uppercase rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                                >
                                    关闭窗口
                                </button>
                            )}
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    );
}
