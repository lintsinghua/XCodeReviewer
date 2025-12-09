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
  MessageSquare
} from "lucide-react";
import { CodeAnalysisEngine } from "@/features/analysis/services";
import { api } from "@/shared/config/database";
import type { CodeAnalysisResult, InstantAnalysis as InstantAnalysisType } from "@/shared/types";
import { toast } from "sonner";
import InstantExportDialog from "@/components/reports/InstantExportDialog";
import { getPromptTemplates, type PromptTemplate } from "@/shared/api/prompts";

// AI解释解析函数
function parseAIExplanation(aiExplanation: string) {
  try {
    const parsed = JSON.parse(aiExplanation);
    // 检查是否有xai字段
    if (parsed.xai) {
      return parsed.xai;
    }
    // 检查是否直接包含what, why, how字段
    if (parsed.what || parsed.why || parsed.how) {
      return parsed;
    }
    // 如果都没有，返回null表示无法解析
    return null;
  } catch (error) {
    // JSON解析失败，返回null
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
  
  // 历史记录相关状态
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<InstantAnalysisType[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  
  // 提示词模板
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState<string>("");

  const supportedLanguages = CodeAnalysisEngine.getSupportedLanguages();
  
  // 加载提示词模板
  useEffect(() => {
    const loadPromptTemplates = async () => {
      try {
        const res = await getPromptTemplates({ is_active: true });
        setPromptTemplates(res.items);
      } catch (error) {
        console.error("加载提示词模板失败:", error);
      }
    };
    loadPromptTemplates();
  }, []);

  // 加载历史记录
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

  // 查看历史记录详情
  const viewHistoryRecord = (record: InstantAnalysisType) => {
    try {
      const analysisResult = JSON.parse(record.analysis_result) as CodeAnalysisResult;
      setResult(analysisResult);
      setLanguage(record.language);
      setAnalysisTime(record.analysis_time);
      setSelectedHistoryId(record.id);
      setCurrentAnalysisId(record.id);  // 设置当前分析 ID 用于导出
      setShowHistory(false);
      toast.success('已加载历史分析结果');
    } catch (error) {
      console.error('Failed to parse history record:', error);
      toast.error('解析历史记录失败');
    }
  };

  // 格式化日期
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

  // 删除单条历史记录
  const deleteHistoryRecord = async (e: React.MouseEvent, recordId: string) => {
    e.stopPropagation(); // 阻止触发查看详情
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

  // 清空所有历史记录
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

  // 切换历史记录面板
  const toggleHistory = () => {
    if (!showHistory) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  };

  // 监听analyzing状态变化，自动滚动到加载卡片
  useEffect(() => {
    if (analyzing && loadingCardRef.current) {
      // 使用requestAnimationFrame确保DOM更新完成后再滚动
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

  // 示例代码
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
        pass

def complex_function():
    # 函数过长示例
    if True:
        if True:
            if True:
                if True:
                    if True:  # 嵌套过深
                        print("Deep nesting")`,
    java: `// 示例Java代码 - 包含多种问题
public class Example {
    private String password = "admin123"; // 硬编码密码
    
    public void processData() {
        System.out.println("Processing..."); // 使用System.out.print
        
        try {
            // 一些处理逻辑
            String data = getData();
        } catch (Exception e) {
            // 空的异常处理
        }
    }
    
    private String getData() {
        return "data";
    }
}`,
    swift: `// 示例Swift代码 - 包含多种问题
import Foundation

class UserManager {
    var password = "admin123" // 硬编码密码
    
    func validateUser(input: String) -> Bool {
        if input == password { // 直接比较密码
            print("User validated") // 使用print而非日志
            return true
        }
        return false
    }
    
    // 强制解包可能导致崩溃
    func processData(data: [String]?) {
        let items = data! // 强制解包
        for item in items {
            print(item)
        }
    }
    
    // 内存泄漏风险：循环引用
    var closure: (() -> Void)?
    func setupClosure() {
        closure = {
            print(self.password) // 未使用 [weak self]
        }
    }
}`,
    kotlin: `// 示例Kotlin代码 - 包含多种问题
class UserManager {
    private val password = "admin123" // 硬编码密码
    
    fun validateUser(input: String): Boolean {
        if (input == password) { // 直接比较密码
            println("User validated") // 使用println而非日志
            return true
        }
        return false
    }
    
    // 空指针风险
    fun processData(data: List<String>?) {
        val items = data!! // 强制非空断言
        for (item in items) {
            println(item)
        }
    }
    
    // 性能问题：循环中重复计算
    fun inefficientLoop(items: List<String>) {
        for (i in 0 until items.size) {
            for (j in 0 until items.size) { // O(n²) 复杂度
                println(items[i] + items[j])
            }
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

      // 立即滚动到页面底部（加载卡片会出现的位置）
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);

      const startTime = Date.now();

      const analysisResult = await CodeAnalysisEngine.analyzeCode(code, language, selectedPromptTemplateId || undefined);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      setResult(analysisResult);
      // 使用后端返回的 analysis_time，如果没有则使用前端计算的
      setAnalysisTime(analysisResult.analysis_time || duration);
      // 保存后端返回的 analysis_id 用于导出
      setCurrentAnalysisId(analysisResult.analysis_id || null);

      toast.success(`分析完成！发现 ${analysisResult.issues.length} 个问题`);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      // 显示详细的错误信息
      const errorMessage = error?.message || "分析失败，请稍后重试";
      toast.error(errorMessage);
    } finally {
      setAnalyzing(false);
      // 即时分析结束后清空前端内存中的代码（满足NFR-2销毁要求）
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

      // 根据文件扩展名自动选择语言
      const extension = file.name.split('.').pop()?.toLowerCase();
      const languageMap: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'java': 'java',
        'go': 'go',
        'rs': 'rust',
        'cpp': 'cpp',
        'c': 'cpp',
        'cc': 'cpp',
        'h': 'cpp',
        'hh': 'cpp',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'swift': 'swift',
        'kt': 'kotlin'
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-red-50 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  // 渲染问题的函数，使用复古样式
  const renderIssue = (issue: any, index: number) => (
    <div key={index} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 mb-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
      <div className="flex items-start justify-between mb-3 pb-3 border-b-2 border-dashed border-gray-300">
        <div className="flex items-start space-x-3">
          <div className={`w-8 h-8 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${issue.severity === 'critical' ? 'bg-red-500 text-white' :
            issue.severity === 'high' ? 'bg-orange-500 text-white' :
              issue.severity === 'medium' ? 'bg-yellow-400 text-black' :
                'bg-blue-400 text-white'
            }`}>
            {getTypeIcon(issue.type)}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-base text-black mb-1 font-mono uppercase">{issue.title}</h4>
            <div className="flex items-center space-x-1 text-xs text-gray-600 font-mono">
              <span>📍</span>
              <span>第 {issue.line} 行</span>
              {issue.column && <span>，第 {issue.column} 列</span>}
            </div>
          </div>
        </div>
        <Badge className={`rounded-none border-2 border-black ${getSeverityColor(issue.severity)} font-bold uppercase`}>
          {issue.severity === 'critical' ? '严重' :
            issue.severity === 'high' ? '高' :
              issue.severity === 'medium' ? '中等' : '低'}
        </Badge>
      </div>

      {issue.description && (
        <div className="bg-gray-50 border-2 border-black p-3 mb-3 font-mono text-xs">
          <div className="flex items-center mb-1 border-b-2 border-black pb-1 w-fit">
            <Info className="w-3 h-3 text-black mr-1" />
            <span className="font-bold text-black uppercase">问题详情</span>
          </div>
          <p className="text-gray-800 leading-relaxed mt-2">
            {issue.description}
          </p>
        </div>
      )}

      {issue.code_snippet && (
        <div className="bg-black text-green-400 p-3 mb-3 border-2 border-gray-800 font-mono text-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gray-800 text-white px-2 py-0.5 text-[10px] uppercase">Code</div>
          <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-1">
            <div className="flex items-center space-x-1">
              <Code className="w-3 h-3 text-green-500" />
              <span className="text-gray-400 font-bold uppercase">问题代码</span>
            </div>
            <span className="text-gray-500">Line {issue.line}</span>
          </div>
          <pre className="overflow-x-auto">
            <code>{issue.code_snippet}</code>
          </pre>
        </div>
      )}

      <div className="space-y-3">
        {issue.suggestion && (
          <div className="bg-blue-50 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center mb-2">
              <div className="w-5 h-5 bg-blue-600 border-2 border-black flex items-center justify-center mr-2 text-white">
                <Lightbulb className="w-3 h-3" />
              </div>
              <span className="font-bold text-blue-900 text-sm uppercase font-mono">修复建议</span>
            </div>
            <p className="text-blue-900 text-xs leading-relaxed font-mono">{issue.suggestion}</p>
          </div>
        )}

        {issue.ai_explanation && (() => {
          const parsedExplanation = parseAIExplanation(issue.ai_explanation);

          if (parsedExplanation) {
            return (
              <div className="bg-red-50 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center mb-2">
                  <div className="w-5 h-5 bg-red-600 border-2 border-black flex items-center justify-center mr-2 text-white">
                    <Zap className="w-3 h-3" />
                  </div>
                  <span className="font-bold text-red-900 text-sm uppercase font-mono">AI 解释</span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  {parsedExplanation.what && (
                    <div className="border-l-4 border-red-600 pl-2">
                      <span className="font-bold text-red-900 uppercase block mb-1">问题：</span>
                      <span className="text-gray-800">{parsedExplanation.what}</span>
                    </div>
                  )}

                  {parsedExplanation.why && (
                    <div className="border-l-4 border-gray-600 pl-2">
                      <span className="font-bold text-gray-900 uppercase block mb-1">原因：</span>
                      <span className="text-gray-800">{parsedExplanation.why}</span>
                    </div>
                  )}

                  {parsedExplanation.how && (
                    <div className="border-l-4 border-black pl-2">
                      <span className="font-bold text-black uppercase block mb-1">方案：</span>
                      <span className="text-gray-800">{parsedExplanation.how}</span>
                    </div>
                  )}

                  {parsedExplanation.learn_more && (
                    <div className="border-l-4 border-blue-400 pl-2">
                      <span className="font-bold text-blue-900 uppercase block mb-1">链接：</span>
                      <a
                        href={parsedExplanation.learn_more}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 hover:underline break-all"
                      >
                        {parsedExplanation.learn_more}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          } else {
            // 如果无法解析JSON，回退到原始显示方式
            return (
              <div className="bg-red-50 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center mb-2">
                  <Zap className="w-4 h-4 text-red-600 mr-2" />
                  <span className="font-bold text-red-900 text-sm uppercase font-mono">AI 解释</span>
                </div>
                <p className="text-gray-800 text-xs leading-relaxed font-mono">{issue.ai_explanation}</p>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 历史记录面板 */}
      {showHistory && (
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
          <div className="p-4 border-b-2 border-black bg-gray-50 flex items-center justify-between">
            <h3 className="text-lg font-display font-bold uppercase flex items-center">
              <History className="w-5 h-5 mr-2" />
              分析历史记录
            </h3>
            <div className="flex items-center gap-2">
              {historyRecords.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={clearAllHistory} 
                  size="sm" 
                  className="retro-btn bg-red-50 text-red-600 hover:bg-red-100 h-8 border-red-300"
                >
                  清空全部
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => setShowHistory(false)} 
                size="sm" 
                className="retro-btn bg-white text-black hover:bg-gray-100 h-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-none h-8 w-8 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600 font-mono">加载中...</p>
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 bg-gray-50">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-gray-600 uppercase mb-2 font-mono">暂无历史记录</h4>
                <p className="text-gray-500 font-mono text-sm">完成代码分析后，记录将显示在这里</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {historyRecords.map((record) => (
                    <div 
                      key={record.id} 
                      className={`border-2 border-black p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        selectedHistoryId === record.id ? 'bg-primary/10 border-primary' : 'bg-white'
                      }`}
                      onClick={() => viewHistoryRecord(record)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="rounded-none border-2 border-black bg-gray-100 text-black font-mono uppercase">
                            {record.language}
                          </Badge>
                          <span className="text-sm font-mono text-gray-600">
                            {formatDate(record.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={`rounded-none border-2 border-black font-mono ${
                              record.quality_score >= 80 ? 'bg-green-100 text-green-800' :
                              record.quality_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}
                          >
                            评分: {(record.quality_score ?? 0).toFixed(1)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => deleteHistoryRecord(e, record.id)}
                            className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
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

      {/* 代码输入区域 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
        <div className="p-4 border-b-2 border-black bg-gray-50 flex items-center justify-between">
          <h3 className="text-lg font-display font-bold uppercase flex items-center">
            <Code className="w-5 h-5 mr-2" />
            代码分析
          </h3>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={toggleHistory} 
              size="sm" 
              className={`retro-btn h-8 ${showHistory ? 'bg-primary text-white' : 'bg-white text-black hover:bg-gray-100'}`}
            >
              <History className="w-4 h-4 mr-2" />
              历史记录
            </Button>
            {result && (
              <Button variant="outline" onClick={clearAnalysis} size="sm" className="retro-btn bg-white text-black hover:bg-gray-100 h-8">
                <X className="w-4 h-4 mr-2" />
                重新分析
              </Button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* 工具栏 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-10 retro-input rounded-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:ring-0">
                  <SelectValue placeholder="选择编程语言" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  {supportedLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={selectedPromptTemplateId} onValueChange={setSelectedPromptTemplateId}>
                <SelectTrigger className="h-10 retro-input rounded-none border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:ring-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <SelectValue placeholder="默认提示词" />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <SelectItem value="">默认提示词</SelectItem>
                  {promptTemplates.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
              className="retro-btn bg-white text-black hover:bg-gray-100 h-10"
            >
              <Upload className="w-4 h-4 mr-2" />
              上传文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.cpp,.c,.cc,.h,.hh,.cs,.php,.rb,.swift,.kt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* 快速示例 */}
          <div className="flex flex-wrap gap-2 items-center p-2 bg-gray-50 border-2 border-dashed border-gray-300">
            <span className="text-xs font-bold uppercase text-gray-600 mr-2">示例：</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('javascript')}
              disabled={analyzing}
              className="h-7 px-2 text-xs retro-btn bg-white hover:bg-yellow-100"
            >
              JavaScript
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('python')}
              disabled={analyzing}
              className="h-7 px-2 text-xs retro-btn bg-white hover:bg-blue-100"
            >
              Python
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('java')}
              disabled={analyzing}
              className="h-7 px-2 text-xs retro-btn bg-white hover:bg-red-100"
            >
              Java
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('swift')}
              disabled={analyzing}
              className="h-7 px-2 text-xs retro-btn bg-white hover:bg-orange-100"
            >
              Swift
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('kotlin')}
              disabled={analyzing}
              className="h-7 px-2 text-xs retro-btn bg-white hover:bg-purple-100"
            >
              Kotlin
            </Button>
          </div>

          {/* 代码编辑器 */}
          <div className="relative">
            <div className="absolute top-0 right-0 bg-black text-white px-2 py-1 text-xs font-mono uppercase z-10 border-l-2 border-b-2 border-white">
              Editor
            </div>
            <Textarea
              placeholder="粘贴代码或上传文件..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-[300px] font-mono text-sm retro-input bg-gray-900 text-green-400 border-2 border-black p-4 focus:ring-0 focus:border-primary"
              disabled={analyzing}
            />
            <div className="text-xs text-gray-500 mt-1 font-mono text-right">
              {code.length} 字符，{code.split('\n').length} 行
            </div>
          </div>

          {/* 分析按钮 */}
          <Button
            onClick={handleAnalyze}
            disabled={!code.trim() || !language || analyzing}
            className="w-full retro-btn bg-primary text-white hover:bg-primary/90 h-12 text-lg font-bold uppercase"
          >
            {analyzing ? (
              <>
                <div className="animate-spin rounded-none h-5 w-5 border-4 border-white border-t-transparent mr-3"></div>
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

      {/* 分析结果区域 */}
      {result && (
        <div className="flex flex-col gap-6">
          {/* 结果概览 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50 flex items-center justify-between">
              <h3 className="text-lg font-display font-bold uppercase flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                分析结果
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-none border-black bg-white text-xs font-mono">
                  <Clock className="w-3 h-3 mr-1" />
                  {(analysisTime ?? 0).toFixed(2)}s
                </Badge>
                <Badge variant="outline" className="rounded-none border-black bg-white text-xs font-mono uppercase">
                  {language}
                </Badge>

                {/* 导出按钮 */}
                <Button
                  size="sm"
                  onClick={() => setExportDialogOpen(true)}
                  className="retro-btn bg-primary text-white hover:bg-primary/90 h-8"
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出报告
                </Button>
              </div>
            </div>
            <div className="p-6">
              {/* 核心指标 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 font-mono">
                <div className="text-center p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="w-12 h-12 bg-primary border-2 border-black flex items-center justify-center mx-auto mb-3 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <Target className="w-6 h-6" />
                  </div>
                  <div className="text-3xl font-bold text-primary mb-1">
                    {(result.quality_score ?? 0).toFixed(1)}
                  </div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">质量评分</p>
                  <Progress value={result.quality_score ?? 0} className="h-2 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-primary" />
                </div>

                <div className="text-center p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="w-12 h-12 bg-red-600 border-2 border-black flex items-center justify-center mx-auto mb-3 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="text-3xl font-bold text-red-600 mb-1">
                    {(result.summary?.critical_issues ?? 0) + (result.summary?.high_issues ?? 0)}
                  </div>
                  <p className="text-xs font-bold text-red-700 uppercase mb-1">严重问题</p>
                  <div className="text-xs text-red-600 font-bold uppercase">需要立即处理</div>
                </div>

                <div className="text-center p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="w-12 h-12 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-3 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <Info className="w-6 h-6" />
                  </div>
                  <div className="text-3xl font-bold text-yellow-600 mb-1">
                    {(result.summary?.medium_issues ?? 0) + (result.summary?.low_issues ?? 0)}
                  </div>
                  <p className="text-xs font-bold text-yellow-700 uppercase mb-1">一般问题</p>
                  <div className="text-xs text-yellow-600 font-bold uppercase">建议优化</div>
                </div>

                <div className="text-center p-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="w-12 h-12 bg-green-600 border-2 border-black flex items-center justify-center mx-auto mb-3 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {result.issues.length}
                  </div>
                  <p className="text-xs font-bold text-green-700 uppercase mb-1">总问题数</p>
                  <div className="text-xs text-green-600 font-bold uppercase">已全部识别</div>
                </div>
              </div>

              {/* 详细指标 */}
              <div className="bg-gray-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-sm font-bold text-black uppercase mb-4 flex items-center font-mono border-b-2 border-black pb-2 w-fit">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  详细指标
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
                  <div className="text-center">
                    <div className="text-xl font-bold text-black mb-1">{result.metrics?.complexity ?? 0}</div>
                    <p className="text-xs text-gray-600 uppercase mb-2">复杂度</p>
                    <Progress value={result.metrics?.complexity ?? 0} className="h-2 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-black" />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-black mb-1">{result.metrics?.maintainability ?? 0}</div>
                    <p className="text-xs text-gray-600 uppercase mb-2">可维护性</p>
                    <Progress value={result.metrics?.maintainability ?? 0} className="h-2 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-black" />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-black mb-1">{result.metrics?.security ?? 0}</div>
                    <p className="text-xs text-gray-600 uppercase mb-2">安全性</p>
                    <Progress value={result.metrics?.security ?? 0} className="h-2 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-black" />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-black mb-1">{result.metrics?.performance ?? 0}</div>
                    <p className="text-xs text-gray-600 uppercase mb-2">性能</p>
                    <Progress value={result.metrics?.performance ?? 0} className="h-2 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-black" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 问题详情 */}
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase flex items-center">
                <Shield className="w-5 h-5 mr-2 text-orange-600" />
                发现的问题 ({result.issues.length})
              </h3>
            </div>
            <div className="p-6">
              {result.issues.length > 0 ? (
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-6 bg-transparent border-2 border-black p-0 h-auto gap-0">
                    <TabsTrigger value="all" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
                      全部 ({result.issues.length})
                    </TabsTrigger>
                    <TabsTrigger value="critical" className="rounded-none border-r-2 border-black data-[state=active]:bg-red-600 data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
                      严重 ({result.issues.filter(i => i.severity === 'critical').length})
                    </TabsTrigger>
                    <TabsTrigger value="high" className="rounded-none border-r-2 border-black data-[state=active]:bg-orange-500 data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
                      高 ({result.issues.filter(i => i.severity === 'high').length})
                    </TabsTrigger>
                    <TabsTrigger value="medium" className="rounded-none data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-mono font-bold uppercase h-10 text-xs">
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
                        <div className="text-center py-12 border-2 border-dashed border-black bg-gray-50">
                          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                          <h3 className="text-lg font-bold text-black uppercase mb-2 font-mono">
                            没有发现{severity === 'critical' ? '严重' : severity === 'high' ? '高优先级' : '中等优先级'}问题
                          </h3>
                          <p className="text-gray-500 font-mono">
                            代码在此级别的检查中表现良好
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="text-center py-16 border-2 border-dashed border-black bg-green-50">
                  <div className="w-20 h-20 bg-green-100 border-2 border-black flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-green-800 mb-3 uppercase">代码质量优秀！</h3>
                  <p className="text-green-700 text-lg mb-6 font-mono font-bold">恭喜！没有发现任何问题</p>
                  <div className="bg-white border-2 border-black p-6 max-w-md mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <p className="text-black text-sm font-mono">
                      您的代码通过了所有质量检查，包括安全性、性能、可维护性等各个方面的评估。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 分析进行中状态 */}
      {analyzing && (
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
          <div className="py-16 px-6">
            <div ref={loadingCardRef} className="text-center">
              <div className="w-20 h-20 bg-red-50 border-2 border-black flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="animate-spin rounded-none h-12 w-12 border-4 border-primary border-t-transparent"></div>
              </div>
              <h3 className="text-2xl font-display font-bold text-black uppercase mb-3">AI正在分析您的代码</h3>
              <p className="text-gray-600 text-lg mb-6 font-mono">请稍候，这通常需要至少30秒钟...</p>
              <p className="text-gray-600 text-sm mb-6 font-mono">分析时长取决于您的网络环境、代码长度以及使用的模型等因素</p>
              <div className="bg-red-50 border-2 border-black p-6 max-w-md mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-red-700 text-sm font-mono font-bold">
                  正在进行安全检测、性能分析、代码风格检查等多维度评估<br />
                  请勿离开页面！
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导出报告对话框 */}
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