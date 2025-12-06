import { api } from "@/shared/config/database";

export async function runRepositoryAudit(params: {
  projectId: string;
  repoUrl: string;
  branch?: string;
  exclude?: string[];
  createdBy?: string;
  filePaths?: string[];
}) {
  // 后端会从用户配置中读取 GitHub/GitLab Token，前端不需要传递
  // The backend handles everything now. 
  // We just need to create the task (which triggers the scan in our new api implementation)
  // or call a specific scan endpoint.

  // In our new api.createAuditTask implementation (src/shared/api/database.ts), 
  // it actually calls /projects/{id}/scan which starts the process.

  const task = await api.createAuditTask({
    project_id: params.projectId,
    task_type: "repository",
    branch_name: params.branch || "main",
    exclude_patterns: params.exclude || [],
    scan_config: {
      file_paths: params.filePaths
    },
    created_by: params.createdBy || "unknown"
  } as any);

  return task.id;
}
