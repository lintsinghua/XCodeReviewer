import { createClient } from "@supabase/supabase-js";
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
} from "@/types/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidUuid = (value?: string): boolean => {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

// 检查是否配置了 Supabase
const hasSupabaseConfig = supabaseUrl && supabaseAnonKey;

// 如果没有配置 Supabase，使用虚拟配置避免错误
const finalSupabaseUrl = hasSupabaseConfig ? supabaseUrl : 'https://demo.supabase.co';
const finalSupabaseKey = hasSupabaseConfig ? supabaseAnonKey : 'demo-key';

export const supabase = hasSupabaseConfig ? createClient(finalSupabaseUrl, finalSupabaseKey, {
  global: {
    fetch: undefined
  },
  auth: {
    storageKey: (import.meta.env.VITE_APP_ID || "sb") + "-auth-token"
  }
}) : null;

// 演示模式标识
export const isDemoMode = !hasSupabaseConfig;

// 演示数据
const demoProfile: Profile = {
  id: 'demo-user',
  phone: null,
  email: 'demo@xcodereviewer.com',
  full_name: 'Demo User',
  avatar_url: null,
  role: 'admin',
  github_username: 'demo-user',
  gitlab_username: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// 用户相关API
export const api = {
  // Profile相关
  async getProfilesById(id: string): Promise<Profile | null> {
    if (isDemoMode) {
      return demoProfile;
    }
    
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  },

  async getProfilesCount(): Promise<number> {
    if (isDemoMode) {
      return 1;
    }
    
    if (!supabase) return 0;
    
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    return count || 0;
  },

  async createProfiles(profile: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{ 
        id: profile.id,
        phone: profile.phone || null,
        email: profile.email || null,
        full_name: profile.full_name || null,
        avatar_url: profile.avatar_url || null,
        role: profile.role || 'member',
        github_username: profile.github_username || null,
        gitlab_username: profile.gitlab_username || null
      }])
      .select()
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as Profile;
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as Profile;
  },

  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  // Project相关
  async getProjects(): Promise<Project[]> {
    if (isDemoMode) {
      return [{
        id: 'demo-project-1',
        name: 'Demo Project',
        description: '这是一个演示项目，展示 XCodeReviewer 的功能',
        repository_url: 'https://github.com/demo/project',
        repository_type: 'github',
        default_branch: 'main',
        programming_languages: JSON.stringify(['TypeScript', 'JavaScript', 'React']),
        owner_id: 'demo-user',
        owner: demoProfile,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }];
    }
    
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        owner:profiles!projects_owner_id_fkey(*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async getProjectById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        owner:profiles!projects_owner_id_fkey(*)
      `)
      .eq('id', id)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  },

  async createProject(project: CreateProjectForm & { owner_id?: string }): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ 
        name: project.name,
        description: project.description || null,
        repository_url: project.repository_url || null,
        repository_type: project.repository_type || 'other',
        default_branch: project.default_branch || 'main',
        programming_languages: JSON.stringify(project.programming_languages || []),
        owner_id: isValidUuid(project.owner_id) ? project.owner_id : null,
        is_active: true
      }])
      .select(`
        *,
        owner:profiles!projects_owner_id_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as Project;
  },

  async updateProject(id: string, updates: Partial<CreateProjectForm>): Promise<Project> {
    const updateData: any = { ...updates };
    if (updates.programming_languages) {
      updateData.programming_languages = JSON.stringify(updates.programming_languages);
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        owner:profiles!projects_owner_id_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as Project;
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
  },

  // ProjectMember相关
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        user:profiles!project_members_user_id_fkey(*),
        project:projects!project_members_project_id_fkey(*)
      `)
      .eq('project_id', projectId)
      .order('joined_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async addProjectMember(projectId: string, userId: string, role: string = 'member'): Promise<ProjectMember> {
    const { data, error } = await supabase
      .from('project_members')
      .insert([{ 
        project_id: projectId,
        user_id: userId,
        role: role,
        permissions: '{}'
      }])
      .select(`
        *,
        user:profiles!project_members_user_id_fkey(*),
        project:projects!project_members_project_id_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as ProjectMember;
  },

  // AuditTask相关
  async getAuditTasks(projectId?: string): Promise<AuditTask[]> {
    let query = supabase
      .from('audit_tasks')
      .select(`
        *,
        project:projects!audit_tasks_project_id_fkey(*),
        creator:profiles!audit_tasks_created_by_fkey(*)
      `);
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async getAuditTaskById(id: string): Promise<AuditTask | null> {
    const { data, error } = await supabase
      .from('audit_tasks')
      .select(`
        *,
        project:projects!audit_tasks_project_id_fkey(*),
        creator:profiles!audit_tasks_created_by_fkey(*)
      `)
      .eq('id', id)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  },

  async createAuditTask(task: CreateAuditTaskForm & { created_by: string }): Promise<AuditTask> {
    const { data, error } = await supabase
      .from('audit_tasks')
      .insert([{ 
        project_id: task.project_id,
        task_type: task.task_type,
        branch_name: task.branch_name || null,
        exclude_patterns: JSON.stringify(task.exclude_patterns || []),
        scan_config: JSON.stringify(task.scan_config || {}),
        created_by: task.created_by,
        status: 'pending'
      }])
      .select(`
        *,
        project:projects!audit_tasks_project_id_fkey(*),
        creator:profiles!audit_tasks_created_by_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as AuditTask;
  },

  async updateAuditTask(id: string, updates: Partial<AuditTask>): Promise<AuditTask> {
    const { data, error } = await supabase
      .from('audit_tasks')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        project:projects!audit_tasks_project_id_fkey(*),
        creator:profiles!audit_tasks_created_by_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as AuditTask;
  },

  // AuditIssue相关
  async getAuditIssues(taskId: string): Promise<AuditIssue[]> {
    const { data, error } = await supabase
      .from('audit_issues')
      .select(`
        *,
        task:audit_tasks!audit_issues_task_id_fkey(*),
        resolver:profiles!audit_issues_resolved_by_fkey(*)
      `)
      .eq('task_id', taskId)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async createAuditIssue(issue: Omit<AuditIssue, 'id' | 'created_at' | 'task' | 'resolver'>): Promise<AuditIssue> {
    const { data, error } = await supabase
      .from('audit_issues')
      .insert([issue])
      .select(`
        *,
        task:audit_tasks!audit_issues_task_id_fkey(*),
        resolver:profiles!audit_issues_resolved_by_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as AuditIssue;
  },

  async updateAuditIssue(id: string, updates: Partial<AuditIssue>): Promise<AuditIssue> {
    const { data, error } = await supabase
      .from('audit_issues')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        task:audit_tasks!audit_issues_task_id_fkey(*),
        resolver:profiles!audit_issues_resolved_by_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as AuditIssue;
  },

  // InstantAnalysis相关
  async getInstantAnalyses(userId?: string): Promise<InstantAnalysis[]> {
    let query = supabase
      .from('instant_analyses')
      .select(`
        *,
        user:profiles!instant_analyses_user_id_fkey(*)
      `);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async createInstantAnalysis(analysis: InstantAnalysisForm & { 
    user_id: string;
    analysis_result?: string;
    issues_count?: number;
    quality_score?: number;
    analysis_time?: number;
  }): Promise<InstantAnalysis> {
    const { data, error } = await supabase
      .from('instant_analyses')
      .insert([{
        user_id: analysis.user_id,
        language: analysis.language,
        // 遵循安全要求：不持久化用户代码内容
        code_content: '',
        analysis_result: analysis.analysis_result || '{}',
        issues_count: analysis.issues_count || 0,
        quality_score: analysis.quality_score || 0,
        analysis_time: analysis.analysis_time || 0
      }])
      .select(`
        *,
        user:profiles!instant_analyses_user_id_fkey(*)
      `)
      .limit(1);
    
    if (error) throw error;
    return Array.isArray(data) && data.length > 0 ? data[0] : {} as InstantAnalysis;
  },

  // 统计相关
  async getProjectStats(): Promise<any> {
    if (isDemoMode) {
      return {
        total_projects: 1,
        active_projects: 1,
        total_tasks: 3,
        completed_tasks: 2,
        total_issues: 15,
        resolved_issues: 12
      };
    }
    
    if (!supabase) {
      return {
        total_projects: 0,
        active_projects: 0,
        total_tasks: 0,
        completed_tasks: 0,
        total_issues: 0,
        resolved_issues: 0
      };
    }

    const [projectsResult, tasksResult, issuesResult] = await Promise.all([
      supabase.from('projects').select('id, is_active', { count: 'exact' }),
      supabase.from('audit_tasks').select('id, status', { count: 'exact' }),
      supabase.from('audit_issues').select('id, status', { count: 'exact' })
    ]);

    return {
      total_projects: projectsResult.count || 0,
      active_projects: projectsResult.data?.filter(p => p.is_active).length || 0,
      total_tasks: tasksResult.count || 0,
      completed_tasks: tasksResult.data?.filter(t => t.status === 'completed').length || 0,
      total_issues: issuesResult.count || 0,
      resolved_issues: issuesResult.data?.filter(i => i.status === 'resolved').length || 0
    };
  }
};