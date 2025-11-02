import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import RecycleBin from "@/pages/RecycleBin";
import InstantAnalysis from "@/pages/InstantAnalysis";
import AuditTasks from "@/pages/AuditTasks";
import TaskDetail from "@/pages/TaskDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import LogsPage from "@/pages/LogsPage";
import Auth from "@/pages/Auth";
import type { ComponentType } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  component: ComponentType<any>;
  visible?: boolean;
  protected?: boolean;
}

const routes: RouteConfig[] = [
  // 认证页面（不需要保护）
  {
    name: "登录",
    path: "/auth",
    component: Auth,
    visible: false,
    protected: false,
  },
  // 以下页面需要登录才能访问
  {
    name: "仪表盘",
    path: "/",
    component: Dashboard,
    visible: true,
    protected: true,
  },
  {
    name: "项目管理",
    path: "/projects",
    component: Projects,
    visible: true,
    protected: true,
  },
  {
    name: "项目详情",
    path: "/projects/:id",
    component: ProjectDetail,
    visible: false,
    protected: true,
  },
  {
    name: "即时分析",
    path: "/instant-analysis",
    component: InstantAnalysis,
    visible: true,
    protected: true,
  },
  {
    name: "审计任务",
    path: "/audit-tasks",
    component: AuditTasks,
    visible: true,
    protected: true,
  },
  {
    name: "任务详情",
    path: "/tasks/:id",
    component: TaskDetail,
    visible: false,
    protected: true,
  },
  {
    name: "系统管理",
    path: "/admin",
    component: AdminDashboard,
    visible: true,
    protected: true,
  },
  {
    name: "回收站",
    path: "/recycle-bin",
    component: RecycleBin,
    visible: true,
    protected: true,
  },
  {
    name: "系统日志",
    path: "/logs",
    component: LogsPage,
    visible: true,
    protected: true,
  },
];

export default routes;
