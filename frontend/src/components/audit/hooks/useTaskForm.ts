import { useState, useEffect, useCallback } from "react";
import type { Project, CreateAuditTaskForm } from "@/shared/types";
import { api } from "@/shared/config/database";
import { toast } from "sonner";

const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules/**",
  ".git/**",
  "dist/**",
  "build/**",
  "*.log",
];

const DEFAULT_FORM: CreateAuditTaskForm = {
  project_id: "",
  task_type: "repository",
  branch_name: "main",
  exclude_patterns: DEFAULT_EXCLUDE_PATTERNS,
  scan_config: {
    include_tests: true,
    include_docs: false,
    max_file_size: 200,
    analysis_depth: "standard",
  },
};

export function useTaskForm(preselectedProjectId?: string) {
  const [taskForm, setTaskForm] = useState<CreateAuditTaskForm>(DEFAULT_FORM);

  // 加载默认配置
  useEffect(() => {
    api.getDefaultConfig().catch(() => {
      // 使用默认值
    });
  }, []);

  // 预选项目
  useEffect(() => {
    if (preselectedProjectId) {
      setTaskForm((prev) => ({ ...prev, project_id: preselectedProjectId }));
    }
  }, [preselectedProjectId]);

  const resetForm = useCallback(() => {
    setTaskForm(DEFAULT_FORM);
  }, []);

  const updateForm = useCallback((updates: Partial<CreateAuditTaskForm>) => {
    setTaskForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateScanConfig = useCallback(
    (updates: Partial<CreateAuditTaskForm["scan_config"]>) => {
      setTaskForm((prev) => ({
        ...prev,
        scan_config: { ...prev.scan_config, ...updates },
      }));
    },
    []
  );

  const toggleExcludePattern = useCallback((pattern: string) => {
    setTaskForm((prev) => {
      const patterns = prev.exclude_patterns || [];
      const newPatterns = patterns.includes(pattern)
        ? patterns.filter((p) => p !== pattern)
        : [...patterns, pattern];
      return { ...prev, exclude_patterns: newPatterns };
    });
  }, []);

  const addExcludePattern = useCallback((pattern: string) => {
    const trimmed = pattern.trim();
    if (!trimmed) return;

    setTaskForm((prev) => {
      if (prev.exclude_patterns.includes(trimmed)) return prev;
      return { ...prev, exclude_patterns: [...prev.exclude_patterns, trimmed] };
    });
  }, []);

  const removeExcludePattern = useCallback((pattern: string) => {
    setTaskForm((prev) => ({
      ...prev,
      exclude_patterns: prev.exclude_patterns.filter((p) => p !== pattern),
    }));
  }, []);

  const setSelectedFiles = useCallback((files: string[] | undefined) => {
    setTaskForm((prev) => ({
      ...prev,
      scan_config: { ...prev.scan_config, file_paths: files },
    }));
  }, []);

  return {
    taskForm,
    setTaskForm,
    resetForm,
    updateForm,
    updateScanConfig,
    toggleExcludePattern,
    addExcludePattern,
    removeExcludePattern,
    setSelectedFiles,
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data.filter((p) => p.is_active));
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error("加载项目失败");
    } finally {
      setLoading(false);
    }
  }, []);

  return { projects, loading, loadProjects };
}
