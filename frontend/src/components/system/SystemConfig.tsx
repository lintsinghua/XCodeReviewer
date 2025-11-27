import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Info,
  Key,
  Zap,
  Globe,
  Database
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/database";

// LLM 提供商配置
const LLM_PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini', icon: '🔵', category: 'international' },
  { value: 'openai', label: 'OpenAI GPT', icon: '🟢', category: 'international' },
  { value: 'claude', label: 'Anthropic Claude', icon: '🟣', category: 'international' },
  { value: 'deepseek', label: 'DeepSeek', icon: '🔷', category: 'international' },
  { value: 'qwen', label: '阿里云通义千问', icon: '🟠', category: 'domestic' },
  { value: 'zhipu', label: '智谱AI (GLM)', icon: '🔴', category: 'domestic' },
  { value: 'moonshot', label: 'Moonshot (Kimi)', icon: '🌙', category: 'domestic' },
  { value: 'baidu', label: '百度文心一言', icon: '🔵', category: 'domestic' },
  { value: 'minimax', label: 'MiniMax', icon: '⚡', category: 'domestic' },
  { value: 'doubao', label: '字节豆包', icon: '🎯', category: 'domestic' },
  { value: 'ollama', label: 'Ollama 本地模型', icon: '🖥️', category: 'local' },
];

// 默认模型配置
const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
  qwen: 'qwen-turbo',
  deepseek: 'deepseek-chat',
  zhipu: 'glm-4-flash',
  moonshot: 'moonshot-v1-8k',
  baidu: 'ERNIE-3.5-8K',
  minimax: 'abab6.5-chat',
  doubao: 'doubao-pro-32k',
  ollama: 'llama3',
};

interface SystemConfigData {
  // LLM 配置
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string;
  llmTimeout: number;
  llmTemperature: number;
  llmMaxTokens: number;
  llmCustomHeaders: string;

  // 平台专用配置
  geminiApiKey: string;
  openaiApiKey: string;
  claudeApiKey: string;
  qwenApiKey: string;
  deepseekApiKey: string;
  zhipuApiKey: string;
  moonshotApiKey: string;
  baiduApiKey: string;
  minimaxApiKey: string;
  doubaoApiKey: string;
  ollamaBaseUrl: string;

  // GitHub 配置
  githubToken: string;

  // GitLab 配置
  gitlabToken: string;

  // 分析配置
  maxAnalyzeFiles: number;
  llmConcurrency: number;
  llmGapMs: number;
  outputLanguage: string;
}

export function SystemConfig() {
  // 初始状态为空，等待从后端加载
  const [config, setConfig] = useState<SystemConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [configSource, setConfigSource] = useState<'runtime' | 'build'>('build');

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      // 先从后端获取默认配置
      const defaultConfig = await api.getDefaultConfig();
      if (!defaultConfig) {
        throw new Error('Failed to get default config from backend');
      }

      // 从后端加载用户配置（已合并默认配置）
      const backendConfig = await api.getUserConfig();
      if (backendConfig) {
        const mergedConfig: SystemConfigData = {
          ...defaultConfig.llmConfig,
          ...defaultConfig.otherConfig,
          ...(backendConfig.llmConfig || {}),
          ...(backendConfig.otherConfig || {}),
        };
        setConfig(mergedConfig);
        setConfigSource('runtime');
        console.log('已从后端加载用户配置（已合并默认配置）');
      } else {
        // 使用默认配置
        const mergedConfig: SystemConfigData = {
          ...defaultConfig.llmConfig,
          ...defaultConfig.otherConfig,
        };
        setConfig(mergedConfig);
        setConfigSource('build');
        console.log('使用后端默认配置');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      // 如果后端加载失败，尝试从环境变量加载（后备方案）
      const envConfig = loadFromEnv();
      setConfig(envConfig);
      setConfigSource('build');
    } finally {
      setLoading(false);
    }
  };

  const loadFromEnv = (): SystemConfigData => {
    // 从环境变量加载（后备方案，仅在无法从后端获取时使用）
    return {
      llmProvider: import.meta.env.VITE_LLM_PROVIDER || 'openai',
      llmApiKey: import.meta.env.VITE_LLM_API_KEY || '',
      llmModel: import.meta.env.VITE_LLM_MODEL || '',
      llmBaseUrl: import.meta.env.VITE_LLM_BASE_URL || '',
      llmTimeout: Number(import.meta.env.VITE_LLM_TIMEOUT) || 150000,
      llmTemperature: Number(import.meta.env.VITE_LLM_TEMPERATURE) || 0.1,
      llmMaxTokens: Number(import.meta.env.VITE_LLM_MAX_TOKENS) || 4096,
      llmCustomHeaders: import.meta.env.VITE_LLM_CUSTOM_HEADERS || '',
      geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
      openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
      claudeApiKey: import.meta.env.VITE_CLAUDE_API_KEY || '',
      qwenApiKey: import.meta.env.VITE_QWEN_API_KEY || '',
      deepseekApiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
      zhipuApiKey: import.meta.env.VITE_ZHIPU_API_KEY || '',
      moonshotApiKey: import.meta.env.VITE_MOONSHOT_API_KEY || '',
      baiduApiKey: import.meta.env.VITE_BAIDU_API_KEY || '',
      minimaxApiKey: import.meta.env.VITE_MINIMAX_API_KEY || '',
      doubaoApiKey: import.meta.env.VITE_DOUBAO_API_KEY || '',
      ollamaBaseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      githubToken: import.meta.env.VITE_GITHUB_TOKEN || '',
      gitlabToken: import.meta.env.VITE_GITLAB_TOKEN || '',
      maxAnalyzeFiles: Number(import.meta.env.VITE_MAX_ANALYZE_FILES) || 50,
      llmConcurrency: Number(import.meta.env.VITE_LLM_CONCURRENCY) || 3,
      llmGapMs: Number(import.meta.env.VITE_LLM_GAP_MS) || 2000,
      outputLanguage: import.meta.env.VITE_OUTPUT_LANGUAGE || 'zh-CN',
    };
  };

  const saveConfig = async () => {
    if (!config) {
      toast.error('配置未加载，请稍候再试');
      return;
    }
    try {
      // 保存到后端
      const llmConfig = {
        llmProvider: config.llmProvider,
        llmApiKey: config.llmApiKey,
        llmModel: config.llmModel,
        llmBaseUrl: config.llmBaseUrl,
        llmTimeout: config.llmTimeout,
        llmTemperature: config.llmTemperature,
        llmMaxTokens: config.llmMaxTokens,
        llmCustomHeaders: config.llmCustomHeaders,
        geminiApiKey: config.geminiApiKey,
        openaiApiKey: config.openaiApiKey,
        claudeApiKey: config.claudeApiKey,
        qwenApiKey: config.qwenApiKey,
        deepseekApiKey: config.deepseekApiKey,
        zhipuApiKey: config.zhipuApiKey,
        moonshotApiKey: config.moonshotApiKey,
        baiduApiKey: config.baiduApiKey,
        minimaxApiKey: config.minimaxApiKey,
        doubaoApiKey: config.doubaoApiKey,
        ollamaBaseUrl: config.ollamaBaseUrl,
      };

      const otherConfig = {
        githubToken: config.githubToken,
        gitlabToken: config.gitlabToken,
        maxAnalyzeFiles: config.maxAnalyzeFiles,
        llmConcurrency: config.llmConcurrency,
        llmGapMs: config.llmGapMs,
        outputLanguage: config.outputLanguage,
      };

      await api.updateUserConfig({
        llmConfig,
        otherConfig,
      });

      setHasChanges(false);
      setConfigSource('runtime');

      // 记录用户操作
      import('@/shared/utils/logger').then(({ logger }) => {
        logger.logUserAction('保存系统配置', {
          provider: config.llmProvider,
          hasApiKey: !!config.llmApiKey,
          maxFiles: config.maxAnalyzeFiles,
          concurrency: config.llmConcurrency,
          language: config.outputLanguage,
        });
      }).catch(() => { });

      toast.success("配置已保存到后端！刷新页面后生效");

      // 提示用户刷新页面
      setTimeout(() => {
        if (window.confirm("配置已保存。是否立即刷新页面使配置生效？")) {
          window.location.reload();
        }
      }, 1000);
    } catch (error) {
      console.error('Failed to save config:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`保存配置失败: ${errorMessage}`);
    }
  };

  const resetConfig = async () => {
    if (window.confirm("确定要重置为默认配置吗？这将清除所有用户配置。")) {
      try {
        // 删除后端配置
        await api.deleteUserConfig();

        // 重新加载配置（会使用后端默认配置）
        await loadConfig();
        setHasChanges(false);

        // 记录用户操作
        import('@/shared/utils/logger').then(({ logger }) => {
          logger.logUserAction('重置系统配置', { action: 'reset_to_default' });
        }).catch(() => { });

        toast.success("已重置为默认配置");
      } catch (error) {
        console.error('Failed to reset config:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        toast.error(`重置配置失败: ${errorMessage}`);
      }
    }
  };

  const updateConfig = (key: keyof SystemConfigData, value: any) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, [key]: value } : null);
    setHasChanges(true);
  };

  const toggleShowApiKey = (field: string) => {
    setShowApiKeys(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getCurrentApiKey = () => {
    if (!config) return '';
    const provider = config.llmProvider.toLowerCase();
    const keyMap: Record<string, string> = {
      gemini: config.geminiApiKey,
      openai: config.openaiApiKey,
      claude: config.claudeApiKey,
      qwen: config.qwenApiKey,
      deepseek: config.deepseekApiKey,
      zhipu: config.zhipuApiKey,
      moonshot: config.moonshotApiKey,
      baidu: config.baiduApiKey,
      minimax: config.minimaxApiKey,
      doubao: config.doubaoApiKey,
      ollama: 'ollama',
    };

    return config.llmApiKey || keyMap[provider] || '';
  };

  const isConfigured = config ? getCurrentApiKey() !== '' : false;

  // 如果正在加载或配置为 null，显示加载状态
  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-none h-12 w-12 border-4 border-black border-t-transparent mx-auto mb-4"></div>
          <p className="text-black font-mono font-bold uppercase">正在从后端加载配置...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 配置状态提示 */}
      <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="flex-1 flex items-center justify-between">
          <div className="font-mono text-sm text-blue-800">
            <strong className="uppercase">当前配置来源：</strong>
            {configSource === 'runtime' ? (
              <Badge variant="default" className="ml-2 rounded-none border-blue-800 bg-blue-600 text-white font-bold uppercase">运行时配置</Badge>
            ) : (
              <Badge variant="outline" className="ml-2 rounded-none border-blue-800 text-blue-800 font-bold uppercase">构建时配置</Badge>
            )}
            <span className="ml-4 text-sm font-bold">
              {isConfigured ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> LLM 已配置
                </span>
              ) : (
                <span className="text-orange-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> 未配置 LLM
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button onClick={saveConfig} size="sm" className="retro-btn bg-black text-white border-2 border-black hover:bg-gray-800 rounded-none h-8 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
                <Save className="w-3 h-3 mr-2" />
                保存配置
              </Button>
            )}
            {configSource === 'runtime' && (
              <Button onClick={resetConfig} variant="outline" size="sm" className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-8 font-bold uppercase">
                <RotateCcw className="w-3 h-3 mr-2" />
                重置
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="llm" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-transparent border-2 border-black p-0 h-auto gap-0 mb-6">
          <TabsTrigger value="llm" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
            <Zap className="w-3 h-3 mr-2" />
            LLM 配置
          </TabsTrigger>
          <TabsTrigger value="platforms" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
            <Key className="w-3 h-3 mr-2" />
            平台密钥
          </TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
            <Settings className="w-3 h-3 mr-2" />
            分析参数
          </TabsTrigger>
          <TabsTrigger value="other" className="rounded-none data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
            <Globe className="w-3 h-3 mr-2" />
            其他配置
          </TabsTrigger>
        </TabsList>

        {/* LLM 基础配置 */}
        <TabsContent value="llm" className="space-y-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">LLM 提供商配置</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">选择和配置大语言模型服务</p>
            </div>
            <div className="p-6 space-y-4 font-mono">
              <div className="space-y-2">
                <Label className="font-bold uppercase">当前使用的 LLM 提供商</Label>
                <Select
                  value={config.llmProvider}
                  onValueChange={(value) => updateConfig('llmProvider', value)}
                >
                  <SelectTrigger className="retro-input h-10 bg-gray-50 border-2 border-black text-black focus:ring-0 focus:border-primary rounded-none font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="retro-card border-2 border-black rounded-none">
                    <div className="px-2 py-1.5 text-xs font-bold text-gray-500 uppercase">国际平台</div>
                    {LLM_PROVIDERS.filter(p => p.category === 'international').map(provider => (
                      <SelectItem key={provider.value} value={provider.value} className="font-mono focus:bg-primary/20 focus:text-black">
                        {provider.icon} {provider.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-bold text-gray-500 uppercase mt-2">国内平台</div>
                    {LLM_PROVIDERS.filter(p => p.category === 'domestic').map(provider => (
                      <SelectItem key={provider.value} value={provider.value} className="font-mono focus:bg-primary/20 focus:text-black">
                        {provider.icon} {provider.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-bold text-gray-500 uppercase mt-2">本地部署</div>
                    {LLM_PROVIDERS.filter(p => p.category === 'local').map(provider => (
                      <SelectItem key={provider.value} value={provider.value} className="font-mono focus:bg-primary/20 focus:text-black">
                        {provider.icon} {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-bold uppercase">通用 API Key（可选）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys['llm'] ? 'text' : 'password'}
                    value={config.llmApiKey}
                    onChange={(e) => updateConfig('llmApiKey', e.target.value)}
                    placeholder="留空则使用平台专用 API Key"
                    className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey('llm')}
                    className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 w-10"
                  >
                    {showApiKeys['llm'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 font-bold">
                  如果设置，将优先使用此 API Key；否则使用下方对应平台的专用 API Key
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-bold uppercase">模型名称（可选）</Label>
                <Input
                  value={config.llmModel}
                  onChange={(e) => updateConfig('llmModel', e.target.value)}
                  placeholder={`默认：${DEFAULT_MODELS[config.llmProvider as keyof typeof DEFAULT_MODELS] || '自动'}`}
                  className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                />
                <p className="text-xs text-gray-500 font-bold">
                  留空使用默认模型
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-bold uppercase">API 基础 URL（推荐配置）</Label>
                <Input
                  value={config.llmBaseUrl}
                  onChange={(e) => updateConfig('llmBaseUrl', e.target.value)}
                  placeholder="例如：https://api.example.com/v1"
                  className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                />
                <div className="text-xs text-gray-500 font-mono space-y-1">
                  <p>💡 <strong>使用 API 中转站？</strong>在这里填入中转站地址。配置保存后会在实际使用时自动验证。</p>
                  <details className="cursor-pointer">
                    <summary className="text-primary hover:underline font-bold">查看常见 API 中转示例</summary>
                    <div className="mt-2 p-3 bg-gray-100 border-2 border-black rounded-none space-y-1 text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <p><strong>OpenAI 兼容格式：</strong></p>
                      <p>• https://your-proxy.com/v1</p>
                      <p>• https://api.openai-proxy.org/v1</p>
                      <p className="pt-2"><strong>其他中转格式：</strong></p>
                      <p>• https://your-api-gateway.com/openai</p>
                      <p>• https://custom-endpoint.com/api</p>
                      <p className="pt-2 text-orange-600 font-bold">⚠️ 确保中转站支持你选择的 LLM 平台</p>
                    </div>
                  </details>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold uppercase">超时时间（毫秒）</Label>
                  <Input
                    type="number"
                    value={config.llmTimeout}
                    onChange={(e) => updateConfig('llmTimeout', Number(e.target.value))}
                    className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase">温度参数（0-2）</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={config.llmTemperature}
                    onChange={(e) => updateConfig('llmTemperature', Number(e.target.value))}
                    className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold uppercase">最大 Tokens</Label>
                  <Input
                    type="number"
                    value={config.llmMaxTokens}
                    onChange={(e) => updateConfig('llmMaxTokens', Number(e.target.value))}
                    className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t-2 border-black border-dashed">
                <Label className="font-bold uppercase">自定义请求头（高级，可选）</Label>
                <Input
                  value={config.llmCustomHeaders}
                  onChange={(e) => updateConfig('llmCustomHeaders', e.target.value)}
                  placeholder='{"X-Custom-Header": "value", "Another-Header": "value2"}'
                  className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                />
                <p className="text-xs text-gray-500 font-bold">
                  JSON 格式，用于某些中转站或自建服务的特殊要求。例如：<code className="bg-gray-200 px-1 py-0.5 border border-black">&#123;"X-API-Version": "v1"&#125;</code>
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 平台专用密钥 */}
        <TabsContent value="platforms" className="space-y-6">
          <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
            <Key className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <div className="space-y-1 font-mono text-sm text-blue-800">
                <p className="font-bold uppercase">配置各平台的 API Key</p>
                <p>方便快速切换。如果设置了通用 API Key，将优先使用通用配置。</p>
                <p className="text-xs text-blue-700 pt-1 font-bold">
                  💡 <strong>使用 API 中转站的用户注意：</strong>这里填入的应该是<strong>中转站提供的 API Key</strong>，而不是官方 Key。
                  中转站地址请在「LLM 配置」标签页的「API 基础 URL」中填写。
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { key: 'geminiApiKey', label: 'Google Gemini API Key', icon: '🔵', hint: '官方：https://makersuite.google.com/app/apikey | 或使用中转站 Key' },
              { key: 'openaiApiKey', label: 'OpenAI API Key', icon: '🟢', hint: '官方：https://platform.openai.com/api-keys | 或使用中转站 Key' },
              { key: 'claudeApiKey', label: 'Claude API Key', icon: '🟣', hint: '官方：https://console.anthropic.com/ | 或使用中转站 Key' },
              { key: 'qwenApiKey', label: '通义千问 API Key', icon: '🟠', hint: '官方：https://dashscope.console.aliyun.com/ | 或使用中转站 Key' },
              { key: 'deepseekApiKey', label: 'DeepSeek API Key', icon: '🔷', hint: '官方：https://platform.deepseek.com/ | 或使用中转站 Key' },
              { key: 'zhipuApiKey', label: '智谱AI API Key', icon: '🔴', hint: '官方：https://open.bigmodel.cn/ | 或使用中转站 Key' },
              { key: 'moonshotApiKey', label: 'Moonshot API Key', icon: '🌙', hint: '官方：https://platform.moonshot.cn/ | 或使用中转站 Key' },
              { key: 'baiduApiKey', label: '百度文心 API Key', icon: '🔵', hint: '官方格式：API_KEY:SECRET_KEY | 或使用中转站 Key' },
              { key: 'minimaxApiKey', label: 'MiniMax API Key', icon: '⚡', hint: '官方：https://www.minimaxi.com/ | 或使用中转站 Key' },
              { key: 'doubaoApiKey', label: '字节豆包 API Key', icon: '🎯', hint: '官方：https://console.volcengine.com/ark | 或使用中转站 Key' },
            ].map(({ key, label, icon, hint }) => (
              <div key={key} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
                <div className="p-4 border-b-2 border-black bg-gray-50">
                  <h3 className="text-sm font-display font-bold uppercase flex items-center gap-2">
                    <span>{icon}</span>
                    {label}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-1 truncate" title={hint}>{hint}</p>
                </div>
                <div className="p-4">
                  <div className="flex gap-2">
                    <Input
                      type={showApiKeys[key] ? 'text' : 'password'}
                      value={config[key as keyof SystemConfigData] as string}
                      onChange={(e) => updateConfig(key as keyof SystemConfigData, e.target.value)}
                      placeholder={`输入 ${label}`}
                      className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleShowApiKey(key)}
                      className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 w-10 flex-shrink-0"
                    >
                      {showApiKeys[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase flex items-center gap-2">
                <span>🖥️</span>
                Ollama 基础 URL
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-1">本地 Ollama 服务的 API 端点</p>
            </div>
            <div className="p-6">
              <Input
                value={config.ollamaBaseUrl}
                onChange={(e) => updateConfig('ollamaBaseUrl', e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
              />
            </div>
          </div>
        </TabsContent>

        {/* 分析参数配置 */}
        <TabsContent value="analysis" className="space-y-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">代码分析参数</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">调整代码分析的行为和性能</p>
            </div>
            <div className="p-6 space-y-4 font-mono">
              <div className="space-y-2">
                <Label className="font-bold uppercase">最大分析文件数</Label>
                <Input
                  type="number"
                  value={config.maxAnalyzeFiles}
                  onChange={(e) => updateConfig('maxAnalyzeFiles', Number(e.target.value))}
                  className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                />
                <p className="text-xs text-gray-500 font-bold">
                  单次分析任务最多处理的文件数量
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-bold uppercase">LLM 并发请求数</Label>
                <Input
                  type="number"
                  value={config.llmConcurrency}
                  onChange={(e) => updateConfig('llmConcurrency', Number(e.target.value))}
                  className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                />
                <p className="text-xs text-gray-500 font-bold">
                  同时发送给 LLM 的请求数量（降低可避免速率限制）
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-bold uppercase">请求间隔（毫秒）</Label>
                <Input
                  type="number"
                  value={config.llmGapMs}
                  onChange={(e) => updateConfig('llmGapMs', Number(e.target.value))}
                  className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                />
                <p className="text-xs text-gray-500 font-bold">
                  每个 LLM 请求之间的延迟时间
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-bold uppercase">输出语言</Label>
                <Select
                  value={config.outputLanguage}
                  onValueChange={(value) => updateConfig('outputLanguage', value)}
                >
                  <SelectTrigger className="retro-input h-10 bg-gray-50 border-2 border-black text-black focus:ring-0 focus:border-primary rounded-none font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="retro-card border-2 border-black rounded-none">
                    <SelectItem value="zh-CN" className="font-mono focus:bg-primary/20 focus:text-black">🇨🇳 中文</SelectItem>
                    <SelectItem value="en-US" className="font-mono focus:bg-primary/20 focus:text-black">🇺🇸 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 其他配置 */}
        <TabsContent value="other" className="space-y-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">GitHub 集成</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">配置 GitHub Personal Access Token 以访问私有仓库</p>
            </div>
            <div className="p-6 space-y-4 font-mono">
              <div className="space-y-2">
                <Label className="font-bold uppercase">GitHub Token（可选）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys['github'] ? 'text' : 'password'}
                    value={config.githubToken}
                    onChange={(e) => updateConfig('githubToken', e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey('github')}
                    className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 w-10"
                  >
                    {showApiKeys['github'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 font-bold">
                  获取：https://github.com/settings/tokens
                </p>
              </div>
            </div>
          </div>

          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">GitLab 集成</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">配置 GitLab Personal Access Token 以访问私有仓库</p>
            </div>
            <div className="p-6 space-y-4 font-mono">
              <div className="space-y-2">
                <Label className="font-bold uppercase">GitLab Token（可选）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKeys['gitlab'] ? 'text' : 'password'}
                    value={config.gitlabToken}
                    onChange={(e) => updateConfig('gitlabToken', e.target.value)}
                    placeholder="glpat-xxxxxxxxxxxx"
                    className="retro-input h-10 bg-gray-50 border-2 border-black text-black placeholder:text-gray-500 focus:ring-0 focus:border-primary rounded-none font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowApiKey('gitlab')}
                    className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-10 w-10"
                  >
                    {showApiKeys['gitlab'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 font-bold">
                  获取：https://gitlab.com/-/profile/personal_access_tokens
                </p>
              </div>
            </div>
          </div>

          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase">配置说明</h3>
            </div>
            <div className="p-6 space-y-3 text-sm text-gray-600 font-mono font-medium">
              <div className="flex items-start gap-3 p-3 bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Database className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-bold text-black uppercase">用户配置</p>
                  <p className="text-xs mt-1">
                    配置保存在后端数据库中，与用户账号绑定。
                    可以在不重新构建 Docker 镜像的情况下修改配置，配置会在所有分析任务中生效。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Settings className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-bold text-black uppercase">配置优先级</p>
                  <p className="text-xs mt-1">
                    运行时配置 &gt; 构建时配置。如果设置了运行时配置，将覆盖构建时的环境变量。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Key className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-bold text-black uppercase">安全提示</p>
                  <p className="text-xs mt-1">
                    API Keys 存储在浏览器本地，其他网站无法访问。但清除浏览器数据会删除所有配置。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 底部操作按钮 */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 flex gap-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 z-50">
          <Button onClick={saveConfig} size="lg" className="retro-btn bg-black text-white border-2 border-black hover:bg-gray-800 rounded-none h-12 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]">
            <Save className="w-4 h-4 mr-2" />
            保存所有更改
          </Button>
          <Button onClick={loadConfig} variant="outline" size="lg" className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-12 font-bold uppercase">
            取消
          </Button>
        </div>
      )}
    </div>
  );
}

