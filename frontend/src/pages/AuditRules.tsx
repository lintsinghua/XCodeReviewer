/**
 * 审计规则管理页面 - Retro Terminal 风格
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Shield,
  Bug,
  Zap,
  Code,
  Settings,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Activity,
  CheckCircle,
  Terminal,
} from 'lucide-react';
import {
  getRuleSets,
  createRuleSet,
  updateRuleSet,
  deleteRuleSet,
  exportRuleSet,
  importRuleSet,
  addRuleToSet,
  updateRule,
  deleteRule,
  toggleRule,
  type AuditRuleSet,
  type AuditRule,
  type AuditRuleSetCreate,
  type AuditRuleCreate,
} from '@/shared/api/rules';

const CATEGORIES = [
  { value: 'security', label: '安全', icon: Shield, color: 'text-red-600', bg: 'bg-red-100' },
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-orange-600', bg: 'bg-orange-100' },
  { value: 'performance', label: '性能', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  { value: 'style', label: '代码风格', icon: Code, color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 'maintainability', label: '可维护性', icon: Settings, color: 'text-purple-600', bg: 'bg-purple-100' },
];

const SEVERITIES = [
  { value: 'critical', label: '严重', color: 'bg-red-600 text-white' },
  { value: 'high', label: '高', color: 'bg-orange-500 text-white' },
  { value: 'medium', label: '中', color: 'bg-yellow-500 text-black' },
  { value: 'low', label: '低', color: 'bg-blue-500 text-white' },
];

const LANGUAGES = [
  { value: 'all', label: '所有语言' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
];

const RULE_TYPES = [
  { value: 'security', label: '安全规则' },
  { value: 'quality', label: '质量规则' },
  { value: 'performance', label: '性能规则' },
  { value: 'custom', label: '自定义规则' },
];

export default function AuditRules() {
  const [ruleSets, setRuleSets] = useState<AuditRuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedRuleSet, setSelectedRuleSet] = useState<AuditRuleSet | null>(null);
  const [selectedRule, setSelectedRule] = useState<AuditRule | null>(null);

  const [ruleSetForm, setRuleSetForm] = useState<AuditRuleSetCreate>({
    name: '', description: '', language: 'all', rule_type: 'custom',
  });
  const [ruleForm, setRuleForm] = useState<AuditRuleCreate>({
    rule_code: '', name: '', description: '', category: 'security',
    severity: 'medium', custom_prompt: '', fix_suggestion: '', reference_url: '', enabled: true,
  });
  const [importJson, setImportJson] = useState('');

  useEffect(() => { loadRuleSets(); }, []);

  const loadRuleSets = async () => {
    try {
      setLoading(true);
      const response = await getRuleSets();
      setRuleSets(response.items);
    } catch (error) {
      toast.error('加载规则集失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSets);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedSets(newExpanded);
  };

  const handleCreateRuleSet = async () => {
    try {
      await createRuleSet(ruleSetForm);
      toast.success('规则集已创建');
      setShowCreateDialog(false);
      setRuleSetForm({ name: '', description: '', language: 'all', rule_type: 'custom' });
      loadRuleSets();
    } catch (error) { toast.error('创建失败'); }
  };

  const handleUpdateRuleSet = async () => {
    if (!selectedRuleSet) return;
    try {
      await updateRuleSet(selectedRuleSet.id, ruleSetForm);
      toast.success('更新成功');
      setShowEditDialog(false);
      loadRuleSets();
    } catch (error) { toast.error('更新失败'); }
  };

  const handleDeleteRuleSet = async (id: string) => {
    if (!confirm('确定要删除此规则集吗？')) return;
    try {
      await deleteRuleSet(id);
      toast.success('删除成功');
      loadRuleSets();
    } catch (error: any) { toast.error(error.message || '删除失败'); }
  };

  const handleExport = async (ruleSet: AuditRuleSet) => {
    try {
      const blob = await exportRuleSet(ruleSet.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${ruleSet.name}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (error) { toast.error('导出失败'); }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson);
      await importRuleSet(data);
      toast.success('导入成功');
      setShowImportDialog(false);
      setImportJson('');
      loadRuleSets();
    } catch (error: any) { toast.error(error.message || '导入失败'); }
  };

  const handleAddRule = async () => {
    if (!selectedRuleSet) return;
    try {
      await addRuleToSet(selectedRuleSet.id, ruleForm);
      toast.success('添加成功');
      setShowRuleDialog(false);
      setRuleForm({ rule_code: '', name: '', description: '', category: 'security', severity: 'medium', custom_prompt: '', fix_suggestion: '', reference_url: '', enabled: true });
      loadRuleSets();
    } catch (error) { toast.error('添加失败'); }
  };

  const handleUpdateRule = async () => {
    if (!selectedRuleSet || !selectedRule) return;
    try {
      await updateRule(selectedRuleSet.id, selectedRule.id, ruleForm);
      toast.success('更新成功');
      setShowRuleDialog(false);
      loadRuleSets();
    } catch (error) { toast.error('更新失败'); }
  };

  const handleDeleteRule = async (ruleSetId: string, ruleId: string) => {
    if (!confirm('确定要删除此规则吗？')) return;
    try {
      await deleteRule(ruleSetId, ruleId);
      toast.success('删除成功');
      loadRuleSets();
    } catch (error) { toast.error('删除失败'); }
  };

  const handleToggleRule = async (ruleSetId: string, ruleId: string) => {
    try {
      const result = await toggleRule(ruleSetId, ruleId);
      toast.success(result.message);
      loadRuleSets();
    } catch (error) { toast.error('操作失败'); }
  };

  const openEditRuleSetDialog = (ruleSet: AuditRuleSet) => {
    setSelectedRuleSet(ruleSet);
    setRuleSetForm({ name: ruleSet.name, description: ruleSet.description || '', language: ruleSet.language, rule_type: ruleSet.rule_type });
    setShowEditDialog(true);
  };

  const openAddRuleDialog = (ruleSet: AuditRuleSet) => {
    setSelectedRuleSet(ruleSet);
    setSelectedRule(null);
    setRuleForm({ rule_code: '', name: '', description: '', category: 'security', severity: 'medium', custom_prompt: '', fix_suggestion: '', reference_url: '', enabled: true });
    setShowRuleDialog(true);
  };

  const openEditRuleDialog = (ruleSet: AuditRuleSet, rule: AuditRule) => {
    setSelectedRuleSet(ruleSet);
    setSelectedRule(rule);
    setRuleForm({ rule_code: rule.rule_code, name: rule.name, description: rule.description || '', category: rule.category, severity: rule.severity, custom_prompt: rule.custom_prompt || '', fix_suggestion: rule.fix_suggestion || '', reference_url: rule.reference_url || '', enabled: rule.enabled });
    setShowRuleDialog(true);
  };

  const getCategoryInfo = (category: string) => CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  const getSeverityInfo = (severity: string) => SEVERITIES.find(s => s.value === severity) || SEVERITIES[2];

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
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">规则集总数</p>
              <p className="text-3xl font-bold text-black">{ruleSets.length}</p>
            </div>
            <div className="w-10 h-10 bg-primary border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Shield className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">系统规则集</p>
              <p className="text-3xl font-bold text-blue-600">{ruleSets.filter(r => r.is_system).length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Settings className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">总规则数</p>
              <p className="text-3xl font-bold text-green-600">{ruleSets.reduce((acc, r) => acc + r.rules_count, 0)}</p>
            </div>
            <div className="w-10 h-10 bg-green-600 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase mb-1">已启用规则</p>
              <p className="text-3xl font-bold text-orange-600">{ruleSets.reduce((acc, r) => acc + r.enabled_rules_count, 0)}</p>
            </div>
            <div className="w-10 h-10 bg-orange-500 border-2 border-black flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            <span className="font-bold uppercase">审计规则管理</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)} className="retro-btn bg-white text-black hover:bg-gray-100 h-10">
              <Upload className="w-4 h-4 mr-2" />
              导入规则集
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} className="retro-btn bg-primary text-white hover:bg-primary/90 h-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Plus className="w-4 h-4 mr-2" />
              新建规则集
            </Button>
          </div>
        </div>
      </div>

      {/* 规则集列表 */}
      <div className="space-y-4 relative z-10">
        {ruleSets.length === 0 ? (
          <div className="retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-100 border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Shield className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-black uppercase mb-2">暂无规则集</h3>
            <p className="text-gray-500 mb-8 max-w-md">点击"新建规则集"创建自定义审计规则</p>
            <Button className="retro-btn bg-primary text-white h-12 px-8 text-lg font-bold uppercase" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-5 h-5 mr-2" />
              创建规则集
            </Button>
          </div>
        ) : (
          ruleSets.map(ruleSet => (
            <div key={ruleSet.id} className={`retro-card bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${!ruleSet.is_active ? 'opacity-60' : ''}`}>
              {/* 规则集头部 */}
              <div className="p-6 border-b-2 border-dashed border-gray-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => toggleExpand(ruleSet.id)}>
                    <div className="w-10 h-10 bg-gray-100 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {expandedSets.has(ruleSet.id) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-black uppercase flex items-center gap-2">
                        {ruleSet.name}
                        {ruleSet.is_system && <Badge className="rounded-none border-2 border-black bg-blue-100 text-blue-800">系统</Badge>}
                        {ruleSet.is_default && <Badge className="rounded-none border-2 border-black bg-green-100 text-green-800">默认</Badge>}
                      </h3>
                      <p className="text-sm text-gray-600">{ruleSet.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="rounded-none border-2 border-black">{LANGUAGES.find(l => l.value === ruleSet.language)?.label}</Badge>
                    <Badge variant="outline" className="rounded-none border-2 border-black">{RULE_TYPES.find(t => t.value === ruleSet.rule_type)?.label}</Badge>
                    <span className="text-sm font-bold px-3 py-1 bg-gray-100 border-2 border-black">
                      {ruleSet.enabled_rules_count}/{ruleSet.rules_count} 启用
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleExport(ruleSet)} className="hover:bg-gray-100">
                      <Download className="w-4 h-4" />
                    </Button>
                    {!ruleSet.is_system && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEditRuleSetDialog(ruleSet)} className="hover:bg-gray-100">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRuleSet(ruleSet.id)} className="hover:bg-red-100 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 规则列表 */}
              {expandedSets.has(ruleSet.id) && (
                <div className="p-6">
                  {!ruleSet.is_system && (
                    <Button variant="outline" size="sm" onClick={() => openAddRuleDialog(ruleSet)} className="mb-4 retro-btn bg-white text-black hover:bg-gray-100">
                      <Plus className="w-4 h-4 mr-2" />
                      添加规则
                    </Button>
                  )}
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {ruleSet.rules.map(rule => {
                        const categoryInfo = getCategoryInfo(rule.category);
                        const severityInfo = getSeverityInfo(rule.severity);
                        const CategoryIcon = categoryInfo.icon;
                        return (
                          <div key={rule.id} className={`p-4 border-2 border-black bg-gray-50 hover:bg-white transition-all ${!rule.enabled ? 'opacity-50' : ''}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 ${categoryInfo.bg} border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                                  <CategoryIcon className={`w-5 h-5 ${categoryInfo.color}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs bg-black text-white px-2 py-0.5">{rule.rule_code}</span>
                                    <span className="font-bold uppercase">{rule.name}</span>
                                    <Badge className={`rounded-none border-2 border-black ${severityInfo.color}`}>{severityInfo.label}</Badge>
                                  </div>
                                  {rule.description && <p className="text-sm text-gray-600 mb-2">{rule.description}</p>}
                                  {rule.reference_url && (
                                    <a href={rule.reference_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                      参考链接 <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch checked={rule.enabled} onCheckedChange={() => handleToggleRule(ruleSet.id, rule.id)} />
                                {!ruleSet.is_system && (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => openEditRuleDialog(ruleSet, rule)}><Edit className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(ruleSet.id, rule.id)} className="hover:bg-red-100 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 创建规则集对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              新建规则集
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">名称 *</Label>
              <Input value={ruleSetForm.name} onChange={e => setRuleSetForm({ ...ruleSetForm, name: e.target.value })} placeholder="规则集名称" className="terminal-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">描述</Label>
              <Textarea value={ruleSetForm.description} onChange={e => setRuleSetForm({ ...ruleSetForm, description: e.target.value })} placeholder="规则集描述" className="terminal-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">适用语言</Label>
                <Select value={ruleSetForm.language} onValueChange={v => setRuleSetForm({ ...ruleSetForm, language: v })}>
                  <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="retro-card border border-border">
                    {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">规则类型</Label>
                <Select value={ruleSetForm.rule_type} onValueChange={v => setRuleSetForm({ ...ruleSetForm, rule_type: v })}>
                  <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                  <SelectContent className="retro-card border border-border">
                    {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t-2 border-dashed border-gray-200">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="retro-btn bg-white text-black">取消</Button>
            <Button onClick={handleCreateRuleSet} className="retro-btn bg-primary text-white">创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑规则集对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest">编辑规则集</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">名称</Label>
              <Input value={ruleSetForm.name} onChange={e => setRuleSetForm({ ...ruleSetForm, name: e.target.value })} className="terminal-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">描述</Label>
              <Textarea value={ruleSetForm.description} onChange={e => setRuleSetForm({ ...ruleSetForm, description: e.target.value })} className="terminal-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">适用语言</Label>
                <Select value={ruleSetForm.language} onValueChange={v => setRuleSetForm({ ...ruleSetForm, language: v })}>
                  <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">规则类型</Label>
                <Select value={ruleSetForm.rule_type} onValueChange={v => setRuleSetForm({ ...ruleSetForm, rule_type: v })}>
                  <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t-2 border-dashed border-gray-200">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="retro-btn bg-white text-black">取消</Button>
            <Button onClick={handleUpdateRuleSet} className="retro-btn bg-primary text-white">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 规则编辑对话框 */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-2xl retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest">{selectedRule ? '编辑规则' : '添加规则'}</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">规则代码 *</Label>
                <Input value={ruleForm.rule_code} onChange={e => setRuleForm({ ...ruleForm, rule_code: e.target.value })} placeholder="如 SEC001" className="terminal-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">规则名称 *</Label>
                <Input value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="规则名称" className="terminal-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">描述</Label>
              <Textarea value={ruleForm.description} onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })} placeholder="规则描述" className="terminal-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">类别</Label>
                <Select value={ruleForm.category} onValueChange={v => setRuleForm({ ...ruleForm, category: v })}>
                  <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono font-bold uppercase text-xs">严重程度</Label>
                <Select value={ruleForm.severity} onValueChange={v => setRuleForm({ ...ruleForm, severity: v })}>
                  <SelectTrigger className="terminal-input"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">自定义检测提示词</Label>
              <Textarea value={ruleForm.custom_prompt} onChange={e => setRuleForm({ ...ruleForm, custom_prompt: e.target.value })} placeholder="用于增强LLM检测的自定义提示词" rows={3} className="terminal-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">修复建议</Label>
              <Textarea value={ruleForm.fix_suggestion} onChange={e => setRuleForm({ ...ruleForm, fix_suggestion: e.target.value })} placeholder="修复建议模板" rows={2} className="terminal-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono font-bold uppercase text-xs">参考链接</Label>
              <Input value={ruleForm.reference_url} onChange={e => setRuleForm({ ...ruleForm, reference_url: e.target.value })} placeholder="如 https://owasp.org/..." className="terminal-input" />
            </div>
          </div>
          <DialogFooter className="p-4 border-t-2 border-dashed border-gray-200">
            <Button variant="outline" onClick={() => setShowRuleDialog(false)} className="retro-btn bg-white text-black">取消</Button>
            <Button onClick={selectedRule ? handleUpdateRule : handleAddRule} className="retro-btn bg-primary text-white">{selectedRule ? '保存' : '添加'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl retro-card border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white p-0">
          <DialogHeader className="bg-black text-white p-4 border-b-4 border-black">
            <DialogTitle className="font-mono text-xl uppercase tracking-widest flex items-center gap-2">
              <Upload className="w-5 h-5" />
              导入规则集
            </DialogTitle>
            <DialogDescription className="text-gray-300">粘贴导出的 JSON 内容</DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <Textarea value={importJson} onChange={e => setImportJson(e.target.value)} placeholder='{"name": "...", "rules": [...]}' rows={15} className="terminal-input font-mono text-sm" />
          </div>
          <DialogFooter className="p-4 border-t-2 border-dashed border-gray-200">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="retro-btn bg-white text-black">取消</Button>
            <Button onClick={handleImport} className="retro-btn bg-primary text-white">导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
