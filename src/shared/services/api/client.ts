/**
 * API Client
 * Centralized HTTP client for backend API communication
 */
import axios, {
	AxiosInstance,
	AxiosRequestConfig,
	AxiosResponse,
	AxiosError,
} from "axios";

// 使用代理模式，开发环境直接访问 /api，生产环境使用完整URL
const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ||
	(import.meta.env.DEV ? "/api/v1" : "http://localhost:8000/api/v1");

export interface ApiError {
	message: string;
	detail?: string;
	status?: number;
}

export class APIClient {
	private client: AxiosInstance;
	private accessToken: string | null = null;
	private refreshToken: string | null = null;
	private isRefreshing = false;
	private refreshSubscribers: ((token: string) => void)[] = [];

	constructor(baseURL: string = API_BASE_URL) {
		this.client = axios.create({
			baseURL,
			timeout: 30000,
			headers: {
				"Content-Type": "application/json",
			},
		});

		this.setupInterceptors();
		this.loadTokensFromStorage();
	}

	/**
	 * Load tokens from localStorage
	 */
	private loadTokensFromStorage(): void {
		this.accessToken = localStorage.getItem("access_token");
		this.refreshToken = localStorage.getItem("refresh_token");
	}

	/**
	 * Save tokens to localStorage
	 */
	private saveTokensToStorage(accessToken: string, refreshToken: string): void {
		this.accessToken = accessToken;
		this.refreshToken = refreshToken;
		localStorage.setItem("access_token", accessToken);
		localStorage.setItem("refresh_token", refreshToken);
	}

	/**
	 * Clear tokens from storage
	 */
	private clearTokensFromStorage(): void {
		this.accessToken = null;
		this.refreshToken = null;
		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
	}

	/**
	 * Setup request and response interceptors
	 */
	private setupInterceptors(): void {
		// Request interceptor - add auth token
		this.client.interceptors.request.use(
			(config) => {
				if (this.accessToken) {
					config.headers.Authorization = `Bearer ${this.accessToken}`;
				}
				return config;
			},
			(error) => Promise.reject(error),
		);

		// Response interceptor - handle token refresh
		this.client.interceptors.response.use(
			(response) => response,
			async (error: AxiosError) => {
				const originalRequest = error.config as AxiosRequestConfig & {
					_retry?: boolean;
				};
				const errorData = error.response?.data as any;

				// 检查是否是认证错误
				const isAuthError =
					error.response?.status === 401 ||
					errorData?.error?.code === "AUTHENTICATION_ERROR" ||
					errorData?.detail?.includes("token") ||
					errorData?.detail?.includes("expired") ||
					errorData?.detail?.includes("Invalid token");

				// If error is 401 or authentication error and we haven't retried yet
				if (isAuthError && !originalRequest._retry) {
					// 如果是 token 过期或签名失效，不尝试刷新，直接登出
					const isTokenExpired =
						errorData?.error?.message?.includes("expired") ||
						errorData?.error?.message?.includes("Signature has expired") ||
						errorData?.detail?.includes("expired");

					if (isTokenExpired) {
						this.isRefreshing = false;
						this.clearTokensFromStorage();
						// 触发登出事件，带上原因
						window.dispatchEvent(
							new CustomEvent("auth:logout", {
								detail: { reason: "token_expired" },
							}),
						);
						return Promise.reject(this.handleError(error));
					}

					// 尝试刷新 token
					if (this.isRefreshing) {
						// Wait for token refresh to complete
						return new Promise((resolve) => {
							this.refreshSubscribers.push((token: string) => {
								if (originalRequest.headers) {
									originalRequest.headers.Authorization = `Bearer ${token}`;
								}
								resolve(this.client(originalRequest));
							});
						});
					}

					originalRequest._retry = true;
					this.isRefreshing = true;

					try {
						const newAccessToken = await this.refreshAccessToken();
						this.isRefreshing = false;
						this.onRefreshSuccess(newAccessToken);

						if (originalRequest.headers) {
							originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
						}
						return this.client(originalRequest);
					} catch (refreshError) {
						this.isRefreshing = false;
						this.clearTokensFromStorage();
						// 触发登出事件
						window.dispatchEvent(
							new CustomEvent("auth:logout", {
								detail: { reason: "unauthorized" },
							}),
						);
						return Promise.reject(refreshError);
					}
				}

				return Promise.reject(this.handleError(error));
			},
		);
	}

	/**
	 * Refresh access token using refresh token
	 */
	private async refreshAccessToken(): Promise<string> {
		if (!this.refreshToken) {
			throw new Error("No refresh token available");
		}

		const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
			refresh_token: this.refreshToken,
		});

		const { access_token } = response.data;
		this.accessToken = access_token;
		localStorage.setItem("access_token", access_token);

		return access_token;
	}

	/**
	 * Notify all subscribers when token is refreshed
	 */
	private onRefreshSuccess(token: string): void {
		this.refreshSubscribers.forEach((callback) => callback(token));
		this.refreshSubscribers = [];
	}

	/**
	 * Handle API errors
	 */
	private handleError(error: AxiosError): ApiError {
		if (error.response) {
			// Server responded with error
			const data = error.response.data as any;
			return {
				message: data.message || data.detail || "An error occurred",
				detail: data.detail,
				status: error.response.status,
			};
		} else if (error.request) {
			// Request made but no response
			return {
				message: "No response from server",
				detail: "Please check your network connection",
			};
		} else {
			// Error setting up request
			return {
				message: error.message || "Request failed",
			};
		}
	}

	/**
	 * Set authentication tokens
	 */
	setTokens(accessToken: string, refreshToken: string): void {
		this.saveTokensToStorage(accessToken, refreshToken);
	}

	/**
	 * Clear authentication tokens
	 */
	clearTokens(): void {
		this.clearTokensFromStorage();
	}

	/**
	 * Check if user is authenticated
	 */
	isAuthenticated(): boolean {
		return !!this.accessToken;
	}

	/**
	 * GET request
	 */
	async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
		const response: AxiosResponse<T> = await this.client.get(url, config);
		return response.data;
	}

	/**
	 * POST request
	 */
	async post<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<T> {
		const response: AxiosResponse<T> = await this.client.post(
			url,
			data,
			config,
		);
		return response.data;
	}

	/**
	 * PUT request
	 */
	async put<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<T> {
		const response: AxiosResponse<T> = await this.client.put(url, data, config);
		return response.data;
	}

	/**
	 * PATCH request
	 */
	async patch<T = any>(
		url: string,
		data?: any,
		config?: AxiosRequestConfig,
	): Promise<T> {
		const response: AxiosResponse<T> = await this.client.patch(
			url,
			data,
			config,
		);
		return response.data;
	}

	/**
	 * DELETE request
	 */
	async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
		const response: AxiosResponse<T> = await this.client.delete(url, config);
		return response.data;
	}

	/**
	 * Upload file with progress tracking
	 */
	async upload<T = any>(
		url: string,
		file: File,
		onProgress?: (progress: number) => void,
	): Promise<T> {
		const formData = new FormData();
		formData.append("file", file);

		const response: AxiosResponse<T> = await this.client.post(url, formData, {
			headers: {
				"Content-Type": "multipart/form-data",
			},
			onUploadProgress: (progressEvent) => {
				if (onProgress && progressEvent.total) {
					const progress = Math.round(
						(progressEvent.loaded * 100) / progressEvent.total,
					);
					onProgress(progress);
				}
			},
		});

		return response.data;
	}

	/**
	 * Download file
	 */
	async download(url: string, filename?: string): Promise<void> {
		const response = await this.client.get(url, {
			responseType: "blob",
		});

		const blob = new Blob([response.data]);
		const downloadUrl = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = downloadUrl;
		link.download = filename || "download";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(downloadUrl);
	}
}

// Export singleton instance
export const apiClient = new APIClient();
