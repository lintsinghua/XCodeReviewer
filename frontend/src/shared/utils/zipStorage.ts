/**
 * ZIP文件存储工具
 * 通过后端API管理项目的ZIP文件
 */

import { apiClient } from '@/shared/api/serverClient';

export interface ZipFileMeta {
  has_file: boolean;
  original_filename?: string;
  file_size?: number;
  uploaded_at?: string;
}

/**
 * 获取项目ZIP文件信息
 */
export async function getZipFileInfo(projectId: string): Promise<ZipFileMeta> {
  try {
    const response = await apiClient.get(`/projects/${projectId}/zip`);
    return response.data;
  } catch (error) {
    console.error('获取ZIP文件信息失败:', error);
    return { has_file: false };
  }
}

/**
 * 上传项目ZIP文件
 */
export async function uploadZipFile(projectId: string, file: File): Promise<{
  success: boolean;
  message?: string;
  original_filename?: string;
  file_size?: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post(`/projects/${projectId}/zip`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return {
      success: true,
      message: response.data.message,
      original_filename: response.data.original_filename,
      file_size: response.data.file_size,
    };
  } catch (error: any) {
    console.error('上传ZIP文件失败:', error);
    return {
      success: false,
      message: error.response?.data?.detail || '上传失败',
    };
  }
}

/**
 * 删除项目ZIP文件
 */
export async function deleteZipFile(projectId: string): Promise<boolean> {
  try {
    await apiClient.delete(`/projects/${projectId}/zip`);
    return true;
  } catch (error) {
    console.error('删除ZIP文件失败:', error);
    return false;
  }
}

/**
 * 检查项目是否有ZIP文件
 */
export async function hasZipFile(projectId: string): Promise<boolean> {
  const info = await getZipFileInfo(projectId);
  return info.has_file;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

// ============ 兼容旧API（已废弃，保留以避免编译错误） ============

/**
 * @deprecated 使用 uploadZipFile 代替
 */
export async function saveZipFile(projectId: string, file: File): Promise<void> {
  const result = await uploadZipFile(projectId, file);
  if (!result.success) {
    throw new Error(result.message || '保存ZIP文件失败');
  }
}

/**
 * @deprecated 使用 getZipFileInfo 代替
 */
export async function loadZipFile(projectId: string): Promise<File | null> {
  // 后端不再返回文件内容，只返回元数据
  // 如果需要文件，应该在创建任务时直接使用后端存储的文件
  const info = await getZipFileInfo(projectId);
  if (info.has_file && info.original_filename) {
    // 返回一个虚拟的File对象，仅包含元数据
    const blob = new Blob([], { type: 'application/zip' });
    return new File([blob], info.original_filename, { type: 'application/zip' });
  }
  return null;
}
