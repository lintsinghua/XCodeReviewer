// Re-export API implementation from the new API client
// This maintains compatibility with existing imports throughout the app
import { api as newApi } from "@/shared/api/database";

export const api = newApi;

// Feature flags / Mode flags
// 在 refactor/backend 分支中，所有数据操作都通过后端 API
export const dbMode = 'api';  // 'api' 表示使用后端 API，不再使用本地 IndexedDB 或 Supabase
export const isDemoMode = false;
export const isLocalMode = false;

// Supabase 不再使用（后端已实现 PostgreSQL 数据库）
// 保留此导出仅为兼容性，实际值为 null
export const supabase = null;
