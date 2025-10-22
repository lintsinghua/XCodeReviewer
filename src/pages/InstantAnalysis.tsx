import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  X
} from "lucide-react";
import { CodeAnalysisEngine } from "@/features/analysis/services";
import { api } from "@/shared/config/database";
import type { CodeAnalysisResult } from "@/shared/types";
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
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div>
        <h1 className="page-title">即时代码分析</h1>
        <p className="page-subtitle">快速分析代码片段，发现潜在问题并获得修复建议</p>
      </div>

      {/* 代码输入区域 */}
      <Card className="card-modern">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">代码分析</CardTitle>
            {result && (
              <Button variant="outline" onClick={clearAnalysis} size="sm">
                <X className="w-4 h-4 mr-2" />
                重新分析
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 工具栏 */}
          <div className="flex flex-col sm:flex-row gap-4">
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
              size="sm"
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

          {/* 快速示例 */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-600">示例：</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('javascript')}
              disabled={analyzing}
            >
              JavaScript
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('python')}
              disabled={analyzing}
            >
              Python
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadExampleCode('java')}
              disabled={analyzing}
            >
              Java
            </Button>
          </div>

          {/* 代码编辑器 */}
          <div>
            <Textarea
              placeholder="粘贴代码或上传文件..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
              disabled={analyzing}
            />
            <div className="text-xs text-gray-500 mt-2">
              {code.length} 字符，{code.split('\n').length} 行
            </div>
          </div>

          {/* 分析按钮 */}
          <Button 
            onClick={handleAnalyze} 
            disabled={!code.trim() || !language || analyzing}
            className="w-full btn-primary"
          >
            {analyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                分析中...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                开始分析
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 分析结果区域 */}
      {result && (
        <div className="space-y-4">
          {/* 结果概览 */}
          <Card className="card-modern">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-xl">
                  <CheckCircle className="w-6 h-6 mr-3 text-green-600" />
                  分析结果
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-sm">
                    <Clock className="w-4 h-4 mr-2" />
                    {analysisTime.toFixed(2)}s
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    {language.charAt(0).toUpperCase() + language.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 核心指标 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {result.quality_score.toFixed(1)}
                  </div>
                  <p className="text-sm font-medium text-blue-700 mb-3">质量评分</p>
                  <Progress value={result.quality_score} className="h-2" />
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200">
                  <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {result.summary.critical_issues + result.summary.high_issues}
                  </div>
                  <p className="text-sm font-medium text-red-700 mb-1">严重问题</p>
                  <div className="text-xs text-red-600">需要立即处理</div>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                  <div className="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-yellow-600 mb-2">
                    {result.summary.medium_issues + result.summary.low_issues}
                  </div>
                  <p className="text-sm font-medium text-yellow-700 mb-1">一般问题</p>
                  <div className="text-xs text-yellow-600">建议优化</div>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {result.issues.length}
                  </div>
                  <p className="text-sm font-medium text-green-700 mb-1">总问题数</p>
                  <div className="text-xs text-green-600">已全部识别</div>
                </div>
              </div>

              {/* 详细指标 */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  详细指标
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-2">{result.metrics.complexity}</div>
                    <p className="text-sm text-gray-600 mb-3">复杂度</p>
                    <Progress value={result.metrics.complexity} className="h-2" />
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-2">{result.metrics.maintainability}</div>
                    <p className="text-sm text-gray-600 mb-3">可维护性</p>
                    <Progress value={result.metrics.maintainability} className="h-2" />
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-2">{result.metrics.security}</div>
                    <p className="text-sm text-gray-600 mb-3">安全性</p>
                    <Progress value={result.metrics.security} className="h-2" />
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-2">{result.metrics.performance}</div>
                    <p className="text-sm text-gray-600 mb-3">性能</p>
                    <Progress value={result.metrics.performance} className="h-2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 问题详情 */}
          <Card className="card-modern">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-xl">
                <Shield className="w-6 h-6 mr-3 text-orange-600" />
                发现的问题 ({result.issues.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.issues.length > 0 ? (
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="all" className="text-sm">
                      全部 ({result.issues.length})
                    </TabsTrigger>
                    <TabsTrigger value="critical" className="text-sm">
                      严重 ({result.issues.filter(i => i.severity === 'critical').length})
                    </TabsTrigger>
                    <TabsTrigger value="high" className="text-sm">
                      高 ({result.issues.filter(i => i.severity === 'high').length})
                    </TabsTrigger>
                    <TabsTrigger value="medium" className="text-sm">
                      中等 ({result.issues.filter(i => i.severity === 'medium').length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="space-y-4 mt-6">
                    {result.issues.map((issue, index) => (
                      <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all duration-200 bg-white">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start space-x-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
                              issue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                              issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {getTypeIcon(issue.type)}
                            </div>
                            <div>
                              <h4 className="font-semibold text-lg text-gray-900 mb-1">{issue.title}</h4>
                              <p className="text-gray-600 text-sm">第 {issue.line} 行</p>
                            </div>
                          </div>
                          <Badge className={`${getSeverityColor(issue.severity)} px-3 py-1`}>
                            {issue.severity === 'critical' ? '严重' :
                             issue.severity === 'high' ? '高' :
                             issue.severity === 'medium' ? '中等' : '低'}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-700 mb-4 leading-relaxed">
                          {issue.description}
                        </p>
                        
                        <div className="bg-gray-900 rounded-lg p-4 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-300 text-sm font-medium">问题代码</span>
                            <span className="text-gray-400 text-xs">第 {issue.line} 行</span>
                          </div>
                          <pre className="text-sm text-gray-100 overflow-x-auto">
                            <code>{issue.code_snippet}</code>
                          </pre>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="flex items-center mb-2">
                              <Lightbulb className="w-5 h-5 text-blue-600 mr-2" />
                              <span className="font-medium text-blue-800">修复建议</span>
                            </div>
                            <p className="text-blue-700 text-sm leading-relaxed">{issue.suggestion}</p>
                          </div>
                          
                          {issue.ai_explanation && (
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                              <div className="flex items-center mb-2">
                                <Zap className="w-5 h-5 text-green-600 mr-2" />
                                <span className="font-medium text-green-800">AI 解释</span>
                              </div>
                              <p className="text-green-700 text-sm leading-relaxed">{issue.ai_explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {['critical', 'high', 'medium'].map(severity => (
                    <TabsContent key={severity} value={severity} className="space-y-4 mt-6">
                      {result.issues.filter(issue => issue.severity === severity).length > 0 ? (
                        result.issues.filter(issue => issue.severity === severity).map((issue, index) => (
                          <div key={index} className={`border rounded-xl p-6 ${
                            severity === 'critical' ? 'border-red-200 bg-red-50' :
                            severity === 'high' ? 'border-orange-200 bg-orange-50' :
                            'border-yellow-200 bg-yellow-50'
                          }`}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  severity === 'critical' ? 'bg-red-600 text-white' :
                                  severity === 'high' ? 'bg-orange-600 text-white' :
                                  'bg-yellow-600 text-white'
                                }`}>
                                  {getTypeIcon(issue.type)}
                                </div>
                                <h4 className={`font-semibold ${
                                  severity === 'critical' ? 'text-red-800' :
                                  severity === 'high' ? 'text-orange-800' :
                                  'text-yellow-800'
                                }`}>{issue.title}</h4>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                severity === 'critical' ? 'bg-red-200 text-red-800' :
                                severity === 'high' ? 'bg-orange-200 text-orange-800' :
                                'bg-yellow-200 text-yellow-800'
                              }`}>
                                第 {issue.line} 行
                              </span>
                            </div>
                            <p className={`text-sm mb-3 ${
                              severity === 'critical' ? 'text-red-700' :
                              severity === 'high' ? 'text-orange-700' :
                              'text-yellow-700'
                            }`}>
                              {issue.description}
                            </p>
                            <div className="bg-white rounded-lg p-3 border">
                              <p className="text-sm font-medium text-gray-800 mb-1">修复建议：</p>
                              <p className="text-sm text-gray-600">{issue.suggestion}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">
                            没有发现{severity === 'critical' ? '严重' : severity === 'high' ? '高优先级' : '中等优先级'}问题
                          </h3>
                          <p className="text-gray-500">
                            代码在此级别的检查中表现良好
                          </p>
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>


              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-green-800 mb-3">代码质量优秀！</h3>
                  <p className="text-green-600 text-lg mb-6">恭喜！没有发现任何问题</p>
                  <div className="bg-green-50 rounded-lg p-6 max-w-md mx-auto">
                    <p className="text-green-700 text-sm">
                      您的代码通过了所有质量检查，包括安全性、性能、可维护性等各个方面的评估。
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 分析进行中状态 */}
      {analyzing && (
        <Card className="card-modern">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">AI正在分析您的代码</h3>
              <p className="text-gray-600 text-lg mb-6">请稍候，这通常只需要几秒钟...</p>
              <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-blue-700 text-sm">
                  正在进行安全检测、性能分析、代码风格检查等多维度评估
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}