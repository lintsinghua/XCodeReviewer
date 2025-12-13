/**
 * Sidebar Component
 * Cyberpunk Terminal Aesthetic
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
    Terminal
} from "lucide-react";
import routes from "@/app/routes";
import { version } from "../../../package.json";

// Icon mapping for routes
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
                className="fixed top-4 left-4 z-50 md:hidden bg-[#0c0c12] border border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white"
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
                    fixed top-0 left-0 h-screen
                    bg-[#0a0a0f] border-r border-gray-800/60
                    z-40 transition-all duration-300 ease-in-out
                    ${collapsed ? "w-20" : "w-64"}
                    ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                `}
            >
                <div className="flex flex-col h-full relative">
                    {/* Subtle grid background */}
                    <div
                        className="absolute inset-0 opacity-30 pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(rgba(255,107,44,0.03) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,107,44,0.03) 1px, transparent 1px)
                            `,
                            backgroundSize: '24px 24px',
                        }}
                    />

                    {/* Logo Section */}
                    <div className={`
                        relative flex items-center h-[72px]
                        border-b border-gray-800/60 bg-[#0c0c12]
                        ${collapsed ? 'px-3 justify-center' : 'px-4 pr-6'}
                    `}>
                        <Link
                            to="/"
                            className={`
                                flex items-center gap-3 group transition-all duration-300
                                ${collapsed ? 'justify-center' : 'flex-1 min-w-0'}
                            `}
                            onClick={() => setMobileOpen(false)}
                        >
                            {/* Logo Icon */}
                            <div className="relative flex-shrink-0">
                                <div className="w-10 h-10 bg-[#0a0a0f] border border-primary/30 rounded-lg flex items-center justify-center overflow-hidden group-hover:border-primary/60 transition-colors">
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
                            <div className={`
                                transition-all duration-300
                                ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 min-w-0 opacity-100'}
                            `}>
                                <div
                                    className="text-xl font-bold tracking-wider font-mono"
                                    style={{ textShadow: '0 0 20px rgba(255,107,44,0.3)' }}
                                >
                                    <span className="text-primary">DEEP</span>
                                    <span className="text-white">AUDIT</span>
                                </div>
                            </div>
                        </Link>

                        {/* Collapse button */}
                        <button
                            className={`
                                hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2
                                w-6 h-6 bg-[#0c0c12] border border-gray-700 rounded
                                items-center justify-center text-gray-500
                                hover:bg-primary hover:border-primary hover:text-white
                                transition-all duration-200
                            `}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{ zIndex: 100 }}
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
                                        className={`
                                            flex items-center gap-3 px-3 py-2.5
                                            transition-all duration-200 group relative rounded-lg
                                            ${isActive
                                                ? "bg-primary/15 text-primary border border-primary/30"
                                                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
                                            }
                                        `}
                                        onClick={() => setMobileOpen(false)}
                                        title={collapsed ? route.name : undefined}
                                    >
                                        {/* Active indicator */}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r" />
                                        )}

                                        {/* Icon */}
                                        <span className={`
                                            flex-shrink-0 transition-colors duration-200
                                            ${isActive ? "text-primary" : "text-gray-500 group-hover:text-gray-300"}
                                        `}>
                                            {routeIcons[route.path] || <LayoutDashboard className="w-5 h-5" />}
                                        </span>

                                        {/* Label */}
                                        {!collapsed && (
                                            <span className={`
                                                font-mono text-sm tracking-wide
                                                ${isActive ? 'font-semibold' : 'font-medium'}
                                            `}>
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
                    <div className="p-3 border-t border-gray-800/60 bg-[#0c0c12] space-y-1">
                        {/* Account Link */}
                        <Link
                            to="/account"
                            className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-lg
                                transition-all duration-200 group
                                ${location.pathname === '/account'
                                    ? "bg-primary/15 text-primary border border-primary/30"
                                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
                                }
                            `}
                            onClick={() => setMobileOpen(false)}
                            title={collapsed ? "账号管理" : undefined}
                        >
                            <UserCircle className={`w-5 h-5 flex-shrink-0 ${
                                location.pathname === '/account' ? 'text-primary' : 'text-gray-500 group-hover:text-gray-300'
                            }`} />
                            {!collapsed && (
                                <span className="font-mono text-sm">账号管理</span>
                            )}
                        </Link>

                        {/* GitHub Link */}
                        <a
                            href="https://github.com/lintsinghua/DeepAudit"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-lg
                                text-gray-400 hover:text-gray-200 hover:bg-gray-800/50
                                transition-all duration-200 group border border-transparent
                            `}
                            title={collapsed ? "GitHub" : undefined}
                        >
                            <Github className="w-5 h-5 flex-shrink-0 text-gray-500 group-hover:text-gray-300" />
                            {!collapsed && (
                                <div className="flex flex-col">
                                    <span className="font-mono text-sm">GitHub</span>
                                    <span className="text-[10px] text-gray-600 font-mono">v{version}</span>
                                </div>
                            )}
                        </a>

                        {/* System Status */}
                        {!collapsed && (
                            <div className="mt-3 pt-3 border-t border-gray-800/50">
                                <div className="flex items-center gap-2 px-3 py-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                                         style={{ boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)' }} />
                                    <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
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
