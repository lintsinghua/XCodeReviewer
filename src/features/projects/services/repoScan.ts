import { api } from "@/shared/config/database";
import { CodeAnalysisEngine } from "@/features/analysis/services";

type GithubTreeItem = { path: string; type: "blob" | "tree"; size?: number; url: string; sha: string };

const TEXT_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cs", ".php", ".rb", ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml", ".md"
];
const MAX_FILE_SIZE_BYTES = 200 * 1024;
const MAX_ANALYZE_FILES = Number(import.meta.env.VITE_MAX_ANALYZE_FILES || 40);
const LLM_CONCURRENCY = Number(import.meta.env.VITE_LLM_CONCURRENCY || 2);
const LLM_GAP_MS = Number(import.meta.env.VITE_LLM_GAP_MS || 500);

const isTextFile = (p: string) => TEXT_EXTENSIONS.some(ext => p.toLowerCase().endsWith(ext));
const matchExclude = (p: string, ex: string[]) => ex.some(e => p.includes(e.replace(/^\//, "")) || (e.endsWith("/**") && p.startsWith(e.slice(0, -3).replace(/^\//, ""))));

async function githubApi<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Accept": "application/vnd.github+json" };
  const t = token || (import.meta.env.VITE_GITHUB_TOKEN as string | undefined);
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 403) throw new Error("GitHub API 403：请配置 VITE_GITHUB_TOKEN 或确认仓库权限/频率限制");
    throw new Error(`GitHub API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function runRepositoryAudit(params: {
  projectId: string;
  repoUrl: string;
  branch?: string;
  exclude?: string[];
  githubToken?: string;
  createdBy?: string;
}) {
  const branch = params.branch || "main";
  const excludes = params.exclude || [];
  const task = await api.createAuditTask({
    project_id: params.projectId,
    task_type: "repository",
    branch_name: branch,
    exclude_patterns: excludes,
    scan_config: {},
    created_by: params.createdBy
  } as any);

  const taskId = (task as any).id as string;

  // 启动后台审计任务，不阻塞返回
  (async () => {
    try {
      const m = params.repoUrl.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i);
      if (!m) throw new Error("仅支持 GitHub 仓库 URL，例如 https://github.com/owner/repo");
      const owner = m[1];
      const repo = m[2];

      const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
      const tree = await githubApi<{ tree: GithubTreeItem[] }>(treeUrl, params.githubToken);
      let files = (tree.tree || []).filter(i => i.type === "blob" && isTextFile(i.path) && !matchExclude(i.path, excludes));
      // 采样限制，优先分析较小文件与常见语言
      files = files
        .sort((a, b) => (a.path.length - b.path.length))
        .slice(0, MAX_ANALYZE_FILES);

      let totalFiles = 0, totalLines = 0, createdIssues = 0;
      let index = 0;
      const worker = async () => {
        while (true) {
          const current = index++;
          if (current >= files.length) break;
          const f = files[current];
          totalFiles++;
          try {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${f.path}`;
            const contentRes = await fetch(rawUrl);
            if (!contentRes.ok) { await new Promise(r=>setTimeout(r, LLM_GAP_MS)); continue; }
            const content = await contentRes.text();
            if (content.length > MAX_FILE_SIZE_BYTES) { await new Promise(r=>setTimeout(r, LLM_GAP_MS)); continue; }
            totalLines += content.split(/\r?\n/).length;
            const language = (f.path.split(".").pop() || "").toLowerCase();
            const analysis = await CodeAnalysisEngine.analyzeCode(content, language);
            const issues = analysis.issues || [];
            createdIssues += issues.length;
            for (const issue of issues) {
              await api.createAuditIssue({
                task_id: taskId,
                file_path: f.path,
                line_number: issue.line || null,
                column_number: issue.column || null,
                issue_type: issue.type || "maintainability",
                severity: issue.severity || "low",
                title: issue.title || "Issue",
                description: issue.description || null,
                suggestion: issue.suggestion || null,
                code_snippet: issue.code_snippet || null,
                ai_explanation: issue.xai ? JSON.stringify(issue.xai) : (issue.ai_explanation || null),
                status: "open",
                resolved_by: null,
                resolved_at: null
              } as any);
            }
            if (totalFiles % 10 === 0) {
              await api.updateAuditTask(taskId, { status: "running", total_files: totalFiles, scanned_files: totalFiles, total_lines: totalLines, issues_count: createdIssues } as any);
            }
          } catch {}
          await new Promise(r=>setTimeout(r, LLM_GAP_MS));
        }
      };

      const pool = Array.from({ length: Math.min(LLM_CONCURRENCY, files.length) }, () => worker());
      await Promise.all(pool);

      await api.updateAuditTask(taskId, { status: "completed", total_files: totalFiles, scanned_files: totalFiles, total_lines: totalLines, issues_count: createdIssues, quality_score: 0 } as any);
    } catch (e) {
      console.error('审计任务执行失败:', e);
      await api.updateAuditTask(taskId, { status: "failed" } as any);
    }
  })();

  // 立即返回任务ID，让用户可以跳转到任务详情页面
  return taskId;
}


