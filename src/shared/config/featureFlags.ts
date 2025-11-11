/**
 * Feature Flags Configuration
 * Centralized feature flag management for gradual rollout
 */

export interface FeatureFlags {
	// Backend API integration
	USE_BACKEND_API: boolean;

	// Individual feature flags for granular control
	USE_BACKEND_AUTH: boolean;
	USE_BACKEND_PROJECTS: boolean;
	USE_BACKEND_TASKS: boolean;
	USE_BACKEND_ISSUES: boolean;
	USE_BACKEND_REPORTS: boolean;
	USE_BACKEND_STATISTICS: boolean;

	// WebSocket features
	USE_WEBSOCKET_UPDATES: boolean;

	// Migration features
	ENABLE_DATA_MIGRATION: boolean;
	SHOW_MIGRATION_UI: boolean;
}

/**
 * Default feature flags
 */
const defaultFlags: FeatureFlags = {
	USE_BACKEND_API: false,
	USE_BACKEND_AUTH: false,
	USE_BACKEND_PROJECTS: false,
	USE_BACKEND_TASKS: false,
	USE_BACKEND_ISSUES: false,
	USE_BACKEND_REPORTS: false,
	USE_BACKEND_STATISTICS: false,
	USE_WEBSOCKET_UPDATES: false,
	ENABLE_DATA_MIGRATION: false,
	SHOW_MIGRATION_UI: false,
};

/**
 * Load feature flags from environment variables
 */
function loadFlagsFromEnv(): Partial<FeatureFlags> {
	return {
		USE_BACKEND_API: import.meta.env.VITE_USE_BACKEND_API === "true",
		USE_BACKEND_AUTH: import.meta.env.VITE_USE_BACKEND_AUTH === "true",
		USE_BACKEND_PROJECTS: import.meta.env.VITE_USE_BACKEND_PROJECTS === "true",
		USE_BACKEND_TASKS: import.meta.env.VITE_USE_BACKEND_TASKS === "true",
		USE_BACKEND_ISSUES: import.meta.env.VITE_USE_BACKEND_ISSUES === "true",
		USE_BACKEND_REPORTS: import.meta.env.VITE_USE_BACKEND_REPORTS === "true",
		USE_BACKEND_STATISTICS:
			import.meta.env.VITE_USE_BACKEND_STATISTICS === "true",
		USE_WEBSOCKET_UPDATES:
			import.meta.env.VITE_USE_WEBSOCKET_UPDATES === "true",
		ENABLE_DATA_MIGRATION:
			import.meta.env.VITE_ENABLE_DATA_MIGRATION === "true",
		SHOW_MIGRATION_UI: import.meta.env.VITE_SHOW_MIGRATION_UI === "true",
	};
}

/**
 * Load feature flags from localStorage (for runtime toggling)
 */
function loadFlagsFromStorage(): Partial<FeatureFlags> {
	const stored = localStorage.getItem("feature_flags");
	if (!stored) return {};

	try {
		return JSON.parse(stored);
	} catch (error) {
		console.error("Failed to parse feature flags from localStorage:", error);
		return {};
	}
}

/**
 * Save feature flags to localStorage
 */
function saveFlagsToStorage(flags: Partial<FeatureFlags>): void {
	try {
		localStorage.setItem("feature_flags", JSON.stringify(flags));
	} catch (error) {
		console.error("Failed to save feature flags to localStorage:", error);
	}
}

/**
 * Feature Flag Manager
 */
class FeatureFlagManager {
	private flags: FeatureFlags;
	private listeners: Set<(flags: FeatureFlags) => void> = new Set();

	constructor() {
		// Merge flags from different sources (priority: localStorage > env > defaults)
		this.flags = {
			...defaultFlags,
			...loadFlagsFromEnv(),
			...loadFlagsFromStorage(),
		};

		// If USE_BACKEND_API is true, enable all backend features by default
		if (this.flags.USE_BACKEND_API) {
			this.flags.USE_BACKEND_AUTH = true;
			this.flags.USE_BACKEND_PROJECTS = true;
			this.flags.USE_BACKEND_TASKS = true;
			this.flags.USE_BACKEND_ISSUES = true;
			this.flags.USE_BACKEND_REPORTS = true;
			this.flags.USE_BACKEND_STATISTICS = true;
			this.flags.USE_WEBSOCKET_UPDATES = true;
		}
	}

	/**
	 * Get a specific feature flag
	 */
	isEnabled(flag: keyof FeatureFlags): boolean {
		return this.flags[flag];
	}

	/**
	 * Get all feature flags
	 */
	getAll(): FeatureFlags {
		return { ...this.flags };
	}

	/**
	 * Set a feature flag
	 */
	setFlag(flag: keyof FeatureFlags, value: boolean): void {
		this.flags[flag] = value;
		saveFlagsToStorage(this.flags);
		this.notifyListeners();
	}

	/**
	 * Set multiple feature flags
	 */
	setFlags(flags: Partial<FeatureFlags>): void {
		this.flags = { ...this.flags, ...flags };
		saveFlagsToStorage(this.flags);
		this.notifyListeners();
	}

	/**
	 * Reset all flags to defaults
	 */
	reset(): void {
		this.flags = { ...defaultFlags };
		localStorage.removeItem("feature_flags");
		this.notifyListeners();
	}

	/**
	 * Subscribe to flag changes
	 */
	subscribe(listener: (flags: FeatureFlags) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Notify all listeners of flag changes
	 */
	private notifyListeners(): void {
		this.listeners.forEach((listener) => listener(this.flags));
	}

	/**
	 * Enable gradual rollout (percentage-based)
	 */
	enableGradualRollout(flag: keyof FeatureFlags, percentage: number): void {
		// Use user ID or session ID for consistent rollout
		const userId = localStorage.getItem("user_id") || "anonymous";
		const hash = this.hashString(userId);
		const userPercentage = hash % 100;

		if (userPercentage < percentage) {
			this.setFlag(flag, true);
		}
	}

	/**
	 * Simple string hash function
	 */
	private hashString(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash);
	}
}

// Export singleton instance
export const featureFlags = new FeatureFlagManager();

// Export convenience functions
export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean =>
	featureFlags.isEnabled(flag);

export const useBackendAPI = (): boolean =>
	featureFlags.isEnabled("USE_BACKEND_API");

export const useBackendAuth = (): boolean =>
	featureFlags.isEnabled("USE_BACKEND_AUTH");

export const useBackendProjects = (): boolean =>
	featureFlags.isEnabled("USE_BACKEND_PROJECTS");

export const useBackendTasks = (): boolean =>
	featureFlags.isEnabled("USE_BACKEND_TASKS");

export const useBackendIssues = (): boolean =>
	featureFlags.isEnabled("USE_BACKEND_ISSUES");

export const useBackendReports = (): boolean =>
	featureFlags.isEnabled("USE_BACKEND_REPORTS");

export const useBackendStatistics = (): boolean =>
	featureFlags.isEnabled("USE_BACKEND_STATISTICS");

export const useWebSocketUpdates = (): boolean =>
	featureFlags.isEnabled("USE_WEBSOCKET_UPDATES");

// React hook for feature flags
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
	const [enabled, setEnabled] = React.useState(() =>
		featureFlags.isEnabled(flag),
	);

	React.useEffect(() => {
		const unsubscribe = featureFlags.subscribe((flags) => {
			setEnabled(flags[flag]);
		});
		return unsubscribe;
	}, [flag]);

	return enabled;
}

// Import React for the hook
import React from "react";
