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
    FileText,
    ChevronLeft,
    ChevronRight,
    Github,
    Terminal
} from "lucide-react";
import routes from "@/app/routes";

// Icon mapping for routes
const routeIcons: Record<string, React.ReactNode> = {
    "/": <LayoutDashboard className="w-5 h-5" />,
    "/projects": <FolderGit2 className="w-5 h-5" />,
    "/instant-analysis": <Zap className="w-5 h-5" />,
    "/audit-tasks": <ListTodo className="w-5 h-5" />,
    "/admin": <Settings className="w-5 h-5" />,
    "/recycle-bin": <Trash2 className="w-5 h-5" />,
    "/logs": <FileText className="w-5 h-5" />,
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
                className="fixed top-4 left-4 z-50 md:hidden bg-white border-2 border-black shadow-retro text-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-retro-hover transition-all"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 h-screen bg-background
          border-r-2 border-black
          z-40 transition-all duration-300 ease-in-out
          ${collapsed ? "w-20" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
            >
                <div className="flex flex-col h-full relative">
                    {/* Decorative Grid Background */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                    {/* Logo Section */}
                    <div className="relative flex items-center h-[72px] px-4 border-b-2 border-black bg-white z-10">
                        <Link
                            to="/"
                            className={`flex items-center space-x-3 group overflow-hidden transition-all duration-300 ${collapsed ? 'justify-center w-full' : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            <div className="relative flex-shrink-0 border-2 border-black bg-primary p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <Terminal className="w-6 h-6 text-white" />
                            </div>
                            <div className={`transition-all duration-300 ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                                <span className="text-lg font-display font-bold text-black tracking-tighter uppercase">
                                    XCode<span className="text-primary">Reviewer</span>
                                </span>
                            </div>
                        </Link>

                        {/* Collapse button for desktop */}
                        <button
                            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 border-black items-center justify-center hover:bg-primary hover:text-white transition-colors z-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
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
                    <nav className="flex-1 overflow-y-auto py-6 px-3 z-10">
                        <div className="space-y-2">
                            {visibleRoutes.map((route) => {
                                const isActive = location.pathname === route.path;
                                return (
                                    <Link
                                        key={route.path}
                                        to={route.path}
                                        className={`
                      flex items-center space-x-3 px-3 py-3
                      transition-all duration-200 group relative
                      border-2 
                      ${isActive
                                                ? "bg-primary border-black shadow-retro text-white"
                                                : "bg-transparent border-transparent hover:border-black hover:bg-white hover:shadow-retro-hover text-gray-600 hover:text-black"
                                            }
                    `}
                                        onClick={() => setMobileOpen(false)}
                                        title={collapsed ? route.name : undefined}
                                    >
                                        {/* Icon */}
                                        <span className={`
                      flex-shrink-0 transition-colors duration-200
                      ${isActive ? "text-white" : "text-black group-hover:text-black"}
                    `}>
                                            {routeIcons[route.path] || <LayoutDashboard className="w-5 h-5" />}
                                        </span>

                                        {/* Label */}
                                        {!collapsed && (
                                            <span className="font-mono font-bold tracking-tight uppercase text-sm">
                                                {route.name}
                                            </span>
                                        )}

                                        {/* Glitch Effect on Hover (Optional) */}
                                        {!isActive && !collapsed && (
                                            <span className="absolute right-2 opacity-0 group-hover:opacity-100 text-xs font-bold text-primary animate-pulse">
                                                &lt;/&gt;
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Footer with GitHub Link */}
                    <div className="p-4 border-t-2 border-black bg-white z-10">
                        <a
                            href="https://github.com/lintsinghua/XCodeReviewer"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                flex items-center space-x-3 px-3 py-2.5
                text-black border-2 border-transparent hover:border-black hover:shadow-retro-hover hover:bg-white
                transition-all duration-200 group
              `}
                            title={collapsed ? "GitHub 仓库" : undefined}
                        >
                            <Github className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && (
                                <div className="flex flex-col">
                                    <span className="font-mono font-bold text-sm uppercase">GitHub</span>
                                    <span className="text-xs text-gray-500 font-mono">v1.0.0</span>
                                </div>
                            )}
                        </a>
                    </div>
                </div>
            </aside>
        </>
    );
}
