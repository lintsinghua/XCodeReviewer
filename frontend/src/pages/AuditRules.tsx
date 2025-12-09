/**
 * 审计规则管理页面
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/shared/hooks/use-toast';
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
  { value: 'security', label: '安全', icon: Shield, color: 'text-red-500' },
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-orange-500' },
  { value: 'performance', label: '性能', icon: Zap, color: 'text-yellow-500' },
  { value: 'style', label: '代码风格', icon: Code, color: 'text-blue-500' },
  { value: 'maintainability', label: '可维护性', icon: Settings, color: 'text-purple-500' },
];

const SEVERITIES = [
  { value: 'critical', label: '严重', color: 'bg-red-500' },
  { value: 'high', label: '高', color: 'bg-orange-500' },
  { value: 'medium', label: '中', color: 'bg-yellow-500' },
  { value: 'low', label: '低', color: 'bg-blue-500' },
];

const LANGUAGES = [
  { value: 'all', label: '所有语言' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C/C++' },
];

const RULE_TYPES = [
  { value: 'security', label: '安全规则' },
  { value: 'quality', label: '质量规则' },
  { value: 'performance', label: '性能规则' },
  { value: 'custom', label: '自定义规则' },
];

export default function AuditRules() {
  const { toast } = useToast();
  const [ruleSets, setRuleSets] = useState<AuditRuleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  
  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  const [selectedRuleSet, setSelectedRuleSet] = useState<AuditRuleSet | null>(null);
  const [selectedRule, setSelectedRule] = useState<AuditRule | null>(null);
  
  // 表单状态
  const [ruleSetForm, setRuleSetForm] = useState<AuditRuleSetCreate>({
    name: '',
    description: '',
    language: 'all',
    rule_type: 'custom',
  });
  
  const [ruleForm, setRuleForm] = useState<AuditRuleCreate>({
    rule_code: '',
    name: '',
    description: '',
    category: 'security',
    severity: 'medium',
    custom_prompt: '',
    fix_suggestion: '',
    reference_url: '',
    enabled: true,
  });
  
  const [importJson, setImportJson] = useState('');

  useEffect(() => {
    loadRuleSets();
  }, []);

  const loadRuleSets = async () => {
    try {
      setLoading(true);
      const response = await getRuleSets();
      setRuleSets(response.items);
    } catch (error) {
      toast({ title: '加载失败', description: '无法加载规则集', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSets);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSets(newExpanded);
  };

  const handleCreateRuleSet = async () => {
    try {
      await createRuleSet(ruleSetForm);
      toast({ title: '创建成功', description: '规则集已创建' });
      setShowCreateDialog(false);
      setRuleSetForm({ name: '', description: '', language: 'all', rule_type: 'custom' });
      loadRuleSets();
    } catch (error) {
      toast({ title: '创建失败', variant: 'destructive' });
    }
  };

  const handleUpdateRuleSet = async () => {
    if (!selectedRuleSet) return;
    try {
      await updateRuleSet(selectedRuleSet.id, ruleSetForm);
      toast({ title: '更新成功' });
      setShowEditDialog(false);
      loadRuleSets();
    } catch (error) {
      toast({ title: '更新失败', variant: 'destructive' });
    }
  };

  const handleDeleteRuleSet = async (id: string) => {
    if (!confirm('确定要删除此规则集吗？')) return;
    try {
      await deleteRuleSet(id);
      toast({ title: '删除成功' });
      loadRuleSets();
    } catch (error: any) {
      toast({ title: '删除失败', description: error.message, variant: 'destructive' });
    }
  };

  const handleExport = async (ruleSet: AuditRuleSet) => {
    try {
      const blob = await exportRuleSet(ruleSet.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ruleSet.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: '导出成功' });
    } catch (error) {
      toast({ title: '导出失败', variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson);
      await importRuleSet(data);
      toast({ title: '导入成功' });
      setShowImportDialog(false);
      setImportJson('');
      loadRuleSets();
    } catch (error: any) {
      toast({ title: '导入失败', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddRule = async () => {
    if (!selectedRuleSet) return;
    try {
      await addRuleToSet(selectedRuleSet.id, ruleForm);
      toast({ title: '添加成功' });
      setShowRuleDialog(false);
      setRuleForm({
        rule_code: '',
        name: '',
        description: '',
        category: 'security',
        severity: 'medium',
        custom_prompt: '',
        fix_suggestion: '',
        reference_url: '',
        enabled: true,
      });
      loadRuleSets();
    } catch (error) {
      toast({ title: '添加失败', variant: 'destructive' });
    }
  };

  const handleUpdateRule = async () => {
    if (!selectedRuleSet || !selectedRule) return;
    try {
      await updateRule(selectedRuleSet.id, selectedRule.id, ruleForm);
      toast({ title: '更新成功' });
      setShowRuleDialog(false);
      loadRuleSets();
    } catch (error) {
      toast({ title: '更新失败', variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (ruleSetId: string, ruleId: string) => {
    if (!confirm('确定要删除此规则吗？')) return;
    try {
      await deleteRule(ruleSetId, ruleId);
      toast({ title: '删除成功' });
      loadRuleSets();
    } catch (error) {
      toast({ title: '删除失败', variant: 'destructive' });
    }
  };

  const handleToggleRule = async (ruleSetId: string, ruleId: string) => {
    try {
      const result = await toggleRule(ruleSetId, ruleId);
      toast({ title: result.message });
      loadRuleSets();
    } catch (error) {
      toast({ title: '操作失败', variant: 'destructive' });
    }
  };

  const openEditRuleSetDialog = (ruleSet: AuditRuleSet) => {
    setSelectedRuleSet(ruleSet);
    setRuleSetForm({
      name: ruleSet.name,
      description: ruleSet.description || '',
      language: ruleSet.language,
      rule_type: ruleSet.rule_type,
    });
    setShowEditDialog(true);
  };

  const openAddRuleDialog = (ruleSet: AuditRuleSet) => {
    setSelectedRuleSet(ruleSet);
    setSelectedRule(null);
    setRuleForm({
      rule_code: '',
      name: '',
      description: '',
      category: 'security',
      severity: 'medium',
      custom_prompt: '',
      fix_suggestion: '',
      reference_url: '',
      enabled: true,
    });
    setShowRuleDialog(true);
  };

  const openEditRuleDialog = (ruleSet: AuditRuleSet, rule: AuditRule) => {
    setSelectedRuleSet(ruleSet);
    setSelectedRule(rule);
    setRuleForm({
      rule_code: rule.rule_code,
      name: rule.name,
      description: rule.description || '',
      category: rule.category,
      severity: rule.severity,
      custom_prompt: rule.custom_prompt || '',
      fix_suggestion: rule.fix_suggestion || '',
      reference_url: rule.reference_url || '',
      enabled: rule.enabled,
    });
    setShowRuleDialog(true);
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  };

  const getSeverityInfo = (severity: string) => {
    return SEVERITIES.find(s => s.value === severity) || SEVERITIES[2];
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">审计规则管理</h1>
          <p className="text-muted-foreground">管理代码审计规则集，自定义检测规范</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            导入规则集
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建规则集
          </Button>
        </div>
      </div>

      {/* 规则集列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">加载中...</div>
        ) : ruleSets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无规则集，点击"新建规则集"创建
            </CardContent>
          </Card>
        ) : (
          ruleSets.map(ruleSet => (
            <Card key={ruleSet.id} className={!ruleSet.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(ruleSet.id)}>
                    {expandedSets.has(ruleSet.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {ruleSet.name}
                        {ruleSet.is_system && <Badge variant="secondary">系统</Badge>}
                        {ruleSet.is_default && <Badge>默认</Badge>}
                      </CardTitle>
                      <CardDescription>{ruleSet.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{LANGUAGES.find(l => l.value === ruleSet.language)?.label}</Badge>
                    <Badge variant="outline">{RULE_TYPES.find(t => t.value === ruleSet.rule_type)?.label}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {ruleSet.enabled_rules_count}/{ruleSet.rules_count} 规则启用
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleExport(ruleSet)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    {!ruleSet.is_system && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEditRuleSetDialog(ruleSet)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRuleSet(ruleSet.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {expandedSets.has(ruleSet.id) && (
                <CardContent>
                  <div className="space-y-2">
                    {!ruleSet.is_system && (
                      <Button variant="outline" size="sm" onClick={() => openAddRuleDialog(ruleSet)}>
                        <Plus className="w-4 h-4 mr-2" />
                        添加规则
                      </Button>
                    )}
                    
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {ruleSet.rules.map(rule => {
                          const categoryInfo = getCategoryInfo(rule.category);
                          const severityInfo = getSeverityInfo(rule.severity);
                          const CategoryIcon = categoryInfo.icon;
                          
                          return (
                            <div
                              key={rule.id}
                              className={`p-3 border rounded-lg ${!rule.enabled ? 'opacity-50' : ''}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <CategoryIcon className={`w-5 h-5 mt-0.5 ${categoryInfo.color}`} />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-sm text-muted-foreground">{rule.rule_code}</span>
                                      <span className="font-medium">{rule.name}</span>
                                      <Badge className={severityInfo.color}>{severityInfo.label}</Badge>
                                    </div>
                                    {rule.description && (
                                      <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                                    )}
                                    {rule.reference_url && (
                                      <a
                                        href={rule.reference_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-500 hover:underline flex items-center gap-1 mt-1"
                                      >
                                        参考链接 <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={rule.enabled}
                                    onCheckedChange={() => handleToggleRule(ruleSet.id, rule.id)}
                                  />
                                  {!ruleSet.is_system && (
                                    <>
                                      <Button variant="ghost" size="icon" onClick={() => openEditRuleDialog(ruleSet, rule)}>
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(ruleSet.id, rule.id)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
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
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* 创建规则集对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建规则集</DialogTitle>
            <DialogDescription>创建自定义审计规则集</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input
                value={ruleSetForm.name}
                onChange={e => setRuleSetForm({ ...ruleSetForm, name: e.target.value })}
                placeholder="规则集名称"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={ruleSetForm.description}
                onChange={e => setRuleSetForm({ ...ruleSetForm, description: e.target.value })}
                placeholder="规则集描述"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>适用语言</Label>
                <Select value={ruleSetForm.language} onValueChange={v => setRuleSetForm({ ...ruleSetForm, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>规则类型</Label>
                <Select value={ruleSetForm.rule_type} onValueChange={v => setRuleSetForm({ ...ruleSetForm, rule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreateRuleSet}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑规则集对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑规则集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>名称</Label>
              <Input
                value={ruleSetForm.name}
                onChange={e => setRuleSetForm({ ...ruleSetForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={ruleSetForm.description}
                onChange={e => setRuleSetForm({ ...ruleSetForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>适用语言</Label>
                <Select value={ruleSetForm.language} onValueChange={v => setRuleSetForm({ ...ruleSetForm, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>规则类型</Label>
                <Select value={ruleSetForm.rule_type} onValueChange={v => setRuleSetForm({ ...ruleSetForm, rule_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleUpdateRuleSet}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 规则编辑对话框 */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRule ? '编辑规则' : '添加规则'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>规则代码</Label>
                <Input
                  value={ruleForm.rule_code}
                  onChange={e => setRuleForm({ ...ruleForm, rule_code: e.target.value })}
                  placeholder="如 SEC001"
                />
              </div>
              <div>
                <Label>规则名称</Label>
                <Input
                  value={ruleForm.name}
                  onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="规则名称"
                />
              </div>
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={ruleForm.description}
                onChange={e => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="规则描述"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>类别</Label>
                <Select value={ruleForm.category} onValueChange={v => setRuleForm({ ...ruleForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>严重程度</Label>
                <Select value={ruleForm.severity} onValueChange={v => setRuleForm({ ...ruleForm, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>自定义检测提示词</Label>
              <Textarea
                value={ruleForm.custom_prompt}
                onChange={e => setRuleForm({ ...ruleForm, custom_prompt: e.target.value })}
                placeholder="用于增强LLM检测的自定义提示词"
                rows={3}
              />
            </div>
            <div>
              <Label>修复建议</Label>
              <Textarea
                value={ruleForm.fix_suggestion}
                onChange={e => setRuleForm({ ...ruleForm, fix_suggestion: e.target.value })}
                placeholder="修复建议模板"
                rows={2}
              />
            </div>
            <div>
              <Label>参考链接</Label>
              <Input
                value={ruleForm.reference_url}
                onChange={e => setRuleForm({ ...ruleForm, reference_url: e.target.value })}
                placeholder="如 https://owasp.org/..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>取消</Button>
            <Button onClick={selectedRule ? handleUpdateRule : handleAddRule}>
              {selectedRule ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>导入规则集</DialogTitle>
            <DialogDescription>粘贴导出的 JSON 内容</DialogDescription>
          </DialogHeader>
          <Textarea
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
            placeholder='{"name": "...", "rules": [...]}'
            rows={15}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>取消</Button>
            <Button onClick={handleImport}>导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
