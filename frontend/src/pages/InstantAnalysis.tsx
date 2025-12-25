/**
 * Instant Analysis Page
 * Cyberpunk Terminal Aesthetic
 */

import { useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Code,
  FileText,
  Info,
  Lightbulb,
  Shield,
  Target,
  TrendingUp,
  Upload,
  Zap,
  X,
  Download,
  History,
  ChevronRight,
  MessageSquare,
  Terminal
} from "lucide-react";
import { CodeAnalysisEngine } from "@/features/analysis/services";
import { api } from "@/shared/config/database";
import type { CodeAnalysisResult, InstantAnalysis as InstantAnalysisType } from "@/shared/types";
import { toast } from "sonner";
import InstantExportDialog from "@/components/reports/InstantExportDialog";
import { getPromptTemplates, type PromptTemplate } from "@/shared/api/prompts";

// AI explanation parser
function parseAIExplanation(aiExplanation: string) {
  try {
    const parsed = JSON.parse(aiExplanation);
    if (parsed.xai) return parsed.xai;
    if (parsed.what || parsed.why || parsed.how) return parsed;
    return null;
  } catch (error) {
    return null;
  }
}

export default function InstantAnalysis() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CodeAnalysisResult | null>(null);
  const [analysisTime, setAnalysisTime] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingCardRef = useRef<HTMLDivElement>(null);

  // History related state
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<InstantAnalysisType[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // Prompt templates
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState<string>("");

  const supportedLanguages = CodeAnalysisEngine.getSupportedLanguages();

  // Load prompt templates
  useEffect(() => {
    const loadPromptTemplates = async () => {
      try {
        const res = await getPromptTemplates({ is_active: true });
        setPromptTemplates(res.items);
        const defaultTemplate = res.items.find(t => t.is_default);
        if (defaultTemplate) {
          setSelectedPromptTemplateId(defaultTemplate.id);
        } else if (res.items.length > 0) {
          setSelectedPromptTemplateId(res.items[0].id);
        }
      } catch (error) {
        console.error("加载提示词模板失败:", error);
      }
    };
    loadPromptTemplates();
  }, []);

  // Load history
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await api.getInstantAnalyses();
      setHistoryRecords(records);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast.error('加载历史记录失败');
    } finally {
      setLoadingHistory(false);
    }
  };

  // View history record details
  const viewHistoryRecord = (record: InstantAnalysisType) => {
    try {
      const analysisResult = JSON.parse(record.analysis_result) as CodeAnalysisResult;
      setResult(analysisResult);
      setLanguage(record.language);
      setAnalysisTime(record.analysis_time);
      setSelectedHistoryId(record.id);
      setCurrentAnalysisId(record.id);
      setShowHistory(false);
      toast.success('已加载历史分析结果');
    } catch (error) {
      console.error('Failed to parse history record:', error);
      toast.error('解析历史记录失败');
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Delete single history record
  const deleteHistoryRecord = async (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation();
    try {
      await api.deleteInstantAnalysis(recordId);
      setHistoryRecords(prev => prev.filter(r => r.id !== recordId));
      if (selectedHistoryId === recordId) {
        setSelectedHistoryId(null);
        setResult(null);
      }
      toast.success('删除成功');
    } catch (error) {
      console.error('Failed to delete history:', error);
      toast.error('删除失败');
    }
  };

  // Clear all history
  const clearAllHistory = async () => {
    if (!confirm('确定要清空所有历史记录吗？此操作不可恢复。')) return;
    try {
      await api.deleteAllInstantAnalyses();
      setHistoryRecords([]);
      setSelectedHistoryId(null);
      toast.success('已清空所有历史记录');
    } catch (error) {
      console.error('Failed to clear history:', error);
      toast.error('清空失败');
    }
  };

  // Toggle history panel
  const toggleHistory = () => {
    if (!showHistory) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  };

  // Auto scroll to loading card when analyzing
  useEffect(() => {
    if (analyzing && loadingCardRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (loadingCardRef.current) {
            loadingCardRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
          }
        }, 50);
      });
    }
  }, [analyzing]);

  // Example codes
  const exampleCodes = {
    javascript: `// 示例JavaScript代码 - 包含多种问题
var userName = "admin";
var password = "123456"; // 硬编码密码

function validateUser(input) {
    if (input == userName) { // 使用 == 比较
        console.log("User validated"); // 生产代码中的console.log
        return true;
    }
    return false;
}

// 性能问题：循环中重复计算长度
function processItems(items) {
    for (var i = 0; i < items.length; i++) {
        for (var j = 0; j < items.length; j++) {
            console.log(items[i] + items[j]);
        }
    }
}

// 安全问题：使用eval
function executeCode(userInput) {
    eval(userInput); // 危险的eval使用
}`,
    python: `# 示例Python代码 - 包含多种问题
import *  # 通配符导入

password = "secret123"  # 硬编码密码

def process_data(data):
    try:
        result = []
        for item in data:
            print(item)  # 使用print而非logging
            result.append(item * 2)
        return result
    except:  # 裸露的except语句
        pass`,
    java: `// 示例Java代码 - 包含多种问题
public class Example {
    private String password = "admin123"; // 硬编码密码

    public void processData() {
        System.out.println("Processing..."); // 使用System.out.print

        try {
            String data = getData();
        } catch (Exception e) {
            // 空的异常处理
        }
    }
}`
  };

  const handleAnalyze = async () => {
    if (!code.trim()) {
      toast.error("请输入要分析的代码");
      return;
    }
    if (!language) {
      toast.error("请选择编程语言");
      return;
    }

    try {
      setAnalyzing(true);
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);

      const startTime = Date.now();
      const analysisResult = await CodeAnalysisEngine.analyzeCode(code, language, selectedPromptTemplateId || undefined);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      setResult(analysisResult);
      setAnalysisTime(analysisResult.analysis_time || duration);
      setCurrentAnalysisId(analysisResult.analysis_id || null);

      toast.success(`分析完成！发现 ${analysisResult.issues.length} 个问题`);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast.error(error?.message || "分析失败，请稍后重试");
    } finally {
      setAnalyzing(false);
      setCode("");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCode(content);

      const extension = file.name.split('.').pop()?.toLowerCase();
      const languageMap: Record<string, string> = {
        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
        'py': 'python', 'java': 'java', 'go': 'go', 'rs': 'rust',
        'cpp': 'cpp', 'c': 'cpp', 'cs': 'csharp', 'php': 'php',
        'rb': 'ruby', 'swift': 'swift', 'kt': 'kotlin'
      };

      if (extension && languageMap[extension]) {
        setLanguage(languageMap[extension]);
      }
    };
    reader.readAsText(file);
  };

  const loadExampleCode = (lang: string) => {
    const example = exampleCodes[lang as keyof typeof exampleCodes];
    if (example) {
      setCode(example);
      setLanguage(lang);
      toast.success(`已加载${lang}示例代码`);
    }
  };

  const getSeverityClasses = (severity: string) => {
    switch (severity) {
      case 'critical': return 'severity-critical';
      case 'high': return 'severity-high';
      case 'medium': return 'severity-medium';
      case 'low': return 'severity-low';
      default: return 'severity-info';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'security': return <Shield className="w-4 h-4" />;
      case 'bug': return <AlertTriangle className="w-4 h-4" />;
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'style': return <Code className="w-4 h-4" />;
      case 'maintainability': return <FileText className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const clearAnalysis = () => {
    setCode("");
    setLanguage("");
    setResult(null);
    setAnalysisTime(0);
  };

  // Render issue with cyberpunk style
  const renderIssue = (issue: any, index: number) => (
    <div key={index} className="cyber-card p-4 mb-4 hover:border-border transition-all group">
      <div className="flex items-start justify-between mb-3 pb-3 border-b border-border">
        <div className="flex items-start space-x-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            issue.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' :
            issue.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
            issue.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-sky-500/20 text-sky-400'
          }`}>
            {getTypeIcon(issue.type)}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-base text-foreground mb-1 group-hover:text-primary transition-colors uppercase">{issue.title}</h4>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground font-mono">
              <span className="text-primary">&gt;</span>
              <span>LINE: {issue.line}</span>
              {issue.column && <span>, COL: {issue.column}</span>}
            </div>
          </div>
        </div>
        <Badge className={`${getSeverityClasses(issue.severity)} font-bold uppercase px-2 py-1 rounded text-xs`}>
          {issue.severity === 'critical' ? '严重' :
            issue.severity === 'high' ? '高' :
            issue.severity === 'medium' ? '中等' : '低'}
        </Badge>
      </div>

      {issue.description && (
        <div className="bg-muted border border-border p-3 mb-3 rounded font-mono">
          <div className="flex items-center mb-1 border-b border-border pb-1">
            <Info className="w-3 h-3 text-muted-foreground mr-1" />
            <span className="font-bold text-muted-foreground text-xs uppercase">问题详情</span>
          </div>
          <p className="text-foreground text-xs leading-relaxed mt-1">{issue.description}</p>
        </div>
      )}

      {issue.code_snippet && (
        <div className="cyber-bg-elevated p-3 mb-3 border border-border rounded">
          <div className="flex items-center justify-between mb-2 border-b border-border pb-1">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-primary rounded flex items-center justify-center">
                <Code className="w-2 h-2 text-foreground" />
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono uppercase">CODE_SNIPPET</span>
            </div>
            <span className="text-muted-foreground text-xs font-mono">LINE: {issue.line}</span>
          </div>
          <div className="bg-slate-100 dark:bg-black/40 p-2 border border-border rounded">
            <pre className="text-xs text-emerald-700 dark:text-emerald-400 font-mono overflow-x-auto">
              <code>{issue.code_snippet}</code>
            </pre>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {issue.suggestion && (
          <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded">
            <div className="flex items-center mb-2 border-b border-sky-500/20 pb-1">
              <div className="w-5 h-5 bg-sky-500/20 border border-sky-500/40 rounded flex items-center justify-center mr-2">
                <Lightbulb className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="font-bold text-sky-700 dark:text-sky-300 text-sm uppercase">修复建议</span>
            </div>
            <p className="text-sky-800 dark:text-sky-200/80 text-xs leading-relaxed font-mono">{issue.suggestion}</p>
          </div>
        )}

        {issue.ai_explanation && (() => {
          const parsedExplanation = parseAIExplanation(issue.ai_explanation);

          if (parsedExplanation) {
            return (
              <div className="bg-violet-500/10 border border-violet-500/30 p-3 rounded">
                <div className="flex items-center mb-2 border-b border-violet-500/20 pb-1">
                  <div className="w-5 h-5 bg-violet-500/20 border border-violet-500/40 rounded flex items-center justify-center mr-2">
                    <Zap className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="font-bold text-violet-700 dark:text-violet-300 text-sm uppercase">AI 解释</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {parsedExplanation.what && (
                    <div className="border-l-2 border-rose-500 pl-2">
                      <span className="font-bold text-rose-600 dark:text-rose-400 uppercase">问题：</span>
                      <span className="text-foreground ml-1">{parsedExplanation.what}</span>
                    </div>
                  )}
                  {parsedExplanation.why && (
                    <div className="border-l-2 border-amber-500 pl-2">
                      <span className="font-bold text-amber-600 dark:text-amber-400 uppercase">原因：</span>
                      <span className="text-foreground ml-1">{parsedExplanation.why}</span>
                    </div>
                  )}
                  {parsedExplanation.how && (
                    <div className="border-l-2 border-emerald-500 pl-2">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase">方案：</span>
                      <span className="text-foreground ml-1">{parsedExplanation.how}</span>
                    </div>
                  )}
                  {parsedExplanation.learn_more && (
                    <div className="border-l-2 border-sky-500 pl-2">
                      <span className="font-bold text-sky-600 dark:text-sky-400 uppercase">链接：</span>
                      <a
                        href={parsedExplanation.learn_more}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300 hover:underline ml-1 font-bold"
                      >
                        {parsedExplanation.learn_more}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            return (
              <div className="bg-violet-500/10 border border-violet-500/30 p-3 rounded">
                <div className="flex items-center mb-2 border-b border-violet-500/20 pb-1">
                  <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400 mr-2" />
                  <span className="font-bold text-violet-700 dark:text-violet-300 text-sm uppercase">AI 解释</span>
                </div>
                <p className="text-foreground text-xs leading-relaxed font-mono">{issue.ai_explanation}</p>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 p-6 cyber-bg-elevated min-h-screen font-mono relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* History Panel */}
      {showHistory && (
        <div className="cyber-card p-0 relative z-10">
          <div className="cyber-card-header">
            <History className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">分析历史记录</h3>
            <div className="ml-auto flex items-center gap-2">
              {historyRecords.length > 0 && (
                <Button
                  variant="outline"
                  onClick={clearAllHistory}
                  size="sm"
                  className="cyber-btn bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 h-8"
                >
                  清空全部
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowHistory(false)}
                size="sm"
                className="cyber-btn-ghost h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="loading-spinner mx-auto mb-4"></div>
                <p className="text-muted-foreground font-mono">加载中...</p>
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="empty-state">
                <History className="empty-state-icon" />
                <p className="empty-state-title">暂无历史记录</p>
                <p className="empty-state-description">完成代码分析后，记录将显示在这里</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {historyRecords.map((record) => (
                    <div
                      key={record.id}
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        selectedHistoryId === record.id
                          ? 'bg-primary/10 border-primary/30'
                          : 'bg-muted/50 border-border hover:bg-muted hover:border-border'
                      }`}
                      onClick={() => viewHistoryRecord(record)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="cyber-badge-muted">{record.language}</Badge>
                          <span className="text-sm font-mono text-muted-foreground">{formatDate(record.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`font-mono ${
                            record.quality_score >= 80 ? 'cyber-badge-success' :
                            record.quality_score >= 60 ? 'cyber-badge-warning' :
                            'cyber-badge-danger'
                          }`}>
                            评分: {(record.quality_score ?? 0).toFixed(1)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => deleteHistoryRecord(e, record.id)}
                            className="h-6 w-6 p-0 hover:bg-rose-500/10 hover:text-rose-400"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {record.issues_count} 个问题
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(record.analysis_time ?? 0).toFixed(2)}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      {/* Code Input Area */}
      <div className="cyber-card p-0 relative z-10">
        <div className="cyber-card-header">
          <Terminal className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">代码分析</h3>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              onClick={toggleHistory}
              size="sm"
              className={`h-8 ${showHistory ? 'cyber-btn-primary' : 'cyber-btn-outline'}`}
            >
              <History className="w-4 h-4 mr-2" />
              历史记录
            </Button>
            {result && (
              <Button variant="outline" onClick={clearAnalysis} size="sm" className="cyber-btn-outline h-8">
                <X className="w-4 h-4 mr-2" />
                重新分析
              </Button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">编程语言</label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="cyber-input h-10">
                  <SelectValue placeholder="选择编程语言" />
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  {supportedLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">提示词模板</label>
              <Select value={selectedPromptTemplateId} onValueChange={setSelectedPromptTemplateId}>
                <SelectTrigger className="cyber-input h-10">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-violet-400" />
                    <SelectValue placeholder="选择提示词模板" />
                  </div>
                </SelectTrigger>
                <SelectContent className="cyber-dialog border-border">
                  {promptTemplates.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name} {pt.is_default && '(默认)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
                className="cyber-btn-outline h-10"
              >
                <Upload className="w-4 h-4 mr-2" />
                上传文件
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.cpp,.c,.cc,.h,.hh,.cs,.php,.rb,.swift,.kt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Quick Examples */}
          <div className="flex flex-wrap gap-2 items-center p-3 bg-muted border border-border rounded">
            <span className="text-xs font-bold uppercase text-muted-foreground mr-2">示例：</span>
            {['javascript', 'python', 'java'].map((lang) => (
              <Button
                key={lang}
                variant="outline"
                size="sm"
                onClick={() => loadExampleCode(lang)}
                disabled={analyzing}
                className="h-7 px-2 text-xs cyber-btn-ghost"
              >
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </Button>
            ))}
          </div>

          {/* Code Editor */}
          <div className="relative">
            <div className="absolute top-0 right-0 bg-muted text-muted-foreground px-2 py-1 text-xs font-mono uppercase z-10 rounded-bl border-l border-b border-border">
              Editor
            </div>
            <Textarea
              placeholder="// 粘贴代码或上传文件..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-[300px] font-mono text-sm cyber-bg-elevated text-emerald-400 border border-border p-4 focus:ring-0 focus:border-primary/50 placeholder:text-muted-foreground"
              disabled={analyzing}
            />
            <div className="text-xs text-muted-foreground mt-1 font-mono text-right">
              {code.length} 字符，{code.split('\n').length} 行
            </div>
          </div>

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!code.trim() || !language || analyzing}
            className="w-full cyber-btn-primary h-12 text-lg font-bold uppercase"
          >
            {analyzing ? (
              <>
                <div className="loading-spinner w-5 h-5 mr-3"></div>
                分析中...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                开始分析
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Analysis Results */}
      {result && (
        <div className="space-y-6 relative z-10">
          {/* Results Overview */}
          <div className="cyber-card p-0">
            <div className="cyber-card-header">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">分析结果</h3>
              <div className="ml-auto flex items-center gap-2">
                <Badge className="cyber-badge-muted">
                  <Clock className="w-3 h-3 mr-1" />
                  {(analysisTime ?? 0).toFixed(2)}s
                </Badge>
                <Badge className="cyber-badge-muted uppercase">{language}</Badge>
                <Button
                  size="sm"
                  onClick={() => setExportDialogOpen(true)}
                  className="cyber-btn-primary h-8"
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出报告
                </Button>
              </div>
            </div>
            <div className="p-6">
              {/* Core Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="cyber-card p-4 text-center">
                  <div className="stat-icon mx-auto mb-3 text-primary">
                    <Target className="w-6 h-6" />
                  </div>
                  <div className="stat-value text-primary mb-1">
                    {(result.quality_score ?? 0).toFixed(1)}
                  </div>
                  <p className="stat-label mb-2">质量评分</p>
                  <Progress value={result.quality_score ?? 0} className="h-2 bg-muted [&>div]:bg-primary" />
                </div>

                <div className="cyber-card p-4 text-center">
                  <div className="stat-icon mx-auto mb-3 text-rose-400">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="stat-value text-rose-400 mb-1">
                    {(result.summary?.critical_issues ?? 0) + (result.summary?.high_issues ?? 0)}
                  </div>
                  <p className="stat-label mb-1">严重问题</p>
                  <div className="text-xs text-rose-400 uppercase">需要立即处理</div>
                </div>

                <div className="cyber-card p-4 text-center">
                  <div className="stat-icon mx-auto mb-3 text-amber-400">
                    <Info className="w-6 h-6" />
                  </div>
                  <div className="stat-value text-amber-400 mb-1">
                    {(result.summary?.medium_issues ?? 0) + (result.summary?.low_issues ?? 0)}
                  </div>
                  <p className="stat-label mb-1">一般问题</p>
                  <div className="text-xs text-amber-400 uppercase">建议优化</div>
                </div>

                <div className="cyber-card p-4 text-center">
                  <div className="stat-icon mx-auto mb-3 text-emerald-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="stat-value text-emerald-400 mb-1">
                    {result.issues.length}
                  </div>
                  <p className="stat-label mb-1">总问题数</p>
                  <div className="text-xs text-emerald-400 uppercase">已全部识别</div>
                </div>
              </div>

              {/* Detailed Metrics */}
              <div className="bg-muted border border-border p-4 rounded-lg">
                <h3 className="section-title text-sm mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  详细指标
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
                  {[
                    { label: '复杂度', value: result.metrics?.complexity ?? 0 },
                    { label: '可维护性', value: result.metrics?.maintainability ?? 0 },
                    { label: '安全性', value: result.metrics?.security ?? 0 },
                    { label: '性能', value: result.metrics?.performance ?? 0 },
                  ].map((metric) => (
                    <div key={metric.label} className="text-center">
                      <div className="text-xl font-bold text-foreground mb-1">{metric.value}</div>
                      <p className="text-xs text-muted-foreground uppercase mb-2">{metric.label}</p>
                      <Progress value={metric.value} className="h-2 bg-muted [&>div]:bg-primary" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Issues Detail */}
          <div className="cyber-card p-0">
            <div className="cyber-card-header">
              <Shield className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">发现的问题 ({result.issues.length})</h3>
            </div>
            <div className="p-6">
              {result.issues.length > 0 ? (
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-muted border border-border p-1 h-auto gap-1 rounded mb-6">
                    <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-foreground font-mono font-bold uppercase py-2 text-muted-foreground transition-all rounded-sm text-xs">
                      全部 ({result.issues.length})
                    </TabsTrigger>
                    <TabsTrigger value="critical" className="data-[state=active]:bg-rose-500 data-[state=active]:text-foreground font-mono font-bold uppercase py-2 text-muted-foreground transition-all rounded-sm text-xs">
                      严重 ({result.issues.filter(i => i.severity === 'critical').length})
                    </TabsTrigger>
                    <TabsTrigger value="high" className="data-[state=active]:bg-orange-500 data-[state=active]:text-foreground font-mono font-bold uppercase py-2 text-muted-foreground transition-all rounded-sm text-xs">
                      高 ({result.issues.filter(i => i.severity === 'high').length})
                    </TabsTrigger>
                    <TabsTrigger value="medium" className="data-[state=active]:bg-amber-500 data-[state=active]:text-background font-mono font-bold uppercase py-2 text-muted-foreground transition-all rounded-sm text-xs">
                      中等 ({result.issues.filter(i => i.severity === 'medium').length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="space-y-4 mt-0">
                    {result.issues.map((issue, index) => renderIssue(issue, index))}
                  </TabsContent>

                  {['critical', 'high', 'medium'].map(severity => (
                    <TabsContent key={severity} value={severity} className="space-y-4 mt-0">
                      {result.issues.filter(issue => issue.severity === severity).length > 0 ? (
                        result.issues.filter(issue => issue.severity === severity).map((issue, index) => renderIssue(issue, index))
                      ) : (
                        <div className="cyber-card p-12 text-center border-dashed">
                          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                          <h3 className="text-lg font-bold text-foreground uppercase mb-2">
                            没有发现{severity === 'critical' ? '严重' : severity === 'high' ? '高优先级' : '中等优先级'}问题
                          </h3>
                          <p className="text-muted-foreground font-mono">代码在此级别的检查中表现良好</p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="cyber-card p-16 text-center border-dashed">
                  <CheckCircle className="w-16 h-16 text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mb-2 uppercase">代码质量优秀！</h3>
                  <p className="text-emerald-600 dark:text-emerald-400/80 mb-4 font-mono">恭喜！没有发现任何问题</p>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 max-w-md mx-auto rounded">
                    <p className="text-emerald-700 dark:text-emerald-300/80 text-sm font-mono">
                      您的代码通过了所有质量检查，包括安全性、性能、可维护性等各个方面的评估。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analyzing State */}
      {analyzing && (
        <div className="cyber-card p-0 relative z-10">
          <div ref={loadingCardRef} className="py-16 px-6 text-center">
            <div className="w-20 h-20 bg-primary/20 border border-primary/40 rounded-lg flex items-center justify-center mx-auto mb-6">
              <div className="loading-spinner w-12 h-12"></div>
            </div>
            <h3 className="text-2xl font-bold text-foreground uppercase mb-3">AI正在分析您的代码</h3>
            <p className="text-muted-foreground mb-6 font-mono">请稍候，这通常需要至少30秒钟...</p>
            <p className="text-muted-foreground text-sm mb-6 font-mono">分析时长取决于您的网络环境、代码长度以及使用的模型等因素</p>
            <div className="bg-primary/10 border border-primary/30 p-4 max-w-md mx-auto rounded">
              <p className="text-primary text-sm font-mono">
                正在进行安全检测、性能分析、代码风格检查等多维度评估<br />
                请勿离开页面！
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export Report Dialog */}
      {result && (
        <InstantExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          analysisId={currentAnalysisId}
          analysisResult={result}
          language={language}
          analysisTime={analysisTime}
        />
      )}
    </div>
  );
}
