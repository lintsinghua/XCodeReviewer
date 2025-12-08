// 应用常量定义

// 支持的编程语言
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'swift',
  'kotlin',
] as const;

// 问题类型
export const ISSUE_TYPES = {
  BUG: 'bug',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  STYLE: 'style',
  MAINTAINABILITY: 'maintainability',
} as const;

// 问题严重程度
export const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

// 任务状态
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// 用户角色
export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

// 项目成员角色
export const PROJECT_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

// 项目来源类型
export const PROJECT_SOURCE_TYPES = {
  REPOSITORY: 'repository',
  ZIP: 'zip',
} as const;

// 仓库平台类型
export const REPOSITORY_TYPES = {
  GITHUB: 'github',
  GITLAB: 'gitlab',
  OTHER: 'other',
} as const;

// 分析深度
export const ANALYSIS_DEPTH = {
  BASIC: 'basic',
  STANDARD: 'standard',
  DEEP: 'deep',
} as const;

// 默认配置（与后端对齐）
export const DEFAULT_CONFIG = {
  MAX_FILE_SIZE: 200 * 1024, // 200KB (对齐后端 MAX_FILE_SIZE_BYTES)
  MAX_FILES_PER_SCAN: 50, // 对齐后端 MAX_ANALYZE_FILES
  ANALYSIS_TIMEOUT: 30000, // 30秒
  DEBOUNCE_DELAY: 300, // 300ms
} as const;

// API 端点
export const API_ENDPOINTS = {
  PROJECTS: '/api/projects',
  AUDIT_TASKS: '/api/audit-tasks',
  INSTANT_ANALYSIS: '/api/instant-analysis',
  USERS: '/api/users',
} as const;

// 本地存储键名
export const STORAGE_KEYS = {
  THEME: 'deepaudit-theme',
  USER_PREFERENCES: 'deepaudit-preferences',
  RECENT_PROJECTS: 'deepaudit-recent-projects',
} as const;

// 导出项目类型相关常量
export * from './projectTypes';
