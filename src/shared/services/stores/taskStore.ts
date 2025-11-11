/**
 * Task Store
 * Unified task management with support for both IndexedDB and Backend API
 * Includes WebSocket support for real-time updates
 */
import { create } from "zustand";
import { api } from "../api";
import { wsClient } from "../api/websocket";
import {
	useBackendTasks,
	useWebSocketUpdates,
} from "../../config/featureFlags";
import type {
	AuditTask,
	TaskCreate,
	TaskUpdate,
	TaskStatus,
	TaskPriority,
	WebSocketMessage,
	TaskProgressMessage,
} from "../../types/api";

interface TaskState {
	tasks: AuditTask[];
	currentTask: AuditTask | null;
	loading: boolean;
	error: string | null;

	// WebSocket connection state
	wsConnected: boolean;

	// Actions
	fetchTasks: (params?: {
		page?: number;
		page_size?: number;
		project_id?: number;
		status?: string;
		priority?: string;
	}) => Promise<void>;
	fetchTask: (id: number) => Promise<void>;
	createTask: (data: TaskCreate) => Promise<AuditTask>;
	updateTask: (id: number, data: TaskUpdate) => Promise<AuditTask>;
	cancelTask: (id: number) => Promise<void>;
	retryTask: (id: number) => Promise<void>;
	setCurrentTask: (task: AuditTask | null) => void;

	// WebSocket actions
	subscribeToTask: (taskId: number) => void;
	unsubscribeFromTask: (taskId: number) => void;
	handleTaskProgress: (message: TaskProgressMessage) => void;

	clearError: () => void;
}

/**
 * IndexedDB implementation (legacy)
 */
class IndexedDBTaskService {
	private dbName = "xcodereviewer_local";
	private storeName = "audit_tasks";

	private async getDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
	}

	async getAll(filters?: {
		project_id?: number;
		status?: string;
	}): Promise<AuditTask[]> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readonly");
			const store = transaction.objectStore(this.storeName);
			const request = store.getAll();

			request.onsuccess = () => {
				let results = request.result;

				// Apply filters
				if (filters?.project_id) {
					results = results.filter(
						(t: AuditTask) => t.project_id === filters.project_id,
					);
				}
				if (filters?.status) {
					results = results.filter(
						(t: AuditTask) => t.status === filters.status,
					);
				}

				resolve(results);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async getById(id: number): Promise<AuditTask | null> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readonly");
			const store = transaction.objectStore(this.storeName);
			const request = store.get(id);

			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	async create(data: TaskCreate): Promise<AuditTask> {
		const db = await this.getDB();
		const task: AuditTask = {
			id: Date.now(),
			...data,
			status: "pending" as TaskStatus,
			priority: data.priority || ("normal" as TaskPriority),
			progress: 0,
			total_issues: 0,
			critical_issues: 0,
			high_issues: 0,
			medium_issues: 0,
			low_issues: 0,
			overall_score: 0,
			retry_count: 0,
			created_at: new Date().toISOString(),
			created_by: 1,
			project_id: data.project_id,
		};

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const request = store.add(task);

			request.onsuccess = () => resolve(task);
			request.onerror = () => reject(request.error);
		});
	}

	async update(id: number, data: Partial<AuditTask>): Promise<AuditTask> {
		const existing = await this.getById(id);
		if (!existing) {
			throw new Error("Task not found");
		}

		const updated: AuditTask = {
			...existing,
			...data,
		};

		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const request = store.put(updated);

			request.onsuccess = () => resolve(updated);
			request.onerror = () => reject(request.error);
		});
	}

	async delete(id: number): Promise<void> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const request = store.delete(id);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}
}

const indexedDBService = new IndexedDBTaskService();

/**
 * Task Store with dual backend support and WebSocket integration
 */
export const useTaskStore = create<TaskState>((set, get) => ({
	tasks: [],
	currentTask: null,
	loading: false,
	error: null,
	wsConnected: false,

	fetchTasks: async (params) => {
		set({ loading: true, error: null });
		try {
			if (useBackendTasks()) {
				// Use backend API
				const response = await api.tasks.list(params);
				set({ tasks: response.items, loading: false });
			} else {
				// Use IndexedDB
				const tasks = await indexedDBService.getAll({
					project_id: params?.project_id,
					status: params?.status,
				});
				set({ tasks, loading: false });
			}
		} catch (error: any) {
			set({
				error: error.message || "Failed to fetch tasks",
				loading: false,
			});
		}
	},

	fetchTask: async (id) => {
		set({ loading: true, error: null });
		try {
			if (useBackendTasks()) {
				// Use backend API
				const task = await api.tasks.get(id);
				set({ currentTask: task, loading: false });

				// Subscribe to WebSocket updates if enabled
				if (useWebSocketUpdates()) {
					get().subscribeToTask(id);
				}
			} else {
				// Use IndexedDB
				const task = await indexedDBService.getById(id);
				set({ currentTask: task, loading: false });
			}
		} catch (error: any) {
			set({
				error: error.message || "Failed to fetch task",
				loading: false,
			});
		}
	},

	createTask: async (data) => {
		set({ loading: true, error: null });
		try {
			let task: AuditTask;

			if (useBackendTasks()) {
				// Use backend API
				task = await api.tasks.create(data);

				// Subscribe to WebSocket updates if enabled
				if (useWebSocketUpdates()) {
					get().subscribeToTask(task.id);
				}
			} else {
				// Use IndexedDB
				task = await indexedDBService.create(data);
			}

			// Add to state
			set((state) => ({
				tasks: [...state.tasks, task],
				loading: false,
			}));

			return task;
		} catch (error: any) {
			set({
				error: error.message || "Failed to create task",
				loading: false,
			});
			throw error;
		}
	},

	updateTask: async (id, data) => {
		set({ loading: true, error: null });
		try {
			let task: AuditTask;

			if (useBackendTasks()) {
				// Use backend API
				task = await api.tasks.update(id, data);
			} else {
				// Use IndexedDB
				task = await indexedDBService.update(id, data);
			}

			// Update in state
			set((state) => ({
				tasks: state.tasks.map((t) => (t.id === id ? task : t)),
				currentTask: state.currentTask?.id === id ? task : state.currentTask,
				loading: false,
			}));

			return task;
		} catch (error: any) {
			set({
				error: error.message || "Failed to update task",
				loading: false,
			});
			throw error;
		}
	},

	cancelTask: async (id) => {
		set({ loading: true, error: null });
		try {
			if (useBackendTasks()) {
				// Use backend API
				await api.tasks.cancel(id);

				// Update task status locally
				set((state) => ({
					tasks: state.tasks.map((t) =>
						t.id === id ? { ...t, status: "cancelled" as TaskStatus } : t,
					),
					currentTask:
						state.currentTask?.id === id
							? { ...state.currentTask, status: "cancelled" as TaskStatus }
							: state.currentTask,
					loading: false,
				}));
			} else {
				// Use IndexedDB
				await indexedDBService.update(id, {
					status: "cancelled" as TaskStatus,
				});

				set((state) => ({
					tasks: state.tasks.map((t) =>
						t.id === id ? { ...t, status: "cancelled" as TaskStatus } : t,
					),
					loading: false,
				}));
			}
		} catch (error: any) {
			set({
				error: error.message || "Failed to cancel task",
				loading: false,
			});
			throw error;
		}
	},

	retryTask: async (id) => {
		set({ loading: true, error: null });
		try {
			if (useBackendTasks()) {
				// Use backend API
				await api.tasks.retry(id);

				// Refresh task
				await get().fetchTask(id);
			} else {
				// Use IndexedDB - reset status
				await indexedDBService.update(id, {
					status: "pending" as TaskStatus,
					error_message: undefined,
				});

				await get().fetchTask(id);
			}
		} catch (error: any) {
			set({
				error: error.message || "Failed to retry task",
				loading: false,
			});
			throw error;
		}
	},

	setCurrentTask: (task) => {
		set({ currentTask: task });
	},

	// WebSocket methods
	subscribeToTask: (taskId) => {
		if (!useWebSocketUpdates()) return;

		if (!wsClient.isConnected()) {
			wsClient.connect();
		}

		wsClient.subscribeToTask(taskId);

		// Register progress handler
		wsClient.on("task_progress", (message: WebSocketMessage) => {
			get().handleTaskProgress(message.data as TaskProgressMessage);
		});

		set({ wsConnected: true });
	},

	unsubscribeFromTask: (taskId) => {
		if (!useWebSocketUpdates()) return;

		wsClient.unsubscribeFromTask(taskId);
	},

	handleTaskProgress: (data) => {
		// Update task in state with progress data
		set((state) => ({
			tasks: state.tasks.map((t) =>
				t.id === data.task_id
					? {
							...t,
							progress: data.progress,
							current_step: data.current_step,
							status: data.status,
						}
					: t,
			),
			currentTask:
				state.currentTask?.id === data.task_id
					? {
							...state.currentTask,
							progress: data.progress,
							current_step: data.current_step,
							status: data.status,
						}
					: state.currentTask,
		}));
	},

	clearError: () => {
		set({ error: null });
	},
}));
