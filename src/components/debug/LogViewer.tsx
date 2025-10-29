/**
 * 日志查看器组件
 */

import { useState, useMemo } from 'react';
import { logger, LogLevel, LogCategory, LogEntry } from '@/shared/utils/logger';
import { useLogs, useLogStats } from '@/shared/hooks/useLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Search, RefreshCw, FileJson, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export function LogViewer() {
    const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
    const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

    const filter = useMemo(() => ({
        level: levelFilter !== 'ALL' ? levelFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        search: searchQuery || undefined,
    }), [levelFilter, categoryFilter, searchQuery]);

    const rawLogs = useLogs(filter);
    // 反转日志顺序，最新的在最上面
    const logs = useMemo(() => [...rawLogs].reverse(), [rawLogs]);
    const stats = useLogStats();

    const handleClearLogs = () => {
        if (confirm('确定要清空所有日志吗？')) {
            logger.clearLogs();
            toast.success('日志已清空');
        }
    };

    const handleDownloadJson = () => {
        logger.downloadLogs('json');
        toast.success('日志已导出为JSON');
    };

    const handleDownloadCsv = () => {
        logger.downloadLogs('csv');
        toast.success('日志已导出为CSV');
    };

    const getLevelColor = (level: LogLevel) => {
        const colors = {
            [LogLevel.DEBUG]: 'bg-gray-500',
            [LogLevel.INFO]: 'bg-blue-500',
            [LogLevel.WARN]: 'bg-yellow-500',
            [LogLevel.ERROR]: 'bg-red-500',
            [LogLevel.FATAL]: 'bg-red-900',
        };
        return colors[level];
    };

    const getCategoryColor = (category: LogCategory) => {
        const colors = {
            [LogCategory.USER_ACTION]: 'bg-green-500',
            [LogCategory.API_CALL]: 'bg-purple-500',
            [LogCategory.SYSTEM]: 'bg-blue-500',
            [LogCategory.CONSOLE_ERROR]: 'bg-red-500',
        };
        return colors[category];
    };

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            {/* 统计信息 */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm text-muted-foreground">总日志数</div>
                    <div className="text-2xl font-bold">{stats.total}</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm text-muted-foreground">错误数</div>
                    <div className="text-2xl font-bold text-red-500">{stats.errors}</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm text-muted-foreground">当前显示</div>
                    <div className="text-2xl font-bold">{logs.length}</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm text-muted-foreground">最新日志</div>
                    <div className="text-sm">
                        {logs.length > 0 ? new Date(logs[logs.length - 1].timestamp).toLocaleTimeString() : '-'}
                    </div>
                </div>
            </div>

            {/* 工具栏 */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="搜索日志..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>

                <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as any)}>
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="所有级别" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">所有级别</SelectItem>
                        {Object.values(LogLevel).map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="所有分类" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">所有分类</SelectItem>
                        {Object.values(LogCategory).map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button variant="outline" size="icon" onClick={() => window.location.reload()} title="刷新页面">
                    <RefreshCw className="h-4 w-4" />
                </Button>

                <Button variant="outline" size="icon" onClick={handleDownloadJson} title="导出为JSON格式">
                    <FileJson className="h-4 w-4" />
                </Button>

                <Button variant="outline" size="icon" onClick={handleDownloadCsv} title="导出为CSV格式">
                    <FileSpreadsheet className="h-4 w-4" />
                </Button>

                <Button variant="destructive" size="icon" onClick={handleClearLogs} title="清空日志">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {/* 日志列表 */}
            <div className="flex flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
                <div className="flex-1 flex flex-col rounded-lg border bg-card overflow-hidden">
                    <div className="flex-1 overflow-auto">
                        <div className="p-2">
                            {logs.length === 0 ? (
                                <div className="flex h-40 items-center justify-center text-muted-foreground">
                                    没有找到日志
                                </div>
                            ) : (
                                logs.map((log) => (
                                    <div
                                        key={log.id}
                                        className={`mb-2 rounded-lg border p-3 transition-colors ${selectedLog?.id === log.id ? 'bg-accent' : ''
                                            }`}
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="flex flex-wrap items-start gap-2">
                                                <Badge className={`${getLevelColor(log.level)} text-white`}>
                                                    {log.level}
                                                </Badge>
                                                <Badge className={`${getCategoryColor(log.category)} text-white`}>
                                                    {log.category}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedLog(log)}
                                                className="h-7 text-xs"
                                            >
                                                详情
                                            </Button>
                                        </div>
                                        <div className="mt-2 text-sm line-clamp-2">{log.message}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* 日志详情 */}
                {selectedLog && (
                    <div className="flex w-full flex-col rounded-lg border bg-card lg:w-[600px] overflow-hidden">
                        <div className="flex items-center justify-between border-b p-4 flex-shrink-0">
                            <h3 className="text-lg font-semibold">日志详情</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLog(null)}
                                className="h-8 w-8 p-0"
                            >
                                ✕
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <div className="p-4 space-y-4 text-sm">
                                <div>
                                    <div className="mb-1 font-medium text-muted-foreground">ID</div>
                                    <div className="rounded bg-muted p-2 font-mono text-xs break-all">{selectedLog.id}</div>
                                </div>
                                <div>
                                    <div className="mb-1 font-medium text-muted-foreground">时间</div>
                                    <div className="rounded bg-muted p-2">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="mb-1 font-medium text-muted-foreground">级别</div>
                                    <Badge className={`${getLevelColor(selectedLog.level)} text-white`}>
                                        {selectedLog.level}
                                    </Badge>
                                </div>
                                <div>
                                    <div className="mb-1 font-medium text-muted-foreground">分类</div>
                                    <Badge className={`${getCategoryColor(selectedLog.category)} text-white`}>
                                        {selectedLog.category}
                                    </Badge>
                                </div>
                                <div>
                                    <div className="mb-1 font-medium text-muted-foreground">消息</div>
                                    <div className="rounded bg-muted p-3 whitespace-pre-wrap break-words overflow-auto max-h-96">
                                        {selectedLog.message}
                                    </div>
                                </div>
                                {selectedLog.data && (
                                    <div>
                                        <div className="mb-1 font-medium text-muted-foreground">数据</div>
                                        <pre className="overflow-auto rounded bg-muted p-3 text-xs max-h-96 whitespace-pre-wrap break-words">
                                            {JSON.stringify(selectedLog.data, null, 2)}
                                        </pre>
                                    </div>
                                )}
                                {selectedLog.stack && (
                                    <div>
                                        <div className="mb-1 font-medium text-muted-foreground">堆栈跟踪</div>
                                        <pre className="overflow-auto rounded bg-muted p-3 text-xs max-h-96 whitespace-pre-wrap break-words">
                                            {selectedLog.stack}
                                        </pre>
                                    </div>
                                )}
                                {selectedLog.url && (
                                    <div>
                                        <div className="mb-1 font-medium text-muted-foreground">URL</div>
                                        <div className="rounded bg-muted p-3 break-all text-xs">{selectedLog.url}</div>
                                    </div>
                                )}
                                {selectedLog.userAgent && (
                                    <div>
                                        <div className="mb-1 font-medium text-muted-foreground">User Agent</div>
                                        <div className="rounded bg-muted p-3 break-all text-xs">{selectedLog.userAgent}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
