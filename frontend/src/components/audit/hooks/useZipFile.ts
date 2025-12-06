import { useState, useEffect, useCallback } from "react";
import type { Project } from "@/shared/types";
import { getZipFileInfo, type ZipFileMeta } from "@/shared/utils/zipStorage";
import { validateZipFile } from "@/features/projects/services/repoZipScan";
import { isZipProject } from "@/shared/utils/projectUtils";
import { toast } from "sonner";

export function useZipFile(project: Project | undefined, projects: Project[]) {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [storedZipInfo, setStoredZipInfo] = useState<ZipFileMeta | null>(null);
  const [useStoredZip, setUseStoredZip] = useState(true);

  // 检查已存储的 ZIP 文件
  useEffect(() => {
    const checkStoredZip = async () => {
      if (!project || !isZipProject(project)) {
        setStoredZipInfo(null);
        return;
      }

      try {
        setLoading(true);
        const zipInfo = await getZipFileInfo(project.id);
        setStoredZipInfo(zipInfo);
        setUseStoredZip(zipInfo.has_file);
      } catch (error) {
        console.error("检查ZIP文件失败:", error);
        setStoredZipInfo(null);
      } finally {
        setLoading(false);
      }
    };

    checkStoredZip();
  }, [project?.id, projects]);

  const handleFileSelect = useCallback(
    (file: File | null, inputElement?: HTMLInputElement) => {
      if (!file) {
        setZipFile(null);
        return;
      }

      const validation = validateZipFile(file);
      if (!validation.valid) {
        toast.error(validation.error || "文件无效");
        if (inputElement) inputElement.value = "";
        return;
      }

      setZipFile(file);
      const sizeText = formatFileSize(file.size);
      toast.success(`已选择文件: ${file.name} (${sizeText})`);
    },
    []
  );

  const reset = useCallback(() => {
    setZipFile(null);
    setStoredZipInfo(null);
    setUseStoredZip(true);
  }, []);

  const switchToUpload = useCallback(() => {
    setUseStoredZip(false);
  }, []);

  const switchToStored = useCallback(() => {
    setUseStoredZip(true);
    setZipFile(null);
  }, []);

  return {
    zipFile,
    loading,
    storedZipInfo,
    useStoredZip,
    handleFileSelect,
    reset,
    switchToUpload,
    switchToStored,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}
