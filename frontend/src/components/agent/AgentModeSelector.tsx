/**
 * Agent 审计模式选择器
 * 允许用户在快速审计和 Agent 审计模式之间选择
 */

import { Bot, Zap, CheckCircle2, Clock, Shield, Code } from "lucide-react";
import { cn } from "@/shared/utils/utils";

export type AuditMode = "fast" | "agent";

interface AgentModeSelectorProps {
  value: AuditMode;
  onChange: (mode: AuditMode) => void;
  disabled?: boolean;
}

export default function AgentModeSelector({
  value,
  onChange,
  disabled = false,
}: AgentModeSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4 text-indigo-700" />
        <span className="font-mono text-sm font-bold text-indigo-900 uppercase">
          审计模式
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 快速审计模式 */}
        <label
          className={cn(
            "relative flex flex-col p-4 border-2 cursor-pointer transition-all rounded-none",
            value === "fast"
              ? "border-amber-500 bg-amber-50"
              : "border-gray-300 hover:border-gray-400 bg-white",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="radio"
            name="auditMode"
            value="fast"
            checked={value === "fast"}
            onChange={() => onChange("fast")}
            disabled={disabled}
            className="sr-only"
          />

          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-100 border border-amber-300">
              <Zap className="w-4 h-4 text-amber-600" />
            </div>
            <span className="font-bold text-sm">快速审计</span>
            {value === "fast" && (
              <CheckCircle2 className="w-4 h-4 text-amber-600 ml-auto" />
            )}
          </div>

          <ul className="text-xs text-gray-600 space-y-1 mb-3">
            <li className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              速度快（分钟级）
            </li>
            <li className="flex items-center gap-1">
              <Code className="w-3 h-3" />
              逐文件 LLM 分析
            </li>
            <li className="flex items-center gap-1 text-gray-400">
              <Shield className="w-3 h-3" />
              无漏洞验证
            </li>
          </ul>

          <div className="mt-auto pt-2 border-t border-gray-200">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
              适合: CI/CD 集成、日常检查
            </span>
          </div>
        </label>

        {/* Agent 审计模式 */}
        <label
          className={cn(
            "relative flex flex-col p-4 border-2 cursor-pointer transition-all rounded-none",
            value === "agent"
              ? "border-purple-500 bg-purple-50"
              : "border-gray-300 hover:border-gray-400 bg-white",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <input
            type="radio"
            name="auditMode"
            value="agent"
            checked={value === "agent"}
            onChange={() => onChange("agent")}
            disabled={disabled}
            className="sr-only"
          />

          {/* 推荐标签 */}
          <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold uppercase">
            推荐
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-purple-100 border border-purple-300">
              <Bot className="w-4 h-4 text-purple-600" />
            </div>
            <span className="font-bold text-sm">Agent 审计</span>
            {value === "agent" && (
              <CheckCircle2 className="w-4 h-4 text-purple-600 ml-auto" />
            )}
          </div>

          <ul className="text-xs text-gray-600 space-y-1 mb-3">
            <li className="flex items-center gap-1">
              <Bot className="w-3 h-3" />
              AI Agent 自主分析
            </li>
            <li className="flex items-center gap-1">
              <Code className="w-3 h-3" />
              跨文件关联 + RAG
            </li>
            <li className="flex items-center gap-1 text-purple-600 font-medium">
              <Shield className="w-3 h-3" />
              沙箱漏洞验证
            </li>
          </ul>

          <div className="mt-auto pt-2 border-t border-gray-200">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
              适合: 发版前审计、深度安全评估
            </span>
          </div>
        </label>
      </div>

      {/* 模式说明 */}
      {value === "agent" && (
        <div className="p-3 bg-purple-50 border border-purple-200 text-xs text-purple-800 rounded-none">
          <p className="font-bold mb-1">🤖 Agent 审计模式说明：</p>
          <ul className="list-disc list-inside space-y-0.5 text-purple-700">
            <li>AI Agent 会自主规划审计策略</li>
            <li>使用 RAG 技术进行代码语义检索</li>
            <li>在 Docker 沙箱中验证发现的漏洞</li>
            <li>可生成可复现的 PoC（概念验证）代码</li>
            <li>审计时间较长，但结果更全面准确</li>
          </ul>
        </div>
      )}
    </div>
  );
}

