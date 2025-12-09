/**
 * 审计规则 API
 */

import { apiClient } from './serverClient';

export interface AuditRule {
  id: string;
  rule_set_id: string;
  rule_code: string;
  name: string;
  description?: string;
  category: string;
  severity: string;
  custom_prompt?: string;
  fix_suggestion?: string;
  reference_url?: string;
  enabled: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface AuditRuleSet {
  id: string;
  name: string;
  description?: string;
  language: string;
  rule_type: string;
  severity_weights: Record<string, number>;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  rules: AuditRule[];
  rules_count: number;
  enabled_rules_count: number;
}

export interface AuditRuleSetListResponse {
  items: AuditRuleSet[];
  total: number;
}

export interface AuditRuleCreate {
  rule_code: string;
  name: string;
  description?: string;
  category: string;
  severity?: string;
  custom_prompt?: string;
  fix_suggestion?: string;
  reference_url?: string;
  enabled?: boolean;
  sort_order?: number;
}

export interface AuditRuleSetCreate {
  name: string;
  description?: string;
  language?: string;
  rule_type?: string;
  severity_weights?: Record<string, number>;
  is_active?: boolean;
  sort_order?: number;
  rules?: AuditRuleCreate[];
}

export interface AuditRuleSetUpdate {
  name?: string;
  description?: string;
  language?: string;
  rule_type?: string;
  severity_weights?: Record<string, number>;
  is_active?: boolean;
  sort_order?: number;
}

export interface AuditRuleUpdate {
  rule_code?: string;
  name?: string;
  description?: string;
  category?: string;
  severity?: string;
  custom_prompt?: string;
  fix_suggestion?: string;
  reference_url?: string;
  enabled?: boolean;
  sort_order?: number;
}

// 获取规则集列表
export async function getRuleSets(params?: {
  skip?: number;
  limit?: number;
  language?: string;
  rule_type?: string;
  is_active?: boolean;
}): Promise<AuditRuleSetListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.skip !== undefined) searchParams.set('skip', String(params.skip));
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.language) searchParams.set('language', params.language);
  if (params?.rule_type) searchParams.set('rule_type', params.rule_type);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  
  const query = searchParams.toString();
  const response = await apiClient.get(`/rules${query ? `?${query}` : ''}`);
  return response.data;
}

// 获取单个规则集
export async function getRuleSet(id: string): Promise<AuditRuleSet> {
  const response = await apiClient.get(`/rules/${id}`);
  return response.data;
}

// 创建规则集
export async function createRuleSet(data: AuditRuleSetCreate): Promise<AuditRuleSet> {
  const response = await apiClient.post('/rules', data);
  return response.data;
}

// 更新规则集
export async function updateRuleSet(id: string, data: AuditRuleSetUpdate): Promise<AuditRuleSet> {
  const response = await apiClient.put(`/rules/${id}`, data);
  return response.data;
}

// 删除规则集
export async function deleteRuleSet(id: string): Promise<void> {
  await apiClient.delete(`/rules/${id}`);
}

// 导出规则集
export async function exportRuleSet(id: string): Promise<Blob> {
  const response = await apiClient.get(`/rules/${id}/export`, {
    responseType: 'blob',
  });
  return response.data;
}

// 导入规则集
export async function importRuleSet(data: {
  name: string;
  description?: string;
  language?: string;
  rule_type?: string;
  severity_weights?: Record<string, number>;
  rules: AuditRuleCreate[];
}): Promise<AuditRuleSet> {
  const response = await apiClient.post('/rules/import', data);
  return response.data;
}

// 添加规则到规则集
export async function addRuleToSet(ruleSetId: string, data: AuditRuleCreate): Promise<AuditRule> {
  const response = await apiClient.post(`/rules/${ruleSetId}/rules`, data);
  return response.data;
}

// 更新规则
export async function updateRule(ruleSetId: string, ruleId: string, data: AuditRuleUpdate): Promise<AuditRule> {
  const response = await apiClient.put(`/rules/${ruleSetId}/rules/${ruleId}`, data);
  return response.data;
}

// 删除规则
export async function deleteRule(ruleSetId: string, ruleId: string): Promise<void> {
  await apiClient.delete(`/rules/${ruleSetId}/rules/${ruleId}`);
}

// 切换规则启用状态
export async function toggleRule(ruleSetId: string, ruleId: string): Promise<{ enabled: boolean; message: string }> {
  const response = await apiClient.put(`/rules/${ruleSetId}/rules/${ruleId}/toggle`);
  return response.data;
}
