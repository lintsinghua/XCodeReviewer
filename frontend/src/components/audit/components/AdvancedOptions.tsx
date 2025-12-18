import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import type { CreateAuditTaskForm } from "@/shared/types";

interface AdvancedOptionsProps {
  scanConfig: CreateAuditTaskForm["scan_config"];
  onUpdate: (updates: Partial<CreateAuditTaskForm["scan_config"]>) => void;
  onOpenFileSelection: () => void;
}

export default function AdvancedOptions({
  scanConfig,
  onUpdate,
  onOpenFileSelection,
}: AdvancedOptionsProps) {
  const hasSelectedFiles =
    scanConfig.file_paths && scanConfig.file_paths.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-bold uppercase">扫描配置</Label>
        <p className="text-sm text-muted-foreground mt-1 font-bold">
          配置代码扫描的详细参数
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 左侧：复选框选项 */}
        <div className="space-y-4">
          <CheckboxOption
            checked={scanConfig.include_tests}
            onChange={(checked) => onUpdate({ include_tests: checked })}
            label="包含测试文件"
            description="扫描 *test*, *spec* 等测试文件"
          />
          <CheckboxOption
            checked={scanConfig.include_docs}
            onChange={(checked) => onUpdate({ include_docs: checked })}
            label="包含文档文件"
            description="扫描 README, docs 等文档文件"
          />
        </div>

        {/* 右侧：输入选项 */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="max_file_size" className="font-bold uppercase">
              最大文件大小 (KB)
            </Label>
            <Input
              id="max_file_size"
              type="number"
              value={scanConfig.max_file_size}
              onChange={(e) =>
                onUpdate({ max_file_size: parseInt(e.target.value) || 200 })
              }
              min="1"
              max="10240"
              className="retro-input h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="analysis_depth" className="font-bold uppercase">
              分析深度
            </Label>
            <Select
              value={scanConfig.analysis_depth}
              onValueChange={(value: "basic" | "standard" | "deep") =>
                onUpdate({ analysis_depth: value })
              }
            >
              <SelectTrigger
                id="analysis_depth"
                className="retro-input h-10 rounded-none border-2 border-border shadow-none focus:ring-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <SelectItem value="basic" className="font-mono">
                  基础 (快速)
                </SelectItem>
                <SelectItem value="standard" className="font-mono">
                  标准 (推荐)
                </SelectItem>
                <SelectItem value="deep" className="font-mono">
                  深度 (全面)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 分析范围 */}
      <div className="space-y-2 border-t-2 border-dashed border-border pt-4">
        <Label className="font-bold uppercase">分析范围</Label>
        <div className="flex items-center justify-between p-3 border-2 border-border bg-background">
          <div>
            <p className="text-sm font-bold uppercase">
              {hasSelectedFiles
                ? `已选择 ${scanConfig.file_paths!.length} 个文件`
                : "全量扫描 (所有文件)"}
            </p>
            <p className="text-xs text-muted-foreground font-bold">
              {hasSelectedFiles
                ? "仅分析选中的文件"
                : "分析项目中的所有代码文件"}
            </p>
          </div>
          <div className="flex space-x-2">
            {hasSelectedFiles && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onUpdate({ file_paths: undefined })}
                className="retro-btn bg-background text-red-600 hover:bg-red-50 h-8"
              >
                重置
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenFileSelection}
              className="retro-btn bg-background text-foreground hover:bg-background h-8"
            >
              {hasSelectedFiles ? "修改选择" : "选择文件"}
            </Button>
          </div>
        </div>
      </div>

      {/* 分析深度说明 */}
      <DepthExplanation />
    </div>
  );
}

function CheckboxOption({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center space-x-3 p-3 border-2 border-border bg-background">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(!!c)}
        className="rounded-none border-2 border-border data-[state=checked]:bg-primary data-[state=checked]:text-foreground"
      />
      <div>
        <p className="text-sm font-bold uppercase">{label}</p>
        <p className="text-xs text-muted-foreground font-bold">{description}</p>
      </div>
    </div>
  );
}

function DepthExplanation() {
  return (
    <div className="bg-amber-50 border-2 border-border p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
        <div className="text-sm font-mono">
          <p className="font-bold text-amber-900 mb-2 uppercase">
            分析深度说明：
          </p>
          <ul className="text-amber-800 space-y-1 text-xs font-bold">
            <li>
              • <strong>基础扫描</strong>：快速检查语法错误和基本问题
            </li>
            <li>
              • <strong>标准扫描</strong>：包含代码质量、安全性和性能分析
            </li>
            <li>
              • <strong>深度扫描</strong>
              ：全面分析，包含复杂度、可维护性等高级指标
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
