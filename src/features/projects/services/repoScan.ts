import { api } from "@/shared/config/database";
import { CodeAnalysisEngine } from "@/features/analysis/services";
import { taskControl } from "@/shared/services/taskControl";

type GithubTreeItem = { path: string; type: "blob" | "tree"; size?: number; url: string; sha: string };

const TEXT_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cc", ".hh", ".cs", ".php", ".rb", ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml"
  // 注意：已移除 .md，因为文档文件会导致LLM返回非JSON格式
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
    created_by: params.createdBy,
    total_files: 0,
    scanned_files: 0,
    total_lines: 0,
    issues_count: 0,
    quality_score: 0
  } as any);

  const taskId = (task as any).id as string;

  console.log(`🚀 GitHub任务已创建: ${taskId}，准备启动后台扫描...`);

  // 启动后台审计任务，不阻塞返回
  (async () => {
    console.log(`🎬 后台扫描任务开始执行: ${taskId}`);
    try {
      // 更新任务状态为运行中
      console.log(`📋 任务 ${taskId}: 开始更新状态为 running`);
      await api.updateAuditTask(taskId, {
        status: "running",
        started_at: new Date().toISOString(),
        total_files: 0,
        scanned_files: 0
      } as any);
      console.log(`✅ 任务 ${taskId}: 状态已更新为 running`);

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

      // 初始化进度，设置总文件数
      console.log(`📊 任务 ${taskId}: 设置总文件数 ${files.length}`);
      await api.updateAuditTask(taskId, {
        status: "running",
        total_files: files.length,
        scanned_files: 0
      } as any);

      let totalFiles = 0, totalLines = 0, createdIssues = 0;
      let index = 0;
      const worker = async () => {
        while (true) {
          const current = index++;
          if (current >= files.length) break;
          
          // ✓ 检查点1：分析文件前检查是否取消
          if (taskControl.isCancelled(taskId)) {
            console.log(`🛑 [检查点1] 任务 ${taskId} 已被用户取消，停止分析（在文件 ${current}/${files.length} 前）`);
            return;
          }

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
            
            // ✓ 检查点2：LLM分析完成后检查是否取消（最小化浪费）
            if (taskControl.isCancelled(taskId)) {
              console.log(`🛑 [检查点2] 任务 ${taskId} 在LLM分析完成后检测到取消，跳过保存结果（文件: ${f.path}）`);
              return;
            }
            
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
            
            // 每分析一个文件都更新进度，确保实时性
            console.log(`📈 GitHub任务 ${taskId}: 进度 ${totalFiles}/${files.length} (${Math.round(totalFiles/files.length*100)}%)`);
            await api.updateAuditTask(taskId, { 
              status: "running", 
              total_files: files.length,
              scanned_files: totalFiles, 
              total_lines: totalLines, 
              issues_count: createdIssues 
            } as any);
          } catch (fileError) {
            console.error(`分析文件失败:`, fileError);
          }
          await new Promise(r=>setTimeout(r, LLM_GAP_MS));
        }
      };

      const pool = Array.from({ length: Math.min(LLM_CONCURRENCY, files.length) }, () => worker());
      await Promise.all(pool);

      // 再次检查是否被取消
      if (taskControl.isCancelled(taskId)) {
        console.log(`🛑 任务 ${taskId} 扫描结束时检测到取消状态`);
        await api.updateAuditTask(taskId, { 
          status: "cancelled",
          total_files: files.length,
          scanned_files: totalFiles,
          total_lines: totalLines,
          issues_count: createdIssues,
          completed_at: new Date().toISOString()
        } as any);
        taskControl.cleanupTask(taskId);
        return;
      }

      // 计算质量评分（如果没有问题则100分，否则根据问题数量递减）
      const qualityScore = createdIssues === 0 ? 100 : Math.max(0, 100 - createdIssues * 2);

      await api.updateAuditTask(taskId, { 
        status: "completed", 
        total_files: files.length, 
        scanned_files: totalFiles, 
        total_lines: totalLines, 
        issues_count: createdIssues, 
        quality_score: qualityScore,
        completed_at: new Date().toISOString()
      } as any);
      
      taskControl.cleanupTask(taskId);
    } catch (e) {
      console.error('❌ GitHub审计任务执行失败:', e);
      console.error('错误详情:', e);
      try {
        await api.updateAuditTask(taskId, { status: "failed" } as any);
      } catch (updateError) {
        console.error('更新失败状态也失败了:', updateError);
      }
    }
  })().catch(err => {
    console.error('⚠️ GitHub后台任务未捕获的错误:', err);
  });

  console.log(`✅ 返回任务ID: ${taskId}，后台任务正在执行中...`);
  // 立即返回任务ID，让用户可以跳转到任务详情页面
  return taskId;
}


