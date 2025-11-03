/**
 * 统一 API 服务
 * 根据配置自动切换使用本地 IndexedDB 或后端 API
 */

import { api as localApi } from '@/shared/config/database';
import { api as backendApi } from '@/shared/services/api';
import type {
  Profile,
  Project,
  ProjectMember,
  AuditTask,
  AuditIssue,
  InstantAnalysis,
  CreateProjectForm,
  CreateAuditTaskForm,
  InstantAnalysisForm
} from '../types';

// 检查是否使用后端 API
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND_API === 'true';

console.log(`🔌 API Mode: ${USE_BACKEND ? 'Backend API' : 'Local IndexedDB'}`);

/**
 * 后端 API 数据格式转换适配器
 */
class BackendAPIAdapter {
  /**
   * 转换后端项目数据为前端格式
   */
  private transformProject(backendProject: any): Project {
    return {
      id: backendProject.id?.toString() || backendProject.id,
      name: backendProject.name,
      description: backendProject.description || '',
      repository_url: backendProject.repository_url || '',
      repository_type: backendProject.repository_type || 'github',
      default_branch: backendProject.default_branch || 'main',
      programming_languages: typeof backendProject.programming_languages === 'string'
        ? backendProject.programming_languages
        : JSON.stringify(backendProject.programming_languages || []),
      owner_id: backendProject.owner_id || backendProject.created_by || 'unknown',
      owner: backendProject.owner,
      is_active: backendProject.is_active ?? true,
      created_at: backendProject.created_at || new Date().toISOString(),
      updated_at: backendProject.updated_at || new Date().toISOString()
    };
  }

  /**
   * 转换后端任务数据为前端格式
   */
  private transformTask(backendTask: any): AuditTask {
    return {
      id: backendTask.id?.toString() || backendTask.id,
      project_id: backendTask.project_id?.toString() || backendTask.project_id,
      project: backendTask.project ? this.transformProject(backendTask.project) : undefined,
      task_type: backendTask.task_type || 'full_scan',
      branch_name: backendTask.branch_name || 'main',
      status: backendTask.status || 'pending',
      total_files: backendTask.total_files || 0,
      scanned_files: backendTask.scanned_files || 0,
      issues_count: backendTask.issues_count || 0,
      exclude_patterns: typeof backendTask.exclude_patterns === 'string'
        ? backendTask.exclude_patterns
        : JSON.stringify(backendTask.exclude_patterns || []),
      scan_config: typeof backendTask.scan_config === 'string'
        ? backendTask.scan_config
        : JSON.stringify(backendTask.scan_config || {}),
      error_message: backendTask.error_message || null,
      started_at: backendTask.started_at || null,
      completed_at: backendTask.completed_at || null,
      created_by: backendTask.created_by || 'unknown',
      creator: backendTask.creator,
      created_at: backendTask.created_at || new Date().toISOString()
    };
  }

  /**
   * 转换后端问题数据为前端格式
   */
  private transformIssue(backendIssue: any): AuditIssue {
    return {
      id: backendIssue.id?.toString() || backendIssue.id,
      task_id: backendIssue.task_id?.toString() || backendIssue.task_id,
      task: backendIssue.task ? this.transformTask(backendIssue.task) : undefined,
      category: backendIssue.category || 'other',
      severity: backendIssue.severity || 'info',
      title: backendIssue.title || '未知问题',
      description: backendIssue.description || '',
      file_path: backendIssue.file_path || '',
      line_number: backendIssue.line_number || 0,
      column_number: backendIssue.column_number || null,
      code_snippet: backendIssue.code_snippet || '',
      suggestion: backendIssue.suggestion || '',
      status: backendIssue.status || 'open',
      resolved_by: backendIssue.resolved_by || null,
      resolver: backendIssue.resolver,
      resolved_at: backendIssue.resolved_at || null,
      created_at: backendIssue.created_at || new Date().toISOString()
    };
  }

  // ==================== 项目相关 ====================
  
  async getProjects(): Promise<Project[]> {
    const response = await backendApi.projects.list();
    const projects = response.items || response.data || response;
    return Array.isArray(projects) ? projects.map(p => this.transformProject(p)) : [];
  }

  async getProjectById(id: string): Promise<Project | null> {
    try {
      const project = await backendApi.projects.get(Number(id));
      return project ? this.transformProject(project) : null;
    } catch (error) {
      console.error('获取项目失败:', error);
      return null;
    }
  }

  async createProject(project: CreateProjectForm & { owner_id?: string }): Promise<Project> {
    // 将前端字段名映射到后端 API 期望的字段名
    const created = await backendApi.projects.create({
      name: project.name,
      description: project.description || '',
      source_url: project.repository_url || '',  // repository_url → source_url
      source_type: (project.repository_type || 'github') as any,  // repository_type → source_type
      branch: project.default_branch || 'main',  // default_branch → branch
      repository_name: this.extractRepoName(project.repository_url)  // 从 URL 提取仓库名
    });
    return this.transformProject(created);
  }

  /**
   * 从 repository URL 提取仓库名称
   * 例如: https://github.com/owner/repo -> owner/repo
   */
  private extractRepoName(url?: string): string | undefined {
    if (!url) return undefined;
    
    try {
      // 匹配 GitHub/GitLab URL 模式
      const match = url.match(/(?:github\.com|gitlab\.com)\/([^/]+\/[^/]+)/);
      if (match && match[1]) {
        return match[1].replace(/\.git$/, ''); // 移除 .git 后缀
      }
    } catch (error) {
      console.warn('Failed to extract repository name from URL:', url, error);
    }
    
    return undefined;
  }

  async updateProject(id: string, updates: Partial<CreateProjectForm>): Promise<Project> {
    const updated = await backendApi.projects.update(Number(id), updates);
    return this.transformProject(updated);
  }

  async deleteProject(id: string): Promise<void> {
    await backendApi.projects.delete(Number(id));
  }

  async getDeletedProjects(): Promise<Project[]> {
    try {
      const response = await backendApi.projects.listDeleted({ page: 1, page_size: 100 });
      return response.items.map(p => this.transformProject(p));
    } catch (error) {
      console.error('获取已删除项目失败:', error);
      return [];
    }
  }

  async restoreProject(id: string): Promise<void> {
    try {
      await backendApi.projects.restore(Number(id));
    } catch (error) {
      console.error('恢复项目失败:', error);
      throw error;
    }
  }

  async permanentlyDeleteProject(id: string): Promise<void> {
    // 永久删除暂时使用软删除（后端可以添加一个 force 参数来实现真正的物理删除）
    await backendApi.projects.delete(Number(id));
  }

  // ==================== 任务相关 ====================

  async getAuditTasks(projectId?: string): Promise<AuditTask[]> {
    const params: any = {};
    if (projectId) {
      params.project_id = Number(projectId);
    }
    const response = await backendApi.tasks.list(params);
    const tasks = response.items || response.data || response;
    return Array.isArray(tasks) ? tasks.map(t => this.transformTask(t)) : [];
  }

  async getAuditTaskById(id: string): Promise<AuditTask | null> {
    try {
      const task = await backendApi.tasks.get(Number(id));
      return task ? this.transformTask(task) : null;
    } catch (error) {
      console.error('获取任务失败:', error);
      return null;
    }
  }

  async createAuditTask(task: CreateAuditTaskForm & { created_by: string }): Promise<AuditTask> {
    const created = await backendApi.tasks.create({
      project_id: Number(task.project_id),
      task_type: task.task_type || 'full_scan',
      branch_name: task.branch_name || 'main',
      exclude_patterns: task.exclude_patterns || [],
      scan_config: task.scan_config || {}
    });
    return this.transformTask(created);
  }

  async updateAuditTask(id: string, updates: Partial<AuditTask>): Promise<AuditTask> {
    const updated = await backendApi.tasks.update(Number(id), updates);
    return this.transformTask(updated);
  }

  // ==================== 问题相关 ====================

  async getAuditIssues(taskId: string): Promise<AuditIssue[]> {
    const response = await backendApi.issues.list({ task_id: Number(taskId) });
    const issues = response.items || response.data || response;
    return Array.isArray(issues) ? issues.map(i => this.transformIssue(i)) : [];
  }

  async createAuditIssue(issue: Omit<AuditIssue, 'id' | 'created_at' | 'task' | 'resolver'>): Promise<AuditIssue> {
    // 后端需要通过任务扫描自动创建问题，不支持手动创建
    throw new Error('后端不支持手动创建问题');
  }

  async updateAuditIssue(id: string, updates: Partial<AuditIssue>): Promise<AuditIssue> {
    const updated = await backendApi.issues.update(Number(id), updates);
    return this.transformIssue(updated);
  }

  // ==================== 统计相关 ====================

  async getProjectStats(): Promise<any> {
    try {
      const stats = await backendApi.statistics.getOverview();
      return {
        total_projects: stats.total_projects || 0,
        active_projects: stats.active_projects || 0,
        total_tasks: stats.total_tasks || 0,
        completed_tasks: stats.completed_tasks || 0,
        total_issues: stats.total_issues || 0,
        resolved_issues: stats.resolved_issues || 0,
        avg_quality_score: stats.avg_quality_score || 0
      };
    } catch (error) {
      console.error('获取统计数据失败:', error);
      return {
        total_projects: 0,
        active_projects: 0,
        total_tasks: 0,
        completed_tasks: 0,
        total_issues: 0,
        resolved_issues: 0,
        avg_quality_score: 0
      };
    }
  }

  // ==================== 用户相关 ====================

  async getProfilesById(id: string): Promise<Profile | null> {
    // 后端暂不支持，使用本地 API
    return localApi.getProfilesById(id);
  }

  async getProfilesCount(): Promise<number> {
    return localApi.getProfilesCount();
  }

  async createProfiles(profile: Partial<Profile>): Promise<Profile> {
    return localApi.createProfiles(profile);
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    return localApi.updateProfile(id, updates);
  }

  async getAllProfiles(): Promise<Profile[]> {
    return localApi.getAllProfiles();
  }

  // ==================== 项目成员相关 ====================

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return localApi.getProjectMembers(projectId);
  }

  async addProjectMember(projectId: string, userId: string, role: string = 'member'): Promise<ProjectMember> {
    return localApi.addProjectMember(projectId, userId, role);
  }

  // ==================== 即时分析相关 ====================

  async getInstantAnalyses(userId?: string): Promise<InstantAnalysis[]> {
    return localApi.getInstantAnalyses(userId);
  }

  async createInstantAnalysis(analysis: InstantAnalysisForm & {
    user_id: string;
    analysis_result?: string;
    issues_count?: number;
    quality_score?: number;
    analysis_time?: number;
  }): Promise<InstantAnalysis> {
    return localApi.createInstantAnalysis(analysis);
  }
}

// 创建适配器实例
const backendAdapter = new BackendAPIAdapter();

/**
 * 统一 API
 * 根据配置自动切换使用本地或后端 API
 */
export const unifiedApi = {
  // 项目相关
  getProjects: () => USE_BACKEND ? backendAdapter.getProjects() : localApi.getProjects(),
  getProjectById: (id: string) => USE_BACKEND ? backendAdapter.getProjectById(id) : localApi.getProjectById(id),
  createProject: (project: CreateProjectForm & { owner_id?: string }) =>
    USE_BACKEND ? backendAdapter.createProject(project) : localApi.createProject(project),
  updateProject: (id: string, updates: Partial<CreateProjectForm>) =>
    USE_BACKEND ? backendAdapter.updateProject(id, updates) : localApi.updateProject(id, updates),
  deleteProject: (id: string) => USE_BACKEND ? backendAdapter.deleteProject(id) : localApi.deleteProject(id),
  getDeletedProjects: () => USE_BACKEND ? backendAdapter.getDeletedProjects() : localApi.getDeletedProjects(),
  restoreProject: (id: string) => USE_BACKEND ? backendAdapter.restoreProject(id) : localApi.restoreProject(id),
  permanentlyDeleteProject: (id: string) =>
    USE_BACKEND ? backendAdapter.permanentlyDeleteProject(id) : localApi.permanentlyDeleteProject(id),

  // 任务相关
  getAuditTasks: (projectId?: string) => USE_BACKEND ? backendAdapter.getAuditTasks(projectId) : localApi.getAuditTasks(projectId),
  getAuditTaskById: (id: string) => USE_BACKEND ? backendAdapter.getAuditTaskById(id) : localApi.getAuditTaskById(id),
  createAuditTask: (task: CreateAuditTaskForm & { created_by: string }) =>
    USE_BACKEND ? backendAdapter.createAuditTask(task) : localApi.createAuditTask(task),
  updateAuditTask: (id: string, updates: Partial<AuditTask>) =>
    USE_BACKEND ? backendAdapter.updateAuditTask(id, updates) : localApi.updateAuditTask(id, updates),

  // 问题相关
  getAuditIssues: (taskId: string) => USE_BACKEND ? backendAdapter.getAuditIssues(taskId) : localApi.getAuditIssues(taskId),
  createAuditIssue: (issue: Omit<AuditIssue, 'id' | 'created_at' | 'task' | 'resolver'>) =>
    USE_BACKEND ? backendAdapter.createAuditIssue(issue) : localApi.createAuditIssue(issue),
  updateAuditIssue: (id: string, updates: Partial<AuditIssue>) =>
    USE_BACKEND ? backendAdapter.updateAuditIssue(id, updates) : localApi.updateAuditIssue(id, updates),

  // 统计相关
  getProjectStats: () => USE_BACKEND ? backendAdapter.getProjectStats() : localApi.getProjectStats(),

  // 用户相关
  getProfilesById: (id: string) => USE_BACKEND ? backendAdapter.getProfilesById(id) : localApi.getProfilesById(id),
  getProfilesCount: () => USE_BACKEND ? backendAdapter.getProfilesCount() : localApi.getProfilesCount(),
  createProfiles: (profile: Partial<Profile>) => USE_BACKEND ? backendAdapter.createProfiles(profile) : localApi.createProfiles(profile),
  updateProfile: (id: string, updates: Partial<Profile>) =>
    USE_BACKEND ? backendAdapter.updateProfile(id, updates) : localApi.updateProfile(id, updates),
  getAllProfiles: () => USE_BACKEND ? backendAdapter.getAllProfiles() : localApi.getAllProfiles(),

  // 项目成员相关
  getProjectMembers: (projectId: string) => USE_BACKEND ? backendAdapter.getProjectMembers(projectId) : localApi.getProjectMembers(projectId),
  addProjectMember: (projectId: string, userId: string, role: string = 'member') =>
    USE_BACKEND ? backendAdapter.addProjectMember(projectId, userId, role) : localApi.addProjectMember(projectId, userId, role),

  // 即时分析相关
  getInstantAnalyses: (userId?: string) => USE_BACKEND ? backendAdapter.getInstantAnalyses(userId) : localApi.getInstantAnalyses(userId),
  createInstantAnalysis: (analysis: InstantAnalysisForm & {
    user_id: string;
    analysis_result?: string;
    issues_count?: number;
    quality_score?: number;
    analysis_time?: number;
  }) => USE_BACKEND ? backendAdapter.createInstantAnalysis(analysis) : localApi.createInstantAnalysis(analysis),
};

// 导出为默认 api
export const api = unifiedApi;
export default unifiedApi;

