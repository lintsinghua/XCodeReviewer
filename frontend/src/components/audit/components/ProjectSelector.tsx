import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, FileText } from "lucide-react";
import type { Project } from "@/shared/types";
import {
  isRepositoryProject,
  getSourceTypeBadge,
} from "@/shared/utils/projectUtils";

interface ProjectSelectorProps {
  projects: Project[];
  selectedId: string;
  searchTerm: string;
  loading: boolean;
  onSelect: (id: string) => void;
  onSearchChange: (term: string) => void;
}

export default function ProjectSelector({
  projects,
  selectedId,
  searchTerm,
  loading,
  onSelect,
  onSearchChange,
}: ProjectSelectorProps) {
  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-bold font-mono uppercase">
          选择项目
        </Label>
        <Badge
          variant="outline"
          className="text-xs rounded-none border-border font-mono"
        >
          {filteredProjects.length} 个可用项目
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground w-4 h-4" />
        <Input
          placeholder="搜索项目名称..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 retro-input h-10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
        {loading ? (
          <LoadingSpinner />
        ) : filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isSelected={selectedId === project.id}
              onSelect={() => onSelect(project.id)}
            />
          ))
        ) : (
          <EmptyState hasSearch={!!searchTerm} />
        )}
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  isSelected,
  onSelect,
}: {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isRepo = isRepositoryProject(project);

  return (
    <div
      className={`cursor-pointer transition-all border-2 p-4 relative ${
        isSelected
          ? "border-primary bg-blue-50 shadow-[4px_4px_0px_0px_rgba(37,99,235,1)] translate-x-[-2px] translate-y-[-2px]"
          : "border-border bg-background hover:bg-background hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-bold text-sm font-display uppercase">
            {project.name}
          </h4>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
              {project.description}
            </p>
          )}
          <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground font-mono font-bold">
            <span
              className={`px-1.5 py-0.5 ${isRepo ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}
            >
              {getSourceTypeBadge(project.source_type)}
            </span>
            {isRepo && (
              <>
                <span className="uppercase">
                  {project.repository_type?.toUpperCase() || "OTHER"}
                </span>
                <span>{project.default_branch}</span>
              </>
            )}
          </div>
        </div>
        {isSelected && (
          <div className="w-5 h-5 bg-primary border-2 border-border flex items-center justify-center">
            <div className="w-2 h-2 bg-background" />
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="col-span-2 flex items-center justify-center py-8">
      <div className="animate-spin rounded-none h-8 w-8 border-4 border-primary border-t-transparent" />
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="col-span-2 text-center py-8 text-muted-foreground font-mono">
      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">
        {hasSearch ? "未找到匹配的项目" : "暂无可用项目"}
      </p>
    </div>
  );
}
