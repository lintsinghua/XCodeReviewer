/**
 * 认证服务
 * 管理用户认证状态、Token 存储和自动刷新
 */

import { api as backendApi } from "./api";
import type { AuthResponse, User, RegisterRequest } from "../types/auth";

const TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "current_user";

class AuthService {
	private refreshTimer: NodeJS.Timeout | null = null;

	/**
	 * 用户登录
	 */
	async login(username: string, password: string): Promise<AuthResponse> {
		try {
			const response = await backendApi.auth.login(username, password);

			// 保存 tokens
			this.saveTokens(response.access_token, response.refresh_token);

			// 获取用户信息
			try {
				const user = await this.getCurrentUser();
				this.saveUser(user);
			} catch (error) {
				console.warn("获取用户信息失败:", error);
			}

			// 启动token自动刷新
			this.startTokenRefresh();

			// 触发登录事件，通知其他组件更新状态
			window.dispatchEvent(new CustomEvent("auth:login"));

			return response;
		} catch (error: any) {
			console.error("登录失败:", error);
			throw new Error(
				error.response?.data?.detail || "登录失败，请检查用户名和密码",
			);
		}
	}

	/**
	 * 用户注册
	 */
	async register(data: RegisterRequest): Promise<User> {
		try {
			const user = await backendApi.auth.register(data);

			// 注册成功后自动登录
			await this.login(data.username, data.password);

			return user;
		} catch (error: any) {
			console.error("注册失败:", error);
			const message = error.response?.data?.detail || "注册失败";
			throw new Error(message);
		}
	}

	/**
	 * 用户登出
	 */
	async logout(): Promise<void> {
		try {
			await backendApi.auth.logout();
		} catch (error) {
			console.error("登出API调用失败:", error);
		} finally {
			this.clearAuth();
			// 触发登出事件
			window.dispatchEvent(new CustomEvent("auth:logout"));
		}
	}

	/**
	 * 刷新 Access Token
	 */
	async refreshAccessToken(): Promise<boolean> {
		const refreshToken = this.getRefreshToken();

		if (!refreshToken) {
			this.clearAuth();
			window.dispatchEvent(
				new CustomEvent("auth:logout", {
					detail: { reason: "no_refresh_token" },
				}),
			);
			return false;
		}

		try {
			const response = await backendApi.auth.refreshToken(refreshToken);
			this.saveTokens(response.access_token, response.refresh_token);
			return true;
		} catch (error: any) {
			console.error("刷新token失败:", error);
			this.clearAuth();

			// 触发登出事件
			const isExpired =
				error.response?.data?.error?.message?.includes("expired") ||
				error.response?.data?.detail?.includes("expired");
			window.dispatchEvent(
				new CustomEvent("auth:logout", {
					detail: { reason: isExpired ? "token_expired" : "refresh_failed" },
				}),
			);
			return false;
		}
	}

	/**
	 * 获取当前用户信息
	 */
	async getCurrentUser(): Promise<User> {
		try {
			const user = await backendApi.auth.getCurrentUser();
			this.saveUser(user);
			return user;
		} catch (error) {
			console.error("获取用户信息失败:", error);
			throw error;
		}
	}

	/**
	 * 检查是否已认证
	 */
	isAuthenticated(): boolean {
		return !!this.getAccessToken();
	}

	/**
	 * 获取Access Token
	 */
	getAccessToken(): string | null {
		return localStorage.getItem(TOKEN_KEY);
	}

	/**
	 * 获取Refresh Token
	 */
	getRefreshToken(): string | null {
		return localStorage.getItem(REFRESH_TOKEN_KEY);
	}

	/**
	 * 获取已保存的用户信息
	 */
	getSavedUser(): User | null {
		try {
			const userStr = localStorage.getItem(USER_KEY);
			return userStr ? JSON.parse(userStr) : null;
		} catch {
			return null;
		}
	}

	/**
	 * 保存 Tokens
	 */
	private saveTokens(accessToken: string, refreshToken: string): void {
		localStorage.setItem(TOKEN_KEY, accessToken);
		localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
	}

	/**
	 * 保存用户信息
	 */
	private saveUser(user: User): void {
		localStorage.setItem(USER_KEY, JSON.stringify(user));
	}

	/**
	 * 清除认证信息
	 */
	private clearAuth(): void {
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(REFRESH_TOKEN_KEY);
		localStorage.removeItem(USER_KEY);
		this.stopTokenRefresh();
	}

	/**
	 * 启动Token自动刷新
	 * Token在过期前5分钟自动刷新
	 */
	private startTokenRefresh(): void {
		// 清除现有定时器
		this.stopTokenRefresh();

		// 每15分钟检查一次token是否需要刷新
		// （假设token有效期为30分钟）
		this.refreshTimer = setInterval(
			async () => {
				if (this.isAuthenticated()) {
					await this.refreshAccessToken();
				}
			},
			15 * 60 * 1000,
		); // 15分钟
	}

	/**
	 * 停止Token自动刷新
	 */
	private stopTokenRefresh(): void {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	/**
	 * 检查并刷新token（如果需要）
	 */
	async checkAndRefreshToken(): Promise<void> {
		if (!this.isAuthenticated()) {
			return;
		}

		try {
			// 尝试获取用户信息来验证token是否有效
			await this.getCurrentUser();
		} catch (error: any) {
			const errorData = error.response?.data;

			// 检查是否是认证错误
			const isAuthError =
				error.response?.status === 401 ||
				errorData?.error?.code === "AUTHENTICATION_ERROR";

			if (isAuthError) {
				// 检查是否是 token 过期
				const isExpired =
					errorData?.error?.message?.includes("expired") ||
					errorData?.error?.message?.includes("Signature has expired") ||
					errorData?.detail?.includes("expired");

				if (isExpired) {
					// Token 已过期，直接清除并触发登出
					this.clearAuth();
					window.dispatchEvent(
						new CustomEvent("auth:logout", {
							detail: { reason: "token_expired" },
						}),
					);
				} else {
					// 其他认证错误，尝试刷新 token
					const success = await this.refreshAccessToken();
					if (!success) {
						// 刷新失败，清除认证信息
						this.clearAuth();
						window.dispatchEvent(
							new CustomEvent("auth:logout", {
								detail: { reason: "unauthorized" },
							}),
						);
					}
				}
			}
		}
	}
}

// 导出单例
export const authService = new AuthService();
export default authService;
