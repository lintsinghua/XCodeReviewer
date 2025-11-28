import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings, Save, RotateCcw, Eye, EyeOff, CheckCircle2, AlertCircle,
  Info, Zap, Globe, PlayCircle, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/shared/api/database";

// LLM 提供商配置 - 简化分类
const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI GPT', icon: '🟢', category: 'litellm', hint: 'gpt-4o, gpt-4o-mini 等' },
  { value: 'claude', label: 'Anthropic Claude', icon: '🟣', category: 'litellm', hint: 'claude-3.5-sonnet 等' },
  { value: 'gemini', label: 'Google Gemini', icon: '🔵', category: 'litellm', hint: 'gemini-1.5-flash 等' },
  { value: 'deepseek', label: 'DeepSeek', icon: '🔷', category: 'litellm', hint: 'deepseek-chat, deepseek-coder' },
  { value: 'qwen', label: '通义千问', icon: '🟠', category: 'litellm', hint: 'qwen-turbo, qwen-max 等' },
  { value: 'zhipu', label: '智谱AI (GLM)', icon: '🔴', category: 'litellm', hint: 'glm-4-flash, glm-4 等' },
  { value: 'moonshot', label: 'Moonshot (Kimi)', icon: '🌙', category: 'litellm', hint: 'moonshot-v1-8k 等' },
  { value: 'ollama', label: 'Ollama 本地', icon: '🖥️', category: 'litellm', hint: 'llama3, codellama 等' },
  { value: 'baidu', label: '百度文心', icon: '📘', category: 'native', hint: 'ERNIE-3.5-8K (需要 API_KEY:SECRET_KEY)' },
  { value: 'minimax', label: 'MiniMax', icon: '⚡', category: 'native', hint: 'abab6.5-chat 等' },
  { value: 'doubao', label: '字节豆包', icon: '🎯', category: 'native', hint: 'doubao-pro-32k 等' },
];

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini', claude: 'claude-3-5-sonnet-20241022', gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat', qwen: 'qwen-turbo', zhipu: 'glm-4-flash', moonshot: 'moonshot-v1-8k',
  ollama: 'llama3', baidu: 'ERNIE-3.5-8K', minimax: 'abab6.5-chat', doubao: 'doubao-pro-32k',
};

interface SystemConfigData {
  llmProvider: string; llmApiKey: string; llmModel: string; llmBaseUrl: string;
  llmTimeout: number; llmTemperature: number; llmMaxTokens: number;
  githubToken: string; gitlabToken: string;
  maxAnalyzeFiles: number; llmConcurrency: number; llmGapMs: number; outputLanguage: string;
}

export function SystemConfig() {
  const [config, setConfig] = useState<SystemConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [testingLLM, setTestingLLM] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const defaultConfig = await api.getDefaultConfig();
      const backendConfig = await api.getUserConfig();
      
      const merged: SystemConfigData = {
        llmProvider: backendConfig?.llmConfig?.llmProvider || defaultConfig?.llmConfig?.llmProvider || 'openai',
        llmApiKey: backendConfig?.llmConfig?.llmApiKey || '',
        llmModel: backendConfig?.llmConfig?.llmModel || '',
        llmBaseUrl: backendConfig?.llmConfig?.llmBaseUrl || '',
        llmTimeout: backendConfig?.llmConfig?.llmTimeout || defaultConfig?.llmConfig?.llmTimeout || 150000,
        llmTemperature: backendConfig?.llmConfig?.llmTemperature ?? defaultConfig?.llmConfig?.llmTemperature ?? 0.1,
        llmMaxTokens: backendConfig?.llmConfig?.llmMaxTokens || defaultConfig?.llmConfig?.llmMaxTokens || 4096,
        githubToken: backendConfig?.otherConfig?.githubToken || '',
        gitlabToken: backendConfig?.otherConfig?.gitlabToken || '',
        maxAnalyzeFiles: backendConfig?.otherConfig?.maxAnalyzeFiles || defaultConfig?.otherConfig?.maxAnalyzeFiles || 50,
        llmConcurrency: backendConfig?.otherConfig?.llmConcurrency || defaultConfig?.otherConfig?.llmConcurrency || 3,
        llmGapMs: backendConfig?.otherConfig?.llmGapMs || defaultConfig?.otherConfig?.llmGapMs || 2000,
        outputLanguage: backendConfig?.otherConfig?.outputLanguage || defaultConfig?.otherConfig?.outputLanguage || 'zh-CN',
      };
      setConfig(merged);
    } catch (error) {
      console.error('Failed to load config:', error);
      setConfig({
        llmProvider: 'openai', llmApiKey: '', llmModel: '', llmBaseUrl: '',
        llmTimeout: 150000, llmTemperature: 0.1, llmMaxTokens: 4096,
        githubToken: '', gitlabToken: '',
        maxAnalyzeFiles: 50, llmConcurrency: 3, llmGapMs: 2000, outputLanguage: 'zh-CN',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    try {
      await api.updateUserConfig({
        llmConfig: {
          llmProvider: config.llmProvider, llmApiKey: config.llmApiKey,
          llmModel: config.llmModel, llmBaseUrl: config.llmBaseUrl,
          llmTimeout: config.llmTimeout, llmTemperature: config.llmTemperature,
          llmMaxTokens: config.llmMaxTokens,
        },
        otherConfig: {
          githubToken: config.githubToken, gitlabToken: config.gitlabToken,
          maxAnalyzeFiles: config.maxAnalyzeFiles, llmConcurrency: config.llmConcurrency,
          llmGapMs: config.llmGapMs, outputLanguage: config.outputLanguage,
        },
      });
      setHasChanges(false);
      toast.success("配置已保存！");
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const resetConfig = async () => {
    if (!window.confirm("确定要重置为默认配置吗？")) return;
    try {
      await api.deleteUserConfig();
      await loadConfig();
      setHasChanges(false);
      toast.success("已重置为默认配置");
    } catch (error) {
      toast.error(`重置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const updateConfig = (key: keyof SystemConfigData, value: string | number) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, [key]: value } : null);
    setHasChanges(true);
  };

  const testLLMConnection = async () => {
    if (!config) return;
    if (!config.llmApiKey && config.llmProvider !== 'ollama') {
      toast.error('请先配置 API Key');
      return;
    }
    setTestingLLM(true);
    setLlmTestResult(null);
    try {
      const result = await api.testLLMConnection({
        provider: config.llmProvider,
        apiKey: config.llmApiKey,
        model: config.llmModel || undefined,
        baseUrl: config.llmBaseUrl || undefined,
      });
      setLlmTestResult(result);
      if (result.success) toast.success(`连接成功！模型: ${result.model}`);
      else toast.error(`连接失败: ${result.message}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setLlmTestResult({ success: false, message: msg });
      toast.error(`测试失败: ${msg}`);
    } finally {
      setTestingLLM(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-none h-12 w-12 border-4 border-black border-t-transparent mx-auto mb-4"></div>
          <p className="text-black font-mono font-bold uppercase">加载配置中...</p>
        </div>
      </div>
    );
  }

  const currentProvider = LLM_PROVIDERS.find(p => p.value === config.llmProvider);
  const isConfigured = config.llmApiKey !== '' || config.llmProvider === 'ollama';

  return (
    <div className="space-y-6">
      {/* 状态栏 */}
      <div className="bg-blue-50 border-2 border-blue-500 p-4 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
        <div className="flex items-center gap-4 font-mono text-sm">
          <Info className="h-5 w-5 text-blue-600" />
          <span className="font-bold">
            {isConfigured ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> LLM 已配置 ({currentProvider?.label})
              </span>
            ) : (
              <span className="text-orange-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> 请配置 LLM API Key
              </span>
            )}
          </span>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button onClick={saveConfig} size="sm" className="retro-btn bg-black text-white border-2 border-black hover:bg-gray-800 rounded-none h-8 font-bold uppercase">
              <Save className="w-3 h-3 mr-2" /> 保存
            </Button>
          )}
          <Button onClick={resetConfig} variant="outline" size="sm" className="retro-btn bg-white text-black border-2 border-black hover:bg-gray-100 rounded-none h-8 font-bold uppercase">
            <RotateCcw className="w-3 h-3 mr-2" /> 重置
          </Button>
        </div>
      </div>

      <Tabs defaultValue="llm" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-transparent border-2 border-black p-0 h-auto gap-0 mb-6">
          <TabsTrigger value="llm" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
            <Zap className="w-3 h-3 mr-2" /> LLM 配置
          </TabsTrigger>
          <TabsTrigger value="analysis" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
            <Settings className="w-3 h-3 mr-2" /> 分析参数
          </TabsTrigger>
          <TabsTrigger value="git" className="rounded-none data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
            <Globe className="w-3 h-3 mr-2" /> Git 集成
          </TabsTrigger>
        </TabsList>

        {/* LLM 配置 - 简化版 */}
        <TabsContent value="llm" className="space-y-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
            {/* 提供商选择 */}
            <div className="space-y-2">
              <Label className="font-mono font-bold uppercase">选择 LLM 提供商</Label>
              <Select value={config.llmProvider} onValueChange={(v) => updateConfig('llmProvider', v)}>
                <SelectTrigger className="h-12 bg-gray-50 border-2 border-black rounded-none font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-2 border-black rounded-none">
                  <div className="px-2 py-1.5 text-xs font-bold text-gray-500 uppercase">LiteLLM 统一适配 (推荐)</div>
                  {LLM_PROVIDERS.filter(p => p.category === 'litellm').map(p => (
                    <SelectItem key={p.value} value={p.value} className="font-mono">
                      <span className="flex items-center gap-2">
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                        <span className="text-xs text-gray-400">- {p.hint}</span>
                      </span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-bold text-gray-500 uppercase mt-2">原生适配器</div>
                  {LLM_PROVIDERS.filter(p => p.category === 'native').map(p => (
                    <SelectItem key={p.value} value={p.value} className="font-mono">
                      <span className="flex items-center gap-2">
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                        <span className="text-xs text-gray-400">- {p.hint}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            {config.llmProvider !== 'ollama' && (
              <div className="space-y-2">
                <Label className="font-mono font-bold uppercase">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={config.llmApiKey}
                    onChange={(e) => updateConfig('llmApiKey', e.target.value)}
                    placeholder={config.llmProvider === 'baidu' ? 'API_KEY:SECRET_KEY 格式' : '输入你的 API Key'}
                    className="h-12 bg-gray-50 border-2 border-black rounded-none font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}
                    className="h-12 w-12 border-2 border-black rounded-none">
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* 模型和 Base URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-mono font-bold uppercase">模型名称 (可选)</Label>
                <Input
                  value={config.llmModel}
                  onChange={(e) => updateConfig('llmModel', e.target.value)}
                  placeholder={`默认: ${DEFAULT_MODELS[config.llmProvider] || 'auto'}`}
                  className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono font-bold uppercase">API Base URL (可选)</Label>
                <Input
                  value={config.llmBaseUrl}
                  onChange={(e) => updateConfig('llmBaseUrl', e.target.value)}
                  placeholder="留空使用官方地址，或填入中转站地址"
                  className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono"
                />
              </div>
            </div>

            {/* 测试连接 */}
            <div className="pt-4 border-t-2 border-black border-dashed flex items-center justify-between">
              <div className="text-sm font-mono">
                <span className="font-bold">测试连接</span>
                <span className="text-gray-500 ml-2">验证配置是否正确</span>
              </div>
              <Button onClick={testLLMConnection} disabled={testingLLM || (!isConfigured && config.llmProvider !== 'ollama')}
                className="retro-btn bg-black text-white border-2 border-black hover:bg-gray-800 rounded-none h-10 font-bold uppercase">
                {testingLLM ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 测试中...</> : <><PlayCircle className="w-4 h-4 mr-2" /> 测试</>}
              </Button>
            </div>
            {llmTestResult && (
              <div className={`p-3 border-2 ${llmTestResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                <div className="flex items-center gap-2 font-mono text-sm">
                  {llmTestResult.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
                  <span className={llmTestResult.success ? 'text-green-800' : 'text-red-800'}>{llmTestResult.message}</span>
                </div>
              </div>
            )}

            {/* 高级参数 - 折叠 */}
            <details className="pt-4 border-t-2 border-black border-dashed">
              <summary className="font-mono font-bold uppercase cursor-pointer hover:text-blue-600">高级参数</summary>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">超时 (毫秒)</Label>
                  <Input type="number" value={config.llmTimeout} onChange={(e) => updateConfig('llmTimeout', Number(e.target.value))}
                    className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">温度 (0-2)</Label>
                  <Input type="number" step="0.1" min="0" max="2" value={config.llmTemperature}
                    onChange={(e) => updateConfig('llmTemperature', Number(e.target.value))}
                    className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">最大 Tokens</Label>
                  <Input type="number" value={config.llmMaxTokens} onChange={(e) => updateConfig('llmMaxTokens', Number(e.target.value))}
                    className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono" />
                </div>
              </div>
            </details>
          </div>

          {/* 使用说明 */}
          <div className="bg-gray-50 border-2 border-black p-4 font-mono text-xs space-y-2">
            <p className="font-bold uppercase">💡 配置说明</p>
            <p>• <strong>LiteLLM 统一适配</strong>: 大多数提供商通过 LiteLLM 统一处理，支持自动重试和负载均衡</p>
            <p>• <strong>原生适配器</strong>: 百度、MiniMax、豆包因 API 格式特殊，使用专用适配器</p>
            <p>• <strong>API 中转站</strong>: 在 Base URL 填入中转站地址即可，API Key 填中转站提供的 Key</p>
          </div>
        </TabsContent>

        {/* 分析参数 */}
        <TabsContent value="analysis" className="space-y-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-mono font-bold uppercase">最大分析文件数</Label>
                <Input type="number" value={config.maxAnalyzeFiles}
                  onChange={(e) => updateConfig('maxAnalyzeFiles', Number(e.target.value))}
                  className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono" />
                <p className="text-xs text-gray-500 font-mono">单次任务最多处理的文件数量</p>
              </div>
              <div className="space-y-2">
                <Label className="font-mono font-bold uppercase">LLM 并发数</Label>
                <Input type="number" value={config.llmConcurrency}
                  onChange={(e) => updateConfig('llmConcurrency', Number(e.target.value))}
                  className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono" />
                <p className="text-xs text-gray-500 font-mono">同时发送的 LLM 请求数量</p>
              </div>
              <div className="space-y-2">
                <Label className="font-mono font-bold uppercase">请求间隔 (毫秒)</Label>
                <Input type="number" value={config.llmGapMs}
                  onChange={(e) => updateConfig('llmGapMs', Number(e.target.value))}
                  className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono" />
                <p className="text-xs text-gray-500 font-mono">每个请求之间的延迟时间</p>
              </div>
              <div className="space-y-2">
                <Label className="font-mono font-bold uppercase">输出语言</Label>
                <Select value={config.outputLanguage} onValueChange={(v) => updateConfig('outputLanguage', v)}>
                  <SelectTrigger className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-black rounded-none">
                    <SelectItem value="zh-CN" className="font-mono">🇨🇳 中文</SelectItem>
                    <SelectItem value="en-US" className="font-mono">🇺🇸 English</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 font-mono">代码审查结果的输出语言</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Git 集成 */}
        <TabsContent value="git" className="space-y-6">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6">
            <div className="space-y-2">
              <Label className="font-mono font-bold uppercase">GitHub Token (可选)</Label>
              <Input
                type="password"
                value={config.githubToken}
                onChange={(e) => updateConfig('githubToken', e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono"
              />
              <p className="text-xs text-gray-500 font-mono">
                用于访问私有仓库。获取: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">github.com/settings/tokens</a>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="font-mono font-bold uppercase">GitLab Token (可选)</Label>
              <Input
                type="password"
                value={config.gitlabToken}
                onChange={(e) => updateConfig('gitlabToken', e.target.value)}
                placeholder="glpat-xxxxxxxxxxxx"
                className="h-10 bg-gray-50 border-2 border-black rounded-none font-mono"
              />
              <p className="text-xs text-gray-500 font-mono">
                用于访问私有仓库。获取: <a href="https://gitlab.com/-/profile/personal_access_tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">gitlab.com/-/profile/personal_access_tokens</a>
              </p>
            </div>
            <div className="bg-gray-50 border-2 border-black p-4 font-mono text-xs">
              <p className="font-bold">💡 提示</p>
              <p>• 公开仓库无需配置 Token</p>
              <p>• 私有仓库需要配置对应平台的 Token</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 底部保存按钮 */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 z-50">
          <Button onClick={saveConfig} className="retro-btn bg-black text-white border-2 border-black hover:bg-gray-800 rounded-none h-12 font-bold uppercase">
            <Save className="w-4 h-4 mr-2" /> 保存所有更改
          </Button>
        </div>
      )}
    </div>
  );
}
