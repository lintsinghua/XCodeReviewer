import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Code, 
  FileText, 
  Info, 
  Lightbulb, 
  Play, 
  Shield, 
  Upload,
  Zap,
  X,
  Sparkles
} from "lucide-react";
import { CodeAnalysisEngine } from "@/services/codeAnalysis";
import { api } from "@/db/supabase";
import type { CodeAnalysisResult } from "@/types/types";
import { toast } from "sonner";

export default function InstantAnalysis() {
  const user = null as any;
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<CodeAnalysisResult | null>(null);
  const [analysisTime, setAnalysisTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedLanguages = CodeAnalysisEngine.getSupportedLanguages();

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
      const startTime = Date.now();
      
      const analysisResult = await CodeAnalysisEngine.analyzeCode(code, language);
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      setResult(analysisResult);
      setAnalysisTime(duration);

      // 保存分析记录（可选，未登录时跳过）
      if (user) {
        await api.createInstantAnalysis({
          user_id: user.id,
          language,
          // 不存储代码内容，仅存储摘要
          code_content: '',
          analysis_result: JSON.stringify(analysisResult),
          issues_count: analysisResult.issues.length,
          quality_score: analysisResult.quality_score,
          analysis_time: duration
        });
      }

      toast.success(`分析完成！发现 ${analysisResult.issues.length} 个问题`);
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error("分析失败，请稍后重试");
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
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby'
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
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
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

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">即时代码分析</h1>
          <p className="text-gray-600 mt-2">
            快速分析代码片段，发现潜在问题并获得AI建议
          </p>
        </div>
        {result && (
          <Button variant="outline" onClick={clearAnalysis}>
            <X className="w-4 h-4 mr-2" />
            清空分析
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：代码输入 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Code className="w-5 h-5 mr-2" />
                代码输入
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 语言选择和文件上传 */}
              <div className="flex space-x-3">
                <div className="flex-1">
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择编程语言" />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedLanguages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang.charAt(0).toUpperCase() + lang.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  上传文件
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.cpp,.c,.cs,.php,.rb"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* 示例代码按钮 */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-muted-foreground">快速开始：</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExampleCode('javascript')}
                  disabled={analyzing}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  JavaScript示例
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExampleCode('python')}
                  disabled={analyzing}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Python示例
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExampleCode('java')}
                  disabled={analyzing}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  Java示例
                </Button>
              </div>

              {/* 代码编辑器 */}
              <div className="space-y-2">
                <Textarea
                  placeholder="在此粘贴您的代码，或点击上方按钮加载示例代码..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  disabled={analyzing}
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{code.length} 字符，{code.split('\n').length} 行</span>
                  <span>支持拖拽文件上传</span>
                </div>
              </div>

              {/* 分析按钮 */}
              <Button 
                onClick={handleAnalyze} 
                disabled={!code.trim() || !language || analyzing}
                className="w-full"
                size="lg"
              >
                {analyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    分析中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    开始分析
                  </>
                )}
              </Button>

              {/* 分析提示 */}
              {!result && (
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    支持多种编程语言的代码质量分析，包括安全漏洞检测、性能优化建议、代码风格检查等。
                    点击上方示例按钮快速体验分析功能。
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：分析结果 */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* 分析概览 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                      分析结果
                    </span>
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {analysisTime.toFixed(2)}s
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 质量评分 */}
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-2">
                      {result.quality_score.toFixed(1)}
                    </div>
                    <Progress value={result.quality_score} className="mb-2" />
                    <p className="text-sm text-muted-foreground">代码质量评分</p>
                  </div>

                  {/* 问题统计 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {result.summary.critical_issues + result.summary.high_issues}
                      </div>
                      <p className="text-sm text-red-600">严重问题</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {result.summary.medium_issues + result.summary.low_issues}
                      </div>
                      <p className="text-sm text-yellow-600">一般问题</p>
                    </div>
                  </div>

                  {/* 指标详情 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">复杂度</span>
                      <span className="text-sm font-medium">{result.metrics.complexity}/100</span>
                    </div>
                    <Progress value={result.metrics.complexity} />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">可维护性</span>
                      <span className="text-sm font-medium">{result.metrics.maintainability}/100</span>
                    </div>
                    <Progress value={result.metrics.maintainability} />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">安全性</span>
                      <span className="text-sm font-medium">{result.metrics.security}/100</span>
                    </div>
                    <Progress value={result.metrics.security} />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">性能</span>
                      <span className="text-sm font-medium">{result.metrics.performance}/100</span>
                    </div>
                    <Progress value={result.metrics.performance} />
                  </div>
                </CardContent>
              </Card>

              {/* 问题详情 */}
              <Card>
                <CardHeader>
                  <CardTitle>发现的问题 ({result.issues.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.issues.length > 0 ? (
                    <Tabs defaultValue="all" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="all">全部</TabsTrigger>
                        <TabsTrigger value="critical">严重</TabsTrigger>
                        <TabsTrigger value="high">高</TabsTrigger>
                        <TabsTrigger value="medium">中等</TabsTrigger>
                      </TabsList>

                      <TabsContent value="all" className="space-y-3 mt-4">
                        {result.issues.map((issue, index) => (
                          <div key={index} className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                {getTypeIcon(issue.type)}
                                <h4 className="font-medium">{issue.title}</h4>
                              </div>
                              <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              {issue.description}
                            </p>
                            
                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-sm font-medium mb-1">第 {issue.line} 行：</p>
                              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                {issue.code_snippet}
                              </pre>
                            </div>
                            
                            <div className="bg-blue-50 rounded p-3">
                              <p className="text-sm font-medium text-blue-800 mb-1">
                                <Lightbulb className="w-4 h-4 inline mr-1" />
                                修复建议：
                              </p>
                              <p className="text-sm text-blue-700">{issue.suggestion}</p>
                            </div>
                            
                            <div className="bg-green-50 rounded p-3 space-y-1">
                              <p className="text-sm font-medium text-green-800">AI 解释</p>
                              <p className="text-sm text-green-700">{issue.ai_explanation}</p>
                              {issue.xai && (
                                <div className="mt-2 space-y-1 text-sm">
                                  <p><span className="font-medium">What：</span>{issue.xai.what}</p>
                                  <p><span className="font-medium">Why：</span>{issue.xai.why}</p>
                                  <p><span className="font-medium">How：</span>{issue.xai.how}</p>
                                  {issue.xai.learn_more && (
                                    <p>
                                      <span className="font-medium">Learn More：</span>
                                      <a href={issue.xai.learn_more} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                                        文档链接
                                      </a>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="critical" className="space-y-3 mt-4">
                        {result.issues.filter(issue => issue.severity === 'critical').map((issue, index) => (
                          <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                            <div className="flex items-center space-x-2 mb-2">
                              {getTypeIcon(issue.type)}
                              <h4 className="font-medium text-red-800">{issue.title}</h4>
                            </div>
                            <p className="text-sm text-red-700 mb-2">{issue.description}</p>
                            <p className="text-sm text-red-600">
                              <strong>建议：</strong>{issue.suggestion}
                            </p>
                          </div>
                        ))}
                        {result.issues.filter(issue => issue.severity === 'critical').length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            没有发现严重问题
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="high" className="space-y-3 mt-4">
                        {result.issues.filter(issue => issue.severity === 'high').map((issue, index) => (
                          <div key={index} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                            <div className="flex items-center space-x-2 mb-2">
                              {getTypeIcon(issue.type)}
                              <h4 className="font-medium text-orange-800">{issue.title}</h4>
                            </div>
                            <p className="text-sm text-orange-700 mb-2">{issue.description}</p>
                            <p className="text-sm text-orange-600">
                              <strong>建议：</strong>{issue.suggestion}
                            </p>
                          </div>
                        ))}
                        {result.issues.filter(issue => issue.severity === 'high').length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            没有发现高优先级问题
                          </p>
                        )}
                      </TabsContent>

                      <TabsContent value="medium" className="space-y-3 mt-4">
                        {result.issues.filter(issue => issue.severity === 'medium').map((issue, index) => (
                          <div key={index} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                            <div className="flex items-center space-x-2 mb-2">
                              {getTypeIcon(issue.type)}
                              <h4 className="font-medium text-yellow-800">{issue.title}</h4>
                            </div>
                            <p className="text-sm text-yellow-700 mb-2">{issue.description}</p>
                            <p className="text-sm text-yellow-600">
                              <strong>建议：</strong>{issue.suggestion}
                            </p>
                          </div>
                        ))}
                        {result.issues.filter(issue => issue.severity === 'medium').length === 0 && (
                          <p className="text-center text-muted-foreground py-8">
                            没有发现中等优先级问题
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-green-800 mb-2">代码质量良好！</h3>
                      <p className="text-green-600">没有发现明显的问题</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Code className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    等待代码分析
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    请在左侧输入代码并选择编程语言
                  </p>
                  <div className="flex justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadExampleCode('javascript')}
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      试试JavaScript示例
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}