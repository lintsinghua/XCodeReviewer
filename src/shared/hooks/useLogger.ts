/**
 * 日志记录 Hook
 */

import { useEffect, useCallback, useState } from "react";
import { logger, LogEntry, LogLevel, LogCategory } from "../utils/logger";

export function useLogger() {
	const logUserAction = useCallback((action: string, details?: any) => {
		logger.logUserAction(action, details);
	}, []);

	const logApiCall = useCallback(
		(
			method: string,
			url: string,
			status?: number,
			duration?: number,
			error?: any,
		) => {
			logger.logApiCall(method, url, status, duration, error);
		},
		[],
	);

	const logPerformance = useCallback(
		(metric: string, value: number, unit?: string) => {
			logger.logPerformance(metric, value, unit);
		},
		[],
	);

	return {
		debug: logger.debug.bind(logger),
		info: logger.info.bind(logger),
		warn: logger.warn.bind(logger),
		error: logger.error.bind(logger),
		fatal: logger.fatal.bind(logger),
		logUserAction,
		logApiCall,
		logPerformance,
	};
}

export function useLogListener(callback: (log: LogEntry) => void) {
	useEffect(() => {
		const unsubscribe = logger.addListener(callback);
		return () => {
			unsubscribe();
		};
	}, [callback]);
}

export function useLogs(filter?: {
	level?: LogLevel;
	category?: LogCategory;
	startTime?: number;
	endTime?: number;
	search?: string;
}) {
	const [logs, setLogs] = useState<LogEntry[]>(() => logger.getLogs(filter));

	// 将filter转换为字符串作为依赖，避免对象引用问题
	const filterKey = JSON.stringify(filter);

	useEffect(() => {
		// 立即更新一次
		setLogs(logger.getLogs(filter));

		const updateLogs = () => {
			setLogs(logger.getLogs(filter));
		};

		const unsubscribe = logger.addListener(updateLogs);
		return () => {
			unsubscribe();
		};
	}, [filterKey]); // 使用filterKey而不是filter对象

	return logs;
}

export function useLogStats() {
	const [stats, setStats] = useState(() => logger.getStats());

	useEffect(() => {
		const updateStats = () => {
			setStats(logger.getStats());
		};

		const unsubscribe = logger.addListener(updateStats);
		return () => {
			unsubscribe();
		};
	}, []);

	return stats;
}
