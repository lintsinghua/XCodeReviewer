/**
 * 性能监控模块
 */

import { logger } from "./logger";

class PerformanceMonitor {
	private marks = new Map<string, number>();

	/**
	 * 开始计时
	 */
	start(label: string) {
		this.marks.set(label, performance.now());
	}

	/**
	 * 结束计时并记录
	 */
	end(label: string, logToConsole = false) {
		const startTime = this.marks.get(label);
		if (!startTime) {
			console.warn(`Performance mark "${label}" not found`);
			return 0;
		}

		const duration = performance.now() - startTime;
		this.marks.delete(label);

		logger.logPerformance(label, Math.round(duration));

		if (logToConsole) {
			console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
		}

		return duration;
	}

	/**
	 * 测量函数执行时间
	 */
	async measure<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
		this.start(label);
		try {
			const result = await fn();
			this.end(label);
			return result;
		} catch (error) {
			this.end(label);
			throw error;
		}
	}

	/**
	 * 监控页面性能指标 - 禁用自动监控
	 */
	monitorPagePerformance() {
		// 不自动记录页面性能，只在需要时手动调用
		return;
	}

	/**
	 * 监控资源加载 - 禁用
	 */
	monitorResourceLoading() {
		// 不记录资源加载
		return;
	}

	/**
	 * 监控内存使用 - 禁用
	 */
	monitorMemory() {
		// 不记录内存使用
		return;
	}

	/**
	 * 监控长任务 - 禁用
	 */
	monitorLongTasks() {
		// 不记录长任务
		return;
	}

	/**
	 * 初始化所有监控
	 */
	initAll() {
		this.monitorPagePerformance();
		this.monitorResourceLoading();
		this.monitorMemory();
		this.monitorLongTasks();
	}
}

export const performanceMonitor = new PerformanceMonitor();
