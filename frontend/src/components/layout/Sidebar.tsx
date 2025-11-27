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
    Github
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
                className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileOpen(!mobileOpen)}
            >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Overlay for mobile */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 left-0 h-screen bg-white/95 backdrop-blur-xl
          border-r border-gray-200/80 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]
          z-40 transition-all duration-300 ease-in-out
          ${collapsed ? "w-20" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
            >
                <div className="flex flex-col h-full">
                    {/* Logo Section */}
                    <div className="relative flex items-center h-[72px] px-4 border-b border-gray-100">
                        <Link
                            to="/"
                            className={`flex items-center space-x-3 group overflow-hidden transition-all duration-300 ${collapsed ? 'justify-center w-full' : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            <div className="relative flex-shrink-0">
                                <div className="absolute inset-0 bg-red-500/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <img
                                    src="/logo_xcodereviewer.png"
                                    alt="XCodeReviewer Logo"
                                    className="w-9 h-9 rounded-xl shadow-sm relative z-10 group-hover:scale-105 transition-transform duration-300"
                                />
                            </div>
                            <div className={`transition-all duration-300 ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700 group-hover:from-red-700 group-hover:to-red-500 whitespace-nowrap">
                                    XCodeReviewer
                                </span>
                            </div>
                        </Link>

                        {/* Collapse button for desktop - Absolute Positioned */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white text-gray-400 hover:text-gray-900 border border-gray-200 shadow-sm z-50 hover:bg-gray-50"
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            {collapsed ? (
                                <ChevronRight className="w-3 h-3" />
                            ) : (
                                <ChevronLeft className="w-3 h-3" />
                            )}
                        </Button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto py-6 px-3">
                        <div className="space-y-1.5">
                            {visibleRoutes.map((route) => {
                                const isActive = location.pathname === route.path;
                                return (
                                    <Link
                                        key={route.path}
                                        to={route.path}
                                        className={`
                      flex items-center space-x-3 px-3 py-2.5 rounded-xl
                      transition-all duration-200 group relative overflow-hidden
                      ${isActive
                                                ? "bg-red-50 text-red-700 font-medium shadow-sm ring-1 ring-red-100"
                                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                            }
                    `}
                                        onClick={() => setMobileOpen(false)}
                                        title={collapsed ? route.name : undefined}
                                    >
                                        {/* Active Indicator Bar */}
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-600 rounded-r-full opacity-0 md:opacity-100 transition-opacity" />
                                        )}

                                        {/* Icon */}
                                        <span className={`
                      flex-shrink-0 transition-colors duration-200
                      ${isActive ? "text-red-600" : "text-gray-400 group-hover:text-gray-600"}
                    `}>
                                            {routeIcons[route.path] || <LayoutDashboard className="w-5 h-5" />}
                                        </span>

                                        {/* Label */}
                                        {!collapsed && (
                                            <span className="whitespace-nowrap z-10">
                                                {route.name}
                                            </span>
                                        )}

                                        {/* Hover Effect Background (Subtle) */}
                                        {!isActive && (
                                            <div className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-0 rounded-xl" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Footer with GitHub Link */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                        <a
                            href="https://github.com/lintsinghua/XCodeReviewer"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`
                flex items-center space-x-3 px-3 py-2.5 rounded-xl
                text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm hover:ring-1 hover:ring-gray-200
                transition-all duration-200 group
              `}
                            title={collapsed ? "GitHub Repository" : undefined}
                        >
                            <Github className="w-5 h-5 flex-shrink-0 text-gray-400 group-hover:text-gray-900 transition-colors" />
                            {!collapsed && (
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">GitHub</span>
                                    <span className="text-xs text-gray-400 group-hover:text-gray-500">View Source</span>
                                </div>
                            )}
                        </a>
                    </div>
                </div>
            </aside>
        </>
    );
}
