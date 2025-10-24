import type { CodeAnalysisResult } from "@/shared/types";
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

    // 获取输出语言配置
    const outputLanguage = env.OUTPUT_LANGUAGE || 'zh-CN';
    const isChineseOutput = outputLanguage === 'zh-CN';

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

    // 根据配置生成不同语言的提示词
    const systemPrompt = isChineseOutput
      ? `你是一个专业的代码审计助手。

【重要】请严格遵守以下规则：
1. 所有文本内容（title、description、suggestion、ai_explanation、xai 等）必须使用简体中文
2. 仅输出 JSON 格式，不要添加任何额外的文字、解释或 markdown 标记
3. 确保 JSON 格式完全正确，所有字符串值都要正确转义

请从以下维度全面分析代码：
- 编码规范和代码风格
- 潜在的 Bug 和逻辑错误
- 性能问题和优化建议
- 安全漏洞和风险
- 可维护性和可读性
- 最佳实践和设计模式

输出格式必须严格符合以下 JSON Schema：

${schema}

注意：
- title: 问题的简短标题（中文）
- description: 详细描述问题（中文）
- suggestion: 具体的修复建议（中文）
- ai_explanation: AI 的深入解释（中文）
- xai.what: 这是什么问题（中文）
- xai.why: 为什么会有这个问题（中文）
- xai.how: 如何修复这个问题（中文）`
      : `You are a professional code auditing assistant.

【IMPORTANT】Please strictly follow these rules:
1. All text content (title, description, suggestion, ai_explanation, xai, etc.) MUST be in English
2. Output ONLY valid JSON format, without any additional text, explanations, or markdown markers
3. Ensure the JSON format is completely correct with all string values properly escaped

Please comprehensively analyze the code from the following dimensions:
- Coding standards and code style
- Potential bugs and logical errors
- Performance issues and optimization suggestions
- Security vulnerabilities and risks
- Maintainability and readability
- Best practices and design patterns

The output format MUST strictly conform to the following JSON Schema:

${schema}

Note:
- title: Brief title of the issue (in English)
- description: Detailed description of the issue (in English)
- suggestion: Specific fix suggestions (in English)
- ai_explanation: AI's in-depth explanation (in English)
- xai.what: What is this issue (in English)
- xai.why: Why does this issue exist (in English)
- xai.how: How to fix this issue (in English)`;

    const userPrompt = isChineseOutput
      ? `编程语言: ${language}\n\n请分析以下代码:\n\n${code}`
      : `Programming Language: ${language}\n\nPlease analyze the following code:\n\n${code}`;

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

      // 2. 修复尾部逗号（JSON 不允许）- 必须在其他处理之前
      str = str.replace(/,(\s*[}\]])/g, '$1');

      // 3. 修复缺少逗号的问题
      str = str.replace(/\}(\s*)\{/g, '},\n{');
      str = str.replace(/\](\s*)\[/g, '],\n[');
      str = str.replace(/\}(\s*)"([^"]+)":/g, '},\n"$2":');
      str = str.replace(/\](\s*)"([^"]+)":/g, '],\n"$2":');

      // 4. 修复对象/数组后缺少逗号的情况
      str = str.replace(/([}\]])(\s*)(")/g, '$1,\n$3');

      // 5. 移除多余的逗号
      str = str.replace(/,+/g, ',');

      return str;
    };

    // 清理和修复 JSON 字符串
    const cleanText = (str: string): string => {
      // 移除 BOM 和零宽字符
      let cleaned = str
        .replace(/^\uFEFF/, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');

      // 更激进的字符串值清理
      // 使用更宽松的正则来匹配字符串值，包括可能包含未转义引号的情况
      cleaned = cleaned.replace(/"([^"]+)":\s*"([^"]*)"/gs, (match, key, value) => {
        // 转义所有特殊字符
        let escaped = value
          // 移除或替换所有控制字符（包括换行、制表符等）
          .replace(/[\x00-\x1F\x7F-\x9F]/g, (char) => {
            const code = char.charCodeAt(0);
            if (code === 0x0A) return '\\n';  // \n
            if (code === 0x0D) return '\\r';  // \r
            if (code === 0x09) return '\\t';  // \t
            return '';  // 移除其他控制字符
          })
          // 转义反斜杠（必须在其他转义之前）
          .replace(/\\/g, '\\\\')
          // 转义双引号
          .replace(/"/g, '\\"')
          // 移除中文引号和其他可能导致问题的字符
          .replace(/[""'']/g, '')
          // 确保没有未闭合的转义序列
          .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

        return `"${key}": "${escaped}"`;
      });

      return cleaned;
    };

    // 尝试多种方式解析
    const attempts = [
      // 1. 直接清理和修复
      () => {
        const cleaned = cleanText(text);
        const fixed = fixJsonFormat(cleaned);
        return JSON.parse(fixed);
      },
      // 2. 提取 JSON 对象（贪婪匹配，找到第一个完整的 JSON）
      () => {
        const cleaned = cleanText(text);
        // 找到第一个 { 的位置
        const startIdx = cleaned.indexOf('{');
        if (startIdx === -1) throw new Error('No JSON object found');

        // 从第一个 { 开始，找到匹配的 }
        let braceCount = 0;
        let endIdx = -1;
        for (let i = startIdx; i < cleaned.length; i++) {
          if (cleaned[i] === '{') braceCount++;
          if (cleaned[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }

        if (endIdx === -1) throw new Error('Incomplete JSON object');

        const jsonStr = cleaned.substring(startIdx, endIdx);
        const fixed = fixJsonFormat(jsonStr);
        return JSON.parse(fixed);
      },
      // 3. 去除 markdown 代码块
      () => {
        const cleaned = cleanText(text);
        const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (codeBlockMatch) {
          const fixed = fixJsonFormat(codeBlockMatch[1]);
          return JSON.parse(fixed);
        }
        throw new Error('No code block found');
      },
      // 4. 尝试修复截断的 JSON
      () => {
        const cleaned = cleanText(text);
        const startIdx = cleaned.indexOf('{');
        if (startIdx === -1) throw new Error('Cannot fix truncated JSON');

        let json = cleaned.substring(startIdx);
        // 尝试补全未闭合的结构
        const openBraces = (json.match(/\{/g) || []).length;
        const closeBraces = (json.match(/\}/g) || []).length;
        const openBrackets = (json.match(/\[/g) || []).length;
        const closeBrackets = (json.match(/\]/g) || []).length;

        // 补全缺失的闭合符号
        json += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
        json += '}'.repeat(Math.max(0, openBraces - closeBraces));

        const fixed = fixJsonFormat(json);
        return JSON.parse(fixed);
      }
    ];

    let lastError: any = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        return attempts[i]();
      } catch (e) {
        lastError = e;
        if (i === 1) {
          console.warn('提取 JSON 对象后解析失败:', e);
        } else if (i === 2) {
          console.warn('从代码块提取 JSON 失败:', e);
        }
      }
    }

    // 所有尝试都失败
    console.error('⚠️ 无法解析 LLM 响应为 JSON');
    console.error('原始内容（前500字符）:', text.substring(0, 500));
    console.error('解析错误:', lastError);
    console.warn('💡 提示: 当前模型可能无法生成有效的 JSON 格式');
    console.warn('   建议：更换更强大的模型或切换其他 LLM 提供商');
    return null;
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