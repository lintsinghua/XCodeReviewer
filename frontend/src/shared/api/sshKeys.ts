/**
 * SSH Keys API Client
 */

import { apiClient } from './serverClient';

export interface SSHKeyResponse {
  has_key: boolean;
  public_key?: string;
  fingerprint?: string;
}

export interface SSHKeyGenerateResponse {
  public_key: string;
  fingerprint?: string;
  message: string;
}

export interface SSHKeyTestRequest {
  repo_url: string;
}

export interface SSHKeyTestResponse {
  success: boolean;
  message: string;
  output?: string;
}

/**
 * 生成新的SSH密钥对
 */
export const generateSSHKey = async (): Promise<SSHKeyGenerateResponse> => {
  const response = await apiClient.post<SSHKeyGenerateResponse>('/ssh-keys/generate');
  return response.data;
};

/**
 * 获取当前用户的SSH公钥
 */
export const getSSHKey = async (): Promise<SSHKeyResponse> => {
  const response = await apiClient.get<SSHKeyResponse>('/ssh-keys/');
  return response.data;
};

/**
 * 删除SSH密钥
 */
export const deleteSSHKey = async (): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>('/ssh-keys/');
  return response.data;
};

/**
 * 测试SSH密钥
 */
export const testSSHKey = async (repoUrl: string): Promise<SSHKeyTestResponse> => {
  const response = await apiClient.post<SSHKeyTestResponse>('/ssh-keys/test', {
    repo_url: repoUrl
  });
  return response.data;
};

/**
 * 清理known_hosts文件
 */
export const clearKnownHosts = async (): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.delete<{ success: boolean; message: string }>('/ssh-keys/known-hosts');
  return response.data;
};
