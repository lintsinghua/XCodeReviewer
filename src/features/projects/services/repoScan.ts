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

async function gitlabApi<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = token || (import.meta.env.VITE_GITLAB_TOKEN as string | undefined);
  if (t) headers["PRIVATE-TOKEN"] = t;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 401) throw new Error("GitLab API 401：请配置 VITE_GITLAB_TOKEN 或确认仓库权限");
    if (res.status === 403) throw new Error("GitLab API 403：请确认仓库权限/频率限制");
    throw new Error(`GitLab API ${res.status}: ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function runRepositoryAudit(params: {
  projectId: string;
  repoUrl: string;
  branch?: string;
  exclude?: string[];
  githubToken?: string;
  gitlabToken?: string;
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
  // 基于项目的 repository_type 决定仓库类型，不再使用正则
  const project = await api.getProjectById(params.projectId);
  const repoUrl = params.repoUrl || project?.repository_url || '';
  if (!repoUrl) throw new Error('仓库地址为空，请在项目中填写 repository_url');
  const repoTypeKey = project?.repository_type;
  const isGitHub = repoTypeKey === 'github';
  const isGitLab = repoTypeKey === 'gitlab';
  const repoType = isGitHub ? "GitHub" : isGitLab ? "GitLab" : "Git";

  console.log(`🚀 ${repoType}任务已创建: ${taskId}，准备启动后台扫描...`);

  // 记录审计任务开始
  import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
    logger.info(LogCategory.SYSTEM, `开始审计任务: ${taskId}`, {
      taskId,
      projectId: params.projectId,
      repoUrl,
      branch,
      repoType,
    });
  });

  // 启动后台审计任务，不阻塞返回
  (async () => {
    console.log(`🎬 后台扫描任务开始执行: ${taskId}`);
    try {
      console.log(`📡 任务 ${taskId}: 正在获取仓库文件列表...`);
      
      let files: { path: string; url?: string }[] = [];

      if (isGitHub) {
        // GitHub 仓库处理
        const m = repoUrl.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i);
        if (!m) throw new Error("GitHub 仓库 URL 格式错误，例如 https://github.com/owner/repo");
        const owner = m[1];
        const repo = m[2];

        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
        const tree = await githubApi<{ tree: GithubTreeItem[] }>(treeUrl, params.githubToken);
        files = (tree.tree || [])
          .filter(i => i.type === "blob" && isTextFile(i.path) && !matchExclude(i.path, excludes))
          .map(i => ({ path: i.path, url: `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${i.path}` }));
      } else if (isGitLab) {
        // GitLab 仓库处理（支持自定义域名/IP）：基于仓库 URL 动态构建 API 基地址
        const u = new URL(repoUrl);
        const base = `${u.protocol}//${u.host}`; // 例如 https://git.dev-rs.com 或 http://192.168.1.10
        // 解析项目路径，支持多级 group/subgroup，去除开头/结尾斜杠与 .git 后缀
        const path = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
        if (!path) {
          throw new Error("GitLab 仓库 URL 格式错误，例如 https://<your-gitlab-host>/<group>/<project>");
        }
        const projectPath = encodeURIComponent(path);

        const treeUrl = `${base}/api/v4/projects/${projectPath}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100`;
        console.log(`📡 GitLab API: 获取仓库文件树 - ${treeUrl}`);
        const tree = await gitlabApi<Array<{ path: string; type: string }>>(treeUrl, params.gitlabToken);
        console.log(`✅ GitLab API: 获取到 ${tree.length} 个项目`);

        files = tree
          .filter(i => i.type === "blob" && isTextFile(i.path) && !matchExclude(i.path, excludes))
          .map(i => ({ 
            path: i.path, 
            // GitLab 文件 API 路径需要完整的 URL 编码（包括斜杠）
            url: `${base}/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(i.path)}/raw?ref=${encodeURIComponent(branch)}` 
          }));

        console.log(`📝 GitLab: 过滤后可分析文件 ${files.length} 个`);
        if (tree.length >= 100) {
          console.warn(`⚠️ GitLab: 文件数量达到API限制(100)，可能有文件未被扫描。建议使用排除模式减少文件数。`);
        }
      } else {
        throw new Error("不支持的仓库类型，仅支持 GitHub 和 GitLab 仓库");
      }

      // 采样限制，优先分析较小文件与常见语言
      files = files
        .sort((a, b) => (a.path.length - b.path.length))
        .slice(0, MAX_ANALYZE_FILES);

      // 立即更新状态为 running 并设置总文件数，让用户看到进度
      console.log(`📊 任务 ${taskId}: 获取到 ${files.length} 个文件，开始分析`);
      await api.updateAuditTask(taskId, {
        status: "running",
        started_at: new Date().toISOString(),
        total_files: files.length,
        scanned_files: 0
      } as any);
      console.log(`✅ 任务 ${taskId}: 状态已更新为 running，total_files=${files.length}`);

      let totalFiles = 0, totalLines = 0, createdIssues = 0;
      let index = 0;
      let failedCount = 0;  // 失败计数器
      let consecutiveFailures = 0;  // 连续失败计数
      const MAX_CONSECUTIVE_FAILURES = 5;  // 最大连续失败次数
      const MAX_TOTAL_FAILURES_RATIO = 0.5;  // 最大失败率（50%）
      
      const worker = async () => {
        while (true) {
          const current = index++;
          if (current >= files.length) break;
          
          // ✓ 检查点1：分析文件前检查是否取消
          if (taskControl.isCancelled(taskId)) {
            console.log(`🛑 [检查点1] 任务 ${taskId} 已被用户取消，停止分析（在文件 ${current}/${files.length} 前）`);
            return;
          }
          
          // ✓ 检查连续失败次数
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`❌ 任务 ${taskId}: 连续失败 ${consecutiveFailures} 次，停止分析`);
            throw new Error(`连续失败 ${consecutiveFailures} 次，可能是 LLM API 服务异常`);
          }
          
          // ✓ 检查总失败率
          if (totalFiles > 10 && failedCount / totalFiles > MAX_TOTAL_FAILURES_RATIO) {
            console.error(`❌ 任务 ${taskId}: 失败率过高 (${Math.round(failedCount / totalFiles * 100)}%)，停止分析`);
            throw new Error(`失败率过高 (${failedCount}/${totalFiles})，建议检查 LLM 配置或切换其他提供商`);
          }

          const f = files[current];
          totalFiles++;
          try {
            // 使用预先构建的 URL（支持 GitHub 和 GitLab）
            const rawUrl = f.url!;
            const headers: Record<string, string> = {};
            // 为 GitLab 添加认证 Token
            if (isGitLab) {
              const token = params.gitlabToken || (import.meta.env.VITE_GITLAB_TOKEN as string | undefined);
              if (token) {
                headers["PRIVATE-TOKEN"] = token;
              }
            }
            const contentRes = await fetch(rawUrl, { headers });
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
            
            // 成功：重置连续失败计数
            consecutiveFailures = 0;
            
            // 每分析一个文件都更新进度，确保实时性
            console.log(`📈 ${repoType}任务 ${taskId}: 进度 ${totalFiles}/${files.length} (${Math.round(totalFiles/files.length*100)}%)`);
            await api.updateAuditTask(taskId, { 
              status: "running", 
              total_files: files.length,
              scanned_files: totalFiles, 
              total_lines: totalLines, 
              issues_count: createdIssues 
            } as any);
          } catch (fileError) {
            failedCount++;
            consecutiveFailures++;
            console.error(`❌ 分析文件失败 (${f.path}): [连续失败${consecutiveFailures}次, 总失败${failedCount}/${totalFiles}]`, fileError);
          }
          await new Promise(r=>setTimeout(r, LLM_GAP_MS));
        }
      };

      const pool = Array.from({ length: Math.min(LLM_CONCURRENCY, files.length) }, () => worker());
      
      try {
        await Promise.all(pool);
      } catch (workerError: any) {
        // Worker 抛出错误（连续失败或失败率过高）
        console.error(`❌ 任务 ${taskId} 因错误终止:`, workerError);
        await api.updateAuditTask(taskId, { 
          status: "failed",
          total_files: files.length,
          scanned_files: totalFiles,
          total_lines: totalLines,
          issues_count: createdIssues,
          completed_at: new Date().toISOString()
        } as any);
        taskControl.cleanupTask(taskId);
        return;
      }

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
      
      // 记录审计完成
      import('@/shared/utils/logger').then(({ logger, LogCategory }) => {
        logger.info(LogCategory.SYSTEM, `审计任务完成: ${taskId}`, {
          taskId,
          totalFiles: files.length,
          scannedFiles: totalFiles,
          totalLines,
          issuesCount: createdIssues,
          qualityScore,
          failedCount,
        });
      });
      
      taskControl.cleanupTask(taskId);
    } catch (e) {
      console.error('❌ GitHub审计任务执行失败:', e);
      console.error('错误详情:', e);
      
      // 记录审计失败
      import('@/shared/utils/errorHandler').then(({ handleError }) => {
        handleError(e, `审计任务失败: ${taskId}`);
      });
      
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


