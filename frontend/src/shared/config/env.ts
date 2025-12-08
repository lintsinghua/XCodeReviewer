/**
 * 前端环境变量配置
 * 
 * 注意：在 refactor/backend 分支中，所有 LLM 分析都在后端进行。
 * LLM 配置保存在后端数据库（通过 /api/v1/config/me API），
 * 这里只保留前端应用本身需要的配置。
 */

// ==================== 应用配置 ====================
export const env = {
  // 应用ID
  APP_ID: import.meta.env.VITE_APP_ID || 'deepaudit',
  
  // API 基础URL
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  
  // ==================== 开发环境标识 ====================
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  
  // 注意：GitHub/GitLab Token 等第三方服务配置已移至后端数据库
  // 用户可以通过 SystemConfig 页面配置，后端分析时会自动使用
} as const;
