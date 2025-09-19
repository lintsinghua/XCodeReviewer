import { api } from "@/db/supabase";
import { CodeAnalysisEngine } from "@/services/codeAnalysis";
import { unzipSync, strFromU8 } from "fflate";

const TEXT_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h", ".cs", ".php", ".rb", ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml", ".md"
];

const MAX_FILE_SIZE_BYTES = 200 * 1024;

function isTextFile(path: string): boolean {
  const lower = path.toLowerCase();
  return TEXT_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export async function runZipRepositoryAudit(params: {
  projectId: string;
  repoUrl: string; // https://github.com/owner/repo
  branch?: string;
}) {
  const branch = params.branch || "main";
  const task = await api.createAuditTask({
    project_id: params.projectId,
    task_type: "repository",
    branch_name: branch,
    exclude_patterns: [],
    scan_config: {},
    created_by: null
  } as any);

  try {
    const m = params.repoUrl.match(/github\.com\/(.+?)\/(.+?)(?:\.git)?$/i);
    if (!m) throw new Error("仅支持 GitHub 仓库 URL，例如 https://github.com/owner/repo");
    const owner = m[1];
    const repo = m[2];

    // GitHub 提供仓库 zip 下载（无需 token）
    const zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodeURIComponent(branch)}`;
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`下载仓库压缩包失败: ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const files = unzipSync(buf);

    let totalFiles = 0;
    let totalLines = 0;
    let createdIssues = 0;

    const rootPrefix = `${repo}-${branch}/`;

    for (const name of Object.keys(files)) {
      if (!name.startsWith(rootPrefix)) continue;
      const relPath = name.slice(rootPrefix.length);
      if (!relPath || relPath.endsWith("/")) continue; // 目录
      if (!isTextFile(relPath)) continue;

      const fileData = files[name];
      if (!fileData || fileData.length > MAX_FILE_SIZE_BYTES) continue;
      const content = strFromU8(fileData);
      totalFiles += 1;
      totalLines += content.split(/\r?\n/).length;

      const ext = relPath.split(".").pop() || "";
      const language = ext.toLowerCase();
      const analysis = await CodeAnalysisEngine.analyzeCode(content, language);
      const issues = analysis.issues || [];
      createdIssues += issues.length;

      for (const issue of issues) {
        await api.createAuditIssue({
          task_id: (task as any).id,
          file_path: relPath,
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
    }

    await api.updateAuditTask((task as any).id, {
      status: "completed",
      total_files: totalFiles,
      scanned_files: totalFiles,
      total_lines: totalLines,
      issues_count: createdIssues,
      quality_score: 0
    } as any);

    return (task as any).id as string;
  } catch (e) {
    await api.updateAuditTask((task as any).id, { status: "failed" } as any);
    throw e;
  }
}


