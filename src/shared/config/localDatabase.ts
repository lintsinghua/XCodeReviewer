/**
 * 本地数据库实现 - 使用 IndexedDB
 * 提供与 Supabase 相同的 API 接口，但数据存储在浏览器本地
 */

import type {
	Profile,
	Project,
	ProjectMember,
	AuditTask,
	AuditIssue,
	InstantAnalysis,
	CreateProjectForm,
	CreateAuditTaskForm,
	InstantAnalysisForm,
} from "../types/index";

const DB_NAME = "xcodereviewer_local";
const DB_VERSION = 1;

// 数据库表名
const STORES = {
	PROFILES: "profiles",
	PROJECTS: "projects",
	PROJECT_MEMBERS: "project_members",
	AUDIT_TASKS: "audit_tasks",
	AUDIT_ISSUES: "audit_issues",
	INSTANT_ANALYSES: "instant_analyses",
} as const;

class LocalDatabase {
	private db: IDBDatabase | null = null;
	private initPromise: Promise<void> | null = null;

	/**
	 * 初始化数据库
	 */
	async init(): Promise<void> {
		if (this.db) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// 创建 profiles 表
				if (!db.objectStoreNames.contains(STORES.PROFILES)) {
					const profileStore = db.createObjectStore(STORES.PROFILES, {
						keyPath: "id",
					});
					profileStore.createIndex("email", "email", { unique: false });
					profileStore.createIndex("role", "role", { unique: false });
				}

				// 创建 projects 表
				if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
					const projectStore = db.createObjectStore(STORES.PROJECTS, {
						keyPath: "id",
					});
					projectStore.createIndex("owner_id", "owner_id", { unique: false });
					projectStore.createIndex("is_active", "is_active", { unique: false });
					projectStore.createIndex("created_at", "created_at", {
						unique: false,
					});
				}

				// 创建 project_members 表
				if (!db.objectStoreNames.contains(STORES.PROJECT_MEMBERS)) {
					const memberStore = db.createObjectStore(STORES.PROJECT_MEMBERS, {
						keyPath: "id",
					});
					memberStore.createIndex("project_id", "project_id", {
						unique: false,
					});
					memberStore.createIndex("user_id", "user_id", { unique: false });
				}

				// 创建 audit_tasks 表
				if (!db.objectStoreNames.contains(STORES.AUDIT_TASKS)) {
					const taskStore = db.createObjectStore(STORES.AUDIT_TASKS, {
						keyPath: "id",
					});
					taskStore.createIndex("project_id", "project_id", { unique: false });
					taskStore.createIndex("created_by", "created_by", { unique: false });
					taskStore.createIndex("status", "status", { unique: false });
					taskStore.createIndex("created_at", "created_at", { unique: false });
				}

				// 创建 audit_issues 表
				if (!db.objectStoreNames.contains(STORES.AUDIT_ISSUES)) {
					const issueStore = db.createObjectStore(STORES.AUDIT_ISSUES, {
						keyPath: "id",
					});
					issueStore.createIndex("task_id", "task_id", { unique: false });
					issueStore.createIndex("severity", "severity", { unique: false });
					issueStore.createIndex("status", "status", { unique: false });
				}

				// 创建 instant_analyses 表
				if (!db.objectStoreNames.contains(STORES.INSTANT_ANALYSES)) {
					const analysisStore = db.createObjectStore(STORES.INSTANT_ANALYSES, {
						keyPath: "id",
					});
					analysisStore.createIndex("user_id", "user_id", { unique: false });
					analysisStore.createIndex("created_at", "created_at", {
						unique: false,
					});
				}
			};
		});

		return this.initPromise;
	}

	/**
	 * 生成 UUID
	 */
	private generateId(): string {
		return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
			const r = (Math.random() * 16) | 0;
			const v = c === "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
	}

	/**
	 * 获取对象存储
	 */
	private getStore(
		storeName: string,
		mode: IDBTransactionMode = "readonly",
	): IDBObjectStore {
		if (!this.db) throw new Error("Database not initialized");
		const transaction = this.db.transaction(storeName, mode);
		return transaction.objectStore(storeName);
	}

	/**
	 * 通用查询方法
	 */
	private async getAll<T>(storeName: string): Promise<T[]> {
		await this.init();
		return new Promise((resolve, reject) => {
			const store = this.getStore(storeName);
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * 通过 ID 获取单条记录
	 */
	private async getById<T>(storeName: string, id: string): Promise<T | null> {
		if (!id) return null;

		await this.init();
		return new Promise((resolve, reject) => {
			const store = this.getStore(storeName);
			const request = store.get(id);
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * 通过索引查询
	 */
	private async getByIndex<T>(
		storeName: string,
		indexName: string,
		value: any,
	): Promise<T[]> {
		await this.init();
		return new Promise((resolve, reject) => {
			const store = this.getStore(storeName);
			const index = store.index(indexName);
			const request = index.getAll(value);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * 插入或更新记录
	 */
	private async put<T>(storeName: string, data: T): Promise<T> {
		await this.init();
		return new Promise((resolve, reject) => {
			const store = this.getStore(storeName, "readwrite");
			const request = store.put(data);
			request.onsuccess = () => resolve(data);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * 删除记录
	 */
	private async deleteRecord(storeName: string, id: string): Promise<void> {
		await this.init();
		return new Promise((resolve, reject) => {
			const store = this.getStore(storeName, "readwrite");
			const request = store.delete(id);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * 统计记录数
	 */
	private async count(storeName: string): Promise<number> {
		await this.init();
		return new Promise((resolve, reject) => {
			const store = this.getStore(storeName);
			const request = store.count();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	// ==================== Profile 相关方法 ====================

	async getProfileById(id: string): Promise<Profile | null> {
		return this.getById<Profile>(STORES.PROFILES, id);
	}

	async getProfilesCount(): Promise<number> {
		return this.count(STORES.PROFILES);
	}

	async createProfile(profile: Partial<Profile>): Promise<Profile> {
		const newProfile: Profile = {
			id: profile.id || this.generateId(),
			phone: profile.phone || undefined,
			email: profile.email || undefined,
			full_name: profile.full_name || undefined,
			avatar_url: profile.avatar_url || undefined,
			role: profile.role || "member",
			github_username: profile.github_username || undefined,
			gitlab_username: profile.gitlab_username || undefined,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		return this.put(STORES.PROFILES, newProfile);
	}

	async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
		const existing = await this.getProfileById(id);
		if (!existing) throw new Error("Profile not found");

		const updated: Profile = {
			...existing,
			...updates,
			id,
			updated_at: new Date().toISOString(),
		};
		return this.put(STORES.PROFILES, updated);
	}

	async getAllProfiles(): Promise<Profile[]> {
		return this.getAll<Profile>(STORES.PROFILES);
	}

	// ==================== Project 相关方法 ====================

	async getProjects(): Promise<Project[]> {
		const projects = await this.getAll<Project>(STORES.PROJECTS);
		const activeProjects = projects.filter((p) => p.is_active);

		// 关联 owner 信息
		const projectsWithOwner = await Promise.all(
			activeProjects.map(async (project) => {
				const owner = project.owner_id
					? await this.getProfileById(project.owner_id)
					: null;
				return { ...project, owner: owner || undefined };
			}),
		);

		return projectsWithOwner.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		);
	}

	async getProjectById(id: string): Promise<Project | null> {
		if (!id) return null;

		const project = await this.getById<Project>(STORES.PROJECTS, id);
		if (!project) return null;

		const owner = project.owner_id
			? await this.getProfileById(project.owner_id)
			: null;
		return { ...project, owner: owner || undefined };
	}

	async createProject(
		projectData: CreateProjectForm & { owner_id?: string },
	): Promise<Project> {
		const newProject: Project = {
			id: this.generateId(),
			name: projectData.name,
			description: projectData.description || undefined,
			repository_url: projectData.repository_url || undefined,
			repository_type: projectData.repository_type || "other",
			default_branch: projectData.default_branch || "main",
			programming_languages: JSON.stringify(
				projectData.programming_languages || [],
			),
			owner_id: projectData.owner_id || "local-user",
			is_active: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await this.put(STORES.PROJECTS, newProject);
		return this.getProjectById(newProject.id) as Promise<Project>;
	}

	async updateProject(
		id: string,
		updates: Partial<CreateProjectForm>,
	): Promise<Project> {
		const existing = await this.getById<Project>(STORES.PROJECTS, id);
		if (!existing) throw new Error("Project not found");

		const updateData: any = { ...updates };
		if (updates.programming_languages) {
			updateData.programming_languages = JSON.stringify(
				updates.programming_languages,
			);
		}

		const updated: Project = {
			...existing,
			...updateData,
			id,
			updated_at: new Date().toISOString(),
		};

		await this.put(STORES.PROJECTS, updated);
		return this.getProjectById(id) as Promise<Project>;
	}

	async deleteProject(id: string): Promise<void> {
		const existing = await this.getById<Project>(STORES.PROJECTS, id);
		if (!existing) throw new Error("Project not found");

		const updated: Project = {
			...existing,
			is_active: false,
			updated_at: new Date().toISOString(),
		};

		await this.put(STORES.PROJECTS, updated);
	}

	async getDeletedProjects(): Promise<Project[]> {
		const projects = await this.getAll<Project>(STORES.PROJECTS);
		const deletedProjects = projects.filter((p) => !p.is_active);

		// 关联 owner 信息
		const projectsWithOwner = await Promise.all(
			deletedProjects.map(async (project) => {
				const owner = project.owner_id
					? await this.getProfileById(project.owner_id)
					: null;
				return { ...project, owner: owner || undefined };
			}),
		);

		return projectsWithOwner.sort(
			(a, b) =>
				new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
		);
	}

	async restoreProject(id: string): Promise<void> {
		const existing = await this.getById<Project>(STORES.PROJECTS, id);
		if (!existing) throw new Error("Project not found");

		const updated: Project = {
			...existing,
			is_active: true,
			updated_at: new Date().toISOString(),
		};

		await this.put(STORES.PROJECTS, updated);
	}

	async permanentlyDeleteProject(id: string): Promise<void> {
		const existing = await this.getById<Project>(STORES.PROJECTS, id);
		if (!existing) throw new Error("Project not found");

		await this.deleteRecord(STORES.PROJECTS, id);
	}

	// ==================== ProjectMember 相关方法 ====================

	async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
		const members = await this.getByIndex<ProjectMember>(
			STORES.PROJECT_MEMBERS,
			"project_id",
			projectId,
		);

		const membersWithRelations = await Promise.all(
			members.map(async (member) => {
				const user = member.user_id
					? await this.getProfileById(member.user_id)
					: null;
				const project = member.project_id
					? await this.getProjectById(member.project_id)
					: null;
				return {
					...member,
					user: user || undefined,
					project: project || undefined,
				};
			}),
		);

		return membersWithRelations.sort(
			(a, b) =>
				new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime(),
		);
	}

	async addProjectMember(
		projectId: string,
		userId: string,
		role: string = "member",
	): Promise<ProjectMember> {
		const newMember: ProjectMember = {
			id: this.generateId(),
			project_id: projectId,
			user_id: userId,
			role: role as any,
			permissions: "{}",
			joined_at: new Date().toISOString(),
			created_at: new Date().toISOString(),
		};

		await this.put(STORES.PROJECT_MEMBERS, newMember);

		const user = userId ? await this.getProfileById(userId) : null;
		const project = projectId ? await this.getProjectById(projectId) : null;

		return {
			...newMember,
			user: user || undefined,
			project: project || undefined,
		};
	}

	// ==================== AuditTask 相关方法 ====================

	async getAuditTasks(projectId?: string): Promise<AuditTask[]> {
		let tasks: AuditTask[];

		if (projectId) {
			tasks = await this.getByIndex<AuditTask>(
				STORES.AUDIT_TASKS,
				"project_id",
				projectId,
			);
		} else {
			tasks = await this.getAll<AuditTask>(STORES.AUDIT_TASKS);
		}

		const tasksWithRelations = await Promise.all(
			tasks.map(async (task) => {
				const project = task.project_id
					? await this.getProjectById(task.project_id)
					: null;
				const creator = task.created_by
					? await this.getProfileById(task.created_by)
					: null;
				return {
					...task,
					project: project || undefined,
					creator: creator || undefined,
				};
			}),
		);

		return tasksWithRelations.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		);
	}

	async getAuditTaskById(id: string): Promise<AuditTask | null> {
		if (!id) return null;

		const task = await this.getById<AuditTask>(STORES.AUDIT_TASKS, id);
		if (!task) return null;

		const project = task.project_id
			? await this.getProjectById(task.project_id)
			: null;
		const creator = task.created_by
			? await this.getProfileById(task.created_by)
			: null;

		return {
			...task,
			project: project || undefined,
			creator: creator || undefined,
		};
	}

	async createAuditTask(
		taskData: CreateAuditTaskForm & { created_by: string },
	): Promise<AuditTask> {
		const newTask: AuditTask = {
			id: this.generateId(),
			project_id: taskData.project_id,
			task_type: taskData.task_type,
			status: "pending",
			branch_name: taskData.branch_name || undefined,
			exclude_patterns: JSON.stringify(taskData.exclude_patterns || []),
			scan_config: JSON.stringify(taskData.scan_config || {}),
			total_files: 0,
			scanned_files: 0,
			total_lines: 0,
			issues_count: 0,
			quality_score: 0,
			started_at: undefined,
			completed_at: undefined,
			created_by: taskData.created_by,
			created_at: new Date().toISOString(),
		};

		await this.put(STORES.AUDIT_TASKS, newTask);
		return this.getAuditTaskById(newTask.id) as Promise<AuditTask>;
	}

	async updateAuditTask(
		id: string,
		updates: Partial<AuditTask>,
	): Promise<AuditTask> {
		const existing = await this.getById<AuditTask>(STORES.AUDIT_TASKS, id);
		if (!existing) throw new Error("Audit task not found");

		const updated: AuditTask = {
			...existing,
			...updates,
			id,
		};

		await this.put(STORES.AUDIT_TASKS, updated);
		return this.getAuditTaskById(id) as Promise<AuditTask>;
	}

	// ==================== AuditIssue 相关方法 ====================

	async getAuditIssues(taskId: string): Promise<AuditIssue[]> {
		const issues = await this.getByIndex<AuditIssue>(
			STORES.AUDIT_ISSUES,
			"task_id",
			taskId,
		);

		const issuesWithRelations = await Promise.all(
			issues.map(async (issue) => {
				const task = issue.task_id
					? await this.getAuditTaskById(issue.task_id)
					: null;
				const resolver = issue.resolved_by
					? await this.getProfileById(issue.resolved_by)
					: null;
				return {
					...issue,
					task: task || undefined,
					resolver: resolver || undefined,
				};
			}),
		);

		// 按严重程度和创建时间排序
		const severityOrder: Record<string, number> = {
			critical: 0,
			high: 1,
			medium: 2,
			low: 3,
		};
		return issuesWithRelations.sort((a, b) => {
			const severityDiff =
				(severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999);
			if (severityDiff !== 0) return severityDiff;
			return (
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			);
		});
	}

	async createAuditIssue(
		issueData: Omit<AuditIssue, "id" | "created_at" | "task" | "resolver">,
	): Promise<AuditIssue> {
		const newIssue: AuditIssue = {
			...issueData,
			id: this.generateId(),
			created_at: new Date().toISOString(),
		};

		await this.put(STORES.AUDIT_ISSUES, newIssue);

		const task = newIssue.task_id
			? await this.getAuditTaskById(newIssue.task_id)
			: null;
		const resolver = newIssue.resolved_by
			? await this.getProfileById(newIssue.resolved_by)
			: null;

		return {
			...newIssue,
			task: task || undefined,
			resolver: resolver || undefined,
		};
	}

	async updateAuditIssue(
		id: string,
		updates: Partial<AuditIssue>,
	): Promise<AuditIssue> {
		const existing = await this.getById<AuditIssue>(STORES.AUDIT_ISSUES, id);
		if (!existing) throw new Error("Audit issue not found");

		const updated: AuditIssue = {
			...existing,
			...updates,
			id,
		};

		await this.put(STORES.AUDIT_ISSUES, updated);

		const task = updated.task_id
			? await this.getAuditTaskById(updated.task_id)
			: null;
		const resolver = updated.resolved_by
			? await this.getProfileById(updated.resolved_by)
			: null;

		return {
			...updated,
			task: task || undefined,
			resolver: resolver || undefined,
		};
	}

	// ==================== InstantAnalysis 相关方法 ====================

	async getInstantAnalyses(userId?: string): Promise<InstantAnalysis[]> {
		let analyses: InstantAnalysis[];

		if (userId) {
			analyses = await this.getByIndex<InstantAnalysis>(
				STORES.INSTANT_ANALYSES,
				"user_id",
				userId,
			);
		} else {
			analyses = await this.getAll<InstantAnalysis>(STORES.INSTANT_ANALYSES);
		}

		const analysesWithUser = await Promise.all(
			analyses.map(async (analysis) => {
				const user = analysis.user_id
					? await this.getProfileById(analysis.user_id)
					: null;
				return { ...analysis, user: user || undefined };
			}),
		);

		return analysesWithUser.sort(
			(a, b) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
		);
	}

	async createInstantAnalysis(
		analysisData: InstantAnalysisForm & {
			user_id: string;
			analysis_result?: string;
			issues_count?: number;
			quality_score?: number;
			analysis_time?: number;
		},
	): Promise<InstantAnalysis> {
		const newAnalysis: InstantAnalysis = {
			id: this.generateId(),
			user_id: analysisData.user_id,
			language: analysisData.language,
			code_content: "", // 不持久化代码内容
			analysis_result: analysisData.analysis_result || "{}",
			issues_count: analysisData.issues_count || 0,
			quality_score: analysisData.quality_score || 0,
			analysis_time: analysisData.analysis_time || 0,
			created_at: new Date().toISOString(),
		};

		await this.put(STORES.INSTANT_ANALYSES, newAnalysis);

		const user = newAnalysis.user_id
			? await this.getProfileById(newAnalysis.user_id)
			: null;
		return { ...newAnalysis, user: user || undefined };
	}

	// ==================== 统计相关方法 ====================

	async getProjectStats(): Promise<any> {
		const projects = await this.getAll<Project>(STORES.PROJECTS);
		const tasks = await this.getAll<AuditTask>(STORES.AUDIT_TASKS);
		const issues = await this.getAll<AuditIssue>(STORES.AUDIT_ISSUES);

		return {
			total_projects: projects.length,
			active_projects: projects.filter((p) => p.is_active).length,
			total_tasks: tasks.length,
			completed_tasks: tasks.filter((t) => t.status === "completed").length,
			total_issues: issues.length,
			resolved_issues: issues.filter((i) => i.status === "resolved").length,
		};
	}
}

// 导出单例
export const localDB = new LocalDatabase();
