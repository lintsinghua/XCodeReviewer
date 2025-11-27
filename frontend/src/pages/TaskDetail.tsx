import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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
import { calculateTaskProgress } from "@/shared/utils/utils";

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
    <div key={issue.id || index} className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3">
          <div className={`w - 10 h - 10 border - 2 border - black flex items - center justify - center shadow - [2px_2px_0px_0px_rgba(0, 0, 0, 1)] ${issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
              issue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-blue-100 text-blue-600'
            } `}>
            {getTypeIcon(issue.issue_type)}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-lg text-black mb-1 group-hover:text-primary transition-colors font-display uppercase">{issue.title}</h4>
            <div className="flex items-center space-x-1 text-xs text-gray-600 font-mono">
              <FileText className="w-3 h-3" />
              <span className="font-bold">{issue.file_path}</span>
            </div>
            {issue.line_number && (
              <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1 font-mono">
                <span>📍</span>
                <span>第 {issue.line_number} 行</span>
                {issue.column_number && <span>，第 {issue.column_number} 列</span>}
              </div>
            )}
          </div>
        </div>
        <Badge className={`rounded - none border - 2 border - black font - bold uppercase px - 2 py - 1 text - xs ${getSeverityColor(issue.severity)} `}>
          {issue.severity === 'critical' ? '严重' :
            issue.severity === 'high' ? '高' :
              issue.severity === 'medium' ? '中等' : '低'}
        </Badge>
      </div>

      {issue.description && (
        <div className="bg-gray-50 border-2 border-black p-3 mb-3 font-mono">
          <div className="flex items-center mb-1 border-b-2 border-gray-200 pb-1">
            <Info className="w-3 h-3 text-black mr-1" />
            <span className="font-bold text-black text-xs uppercase">问题详情</span>
          </div>
          <p className="text-gray-700 text-xs leading-relaxed mt-1">
            {issue.description}
          </p>
        </div>
      )}

      {issue.code_snippet && (
        <div className="bg-gray-900 p-3 mb-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-2 border-b border-gray-700 pb-1">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-red-600 flex items-center justify-center">
                <Code className="w-2 h-2 text-white" />
              </div>
              <span className="text-green-400 text-xs font-bold font-mono uppercase">CODE_SNIPPET</span>
            </div>
            {issue.line_number && (
              <span className="text-gray-400 text-xs font-mono">LINE: {issue.line_number}</span>
            )}
          </div>
          <div className="bg-black/40 p-2 border border-gray-700">
            <pre className="text-xs text-green-400 font-mono overflow-x-auto">
              <code>{issue.code_snippet}</code>
            </pre>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {issue.suggestion && (
          <div className="bg-blue-50 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center mb-2 border-b-2 border-blue-200 pb-1">
              <div className="w-5 h-5 bg-blue-600 border-2 border-black flex items-center justify-center mr-2 text-white">
                <Lightbulb className="w-3 h-3" />
              </div>
              <span className="font-bold text-blue-800 text-sm uppercase font-display">修复建议</span>
            </div>
            <p className="text-blue-900 text-xs leading-relaxed font-mono font-medium">{issue.suggestion}</p>
          </div>
        )}

        {issue.ai_explanation && (() => {
          const parsedExplanation = parseAIExplanation(issue.ai_explanation);

          if (parsedExplanation) {
            return (
              <div className="bg-red-50 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center mb-2 border-b-2 border-red-200 pb-1">
                  <div className="w-5 h-5 bg-red-600 border-2 border-black flex items-center justify-center mr-2 text-white">
                    <Zap className="w-3 h-3" />
                  </div>
                  <span className="font-bold text-red-800 text-sm uppercase font-display">AI 解释</span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  {parsedExplanation.what && (
                    <div className="border-l-4 border-red-600 pl-2">
                      <span className="font-bold text-red-700 uppercase">问题：</span>
                      <span className="text-gray-800 ml-1">{parsedExplanation.what}</span>
                    </div>
                  )}

                  {parsedExplanation.why && (
                    <div className="border-l-4 border-gray-600 pl-2">
                      <span className="font-bold text-gray-700 uppercase">原因：</span>
                      <span className="text-gray-800 ml-1">{parsedExplanation.why}</span>
                    </div>
                  )}

                  {parsedExplanation.how && (
                    <div className="border-l-4 border-black pl-2">
                      <span className="font-bold text-black uppercase">方案：</span>
                      <span className="text-gray-800 ml-1">{parsedExplanation.how}</span>
                    </div>
                  )}

                  {parsedExplanation.learn_more && (
                    <div className="border-l-4 border-blue-400 pl-2">
                      <span className="font-bold text-blue-600 uppercase">链接：</span>
                      <a
                        href={parsedExplanation.learn_more}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline ml-1 font-bold"
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
                <div className="flex items-center mb-2 border-b-2 border-red-200 pb-1">
                  <Zap className="w-4 h-4 text-red-600 mr-2" />
                  <span className="font-bold text-red-800 text-sm uppercase font-display">AI 解释</span>
                </div>
                <p className="text-gray-800 text-xs leading-relaxed font-mono">{issue.ai_explanation}</p>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );

  if (issues.length === 0) {
    return (
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
    );
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-6 bg-transparent border-2 border-black p-0 h-auto gap-0">
        <TabsTrigger value="all" className="rounded-none border-r-2 border-black data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
          全部 ({issues.length})
        </TabsTrigger>
        <TabsTrigger value="critical" className="rounded-none border-r-2 border-black data-[state=active]:bg-red-600 data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
          严重 ({criticalIssues.length})
        </TabsTrigger>
        <TabsTrigger value="high" className="rounded-none border-r-2 border-black data-[state=active]:bg-orange-500 data-[state=active]:text-white font-mono font-bold uppercase h-10 text-xs">
          高 ({highIssues.length})
        </TabsTrigger>
        <TabsTrigger value="medium" className="rounded-none border-r-2 border-black data-[state=active]:bg-yellow-400 data-[state=active]:text-black font-mono font-bold uppercase h-10 text-xs">
          中等 ({mediumIssues.length})
        </TabsTrigger>
        <TabsTrigger value="low" className="rounded-none data-[state=active]:bg-blue-400 data-[state=active]:text-black font-mono font-bold uppercase h-10 text-xs">
          低 ({lowIssues.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-4 mt-0">
        {issues.map((issue, index) => renderIssue(issue, index))}
      </TabsContent>

      <TabsContent value="critical" className="space-y-4 mt-0">
        {criticalIssues.length > 0 ? (
          criticalIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-black bg-gray-50">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-black uppercase mb-2 font-mono">没有发现严重问题</h3>
            <p className="text-gray-500 font-mono">代码在严重级别的检查中表现良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="high" className="space-y-4 mt-0">
        {highIssues.length > 0 ? (
          highIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-black bg-gray-50">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-black uppercase mb-2 font-mono">没有发现高优先级问题</h3>
            <p className="text-gray-500 font-mono">代码在高优先级检查中表现良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="medium" className="space-y-4 mt-0">
        {mediumIssues.length > 0 ? (
          mediumIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-black bg-gray-50">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-black uppercase mb-2 font-mono">没有发现中等优先级问题</h3>
            <p className="text-gray-500 font-mono">代码在中等优先级检查中表现良好</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="low" className="space-y-4 mt-0">
        {lowIssues.length > 0 ? (
          lowIssues.map((issue, index) => renderIssue(issue, index))
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-black bg-gray-50">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-black uppercase mb-2 font-mono">没有发现低优先级问题</h3>
            <p className="text-gray-500 font-mono">代码在低优先级检查中表现良好</p>
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

  // 对于运行中或等待中的任务，静默更新进度（不触发loading状态）
  useEffect(() => {
    if (!task || !id) {
      return;
    }

    // 运行中或等待中的任务需要定时更新
    if (task.status === 'running' || task.status === 'pending') {
      const intervalId = setInterval(async () => {
        try {
          // 静默获取任务数据，不触发loading状态
          const [taskData, issuesData] = await Promise.all([
            api.getAuditTaskById(id),
            api.getAuditIssues(id)
          ]);

          // 只有数据真正变化时才更新状态
          if (taskData && (
            taskData.status !== task.status ||
            taskData.scanned_files !== task.scanned_files ||
            taskData.issues_count !== task.issues_count
          )) {
            setTask(taskData);
            setIssues(issuesData);
          }
        } catch (error) {
          console.error('静默更新任务失败:', error);
        }
      }, 3000); // 每3秒静默更新一次

      return () => clearInterval(intervalId);
    }
  }, [task?.status, task?.scanned_files, id]);

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
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Activity className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'cancelled': return <Clock className="w-4 h-4" />;
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
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-none h-32 w-32 border-8 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-6 animate-fade-in font-mono">
        <div className="flex items-center space-x-4">
          <Link to="/audit-tasks">
            <Button variant="outline" size="sm" className="retro-btn bg-white text-black hover:bg-gray-100">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回任务列表
            </Button>
          </Link>
        </div>
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-red-50 border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-black uppercase mb-2 font-display">任务不存在</h3>
            <p className="text-gray-500 font-mono">请检查任务ID是否正确</p>
          </div>
        </div>
      </div>
    );
  }

  // 使用公共函数计算进度百分比
  const progressPercentage = calculateTaskProgress(task.scanned_files, task.total_files);

  return (
    <div className="space-y-6 animate-fade-in font-mono">
      {/* 页面标题 */}
      <div className="flex items-center justify-between border-b-4 border-black pb-6 bg-white/50 backdrop-blur-sm p-4 retro-border">
        <div className="flex items-center space-x-4">
          <Link to="/audit-tasks">
            <Button variant="outline" size="sm" className="retro-btn bg-white text-black hover:bg-gray-100 h-10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回任务列表
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-black uppercase tracking-tighter">任务详情</h1>
            <p className="text-gray-600 mt-1 font-mono border-l-2 border-primary pl-2">{task.project?.name || '未知项目'} - 审计任务</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Badge className={`rounded - none border - 2 border - black font - bold uppercase px - 3 py - 1 text - sm ${getStatusColor(task.status)} `}>
            {getStatusIcon(task.status)}
            <span className="ml-2">
              {task.status === 'completed' ? '已完成' :
                task.status === 'running' ? '运行中' :
                  task.status === 'failed' ? '失败' :
                    task.status === 'cancelled' ? '已取消' : '等待中'}
            </span>
          </Badge>

          {/* 已完成的任务显示导出按钮 */}
          {task.status === 'completed' && (
            <Button
              size="sm"
              className="retro-btn bg-primary text-white hover:bg-primary/90 h-10"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="w-4 h-4 mr-2" />
              导出报告
            </Button>
          )}
        </div>
      </div>

      {/* 任务概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">扫描进度</p>
              <p className="text-3xl font-bold text-black mb-2">{progressPercentage}%</p>
              <Progress value={progressPercentage} className="h-2 border-2 border-black rounded-none bg-gray-200 [&>div]:bg-primary" />
            </div>
            <div className="w-10 h-10 bg-primary border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ml-4">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">发现问题</p>
              <p className="text-3xl font-bold text-orange-600">{task.issues_count}</p>
            </div>
            <div className="w-10 h-10 bg-orange-500 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Bug className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">质量评分</p>
              <p className="text-3xl font-bold text-green-600">{task.quality_score.toFixed(1)}</p>
            </div>
            <div className="w-10 h-10 bg-green-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">代码行数</p>
              <p className="text-3xl font-bold text-purple-600">{task.total_lines.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-purple-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 任务信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                任务信息
              </h3>
            </div>
            <div className="p-6 space-y-4 font-mono">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-1">任务类型</p>
                  <p className="text-base font-bold">
                    {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-1">目标分支</p>
                  <p className="text-base font-bold flex items-center">
                    <GitBranch className="w-4 h-4 mr-1" />
                    {task.branch_name || '默认分支'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-1">创建时间</p>
                  <p className="text-base font-bold flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(task.created_at)}
                  </p>
                </div>
                {task.completed_at && (
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase mb-1">完成时间</p>
                    <p className="text-base font-bold flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {formatDate(task.completed_at)}
                    </p>
                  </div>
                )}
              </div>

              {/* 排除模式 */}
              {task.exclude_patterns && (
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">排除模式</p>
                  <div className="flex flex-wrap gap-2">
                    {JSON.parse(task.exclude_patterns).map((pattern: string) => (
                      <Badge key={pattern} variant="outline" className="text-xs rounded-none border-black bg-gray-100 font-mono">
                        {pattern}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 扫描配置 */}
              {task.scan_config && (
                <div>
                  <p className="text-xs font-bold text-gray-600 uppercase mb-2">扫描配置</p>
                  <div className="bg-gray-900 border-2 border-black p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <pre className="text-xs text-green-400 font-mono">
                      {JSON.stringify(JSON.parse(task.scan_config), null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
            <div className="p-4 border-b-2 border-black bg-gray-50">
              <h3 className="text-lg font-display font-bold uppercase flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                项目信息
              </h3>
            </div>
            <div className="p-6 space-y-4 font-mono">
              {task.project ? (
                <>
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase mb-1">项目名称</p>
                    <Link to={`/ projects / ${task.project.id} `} className="text-base font-bold text-primary hover:underline hover:text-primary/80">
                      {task.project.name}
                    </Link>
                  </div>
                  {task.project.description && (
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase mb-1">项目描述</p>
                      <p className="text-sm text-gray-800 font-medium">{task.project.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase mb-1">仓库类型</p>
                    <p className="text-base font-bold">{task.project.repository_type?.toUpperCase() || 'OTHER'}</p>
                  </div>
                  {task.project.programming_languages && (
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase mb-2">编程语言</p>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(task.project.programming_languages).map((lang: string) => (
                          <Badge key={lang} variant="secondary" className="text-xs rounded-none border-2 border-black bg-white text-black font-bold uppercase">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 font-bold">项目信息不可用</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 问题列表 */}
      {issues.length > 0 && (
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-0">
          <div className="p-4 border-b-2 border-black bg-gray-50">
            <h3 className="text-lg font-display font-bold uppercase flex items-center">
              <Bug className="w-6 h-6 mr-2 text-orange-600" />
              发现的问题 ({issues.length})
            </h3>
          </div>
          <div className="p-6">
            <IssuesList issues={issues} />
          </div>
        </div>
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