import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search, 
  Filter,
  Play,
  FileText,
  Calendar
} from "lucide-react";
import { api } from "@/db/supabase";
import type { AuditTask } from "@/types/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function AuditTasks() {
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error("加载任务失败");
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.task_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">审计任务</h1>
          <p className="text-gray-600 mt-2">
            查看和管理所有代码审计任务的执行状态
          </p>
        </div>
        <Button>
          <Play className="w-4 h-4 mr-2" />
          新建任务
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">总任务数</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">已完成</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">运行中</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'running').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">失败</p>
                <p className="text-2xl font-bold">
                  {tasks.filter(t => t.status === 'failed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索项目名称或任务类型..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                全部
              </Button>
              <Button
                variant={statusFilter === "running" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("running")}
              >
                运行中
              </Button>
              <Button
                variant={statusFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
              >
                已完成
              </Button>
              <Button
                variant={statusFilter === "failed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("failed")}
              >
                失败
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <h3 className="font-semibold text-lg">
                        {task.project?.name || '未知项目'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {task.task_type === 'repository' ? '仓库审计任务' : '即时分析任务'}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(task.status)}>
                    {task.status === 'completed' ? '已完成' : 
                     task.status === 'running' ? '运行中' : 
                     task.status === 'failed' ? '失败' : '等待中'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-xl font-bold">{task.total_files}</p>
                    <p className="text-xs text-muted-foreground">文件数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">{task.total_lines}</p>
                    <p className="text-xs text-muted-foreground">代码行数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">{task.issues_count}</p>
                    <p className="text-xs text-muted-foreground">发现问题</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">{task.quality_score.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">质量评分</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">
                      {task.scanned_files}/{task.total_files}
                    </p>
                    <p className="text-xs text-muted-foreground">扫描进度</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      创建于 {formatDate(task.created_at)}
                    </div>
                    {task.completed_at && (
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        完成于 {formatDate(task.completed_at)}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Link to={`/tasks/${task.id}`}>
                      <Button variant="outline" size="sm">
                        <FileText className="w-4 h-4 mr-2" />
                        查看详情
                      </Button>
                    </Link>
                    {task.project && (
                      <Link to={`/projects/${task.project.id}`}>
                        <Button variant="outline" size="sm">
                          查看项目
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {searchTerm || statusFilter !== "all" ? '未找到匹配的任务' : '暂无审计任务'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all" ? '尝试调整搜索条件或筛选器' : '创建第一个审计任务开始代码质量分析'}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button>
                <Play className="w-4 h-4 mr-2" />
                创建任务
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}