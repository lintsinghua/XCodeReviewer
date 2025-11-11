/**
 * API Type Definitions
 * TypeScript interfaces for all API models
 */

// ============================================================================
// Common Types
// ============================================================================

export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	page_size: number;
}

export interface ApiResponse<T> {
	data: T;
	message?: string;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface LoginRequest {
	username: string;
	password: string;
}

export interface RegisterRequest {
	email: string;
	username: string;
	password: string;
}

export interface AuthResponse {
	access_token: string;
	refresh_token: string;
	token_type: string;
	user: User;
}

export interface RefreshTokenRequest {
	refresh_token: string;
}

export interface PasswordResetRequest {
	email: string;
}

export interface PasswordResetConfirm {
	token: string;
	new_password: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
	id: number;
	email: string;
	username: string;
	role: "admin" | "user";
	is_active: boolean;
	created_at: string;
	updated_at?: string;
}

export interface UserUpdate {
	email?: string;
	username?: string;
	password?: string;
}

// ============================================================================
// Project Types
// ============================================================================

export enum ProjectSource {
	GITHUB = "github",
	GITLAB = "gitlab",
	ZIP = "zip",
	LOCAL = "local",
}

export interface Project {
	id: number;
	name: string;
	description?: string;
	source_type: ProjectSource;
	source_url?: string;
	branch?: string;
	owner_id: number;
	created_at: string;
	updated_at?: string;
	last_scan_at?: string;
	total_tasks: number;
	total_issues: number;
}

export interface ProjectCreate {
	name: string;
	description?: string;
	source_type: ProjectSource;
	source_url?: string;
	branch?: string;
}

export interface ProjectUpdate {
	name?: string;
	description?: string;
	source_url?: string;
	branch?: string;
}

// ============================================================================
// Task Types
// ============================================================================

export enum TaskStatus {
	PENDING = "pending",
	RUNNING = "running",
	COMPLETED = "completed",
	FAILED = "failed",
	CANCELLED = "cancelled",
}

export enum TaskPriority {
	LOW = "low",
	NORMAL = "normal",
	HIGH = "high",
	URGENT = "urgent",
}

export interface LLMProviderSummary {
	id: number;
	name: string;
	display_name: string;
	icon?: string;
}

export interface AuditTask {
	id: number;
	name: string;
	description?: string;
	status: TaskStatus;
	priority: TaskPriority;
	progress: number;
	current_step?: string;
	agents_used?: Record<string, any>;
	scan_config?: Record<string, any>;
	total_issues: number;
	critical_issues: number;
	high_issues: number;
	medium_issues: number;
	low_issues: number;
	overall_score: number;
	error_message?: string;
	retry_count: number;
	created_at: string;
	started_at?: string;
	completed_at?: string;
	project_id: number;
	created_by: number;
	llm_provider_id?: number;
	llm_provider?: LLMProviderSummary;
}

export interface TaskCreate {
	name: string;
	description?: string;
	project_id: number;
	priority?: TaskPriority;
	agents_used?: Record<string, any>;
	scan_config?: Record<string, any>;
	llm_provider_id?: number;
}

export interface TaskUpdate {
	name?: string;
	description?: string;
	priority?: TaskPriority;
}

// ============================================================================
// Issue Types
// ============================================================================

export enum IssueSeverity {
	CRITICAL = "critical",
	HIGH = "high",
	MEDIUM = "medium",
	LOW = "low",
	INFO = "info",
}

export enum IssueCategory {
	SECURITY = "security",
	QUALITY = "quality",
	PERFORMANCE = "performance",
	MAINTAINABILITY = "maintainability",
	RELIABILITY = "reliability",
	STYLE = "style",
	DOCUMENTATION = "documentation",
	OTHER = "other",
}

export enum IssueStatus {
	OPEN = "open",
	IN_PROGRESS = "in_progress",
	RESOLVED = "resolved",
	IGNORED = "ignored",
}

export interface AuditIssue {
	id: number;
	task_id: number;
	file_path: string;
	line_number?: number;
	severity: IssueSeverity;
	category: IssueCategory;
	status: IssueStatus;
	title: string;
	description: string;
	code_snippet?: string;
	suggestion?: string;
	fix_example?: string; // 修复示例代码
	agent_name?: string;
	confidence_score?: number;
	created_at: string;
	updated_at?: string;
}

export interface IssueUpdate {
	status?: IssueStatus;
	notes?: string;
}

export interface IssueComment {
	content: string;
}

// ============================================================================
// Report Types
// ============================================================================

export enum ReportFormat {
	JSON = "json",
	MARKDOWN = "markdown",
	PDF = "pdf",
}

export enum ReportStatus {
	PENDING = "pending",
	GENERATING = "generating",
	COMPLETED = "completed",
	FAILED = "failed",
}

export interface Report {
	id: number;
	task_id: number;
	format: ReportFormat;
	status: ReportStatus;
	file_path?: string;
	file_size?: number;
	download_url?: string;
	error_message?: string;
	created_at: string;
	completed_at?: string;
	created_by: number;
}

export interface ReportCreate {
	task_id: number;
	format: ReportFormat;
	include_code_snippets?: boolean;
	include_suggestions?: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface OverviewStats {
	total_projects: number;
	total_tasks: number;
	total_issues: number;
	active_tasks: number;
	completed_tasks: number;
	failed_tasks: number;
	critical_issues: number;
	high_issues: number;
	medium_issues: number;
	low_issues: number;
	average_score: number;
}

export interface DailyStats {
	date: string;
	tasks_created: number;
	tasks_completed: number;
	issues_found: number;
	average_score: number;
}

export interface TrendStats {
	daily_stats: DailyStats[];
	period_start: string;
	period_end: string;
}

export interface QualityMetrics {
	project_id: number;
	total_scans: number;
	average_score: number;
	score_trend: number[];
	issue_distribution: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	category_distribution: Record<IssueCategory, number>;
	most_common_issues: Array<{
		title: string;
		count: number;
		severity: IssueSeverity;
	}>;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export enum WebSocketMessageType {
	TASK_PROGRESS = "task_progress",
	TASK_COMPLETED = "task_completed",
	TASK_FAILED = "task_failed",
	ISSUE_FOUND = "issue_found",
	PING = "ping",
	PONG = "pong",
}

export interface WebSocketMessage {
	type: WebSocketMessageType;
	data: any;
	timestamp: string;
}

export interface TaskProgressMessage {
	task_id: number;
	progress: number;
	current_step: string;
	status: TaskStatus;
}

// ============================================================================
// Migration Types
// ============================================================================

export interface ExportData {
	version: string;
	exported_at: string;
	projects: Project[];
	tasks: AuditTask[];
	issues: AuditIssue[];
}

export interface ImportResult {
	success: boolean;
	imported_projects: number;
	imported_tasks: number;
	imported_issues: number;
	errors: string[];
}
