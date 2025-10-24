import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Calendar,
  GitBranch,
  Shield,
  Bug,
  TrendingUp,
  Download,
  Code,
  Lightbulb,
  Info,
  Zap
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { AuditTask, AuditIssue } from "@/shared/types";
import { toast } from "sonner";
import ExportReportDialog from "@/components/reports/ExportReportDialog";

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

// 问题列表组件
function IssuesList({ issues }: { issues: AuditIssue[] }) {
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

  const criticalIssues = issues.filter(issue => issue.severity === 'critical');
  const highIssues = issues.filter(issue => issue.severity === 'high');
  const mediumIssues = issues.filter(issue => issue.severity === 'medium');
  const lowIssues = issues.filter(issue => issue.severity === 'low');

  const renderIssue = (issue: AuditIssue, index: number) => (
    <div key={issue.id || index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
            issue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
              issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                'bg-blue-100 text-blue-600'
            }`}>
            {getTypeIcon(issue.issue_type)}
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-base text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">{issue.title}</h4>
            <div className="flex items-center space-x-1 text-xs text-gray-600">
              <FileText className="w-3 h-3" />
              <span className="font-medium">{issue.file_path}</span>
            </div>
            {issue.line_number && (
              <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                <span>📍</span>
                <span>第 {issue.line_number} 行</span>
                {issue.column_number && <span>，第 {issue.column_number} 列</span>}
              </div>
            )}
          </div>
        </div>
        <Badge className={`${getSeverityColor(issue.severity)} px-2 py-1 text-xs font-medium`}>
          {issue.severity === 'critical' ? '严重' :
            issue.severity === 'high' ? '高' :
              issue.severity === 'medium' ? '中等' : '低'}
        </Badge>
      </div>

      {issue.description && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
          <div className="flex items-center mb-1">
            <Info className="w-3 h-3 text-gray-600 mr-1" />
            <span className="font-medium text-gray-800 text-xs">问题详情</span>
          </div>
          <p className="text-gray-700 text-xs leading-relaxed">
            {issue.description}
          </p>
        </div>
      )}

      {issue.code_snippet && (
        <div className="bg-gray-900 rounded-lg p-3 mb-3 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-red-600 rounded flex items-center justify-center">
                <Code className="w-2 h-2 text-white" />
              </div>
              <span className="text-gray-300 text-xs font-medium">问题代码</span>
            </div>
            {issue.line_number && (
              <span className="text-gray-400 text-xs">第 {issue.line_number} 行</span>
            )}
          </div>
          <div className="bg-black/40 rounded p-2">
            <pre className="text-xs text-gray-100 overflow-x-auto">
              <code>{issue.code_snippet}</code>
            </pre>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {issue.suggestion && (
          <div className="bg-white border border-blue-200 rounded-lg p-3 shadow-sm">
            <div className="flex items-center mb-2">
              <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center mr-2">
                <Lightbulb className="w-3 h-3 text-white" />
              </div>
              <span className="font-medium text-blue-800 text-sm">修复建议</span>
            </div>
            <p className="text-blue-700 text-xs leading-relaxed">{issue.suggestion}</p>
          </div>
        )}

        {issue.ai_explanation && (() => {
          const parsedExplanation = parseAIExplanation(issue.ai_explanation);

          if (parsedExplanation) {
            return (
              <div className="bg-white border border-red-200 rounded-lg p-3 shadow-sm">
                <div className="flex items-center mb-2">
                  <div className="w-5 h-5 bg-red-600 rounded flex items-center justify-center mr-2">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium text-red-800 text-sm">AI 解释</span>
                </div>

                <div className="space-y-2 text-xs">
                  {parsedExplanation.what && (
                    <div className="border-l-2 border-red-600 pl-2">
                      <span className="font-medium text-red-700">问题：</span>
                      <span className="text-gray-700 ml-1">{parsedExplanation.what}</span>
                    </div>
                  )}

                  {parsedExplanation.why && (
                    <div className="border-l-2 border-gray-600 pl-2">
                      <span className="font-medium text-gray-700">原因：</span>
                      <span className="text-gray-700 ml-1">{parsedExplanation.why}</span>
                    </div>
                  )}

                  {parsedExplanation.how && (
                    <div className="border-l-2 border-black pl-2">
                      <span className="font-medium text-black">方案：</span>
                      <span className="text-gray-700 ml-1">{parsedExplanation.how}</span>
                    </div>
                  )}

                  {parsedExplanation.learn_more && (
                    <div className="border-l-2 border-red-400 pl-2">
                      <span className="font-medium text-red-600">链接：</span>
                      <a
                        href={parsedExplanation.learn_more}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:text-red-800 hover:underline ml-1"
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
              <div className="bg-white border border-red-200 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Zap className="w-4 h-4 text-red-600 mr-2" />
                  <span className="font-medium text-red-800 text-sm">AI 解释</span>
                </div>
                <p className="text-gray-700 text-xs leading-relaxed">{issue.ai_explanation}</p>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );

  if (issues.length === 0) {
    return (
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
    );
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-6">
        <TabsTrigger value="all" className="text-sm">
          全部 ({issues.length})
        </TabsTrigger>
        <TabsTrigger value="critical" className="text-sm">
          严重 ({criticalIssues.length})
        </TabsTrigger>
        <TabsTrigger value="high" className="text-sm">
          高 ({highIssues.length})
        </TabsTrigger>
        <TabsTrigger value="medium" className="text-sm">
          中等 ({mediumIssues.length})
        </TabsTrigger>
        <TabsTrigger value="low" className="text-sm">
          低 ({lowIssues.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-4 mt-6">
        {issues.map((issue, index) => renderIssue(issue, index))}
      </TabsContent>

      <TabsContent value="critical" className="space-y-4 mt-6">
        {criticalIssues.length > 0 ? (
          criticalIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">没有发现严重问题</h3>
            <p className="text-gray-500">代码在严重级别的检查中表现良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="high" className="space-y-4 mt-6">
        {highIssues.length > 0 ? (
          highIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">没有发现高优先级问题</h3>
            <p className="text-gray-500">代码在高优先级检查中表现良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="medium" className="space-y-4 mt-6">
        {mediumIssues.length > 0 ? (
          mediumIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">没有发现中等优先级问题</h3>
            <p className="text-gray-500">代码在中等优先级检查中表现良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="low" className="space-y-4 mt-6">
        {lowIssues.length > 0 ? (
          lowIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">没有发现低优先级问题</h3>
            <p className="text-gray-500">代码在低优先级检查中表现良好</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<AuditTask | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadTaskDetail();
    }
  }, [id]);

  const loadTaskDetail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [taskData, issuesData] = await Promise.all([
        api.getAuditTaskById(id),
        api.getAuditIssues(id)
      ]);

      setTask(taskData);
      setIssues(issuesData);
    } catch (error) {
      console.error('Failed to load task detail:', error);
      toast.error("加载任务详情失败");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-red-50 text-red-800';
      case 'failed': return 'bg-red-100 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center space-x-4">
          <Link to="/tasks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回任务列表
            </Button>
          </Link>
        </div>
        <Card className="card-modern">
          <CardContent className="empty-state py-16">
            <div className="empty-icon">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">任务不存在</h3>
            <p className="text-gray-500">请检查任务ID是否正确</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercentage = Math.round((task.scanned_files / task.total_files) * 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/tasks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回任务列表
            </Button>
          </Link>
          <div>
            <h1 className="page-title">任务详情</h1>
            <p className="page-subtitle">{task.project?.name || '未知项目'} - 审计任务</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Badge className={getStatusColor(task.status)}>
            {getStatusIcon(task.status)}
            <span className="ml-2">
              {task.status === 'completed' ? '已完成' :
                task.status === 'running' ? '运行中' :
                  task.status === 'failed' ? '失败' : '等待中'}
            </span>
          </Badge>
          {task.status === 'completed' && (
            <Button 
              size="sm" 
              className="btn-primary"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="w-4 h-4 mr-2" />
              导出报告
            </Button>
          )}
        </div>
      </div>

      {/* 任务概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">扫描进度</p>
                <p className="stat-value text-xl">{progressPercentage}%</p>
                <Progress value={progressPercentage} className="mt-2" />
              </div>
              <div className="stat-icon from-primary to-accent">
                <Activity className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">发现问题</p>
                <p className="stat-value text-xl text-orange-600">{task.issues_count}</p>
              </div>
              <div className="stat-icon from-orange-500 to-orange-600">
                <Bug className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">质量评分</p>
                <p className="stat-value text-xl text-primary">{task.quality_score.toFixed(1)}</p>
              </div>
              <div className="stat-icon from-emerald-500 to-emerald-600">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">代码行数</p>
                <p className="stat-value text-xl">{task.total_lines.toLocaleString()}</p>
              </div>
              <div className="stat-icon from-purple-500 to-purple-600">
                <FileText className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>任务信息</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">任务类型</p>
                  <p className="text-base">
                    {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">目标分支</p>
                  <p className="text-base flex items-center">
                    <GitBranch className="w-4 h-4 mr-1" />
                    {task.branch_name || '默认分支'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">创建时间</p>
                  <p className="text-base flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(task.created_at)}
                  </p>
                </div>
                {task.completed_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">完成时间</p>
                    <p className="text-base flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {formatDate(task.completed_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* 排除模式 */}
              {task.exclude_patterns && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">排除模式</p>
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(task.exclude_patterns).map((pattern: string) => (
                      <Badge key={pattern} variant="outline" className="text-xs">
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 扫描配置 */}
              {task.scan_config && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">扫描配置</p>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <pre className="text-xs text-gray-600">
                      {JSON.stringify(JSON.parse(task.scan_config), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="card-modern">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>项目信息</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.project ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-500">项目名称</p>
                    <Link to={`/projects/${task.project.id}`} className="text-base text-primary hover:underline">
                      {task.project.name}
                    </Link>
                  </div>
                  {task.project.description && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">项目描述</p>
                      <p className="text-sm text-gray-600">{task.project.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">仓库类型</p>
                    <p className="text-base">{task.project.repository_type?.toUpperCase() || 'OTHER'}</p>
                  </div>
                  {task.project.programming_languages && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">编程语言</p>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(task.project.programming_languages).map((lang: string) => (
                          <Badge key={lang} variant="secondary" className="text-xs">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">项目信息不可用</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 问题列表 */}
      {issues.length > 0 && (
        <Card className="card-modern">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bug className="w-6 h-6 text-orange-600" />
              <span>发现的问题 ({issues.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IssuesList issues={issues} />
          </CardContent>
        </Card>
      )}

      {/* 导出报告对话框 */}
      {task && (
        <ExportReportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          task={task}
          issues={issues}
        />
      )}
    </div>
  );
}