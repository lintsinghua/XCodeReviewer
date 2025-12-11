/**
 * 嵌入模型配置组件
 * 独立于 LLM 配置，专门用于 Agent 审计的 RAG 系统
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
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
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <CardHeader className="border-b-2 border-black bg-purple-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 border-2 border-purple-300">
            <Brain className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <CardTitle className="font-mono text-lg">嵌入模型配置</CardTitle>
            <CardDescription>
              用于 Agent 审计的 RAG 代码检索，独立于分析 LLM
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* 当前配置状态 */}
        {currentConfig && (
          <div className="p-4 bg-gray-50 border-2 border-gray-200 space-y-2">
            <div className="flex items-center gap-2 text-sm font-mono font-bold">
              <Server className="w-4 h-4" />
              当前配置
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">提供商:</span>{" "}
                <Badge variant="outline" className="ml-1">
                  {currentConfig.provider}
                </Badge>
              </div>
              <div>
                <span className="text-gray-500">模型:</span>{" "}
                <span className="font-mono">{currentConfig.model}</span>
              </div>
              <div>
                <span className="text-gray-500">向量维度:</span>{" "}
                <span className="font-mono">{currentConfig.dimensions}</span>
              </div>
              <div>
                <span className="text-gray-500">批处理大小:</span>{" "}
                <span className="font-mono">{currentConfig.batch_size}</span>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* 提供商选择 */}
        <div className="space-y-2">
          <Label className="font-mono font-bold">嵌入模型提供商</Label>
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="border-2 border-black rounded-none">
              <SelectValue placeholder="选择提供商" />
            </SelectTrigger>
            <SelectContent className="border-2 border-black rounded-none">
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex items-center gap-2">
                    <span>{provider.name}</span>
                    {provider.requires_api_key ? (
                      <Key className="w-3 h-3 text-amber-500" />
                    ) : (
                      <Cpu className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedProviderInfo && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Info className="w-3 h-3" />
              {selectedProviderInfo.description}
            </p>
          )}
        </div>

        {/* 模型选择 */}
        {selectedProviderInfo && (
          <div className="space-y-2">
            <Label className="font-mono font-bold">模型</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="border-2 border-black rounded-none">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent className="border-2 border-black rounded-none">
                {selectedProviderInfo.models.map((model) => (
                  <SelectItem key={model} value={model}>
                    <span className="font-mono text-sm">{model}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* API Key */}
        {selectedProviderInfo?.requires_api_key && (
          <div className="space-y-2">
            <Label className="font-mono font-bold">
              API Key
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key"
              className="border-2 border-black rounded-none font-mono"
            />
            <p className="text-xs text-gray-500">
              API Key 将安全存储，不会显示在页面上
            </p>
          </div>
        )}

        {/* 自定义端点 */}
        <div className="space-y-2">
          <Label className="font-mono font-bold">
            自定义 API 端点 <span className="text-gray-400">(可选)</span>
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
            className="border-2 border-black rounded-none font-mono"
          />
          <p className="text-xs text-gray-500">
            用于 API 代理或自托管服务
          </p>
        </div>

        {/* 批处理大小 */}
        <div className="space-y-2">
          <Label className="font-mono font-bold">批处理大小</Label>
          <Input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
            min={1}
            max={500}
            className="border-2 border-black rounded-none font-mono w-32"
          />
          <p className="text-xs text-gray-500">
            每批嵌入的文本数量，建议 50-100
          </p>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div
            className={`p-4 border-2 ${
              testResult.success
                ? "border-green-500 bg-green-50"
                : "border-red-500 bg-red-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <X className="w-5 h-5 text-red-600" />
              )}
              <span
                className={`font-bold ${
                  testResult.success ? "text-green-700" : "text-red-700"
                }`}
              >
                {testResult.success ? "测试成功" : "测试失败"}
              </span>
            </div>
            <p className="text-sm">{testResult.message}</p>
            {testResult.success && (
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                <div>向量维度: {testResult.dimensions}</div>
                <div>延迟: {testResult.latency_ms}ms</div>
                {testResult.sample_embedding && (
                  <div>
                    示例向量: [{testResult.sample_embedding.map((v) => v.toFixed(4)).join(", ")}...]
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-4">
          <Button
            onClick={handleTest}
            disabled={testing || !selectedProvider || !selectedModel}
            variant="outline"
            className="border-2 border-black rounded-none hover:bg-gray-100"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            测试连接
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !selectedProvider || !selectedModel}
            className="bg-purple-600 hover:bg-purple-700 border-2 border-black rounded-none"
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
            className="ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* 说明 */}
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 text-sm">
          <p className="font-bold mb-1">💡 关于嵌入模型</p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>嵌入模型用于 Agent 审计的代码语义搜索 (RAG)</li>
            <li>与分析使用的 LLM 独立配置，互不影响</li>
            <li>推荐使用 OpenAI text-embedding-3-small 或本地 Ollama</li>
            <li>向量维度影响存储空间和检索精度</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

