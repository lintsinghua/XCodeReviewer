import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import InstantAnalysis from "@/pages/InstantAnalysis";
import AuditTasks from "@/pages/AuditTasks";
import TaskDetail from "@/pages/TaskDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: "仪表盘",
    path: "/",
    element: <Dashboard />,
    visible: true,
  },
  {
    name: "项目管理",
    path: "/projects",
    element: <Projects />,
    visible: true,
  },
  {
    name: "项目详情",
    path: "/projects/:id",
    element: <ProjectDetail />,
    visible: false,
  },
  {
    name: "即时分析",
    path: "/instant-analysis",
    element: <InstantAnalysis />,
    visible: true,
  },
  {
    name: "审计任务",
    path: "/audit-tasks",
    element: <AuditTasks />,
    visible: true,
  },
  {
    name: "任务详情",
    path: "/tasks/:id",
    element: <TaskDetail />,
    visible: false,
  },
  {
    name: "系统管理",
    path: "/admin",
    element: <AdminDashboard />,
    visible: true,
  },
];

export default routes;