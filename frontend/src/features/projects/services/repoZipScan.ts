import { apiClient } from "@/shared/api/serverClient";

export async function scanZipFile(params: {
  projectId: string;
  zipFile: File;
  excludePatterns?: string[];
  createdBy?: string;
}): Promise<string> {
  const formData = new FormData();
  formData.append("file", params.zipFile);
  formData.append("project_id", params.projectId);

  const res = await apiClient.post(`/scan/upload-zip`, formData, {
    params: { project_id: params.projectId },
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data.task_id;
}

export function validateZipFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  if (!file.type.includes('zip') && !file.name.toLowerCase().endsWith('.zip')) {
    return { valid: false, error: '请上传ZIP格式的文件' };
  }

  // 检查文件大小 (限制为100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '文件大小不能超过100MB' };
  }

  return { valid: true };
}
