/**
 * File Selection Dialog
 * Cyberpunk Terminal Aesthetic
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    FileText,
    CheckSquare,
    Square,
    FolderOpen,
    Folder,
    ChevronRight,
    ChevronDown,
    FileCode,
    FileJson,
    File,
    Filter,
    RotateCcw,
    RefreshCw,
    Terminal,
} from "lucide-react";
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

interface FolderNode {
    name: string;
    path: string;
    files: FileNode[];
    subfolders: Map<string, FolderNode>;
    expanded: boolean;
}

// 文件类型图标映射
const getFileIcon = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const codeExts = [
        "js", "ts", "tsx", "jsx", "py", "java", "go", "rs", "cpp", "c", "h",
        "cs", "php", "rb", "swift", "kt", "sh",
    ];
    const configExts = ["json", "yml", "yaml", "toml", "xml", "ini"];

    if (codeExts.includes(ext)) {
        return <FileCode className="w-4 h-4 text-sky-400" />;
    }
    if (configExts.includes(ext)) {
        return <FileJson className="w-4 h-4 text-amber-400" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
};

// 获取文件扩展名
const getExtension = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    return ext;
};

// 构建文件夹树结构
const buildFolderTree = (files: FileNode[]): FolderNode => {
    const root: FolderNode = {
        name: "",
        path: "",
        files: [],
        subfolders: new Map(),
        expanded: true,
    };

    files.forEach((file) => {
        const parts = file.path.split("/");
        let current = root;

        // 遍历路径的每个部分（除了文件名）
        for (let i = 0; i < parts.length - 1; i++) {
            const folderName = parts[i];
            const folderPath = parts.slice(0, i + 1).join("/");

            if (!current.subfolders.has(folderName)) {
                current.subfolders.set(folderName, {
                    name: folderName,
                    path: folderPath,
                    files: [],
                    subfolders: new Map(),
                    expanded: true,
                });
            }
            current = current.subfolders.get(folderName)!;
        }

        // 添加文件到当前文件夹
        current.files.push(file);
    });

    return root;
};

export default function FileSelectionDialog({
    open,
    onOpenChange,
    projectId,
    branch,
    excludePatterns,
    onConfirm,
}: FileSelectionDialogProps) {
    const [files, setFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<"tree" | "flat">("tree");
    const [filterType, setFilterType] = useState<string>("");

    useEffect(() => {
        if (open && projectId) {
            loadFiles();
        } else {
            setFiles([]);
            setSelectedFiles(new Set());
            setSearchTerm("");
            setExpandedFolders(new Set());
            setFilterType("");
        }
    }, [open, projectId, branch, excludePatterns]);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const data = await api.getProjectFiles(projectId, branch, excludePatterns);
            setFiles(data);
            setSelectedFiles(new Set(data.map((f) => f.path)));
            // 默认展开所有文件夹
            const folders = new Set<string>();
            data.forEach((f) => {
                const parts = f.path.split("/");
                for (let i = 1; i < parts.length; i++) {
                    folders.add(parts.slice(0, i).join("/"));
                }
            });
            setExpandedFolders(folders);
        } catch (error) {
            console.error("Failed to load files:", error);
            toast.error("加载文件列表失败");
        } finally {
            setLoading(false);
        }
    };

    // 获取所有文件类型
    const fileTypes = useMemo(() => {
        const types = new Map<string, number>();
        files.forEach((f) => {
            const ext = getExtension(f.path);
            if (ext) {
                types.set(ext, (types.get(ext) || 0) + 1);
            }
        });
        return Array.from(types.entries()).sort((a, b) => b[1] - a[1]);
    }, [files]);

    // 过滤后的文件
    const filteredFiles = useMemo(() => {
        let result = files;

        // 按搜索词过滤
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter((f) => f.path.toLowerCase().includes(term));
        }

        // 按文件类型过滤
        if (filterType) {
            result = result.filter((f) => getExtension(f.path) === filterType);
        }

        return result;
    }, [files, searchTerm, filterType]);

    // 构建文件夹树
    const folderTree = useMemo(() => buildFolderTree(filteredFiles), [filteredFiles]);

    const handleToggleFile = useCallback((path: string) => {
        setSelectedFiles((prev) => {
            const newSelected = new Set(prev);
            if (newSelected.has(path)) {
                newSelected.delete(path);
            } else {
                newSelected.add(path);
            }
            return newSelected;
        });
    }, []);

    const handleToggleFolder = useCallback(
        (folderPath: string) => {
            // 获取该文件夹下的所有文件
            const folderFiles = filteredFiles.filter(
                (f) => f.path.startsWith(folderPath + "/") || f.path === folderPath
            );

            setSelectedFiles((prev) => {
                const newSelected = new Set(prev);
                const allSelected = folderFiles.every((f) => newSelected.has(f.path));

                if (allSelected) {
                    // 取消选择该文件夹下的所有文件
                    folderFiles.forEach((f) => newSelected.delete(f.path));
                } else {
                    // 选择该文件夹下的所有文件
                    folderFiles.forEach((f) => newSelected.add(f.path));
                }
                return newSelected;
            });
        },
        [filteredFiles]
    );

    const handleExpandFolder = useCallback((folderPath: string) => {
        setExpandedFolders((prev) => {
            const newExpanded = new Set(prev);
            if (newExpanded.has(folderPath)) {
                newExpanded.delete(folderPath);
            } else {
                newExpanded.add(folderPath);
            }
            return newExpanded;
        });
    }, []);

    const handleSelectAll = () => {
        setSelectedFiles(new Set(filteredFiles.map((f) => f.path)));
    };

    const handleDeselectAll = () => {
        const filteredPaths = new Set(filteredFiles.map((f) => f.path));
        setSelectedFiles((prev) => {
            const newSelected = new Set(prev);
            filteredPaths.forEach((p) => newSelected.delete(p));
            return newSelected;
        });
    };

    const handleInvertSelection = () => {
        const filteredPaths = new Set(filteredFiles.map((f) => f.path));
        setSelectedFiles((prev) => {
            const newSelected = new Set(prev);
            filteredPaths.forEach((p) => {
                if (newSelected.has(p)) {
                    newSelected.delete(p);
                } else {
                    newSelected.add(p);
                }
            });
            return newSelected;
        });
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

    // 检查文件夹的选中状态
    const getFolderSelectionState = (
        folderPath: string
    ): "all" | "some" | "none" => {
        const folderFiles = filteredFiles.filter((f) =>
            f.path.startsWith(folderPath + "/")
        );
        if (folderFiles.length === 0) return "none";

        const selectedCount = folderFiles.filter((f) =>
            selectedFiles.has(f.path)
        ).length;
        if (selectedCount === 0) return "none";
        if (selectedCount === folderFiles.length) return "all";
        return "some";
    };

    // 渲染文件夹树
    const renderFolderTree = (node: FolderNode, depth: number = 0) => {
        const items: React.ReactNode[] = [];

        // 渲染子文件夹
        Array.from(node.subfolders.values())
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((folder) => {
                const isExpanded = expandedFolders.has(folder.path);
                const selectionState = getFolderSelectionState(folder.path);

                items.push(
                    <div key={`folder-${folder.path}`}>
                        <div
                            className="flex items-center space-x-2 p-2 hover:bg-gray-800/50 border border-transparent hover:border-gray-700 cursor-pointer transition-colors rounded"
                            style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleExpandFolder(folder.path);
                                }}
                                className="p-0.5 hover:bg-gray-700 rounded"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                            </button>
                            <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={selectionState === "all"}
                                    ref={(el) => {
                                        if (el) {
                                            (el as HTMLButtonElement).dataset.state =
                                                selectionState === "some" ? "indeterminate" : selectionState === "all" ? "checked" : "unchecked";
                                        }
                                    }}
                                    onCheckedChange={() => handleToggleFolder(folder.path)}
                                    className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-gray-500"
                                />
                            </div>
                            {isExpanded ? (
                                <FolderOpen className="w-4 h-4 text-amber-400" />
                            ) : (
                                <Folder className="w-4 h-4 text-amber-400" />
                            )}
                            <span
                                className="text-sm font-mono font-medium flex-1 text-gray-300"
                                onClick={() => handleExpandFolder(folder.path)}
                            >
                                {folder.name}
                            </span>
                            <Badge className="cyber-badge-muted font-mono text-[10px]">
                                {
                                    filteredFiles.filter((f) =>
                                        f.path.startsWith(folder.path + "/")
                                    ).length
                                }
                            </Badge>
                        </div>
                        {isExpanded && renderFolderTree(folder, depth + 1)}
                    </div>
                );
            });

        // 渲染文件
        node.files
            .sort((a, b) => a.path.localeCompare(b.path))
            .forEach((file) => {
                const fileName = file.path.split("/").pop() || file.path;
                items.push(
                    <div
                        key={`file-${file.path}`}
                        className="flex items-center space-x-3 p-2 hover:bg-gray-800/50 border border-transparent hover:border-gray-700 cursor-pointer transition-colors rounded"
                        style={{ paddingLeft: `${depth * 16 + 32}px` }}
                        onClick={() => handleToggleFile(file.path)}
                    >
                        <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                                checked={selectedFiles.has(file.path)}
                                onCheckedChange={() => handleToggleFile(file.path)}
                                className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                        </div>
                        {getFileIcon(file.path)}
                        <span
                            className="text-sm font-mono flex-1 min-w-0 truncate text-gray-300"
                            title={file.path}
                        >
                            {fileName}
                        </span>
                        {file.size > 0 && (
                            <Badge className="cyber-badge-muted font-mono text-[10px] flex-shrink-0">
                                {formatSize(file.size)}
                            </Badge>
                        )}
                    </div>
                );
            });

        return items;
    };

    // 渲染扁平列表
    const renderFlatList = () => {
        return filteredFiles.map((file) => (
            <div
                key={file.path}
                className="flex items-center space-x-3 p-2 hover:bg-gray-800/50 border border-transparent hover:border-gray-700 cursor-pointer transition-colors rounded"
                onClick={() => handleToggleFile(file.path)}
            >
                <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={selectedFiles.has(file.path)}
                        onCheckedChange={() => handleToggleFile(file.path)}
                        className="border-gray-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                </div>
                {getFileIcon(file.path)}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate text-gray-300" title={file.path}>
                        {file.path}
                    </p>
                </div>
                {file.size > 0 && (
                    <Badge className="cyber-badge-muted font-mono text-[10px] flex-shrink-0">
                        {formatSize(file.size)}
                    </Badge>
                )}
            </div>
        ));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="!max-w-[1000px] !w-[95vw] max-h-[85vh] flex flex-col cyber-card p-0 bg-[#0c0c12] !fixed">
                <DialogHeader className="cyber-card-header flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <FolderOpen className="w-5 h-5 text-primary" />
                        <DialogTitle className="text-lg font-bold uppercase tracking-wider text-white">
                            选择要审计的文件
                        </DialogTitle>
                    </div>
                    {excludePatterns && excludePatterns.length > 0 && (
                        <Badge className="cyber-badge-muted font-mono text-xs ml-auto">
                            已排除 {excludePatterns.length} 种模式
                        </Badge>
                    )}
                </DialogHeader>

                <div className="p-5 flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto">
                    {/* 工具栏 */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* 搜索框 */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <Input
                                placeholder="搜索文件..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="!pl-10 h-9 cyber-input"
                            />
                        </div>

                        {/* 文件类型筛选 */}
                        {fileTypes.length > 0 && (
                            <div className="flex items-center gap-1">
                                <Filter className="w-4 h-4 text-gray-500" />
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="h-9 px-2 cyber-input font-mono text-sm bg-[#0a0a0f]"
                                >
                                    <option value="">全部类型</option>
                                    {fileTypes.slice(0, 10).map(([ext, count]) => (
                                        <option key={ext} value={ext}>
                                            .{ext} ({count})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* 视图切换 */}
                        <div className="flex border border-gray-700 rounded overflow-hidden">
                            <button
                                onClick={() => setViewMode("tree")}
                                className={`px-3 py-1.5 text-xs font-mono uppercase ${viewMode === "tree" ? "bg-primary text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                            >
                                树形
                            </button>
                            <button
                                onClick={() => setViewMode("flat")}
                                className={`px-3 py-1.5 text-xs font-mono uppercase border-l border-gray-700 ${viewMode === "flat" ? "bg-primary text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                            >
                                列表
                            </button>
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                                className="h-8 px-3 cyber-btn-outline font-mono text-xs"
                            >
                                <CheckSquare className="w-3 h-3 mr-1" />
                                全选
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeselectAll}
                                className="h-8 px-3 cyber-btn-outline font-mono text-xs"
                            >
                                <Square className="w-3 h-3 mr-1" />
                                清空
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleInvertSelection}
                                className="h-8 px-3 cyber-btn-outline font-mono text-xs"
                            >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                反选
                            </Button>
                            {(searchTerm || filterType) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchTerm("");
                                        setFilterType("");
                                    }}
                                    className="h-8 px-3 cyber-btn-outline font-mono text-xs text-gray-400"
                                >
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                    重置筛选
                                </Button>
                            )}
                        </div>
                        <div className="text-sm font-mono text-gray-500">
                            {searchTerm || filterType ? (
                                <span>
                                    筛选: {filteredFiles.length}/{files.length} 个文件，
                                    已选 <span className="text-primary font-bold">{selectedFiles.size}</span> 个
                                </span>
                            ) : (
                                <span>
                                    共 {files.length} 个文件，已选 <span className="text-primary font-bold">{selectedFiles.size}</span> 个
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 文件列表 */}
                    <div className="border border-gray-800 bg-[#0a0a0f] relative h-[450px] overflow-hidden rounded">
                        {loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="loading-spinner" />
                            </div>
                        ) : filteredFiles.length > 0 ? (
                            <div className="h-full overflow-auto custom-scrollbar">
                                <div className="p-2">
                                    {viewMode === "tree"
                                        ? renderFolderTree(folderTree)
                                        : renderFlatList()}
                                </div>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                <FileText className="w-12 h-12 mb-2 opacity-20" />
                                <p className="font-mono text-sm">
                                    {searchTerm || filterType
                                        ? "没有匹配的文件"
                                        : "没有找到文件"}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-5 border-t border-gray-800 bg-gray-900/50 flex-shrink-0 flex justify-between">
                    <div className="text-xs font-mono text-gray-600 flex items-center gap-2">
                        <Terminal className="w-3 h-3" />
                        提示：点击文件夹可展开/折叠，点击文件夹复选框可批量选择
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="px-4 h-10 cyber-btn-outline font-mono"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={selectedFiles.size === 0}
                            className="px-5 h-10 cyber-btn-primary font-mono font-bold uppercase"
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            确认选择 ({selectedFiles.size})
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
