import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/shared/services/api/client";

interface ApiKeyDialogProps {
  providerId: number | null;
  providerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ providerId, providerName, open, onOpenChange }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    has_api_key: boolean;
    api_key_preview?: string;
  } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    if (open && providerId) {
      loadApiKeyStatus();
    } else {
      // Reset state when dialog closes
      setApiKey("");
      setKeyStatus(null);
    }
  }, [open, providerId]);

  const loadApiKeyStatus = async () => {
    if (!providerId) return;

    try {
      setLoadingStatus(true);
      const response = await apiClient.get(`/llm-providers/${providerId}/api-key`);
      setKeyStatus(response);
    } catch (error) {
      console.error("Failed to load API key status:", error);
      // If error, assume no key is set
      setKeyStatus({ has_api_key: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!providerId || !apiKey.trim()) {
      toast.error("请输入有效的 API Key");
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.put(`/llm-providers/${providerId}/api-key`, {
        api_key: apiKey.trim()
      });
      
      setKeyStatus(response);
      setApiKey("");
      
      toast.success("API Key 保存成功");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to save API key:", error);
      const message = error?.response?.data?.detail || "保存 API Key 失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!providerId) return;

    if (!confirm("确定要删除此 API Key 吗？")) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.delete(`/llm-providers/${providerId}/api-key`);
      
      setKeyStatus({ has_api_key: false });
      setApiKey("");
      
      toast.success("API Key 已删除");
    } catch (error: any) {
      console.error("Failed to delete API key:", error);
      const message = error?.response?.data?.detail || "删除 API Key 失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <span>配置 API Key</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            为 <span className="font-semibold text-foreground">{providerName}</span> 配置 API Key
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {loadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Current Status */}
              {keyStatus && (
                <div className={`rounded-lg border p-4 ${keyStatus.has_api_key ? "border-green-500 bg-green-50" : "border-amber-500 bg-amber-50"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {keyStatus.has_api_key ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold text-sm mb-1.5 ${keyStatus.has_api_key ? "text-green-900" : "text-amber-900"}`}>
                        {keyStatus.has_api_key ? "✓ 已配置 API Key" : "⚠ 未配置 API Key"}
                      </div>
                      <div className="text-xs space-y-1.5">
                        {keyStatus.has_api_key ? (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-green-700">当前 API Key:</span>
                              <code className="px-2 py-0.5 bg-green-100 border border-green-300 rounded font-mono text-green-800">
                                {keyStatus.api_key_preview || "****...****"}
                              </code>
                            </div>
                            <p className="text-green-700">
                              在下方输入新的 API Key 以替换现有配置
                            </p>
                          </>
                        ) : (
                          <p className="text-amber-700">
                            当前使用环境变量中的 API Key，或尚未配置
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="api-key" className="text-sm font-semibold">
                  {keyStatus?.has_api_key ? "新的 API Key" : "API Key"}
                </Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={keyStatus?.has_api_key ? "输入新的 API Key 以替换" : "输入 API Key"}
                    className="pr-10 font-mono text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-start space-x-2 text-xs text-muted-foreground">
                  <Key className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    API Key 将使用 AES 加密存储。优先级：<strong className="text-foreground">数据库</strong> &gt; 环境变量
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-xs">
                  <div className="font-semibold text-blue-900 mb-2 flex items-center space-x-1">
                    <span>💡</span>
                    <span>使用说明</span>
                  </div>
                  <div className="space-y-1.5 text-blue-800">
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>配置后将<strong>覆盖</strong>环境变量中的 API Key</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>使用 <code className="px-1 py-0.5 bg-blue-100 rounded text-xs">AES-256</code> 加密算法安全存储</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>删除配置后将<strong>回退</strong>到使用环境变量</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-600 mt-0.5">•</span>
                      <span>仅<strong>管理员</strong>可以配置 API Key</span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center gap-2">
          <div className="flex-1">
            {keyStatus?.has_api_key && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteApiKey}
                disabled={loading || loadingStatus}
                className="w-auto"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                删除配置
              </Button>
            )}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              onClick={handleSaveApiKey}
              disabled={loading || loadingStatus || !apiKey.trim()}
              className="min-w-[80px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span>保存</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

