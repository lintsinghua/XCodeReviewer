import type { CodeAnalysisResult } from "@/types/types";
import { LLMService } from '@/shared/services/llm';
import { getCurrentLLMApiKey, getCurrentLLMModel, env } from '@/shared/config/env';
import type { LLMConfig } from '@/shared/services/llm/types';

// 基于 LLM 的代码分析引擎
export class CodeAnalysisEngine {
  private static readonly SUPPORTED_LANGUAGES = [
    'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'csharp', 'php', 'ruby'
  ];

  static getSupportedLanguages(): string[] {
    return [...this.SUPPORTED_LANGUAGES];
  }

  /**
   * 创建LLM服务实例
   */
  private static createLLMService(): LLMService {
    const apiKey = getCurrentLLMApiKey();
    if (!apiKey) {
      throw new Error(`缺少 ${env.LLM_PROVIDER} API Key，请在 .env 中配置`);
    }

    const config: LLMConfig = {
      provider: env.LLM_PROVIDER as any,
      apiKey,
      model: getCurrentLLMModel(),
      baseUrl: env.LLM_BASE_URL,
      timeout: env.LLM_TIMEOUT,
      temperature: env.LLM_TEMPERATURE,
      maxTokens: env.LLM_MAX_TOKENS,
    };

    return new LLMService(config);
  }

  static async analyzeCode(code: string, language: string): Promise<CodeAnalysisResult> {
    const llmService = this.createLLMService();

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

    const systemPrompt = `请严格使用中文。你是一个专业代码审计助手。请从编码规范、潜在Bug、性能问题、安全漏洞、可维护性、最佳实践等维度分析代码，并严格输出 JSON（仅 JSON）符合以下 schema：\n\n${schema}`;
    
    const userPrompt = `语言: ${language}\n\n代码:\n\n${code}`;

    let text = '';
    try {
      console.log('🚀 开始调用 LLM 分析...');
      console.log(`📡 提供商: ${env.LLM_PROVIDER}`);
      console.log(`🤖 模型: ${getCurrentLLMModel()}`);
      console.log(`🔗 Base URL: ${env.LLM_BASE_URL || '(默认)'}`);
      
      // 使用新的LLM服务进行分析
      const response = await llmService.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      });
      text = response.content;
      
      console.log('✅ LLM 响应成功');
      console.log(`📊 响应长度: ${text.length} 字符`);
      console.log(`📝 响应内容预览: ${text.substring(0, 200)}...`);
    } catch (e: any) {
      console.error('LLM分析失败:', e);
      
      // 构造更友好的错误消息
      const errorMsg = e.message || '未知错误';
      const provider = env.LLM_PROVIDER;
      
      // 抛出详细的错误信息给前端
      throw new Error(
        `${provider} API调用失败\n\n` +
        `错误详情：${errorMsg}\n\n` +
        `配置检查：\n` +
        `- 提供商：${provider}\n` +
        `- 模型：${getCurrentLLMModel() || '(使用默认)'}\n` +
        `- API Key：${getCurrentLLMApiKey() ? '已配置' : '未配置'}\n` +
        `- 超时设置：${env.LLM_TIMEOUT}ms\n\n` +
        `请检查.env配置文件或尝试切换其他LLM提供商`
      );
    }
    const parsed = this.safeParseJson(text);
    
    // 如果解析失败，抛出错误而不是返回默认值
    if (!parsed) {
      const provider = env.LLM_PROVIDER;
      const currentModel = getCurrentLLMModel();
      
      let suggestions = '';
      if (provider === 'ollama') {
        suggestions = 
          `建议解决方案：\n` +
          `1. 升级到更强的模型（推荐）：\n` +
          `   ollama pull codellama\n` +
          `   ollama pull qwen2.5:7b\n` +
          `2. 更新配置文件 .env：\n` +
          `   VITE_LLM_MODEL=codellama\n` +
          `3. 重启应用后重试\n\n` +
          `注意：超轻量模型仅适合测试连接，实际使用需要更强的模型。`;
      } else {
        suggestions = 
          `建议解决方案：\n` +
          `1. 尝试更换更强大的模型（在 .env 中修改 VITE_LLM_MODEL）\n` +
          `2. 检查当前模型是否支持结构化输出（JSON 格式）\n` +
          `3. 尝试切换到其他 LLM 提供商：\n` +
          `   - Gemini (免费额度充足)\n` +
          `   - OpenAI GPT (稳定可靠)\n` +
          `   - Claude (代码理解能力强)\n` +
          `   - DeepSeek (性价比高)\n` +
          `4. 如果使用代理，检查网络连接是否稳定\n` +
          `5. 增加超时时间（VITE_LLM_TIMEOUT）`;
      }
      
      throw new Error(
        `LLM 响应解析失败\n\n` +
        `提供商: ${provider}\n` +
        `模型: ${currentModel || '(默认)'}\n\n` +
        `原因：当前模型返回的内容不是有效的 JSON 格式，\n` +
        `这可能是因为模型能力不足或配置不当。\n\n` +
        suggestions
      );
    }
    
    console.log('🔍 解析结果:', {
      hasIssues: Array.isArray(parsed?.issues),
      issuesCount: parsed?.issues?.length || 0,
      hasMetrics: !!parsed?.metrics,
      hasQualityScore: !!parsed?.quality_score
    });

    const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const metrics = parsed?.metrics ?? this.estimateMetricsFromIssues(issues);
    const qualityScore = parsed?.quality_score ?? this.calculateQualityScore(metrics, issues);
    
    console.log(`📋 最终发现 ${issues.length} 个问题`);
    console.log(`⭐ 质量评分: ${qualityScore}`);

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
    // 预处理：修复常见的非标准 JSON 格式
    const fixJsonFormat = (str: string): string => {
      // 1. 去除前后空白
      str = str.trim();
      
      // 2. 将 JavaScript 模板字符串（反引号）替换为双引号，并处理多行内容
      // 匹配: "key": `多行内容`  =>  "key": "转义后的内容"
      str = str.replace(/:\s*`([\s\S]*?)`/g, (match, content) => {
        // 转义所有特殊字符
        let escaped = content
          .replace(/\\/g, '\\\\')        // 反斜杠
          .replace(/"/g, '\\"')          // 双引号
          .replace(/\n/g, '\\n')         // 换行符
          .replace(/\r/g, '\\r')         // 回车符
          .replace(/\t/g, '\\t')         // 制表符
          .replace(/\f/g, '\\f')         // 换页符
          .replace(/\b/g, '\\b');        // 退格符
        return `: "${escaped}"`;
      });
      
      // 3. 处理字符串中未转义的换行符（防御性处理）
      // 匹配双引号字符串内的实际换行符
      str = str.replace(/"([^"]*?)"/g, (match, content) => {
        if (content.includes('\n') || content.includes('\r') || content.includes('\t')) {
          const escaped = content
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\f/g, '\\f')
            .replace(/\b/g, '\\b');
          return `"${escaped}"`;
        }
        return match;
      });
      
      // 4. 修复尾部逗号（JSON 不允许）
      str = str.replace(/,(\s*[}\]])/g, '$1');
      
      // 5. 修复缺少逗号的问题（两个连续的 } 或 ]）
      str = str.replace(/\}(\s*)\{/g, '},\n{');
      str = str.replace(/\](\s*)\[/g, '],\n[');
      
      return str;
    };
    
    try {
      // 先尝试修复后直接解析
      const fixed = fixJsonFormat(text);
      return JSON.parse(fixed);
    } catch (e1) {
      // 如果失败，尝试提取 JSON 对象
      try {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const fixed = fixJsonFormat(match[0]);
          return JSON.parse(fixed);
        }
      } catch (e2) {
        console.warn('提取 JSON 对象后解析失败:', e2);
      }
      
      // 尝试去除 markdown 代码块标记
      try {
        const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (codeBlockMatch) {
          const fixed = fixJsonFormat(codeBlockMatch[1]);
          return JSON.parse(fixed);
        }
      } catch (e3) {
        console.warn('从代码块提取 JSON 失败:', e3);
      }
      
      console.error('⚠️ 无法解析 LLM 响应为 JSON');
      console.error('原始内容（前500字符）:', text.substring(0, 500));
      console.error('解析错误:', e1);
      console.warn('💡 提示: 当前模型可能无法生成有效的 JSON 格式');
      console.warn('   建议：更换更强大的模型或切换其他 LLM 提供商');
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