/**
 * Prompt Template Manager Page
 * Cyberpunk Terminal Aesthetic
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
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
  Terminal,
  MessageSquare,
  Shield,
  Zap,
  Code,
  AlertTriangle,
  Activity,
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
import { TEST_CODE_SAMPLES, TEMPLATE_TEST_CODES } from './prompt-manager/testCodeSamples';

const TEMPLATE_TYPES = [
  { value: 'system', label: '系统提示词' },
  { value: 'user', label: '用户提示词' },
  { value: 'analysis', label: '分析提示词' },
];

const getTemplateIcon = (type: string) => {
  switch (type) {
    case 'system': return Shield;
    case 'user': return MessageSquare;
    case 'analysis': return Code;
    default: return FileText;
  }
};

export default function PromptManager() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [form, setForm] = useState<PromptTemplateCreate>({
    name: '', description: '', template_type: 'system', content_zh: '', content_en: '', is_active: true,
  });
  const [testForm, setTestForm] = useState({ language: 'python', code: TEST_CODE_SAMPLES.python, promptLang: 'zh' as 'zh' | 'en' });
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<PromptTemplate | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await getPromptTemplates();
      setTemplates(response.items);
    } catch (error) {
      toast.error('加载提示词模板失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createPromptTemplate(form);
      toast.success('创建成功');
      setShowCreateDialog(false);
      resetForm();
      loadTemplates();
    } catch (error) { toast.error('创建失败'); }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;
    try {
      await updatePromptTemplate(selectedTemplate.id, form);
      toast.success('更新成功');
      setShowEditDialog(false);
      loadTemplates();
    } catch (error) { toast.error('更新失败'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此模板吗？')) return;
    try {
      await deletePromptTemplate(id);
      toast.success('删除成功');
      loadTemplates();
    } catch (error: any) { toast.error(error.message || '删除失败'); }
  };

  const handleTest = async () => {
    if (!selectedTemplate) return;
    const content = testForm.promptLang === 'zh'
      ? (selectedTemplate.content_zh || selectedTemplate.content_en || '')
      : (selectedTemplate.content_en || selectedTemplate.content_zh || '');
    if (!content) { toast.error('提示词内容为空'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testPromptTemplate({ content, language: testForm.language, code: testForm.code, output_language: testForm.promptLang });
      setTestResult(result);
      if (result.success) toast.success(`测试完成，耗时 ${result.execution_time}s`);
      else toast.error(result.error || '测试失败');
    } catch (error: any) { toast.error(error.message || '测试失败'); }
    finally { setTesting(false); }
  };

  const resetForm = () => {
    setForm({ name: '', description: '', template_type: 'system', content_zh: '', content_en: '', is_active: true });
  };

  const openEditDialog = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setForm({ name: template.name, description: template.description || '', template_type: template.template_type, content_zh: template.content_zh || '', content_en: template.content_en || '', is_active: template.is_active });
    setShowEditDialog(true);
  };

  const openTestDialog = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setTestResult(null);

    const templateCodes = TEMPLATE_TEST_CODES[template.name];
    const defaultLang = 'python';
    if (templateCodes && templateCodes[defaultLang]) {
      setTestForm(prev => ({
        ...prev,
        language: defaultLang,
        code: templateCodes[defaultLang]
      }));
    } else {
      setTestForm(prev => ({
        ...prev,
        language: defaultLang,
        code: TEST_CODE_SAMPLES[defaultLang]
      }));
    }

    setShowTestDialog(true);
  };

  const openViewDialog = (template: PromptTemplate) => {
    setViewTemplate(template);
    setShowViewDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f]">
        <div className="text-center space-y-4">
          <div className="loading-spinner mx-auto" />
          <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-[#0a0a0f] min-h-screen font-mono relative">
      {/* Grid background */}
      <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">模板总数</p>
              <p className="stat-value text-primary">{templates.length}</p>
            </div>
            <div className="stat-icon text-primary">
              <FileText className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">系统模板</p>
              <p className="stat-value text-sky-400">{templates.filter(t => t.is_system).length}</p>
            </div>
            <div className="stat-icon text-sky-400">
              <Shield className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">自定义模板</p>
              <p className="stat-value text-emerald-400">{templates.filter(t => !t.is_system).length}</p>
            </div>
            <div className="stat-icon text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="cyber-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">已启用</p>
              <p className="stat-value text-amber-400">{templates.filter(t => t.is_active).length}</p>
            </div>
            <div className="stat-icon text-amber-400">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="cyber-card p-0 relative z-10">
        <div className="cyber-card-header">
          <Terminal className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold uppercase tracking-wider text-white">提示词模板管理</h3>
          <div className="ml-auto">
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="cyber-btn-primary h-9">
              <Plus className="w-4 h-4 mr-2" />
              新建模板
            </Button>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 relative z-10">
        {templates.length === 0 ? (
          <div className="col-span-full cyber-card p-16">
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <p className="empty-state-title">暂无提示词模板</p>
              <p className="empty-state-description">点击"新建模板"创建自定义提示词</p>
              <Button className="cyber-btn-primary h-12 px-8 mt-6" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
                <Plus className="w-5 h-5 mr-2" />
                创建模板
              </Button>
            </div>
          </div>
        ) : (
          templates.map(template => {
            const TemplateIcon = getTemplateIcon(template.template_type);
            return (
              <div key={template.id} className={`cyber-card p-0 ${!template.is_active ? 'opacity-60' : ''}`}>
                {/* Template Header */}
                <div className="p-5 border-b border-gray-800">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-800 border border-gray-700 flex items-center justify-center rounded">
                        <TemplateIcon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white uppercase">{template.name}</h3>
                        <p className="text-xs text-gray-500 line-clamp-1">{template.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {template.is_system && <Badge className="cyber-badge-info">系统</Badge>}
                    {template.is_default && <Badge className="cyber-badge-success">默认</Badge>}
                    <Badge className="cyber-badge-muted">{TEMPLATE_TYPES.find(t => t.value === template.template_type)?.label}</Badge>
                  </div>
                </div>

                {/* Template Content Preview */}
                <div className="p-4">
                  <div
                    className="text-xs text-emerald-400 line-clamp-3 bg-[#0a0a0f] p-3 border border-gray-800 font-mono mb-4 cursor-pointer hover:border-gray-700 transition-colors rounded"
                    onClick={() => openViewDialog(template)}
                    title="点击查看完整内容"
                  >
                    {template.content_zh || template.content_en || '(无内容)'}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openViewDialog(template)} className="cyber-btn-ghost h-8 px-2">
                        <FileText className="w-4 h-4 mr-1" />
                        查看
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openTestDialog(template)} className="cyber-btn-ghost h-8 px-2">
                        <Play className="w-4 h-4 mr-1" />
                        测试
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(template.content_zh || template.content_en || '')} className="cyber-btn-ghost h-8 px-2">
                        <Copy className="w-4 h-4 mr-1" />
                        复制
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      {!template.is_system && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)} className="cyber-btn-ghost h-8 w-8">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} className="h-8 w-8 hover:bg-rose-500/20 hover:text-rose-400">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setShowEditDialog(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto cyber-card p-0 bg-[#0c0c12]">
          <DialogHeader className="cyber-card-header">
            <Terminal className="w-5 h-5 text-primary" />
            <DialogTitle className="text-lg font-bold uppercase tracking-wider text-white">
              {showEditDialog ? '编辑模板' : '新建模板'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase">模板名称 *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：安全专项审计" className="cyber-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase">模板类型</Label>
                <Select value={form.template_type} onValueChange={v => setForm({ ...form, template_type: v })}>
                  <SelectTrigger className="cyber-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0c0c12] border-gray-700">
                    {TEMPLATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase">描述</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="模板用途描述" className="cyber-input" />
            </div>
            <Tabs defaultValue="zh" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-900/50 border border-gray-800 p-1 h-auto gap-1 rounded">
                <TabsTrigger value="zh" className="data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase py-2 text-gray-400 transition-all rounded-sm text-xs">
                  中文提示词
                </TabsTrigger>
                <TabsTrigger value="en" className="data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase py-2 text-gray-400 transition-all rounded-sm text-xs">
                  英文提示词
                </TabsTrigger>
              </TabsList>
              <TabsContent value="zh" className="mt-4">
                <Textarea value={form.content_zh} onChange={e => setForm({ ...form, content_zh: e.target.value })} placeholder="输入中文提示词内容..." rows={15} className="cyber-input font-mono text-sm text-emerald-400" />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Textarea value={form.content_en} onChange={e => setForm({ ...form, content_en: e.target.value })} placeholder="Enter English prompt content..." rows={15} className="cyber-input font-mono text-sm text-emerald-400" />
              </TabsContent>
            </Tabs>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label className="text-xs font-bold text-gray-400 uppercase">启用此模板</Label>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-gray-800">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); }} className="cyber-btn-outline">取消</Button>
            <Button onClick={showEditDialog ? handleUpdate : handleCreate} className="cyber-btn-primary">{showEditDialog ? '保存' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="!max-w-6xl w-[90vw] max-h-[90vh] !overflow-y-auto cyber-card p-0 bg-[#0c0c12] !fixed">
          <DialogHeader className="cyber-card-header">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <DialogTitle className="text-lg font-bold uppercase tracking-wider text-white">
              测试提示词: {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="px-6 pt-4 text-gray-400">使用示例代码测试提示词效果</DialogDescription>
          <div className="p-6 grid grid-cols-2 gap-6">
            {/* Left: Input */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase">编程语言</Label>
                  <Select value={testForm.language} onValueChange={v => {
                    const templateCodes = selectedTemplate ? TEMPLATE_TEST_CODES[selectedTemplate.name] : null;
                    const code = templateCodes?.[v] || TEST_CODE_SAMPLES[v] || TEST_CODE_SAMPLES.python;
                    setTestForm({ ...testForm, language: v, code });
                  }}>
                    <SelectTrigger className="cyber-input"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0c0c12] border-gray-700">
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="java">Java</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase">提示词语言</Label>
                  <Select value={testForm.promptLang} onValueChange={(v: 'zh' | 'en') => setTestForm({ ...testForm, promptLang: v })}>
                    <SelectTrigger className="cyber-input"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0c0c12] border-gray-700">
                      <SelectItem value="zh">中文提示词</SelectItem>
                      <SelectItem value="en">英文提示词</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase">测试代码</Label>
                <Textarea value={testForm.code} onChange={e => setTestForm({ ...testForm, code: e.target.value })} rows={10} className="cyber-input font-mono text-sm text-emerald-400" />
              </div>
              <Button onClick={handleTest} disabled={testing} className="w-full cyber-btn-primary h-12">
                {testing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />分析中...</>) : (<><Play className="w-4 h-4 mr-2" />运行测试</>)}
              </Button>
            </div>
            {/* Right: Results */}
            <div className="space-y-4">
              <Label className="text-xs font-bold text-gray-500 uppercase">分析结果</Label>
              <div className="border border-gray-800 h-[400px] overflow-auto bg-[#0a0a0f] rounded">
                {testResult ? (
                  testResult.success ? (
                    <div className="flex flex-col h-full">
                      {/* Success Header */}
                      <div className="flex items-center justify-between p-3 bg-emerald-500/10 border-b border-emerald-500/30">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                          <Check className="w-5 h-5" />
                          <span className="uppercase text-sm">分析成功</span>
                        </div>
                        <Badge className="cyber-badge-muted font-mono">
                          {testResult.execution_time}s
                        </Badge>
                      </div>

                      {/* Quality Score */}
                      {testResult.result?.quality_score !== undefined && (
                        <div className="p-3 bg-gray-900/50 border-b border-gray-800 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase text-gray-500">质量评分</span>
                          <div className="flex items-center gap-2">
                            <div className={`text-2xl font-bold ${
                              testResult.result.quality_score >= 80 ? 'text-emerald-400' :
                              testResult.result.quality_score >= 60 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {testResult.result.quality_score}
                            </div>
                            <span className="text-xs text-gray-500">/ 100</span>
                          </div>
                        </div>
                      )}

                      {/* Issues List */}
                      <ScrollArea className="flex-1 p-3">
                        {testResult.result?.issues?.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase text-gray-500">发现问题</span>
                              <Badge className="cyber-badge-danger">
                                {testResult.result.issues.length} 个
                              </Badge>
                            </div>
                            {testResult.result.issues.map((issue: any, idx: number) => (
                              <div key={idx} className="cyber-card p-0 overflow-hidden">
                                <div className={`px-3 py-2 border-b border-gray-800 flex items-center justify-between ${
                                  issue.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                                  issue.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  issue.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'
                                }`}>
                                  <span className="font-bold text-xs uppercase">{issue.severity}</span>
                                  {issue.line && <span className="text-xs opacity-80">行 {issue.line}</span>}
                                </div>
                                <div className="p-3">
                                  <h4 className="font-bold text-sm mb-1 text-gray-200">{issue.title}</h4>
                                  {issue.description && (
                                    <p className="text-xs text-gray-500 leading-relaxed">{issue.description}</p>
                                  )}
                                  {issue.suggestion && (
                                    <div className="mt-2 p-2 bg-sky-500/10 border-l-2 border-sky-500 rounded-r">
                                      <p className="text-xs text-sky-300">
                                        <span className="font-bold">建议: </span>
                                        {issue.suggestion}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 rounded">
                              <Check className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="font-bold text-emerald-400 uppercase text-sm">未发现问题</p>
                            <p className="text-xs text-gray-500 mt-1">代码质量良好</p>
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* Error Header */}
                      <div className="flex items-center justify-between p-3 bg-rose-500/10 border-b border-rose-500/30">
                        <div className="flex items-center gap-2 text-rose-400 font-bold">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="uppercase text-sm">测试失败</span>
                        </div>
                        {testResult.execution_time && (
                          <Badge className="cyber-badge-muted font-mono">
                            {testResult.execution_time}s
                          </Badge>
                        )}
                      </div>
                      {/* Error Details */}
                      <div className="flex-1 p-4">
                        <div className="bg-rose-500/10 border border-rose-500/30 p-4 h-full overflow-auto rounded">
                          <pre className="text-sm text-rose-400 font-mono whitespace-pre-wrap break-words">
                            {testResult.error || '未知错误'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-16 h-16 bg-gray-800 border border-gray-700 flex items-center justify-center mb-4 rounded">
                      <Play className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-mono uppercase text-sm">点击"运行测试"</p>
                    <p className="font-mono text-xs mt-1">查看分析结果</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-gray-800">
            <Button variant="outline" onClick={() => setShowTestDialog(false)} className="cyber-btn-outline">关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto cyber-card p-0 bg-[#0c0c12]">
          <DialogHeader className="cyber-card-header">
            <FileText className="w-5 h-5 text-primary" />
            <DialogTitle className="text-lg font-bold uppercase tracking-wider text-white">
              {viewTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="px-6 pt-4 text-gray-400">{viewTemplate?.description}</DialogDescription>
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {viewTemplate?.is_system && <Badge className="cyber-badge-info">系统模板</Badge>}
              {viewTemplate?.is_default && <Badge className="cyber-badge-success">默认</Badge>}
              <Badge className="cyber-badge-muted">{TEMPLATE_TYPES.find(t => t.value === viewTemplate?.template_type)?.label}</Badge>
              {viewTemplate?.is_active ? (
                <Badge className="cyber-badge-success">已启用</Badge>
              ) : (
                <Badge className="cyber-badge-muted">已禁用</Badge>
              )}
            </div>

            <Tabs defaultValue="zh" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-900/50 border border-gray-800 p-1 h-auto gap-1 rounded">
                <TabsTrigger value="zh" className="data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase py-2 text-gray-400 transition-all rounded-sm text-xs">
                  中文提示词
                </TabsTrigger>
                <TabsTrigger value="en" className="data-[state=active]:bg-primary data-[state=active]:text-white font-mono font-bold uppercase py-2 text-gray-400 transition-all rounded-sm text-xs">
                  英文提示词
                </TabsTrigger>
              </TabsList>
              <TabsContent value="zh" className="mt-4">
                <div className="bg-[#0a0a0f] text-emerald-400 p-4 border border-gray-800 font-mono text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto rounded">
                  {viewTemplate?.content_zh || '(无中文内容)'}
                </div>
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <div className="bg-[#0a0a0f] text-emerald-400 p-4 border border-gray-800 font-mono text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto rounded">
                  {viewTemplate?.content_en || '(No English content)'}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="p-4 border-t border-gray-800 flex gap-2">
            <Button variant="outline" onClick={() => copyToClipboard(viewTemplate?.content_zh || viewTemplate?.content_en || '')} className="cyber-btn-outline">
              <Copy className="w-4 h-4 mr-2" />
              复制内容
            </Button>
            <Button variant="outline" onClick={() => { setShowViewDialog(false); if (viewTemplate) openTestDialog(viewTemplate); }} className="cyber-btn-outline">
              <Play className="w-4 h-4 mr-2" />
              测试
            </Button>
            {!viewTemplate?.is_system && (
              <Button variant="outline" onClick={() => { setShowViewDialog(false); if (viewTemplate) openEditDialog(viewTemplate); }} className="cyber-btn-outline">
                <Edit className="w-4 h-4 mr-2" />
                编辑
              </Button>
            )}
            <Button onClick={() => setShowViewDialog(false)} className="cyber-btn-primary">关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
