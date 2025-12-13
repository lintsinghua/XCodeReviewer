/**
 * 嵌入模型配置组件
 * Cyberpunk Terminal Aesthetic
 * 独立于 LLM 配置，专门用于 Agent 审计的 RAG 系统
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Cpu,
  Check,
  X,
  Loader2,
  RefreshCw,
  Server,
  Key,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/shared/api/serverClient";

interface EmbeddingProvider {
  id: string;
  name: string;
  description: string;
  models: string[];
  requires_api_key: boolean;
  default_model: string;
}

interface EmbeddingConfig {
  provider: string;
  model: string;
  base_url: string | null;
  dimensions: number;
  batch_size: number;
}

interface TestResult {
  success: boolean;
  message: string;
  dimensions?: number;
  sample_embedding?: number[];
  latency_ms?: number;
}

export default function EmbeddingConfigPanel() {
  const [providers, setProviders] = useState<EmbeddingProvider[]>([]);
  const [currentConfig, setCurrentConfig] = useState<EmbeddingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // 表单状态
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [batchSize, setBatchSize] = useState(100);

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 当 provider 改变时更新模型
  useEffect(() => {
    if (selectedProvider) {
      const provider = providers.find((p) => p.id === selectedProvider);
      if (provider) {
        setSelectedModel(provider.default_model);
      }
    }
  }, [selectedProvider, providers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [providersRes, configRes] = await Promise.all([
        apiClient.get("/embedding/providers"),
        apiClient.get("/embedding/config"),
      ]);

      setProviders(providersRes.data);
      setCurrentConfig(configRes.data);

      // 设置表单默认值
      if (configRes.data) {
        setSelectedProvider(configRes.data.provider);
        setSelectedModel(configRes.data.model);
        setBaseUrl(configRes.data.base_url || "");
        setBatchSize(configRes.data.batch_size);
      }
    } catch (error) {
      toast.error("加载配置失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider || !selectedModel) {
      toast.error("请选择提供商和模型");
      return;
    }

    const provider = providers.find((p) => p.id === selectedProvider);
    if (provider?.requires_api_key && !apiKey) {
      toast.error(`${provider.name} 需要 API Key`);
      return;
    }

    try {
      setSaving(true);
      await apiClient.put("/embedding/config", {
        provider: selectedProvider,
        model: selectedModel,
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
        batch_size: batchSize,
      });

      toast.success("配置已保存");
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedProvider || !selectedModel) {
      toast.error("请选择提供商和模型");
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const response = await apiClient.post("/embedding/test", {
        provider: selectedProvider,
        model: selectedModel,
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
      });

      setTestResult(response.data);

      if (response.data.success) {
        toast.success("测试成功");
      } else {
        toast.error("测试失败");
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.response?.data?.detail || "测试失败",
      });
      toast.error("测试失败");
    } finally {
      setTesting(false);
    }
  };

  const selectedProviderInfo = providers.find((p) => p.id === selectedProvider);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 当前配置状态 */}
      {currentConfig && (
        <div className="cyber-card p-4 border-primary/30">
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-primary" />
            <span className="font-mono font-bold text-sm uppercase text-gray-300">当前配置</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <p className="text-xs text-gray-500 uppercase mb-1">提供商</p>
              <Badge className="bg-primary/20 text-primary border-primary/50 font-mono">
                {currentConfig.provider}
              </Badge>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <p className="text-xs text-gray-500 uppercase mb-1">模型</p>
              <p className="font-mono text-sm text-gray-300 truncate">{currentConfig.model}</p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <p className="text-xs text-gray-500 uppercase mb-1">向量维度</p>
              <p className="font-mono text-sm text-gray-300">{currentConfig.dimensions}</p>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800">
              <p className="text-xs text-gray-500 uppercase mb-1">批处理大小</p>
              <p className="font-mono text-sm text-gray-300">{currentConfig.batch_size}</p>
            </div>
          </div>
        </div>
      )}

      {/* 配置表单 */}
      <div className="cyber-card p-6 space-y-6">
        {/* 提供商选择 */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-gray-500 uppercase">嵌入模型提供商</Label>
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="h-12 cyber-input">
              <SelectValue placeholder="选择提供商" />
            </SelectTrigger>
            <SelectContent className="bg-[#0c0c12] border-gray-700">
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id} className="font-mono">
                  <div className="flex items-center gap-2">
                    <span>{provider.name}</span>
                    {provider.requires_api_key ? (
                      <Key className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Cpu className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedProviderInfo && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Info className="w-3 h-3 text-sky-400" />
              {selectedProviderInfo.description}
            </p>
          )}
        </div>

        {/* 模型选择 */}
        {selectedProviderInfo && (
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-500 uppercase">模型</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-10 cyber-input">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent className="bg-[#0c0c12] border-gray-700">
                {selectedProviderInfo.models.map((model) => (
                  <SelectItem key={model} value={model} className="font-mono">
                    <span className="text-sm">{model}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* API Key */}
        {selectedProviderInfo?.requires_api_key && (
          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-500 uppercase">
              API Key
              <span className="text-rose-400 ml-1">*</span>
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key"
              className="h-10 cyber-input"
            />
            <p className="text-xs text-gray-600">
              API Key 将安全存储，不会显示在页面上
            </p>
          </div>
        )}

        {/* 自定义端点 */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-gray-500 uppercase">
            自定义 API 端点 <span className="text-gray-600">(可选)</span>
          </Label>
          <Input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={
              selectedProvider === "ollama"
                ? "http://localhost:11434"
                : selectedProvider === "huggingface"
                ? "https://router.huggingface.co"
                : selectedProvider === "cohere"
                ? "https://api.cohere.com/v2"
                : selectedProvider === "jina"
                ? "https://api.jina.ai/v1"
                : "https://api.openai.com/v1"
            }
            className="h-10 cyber-input"
          />
          <p className="text-xs text-gray-600">
            用于 API 代理或自托管服务
          </p>
        </div>

        {/* 批处理大小 */}
        <div className="space-y-2">
          <Label className="text-xs font-bold text-gray-500 uppercase">批处理大小</Label>
          <Input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
            min={1}
            max={500}
            className="h-10 cyber-input w-32"
          />
          <p className="text-xs text-gray-600">
            每批嵌入的文本数量，建议 50-100
          </p>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div
            className={`p-4 rounded-lg ${
              testResult.success
                ? "bg-emerald-500/10 border border-emerald-500/30"
                : "bg-rose-500/10 border border-rose-500/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <span
                className={`font-bold ${
                  testResult.success ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {testResult.success ? "测试成功" : "测试失败"}
              </span>
            </div>
            <p className="text-sm text-gray-400">{testResult.message}</p>
            {testResult.success && (
              <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500 space-y-1 font-mono">
                <div>向量维度: <span className="text-gray-300">{testResult.dimensions}</span></div>
                <div>延迟: <span className="text-gray-300">{testResult.latency_ms}ms</span></div>
                {testResult.sample_embedding && (
                  <div className="truncate">
                    示例向量: <span className="text-gray-400">[{testResult.sample_embedding.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}...]</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-800 border-dashed">
          <Button
            onClick={handleTest}
            disabled={testing || !selectedProvider || !selectedModel}
            variant="outline"
            className="cyber-btn-outline h-10"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4 mr-2" />
            )}
            测试连接
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !selectedProvider || !selectedModel}
            className="cyber-btn-primary h-10"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            保存配置
          </Button>

          <Button
            onClick={loadData}
            variant="ghost"
            className="cyber-btn-ghost ml-auto h-10"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 说明 */}
      <div className="bg-gray-900/50 border border-gray-800 p-4 rounded-lg text-xs space-y-2">
        <p className="font-bold uppercase text-gray-400 flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400" />
          关于嵌入模型
        </p>
        <ul className="text-gray-500 space-y-1 ml-6">
          <li>• 嵌入模型用于 Agent 审计的代码语义搜索 (RAG)</li>
          <li>• 与分析使用的 LLM 独立配置，互不影响</li>
          <li>• 推荐使用 <span className="text-gray-300">OpenAI text-embedding-3-small</span> 或本地 <span className="text-gray-300">Ollama</span></li>
          <li>• 向量维度影响存储空间和检索精度</li>
        </ul>
      </div>
    </div>
  );
}
