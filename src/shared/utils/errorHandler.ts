/**
 * 错误处理模块
 * 提供统一的错误处理和用户反馈机制
 */

import { toast } from "sonner";
import { logger, LogCategory } from "./logger";

export enum ErrorType {
	NETWORK = "NETWORK",
	API = "API",
	VALIDATION = "VALIDATION",
	AUTHENTICATION = "AUTHENTICATION",
	AUTHORIZATION = "AUTHORIZATION",
	NOT_FOUND = "NOT_FOUND",
	TIMEOUT = "TIMEOUT",
	UNKNOWN = "UNKNOWN",
}

export interface AppError {
	type: ErrorType;
	message: string;
	originalError?: any;
	code?: string | number;
	details?: any;
	timestamp: number;
}

class ErrorHandler {
	/**
	 * 处理错误并显示用户友好的提示
	 */
	handle(error: any, context?: string): AppError {
		const appError = this.parseError(error);

		// 记录错误日志
		logger.error(
			LogCategory.SYSTEM,
			`${context ? `[${context}] ` : ""}${appError.message}`,
			{
				type: appError.type,
				code: appError.code,
				details: appError.details,
				originalError: error,
			},
			error?.stack,
		);

		// 显示用户提示
		this.showErrorToast(appError, context);

		return appError;
	}

	/**
	 * 解析错误对象
	 */
	private parseError(error: any): AppError {
		const timestamp = Date.now();

		// Axios错误
		if (error?.isAxiosError || error?.response) {
			return this.parseAxiosError(error, timestamp);
		}

		// Fetch错误
		if (error instanceof TypeError && error.message.includes("fetch")) {
			return {
				type: ErrorType.NETWORK,
				message: "网络连接失败，请检查网络设置",
				originalError: error,
				timestamp,
			};
		}

		// 自定义AppError
		if (error?.type && Object.values(ErrorType).includes(error.type)) {
			return { ...error, timestamp };
		}

		// 标准Error对象
		if (error instanceof Error) {
			return {
				type: ErrorType.UNKNOWN,
				message: error.message || "发生未知错误",
				originalError: error,
				timestamp,
			};
		}

		// 其他类型
		return {
			type: ErrorType.UNKNOWN,
			message: typeof error === "string" ? error : "发生未知错误",
			originalError: error,
			timestamp,
		};
	}

	/**
	 * 解析Axios错误
	 */
	private parseAxiosError(error: any, timestamp: number): AppError {
		const response = error.response;
		const status = response?.status;

		// 网络错误
		if (!response) {
			return {
				type: ErrorType.NETWORK,
				message: "网络请求失败，请检查网络连接",
				originalError: error,
				timestamp,
			};
		}

		// 根据状态码分类
		switch (status) {
			case 400:
				return {
					type: ErrorType.VALIDATION,
					message: response.data?.message || "请求参数错误",
					code: status,
					details: response.data,
					originalError: error,
					timestamp,
				};

			case 401:
				return {
					type: ErrorType.AUTHENTICATION,
					message: "未登录或登录已过期，请重新登录",
					code: status,
					originalError: error,
					timestamp,
				};

			case 403:
				return {
					type: ErrorType.AUTHORIZATION,
					message: "没有权限执行此操作",
					code: status,
					originalError: error,
					timestamp,
				};

			case 404:
				return {
					type: ErrorType.NOT_FOUND,
					message: "请求的资源不存在",
					code: status,
					originalError: error,
					timestamp,
				};

			case 408:
			case 504:
				return {
					type: ErrorType.TIMEOUT,
					message: "请求超时，请稍后重试",
					code: status,
					originalError: error,
					timestamp,
				};

			case 500:
			case 502:
			case 503:
				return {
					type: ErrorType.API,
					message: "服务器错误，请稍后重试",
					code: status,
					details: response.data,
					originalError: error,
					timestamp,
				};

			default:
				return {
					type: ErrorType.API,
					message: response.data?.message || `请求失败 (${status})`,
					code: status,
					details: response.data,
					originalError: error,
					timestamp,
				};
		}
	}

	/**
	 * 显示错误提示
	 */
	private showErrorToast(error: AppError, context?: string) {
		const title = context || this.getErrorTitle(error.type);

		toast.error(title, {
			description: error.message,
			duration: 5000,
			action: error.code
				? {
						label: "查看详情",
						onClick: () => this.showErrorDetails(error),
					}
				: undefined,
		});
	}

	/**
	 * 获取错误标题
	 */
	private getErrorTitle(type: ErrorType): string {
		const titles = {
			[ErrorType.NETWORK]: "网络错误",
			[ErrorType.API]: "API错误",
			[ErrorType.VALIDATION]: "验证错误",
			[ErrorType.AUTHENTICATION]: "认证错误",
			[ErrorType.AUTHORIZATION]: "权限错误",
			[ErrorType.NOT_FOUND]: "资源不存在",
			[ErrorType.TIMEOUT]: "请求超时",
			[ErrorType.UNKNOWN]: "未知错误",
		};
		return titles[type];
	}

	/**
	 * 显示错误详情
	 */
	private showErrorDetails(error: AppError) {
		console.group("错误详情");
		console.log("类型:", error.type);
		console.log("消息:", error.message);
		console.log("代码:", error.code);
		console.log("时间:", new Date(error.timestamp).toLocaleString());
		if (error.details) {
			console.log("详情:", error.details);
		}
		if (error.originalError) {
			console.log("原始错误:", error.originalError);
		}
		console.groupEnd();
	}

	/**
	 * 创建错误
	 */
	createError(type: ErrorType, message: string, details?: any): AppError {
		return {
			type,
			message,
			details,
			timestamp: Date.now(),
		};
	}

	/**
	 * 异步函数错误包装器
	 */
	async wrap<T>(
		fn: () => Promise<T>,
		context?: string,
		options?: {
			silent?: boolean;
			fallback?: T;
		},
	): Promise<T | undefined> {
		try {
			return await fn();
		} catch (error) {
			if (!options?.silent) {
				this.handle(error, context);
			} else {
				logger.error(LogCategory.SYSTEM, `${context || "Error"}: ${error}`, {
					error,
				});
			}
			return options?.fallback;
		}
	}

	/**
	 * 同步函数错误包装器
	 */
	wrapSync<T>(
		fn: () => T,
		context?: string,
		options?: {
			silent?: boolean;
			fallback?: T;
		},
	): T | undefined {
		try {
			return fn();
		} catch (error) {
			if (!options?.silent) {
				this.handle(error, context);
			} else {
				logger.error(LogCategory.SYSTEM, `${context || "Error"}: ${error}`, {
					error,
				});
			}
			return options?.fallback;
		}
	}
}

// 导出单例
export const errorHandler = new ErrorHandler();

// 便捷函数
export const handleError = (error: any, context?: string) =>
	errorHandler.handle(error, context);
export const wrapAsync = <T>(
	fn: () => Promise<T>,
	context?: string,
	options?: any,
) => errorHandler.wrap(fn, context, options);
export const wrapSync = <T>(fn: () => T, context?: string, options?: any) =>
	errorHandler.wrapSync(fn, context, options);
