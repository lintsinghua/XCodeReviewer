/**
 * 提示词模板管理页面 - Retro Terminal 风格
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
    
    // 根据模板名称加载对应的测试代码
    const templateCodes = TEMPLATE_TEST_CODES[template.name];
    const defaultLang = 'python';
    if (templateCodes && templateCodes[defaultLang]) {
      setTestForm(prev => ({ 
        ...prev, 
        language: defaultLang, 
        code: templateCodes[defaultLang] 
      }));
    } else {
      // 使用通用测试代码
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-none h-32 w-32 border-8 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-4 bg-background min-h-screen font-mono relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">模板总数</p>
              <p className="text-3xl font-bold text-black">{templates.length}</p>
            </div>
            <div className="w-10 h-10 bg-primary border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">系统模板</p>
              <p className="text-3xl font-bold text-blue-600">{templates.filter(t => t.is_system).length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Shield className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">自定义模板</p>
              <p className="text-3xl font-bold text-green-600">{templates.filter(t => !t.is_system).length}</p>
            </div>
            <div className="w-10 h-10 bg-green-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">已启用</p>
              <p className="text-3xl font-bold text-orange-600">{templates.filter(t => t.is_active).length}</p>
            </div>
            <div className="w-10 h-10 bg-orange-500 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Zap className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            <span className="font-bold uppercase">提示词模板管理</span>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="retro-btn bg-primary text-white hover:bg-primary/90 h-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <Plus className="w-4 h-4 mr-2" />
            新建模板
          </Button>
        </div>
      </div>

      {/* 模板列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 relative z-10">
        {templates.length === 0 ? (
          <div className="col-span-full retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-100 border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-black uppercase mb-2">暂无提示词模板</h3>
            <p className="text-gray-500 mb-8 max-w-md">点击"新建模板"创建自定义提示词</p>
            <Button className="retro-btn bg-primary text-white h-12 px-8 text-lg font-bold uppercase" onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="w-5 h-5 mr-2" />
              创建模板
            </Button>
          </div>
        ) : (
          templates.map(template => {
            const TemplateIcon = getTemplateIcon(template.template_type);
            return (
              <div key={template.id} className={`retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all ${!template.is_active ? 'opacity-60' : ''}`}>
                <div className="p-5 border-b-2 border-dashed border-gray-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        <TemplateIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg uppercase">{template.name}</h3>
                        <p className="text-xs text-gray-500">{template.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {template.is_system && <Badge className="rounded-none border-2 border-black bg-blue-100 text-blue-800">系统</Badge>}
                    {template.is_default && <Badge className="rounded-none border-2 border-black bg-green-100 text-green-800">默认</Badge>}
                    <Badge variant="outline" className="rounded-none border-2 border-black">{TEMPLATE_TYPES.find(t => t.value === template.template_type)?.label}</Badge>
                  </div>
                </div>

                <div className="p-4">
                  <div 
                    className="text-sm text-gray-600 line-clamp-3 bg-gray-50 p-3 border-2 border-black font-mono text-xs mb-4 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => openViewDialog(template)}
                    title="点击查看完整内容"
                  >
                    {template.content_zh || template.content_en || '(无内容)'}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openViewDialog(template)} className="hover:bg-purple-100">
                        <FileText className="w-4 h-4 mr-1" />
                        查看
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openTestDialog(template)} className="hover:bg-green-100">
                        <Play className="w-4 h-4 mr-1" />
                        测试
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(template.content_zh || template.content_en || '')} className="hover:bg-blue-100">
                        <Copy className="w-4 h-4 mr-1" />
                        复制
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      {!template.is_system && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)} className="hover:bg-gray-100"><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(template.id)} className="hover:bg-red-100 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
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

      {/* 创建/编辑对话框 */}
      <Dialog open={showCreateDialog || showEditDialog} onOpenChange={(open) => { if (!open) { setShowCreateDialog(false); setShowEditDialog(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              {showEditDialog ? '编辑模板' : '新建模板'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">模板名称 *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：安全专项审计" className="terminal-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">模板类型</Label>
                <Select value={form.template_type} onValueChange={v => setForm({ ...form, template_type: v })}>
                  <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{TEMPLATE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">描述</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="模板用途描述" className="terminal-input" />
            </div>
            <Tabs defaultValue="zh" className="w-full">
              <TabsList className="flex w-full bg-gray-100 border-2 border-black p-1 h-auto gap-1">
                <TabsTrigger value="zh" className="flex-1 data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase py-2">中文提示词</TabsTrigger>
                <TabsTrigger value="en" className="flex-1 data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase py-2">英文提示词</TabsTrigger>
              </TabsList>
              <TabsContent value="zh" className="mt-4">
                <Textarea value={form.content_zh} onChange={e => setForm({ ...form, content_zh: e.target.value })} placeholder="输入中文提示词内容..." rows={15} className="terminal-input font-mono text-sm" />
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <Textarea value={form.content_en} onChange={e => setForm({ ...form, content_en: e.target.value })} placeholder="Enter English prompt content..." rows={15} className="terminal-input font-mono text-sm" />
              </TabsContent>
            </Tabs>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
              <Label className="font-mono font-bold uppercase text-xs">启用此模板</Label>
            </div>
          </div>
          <DialogFooter className="p-4 border-t-2 border-dashed border-gray-200">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setShowEditDialog(false); }} className="retro-btn bg-white text-black">取消</Button>
            <Button onClick={showEditDialog ? handleUpdate : handleCreate} className="retro-btn bg-primary text-white">{showEditDialog ? '保存' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 测试对话框 */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="!max-w-6xl w-[90vw] max-h-[90vh] overflow-y-auto retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              测试提示词: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-300">使用示例代码测试提示词效果</DialogDescription>
          </DialogHeader>
          <div className="p-6 grid grid-cols-2 gap-6">
            {/* 左侧：输入 */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-mono font-bold uppercase text-xs">编程语言</Label>
                  <Select value={testForm.language} onValueChange={v => { 
                    // 优先使用模板专属测试代码，否则使用通用测试代码
                    const templateCodes = selectedTemplate ? TEMPLATE_TEST_CODES[selectedTemplate.name] : null;
                    const code = templateCodes?.[v] || TEST_CODE_SAMPLES[v] || TEST_CODE_SAMPLES.python;
                    setTestForm({ ...testForm, language: v, code }); 
                  }}>
                    <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="java">Java</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono font-bold uppercase text-xs">提示词语言</Label>
                  <Select value={testForm.promptLang} onValueChange={(v: 'zh' | 'en') => setTestForm({ ...testForm, promptLang: v })}>
                    <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">中文提示词</SelectItem>
                      <SelectItem value="en">英文提示词</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">测试代码</Label>
                <Textarea value={testForm.code} onChange={e => setTestForm({ ...testForm, code: e.target.value })} rows={10} className="terminal-input font-mono text-sm" />
              </div>
              <Button onClick={handleTest} disabled={testing} className="w-full retro-btn bg-primary text-white h-12">
                {testing ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />分析中...</>) : (<><Play className="w-4 h-4 mr-2" />运行测试</>)}
              </Button>
            </div>
            {/* 右侧：结果 */}
            <div className="space-y-4">
              <Label className="font-mono font-bold uppercase text-xs">分析结果</Label>
              <div className="border-2 border-black h-[400px] overflow-auto bg-gray-50">
                {testResult ? (
                  testResult.success ? (
                    <div className="flex flex-col h-full">
                      {/* 成功状态头部 */}
                      <div className="flex items-center justify-between p-3 bg-green-100 border-b-2 border-black">
                        <div className="flex items-center gap-2 text-green-700 font-bold">
                          <Check className="w-5 h-5" />
                          <span className="uppercase text-sm">分析成功</span>
                        </div>
                        <Badge className="rounded-none border-2 border-black bg-white text-black font-mono">
                          {testResult.execution_time}s
                        </Badge>
                      </div>
                      
                      {/* 质量评分 */}
                      {testResult.result?.quality_score !== undefined && (
                        <div className="p-3 bg-white border-b-2 border-dashed border-gray-300 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase text-gray-600">质量评分</span>
                          <div className="flex items-center gap-2">
                            <div className={`text-2xl font-bold ${
                              testResult.result.quality_score >= 80 ? 'text-green-600' :
                              testResult.result.quality_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {testResult.result.quality_score}
                            </div>
                            <span className="text-xs text-gray-500">/ 100</span>
                          </div>
                        </div>
                      )}
                      
                      {/* 问题列表 */}
                      <div className="flex-1 overflow-auto p-3">
                        {testResult.result?.issues?.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase text-gray-600">发现问题</span>
                              <Badge className="rounded-none border-2 border-black bg-red-100 text-red-800">
                                {testResult.result.issues.length} 个
                              </Badge>
                            </div>
                            {testResult.result.issues.map((issue: any, idx: number) => (
                              <div key={idx} className="bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                                <div className={`px-3 py-2 border-b-2 border-black flex items-center justify-between ${
                                  issue.severity === 'critical' ? 'bg-red-500 text-white' :
                                  issue.severity === 'high' ? 'bg-orange-500 text-white' :
                                  issue.severity === 'medium' ? 'bg-yellow-400 text-black' : 'bg-blue-400 text-white'
                                }`}>
                                  <span className="font-bold text-xs uppercase">{issue.severity}</span>
                                  {issue.line && <span className="text-xs opacity-80">行 {issue.line}</span>}
                                </div>
                                <div className="p-3">
                                  <h4 className="font-bold text-sm mb-1">{issue.title}</h4>
                                  {issue.description && (
                                    <p className="text-xs text-gray-600 leading-relaxed">{issue.description}</p>
                                  )}
                                  {issue.suggestion && (
                                    <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-500">
                                      <p className="text-xs text-blue-800">
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
                            <div className="w-12 h-12 bg-green-100 border-2 border-black flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              <Check className="w-6 h-6 text-green-600" />
                            </div>
                            <p className="font-bold text-green-700 uppercase text-sm">未发现问题</p>
                            <p className="text-xs text-gray-500 mt-1">代码质量良好</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full">
                      {/* 失败状态头部 */}
                      <div className="flex items-center justify-between p-3 bg-red-100 border-b-2 border-black">
                        <div className="flex items-center gap-2 text-red-700 font-bold">
                          <AlertTriangle className="w-5 h-5" />
                          <span className="uppercase text-sm">测试失败</span>
                        </div>
                        {testResult.execution_time && (
                          <Badge className="rounded-none border-2 border-black bg-white text-black font-mono">
                            {testResult.execution_time}s
                          </Badge>
                        )}
                      </div>
                      {/* 错误详情 */}
                      <div className="flex-1 p-4">
                        <div className="bg-red-50 border-2 border-red-300 p-4 h-full overflow-auto">
                          <pre className="text-sm text-red-800 font-mono whitespace-pre-wrap break-words">
                            {testResult.error || '未知错误'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mb-4">
                      <Play className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-mono uppercase text-sm">点击"运行测试"</p>
                    <p className="font-mono text-xs mt-1">查看分析结果</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t-2 border-dashed border-gray-200">
            <Button variant="outline" onClick={() => setShowTestDialog(false)} className="retro-btn bg-white text-black">关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 查看详情对话框 */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {viewTemplate?.name}
            </DialogTitle>
            <DialogDescription className="text-gray-300">{viewTemplate?.description}</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {viewTemplate?.is_system && <Badge className="rounded-none border-2 border-black bg-blue-100 text-blue-800">系统模板</Badge>}
              {viewTemplate?.is_default && <Badge className="rounded-none border-2 border-black bg-green-100 text-green-800">默认</Badge>}
              <Badge variant="outline" className="rounded-none border-2 border-black">{TEMPLATE_TYPES.find(t => t.value === viewTemplate?.template_type)?.label}</Badge>
              {viewTemplate?.is_active ? (
                <Badge className="rounded-none border-2 border-black bg-green-100 text-green-800">已启用</Badge>
              ) : (
                <Badge className="rounded-none border-2 border-black bg-gray-100 text-gray-800">已禁用</Badge>
              )}
            </div>
            
            <Tabs defaultValue="zh" className="w-full">
              <TabsList className="flex w-full bg-gray-100 border-2 border-black p-1 h-auto gap-1">
                <TabsTrigger value="zh" className="flex-1 data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase py-2">
                  中文提示词
                </TabsTrigger>
                <TabsTrigger value="en" className="flex-1 data-[state=active]:bg-black data-[state=active]:text-white font-mono font-bold uppercase py-2">
                  英文提示词
                </TabsTrigger>
              </TabsList>
              <TabsContent value="zh" className="mt-4">
                <div className="bg-gray-900 text-green-400 p-4 border-2 border-black font-mono text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                  {viewTemplate?.content_zh || '(无中文内容)'}
                </div>
              </TabsContent>
              <TabsContent value="en" className="mt-4">
                <div className="bg-gray-900 text-green-400 p-4 border-2 border-black font-mono text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                  {viewTemplate?.content_en || '(No English content)'}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="p-4 border-t-2 border-dashed border-gray-200 flex gap-2">
            <Button variant="outline" onClick={() => copyToClipboard(viewTemplate?.content_zh || viewTemplate?.content_en || '')} className="retro-btn bg-white text-black">
              <Copy className="w-4 h-4 mr-2" />
              复制内容
            </Button>
            <Button variant="outline" onClick={() => { setShowViewDialog(false); if (viewTemplate) openTestDialog(viewTemplate); }} className="retro-btn bg-green-100 text-green-800 hover:bg-green-200">
              <Play className="w-4 h-4 mr-2" />
              测试
            </Button>
            {!viewTemplate?.is_system && (
              <Button variant="outline" onClick={() => { setShowViewDialog(false); if (viewTemplate) openEditDialog(viewTemplate); }} className="retro-btn bg-blue-100 text-blue-800 hover:bg-blue-200">
                <Edit className="w-4 h-4 mr-2" />
                编辑
              </Button>
            )}
            <Button onClick={() => setShowViewDialog(false)} className="retro-btn bg-primary text-white">关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
