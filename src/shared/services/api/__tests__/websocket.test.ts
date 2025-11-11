/**
 * WebSocket Client Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocketClient } from "../websocket";
import type {
	WebSocketMessage,
	WebSocketMessageType,
} from "../../../types/api";

// Mock WebSocket
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = MockWebSocket.CONNECTING;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(public url: string) {
		// Simulate connection after a short delay
		setTimeout(() => {
			this.readyState = MockWebSocket.OPEN;
			if (this.onopen) {
				this.onopen(new Event("open"));
			}
		}, 10);
	}

	send(data: string) {
		// Mock send
	}

	close(code?: number, reason?: string) {
		this.readyState = MockWebSocket.CLOSED;
		if (this.onclose) {
			this.onclose(new CloseEvent("close", { code, reason }));
		}
	}
}

global.WebSocket = MockWebSocket as any;

describe("WebSocketClient", () => {
	let client: WebSocketClient;

	beforeEach(() => {
		client = new WebSocketClient("/test");
		vi.useFakeTimers();
	});

	afterEach(() => {
		client.disconnect();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	describe("Connection", () => {
		it("should connect to WebSocket server", async () => {
			const connectHandler = vi.fn();
			client.onConnect(connectHandler);

			client.connect();

			// Wait for connection
			await vi.advanceTimersByTimeAsync(20);

			expect(client.isConnected()).toBe(true);
			expect(connectHandler).toHaveBeenCalled();
		});

		it("should disconnect from WebSocket server", async () => {
			const disconnectHandler = vi.fn();
			client.onDisconnect(disconnectHandler);

			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			client.disconnect();

			expect(client.isConnected()).toBe(false);
			expect(disconnectHandler).toHaveBeenCalled();
		});

		it("should not reconnect when intentionally disconnected", async () => {
			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			client.disconnect();

			// Try to advance time for reconnection
			await vi.advanceTimersByTimeAsync(5000);

			expect(client.isConnected()).toBe(false);
		});
	});

	describe("Message Handling", () => {
		it("should handle incoming messages", async () => {
			const messageHandler = vi.fn();
			client.on("task_progress" as WebSocketMessageType, messageHandler);

			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			// Simulate incoming message
			const message: WebSocketMessage = {
				type: "task_progress" as WebSocketMessageType,
				data: { task_id: 1, progress: 50 },
				timestamp: new Date().toISOString(),
			};

			const ws = (client as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(
					new MessageEvent("message", { data: JSON.stringify(message) }),
				);
			}

			expect(messageHandler).toHaveBeenCalledWith(message);
		});

		it("should handle multiple message handlers", async () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();

			client.on("task_progress" as WebSocketMessageType, handler1);
			client.on("task_progress" as WebSocketMessageType, handler2);

			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			const message: WebSocketMessage = {
				type: "task_progress" as WebSocketMessageType,
				data: { task_id: 1, progress: 50 },
				timestamp: new Date().toISOString(),
			};

			const ws = (client as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(
					new MessageEvent("message", { data: JSON.stringify(message) }),
				);
			}

			expect(handler1).toHaveBeenCalledWith(message);
			expect(handler2).toHaveBeenCalledWith(message);
		});

		it("should remove message handler", async () => {
			const messageHandler = vi.fn();
			const unsubscribe = client.on(
				"task_progress" as WebSocketMessageType,
				messageHandler,
			);

			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			// Unsubscribe
			unsubscribe();

			const message: WebSocketMessage = {
				type: "task_progress" as WebSocketMessageType,
				data: { task_id: 1, progress: 50 },
				timestamp: new Date().toISOString(),
			};

			const ws = (client as any).ws as MockWebSocket;
			if (ws.onmessage) {
				ws.onmessage(
					new MessageEvent("message", { data: JSON.stringify(message) }),
				);
			}

			expect(messageHandler).not.toHaveBeenCalled();
		});
	});

	describe("Task Subscription", () => {
		it("should subscribe to task updates", async () => {
			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			const sendSpy = vi.spyOn(client, "send");
			client.subscribeToTask(123);

			expect(sendSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "subscribe",
					data: { task_id: 123 },
				}),
			);
		});

		it("should unsubscribe from task updates", async () => {
			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			const sendSpy = vi.spyOn(client, "send");
			client.unsubscribeFromTask(123);

			expect(sendSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "unsubscribe",
					data: { task_id: 123 },
				}),
			);
		});
	});

	describe("Connection State", () => {
		it("should return correct connection state", async () => {
			expect(client.isConnected()).toBe(false);

			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			expect(client.isConnected()).toBe(true);

			client.disconnect();

			expect(client.isConnected()).toBe(false);
		});

		it("should return WebSocket state", async () => {
			client.connect();
			await vi.advanceTimersByTimeAsync(20);

			expect(client.getState()).toBe(MockWebSocket.OPEN);

			client.disconnect();

			expect(client.getState()).toBe(MockWebSocket.CLOSED);
		});
	});
});
