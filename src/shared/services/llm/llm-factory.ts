/**
 * LLM工厂类 - 统一创建和管理LLM适配器
 */

import type { ILLMAdapter, LLMConfig, LLMProvider } from "./types";
import { DEFAULT_MODELS } from "./types";
import {
	GeminiAdapter,
	OpenAIAdapter,
	ClaudeAdapter,
	QwenAdapter,
	DeepSeekAdapter,
	ZhipuAdapter,
	MoonshotAdapter,
	BaiduAdapter,
	MinimaxAdapter,
	DoubaoAdapter,
	OllamaAdapter,
} from "./adapters";

/**
 * LLM工厂类
 */
export class LLMFactory {
	private static adapters: Map<string, ILLMAdapter> = new Map();

	/**
	 * 创建LLM适配器实例
	 */
	static createAdapter(config: LLMConfig): ILLMAdapter {
		const cacheKey = this.getCacheKey(config);

		// 从缓存中获取
		if (this.adapters.has(cacheKey)) {
			return this.adapters.get(cacheKey)!;
		}

		// 创建新的适配器实例
		const adapter = this.instantiateAdapter(config);

		// 缓存实例
		this.adapters.set(cacheKey, adapter);

		return adapter;
	}

	/**
	 * 根据提供商类型实例化适配器
	 */
	private static instantiateAdapter(config: LLMConfig): ILLMAdapter {
		// 如果未指定模型，使用默认模型
		if (!config.model) {
			config.model = DEFAULT_MODELS[config.provider];
		}

		switch (config.provider) {
			case "gemini":
				return new GeminiAdapter(config);

			case "openai":
				return new OpenAIAdapter(config);

			case "claude":
				return new ClaudeAdapter(config);

			case "qwen":
				return new QwenAdapter(config);

			case "deepseek":
				return new DeepSeekAdapter(config);

			case "zhipu":
				return new ZhipuAdapter(config);

			case "moonshot":
				return new MoonshotAdapter(config);

			case "baidu":
				return new BaiduAdapter(config);

			case "minimax":
				return new MinimaxAdapter(config);

			case "doubao":
				return new DoubaoAdapter(config);

			case "ollama":
				return new OllamaAdapter(config);

			default:
				throw new Error(`不支持的LLM提供商: ${config.provider}`);
		}
	}

	/**
	 * 生成缓存键
	 */
	private static getCacheKey(config: LLMConfig): string {
		return `${config.provider}:${config.model}:${config.apiKey.substring(0, 8)}`;
	}

	/**
	 * 清除缓存
	 */
	static clearCache(): void {
		this.adapters.clear();
	}

	/**
	 * 获取支持的提供商列表
	 */
	static getSupportedProviders(): LLMProvider[] {
		return [
			"gemini",
			"openai",
			"claude",
			"qwen",
			"deepseek",
			"zhipu",
			"moonshot",
			"baidu",
			"minimax",
			"doubao",
			"ollama",
		];
	}

	/**
	 * 获取提供商的默认模型
	 */
	static getDefaultModel(provider: LLMProvider): string {
		return DEFAULT_MODELS[provider];
	}

	/**
	 * 获取提供商的可用模型列表
	 */
	static getAvailableModels(provider: LLMProvider): string[] {
		const models: Record<LLMProvider, string[]> = {
			gemini: [
				"gemini-2.5-flash",
				"gemini-2.5-pro",
				"gemini-1.5-flash",
				"gemini-1.5-pro",
			],
			openai: [
				"gpt-4o",
				"gpt-4o-mini",
				"gpt-4-turbo",
				"gpt-4",
				"gpt-3.5-turbo",
			],
			claude: [
				"claude-3-5-sonnet-20241022",
				"claude-3-5-haiku-20241022",
				"claude-3-opus-20240229",
				"claude-3-sonnet-20240229",
				"claude-3-haiku-20240307",
			],
			qwen: ["qwen-turbo", "qwen-plus", "qwen-max", "qwen-max-longcontext"],
			deepseek: ["deepseek-chat", "deepseek-coder"],
			zhipu: ["glm-4-flash", "glm-4", "glm-4-air", "glm-3-turbo"],
			moonshot: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
			baidu: [
				"ERNIE-4.0-8K",
				"ERNIE-3.5-8K",
				"ERNIE-3.5-128K",
				"ERNIE-Speed-8K",
				"ERNIE-Speed-128K",
				"ERNIE-Lite-8K",
				"ERNIE-Tiny-8K",
			],
			minimax: ["abab6.5-chat", "abab6.5s-chat", "abab5.5-chat"],
			doubao: [
				"doubao-pro-32k",
				"doubao-pro-128k",
				"doubao-lite-32k",
				"doubao-lite-128k",
			],
			ollama: [
				"llama3",
				"llama3.1",
				"llama3.2",
				"mistral",
				"codellama",
				"qwen2.5",
				"gemma2",
				"phi3",
				"deepseek-coder",
			],
		};

		return models[provider] || [];
	}

	/**
	 * 获取提供商的友好名称
	 */
	static getProviderDisplayName(provider: LLMProvider): string {
		const names: Record<LLMProvider, string> = {
			gemini: "Google Gemini",
			openai: "OpenAI GPT",
			claude: "Anthropic Claude",
			qwen: "阿里云通义千问",
			deepseek: "DeepSeek",
			zhipu: "智谱AI (GLM)",
			moonshot: "月之暗面 Kimi",
			baidu: "百度文心一言",
			minimax: "MiniMax",
			doubao: "字节豆包",
			ollama: "Ollama 本地大模型",
		};

		return names[provider] || provider;
	}
}
