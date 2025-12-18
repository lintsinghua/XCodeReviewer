/**
 * NotFound Page
 * Cyberpunk Terminal Aesthetic
 */

import { Link } from "react-router-dom";
import PageMeta from "@/components/layout/PageMeta";
import { Button } from "@/components/ui/button";
import { Terminal, AlertTriangle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <PageMeta title="页面未找到" description="" />
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6 cyber-bg-elevated font-mono overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 cyber-grid-subtle pointer-events-none" />

        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 text-center max-w-lg mx-auto">
          {/* Error Icon */}
          <div className="w-24 h-24 bg-rose-500/20 border border-rose-500/40 rounded-lg flex items-center justify-center mx-auto mb-8"
            style={{ boxShadow: '0 0 40px rgba(244,63,94,0.3)' }}>
            <AlertTriangle className="w-12 h-12 text-rose-400" />
          </div>

          {/* Error Code */}
          <div className="mb-6">
            <span className="text-8xl font-bold text-primary"
              style={{ textShadow: '0 0 30px rgba(255,107,44,0.5), 0 0 60px rgba(255,107,44,0.3)' }}>
              404
            </span>
          </div>

          {/* Terminal-style error message */}
          <div className="cyber-card p-0 mb-8">
            <div className="cyber-card-header">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold uppercase tracking-wider text-foreground">ERROR_LOG</span>
            </div>
            <div className="p-4 text-left">
              <div className="text-emerald-400 text-sm">
                <span className="text-muted-foreground">[{new Date().toISOString()}]</span>
              </div>
              <div className="text-rose-400 text-sm mt-1">
                <span className="text-muted-foreground">ERROR:</span> PAGE_NOT_FOUND
              </div>
              <div className="text-amber-400 text-sm mt-1">
                <span className="text-muted-foreground">STATUS:</span> 404
              </div>
              <div className="text-muted-foreground text-sm mt-1">
                <span className="text-muted-foreground">MESSAGE:</span> 请求的页面不存在或已被移除
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground mb-8 text-sm">
            页面可能已被删除或不存在，请检查网址是否正确。
          </p>

          {/* Back Button */}
          <Link to="/">
            <Button className="cyber-btn-primary h-12 px-8 text-base font-bold uppercase">
              <Home className="w-5 h-5 mr-2" />
              返回首页
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground font-mono uppercase">
          &copy; {new Date().getFullYear()} DeepAudit
        </p>
      </div>
    </>
  );
}
