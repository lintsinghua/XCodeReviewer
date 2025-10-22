import { unzip } from "fflate";
import { CodeAnalysisEngine } from "@/features/analysis/services";
import { api } from "@/shared/config/database";

const TEXT_EXTENSIONS = [
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".cpp", ".c", ".h", 
  ".cs", ".php", ".rb", ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml", ".md"
];

const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200KB
const MAX_ANALYZE_FILES = 50;

function isTextFile(path: string): boolean {
  return TEXT_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
}

function shouldExclude(path: string, excludePatterns: string[]): boolean {
  return excludePatterns.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(path);
    }
    return path.includes(pattern);
  });
}

function getLanguageFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'cpp': 'cpp',
    'c': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'kt': 'kotlin',
    'swift': 'swift'
  };
  
  return languageMap[extension] || 'text';
}

export async function scanZipFile(params: {
  projectId: string;
  zipFile: File;
  excludePatterns?: string[];
  createdBy?: string;
}): Promise<string> {
  const { projectId, zipFile, excludePatterns = [], createdBy } = params;

  // 创建审计任务
  const task = await api.createAuditTask({
    project_id: projectId,
    task_type: "repository",
    branch_name: "uploaded",
    exclude_patterns: excludePatterns,
    scan_config: { source: "zip_upload" },
    created_by: createdBy
  } as any);

  const taskId = (task as any).id;

  try {
    // 更新任务状态为运行中
    await api.updateAuditTask(taskId, { 
      status: "running",
      started_at: new Date().toISOString()
    } as any);

    // 读取ZIP文件
    const arrayBuffer = await zipFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    return new Promise((resolve, reject) => {
      unzip(uint8Array, async (err, unzipped) => {
        if (err) {
          await api.updateAuditTask(taskId, { status: "failed" } as any);
          reject(new Error(`ZIP文件解压失败: ${err.message}`));
          return;
        }

        try {
          // 筛选需要分析的文件
          const filesToAnalyze: Array<{ path: string; content: string }> = [];
          
          for (const [path, data] of Object.entries(unzipped)) {
            // 跳过目录
            if (path.endsWith('/')) continue;
            
            // 检查文件类型和排除模式
            if (!isTextFile(path) || shouldExclude(path, excludePatterns)) continue;
            
            // 检查文件大小
            if (data.length > MAX_FILE_SIZE_BYTES) continue;
            
            try {
              const content = new TextDecoder('utf-8').decode(data);
              filesToAnalyze.push({ path, content });
            } catch (decodeError) {
              // 跳过无法解码的文件
              continue;
            }
          }

          // 限制分析文件数量
          const limitedFiles = filesToAnalyze
            .sort((a, b) => a.path.length - b.path.length) // 优先分析路径较短的文件
            .slice(0, MAX_ANALYZE_FILES);

          let totalFiles = limitedFiles.length;
          let scannedFiles = 0;
          let totalLines = 0;
          let totalIssues = 0;
          let qualityScores: number[] = [];

          // 分析每个文件
          for (const file of limitedFiles) {
            try {
              const language = getLanguageFromPath(file.path);
              const lines = file.content.split(/\r?\n/).length;
              totalLines += lines;

              // 使用AI分析代码
              const analysis = await CodeAnalysisEngine.analyzeCode(file.content, language);
              qualityScores.push(analysis.quality_score);

              // 保存发现的问题
              for (const issue of analysis.issues) {
                await api.createAuditIssue({
                  task_id: taskId,
                  file_path: file.path,
                  line_number: issue.line || null,
                  column_number: issue.column || null,
                  issue_type: issue.type || "maintainability",
                  severity: issue.severity || "low",
                  title: issue.title || "Issue",
                  description: issue.description || null,
                  suggestion: issue.suggestion || null,
                  code_snippet: issue.code_snippet || null,
                  ai_explanation: issue.ai_explanation || null,
                  status: "open"
                } as any);
                
                totalIssues++;
              }

              scannedFiles++;

              // 每分析10个文件更新一次进度
              if (scannedFiles % 10 === 0) {
                await api.updateAuditTask(taskId, {
                  total_files: totalFiles,
                  scanned_files: scannedFiles,
                  total_lines: totalLines,
                  issues_count: totalIssues
                } as any);
              }

              // 添加延迟避免API限制
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (analysisError) {
              console.error(`分析文件 ${file.path} 失败:`, analysisError);
              // 继续分析其他文件
            }
          }

          // 计算平均质量分
          const avgQualityScore = qualityScores.length > 0 
            ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
            : 0;

          // 更新任务完成状态
          await api.updateAuditTask(taskId, {
            status: "completed",
            total_files: totalFiles,
            scanned_files: scannedFiles,
            total_lines: totalLines,
            issues_count: totalIssues,
            quality_score: avgQualityScore,
            completed_at: new Date().toISOString()
          } as any);

          resolve(taskId);
        } catch (processingError) {
          await api.updateAuditTask(taskId, { status: "failed" } as any);
          reject(processingError);
        }
      });
    });
  } catch (error) {
    await api.updateAuditTask(taskId, { status: "failed" } as any);
    throw error;
  }
}

export function validateZipFile(file: File): { valid: boolean; error?: string } {
  // 检查文件类型
  if (!file.type.includes('zip') && !file.name.toLowerCase().endsWith('.zip')) {
    return { valid: false, error: '请上传ZIP格式的文件' };
  }

  // 检查文件大小 (限制为100MB)
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '文件大小不能超过100MB' };
  }

  return { valid: true };
}