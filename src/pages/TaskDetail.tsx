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
  Shield,
  Code,
  Zap,
  Info,
  Lightbulb
} from "lucide-react";
import { api } from "@/shared/config/database";
import type { AuditTask, AuditIssue } from "@/shared/types";
import { toast } from "sonner";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<AuditTask | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTaskData();
    }
  }, [id]);

  const loadTaskData = async () => {
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
      console.error('Failed to load task data:', error);
      toast.error("加载任务数据失败");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5" />;
      case 'running': return <Activity className="w-5 h-5" />;
      case 'failed': return <AlertTriangle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">任务未找到</h2>
          <p className="text-gray-600 mb-4">请检查任务ID是否正确</p>
          <Link to="/audit-tasks">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回任务列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/audit-tasks">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
            </h1>
            <p className="text-gray-600 mt-1">
              项目：{task.project?.name || '未知项目'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge className={getStatusColor(task.status)} variant="outline">
            {getStatusIcon(task.status)}
            <span className="ml-2">
              {task.status === 'completed' ? '已完成' : 
               task.status === 'running' ? '运行中' : 
               task.status === 'failed' ? '失败' : '等待中'}
            </span>
          </Badge>
        </div>
      </div>

      {/* 任务概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">扫描文件</p>
                <p className="text-2xl font-bold">{task.scanned_files}/{task.total_files}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Code className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">代码行数</p>
                <p className="text-2xl font-bold">{task.total_lines.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">发现问题</p>
                <p className="text-2xl font-bold">{task.issues_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">质量评分</p>
                <p className="text-2xl font-bold">{task.quality_score.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">任务概览</TabsTrigger>
          <TabsTrigger value="issues">问题详情</TabsTrigger>
          <TabsTrigger value="config">配置信息</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 任务信息 */}
            <Card>
              <CardHeader>
                <CardTitle>任务信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">任务类型</span>
                    <Badge variant="outline">
                      {task.task_type === 'repository' ? '仓库审计' : '即时分析'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">创建时间</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(task.created_at)}
                    </span>
                  </div>
                  
                  {task.started_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">开始时间</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(task.started_at)}
                      </span>
                    </div>
                  )}
                  
                  {task.completed_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">完成时间</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(task.completed_at)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">创建者</span>
                    <span className="text-sm text-muted-foreground">
                      {task.creator?.full_name || task.creator?.phone || '未知'}
                    </span>
                  </div>
                </div>

                {/* 扫描进度 */}
                {task.status === 'running' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>扫描进度</span>
                      <span>{task.scanned_files}/{task.total_files}</span>
                    </div>
                    <Progress value={(task.scanned_files / task.total_files) * 100} />
                  </div>
                )}

                {/* 质量评分 */}
                {task.status === 'completed' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>代码质量评分</span>
                      <span>{task.quality_score.toFixed(1)}/100</span>
                    </div>
                    <Progress value={task.quality_score} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 问题统计 */}
            <Card>
              <CardHeader>
                <CardTitle>问题统计</CardTitle>
              </CardHeader>
              <CardContent>
                {issues.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">
                          {issues.filter(i => i.severity === 'critical').length}
                        </p>
                        <p className="text-sm text-red-600">严重问题</p>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <p className="text-2xl font-bold text-orange-600">
                          {issues.filter(i => i.severity === 'high').length}
                        </p>
                        <p className="text-sm text-orange-600">高优先级</p>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-600">
                          {issues.filter(i => i.severity === 'medium').length}
                        </p>
                        <p className="text-sm text-yellow-600">中等优先级</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          {issues.filter(i => i.severity === 'low').length}
                        </p>
                        <p className="text-sm text-blue-600">低优先级</p>
                      </div>
                    </div>

                    {/* 问题类型分布 */}
                    <div className="space-y-2">
                      <h4 className="font-medium">问题类型分布</h4>
                      {['security', 'bug', 'performance', 'style', 'maintainability'].map(type => {
                        const count = issues.filter(i => i.issue_type === type).length;
                        const percentage = issues.length > 0 ? (count / issues.length) * 100 : 0;
                        return (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {getTypeIcon(type)}
                              <span className="text-sm capitalize">{type}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-muted-foreground w-8">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <p className="text-green-600 font-medium">未发现问题</p>
                    <p className="text-sm text-muted-foreground">代码质量良好</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          {issues.length > 0 ? (
            <div className="space-y-4">
              {issues.map((issue, index) => (
                <Card key={issue.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getTypeIcon(issue.issue_type)}
                        <div>
                          <h4 className="font-medium text-lg">{issue.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {issue.file_path}:{issue.line_number}
                          </p>
                        </div>
                      </div>
                      <Badge className={getSeverityColor(issue.severity)}>
                        {issue.severity}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      {issue.description}
                    </p>
                    
                    {issue.code_snippet && (
                      <div className="bg-gray-50 rounded p-3 mb-4">
                        <p className="text-sm font-medium mb-2">代码片段：</p>
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {issue.code_snippet}
                        </pre>
                      </div>
                    )}
                    
                    {issue.suggestion && (
                      <div className="bg-blue-50 rounded p-3 mb-4">
                        <p className="text-sm font-medium text-blue-800 mb-1">
                          <Lightbulb className="w-4 h-4 inline mr-1" />
                          修复建议：
                        </p>
                        <p className="text-sm text-blue-700">{issue.suggestion}</p>
                      </div>
                    )}
                    
                    {issue.ai_explanation && (
                      <div className="bg-green-50 rounded p-3">
                        <p className="text-sm font-medium text-green-800 mb-1">
                          AI 解释：
                        </p>
                        <p className="text-sm text-green-700">{issue.ai_explanation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-800 mb-2">代码质量良好！</h3>
                <p className="text-green-600">未发现任何问题</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>扫描配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">分支信息</h4>
                  <p className="text-sm text-muted-foreground">
                    {task.branch_name || '默认分支'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">排除模式</h4>
                  <div className="space-y-1">
                    {JSON.parse(task.exclude_patterns || '[]').length > 0 ? (
                      JSON.parse(task.exclude_patterns).map((pattern: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {pattern}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">无排除模式</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">扫描配置</h4>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(JSON.parse(task.scan_config || '{}'), null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}