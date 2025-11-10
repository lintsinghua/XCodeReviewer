import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Power,
  PowerOff,
  Save,
  X,
  Settings
} from "lucide-react";
import { api } from "@/shared/services/unified-api";
import { toast } from "sonner";

interface Prompt {
  id: number;
  category: string;
  subcategory?: string;
  name: string;
  description?: string;
  content: string;
  is_active: boolean;
  is_system: boolean;
  order_index: number;
  subcategory_mapping?: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
}

interface PromptForm {
  category: string;
  subcategory?: string;
  name: string;
  description?: string;
  content: string;
  is_active: boolean;
  order_index: number;
}

export default function Prompts() {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null);
  
  const [formData, setFormData] = useState<PromptForm>({
    category: "",
    subcategory: "",
    name: "",
    description: "",
    content: "",
    is_active: true,
    order_index: 0,
  });

  useEffect(() => {
    loadPrompts();
    loadCategories();
  }, []);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await api.prompts.list({
        page: 1,
        page_size: 1000,
      });
      setPrompts(response.items);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      toast.error("加载提示词失败");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.prompts.getCategories();
      setCategories(response.categories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleCreatePrompt = async () => {
    if (!formData.name.trim() || !formData.category.trim() || !formData.content.trim()) {
      toast.error("请填写必填字段");
      return;
    }

    try {
      await api.prompts.create(formData);
      toast.success("提示词创建成功");
      setShowCreateDialog(false);
      resetForm();
      loadPrompts();
      loadCategories();
    } catch (error) {
      console.error('Failed to create prompt:', error);
      toast.error("创建提示词失败");
    }
  };

  const handleUpdatePrompt = async () => {
    if (!selectedPrompt) return;
    
    if (!formData.name.trim() || !formData.category.trim() || !formData.content.trim()) {
      toast.error("请填写必填字段");
      return;
    }

    try {
      await api.prompts.update(selectedPrompt.id, formData);
      toast.success("提示词更新成功");
      setShowEditDialog(false);
      setSelectedPrompt(null);
      resetForm();
      loadPrompts();
      loadCategories();
    } catch (error) {
      console.error('Failed to update prompt:', error);
      toast.error("更新提示词失败");
    }
  };

  const handleDeletePrompt = async () => {
    if (!promptToDelete) return;

    try {
      await api.prompts.delete(promptToDelete.id);
      toast.success("提示词删除成功");
      setShowDeleteDialog(false);
      setPromptToDelete(null);
      loadPrompts();
      loadCategories();
    } catch (error: any) {
      console.error('Failed to delete prompt:', error);
      const errorMessage = error?.response?.data?.detail || "删除提示词失败";
      toast.error(errorMessage);
    }
  };

  const handleToggleActive = async (prompt: Prompt) => {
    try {
      await api.prompts.update(prompt.id, {
        is_active: !prompt.is_active
      });
      toast.success(`提示词已${!prompt.is_active ? '启用' : '禁用'}`);
      loadPrompts();
    } catch (error) {
      console.error('Failed to toggle prompt active status:', error);
      toast.error("更新状态失败");
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.prompts.export(categoryFilter === "all" ? undefined : categoryFilter);
      const dataStr = JSON.stringify(response.prompts, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prompts_${categoryFilter}_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    } catch (error) {
      console.error('Failed to export prompts:', error);
      toast.error("导出失败");
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        toast.error("无效的导入文件格式");
        return;
      }

      await api.prompts.bulkImport({
        prompts: data,
        overwrite: false
      });
      
      toast.success("导入成功");
      loadPrompts();
      loadCategories();
    } catch (error) {
      console.error('Failed to import prompts:', error);
      toast.error("导入失败");
    }
    
    // Reset input
    event.target.value = '';
  };

  const openEditDialog = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setFormData({
      category: prompt.category,
      subcategory: prompt.subcategory || "",
      name: prompt.name,
      description: prompt.description || "",
      content: prompt.content,
      is_active: prompt.is_active,
      order_index: prompt.order_index,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (prompt: Prompt) => {
    setPromptToDelete(prompt);
    setShowDeleteDialog(true);
  };

  const resetForm = () => {
    setFormData({
      category: "",
      subcategory: "",
      name: "",
      description: "",
      content: "",
      is_active: true,
      order_index: 0,
    });
  };

  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = 
      prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prompt.content.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || prompt.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const groupedPrompts = filteredPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = [];
    }
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, Prompt[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">提示词管理</h1>
          <p className="text-gray-600 mt-1">管理代码审查提示词配置</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate('/system-prompt-templates')}
          >
            <Settings className="w-4 h-4 mr-2" />
            系统提示词模版
          </Button>
          <input
            type="file"
            id="import-file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById('import-file')?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            导入
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建提示词
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="搜索提示词..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Prompts List */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-gray-500">加载中...</div>
          </CardContent>
        </Card>
      ) : filteredPrompts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">暂无提示词</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{category}</span>
                  <Badge variant="secondary">{categoryPrompts.length} 个提示词</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryPrompts.map(prompt => (
                    <div
                      key={prompt.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900">{prompt.name}</h3>
                            {prompt.subcategory && (
                              <Badge variant="outline" className="text-xs">
                                {prompt.subcategory}
                              </Badge>
                            )}
                            {prompt.is_system && (
                              <Badge variant="secondary" className="text-xs">
                                系统
                              </Badge>
                            )}
                            {prompt.is_active ? (
                              <Badge variant="default" className="text-xs bg-green-500">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                启用
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <PowerOff className="w-3 h-3 mr-1" />
                                禁用
                              </Badge>
                            )}
                          </div>
                          {prompt.description && (
                            <p className="text-sm text-gray-600 mb-2">{prompt.description}</p>
                          )}
                          <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded font-mono whitespace-pre-wrap line-clamp-3">
                            {prompt.content}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(prompt)}
                            title={prompt.is_active ? "禁用" : "启用"}
                          >
                            {prompt.is_active ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(prompt)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(prompt)}
                            disabled={prompt.is_system}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建提示词</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>分类 *</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="例如: DESIGN, FUNCTIONALITY"
                />
              </div>
              <div>
                <Label>子分类</Label>
                <Input
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  placeholder="例如: DESIGN_SRP"
                />
              </div>
            </div>
            <div>
              <Label>名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="提示词名称"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="提示词描述"
                rows={2}
              />
            </div>
            <div>
              <Label>提示词内容 *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="输入提示词内容..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 系统提示词模版现在统一在 <button 
                  onClick={() => navigate('/system-prompt-templates')}
                  className="text-blue-600 hover:underline"
                >系统提示词模版页面</button> 中管理
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>排序索引</Label>
                <Input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active_create"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active_create" className="cursor-pointer">启用此提示词</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetForm();
            }}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleCreatePrompt}>
              <Save className="w-4 h-4 mr-2" />
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑提示词</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>分类 *</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="例如: DESIGN, FUNCTIONALITY"
                />
              </div>
              <div>
                <Label>子分类</Label>
                <Input
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  placeholder="例如: DESIGN_SRP"
                />
              </div>
            </div>
            <div>
              <Label>名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="提示词名称"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="提示词描述"
                rows={2}
              />
            </div>
            <div>
              <Label>提示词内容 *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="输入提示词内容..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 系统提示词模版现在统一在 <button 
                  onClick={() => navigate('/system-prompt-templates')}
                  className="text-blue-600 hover:underline"
                >系统提示词模版页面</button> 中管理
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>排序索引</Label>
                <Input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active_edit"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active_edit" className="cursor-pointer">启用此提示词</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setSelectedPrompt(null);
              resetForm();
            }}>
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
            <Button onClick={handleUpdatePrompt}>
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除提示词 "{promptToDelete?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPromptToDelete(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePrompt} className="bg-red-500 hover:bg-red-600">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


