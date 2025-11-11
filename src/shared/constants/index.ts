// 应用常量定义

// 支持的编程语言
export const SUPPORTED_LANGUAGES = [
	"javascript",
	"typescript",
	"python",
	"java",
	"go",
	"rust",
	"cpp",
	"csharp",
	"php",
	"ruby",
	"swift",
	"kotlin",
] as const;

// 问题类型
export const ISSUE_TYPES = {
	BUG: "bug",
	SECURITY: "security",
	PERFORMANCE: "performance",
	STYLE: "style",
	MAINTAINABILITY: "maintainability",
} as const;

// 问题严重程度
export const SEVERITY_LEVELS = {
	CRITICAL: "critical",
	HIGH: "high",
	MEDIUM: "medium",
	LOW: "low",
} as const;

// 任务状态
export const TASK_STATUS = {
	PENDING: "pending",
	RUNNING: "running",
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled",
} as const;

// 用户角色
export const USER_ROLES = {
	ADMIN: "admin",
	MEMBER: "member",
} as const;

// 项目成员角色
export const PROJECT_ROLES = {
	OWNER: "owner",
	ADMIN: "admin",
	MEMBER: "member",
	VIEWER: "viewer",
} as const;

// 仓库类型
export const REPOSITORY_TYPES = {
	GITHUB: "github",
	GITLAB: "gitlab",
	OTHER: "other",
} as const;

// 分析深度
export const ANALYSIS_DEPTH = {
	BASIC: "basic",
	STANDARD: "standard",
	DEEP: "deep",
} as const;

// 默认配置
export const DEFAULT_CONFIG = {
	MAX_FILE_SIZE: 1024 * 1024, // 1MB
	MAX_FILES_PER_SCAN: 100,
	ANALYSIS_TIMEOUT: 30000, // 30秒
	DEBOUNCE_DELAY: 300, // 300ms
} as const;

// API 端点
export const API_ENDPOINTS = {
	PROJECTS: "/api/projects",
	AUDIT_TASKS: "/api/audit-tasks",
	INSTANT_ANALYSIS: "/api/instant-analysis",
	USERS: "/api/users",
} as const;

// 本地存储键名
export const STORAGE_KEYS = {
	THEME: "xcodereviewer-theme",
	USER_PREFERENCES: "xcodereviewer-preferences",
	RECENT_PROJECTS: "xcodereviewer-recent-projects",
} as const;
