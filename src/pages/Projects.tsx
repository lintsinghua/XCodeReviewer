import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  GitBranch, 
  Calendar, 
  Users, 
  Settings, 
  ExternalLink,
  Code,
  Shield,
  Activity,
  AlertTriangle
} from "lucide-react";
import { api } from "@/db/supabase";
import type { Project, CreateProjectForm } from "@/types/types";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateProjectForm>({
    name: "",
    description: "",
    repository_url: "",
    repository_type: "github",
    default_branch: "main",
    programming_languages: []
  });

  const supportedLanguages = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'C#', 'PHP', 'Ruby'
  ];

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      toast.error("加载项目失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!createForm.name.trim()) {
      toast.error("请输入项目名称");
      return;
    }

    try {
      await api.createProject({
        ...createForm,
        // 无登录场景下不传 owner_id，由后端置为 null
      } as any);
      
      toast.success("项目创建成功");
      setShowCreateDialog(false);
      setCreateForm({
        name: "",
        description: "",
        repository_url: "",
        repository_type: "github",
        default_branch: "main",
        programming_languages: []
      });
      loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error("创建项目失败");
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRepositoryIcon = (type?: string) => {
    switch (type) {
      case 'github': return '🐙';
      case 'gitlab': return '🦊';
      default: return '📁';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">项目管理</h1>
          <p className="text-gray-600 mt-2">
            管理您的代码项目，配置审计规则和查看分析结果
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>创建新项目</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">项目名称 *</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="输入项目名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repository_type">仓库类型</Label>
                  <Select 
                    value={createForm.repository_type} 
                    onValueChange={(value: any) => setCreateForm({ ...createForm, repository_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">GitHub</SelectItem>
                      <SelectItem value="gitlab">GitLab</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">项目描述</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="简要描述项目内容和目标"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="repository_url">仓库地址</Label>
                  <Input
                    id="repository_url"
                    value={createForm.repository_url}
                    onChange={(e) => setCreateForm({ ...createForm, repository_url: e.target.value })}
                    placeholder="https://github.com/user/repo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_branch">默认分支</Label>
                  <Input
                    id="default_branch"
                    value={createForm.default_branch}
                    onChange={(e) => setCreateForm({ ...createForm, default_branch: e.target.value })}
                    placeholder="main"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>编程语言</Label>
                <div className="grid grid-cols-3 gap-2">
                  {supportedLanguages.map((lang) => (
                    <label key={lang} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={createForm.programming_languages.includes(lang)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCreateForm({
                              ...createForm,
                              programming_languages: [...createForm.programming_languages, lang]
                            });
                          } else {
                            setCreateForm({
                              ...createForm,
                              programming_languages: createForm.programming_languages.filter(l => l !== lang)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateProject}>
                  创建项目
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索项目名称或描述..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 项目列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getRepositoryIcon(project.repository_type)}</span>
                    <CardTitle className="text-lg">
                      <Link 
                        to={`/projects/${project.id}`}
                        className="hover:text-blue-600 transition-colors"
                      >
                        {project.name}
                      </Link>
                    </CardTitle>
                  </div>
                  <Badge variant={project.is_active ? "default" : "secondary"}>
                    {project.is_active ? '活跃' : '暂停'}
                  </Badge>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {project.description}
                  </p>
                )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* 项目信息 */}
                <div className="space-y-2">
                  {project.repository_url && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <GitBranch className="w-4 h-4 mr-2" />
                      <a 
                        href={project.repository_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 transition-colors flex items-center"
                      >
                        {project.repository_url.replace('https://', '').substring(0, 30)}...
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </div>
                  )}
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    创建于 {formatDate(project.created_at)}
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="w-4 h-4 mr-2" />
                    所有者：{project.owner?.full_name || project.owner?.phone || '未知'}
                  </div>
                </div>

                {/* 编程语言 */}
                {project.programming_languages && (
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(project.programming_languages).slice(0, 3).map((lang: string) => (
                      <Badge key={lang} variant="outline" className="text-xs">
                        {lang}
                      </Badge>
                    ))}
                    {JSON.parse(project.programming_languages).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{JSON.parse(project.programming_languages).length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* 快速操作 */}
                <div className="flex space-x-2 pt-2">
                  <Link to={`/projects/${project.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Code className="w-4 h-4 mr-2" />
                      查看详情
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm">
                    <Shield className="w-4 h-4 mr-2" />
                    启动审计
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Code className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  {searchTerm ? '未找到匹配的项目' : '暂无项目'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm ? '尝试调整搜索条件' : '创建您的第一个项目开始代码审计'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    创建项目
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 项目统计 */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Code className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">总项目数</p>
                  <p className="text-2xl font-bold">{projects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">活跃项目</p>
                  <p className="text-2xl font-bold">
                    {projects.filter(p => p.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <GitBranch className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">GitHub项目</p>
                  <p className="text-2xl font-bold">
                    {projects.filter(p => p.repository_type === 'github').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">GitLab项目</p>
                  <p className="text-2xl font-bold">
                    {projects.filter(p => p.repository_type === 'gitlab').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}