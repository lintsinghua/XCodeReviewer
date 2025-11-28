import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Terminal, X as XIcon, Activity, Cpu, HardDrive, AlertTriangle, CheckCircle2 } from "lucide-react";
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
    id: string;
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

    // Refs for state accessed in intervals/effects to avoid dependency cycles
    const logsRef = useRef<LogEntry[]>([]);
    const isCompletedRef = useRef(false);
    const isFailedRef = useRef(false);
    const isCancelledRef = useRef(false);

    // Sync refs with state
    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    useEffect(() => {
        isCompletedRef.current = isCompleted;
    }, [isCompleted]);

    useEffect(() => {
        isFailedRef.current = isFailed;
    }, [isFailed]);

    useEffect(() => {
        isCancelledRef.current = isCancelled;
    }, [isCancelled]);

    // 添加日志条目
    const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
        const timestamp = new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
        const newLog = { id: Math.random().toString(36).substr(2, 9), timestamp, message, type };
        setLogs(prev => [...prev, newLog]);
    }, []);

    // 取消任务处理
    const handleCancel = async () => {
        if (!taskId) return;

        if (!confirm('确定要取消此任务吗？已分析的结果将被保留。')) {
            return;
        }

        // 1. 标记任务为取消状态
        taskControl.cancelTask(taskId);
        setIsCancelled(true);
        addLog("[ERR] 用户取消任务，正在停止...", "error");

        // 2. 立即更新数据库状态
        try {
            const { api } = await import("@/shared/config/database");
            // biome-ignore lint/suspicious/noExplicitAny: API type mismatch workaround
            await api.updateAuditTask(taskId, { status: 'cancelled' } as any);
            addLog("[WARN] 任务状态已更新为已取消", "warning");
            toast.success("任务已取消");
        } catch (error) {
            console.error('更新取消状态失败:', error);
            toast.warning("任务已标记取消，后台正在停止...");
        }
    };

    // 自动滚动到底部
    // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll when logs change
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
    }, [open, isCompleted, isFailed, isCancelled]);

    // 轮询任务状态
    useEffect(() => {
        if (!open || !taskId) {
            // 清理状态
            setLogs([]);
            logsRef.current = [];
            setIsCompleted(false);
            setIsFailed(false);
            setIsCancelled(false);
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
            addLog("[INFO] 审计任务已启动", "info");
            addLog(`TASK_ID: ${taskId}`, "info");
            addLog(`TYPE: ${taskType === "repository" ? "REPO_AUDIT" : "ZIP_AUDIT"}`, "info");
            addLog("[WAIT] 正在初始化审计环境...", "info");
        }

        let lastScannedFiles = 0;
        let lastIssuesCount = 0;
        let lastTotalLines = 0;
        let lastStatus = "";
        let _pollCount = 0;
        let hasDataChange = false;
        let isFirstPoll = true;

        // 开始轮询
        const pollTask = async () => {
            // 如果任务已完成或失败，停止轮询
            if (isCompletedRef.current || isFailedRef.current) {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                return;
            }

            try {
                _pollCount++;
                hasDataChange = false;

                const requestStartTime = Date.now();

                // 使用 api.getAuditTaskById 获取任务状态
                const { api } = await import("@/shared/config/database");
                const task = await api.getAuditTaskById(taskId);

                const requestDuration = Date.now() - requestStartTime;

                if (!task) {
                    addLog(`[ERR] 任务不存在 (${requestDuration}ms)`, "error");
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
                    addLog(`[NET] 正在获取任务状态...`, "info");
                    addLog(
                        `[OK] 状态: ${task.status} | 文件: ${task.scanned_files}/${task.total_files} | 问题: ${task.issues_count} (${requestDuration}ms)`,
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
                    if (statusChanged && logsRef.current.filter(l => l.message.includes("开始扫描")).length === 0) {
                        addLog("[SCAN] 开始扫描代码文件...", "info");
                        if (task.project) {
                            addLog(`[PROJ] 项目: ${task.project.name}`, "info");
                            if (task.branch_name) {
                                addLog(`[BRCH] 分支: ${task.branch_name}`, "info");
                            }
                        }
                    }

                    // 显示进度更新（仅在有变化时）
                    if (filesChanged && task.scanned_files > lastScannedFiles) {
                        const progress = calculateTaskProgress(task.scanned_files, task.total_files);
                        const filesProcessed = task.scanned_files - lastScannedFiles;
                        addLog(
                            `[PROG] 扫描进度: ${task.scanned_files || 0}/${task.total_files || 0} 文件 (${progress}%) [+${filesProcessed}]`,
                            "info"
                        );
                        lastScannedFiles = task.scanned_files;
                    }

                    // 显示问题发现（仅在有变化时）
                    if (issuesChanged && task.issues_count > lastIssuesCount) {
                        const newIssues = task.issues_count - lastIssuesCount;
                        addLog(`[WARN] 发现 ${newIssues} 个新问题 (总计: ${task.issues_count})`, "warning");
                        lastIssuesCount = task.issues_count;
                    }

                    // 显示代码行数（仅在有变化时）
                    if (linesChanged && task.total_lines > lastTotalLines) {
                        const newLines = task.total_lines - lastTotalLines;
                        addLog(`[STAT] 已分析 ${task.total_lines.toLocaleString()} 行代码 [+${newLines.toLocaleString()}]`, "info");
                        lastTotalLines = task.total_lines;
                    }
                } else if (task.status === "completed") {
                    // 任务完成
                    if (!isCompletedRef.current) {
                        addLog("", "info"); // 空行分隔
                        addLog("[DONE] 代码扫描完成", "success");
                        addLog("----------------------------------", "info");
                        addLog(`[STAT] 总计扫描: ${task.total_files} 个文件`, "success");
                        addLog(`[STAT] 总计分析: ${task.total_lines.toLocaleString()} 行代码`, "success");
                        addLog(`[RSLT] 发现问题: ${task.issues_count} 个`, task.issues_count > 0 ? "warning" : "success");

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
                                    addLog(`  [CRIT] 严重: ${severityCounts.critical} 个`, "error");
                                }
                                if (severityCounts.high > 0) {
                                    addLog(`  [HIGH] 高: ${severityCounts.high} 个`, "warning");
                                }
                                if (severityCounts.medium > 0) {
                                    addLog(`  [MED] 中等: ${severityCounts.medium} 个`, "warning");
                                }
                                if (severityCounts.low > 0) {
                                    addLog(`  [LOW] 低: ${severityCounts.low} 个`, "info");
                                }
                            } catch (_e) {
                                // 静默处理错误
                            }
                        }

                        addLog(`[SCOR] 质量评分: ${task.quality_score.toFixed(1)}/100`, "success");
                        addLog("----------------------------------", "info");
                        addLog("[FIN] 审计任务已完成！", "success");

                        if (task.completed_at) {
                            const startTime = new Date(task.created_at).getTime();
                            const endTime = new Date(task.completed_at).getTime();
                            const duration = Math.round((endTime - startTime) / 1000);
                            addLog(`[TIME] 总耗时: ${duration} 秒`, "info");
                        }

                        setIsCompleted(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                } else if (task.status === "cancelled") {
                    // 任务被取消
                    if (!isCancelledRef.current) {
                        addLog("", "info"); // 空行分隔
                        addLog("[STOP] 任务已被用户取消", "warning");
                        addLog("----------------------------------", "warning");
                        addLog(`[STAT] 完成统计:`, "info");
                        addLog(`  • 已分析文件: ${task.scanned_files}/${task.total_files}`, "info");
                        addLog(`  • 发现问题: ${task.issues_count} 个`, "info");
                        addLog(`  • 代码行数: ${task.total_lines.toLocaleString()} 行`, "info");
                        addLog("----------------------------------", "warning");
                        addLog("[SAVE] 已分析的结果已保存到数据库", "success");

                        setIsCancelled(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                } else if (task.status === "failed") {
                    // 任务失败
                    if (!isFailedRef.current) {
                        addLog("", "info"); // 空行分隔
                        addLog("[FAIL] 审计任务执行失败", "error");
                        addLog("----------------------------------", "error");

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
                        } catch (_e) {
                            // 如果获取日志失败，显示常见原因
                            addLog("可能的原因:", "error");
                            addLog("  • 网络连接问题", "error");
                            addLog("  • 仓库访问权限不足（私有仓库需配置 Token）", "error");
                            addLog("  • GitHub/GitLab API 限流", "error");
                            addLog("  • LLM API 配置错误或额度不足", "error");
                        }

                        addLog("----------------------------------", "error");
                        addLog("[HINT] 建议: 检查系统配置和网络连接后重试", "warning");
                        addLog("[LOGS] 查看完整日志: 导航栏 -> 系统日志", "warning");

                        setIsFailed(true);
                        if (pollIntervalRef.current) {
                            clearInterval(pollIntervalRef.current);
                            pollIntervalRef.current = null;
                        }
                    }
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : "未知错误";
                addLog(`[ERR] ${errorMessage}`, "error");
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
    }, [open, taskId, taskType, addLog]);

    // 获取日志颜色 - 简化配色，减少颜色数量
    const getLogColor = (type: LogEntry["type"]) => {
        switch (type) {
            case "success":
                return "text-[#00ff41]"; // 纯绿色
            case "error":
                return "text-[#ff3333]"; // 纯红色
            case "warning":
                return "text-[#ffb900]"; // 琥珀色
            default:
                return "text-[#cccccc]"; // 浅灰色 (原为青色)
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPortal>
                <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
                <DialogPrimitive.Content
                    className={cn(
                        "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                        "w-[95vw] max-w-[1000px] h-[85vh] max-h-[700px]",
                        "p-0 gap-0 rounded-sm overflow-hidden",
                        "bg-[#e0e0e0] border-4 border-[#4a4a4a]", // 机械外壳颜色
                        "shadow-[15px_15px_0px_0px_rgba(0,0,0,0.5)]", // 硬阴影
                        "data-[state=open]:animate-in data-[state=closed]:animate-out",
                        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                        "duration-300 font-mono tracking-tight" // 增加 tracking-tight 模拟像素感
                    )}
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <VisuallyHidden.Root>
                        <DialogPrimitive.Title>审计进度监控</DialogPrimitive.Title>
                        <DialogPrimitive.Description>
                            实时显示代码审计任务的执行进度和详细信息
                        </DialogPrimitive.Description>
                    </VisuallyHidden.Root>

                    {/* 机械外壳装饰 - 螺丝 */}
                    <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-[#b0b0b0] border border-[#808080] shadow-inner flex items-center justify-center z-50">
                        <div className="w-2 h-0.5 bg-[#606060] rotate-45"></div>
                    </div>
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[#b0b0b0] border border-[#808080] shadow-inner flex items-center justify-center z-50">
                        <div className="w-2 h-0.5 bg-[#606060] rotate-45"></div>
                    </div>
                    <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-[#b0b0b0] border border-[#808080] shadow-inner flex items-center justify-center z-50">
                        <div className="w-2 h-0.5 bg-[#606060] rotate-45"></div>
                    </div>
                    <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-[#b0b0b0] border border-[#808080] shadow-inner flex items-center justify-center z-50">
                        <div className="w-2 h-0.5 bg-[#606060] rotate-45"></div>
                    </div>

                    {/* 顶部控制面板 */}
                    <div className="h-14 bg-[#d0d0d0] border-b-4 border-[#4a4a4a] flex items-center justify-between px-8 relative">
                        {/* 装饰条纹 */}
                        <div className="absolute top-0 left-16 right-16 h-1 bg-[repeating-linear-gradient(90deg,transparent,transparent_2px,#000_2px,#000_4px)] opacity-20"></div>

                        <div className="flex items-center space-x-4">
                            <div className="bg-[#333] p-1.5 rounded-sm border border-white/20 shadow-md">
                                <Terminal className="w-5 h-5 text-[#00ff41]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-[#666] uppercase tracking-widest leading-none mb-0.5">System Monitor</span>
                                <span className="text-lg font-black text-[#333] uppercase tracking-tighter leading-none font-display">AUDIT_TERMINAL_V2.0</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* 状态指示灯组 */}
                            <div className="flex space-x-1 bg-[#222] p-1 rounded-sm border-b border-white/20">
                                <div className={`w-3 h-3 rounded-full ${!isCompleted && !isFailed ? 'bg-[#00ff41] shadow-[0_0_5px_#00ff41] animate-pulse' : 'bg-[#1a4d26]'}`} title="Processing"></div>
                                <div className={`w-3 h-3 rounded-full ${isFailed ? 'bg-[#ff0033] shadow-[0_0_5px_#ff0033]' : 'bg-[#4d000f]'}`} title="Error"></div>
                                <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-[#00ccff] shadow-[0_0_5px_#00ccff]' : 'bg-[#00334d]'}`} title="Ready"></div>
                            </div>

                            <button
                                type="button"
                                className="w-8 h-8 bg-[#ff4444] border-b-4 border-r-4 border-[#990000] active:border-0 active:translate-y-1 active:translate-x-1 transition-all flex items-center justify-center hover:bg-[#ff6666]"
                                onClick={() => onOpenChange(false)}
                                title="关闭电源"
                            >
                                <XIcon className="w-5 h-5 text-white stroke-[3]" />
                            </button>
                        </div>
                    </div>

                    {/* 主体内容区 - 包含侧边栏和屏幕 */}
                    <div className="flex h-[calc(100%-56px)] bg-[#c0c0c0]">
                        {/* 左侧数据面板 */}
                        <div className="w-48 bg-[#d4d4d4] border-r-4 border-[#4a4a4a] p-4 flex flex-col gap-4 relative overflow-hidden">
                            {/* 装饰背景 */}
                            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[length:4px_4px]"></div>

                            <div className="space-y-1 z-10">
                                <div className="text-[10px] font-bold text-[#666] uppercase">Task ID</div>
                                <div className="text-xs font-mono font-bold text-[#333] break-all bg-white/50 p-1 border border-[#999]">{taskId?.slice(0, 8)}...</div>
                            </div>

                            <div className="space-y-1 z-10">
                                <div className="text-[10px] font-bold text-[#666] uppercase">Type</div>
                                <div className="flex items-center space-x-2 bg-white/50 p-1 border border-[#999]">
                                    {taskType === 'repository' ? <Cpu className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                                    <span className="text-xs font-bold text-[#333] uppercase">{taskType}</span>
                                </div>
                            </div>

                            <div className="flex-1"></div>

                            {/* 装饰性条形码/数据块 */}
                            <div className="h-24 w-full bg-[#333] p-2 flex flex-col justify-between opacity-80">
                                <div className="flex justify-between">
                                    <div className="w-1 h-8 bg-[#ffb900]"></div>
                                    <div className="w-1 h-6 bg-[#ffb900]"></div>
                                    <div className="w-1 h-10 bg-[#ffb900]"></div>
                                    <div className="w-1 h-4 bg-[#ffb900]"></div>
                                    <div className="w-1 h-7 bg-[#ffb900]"></div>
                                </div>
                                <div className="text-[8px] text-[#00ff41] font-mono leading-none">
                                    MEM: 64K OK<br />
                                    CPU: ACTIVE<br />
                                    NET: LINKED
                                </div>
                            </div>
                        </div>

                        {/* 中央屏幕区域 */}
                        <div className="flex-1 p-6 flex flex-col relative">
                            {/* 屏幕边框 */}
                            <div className="flex-1 bg-[#1a1a1a] rounded-lg p-1 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] border-b-2 border-white/10 relative overflow-hidden">
                                {/* 屏幕内边框 */}
                                <div className="absolute inset-0 border-[16px] border-[#2a2a2a] rounded-lg pointer-events-none z-20 shadow-[inset_0_0_10px_rgba(0,0,0,1)]"></div>

                                {/* 屏幕内容 */}
                                <div className="w-full h-full bg-black p-6 overflow-y-auto font-mono text-sm relative z-10 custom-scrollbar">
                                    {/* CRT 效果层 */}
                                    <div className="absolute inset-0 pointer-events-none z-30 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20"></div>
                                    <div className="absolute inset-0 pointer-events-none z-30 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.4)_100%)]"></div>

                                    {/* 像素网格 */}
                                    <div className="absolute inset-0 pointer-events-none z-0 opacity-10" style={{
                                        backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
                                        backgroundSize: '20px 20px'
                                    }}></div>

                                    <div className="relative z-10 space-y-1 pb-10">
                                        {logs.map((log) => (
                                            <div key={log.id} className="flex items-start space-x-3 hover:bg-white/5 px-2 py-0.5 transition-colors group">
                                                <span className="text-[#666] text-xs flex-shrink-0 w-24 font-bold group-hover:text-[#888]">
                                                    {log.timestamp}
                                                </span>
                                                <span className={`${getLogColor(log.type)} flex-1 font-bold tracking-wide font-mono`}>
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))}

                                        {!isCompleted && !isFailed && (
                                            <div className="flex items-center space-x-2 mt-4 px-2">
                                                <span className="text-[#666] text-xs w-24 font-bold">{currentTime}</span>
                                                <span className="inline-block text-[#00ff41] animate-pulse font-bold text-base">_</span>
                                            </div>
                                        )}
                                        <div ref={logsEndRef} />
                                    </div>
                                </div>
                            </div>

                            {/* 屏幕下方控制区 */}
                            <div className="mt-4 h-12 bg-[#d0d0d0] border-t-2 border-white/50 flex items-center justify-between px-2">
                                <div className="flex items-center space-x-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-[#666] uppercase">Status</span>
                                        <div className="flex items-center space-x-2">
                                            {isCancelled ? (
                                                <span className="text-xs font-black text-[#ffb900] bg-[#333] px-2 py-0.5 rounded-sm">CANCELLED</span>
                                            ) : isCompleted ? (
                                                <span className="text-xs font-black text-[#00ccff] bg-[#333] px-2 py-0.5 rounded-sm">COMPLETED</span>
                                            ) : isFailed ? (
                                                <span className="text-xs font-black text-[#ff0033] bg-[#333] px-2 py-0.5 rounded-sm">FAILED</span>
                                            ) : (
                                                <span className="text-xs font-black text-[#00ff41] bg-[#333] px-2 py-0.5 rounded-sm animate-pulse">RUNNING...</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-3">
                                    {!isCompleted && !isFailed && !isCancelled && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCancel}
                                            className="h-8 bg-[#e0e0e0] border-2 border-[#4a4a4a] text-[#333] hover:bg-[#ffcccc] hover:border-[#990000] hover:text-[#990000] font-bold uppercase rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                                        >
                                            <AlertTriangle className="w-3 h-3 mr-1" />
                                            取消任务
                                        </Button>
                                    )}

                                    {isFailed && (
                                        <button
                                            type="button"
                                            onClick={() => window.open('/logs', '_blank')}
                                            className="px-4 py-1.5 bg-[#ffb900] border-2 border-black text-black hover:bg-[#ffcc33] text-xs font-bold uppercase rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center"
                                        >
                                            <Activity className="w-3 h-3 mr-1" />
                                            查看日志
                                        </button>
                                    )}

                                    {(isCompleted || isFailed || isCancelled) && (
                                        <button
                                            type="button"
                                            onClick={() => onOpenChange(false)}
                                            className="px-4 py-1.5 bg-[#333] border-2 border-black text-white hover:bg-[#000] text-xs font-bold uppercase rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center"
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            确认
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPortal>
        </Dialog>
    );
}
