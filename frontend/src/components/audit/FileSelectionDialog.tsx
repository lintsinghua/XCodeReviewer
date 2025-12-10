import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, CheckSquare, Square, FolderOpen } from "lucide-react";
import { api } from "@/shared/config/database";
import { toast } from "sonner";

interface FileSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    branch?: string;
    excludePatterns?: string[];
    onConfirm: (selectedFiles: string[]) => void;
}

interface FileNode {
    path: string;
    size: number;
}

export default function FileSelectionDialog({ open, onOpenChange, projectId, branch, excludePatterns, onConfirm }: FileSelectionDialogProps) {
    const [files, setFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (open && projectId) {
            loadFiles();
        } else {
            // Reset state when closed
            setFiles([]);
            setSelectedFiles(new Set());
            setSearchTerm("");
        }
    }, [open, projectId, branch, excludePatterns]);

    const loadFiles = async () => {
        try {
            setLoading(true);
            // 传入排除模式，让后端过滤文件
            const data = await api.getProjectFiles(projectId, branch, excludePatterns);
            setFiles(data);
            setSelectedFiles(new Set(data.map(f => f.path)));
        } catch (error) {
            console.error("Failed to load files:", error);
            toast.error("加载文件列表失败");
        } finally {
            setLoading(false);
        }
    };

    const filteredFiles = useMemo(() => {
        if (!searchTerm) return files;
        return files.filter(f => f.path.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [files, searchTerm]);

    const handleToggleFile = (path: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(path)) {
            newSelected.delete(path);
        } else {
            newSelected.add(path);
        }
        setSelectedFiles(newSelected);
    };

    const handleSelectAll = () => {
        const newSelected = new Set(selectedFiles);
        filteredFiles.forEach(f => newSelected.add(f.path));
        setSelectedFiles(newSelected);
    };

    const handleDeselectAll = () => {
        const newSelected = new Set(selectedFiles);
        filteredFiles.forEach(f => newSelected.delete(f.path));
        setSelectedFiles(newSelected);
    };

    const handleConfirm = () => {
        if (selectedFiles.size === 0) {
            toast.error("请至少选择一个文件");
            return;
        }
        onConfirm(Array.from(selectedFiles));
        onOpenChange(false);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-white border-2 border-black p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none">
                <DialogHeader className="p-6 border-b-2 border-black bg-gray-50 flex-shrink-0">
                    <DialogTitle className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-display font-bold uppercase text-xl">
                            <FolderOpen className="w-6 h-6 text-black" />
                            <span>选择要审计的文件</span>
                        </div>
                        {excludePatterns && excludePatterns.length > 0 && (
                            <Badge variant="outline" className="rounded-none border-gray-400 text-gray-600 font-mono text-xs">
                                已排除 {excludePatterns.length} 种模式
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 flex-1 flex flex-col min-h-0 space-y-4">
                    <div className="flex items-center space-x-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <Input
                                placeholder="搜索文件..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 retro-input h-10"
                            />
                        </div>
                        <Button variant="outline" onClick={handleSelectAll} className="retro-btn bg-white text-black h-10 px-3">
                            <CheckSquare className="w-4 h-4 mr-2" />
                            全选
                        </Button>
                        <Button variant="outline" onClick={handleDeselectAll} className="retro-btn bg-white text-black h-10 px-3">
                            <Square className="w-4 h-4 mr-2" />
                            清空
                        </Button>
                    </div>

                    <div className="flex items-center justify-between text-sm font-mono font-bold text-gray-600">
                        <span>共 {files.length} 个文件</span>
                        <span>已选择 {selectedFiles.size} 个</span>
                    </div>

                    <div className="border-2 border-black bg-gray-50 relative overflow-hidden" style={{ height: '300px' }}>
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin rounded-none h-8 w-8 border-4 border-primary border-t-transparent"></div>
                            </div>
                        ) : filteredFiles.length > 0 ? (
                            <ScrollArea className="h-full w-full p-2">
                                <div className="space-y-1">
                                    {filteredFiles.map((file) => (
                                        <div
                                            key={file.path}
                                            className="flex items-center space-x-3 p-2 hover:bg-white border border-transparent hover:border-gray-200 cursor-pointer transition-colors"
                                            onClick={() => handleToggleFile(file.path)}
                                        >
                                            <Checkbox
                                                checked={selectedFiles.has(file.path)}
                                                onCheckedChange={() => handleToggleFile(file.path)}
                                                className="rounded-none border-2 border-black data-[state=checked]:bg-primary data-[state=checked]:text-white"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-mono truncate" title={file.path}>
                                                    {file.path}
                                                </p>
                                            </div>
                                            {file.size > 0 && (
                                                <Badge variant="outline" className="text-xs font-mono rounded-none border-gray-400 text-gray-500">
                                                    {formatSize(file.size)}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                <FileText className="w-12 h-12 mb-2 opacity-20" />
                                <p className="font-mono text-sm">没有找到文件</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-6 border-t-2 border-black bg-gray-50 flex-shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="retro-btn bg-white text-black hover:bg-gray-100 mr-2">
                        取消
                    </Button>
                    <Button onClick={handleConfirm} className="retro-btn bg-primary text-white hover:bg-primary/90">
                        <FileText className="w-4 h-4 mr-2" />
                        开始审计 ({selectedFiles.size})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
