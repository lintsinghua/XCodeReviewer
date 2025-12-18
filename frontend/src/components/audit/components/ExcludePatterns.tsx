import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export const COMMON_EXCLUDE_PATTERNS = [
  {
    label: "node_modules",
    value: "node_modules/**",
    description: "Node.js 依赖包",
  },
  { label: ".git", value: ".git/**", description: "Git 版本控制文件" },
  { label: "dist/build", value: "dist/**", description: "构建输出目录" },
  { label: "logs", value: "*.log", description: "日志文件" },
  { label: "cache", value: ".cache/**", description: "缓存文件" },
  { label: "temp", value: "temp/**", description: "临时文件" },
  { label: "vendor", value: "vendor/**", description: "第三方库" },
  { label: "coverage", value: "coverage/**", description: "测试覆盖率报告" },
];

interface ExcludePatternsProps {
  patterns: string[];
  onToggle: (pattern: string) => void;
  onAdd: (pattern: string) => void;
  onRemove: (pattern: string) => void;
}

export default function ExcludePatterns({
  patterns,
  onToggle,
  onAdd,
  onRemove,
}: ExcludePatternsProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-bold uppercase">排除模式</Label>
        <p className="text-sm text-muted-foreground mt-1 font-bold">
          选择要从审计中排除的文件和目录模式
        </p>
      </div>

      {/* 常用排除模式 */}
      <div className="grid grid-cols-2 gap-3">
        {COMMON_EXCLUDE_PATTERNS.map((pattern) => (
          <div
            key={pattern.value}
            className="flex items-center space-x-3 p-3 border-2 border-border bg-background hover:bg-background transition-all"
          >
            <Checkbox
              checked={patterns.includes(pattern.value)}
              onCheckedChange={() => onToggle(pattern.value)}
              className="rounded-none border-2 border-border data-[state=checked]:bg-primary data-[state=checked]:text-foreground"
            />
            <div className="flex-1">
              <p className="text-sm font-bold uppercase">{pattern.label}</p>
              <p className="text-xs text-muted-foreground font-bold">
                {pattern.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 自定义排除模式 */}
      <CustomPatternInput onAdd={onAdd} />

      {/* 已选择的排除模式 */}
      {patterns.length > 0 && (
        <SelectedPatterns patterns={patterns} onRemove={onRemove} />
      )}
    </div>
  );
}

function CustomPatternInput({ onAdd }: { onAdd: (pattern: string) => void }) {
  const handleAdd = (input: HTMLInputElement) => {
    if (input.value.trim()) {
      onAdd(input.value);
      input.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="font-bold uppercase">自定义排除模式</Label>
      <div className="flex space-x-2">
        <Input
          placeholder="例如: *.tmp, test/**"
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              handleAdd(e.currentTarget);
            }
          }}
          className="retro-input h-10"
        />
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            const input = e.currentTarget
              .previousElementSibling as HTMLInputElement;
            handleAdd(input);
          }}
          className="retro-btn bg-background text-foreground h-10"
        >
          添加
        </Button>
      </div>
    </div>
  );
}

function SelectedPatterns({
  patterns,
  onRemove,
}: {
  patterns: string[];
  onRemove: (pattern: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="font-bold uppercase">已选择的排除模式</Label>
      <div className="flex flex-wrap gap-2">
        {patterns.map((pattern) => (
          <Badge
            key={pattern}
            variant="secondary"
            className="cursor-pointer hover:bg-red-100 hover:text-red-800 rounded-none border-2 border-border bg-muted text-foreground font-mono font-bold"
            onClick={() => onRemove(pattern)}
          >
            {pattern} ×
          </Badge>
        ))}
      </div>
    </div>
  );
}
