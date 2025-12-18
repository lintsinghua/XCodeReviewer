/**
 * 项目类型相关常量
 */

import type { ProjectSourceType, RepositoryPlatform } from '@/shared/types';

// 项目来源类型选项
export const PROJECT_SOURCE_TYPES: Array<{
  value: ProjectSourceType;
  label: string;
  description: string;
}> = [
  {
    value: 'repository',
    label: '远程仓库',
    description: '从 GitHub/GitLab 等远程仓库拉取代码'
  },
  {
    value: 'zip',
    label: 'ZIP上传',
    description: '上传本地ZIP压缩包进行扫描'
  }
];

// 仓库平台选项
export const REPOSITORY_PLATFORMS: Array<{
  value: RepositoryPlatform;
  label: string;
  icon?: string;
}> = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'other', label: '其他' }
];

// 项目来源类型的颜色配置
export const SOURCE_TYPE_COLORS: Record<ProjectSourceType, {
  bg: string;
  text: string;
  border: string;
}> = {
  repository: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300'
  },
  zip: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300'
  }
};

// 仓库平台的颜色配置
export const PLATFORM_COLORS: Record<RepositoryPlatform, {
  bg: string;
  text: string;
}> = {
  github: { bg: 'bg-foreground', text: 'text-background' },
  gitlab: { bg: 'bg-orange-500', text: 'text-white' },
  other: { bg: 'bg-muted-foreground', text: 'text-background' }
};
