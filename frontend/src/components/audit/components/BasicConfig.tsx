import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitBranch, Zap, Info } from "lucide-react";
import type { Project, CreateAuditTaskForm } from "@/shared/types";
import { isRepositoryProject, isZipProject, getRepositoryPlatformLabel } from "@/shared/utils/projectUtils";
import ZipFileSection from "./ZipFileSection";
import type { ZipFileMeta } from "@/shared/utils/zipStorage";

interface BasicConfigProps {
  project: Project;
  taskForm: CreateAuditTaskForm;
  onUpdateForm: (updates: Partial<CreateAuditTaskForm>) => void;
  // ZIP 相关
  zipLoading: boolean;
  storedZipInfo: ZipFileMeta | null;
  useStoredZip: boolean;
  zipFile: File | null;
  onSwitchToStored: () => void;
  onSwitchToUpload: () => void;
  onFileSelect: (file: File | null, input?: HTMLInputElement) => void;
}

export default function BasicConfig({
  project,
  taskForm,
  onUpdateForm,
  zipLoading,
  storedZipInfo,
  useStoredZip,
  zipFile,
  onSwitchToStored,
  onSwitchToUpload,
  onFileSelect,
}: BasicConfigProps) {
  const isRepo = isRepositoryProject(project);
  const isZip = isZipProject(project);

  return (
    <div className="space-y-4 mt-6 font-mono">
      {/* ZIP 项目文件上传 */}
      {isZip && (
        <ZipFileSection
          loading={zipLoading}
          storedZipInfo={storedZipInfo}
          useStoredZip={useStoredZip}
          zipFile={zipFile}
          onSwitchToStored={onSwitchToStored}
          onSwitchToUpload={onSwitchToUpload}
          onFileSelect={onFileSelect}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* 任务类型 */}
        <div className="space-y-2">
          <Label htmlFor="task_type" className="font-bold uppercase">
            任务类型
          </Label>
          <Select
            value={taskForm.task_type}
            onValueChange={(value: "repository" | "instant") =>
              onUpdateForm({ task_type: value })
            }
          >
            <SelectTrigger className="retro-input h-10 rounded-none border-2 border-black shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <SelectItem value="repository">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4" />
                  <span className="font-mono">仓库审计</span>
                </div>
              </SelectItem>
              <SelectItem value="instant">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span className="font-mono">即时分析</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 分支选择 - 仅仓库类型项目显示 */}
        {taskForm.task_type === "repository" && isRepo && (
          <div className="space-y-2">
            <Label htmlFor="branch_name" className="font-bold uppercase">
              目标分支
            </Label>
            <Input
              id="branch_name"
              value={taskForm.branch_name || ""}
              onChange={(e) => onUpdateForm({ branch_name: e.target.value })}
              placeholder={project.default_branch || "main"}
              className="retro-input h-10"
            />
          </div>
        )}
      </div>

      {/* 项目信息展示 */}
      <ProjectInfoCard project={project} />
    </div>
  );
}

function ProjectInfoCard({ project }: { project: Project }) {
  const isRepo = isRepositoryProject(project);
  let languages: string[] = [];

  try {
    if (project.programming_languages) {
      languages = JSON.parse(project.programming_languages);
    }
  } catch {
    // ignore
  }

  return (
    <div className="bg-blue-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-start space-x-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm font-mono">
          <p className="font-bold text-blue-900 mb-1 uppercase">
            选中项目：{project.name}
          </p>
          <div className="text-blue-800 space-y-1 font-bold">
            <p>项目类型：{isRepo ? "远程仓库" : "ZIP上传"}</p>
            {project.description && <p>描述：{project.description}</p>}
            {isRepo && (
              <>
                <p>
                  仓库平台：{getRepositoryPlatformLabel(project.repository_type)}
                </p>
                <p>默认分支：{project.default_branch}</p>
              </>
            )}
            {languages.length > 0 && <p>编程语言：{languages.join(", ")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
