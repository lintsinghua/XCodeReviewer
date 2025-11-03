/**
 * 受保护的路由组件
 * 需要用户登录才能访问
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '@/shared/services/auth-service';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      console.log('[ProtectedRoute] 开始检查认证状态...');
      const authenticated = authService.isAuthenticated();
      console.log('[ProtectedRoute] isAuthenticated:', authenticated);
      
      if (authenticated) {
        // 验证token是否有效
        try {
          console.log('[ProtectedRoute] 验证 token...');
          await authService.checkAndRefreshToken();
          console.log('[ProtectedRoute] Token 有效');
          setIsAuthenticated(true);
        } catch (error) {
          console.error('[ProtectedRoute] Token 验证失败:', error);
          setIsAuthenticated(false);
        }
      } else {
        console.log('[ProtectedRoute] 未登录');
        setIsAuthenticated(false);
      }
      
      setChecking(false);
      console.log('[ProtectedRoute] 检查完成');
    };
    
    checkAuth();
  }, []);
  
  // 监听登出事件
  useEffect(() => {
    const handleLogout = () => {
      console.log('[ProtectedRoute] 收到登出事件');
      setIsAuthenticated(false);
    };
    
    window.addEventListener('auth:logout', handleLogout);
    
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);
  
  console.log('[ProtectedRoute] 渲染状态 - checking:', checking, 'isAuthenticated:', isAuthenticated);
  
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600">验证登录状态...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    console.log('[ProtectedRoute] 跳转到登录页，当前路径:', location.pathname);
    // 保存当前路径，登录后跳转回来
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  console.log('[ProtectedRoute] 允许访问，渲染子组件');
  return <>{children}</>;
}

export default ProtectedRoute;
