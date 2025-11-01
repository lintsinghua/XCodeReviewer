/**
 * API Service
 * Centralized API methods for all endpoints
 */
import { apiClient } from './client';
import type {
  // Auth
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  PasswordResetRequest,
  PasswordResetConfirm,
  // User
  User,
  UserUpdate,
  // Project
  Project,
  ProjectCreate,
  ProjectUpdate,
  PaginatedResponse,
  // Task
  AuditTask,
  TaskCreate,
  TaskUpdate,
  // Issue
  AuditIssue,
  IssueUpdate,
  IssueComment,
  // Report
  Report,
  ReportCreate,
  // Statistics
  OverviewStats,
  TrendStats,
  QualityMetrics,
  // Migration
  ExportData,
  ImportResult,
} from '../../types/api';

// ============================================================================
// Authentication API
// ============================================================================

export const authApi = {
  /**
   * Register a new user
   */
  register: (data: RegisterRequest) =>
    apiClient.post<User>('/api/v1/auth/register', data),

  /**
   * Login user
   */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', data);
    // Store tokens
    apiClient.setTokens(response.access_token, response.refresh_token);
    return response;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } finally {
      apiClient.clearTokens();
    }
  },

  /**
   * Request password reset
   */
  requestPasswordReset: (data: PasswordResetRequest) =>
    apiClient.post('/api/v1/auth/forgot-password', data),

  /**
   * Reset password with token
   */
  resetPassword: (data: PasswordResetConfirm) =>
    apiClient.post('/api/v1/auth/reset-password', data),

  /**
   * Get current user
   */
  getCurrentUser: () =>
    apiClient.get<User>('/api/v1/auth/me'),
};

// ============================================================================
// Project API
// ============================================================================

export const projectApi = {
  /**
   * Create a new project
   */
  create: (data: ProjectCreate) =>
    apiClient.post<Project>('/api/v1/projects', data),

  /**
   * List projects with pagination
   */
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<Project>>('/api/v1/projects', { params }),

  /**
   * Get project by ID
   */
  get: (id: number) =>
    apiClient.get<Project>(`/api/v1/projects/${id}`),

  /**
   * Update project
   */
  update: (id: number, data: ProjectUpdate) =>
    apiClient.put<Project>(`/api/v1/projects/${id}`, data),

  /**
   * Delete project
   */
  delete: (id: number) =>
    apiClient.delete(`/api/v1/projects/${id}`),

  /**
   * Get project statistics
   */
  getStats: (id: number) =>
    apiClient.get(`/api/v1/projects/${id}/stats`),
};

// ============================================================================
// Task API
// ============================================================================

export const taskApi = {
  /**
   * Create a new task
   */
  create: (data: TaskCreate) =>
    apiClient.post<AuditTask>('/api/v1/tasks', data),

  /**
   * List tasks with pagination and filters
   */
  list: (params?: {
    page?: number;
    page_size?: number;
    project_id?: number;
    status?: string;
    priority?: string;
  }) =>
    apiClient.get<PaginatedResponse<AuditTask>>('/api/v1/tasks', { params }),

  /**
   * Get task by ID
   */
  get: (id: number) =>
    apiClient.get<AuditTask>(`/api/v1/tasks/${id}`),

  /**
   * Update task
   */
  update: (id: number, data: TaskUpdate) =>
    apiClient.put<AuditTask>(`/api/v1/tasks/${id}`, data),

  /**
   * Cancel task
   */
  cancel: (id: number) =>
    apiClient.put(`/api/v1/tasks/${id}/cancel`),

  /**
   * Get task results
   */
  getResults: (id: number) =>
    apiClient.get(`/api/v1/tasks/${id}/results`),

  /**
   * Retry failed task
   */
  retry: (id: number) =>
    apiClient.post(`/api/v1/tasks/${id}/retry`),
};

// ============================================================================
// Issue API
// ============================================================================

export const issueApi = {
  /**
   * List issues with pagination and filters
   */
  list: (params?: {
    page?: number;
    page_size?: number;
    task_id?: number;
    severity?: string;
    category?: string;
    status?: string;
  }) =>
    apiClient.get<PaginatedResponse<AuditIssue>>('/api/v1/issues', { params }),

  /**
   * Get issue by ID
   */
  get: (id: number) =>
    apiClient.get<AuditIssue>(`/api/v1/issues/${id}`),

  /**
   * Update issue
   */
  update: (id: number, data: IssueUpdate) =>
    apiClient.put<AuditIssue>(`/api/v1/issues/${id}`, data),

  /**
   * Add comment to issue
   */
  addComment: (id: number, data: IssueComment) =>
    apiClient.post(`/api/v1/issues/${id}/comments`, data),

  /**
   * Bulk update issues
   */
  bulkUpdate: (issueIds: number[], data: IssueUpdate) =>
    apiClient.post('/api/v1/issues/bulk-update', { issue_ids: issueIds, ...data }),
};

// ============================================================================
// Report API
// ============================================================================

export const reportApi = {
  /**
   * Generate a new report
   */
  create: (data: ReportCreate) =>
    apiClient.post<Report>('/api/v1/reports', data),

  /**
   * List reports with pagination and filters
   */
  list: (params?: {
    page?: number;
    page_size?: number;
    task_id?: number;
    format?: string;
    status?: string;
  }) =>
    apiClient.get<PaginatedResponse<Report>>('/api/v1/reports', { params }),

  /**
   * Get report by ID
   */
  get: (id: number) =>
    apiClient.get<Report>(`/api/v1/reports/${id}`),

  /**
   * Download report
   */
  download: (id: number, filename?: string) =>
    apiClient.download(`/api/v1/reports/${id}/download`, filename),

  /**
   * Delete report
   */
  delete: (id: number) =>
    apiClient.delete(`/api/v1/reports/${id}`),
};

// ============================================================================
// Statistics API
// ============================================================================

export const statisticsApi = {
  /**
   * Get overview statistics
   */
  getOverview: () =>
    apiClient.get<OverviewStats>('/api/v1/statistics/overview'),

  /**
   * Get trend statistics
   */
  getTrends: (params?: { days?: number }) =>
    apiClient.get<TrendStats>('/api/v1/statistics/trends', { params }),

  /**
   * Get quality metrics for a project
   */
  getQualityMetrics: (projectId: number) =>
    apiClient.get<QualityMetrics>(`/api/v1/statistics/quality/${projectId}`),
};

// ============================================================================
// Migration API
// ============================================================================

export const migrationApi = {
  /**
   * Export user data
   */
  exportData: () =>
    apiClient.get<ExportData>('/api/v1/migration/export'),

  /**
   * Import user data
   */
  importData: (data: ExportData) =>
    apiClient.post<ImportResult>('/api/v1/migration/import', data),

  /**
   * Validate import data
   */
  validateImport: (data: ExportData) =>
    apiClient.post('/api/v1/migration/validate', data),
};

// ============================================================================
// File Upload API
// ============================================================================

export const fileApi = {
  /**
   * Upload ZIP file for scanning
   */
  uploadZip: (file: File, onProgress?: (progress: number) => void) =>
    apiClient.upload('/api/v1/projects/upload', file, onProgress),
};

// Export all APIs
export const api = {
  auth: authApi,
  projects: projectApi,
  tasks: taskApi,
  issues: issueApi,
  reports: reportApi,
  statistics: statisticsApi,
  migration: migrationApi,
  files: fileApi,
};

export default api;
