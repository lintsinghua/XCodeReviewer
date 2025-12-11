import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import RecycleBin from "@/pages/RecycleBin";
import InstantAnalysis from "@/pages/InstantAnalysis";
import AuditTasks from "@/pages/AuditTasks";
import TaskDetail from "@/pages/TaskDetail";
import AgentAudit from "@/pages/AgentAudit";
import AdminDashboard from "@/pages/AdminDashboard";
import LogsPage from "@/pages/LogsPage";
import Account from "@/pages/Account";
import AuditRules from "@/pages/AuditRules";
import PromptManager from "@/pages/PromptManager";
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
    name: "Agent审计",
    path: "/agent-audit/:taskId",
    element: <AgentAudit />,
    visible: false,
  },
  {
    name: "审计规则",
    path: "/audit-rules",
    element: <AuditRules />,
    visible: true,
  },
  {
    name: "提示词管理",
    path: "/prompts",
    element: <PromptManager />,
    visible: true,
  },
  {
    name: "系统管理",
    path: "/admin",
    element: <AdminDashboard />,
    visible: true,
  },
  {
    name: "回收站",
    path: "/recycle-bin",
    element: <RecycleBin />,
    visible: true,
  },
  {
    name: "系统日志",
    path: "/logs",
    element: <LogsPage />,
    visible: true,
  },
  {
    name: "账号管理",
    path: "/account",
    element: <Account />,
    visible: false, // 不在主导航显示，在侧边栏底部单独显示
  },
];

export default routes;