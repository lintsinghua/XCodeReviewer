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
  register: async (data: RegisterRequest): Promise<User> => {
    return await apiClient.post<User>('/auth/register', data);
  },

  /**
   * Login user (使用 form data 格式)
   */
  login: async (username: string, password: string): Promise<AuthResponse> => {
    // 后端使用 OAuth2PasswordRequestForm，需要 form data 格式
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await apiClient.post<AuthResponse>('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    // Store tokens
    if (response.access_token && response.refresh_token) {
      apiClient.setTokens(response.access_token, response.refresh_token);
    }
    
    return response;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/refresh', {
      refresh_token: refreshToken
    });
    
    // Update tokens
    if (response.access_token && response.refresh_token) {
      apiClient.setTokens(response.access_token, response.refresh_token);
    }
    
    return response;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      apiClient.clearTokens();
    }
  },

  /**
   * Request password reset
   */
  requestPasswordReset: (data: PasswordResetRequest) =>
    apiClient.post('/auth/forgot-password', data),

  /**
   * Reset password with token
   */
  resetPassword: (data: PasswordResetConfirm) =>
    apiClient.post('/auth/reset-password', data),

  /**
   * Get current user
   */
  getCurrentUser: () =>
    apiClient.get<User>('/auth/me'),
};

// ============================================================================
// Project API
// ============================================================================

export const projectApi = {
  /**
   * Create a new project
   */
  create: (data: ProjectCreate) =>
    apiClient.post<Project>('/projects', data),

  /**
   * List projects with pagination
   */
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    apiClient.get<PaginatedResponse<Project>>('/projects', { params }),

  /**
   * List deleted projects (for recycle bin)
   */
  listDeleted: (params?: { page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<Project>>('/projects/deleted/list', { params }),

  /**
   * Get project by ID
   */
  get: (id: number) =>
    apiClient.get<Project>(`/projects/${id}`),

  /**
   * Update project
   */
  update: (id: number, data: ProjectUpdate) =>
    apiClient.put<Project>(`/projects/${id}`, data),

  /**
   * Delete project (soft delete)
   */
  delete: (id: number) =>
    apiClient.delete(`/projects/${id}`),

  /**
   * Restore deleted project
   */
  restore: (id: number) =>
    apiClient.post<Project>(`/projects/${id}/restore`),

  /**
   * Get project statistics
   */
  getStats: (id: number) =>
    apiClient.get(`/projects/${id}/stats`),
};

// ============================================================================
// Task API
// ============================================================================

export const taskApi = {
  /**
   * Create a new task
   */
  create: (data: TaskCreate) =>
    apiClient.post<AuditTask>('/tasks', data),

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
    apiClient.get<PaginatedResponse<AuditTask>>('/tasks', { params }),

  /**
   * Get task by ID
   */
  get: (id: number) =>
    apiClient.get<AuditTask>(`/tasks/${id}`),

  /**
   * Update task
   */
  update: (id: number, data: TaskUpdate) =>
    apiClient.put<AuditTask>(`/tasks/${id}`, data),

  /**
   * Cancel task
   */
  cancel: (id: number) =>
    apiClient.put(`/tasks/${id}/cancel`),

  /**
   * Get task results
   */
  getResults: (id: number) =>
    apiClient.get(`/tasks/${id}/results`),

  /**
   * Retry failed task
   */
  retry: (id: number) =>
    apiClient.post(`/tasks/${id}/retry`),
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
    apiClient.get<PaginatedResponse<AuditIssue>>('/issues', { params }),

  /**
   * Get issue by ID
   */
  get: (id: number) =>
    apiClient.get<AuditIssue>(`/issues/${id}`),

  /**
   * Update issue
   */
  update: (id: number, data: IssueUpdate) =>
    apiClient.put<AuditIssue>(`/issues/${id}`, data),

  /**
   * Add comment to issue
   */
  addComment: (id: number, data: IssueComment) =>
    apiClient.post(`/issues/${id}/comments`, data),

  /**
   * Bulk update issues
   */
  bulkUpdate: (issue_ids: number[], status: string) =>
    apiClient.post('/issues/bulk-update', { issue_ids, status }),
};

// ============================================================================
// Report API
// ============================================================================

export const reportApi = {
  /**
   * Generate a new report
   */
  create: (data: ReportCreate) =>
    apiClient.post<Report>('/reports', data),

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
    apiClient.get<PaginatedResponse<Report>>('/reports', { params }),

  /**
   * Get report by ID
   */
  get: (id: number) =>
    apiClient.get<Report>(`/reports/${id}`),

  /**
   * Download report
   */
  download: (id: number, filename?: string) =>
    apiClient.download(`/reports/${id}/download`, filename),

  /**
   * Delete report
   */
  delete: (id: number) =>
    apiClient.delete(`/reports/${id}`),
};

// ============================================================================
// Statistics API
// ============================================================================

export const statisticsApi = {
  /**
   * Get overview statistics
   */
  getOverview: () =>
    apiClient.get<OverviewStats>('/statistics/overview'),

  /**
   * Get trend statistics
   */
  getTrends: (params?: { days?: number }) =>
    apiClient.get<TrendStats>('/statistics/trends', { params }),

  /**
   * Get quality metrics for a project
   */
  getQualityMetrics: (projectId: number) =>
    apiClient.get<QualityMetrics>(`/statistics/quality/${projectId}`),
};

// ============================================================================
// Migration API
// ============================================================================

export const migrationApi = {
  /**
   * Export user data
   */
  exportData: () =>
    apiClient.get<ExportData>('/migration/export'),

  /**
   * Import user data
   */
  importData: (data: ExportData) =>
    apiClient.post<ImportResult>('/migration/import', data),

  /**
   * Validate import data
   */
  validateImport: (data: ExportData) =>
    apiClient.post('/migration/validate', data),
};

// ============================================================================
// File Upload API
// ============================================================================

export const fileApi = {
  /**
   * Upload ZIP file for scanning
   */
  uploadZip: (file: File, onProgress?: (progress: number) => void) =>
    apiClient.upload('/projects/upload', file, onProgress),
};

// ============================================================================
// Instant Analysis API
// ============================================================================

export const instantAnalysisApi = {
  /**
   * Analyze code instantly
   */
  analyze: (data: { code: string; language: string }) =>
    apiClient.post<{
      issues: Array<{
        type: string;
        severity: string;
        title: string;
        description: string;
        suggestion: string;
        line: number;
        column?: number;
        code_snippet: string;
        ai_explanation: string;
        xai?: {
          what: string;
          why: string;
          how: string;
          learn_more?: string;
        };
      }>;
      quality_score: number;
      summary: {
        total_issues: number;
        critical_issues: number;
        high_issues: number;
        medium_issues: number;
        low_issues: number;
      };
      metrics: {
        complexity: number;
        maintainability: number;
        security: number;
        performance: number;
      };
    }>('/instant-analysis/analyze', data),

  /**
   * Get supported languages
   */
  getSupportedLanguages: () =>
    apiClient.get<{ languages: string[] }>('/instant-analysis/supported-languages'),
};

// ============================================================================
// System Settings API
// ============================================================================

export const systemSettingsApi = {
  /**
   * Get LLM settings
   */
  getLLMSettings: () =>
    apiClient.get<{
      provider: string;
      model?: string;
      api_key?: string;
      base_url?: string;
      temperature: number;
      max_tokens?: number;
      timeout: number;
    }>('/system/llm-settings'),

  /**
   * Update LLM settings
   */
  updateLLMSettings: (data: {
    provider?: string;
    model?: string;
    api_key?: string;
    base_url?: string;
    temperature?: number;
    max_tokens?: number;
    timeout?: number;
  }) =>
    apiClient.put('/system/llm-settings', data),

  /**
   * Get all settings by category
   */
  getSettings: (category?: string) =>
    apiClient.get<Array<{
      id: number;
      key: string;
      value?: string;
      category: string;
      description?: string;
      is_sensitive: boolean;
      created_at: string;
      updated_at: string;
    }>>('/system/settings', { params: { category } }),

  /**
   * Get specific setting
   */
  getSetting: (key: string) =>
    apiClient.get(`/system/settings/${key}`),

  /**
   * Batch update settings
   */
  batchUpdateSettings: (settings: Record<string, string>) =>
    apiClient.post('/system/settings/batch', { settings }),
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
  instantAnalysis: instantAnalysisApi,
  systemSettings: systemSettingsApi,
};

export default api;
