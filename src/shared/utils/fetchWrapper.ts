/**
 * Fetch包装器 - 只记录失败的API调用
 */

import { logger, LogCategory } from "./logger";

const originalFetch = window.fetch;

/**
 * 判断是否应该记录该URL
 */
function shouldLogUrl(url: string): boolean {
	// 过滤掉静态资源和某些不需要记录的请求
	const skipPatterns = [
		/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i,
		/\/assets\//,
		/chrome-extension:/,
		/localhost:.*\/node_modules/,
	];

	return !skipPatterns.some((pattern) => pattern.test(url));
}

/**
 * 包装fetch - 只记录错误
 */
window.fetch = async function (
	...args: Parameters<typeof fetch>
): Promise<Response> {
	const [url, options] = args;
	const method = options?.method || "GET";
	const urlString = typeof url === "string" ? url : url.toString();

	// 跳过不需要记录的URL
	if (!shouldLogUrl(urlString)) {
		return originalFetch(...args);
	}

	const startTime = Date.now();

	try {
		const response = await originalFetch(...args);
		const duration = Date.now() - startTime;

		// 只记录失败的请求
		if (!response.ok) {
			logger.error(
				LogCategory.API_CALL,
				`API请求失败: ${method} ${urlString} (${response.status})`,
				{
					method,
					url: urlString,
					status: response.status,
					statusText: response.statusText,
					duration,
				},
			);
		}

		return response;
	} catch (error) {
		const duration = Date.now() - startTime;

		// 记录网络错误
		logger.error(
			LogCategory.API_CALL,
			`API请求异常: ${method} ${urlString}`,
			{
				method,
				url: urlString,
				duration,
				error: error instanceof Error ? error.message : String(error),
			},
			error instanceof Error ? error.stack : undefined,
		);

		throw error;
	}
};

export { originalFetch };
