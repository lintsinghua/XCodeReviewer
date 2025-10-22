// 环境变量配置
export const env = {
  // Gemini AI 配置
  GEMINI_API_KEY: import.meta.env.VITE_GEMINI_API_KEY || '',
  GEMINI_MODEL: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash',
  GEMINI_TIMEOUT_MS: Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS) || 25000,

  // Supabase 配置
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // GitHub 配置
  GITHUB_TOKEN: import.meta.env.VITE_GITHUB_TOKEN || '',

  // 应用配置
  APP_ID: import.meta.env.VITE_APP_ID || 'xcodereviewer',

  // 分析配置
  MAX_ANALYZE_FILES: Number(import.meta.env.VITE_MAX_ANALYZE_FILES) || 40,
  LLM_CONCURRENCY: Number(import.meta.env.VITE_LLM_CONCURRENCY) || 2,
  LLM_GAP_MS: Number(import.meta.env.VITE_LLM_GAP_MS) || 500,

  // 开发环境标识
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

// 验证必需的环境变量
export function validateEnv() {
  const requiredVars = ['GEMINI_API_KEY'];
  const missing = requiredVars.filter(key => !env[key as keyof typeof env]);
  
  if (missing.length > 0) {
    console.warn(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return missing.length === 0;
}