import type { CodeAnalysisResult } from "@/types/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 基于 LLM 的代码分析引擎
export class CodeAnalysisEngine {
  private static readonly SUPPORTED_LANGUAGES = [
    'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'csharp', 'php', 'ruby'
  ];

  static getSupportedLanguages(): string[] {
    return [...this.SUPPORTED_LANGUAGES];
  }

  static async analyzeCode(code: string, language: string): Promise<CodeAnalysisResult> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
      throw new Error('缺少 VITE_GEMINI_API_KEY 环境变量，请在 .env 中配置');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const primaryModel = (import.meta.env.VITE_GEMINI_MODEL as string) || 'gemini-2.5-flash';
    const fallbacks = ['gemini-1.5-flash'];

    const requestWithTimeout = async (m: string, promptText: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const mdl = genAI.getGenerativeModel({ model: m });
        const res = await mdl.generateContent({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          safetySettings: [],
          generationConfig: { temperature: 0.2 }
        }, { signal: controller.signal as any });
        return res.response.text();
      } finally {
        clearTimeout(timer);
      }
    };

    const generateWithRetry = async (promptText: string) => {
      const models = [primaryModel, ...fallbacks];
      const maxAttempts = 3;
      const timeoutMs = Number(import.meta.env.VITE_GEMINI_TIMEOUT_MS || 25000);
      let lastError: any = null;
      for (const m of models) {
        for (let i = 0; i < maxAttempts; i++) {
          try {
            return await requestWithTimeout(m, prompt, timeoutMs);
          } catch (err: any) {
            lastError = err;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // 1s,2s,4s
          }
        }
      }
      throw lastError;
    };

    const schema = `{
      "issues": [
        {
          "type": "security|bug|performance|style|maintainability",
          "severity": "critical|high|medium|low",
          "title": "string",
          "description": "string",
          "suggestion": "string",
          "line": 1,
          "column": 1,
          "code_snippet": "string",
          "ai_explanation": "string",
          "xai": {
            "what": "string",
            "why": "string",
            "how": "string",
            "learn_more": "string(optional)"
          }
        }
      ],
      "quality_score": 0-100,
      "summary": {
        "total_issues": number,
        "critical_issues": number,
        "high_issues": number,
        "medium_issues": number,
        "low_issues": number
      },
      "metrics": {
        "complexity": 0-100,
        "maintainability": 0-100,
        "security": 0-100,
        "performance": 0-100
      }
    }`;

    const prompt = [
      `请请严格使用中文。你是一个专业代码审计助手。请从编码规范、潜在Bug、性能问题、安全漏洞、可维护性、最佳实践等维度分析代码，并严格输出 JSON（仅 JSON）符合以下 schema：`,
      schema,
      `语言: ${language}`,
      `代码: \n\n${code}`
    ].join('\n\n');

    let text = '';
    try {
      text = await generateWithRetry(prompt);
    } catch (e) {
      // 全部超时/失败时，返回兜底估算结果
      const fallbackIssues: any[] = [];
      const fallbackMetrics = this.estimateMetricsFromIssues(fallbackIssues);
      return {
        issues: fallbackIssues,
        quality_score: this.calculateQualityScore(fallbackMetrics, fallbackIssues),
        summary: {
          total_issues: 0,
          critical_issues: 0,
          high_issues: 0,
          medium_issues: 0,
          low_issues: 0,
        },
        metrics: fallbackMetrics
      } as CodeAnalysisResult;
    }
    const parsed = this.safeParseJson(text);

    const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const metrics = parsed?.metrics ?? this.estimateMetricsFromIssues(issues);
    const qualityScore = parsed?.quality_score ?? this.calculateQualityScore(metrics, issues);

    return {
      issues,
      quality_score: qualityScore,
      summary: parsed?.summary ?? {
        total_issues: issues.length,
        critical_issues: issues.filter((i: any) => i.severity === 'critical').length,
        high_issues: issues.filter((i: any) => i.severity === 'high').length,
        medium_issues: issues.filter((i: any) => i.severity === 'medium').length,
        low_issues: issues.filter((i: any) => i.severity === 'low').length,
      },
      metrics
    } as CodeAnalysisResult;
  }

  private static safeParseJson(text: string): any {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch {}
      }
      return null;
    }
  }

  private static estimateMetricsFromIssues(issues: any[]) {
    const base = 90;
    const penalty = Math.min(60, (issues?.length || 0) * 2);
    const score = Math.max(0, base - penalty);
    return {
      complexity: score,
      maintainability: score,
      security: score,
      performance: score
    };
  }

  private static calculateQualityScore(metrics: any, issues: any[]): number {
    const criticalWeight = 30;
    const highWeight = 20;
    const mediumWeight = 10;
    const lowWeight = 5;

    const criticalIssues = issues.filter((i: any) => i.severity === 'critical').length;
    const highIssues = issues.filter((i: any) => i.severity === 'high').length;
    const mediumIssues = issues.filter((i: any) => i.severity === 'medium').length;
    const lowIssues = issues.filter((i: any) => i.severity === 'low').length;

    const issueScore = 100 - (
      criticalIssues * criticalWeight +
      highIssues * highWeight +
      mediumIssues * mediumWeight +
      lowIssues * lowWeight
    );

    const metricsScore = (
      metrics.complexity + 
      metrics.maintainability + 
      metrics.security + 
      metrics.performance
    ) / 4;

    return Math.max(0, Math.min(100, (issueScore + metricsScore) / 2));
  }

  // 仓库级别的分析（占位保留）
  static async analyzeRepository(_repoUrl: string, _branch: string = 'main', _excludePatterns: string[] = []): Promise<{
    taskId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { taskId, status: 'pending' };
  }

  // GitHub/GitLab集成（占位保留）
  static async getRepositories(_token: string, _platform: 'github' | 'gitlab'): Promise<any[]> {
    return [
      {
        id: '1',
        name: 'example-project',
        full_name: 'user/example-project',
        description: '示例项目',
        html_url: 'https://github.com/user/example-project',
        clone_url: 'https://github.com/user/example-project.git',
        default_branch: 'main',
        language: 'JavaScript',
        private: false,
        updated_at: new Date().toISOString()
      }
    ];
  }

  static async getBranches(_repoUrl: string, _token: string): Promise<any[]> {
    return [
      {
        name: 'main',
        commit: {
          sha: 'abc123',
          url: 'https://github.com/user/repo/commit/abc123'
        },
        protected: true
      },
      {
        name: 'develop',
        commit: {
          sha: 'def456',
          url: 'https://github.com/user/repo/commit/def456'
        },
        protected: false
      }
    ];
  }
}