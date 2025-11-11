/**
 * React错误边界组件
 * 捕获组件树中的JavaScript错误并记录
 */

import React, { Component, ReactNode } from "react";
import { logger, LogCategory } from "@/shared/utils/logger";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<State> {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// 记录错误到日志系统
		logger.error(
			LogCategory.CONSOLE_ERROR,
			`React组件错误: ${error.message}`,
			{
				error: error.toString(),
				componentStack: errorInfo.componentStack,
			},
			error.stack,
		);

		this.setState({
			errorInfo,
		});

		// 调用自定义错误处理
		this.props.onError?.(error, errorInfo);
	}

	handleReset = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	handleReload = () => {
		window.location.reload();
	};

	handleGoHome = () => {
		window.location.href = "/";
	};

	render() {
		if (this.state.hasError) {
			// 如果提供了自定义fallback，使用它
			if (this.props.fallback) {
				return this.props.fallback;
			}

			// 默认错误UI
			return (
				<div className="flex min-h-screen items-center justify-center bg-background p-4">
					<div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-lg">
						<div className="flex items-center gap-3">
							<div className="rounded-full bg-destructive/10 p-3">
								<AlertTriangle className="h-6 w-6 text-destructive" />
							</div>
							<div>
								<h2 className="text-xl font-semibold">出错了</h2>
								<p className="text-sm text-muted-foreground">
									应用遇到了一个错误
								</p>
							</div>
						</div>

						{this.state.error && (
							<div className="space-y-2">
								<div className="rounded-md bg-destructive/10 p-3">
									<p className="text-sm font-medium text-destructive">
										{this.state.error.message}
									</p>
								</div>

								{import.meta.env.DEV && this.state.error.stack && (
									<details className="text-xs">
										<summary className="cursor-pointer font-medium text-muted-foreground">
											查看错误堆栈
										</summary>
										<pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
											{this.state.error.stack}
										</pre>
									</details>
								)}

								{import.meta.env.DEV &&
									this.state.errorInfo?.componentStack && (
										<details className="text-xs">
											<summary className="cursor-pointer font-medium text-muted-foreground">
												查看组件堆栈
											</summary>
											<pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
												{this.state.errorInfo.componentStack}
											</pre>
										</details>
									)}
							</div>
						)}

						<div className="flex gap-2">
							<Button
								onClick={this.handleReset}
								variant="outline"
								className="flex-1"
							>
								<RefreshCw className="mr-2 h-4 w-4" />
								重试
							</Button>
							<Button
								onClick={this.handleGoHome}
								variant="outline"
								className="flex-1"
							>
								<Home className="mr-2 h-4 w-4" />
								返回首页
							</Button>
							<Button onClick={this.handleReload} className="flex-1">
								刷新页面
							</Button>
						</div>

						<p className="text-center text-xs text-muted-foreground">
							错误已被记录，我们会尽快修复
						</p>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

/**
 * 高阶组件：为组件添加错误边界
 */
export function withErrorBoundary<P extends object>(
	Component: React.ComponentType<P>,
	fallback?: ReactNode,
) {
	return function WithErrorBoundaryComponent(props: P) {
		return (
			<ErrorBoundary fallback={fallback}>
				<Component {...props} />
			</ErrorBoundary>
		);
	};
}
