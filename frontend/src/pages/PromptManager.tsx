/**
 * 提示词模板管理页面
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/shared/hooks/use-toast';
import {
  Plus,
  Trash2,
  Edit,
  Copy,
  Play,
  FileText,
  Sparkles,
  Check,
  Loader2,
} from 'lucide-react';
import {
  getPromptTemplates,
  createPromptTemplate,
  updatePromptTemplate,
  deletePromptTemplate,
  testPromptTemplate,
  type PromptTemplate,
  type PromptTemplateCreate,
} from '@/shared/api/prompts';

const TEMPLATE_TYPES = [
  { value: 'system', label: '系统提示词' },
  { value: 'user', label: '用户提示词' },
  { value: 'analysis', label: '分析提示词' },
];

const TEST_CODE_SAMPLES: Record<string, string> = {
  python: `def login(username, password):
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor.execute(query)
    return cursor.fetchone()`,
  javascript: `function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId;
    return db.query(query);
}`,
  java: `public User findUser(String username) {
    String query = "SELECT * FROM users WHERE username = '" + username + "'";
    return jdbcTemplate.queryForObject(query, User.class);
}`,
};

export default function PromptManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  
  // 表单状态
  const [form, setForm] = useState<PromptTemplateCreate>({
    name: '',
    description: '',
    template_type: 'system',
    content_zh: '',
    content_en: '',
    is_active: true,
  });
  
  // 测试表单
  const [testForm, setTestForm] = useState({
    language: 'python',
    code: TEST_CODE_SAMPLES.python,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await getPromptTemplates();
      setTemplates(response.items);
    } catch (error) {
      toast({ title: '加载失败', description: '无法加载提示词模板', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createPromptTemplate(form);
      toast({ title: '创建成功' });
      setShowCreateDialog(false);
      resetForm();
      loadTemplates();
    } catch (error) {
      toast({ title: '创建失败', variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;
    try {
      await updatePromptTemplate(selectedTemplate.id, form);
      toast({ title: '更新成功' });
      setShowEditDialog(false);
      loadTemplates();
    } catch (error) {
      toast({ title: '更新失败', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此模板吗？')) return;
    try {
      await deletePromptTemplate(id);
      toast({ title: '删除成功' });
      loadTemplates();
    } catch (error: any) {
      toast({ title: '删除失败', description: error.message, variant: 'destructive' });
    }
  };

  const handleTest = async () => {
    if (!selectedTemplate) return;
    
    const content = selectedTemplate.content_zh || selectedTemplate.content_en || '';
    if (!content) {
      toast({ title: '提示词内容为空', variant: 'destructive' });
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testPromptTemplate({
        content,
        language: testForm.language,
        code: testForm.code,
      });
      setTestResult(result);
      if (result.success) {
        toast({ title: '测试完成', description: `耗时 ${result.execution_time}s` });
      } else {
        toast({ title: '测试失败', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: '测试失败', description: error.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      template_type: 'system',
      content_zh: '',
      content_en: '',
      is_active: true,
    });
  };

  const openEditDialog = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setForm({
      name: template.name,
      description: template.description || '',
      template_type: template.template_type,
      content_zh: template.content_zh || '',
      content_en: template.content_en || '',
      is_active: template.is_active,
    });
    setShowEditDialog(true);
  };

  const openTestDialog = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setTestResult(null);
    setShowTestDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '已复制到剪贴板' });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">提示词管理</h1>
          <p className="text-muted-foreground">管理代码审计提示词模板，自定义分析策略</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          新建模板
        </Button>
      </div>

      {/* 模板列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">加载中...</div>
        ) : templates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无提示词模板，点击"新建模板"创建
            </CardContent>
          </Card>
        ) : (
          templates.map(template => (
            <Card key={template.id} className={!template.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="w-5 h-5" />
                      {template.name}
                    </CardTitle>
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {template.is_system && <Badge variant="secondary">系统</Badge>}
                    {template.is_default && <Badge>默认</Badge>}
                    <Badge variant="outline">
                      {TEMPLATE_TYPES.find(t => t.value === template.template_type)?.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* 预览 */}
                  <div className="text-sm text-muted-foreground line-clamp-3 bg-muted p-2 rounded">
                    {template.content_zh || template.content_en || '(无内容)'}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openTestDialog(template)}>
                        <Play className="w-4 h-4 mr-1" />
                        测试
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(template.content_zh || template.content_en || '')}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        复制
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      {!template.is_system && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 创建/编辑对话框 */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setShowEditDialog(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? '编辑模板' : '新建模板'}</DialogTitle>
            <DialogDescription>
              {showEditDialog ? '修改提示词模板内容' : '创建自定义提示词模板'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>模板名称</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="如：安全专项审计"
                />
              </div>
              <div>
                <Label>模板类型</Label>
                <Select value={form.template_type} onValueChange={v => setForm({ ...form, template_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>描述</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="模板用途描述"
              />
            </div>
            
            <Tabs defaultValue="zh" className="w-full">
              <TabsList>
                <TabsTrigger value="zh">中文提示词</TabsTrigger>
                <TabsTrigger value="en">英文提示词</TabsTrigger>
              </TabsList>
              <TabsContent value="zh">
                <Textarea
                  value={form.content_zh}
                  onChange={e => setForm({ ...form, content_zh: e.target.value })}
                  placeholder="输入中文提示词内容..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="en">
                <Textarea
                  value={form.content_en}
                  onChange={e => setForm({ ...form, content_en: e.target.value })}
                  placeholder="Enter English prompt content..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </TabsContent>
            </Tabs>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm({ ...form, is_active: v })}
              />
              <Label>启用此模板</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); }}>
              取消
            </Button>
            <Button onClick={showEditDialog ? handleUpdate : handleCreate}>
              {showEditDialog ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 测试对话框 */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              测试提示词: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              使用示例代码测试提示词效果
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 左侧：输入 */}
            <div className="space-y-4">
              <div>
                <Label>编程语言</Label>
                <Select
                  value={testForm.language}
                  onValueChange={v => {
                    setTestForm({
                      language: v,
                      code: TEST_CODE_SAMPLES[v] || TEST_CODE_SAMPLES.python,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>测试代码</Label>
                <Textarea
                  value={testForm.code}
                  onChange={e => setTestForm({ ...testForm, code: e.target.value })}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              
              <Button onClick={handleTest} disabled={testing} className="w-full">
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    运行测试
                  </>
                )}
              </Button>
            </div>
            
            {/* 右侧：结果 */}
            <div className="space-y-4">
              <Label>分析结果</Label>
              <div className="border rounded-lg p-4 h-[400px] overflow-auto bg-muted">
                {testResult ? (
                  testResult.success ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <Check className="w-5 h-5" />
                        <span>分析成功 (耗时 {testResult.execution_time}s)</span>
                      </div>
                      
                      {testResult.result?.issues?.length > 0 ? (
                        <div className="space-y-2">
                          <div className="font-medium">发现 {testResult.result.issues.length} 个问题:</div>
                          {testResult.result.issues.map((issue: any, idx: number) => (
                            <div key={idx} className="p-2 bg-background rounded border">
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  issue.severity === 'critical' ? 'destructive' :
                                  issue.severity === 'high' ? 'destructive' :
                                  issue.severity === 'medium' ? 'default' : 'secondary'
                                }>
                                  {issue.severity}
                                </Badge>
                                <span className="font-medium">{issue.title}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                              {issue.line && (
                                <p className="text-xs text-muted-foreground">行 {issue.line}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">未发现问题</div>
                      )}
                      
                      {testResult.result?.quality_score !== undefined && (
                        <div className="text-sm">
                          质量评分: <span className="font-bold">{testResult.result.quality_score}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-500">
                      <div className="font-medium">测试失败</div>
                      <div className="text-sm mt-1">{testResult.error}</div>
                    </div>
                  )
                ) : (
                  <div className="text-muted-foreground text-center py-8">
                    点击"运行测试"查看分析结果
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
