/**
 * Data Synchronization Service
 * Handles offline operations and conflict resolution between IndexedDB and Backend API
 */
import { api } from "../api";
import type { Project, AuditTask, AuditIssue } from "../../types/api";

interface SyncOperation {
	id: string;
	type: "create" | "update" | "delete";
	entity: "project" | "task" | "issue";
	entityId?: number;
	data: any;
	timestamp: number;
	retryCount: number;
}

interface SyncResult {
	success: boolean;
	synced: number;
	failed: number;
	errors: Array<{ operation: SyncOperation; error: string }>;
}

interface ConflictResolution {
	strategy: "local" | "remote" | "merge" | "manual";
	localData: any;
	remoteData: any;
	resolvedData?: any;
}

class SyncService {
	private dbName = "xcodereviewer_sync";
	private storeName = "pending_operations";
	private maxRetries = 3;
	private syncInProgress = false;

	/**
	 * Initialize sync database
	 */
	private async getDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					const store = db.createObjectStore(this.storeName, { keyPath: "id" });
					store.createIndex("timestamp", "timestamp", { unique: false });
					store.createIndex("entity", "entity", { unique: false });
				}
			};
		});
	}

	/**
	 * Queue an operation for later sync
	 */
	async queueOperation(
		operation: Omit<SyncOperation, "id" | "timestamp" | "retryCount">,
	): Promise<void> {
		const db = await this.getDB();
		const fullOperation: SyncOperation = {
			...operation,
			id: `${operation.entity}_${operation.type}_${Date.now()}_${Math.random()}`,
			timestamp: Date.now(),
			retryCount: 0,
		};

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const request = store.add(fullOperation);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get all pending operations
	 */
	async getPendingOperations(): Promise<SyncOperation[]> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readonly");
			const store = transaction.objectStore(this.storeName);
			const request = store.getAll();

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Remove operation from queue
	 */
	async removeOperation(operationId: string): Promise<void> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const request = store.delete(operationId);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Update operation retry count
	 */
	async updateOperationRetry(operation: SyncOperation): Promise<void> {
		const db = await this.getDB();
		const updated = { ...operation, retryCount: operation.retryCount + 1 };

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const request = store.put(updated);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Sync all pending operations
	 */
	async syncPendingOperations(): Promise<SyncResult> {
		if (this.syncInProgress) {
			console.log("Sync already in progress");
			return { success: false, synced: 0, failed: 0, errors: [] };
		}

		this.syncInProgress = true;
		const result: SyncResult = {
			success: true,
			synced: 0,
			failed: 0,
			errors: [],
		};

		try {
			const operations = await this.getPendingOperations();
			console.log(`Syncing ${operations.length} pending operations`);

			for (const operation of operations) {
				try {
					await this.executeOperation(operation);
					await this.removeOperation(operation.id);
					result.synced++;
				} catch (error: any) {
					console.error(`Failed to sync operation ${operation.id}:`, error);

					if (operation.retryCount < this.maxRetries) {
						await this.updateOperationRetry(operation);
					} else {
						result.errors.push({
							operation,
							error: error.message || "Unknown error",
						});
						result.failed++;
					}
				}
			}

			result.success = result.failed === 0;
		} finally {
			this.syncInProgress = false;
		}

		return result;
	}

	/**
	 * Execute a single sync operation
	 */
	private async executeOperation(operation: SyncOperation): Promise<void> {
		switch (operation.entity) {
			case "project":
				await this.syncProject(operation);
				break;
			case "task":
				await this.syncTask(operation);
				break;
			case "issue":
				await this.syncIssue(operation);
				break;
			default:
				throw new Error(`Unknown entity type: ${operation.entity}`);
		}
	}

	/**
	 * Sync project operation
	 */
	private async syncProject(operation: SyncOperation): Promise<void> {
		switch (operation.type) {
			case "create":
				await api.projects.create(operation.data);
				break;
			case "update":
				if (!operation.entityId)
					throw new Error("Entity ID required for update");
				await api.projects.update(operation.entityId, operation.data);
				break;
			case "delete":
				if (!operation.entityId)
					throw new Error("Entity ID required for delete");
				await api.projects.delete(operation.entityId);
				break;
		}
	}

	/**
	 * Sync task operation
	 */
	private async syncTask(operation: SyncOperation): Promise<void> {
		switch (operation.type) {
			case "create":
				await api.tasks.create(operation.data);
				break;
			case "update":
				if (!operation.entityId)
					throw new Error("Entity ID required for update");
				await api.tasks.update(operation.entityId, operation.data);
				break;
			case "delete":
				// Tasks are typically not deleted, but cancelled
				if (!operation.entityId)
					throw new Error("Entity ID required for cancel");
				await api.tasks.cancel(operation.entityId);
				break;
		}
	}

	/**
	 * Sync issue operation
	 */
	private async syncIssue(operation: SyncOperation): Promise<void> {
		switch (operation.type) {
			case "update":
				if (!operation.entityId)
					throw new Error("Entity ID required for update");
				await api.issues.update(operation.entityId, operation.data);
				break;
			default:
				throw new Error(
					`Unsupported operation type for issues: ${operation.type}`,
				);
		}
	}

	/**
	 * Resolve conflicts between local and remote data
	 */
	resolveConflict(
		localData: any,
		remoteData: any,
		strategy: ConflictResolution["strategy"] = "remote",
	): ConflictResolution {
		const resolution: ConflictResolution = {
			strategy,
			localData,
			remoteData,
		};

		switch (strategy) {
			case "local":
				resolution.resolvedData = localData;
				break;

			case "remote":
				resolution.resolvedData = remoteData;
				break;

			case "merge":
				// Simple merge: remote wins for conflicts, keep local additions
				resolution.resolvedData = {
					...localData,
					...remoteData,
					// Preserve local timestamps if newer
					updated_at:
						new Date(localData.updated_at) > new Date(remoteData.updated_at)
							? localData.updated_at
							: remoteData.updated_at,
				};
				break;

			case "manual":
				// Manual resolution required - return both versions
				resolution.resolvedData = null;
				break;
		}

		return resolution;
	}

	/**
	 * Check if online
	 */
	isOnline(): boolean {
		return navigator.onLine;
	}

	/**
	 * Start auto-sync on network reconnection
	 */
	startAutoSync(): void {
		window.addEventListener("online", async () => {
			console.log("Network reconnected, starting auto-sync");
			try {
				const result = await this.syncPendingOperations();
				console.log("Auto-sync completed:", result);
			} catch (error) {
				console.error("Auto-sync failed:", error);
			}
		});
	}

	/**
	 * Get sync status
	 */
	async getSyncStatus(): Promise<{
		pendingOperations: number;
		online: boolean;
		lastSync?: number;
	}> {
		const operations = await this.getPendingOperations();
		const lastSync = localStorage.getItem("last_sync_timestamp");

		return {
			pendingOperations: operations.length,
			online: this.isOnline(),
			lastSync: lastSync ? parseInt(lastSync, 10) : undefined,
		};
	}

	/**
	 * Clear all pending operations (use with caution)
	 */
	async clearPendingOperations(): Promise<void> {
		const db = await this.getDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([this.storeName], "readwrite");
			const store = transaction.objectStore(this.storeName);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}
}

// Export singleton instance
export const syncService = new SyncService();

// Start auto-sync on module load
syncService.startAutoSync();
