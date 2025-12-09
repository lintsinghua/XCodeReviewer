/**
 * 提示词模板 API
 */

import { apiClient } from './serverClient';

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: string;
  content_zh?: string;
  content_en?: string;
  variables: Record<string, string>;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PromptTemplateListResponse {
  items: PromptTemplate[];
  total: number;
}

export interface PromptTemplateCreate {
  name: string;
  description?: string;
  template_type?: string;
  content_zh?: string;
  content_en?: string;
  variables?: Record<string, string>;
  is_active?: boolean;
  sort_order?: number;
}

export interface PromptTemplateUpdate {
  name?: string;
  description?: string;
  template_type?: string;
  content_zh?: string;
  content_en?: string;
  variables?: Record<string, string>;
  is_active?: boolean;
  sort_order?: number;
}

export interface PromptTestRequest {
  content: string;
  language: string;
  code: string;
}

export interface PromptTestResponse {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  execution_time?: number;
}

// 获取提示词模板列表
export async function getPromptTemplates(params?: {
  skip?: number;
  limit?: number;
  template_type?: string;
  is_active?: boolean;
}): Promise<PromptTemplateListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.template_type) searchParams.set('template_type', params.template_type);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  
  const query = searchParams.toString();
  const response = await apiClient.get(`/prompts${query ? `?${query}` : ''}`);
  return response.data;
}

// 获取单个提示词模板
export async function getPromptTemplate(id: string): Promise<PromptTemplate> {
  const response = await apiClient.get(`/prompts/${id}`);
  return response.data;
}

// 创建提示词模板
export async function createPromptTemplate(data: PromptTemplateCreate): Promise<PromptTemplate> {
  const response = await apiClient.post('/prompts', data);
  return response.data;
}

// 更新提示词模板
export async function updatePromptTemplate(id: string, data: PromptTemplateUpdate): Promise<PromptTemplate> {
  const response = await apiClient.put(`/prompts/${id}`, data);
  return response.data;
}

// 删除提示词模板
export async function deletePromptTemplate(id: string): Promise<void> {
  await apiClient.delete(`/prompts/${id}`);
}

// 测试提示词
export async function testPromptTemplate(data: PromptTestRequest): Promise<PromptTestResponse> {
  const response = await apiClient.post('/prompts/test', data);
  return response.data;
}

// 设置默认模板
export async function setDefaultPromptTemplate(id: string): Promise<void> {
  await apiClient.post(`/prompts/${id}/set-default`);
}
