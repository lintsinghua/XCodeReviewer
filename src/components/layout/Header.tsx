import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Menu, 
  X,
  User,
  LogOut,
  Settings
} from "lucide-react";
import routes from "@/app/routes";
import { authService } from "@/shared/services/auth-service";
import { toast } from "sonner";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 只显示可见的路由，且在未登录时不显示需要保护的路由
  const visibleRoutes = routes.filter(route => {
    if (route.visible === false) return false;
    // 未登录时不显示需要保护的路由
    if (!isAuthenticated && route.protected) return false;
    return true;
  });

  // 检查登录状态
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        const user = authService.getSavedUser();
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
    };
    
    checkAuth();
    
    // 监听登录事件
    const handleLogin = () => {
      checkAuth();
    };
    
    // 监听登出事件
    const handleLogout = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
    };
    
    window.addEventListener('auth:login', handleLogin);
    window.addEventListener('auth:logout', handleLogout);
    
    return () => {
      window.removeEventListener('auth:login', handleLogin);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [location.pathname]);

  // 处理登出
  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success('已退出登录');
      navigate('/auth');
    } catch (error) {
      console.error('登出失败:', error);
      toast.error('登出失败');
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/60 sticky top-0 z-50">
      <div className="container-responsive">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <img 
              src="/logo_xcodereviewer.png" 
              alt="XCodeReviewer Logo" 
              className="w-9 h-9 rounded-xl shadow-sm group-hover:shadow-md transition-all"
            />
            <span className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">XCodeReviewer</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {visibleRoutes.map((route) => (
              <Link
                key={route.path}
                to={route.path}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  location.pathname === route.path
                    ? "text-primary bg-red-50"
                    : "text-gray-700 hover:text-primary hover:bg-gray-50"
                }`}
              >
                {route.name}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-2">
            {isAuthenticated && currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">{currentUser.username || currentUser.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{currentUser.full_name || currentUser.username}</span>
                      <span className="text-xs text-gray-500">{currentUser.email}</span>
                      <span className="text-xs text-gray-400 mt-1">角色: {currentUser.role}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {currentUser.role === 'admin' && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>系统管理</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/auth')}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
              >
                登录
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {visibleRoutes.map((route) => (
                <Link
                  key={route.path}
                  to={route.path}
                  className={`block px-3 py-2 text-base font-medium rounded-md transition-colors ${
                    location.pathname === route.path
                      ? "text-primary bg-red-50"
                      : "text-gray-700 hover:text-primary hover:bg-gray-50"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {route.name}
                </Link>
              ))}
              
              {/* Mobile user menu */}
              <div className="border-t pt-2 mt-2">
                {isAuthenticated && currentUser ? (
                  <>
                    <div className="px-3 py-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg mx-2 mb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-4 h-4 text-primary" />
                        <div className="text-sm font-medium text-gray-900">{currentUser.full_name || currentUser.username}</div>
                      </div>
                      <div className="text-xs text-gray-500 ml-6">{currentUser.email}</div>
                      <div className="text-xs text-gray-400 ml-6">角色: {currentUser.role}</div>
                    </div>
                    {currentUser.role === 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          navigate('/admin');
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        系统管理
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      退出登录
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                    onClick={() => {
                      navigate('/auth');
                      setMobileMenuOpen(false);
                    }}
                  >
                    登录
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
