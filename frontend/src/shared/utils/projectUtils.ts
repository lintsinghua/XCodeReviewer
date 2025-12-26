/**
 * 项目工具函数
 * 用于统一处理项目类型判断和相关逻辑
 */

import type { Project, ProjectSourceType } from '@/shared/types';
import { REPOSITORY_PLATFORM_LABELS } from '@/shared/constants/projectTypes';

/**
 * 判断项目是否为仓库类型
 */
export function isRepositoryProject(project: Project): boolean {
  return project.source_type === 'repository';
}

/**
 * 判断项目是否为ZIP上传类型
 */
export function isZipProject(project: Project): boolean {
  return project.source_type === 'zip';
}

/**
 * 获取项目来源类型的显示名称
 */
export function getSourceTypeLabel(sourceType: ProjectSourceType): string {
  const labels: Record<ProjectSourceType, string> = {
    repository: '远程仓库',
    zip: 'ZIP上传'
  };
  return labels[sourceType] || '未知';
}

/**
 * 获取项目来源类型的英文标签
 */
export function getSourceTypeBadge(sourceType: ProjectSourceType): string {
  const badges: Record<ProjectSourceType, string> = {
    repository: 'REPO',
    zip: 'ZIP'
  };
  return badges[sourceType] || 'UNKNOWN';
}

/**
 * 获取仓库平台的显示名称
 */
export function getRepositoryPlatformLabel(platform?: string): string {
  return REPOSITORY_PLATFORM_LABELS[platform as keyof typeof REPOSITORY_PLATFORM_LABELS] || REPOSITORY_PLATFORM_LABELS.other;
}

/**
 * 判断项目是否可以选择分支（仅仓库类型项目）
 */
export function canSelectBranch(project: Project): boolean {
  return isRepositoryProject(project) && !!project.repository_url;
}

/**
 * 判断项目是否需要上传ZIP文件进行扫描
 */
export function requiresZipUpload(project: Project): boolean {
  return isZipProject(project);
}

/**
 * 获取项目扫描方式的描述
 */
export function getScanMethodDescription(project: Project): string {
  if (isRepositoryProject(project)) {
    return `从 ${getRepositoryPlatformLabel(project.repository_type)} 仓库拉取代码`;
  }
  return '上传ZIP文件进行扫描';
}

/**
 * 验证项目配置是否完整
 */
export function validateProjectConfig(project: Project): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!project.name?.trim()) {
    errors.push('项目名称不能为空');
  }

  if (isRepositoryProject(project)) {
    if (!project.repository_url?.trim()) {
      errors.push('仓库地址不能为空');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
