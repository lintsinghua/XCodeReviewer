/**
 * Sidebar Component
 * Premium Terminal Aesthetic with Enhanced Visual Design
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
    ExternalLink,
} from "lucide-react";
import routes from "@/app/routes";
import { version } from "../../../package.json";

// Icon mapping for routes with consistent sizing
const routeIcons: Record<string, React.ReactNode> = {
    "/": <Bot className="w-5 h-5" />,
    "/dashboard": <LayoutDashboard className="w-5 h-5" />,
    "/projects": <FolderGit2 className="w-5 h-5" />,
    "/instant-analysis": <Zap className="w-5 h-5" />,
    "/audit-tasks": <ListTodo className="w-5 h-5" />,
    "/audit-rules": <Shield className="w-5 h-5" />,
    "/prompts": <MessageSquare className="w-5 h-5" />,
    "/admin": <Settings className="w-5 h-5" />,
    "/recycle-bin": <Trash2 className="w-5 h-5" />,
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
                    {/* Subtle gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

                    {/* Subtle grid background */}
                    <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(var(--cyber-border-accent) 1px, transparent 1px),
                                linear-gradient(90deg, var(--cyber-border-accent) 1px, transparent 1px)
                            `,
                            backgroundSize: '32px 32px',
                        }}
                    />

                    {/* Right edge glow */}
                    <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-primary/10 to-primary/30 pointer-events-none" />

                    {/* Logo Section with enhanced styling */}
                    <div
                        className={`relative flex items-center h-[72px] ${collapsed ? 'px-3 justify-center' : 'px-5 pr-6'}`}
                        style={{
                            background: 'var(--cyber-bg-elevated)',
                            borderBottom: '1px solid var(--cyber-border)'
                        }}
                    >
                        {/* Bottom accent line */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />

                        <Link
                            to="/"
                            className={`flex items-center gap-3 group transition-all duration-300 ${collapsed ? 'justify-center' : 'flex-1 min-w-0'}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            {/* Logo Icon with enhanced styling */}
                            <div className="relative flex-shrink-0">
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(255,107,44,0.3)]"
                                    style={{
                                        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))',
                                        border: '1px solid hsl(var(--primary) / 0.4)'
                                    }}
                                >
                                    <img
                                        src="/logo_deepaudit.png"
                                        alt="DeepAudit"
                                        className="w-7 h-7 object-contain transition-transform duration-300 group-hover:scale-110"
                                    />
                                </div>
                                {/* Glow effect */}
                                <div className="absolute inset-0 bg-primary/30 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>

                            {/* Logo Text with enhanced styling */}
                            <div className={`transition-all duration-300 ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 min-w-0 opacity-100'}`}>
                                <div
                                    className="text-xl font-bold tracking-wider font-mono leading-tight"
                                    style={{ textShadow: '0 0 25px rgba(255,107,44,0.4)' }}
                                >
                                    <span className="text-primary">DEEP</span>
                                    <span style={{ color: 'var(--cyber-text)' }}>AUDIT</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground tracking-[0.15em] uppercase mt-0.5">
                                    Security Agent
                                </div>
                            </div>
                        </Link>

                        {/* Collapse button with enhanced styling */}
                        <button
                            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md items-center justify-center hover:bg-primary hover:border-primary hover:text-white transition-all duration-300 shadow-sm"
                            style={{
                                background: 'var(--cyber-bg)',
                                border: '1px solid var(--cyber-border)',
                                color: 'var(--cyber-text-muted)',
                                zIndex: 100
                            }}
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            {collapsed ? (
                                <ChevronRight className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronLeft className="w-3.5 h-3.5" />
                            )}
                        </button>
                    </div>

                    {/* Navigation with enhanced styling */}
                    <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar relative">
                        <div className="space-y-1.5">
                            {visibleRoutes.map((route) => {
                                const isActive = location.pathname === route.path;
                                return (
                                    <Link
                                        key={route.path}
                                        to={route.path}
                                        className={`
                                            flex items-center gap-3 px-3 py-2.5 transition-all duration-300 group relative rounded-lg
                                            ${isActive
                                                ? 'bg-primary/15 border border-primary/40 shadow-[0_0_15px_rgba(255,107,44,0.1)]'
                                                : 'border border-transparent hover:bg-card/60 hover:border-border/50'
                                            }
                                        `}
                                        style={{
                                            color: isActive ? 'hsl(var(--primary))' : 'var(--cyber-text-muted)'
                                        }}
                                        onClick={() => setMobileOpen(false)}
                                        title={collapsed ? route.name : undefined}
                                        onMouseEnter={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.color = 'var(--cyber-text)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) {
                                                e.currentTarget.style.color = 'var(--cyber-text-muted)';
                                            }
                                        }}
                                    >
                                        {/* Active indicator with glow */}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-primary rounded-r shadow-[0_0_8px_rgba(255,107,44,0.5)]" />
                                        )}

                                        {/* Icon with background on active */}
                                        <span className={`
                                            flex-shrink-0 transition-all duration-300 p-1.5 rounded-md
                                            ${isActive ? 'bg-primary/20' : 'group-hover:bg-muted/50'}
                                        `}>
                                            {routeIcons[route.path] || <LayoutDashboard className="w-5 h-5" />}
                                        </span>

                                        {/* Label */}
                                        {!collapsed && (
                                            <span className={`font-mono text-sm tracking-wide transition-all duration-300 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                                {route.name}
                                            </span>
                                        )}

                                        {/* Hover indicator */}
                                        {!isActive && !collapsed && (
                                            <span className="absolute right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1">
                                                <ChevronRight className="w-4 h-4 text-primary" />
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Footer with enhanced styling */}
                    <div
                        className="p-3 space-y-1.5 relative"
                        style={{
                            background: 'var(--cyber-bg-elevated)',
                            borderTop: '1px solid var(--cyber-border)'
                        }}
                    >
                        {/* Top accent line */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

                        {/* Theme Toggle */}
                        <ThemeToggle collapsed={collapsed} />

                        {/* Account Link with enhanced styling */}
                        <Link
                            to="/account"
                            className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group
                                ${location.pathname === '/account'
                                    ? 'bg-primary/15 border border-primary/40'
                                    : 'border border-transparent hover:bg-card/60 hover:border-border/50'
                                }
                            `}
                            style={{
                                color: location.pathname === '/account' ? 'hsl(var(--primary))' : 'var(--cyber-text-muted)'
                            }}
                            onClick={() => setMobileOpen(false)}
                            title={collapsed ? "账号管理" : undefined}
                        >
                            <span className={`p-1.5 rounded-md transition-all duration-300 ${location.pathname === '/account' ? 'bg-primary/20' : 'group-hover:bg-muted/50'}`}>
                                <UserCircle className="w-5 h-5 flex-shrink-0" />
                            </span>
                            {!collapsed && (
                                <span className="font-mono text-sm">账号管理</span>
                            )}
                        </Link>

                        {/* GitHub Link with enhanced styling */}
                        <a
                            href="https://github.com/lintsinghua/DeepAudit"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group border border-transparent hover:bg-card/60 hover:border-border/50"
                            style={{ color: 'var(--cyber-text-muted)' }}
                            title={collapsed ? "GitHub" : undefined}
                        >
                            <span className="p-1.5 rounded-md transition-all duration-300 group-hover:bg-muted/50">
                                <Github className="w-5 h-5 flex-shrink-0" />
                            </span>
                            {!collapsed && (
                                <div className="flex-1 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-sm">GitHub</span>
                                        <span className="text-xs font-mono text-muted-foreground/70">v{version}</span>
                                    </div>
                                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                </div>
                            )}
                        </a>

                        {/* System Status with enhanced styling */}
                        {!collapsed && (
                            <div className="mt-3 pt-3 relative" style={{ borderTop: '1px solid var(--cyber-border)' }}>
                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="relative">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full bg-emerald-400"
                                            style={{ boxShadow: '0 0 10px rgba(52, 211, 153, 0.6)' }}
                                        />
                                        <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-50" />
                                    </div>
                                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-500">
                                        System Online
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Collapsed system status indicator */}
                        {collapsed && (
                            <div className="flex justify-center py-2">
                                <div className="relative">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full bg-emerald-400"
                                        style={{ boxShadow: '0 0 10px rgba(52, 211, 153, 0.6)' }}
                                    />
                                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-50" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}
