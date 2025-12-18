/**
 * Sidebar Component
 * Cyberpunk Terminal Aesthetic
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
    Menu,
    X,
    LayoutDashboard,
    FolderGit2,
    Zap,
    ListTodo,
    Settings,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Github,
    UserCircle,
    Shield,
    MessageSquare,
    Bot,
} from "lucide-react";
import routes from "@/app/routes";
import { version } from "../../../package.json";

// Icon mapping for routes
const routeIcons: Record<string, React.ReactNode> = {
    "/": <Bot className="w-6 h-6" />,
    "/dashboard": <LayoutDashboard className="w-6 h-6" />,
    "/projects": <FolderGit2 className="w-6 h-6" />,
    "/instant-analysis": <Zap className="w-6 h-6" />,
    "/audit-tasks": <ListTodo className="w-6 h-6" />,
    "/audit-rules": <Shield className="w-6 h-6" />,
    "/prompts": <MessageSquare className="w-6 h-6" />,
    "/admin": <Settings className="w-6 h-6" />,
    "/recycle-bin": <Trash2 className="w-6 h-6" />,
};

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const visibleRoutes = routes.filter(route => route.visible !== false);

    return (
        <>
            {/* Mobile Menu Button */}
            <Button
                variant="ghost"
                size="sm"
                className="fixed top-4 left-4 z-50 md:hidden"
                style={{
                    background: 'var(--cyber-bg)',
                    border: '1px solid var(--cyber-border)',
                    color: 'var(--cyber-text-muted)'
                }}
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed top-0 left-0 h-screen z-40 transition-all duration-300 ease-in-out
                    ${collapsed ? "w-20" : "w-64"}
                    ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                `}
                style={{
                    background: 'var(--cyber-bg)',
                    borderRight: '1px solid var(--cyber-border)'
                }}
            >
                <div className="flex flex-col h-full relative">
                    {/* Subtle grid background */}
                    <div
                        className="absolute inset-0 opacity-30 pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(var(--cyber-border-accent) 1px, transparent 1px),
                                linear-gradient(90deg, var(--cyber-border-accent) 1px, transparent 1px)
                            `,
                            backgroundSize: '24px 24px',
                        }}
                    />

                    {/* Logo Section */}
                    <div
                        className={`relative flex items-center h-[72px] ${collapsed ? 'px-3 justify-center' : 'px-4 pr-6'}`}
                        style={{
                            background: 'var(--cyber-bg-elevated)',
                            borderBottom: '1px solid var(--cyber-border)'
                        }}
                    >
                        <Link
                            to="/"
                            className={`flex items-center gap-3 group transition-all duration-300 ${collapsed ? 'justify-center' : 'flex-1 min-w-0'}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            {/* Logo Icon */}
                            <div className="relative flex-shrink-0">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden group-hover:border-primary/60 transition-colors"
                                    style={{
                                        background: 'var(--cyber-bg)',
                                        border: '1px solid hsl(var(--primary) / 0.3)'
                                    }}
                                >
                                    <img
                                        src="/logo_deepaudit.png"
                                        alt="DeepAudit"
                                        className="w-7 h-7 object-contain"
                                    />
                                </div>
                                {/* Glow effect */}
                                <div className="absolute inset-0 bg-primary/20 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            {/* Logo Text */}
                            <div className={`transition-all duration-300 ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 min-w-0 opacity-100'}`}>
                                <div
                                    className="text-xl font-bold tracking-wider font-mono"
                                    style={{ textShadow: '0 0 20px rgba(255,107,44,0.3)' }}
                                >
                                    <span className="text-primary">DEEP</span>
                                    <span style={{ color: 'var(--cyber-text)' }}>AUDIT</span>
                                </div>
                            </div>
                        </Link>

                        {/* Collapse button */}
                        <button
                            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded items-center justify-center hover:bg-primary hover:border-primary hover:text-foreground transition-all duration-200"
                            style={{
                                background: 'var(--cyber-bg)',
                                border: '1px solid var(--cyber-border)',
                                color: 'var(--cyber-text-muted)',
                                zIndex: 100
                            }}
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            {collapsed ? (
                                <ChevronRight className="w-3 h-3" />
                            ) : (
                                <ChevronLeft className="w-3 h-3" />
                            )}
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
                        <div className="space-y-1">
                            {visibleRoutes.map((route) => {
                                const isActive = location.pathname === route.path;
                                return (
                                    <Link
                                        key={route.path}
                                        to={route.path}
                                        className="flex items-center gap-3 px-3 py-2.5 transition-all duration-200 group relative rounded-lg"
                                        style={{
                                            background: isActive ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                                            border: isActive ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                                            color: isActive ? 'hsl(var(--primary))' : 'var(--cyber-text-muted)'
                                        }}
                                        onClick={() => setMobileOpen(false)}
                                        title={collapsed ? route.name : undefined}
                                        onMouseEnter={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'var(--cyber-hover-bg)';
                                                e.currentTarget.style.color = 'var(--cyber-text)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = 'var(--cyber-text-muted)';
                                            }
                                        }}
                                    >
                                        {/* Active indicator */}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r" />
                                        )}

                                        {/* Icon */}
                                        <span className="flex-shrink-0 transition-colors duration-200">
                                            {routeIcons[route.path] || <LayoutDashboard className="w-6 h-6" />}
                                        </span>

                                        {/* Label */}
                                        {!collapsed && (
                                            <span className={`font-mono text-base tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                                {route.name}
                                            </span>
                                        )}

                                        {/* Hover arrow */}
                                        {!isActive && !collapsed && (
                                            <span className="absolute right-3 opacity-0 group-hover:opacity-100 text-xs text-primary transition-opacity">
                                                →
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Footer */}
                    <div
                        className="p-3 space-y-1"
                        style={{
                            background: 'var(--cyber-bg-elevated)',
                            borderTop: '1px solid var(--cyber-border)'
                        }}
                    >
                        {/* Theme Toggle */}
                        <ThemeToggle collapsed={collapsed} />

                        {/* Account Link */}
                        <Link
                            to="/account"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group"
                            style={{
                                background: location.pathname === '/account' ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                                border: location.pathname === '/account' ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                                color: location.pathname === '/account' ? 'hsl(var(--primary))' : 'var(--cyber-text-muted)'
                            }}
                            onClick={() => setMobileOpen(false)}
                            title={collapsed ? "账号管理" : undefined}
                        >
                            <UserCircle className="w-6 h-6 flex-shrink-0" />
                            {!collapsed && (
                                <span className="font-mono text-base">账号管理</span>
                            )}
                        </Link>

                        {/* GitHub Link */}
                        <a
                            href="https://github.com/lintsinghua/DeepAudit"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group"
                            style={{ color: 'var(--cyber-text-muted)' }}
                            title={collapsed ? "GitHub" : undefined}
                        >
                            <Github className="w-6 h-6 flex-shrink-0" />
                            {!collapsed && (
                                <div className="flex flex-col">
                                    <span className="font-mono text-base">GitHub</span>
                                    <span className="text-sm font-mono" style={{ color: 'var(--cyber-text-muted)' }}>v{version}</span>
                                </div>
                            )}
                        </a>

                        {/* System Status */}
                        {!collapsed && (
                            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--cyber-border)' }}>
                                <div className="flex items-center gap-2 px-3 py-2">
                                    <div
                                        className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                                        style={{ boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)' }}
                                    />
                                    <span
                                        className="text-sm font-mono uppercase tracking-wider"
                                        style={{ color: 'var(--cyber-text-muted)' }}
                                    >
                                        System Online
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
