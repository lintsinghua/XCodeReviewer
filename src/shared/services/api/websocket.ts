/**
 * WebSocket Client
 * Real-time communication with backend for task progress updates
 */
import type {
	WebSocketMessage,
	TaskProgressMessage,
	WebSocketMessageType,
} from "../../types/api";

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";

export type MessageHandler = (message: WebSocketMessage) => void;
export type ErrorHandler = (error: Event) => void;
export type ConnectionHandler = () => void;

export class WebSocketClient {
	private ws: WebSocket | null = null;
	private url: string;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private reconnectTimer: number | null = null;
	private pingInterval: number | null = null;
	private messageHandlers: Map<WebSocketMessageType, MessageHandler[]> =
		new Map();
	private errorHandlers: ErrorHandler[] = [];
	private connectHandlers: ConnectionHandler[] = [];
	private disconnectHandlers: ConnectionHandler[] = [];
	private isIntentionallyClosed = false;

	constructor(endpoint: string = "/ws") {
		this.url = `${WS_BASE_URL}${endpoint}`;
	}

	/**
	 * Connect to WebSocket server
	 */
	connect(token?: string): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			console.warn("WebSocket already connected");
			return;
		}

		this.isIntentionallyClosed = false;
		const url = token ? `${this.url}?token=${token}` : this.url;

		try {
			this.ws = new WebSocket(url);
			this.setupEventHandlers();
		} catch (error) {
			console.error("Failed to create WebSocket connection:", error);
			this.scheduleReconnect();
		}
	}

	/**
	 * Setup WebSocket event handlers
	 */
	private setupEventHandlers(): void {
		if (!this.ws) return;

		this.ws.onopen = () => {
			console.log("WebSocket connected");
			this.reconnectAttempts = 0;
			this.startPingInterval();
			this.connectHandlers.forEach((handler) => handler());
		};

		this.ws.onmessage = (event) => {
			try {
				const message: WebSocketMessage = JSON.parse(event.data);
				this.handleMessage(message);
			} catch (error) {
				console.error("Failed to parse WebSocket message:", error);
			}
		};

		this.ws.onerror = (error) => {
			console.error("WebSocket error:", error);
			this.errorHandlers.forEach((handler) => handler(error));
		};

		this.ws.onclose = (event) => {
			console.log("WebSocket disconnected:", event.code, event.reason);
			this.stopPingInterval();
			this.disconnectHandlers.forEach((handler) => handler());

			if (!this.isIntentionallyClosed) {
				this.scheduleReconnect();
			}
		};
	}

	/**
	 * Handle incoming message
	 */
	private handleMessage(message: WebSocketMessage): void {
		const handlers = this.messageHandlers.get(message.type);
		if (handlers) {
			handlers.forEach((handler) => handler(message));
		}

		// Also trigger handlers for all message types
		const allHandlers = this.messageHandlers.get("*" as WebSocketMessageType);
		if (allHandlers) {
			allHandlers.forEach((handler) => handler(message));
		}
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error("Max reconnection attempts reached");
			return;
		}

		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
		console.log(
			`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`,
		);

		this.reconnectTimer = window.setTimeout(() => {
			this.reconnectAttempts++;
			this.connect();
		}, delay);
	}

	/**
	 * Start ping interval to keep connection alive
	 */
	private startPingInterval(): void {
		this.pingInterval = window.setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.send({
					type: "ping" as WebSocketMessageType,
					data: {},
					timestamp: new Date().toISOString(),
				});
			}
		}, 30000); // Ping every 30 seconds
	}

	/**
	 * Stop ping interval
	 */
	private stopPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	/**
	 * Send message to server
	 */
	send(message: WebSocketMessage): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			console.warn("WebSocket not connected, cannot send message");
		}
	}

	/**
	 * Subscribe to task progress updates
	 */
	subscribeToTask(taskId: number): void {
		this.send({
			type: "subscribe" as WebSocketMessageType,
			data: { task_id: taskId },
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Unsubscribe from task progress updates
	 */
	unsubscribeFromTask(taskId: number): void {
		this.send({
			type: "unsubscribe" as WebSocketMessageType,
			data: { task_id: taskId },
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Register message handler for specific message type
	 */
	on(type: WebSocketMessageType | "*", handler: MessageHandler): () => void {
		const handlers =
			this.messageHandlers.get(type as WebSocketMessageType) || [];
		handlers.push(handler);
		this.messageHandlers.set(type as WebSocketMessageType, handlers);

		// Return unsubscribe function
		return () => this.off(type, handler);
	}

	/**
	 * Remove message handler
	 */
	off(type: WebSocketMessageType | "*", handler: MessageHandler): void {
		const handlers = this.messageHandlers.get(type as WebSocketMessageType);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		}
	}

	/**
	 * Register error handler
	 */
	onError(handler: ErrorHandler): () => void {
		this.errorHandlers.push(handler);
		return () => {
			const index = this.errorHandlers.indexOf(handler);
			if (index > -1) {
				this.errorHandlers.splice(index, 1);
			}
		};
	}

	/**
	 * Register connect handler
	 */
	onConnect(handler: ConnectionHandler): () => void {
		this.connectHandlers.push(handler);
		return () => {
			const index = this.connectHandlers.indexOf(handler);
			if (index > -1) {
				this.connectHandlers.splice(index, 1);
			}
		};
	}

	/**
	 * Register disconnect handler
	 */
	onDisconnect(handler: ConnectionHandler): () => void {
		this.disconnectHandlers.push(handler);
		return () => {
			const index = this.disconnectHandlers.indexOf(handler);
			if (index > -1) {
				this.disconnectHandlers.splice(index, 1);
			}
		};
	}

	/**
	 * Close WebSocket connection
	 */
	disconnect(): void {
		this.isIntentionallyClosed = true;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.stopPingInterval();

		if (this.ws) {
			this.ws.close(1000, "Client disconnect");
			this.ws = null;
		}
	}

	/**
	 * Check if WebSocket is connected
	 */
	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	/**
	 * Get connection state
	 */
	getState(): number {
		return this.ws?.readyState ?? WebSocket.CLOSED;
	}
}

// Export singleton instance
export const wsClient = new WebSocketClient("/ws/tasks");

// Helper hook for React components
export function useTaskProgress(
	taskId: number,
	onProgress: (data: TaskProgressMessage) => void,
) {
	const handleMessage = (message: WebSocketMessage) => {
		if (message.data.task_id === taskId) {
			onProgress(message.data as TaskProgressMessage);
		}
	};

	// Subscribe on mount
	if (wsClient.isConnected()) {
		wsClient.subscribeToTask(taskId);
	} else {
		wsClient.connect();
		wsClient.onConnect(() => {
			wsClient.subscribeToTask(taskId);
		});
	}

	// Register handler
	const unsubscribe = wsClient.on(
		"task_progress" as WebSocketMessageType,
		handleMessage,
	);

	// Cleanup function
	return () => {
		wsClient.unsubscribeFromTask(taskId);
		unsubscribe();
	};
}
