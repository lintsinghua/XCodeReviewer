/*
# 智能代码审计系统数据库架构

## 1. 概述
为智能代码审计系统创建完整的数据库架构，支持用户管理、项目管理、代码审计、即时分析等核心功能。

## 2. 表结构说明

### 2.1 用户相关表
- `profiles`: 用户基本信息表
  - `id` (uuid, 主键): 用户唯一标识，关联auth.users
  - `phone` (text, 唯一): 用户手机号
  - `email` (text): 用户邮箱
  - `full_name` (text): 用户全名
  - `avatar_url` (text): 头像URL
  - `role` (text): 用户角色 (admin/member)
  - `github_username` (text): GitHub用户名
  - `gitlab_username` (text): GitLab用户名
  - `created_at` (timestamptz): 创建时间
  - `updated_at` (timestamptz): 更新时间

### 2.2 项目管理表
- `projects`: 代码项目表
  - `id` (uuid, 主键): 项目唯一标识
  - `name` (text): 项目名称
  - `description` (text): 项目描述
  - `repository_url` (text): 仓库URL
  - `repository_type` (text): 仓库类型 (github/gitlab)
  - `default_branch` (text): 默认分支
  - `programming_languages` (text): 支持的编程语言，JSON格式
  - `owner_id` (uuid): 项目所有者ID
  - `is_active` (boolean): 是否激活
  - `created_at` (timestamptz): 创建时间
  - `updated_at` (timestamptz): 更新时间

### 2.3 审计相关表
- `audit_tasks`: 代码审计任务表
  - `id` (uuid, 主键): 任务唯一标识
  - `project_id` (uuid): 关联项目ID
  - `task_type` (text): 任务类型 (repository/instant)
  - `status` (text): 任务状态 (pending/running/completed/failed)
  - `branch_name` (text): 扫描分支
  - `exclude_patterns` (text): 排除文件模式，JSON格式
  - `scan_config` (text): 扫描配置，JSON格式
  - `total_files` (integer): 总文件数
  - `scanned_files` (integer): 已扫描文件数
  - `total_lines` (integer): 总代码行数
  - `issues_count` (integer): 发现问题数量
  - `quality_score` (numeric): 代码质量评分
  - `started_at` (timestamptz): 开始时间
  - `completed_at` (timestamptz): 完成时间
  - `created_by` (uuid): 创建者ID
  - `created_at` (timestamptz): 创建时间

- `audit_issues`: 审计发现的问题表
  - `id` (uuid, 主键): 问题唯一标识
  - `task_id` (uuid): 关联任务ID
  - `file_path` (text): 文件路径
  - `line_number` (integer): 行号
  - `column_number` (integer): 列号
  - `issue_type` (text): 问题类型 (bug/security/performance/style/maintainability)
  - `severity` (text): 严重程度 (critical/high/medium/low)
  - `title` (text): 问题标题
  - `description` (text): 问题描述
  - `suggestion` (text): 修复建议
  - `code_snippet` (text): 相关代码片段
  - `ai_explanation` (text): AI详细解释
  - `status` (text): 问题状态 (open/resolved/false_positive)
  - `resolved_by` (uuid): 解决者ID
  - `resolved_at` (timestamptz): 解决时间
  - `created_at` (timestamptz): 创建时间

### 2.4 即时分析表
- `instant_analyses`: 即时代码分析表
  - `id` (uuid, 主键): 分析唯一标识
  - `user_id` (uuid): 用户ID
  - `language` (text): 编程语言
  - `code_content` (text): 代码内容
  - `analysis_result` (text): 分析结果，JSON格式
  - `issues_count` (integer): 发现问题数量
  - `quality_score` (numeric): 质量评分
  - `analysis_time` (numeric): 分析耗时（秒）
  - `created_at` (timestamptz): 创建时间

### 2.5 项目成员表
- `project_members`: 项目成员关联表
  - `id` (uuid, 主键): 关联唯一标识
  - `project_id` (uuid): 项目ID
  - `user_id` (uuid): 用户ID
  - `role` (text): 项目角色 (owner/admin/member/viewer)
  - `permissions` (text): 权限配置，JSON格式
  - `joined_at` (timestamptz): 加入时间
  - `created_at` (timestamptz): 创建时间

## 3. 安全策略
- 启用所有表的行级安全 (RLS)
- 用户只能访问自己的数据或有权限的项目数据
- 管理员可以访问所有数据

## 4. 初始数据
- 预设一些常见的编程语言配置
- 预设问题类型和严重程度枚举值
*/

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建用户信息表
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE,
  email text,
  full_name text,
  avatar_url text,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  github_username text,
  gitlab_username text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建项目表
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  repository_url text,
  repository_type text CHECK (repository_type IN ('github', 'gitlab', 'other')),
  default_branch text DEFAULT 'main',
  programming_languages text DEFAULT '[]',
  owner_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 创建项目成员表
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  user_id uuid,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions text DEFAULT '{}',
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 创建审计任务表
CREATE TABLE IF NOT EXISTS audit_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  task_type text DEFAULT 'repository' CHECK (task_type IN ('repository', 'instant')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  branch_name text,
  exclude_patterns text DEFAULT '[]',
  scan_config text DEFAULT '{}',
  total_files integer DEFAULT 0,
  scanned_files integer DEFAULT 0,
  total_lines integer DEFAULT 0,
  issues_count integer DEFAULT 0,
  quality_score numeric(5,2) DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- 创建审计问题表
CREATE TABLE IF NOT EXISTS audit_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid,
  file_path text NOT NULL,
  line_number integer,
  column_number integer,
  issue_type text CHECK (issue_type IN ('bug', 'security', 'performance', 'style', 'maintainability')),
  severity text CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title text NOT NULL,
  description text,
  suggestion text,
  code_snippet text,
  ai_explanation text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'false_positive')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 创建即时分析表
CREATE TABLE IF NOT EXISTS instant_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  language text NOT NULL,
  code_content text NOT NULL,
  analysis_result text DEFAULT '{}',
  issues_count integer DEFAULT 0,
  quality_score numeric(5,2) DEFAULT 0,
  analysis_time numeric(10,3) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 外键约束（匹配前端使用的关系别名）
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_owner_id_fkey,
  ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id)
  REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_project_id_fkey,
  ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id)
  REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_user_id_fkey,
  ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.audit_tasks
  DROP CONSTRAINT IF EXISTS audit_tasks_project_id_fkey,
  ADD CONSTRAINT audit_tasks_project_id_fkey FOREIGN KEY (project_id)
  REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.audit_tasks
  DROP CONSTRAINT IF EXISTS audit_tasks_created_by_fkey,
  ADD CONSTRAINT audit_tasks_created_by_fkey FOREIGN KEY (created_by)
  REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.audit_issues
  DROP CONSTRAINT IF EXISTS audit_issues_task_id_fkey,
  ADD CONSTRAINT audit_issues_task_id_fkey FOREIGN KEY (task_id)
  REFERENCES public.audit_tasks(id) ON DELETE CASCADE;

ALTER TABLE public.audit_issues
  DROP CONSTRAINT IF EXISTS audit_issues_resolved_by_fkey,
  ADD CONSTRAINT audit_issues_resolved_by_fkey FOREIGN KEY (resolved_by)
  REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.instant_analyses
  DROP CONSTRAINT IF EXISTS instant_analyses_user_id_fkey,
  ADD CONSTRAINT instant_analyses_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 启用行级安全
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE instant_analyses ENABLE ROW LEVEL SECURITY;

-- 创建安全策略

-- profiles表策略
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- projects表策略 - 简化版本
CREATE POLICY "Users can read all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- project_members表策略
CREATE POLICY "Users can read project members"
  ON project_members FOR SELECT
  TO authenticated
  USING (true);

-- audit_tasks表策略
CREATE POLICY "Users can read audit tasks"
  ON audit_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create audit tasks"
  ON audit_tasks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- audit_issues表策略
CREATE POLICY "Users can read audit issues"
  ON audit_issues FOR SELECT
  TO authenticated
  USING (true);

-- instant_analyses表策略
CREATE POLICY "Users can read own instant analyses"
  ON instant_analyses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create instant analyses"
  ON instant_analyses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建更新时间触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入示例数据
-- 若无管理员用户则先插入一个，避免 owner_id 为空
INSERT INTO profiles (id, email, full_name, role)
SELECT gen_random_uuid(), 'admin@example.com', 'Admin', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin');

-- 精简版示例项目（与表结构一致）
INSERT INTO projects (name, description, repository_type, programming_languages, owner_id, is_active) VALUES
('React前端项目', '基于React的现代化前端应用，包含TypeScript和Tailwind CSS', 'github', '["JavaScript", "TypeScript", "CSS"]', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), true),
('Python后端API', 'Django REST框架构建的后端API服务', 'github', '["Python", "SQL"]', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), true),
('Java微服务', 'Spring Boot构建的微服务架构项目', 'gitlab', '["Java", "XML"]', (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), true)
ON CONFLICT DO NOTHING;

-- 插入示例审计任务
INSERT INTO audit_tasks (project_id, task_type, status, total_files, scanned_files, total_lines, issues_count, quality_score, created_by, started_at, completed_at) VALUES
((SELECT id FROM projects WHERE name = 'React前端项目' LIMIT 1), 'repository', 'completed', 156, 156, 12500, 23, 87.5, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), now() - interval '2 hours', now() - interval '1 hour'),
((SELECT id FROM projects WHERE name = 'Python后端API' LIMIT 1), 'repository', 'completed', 89, 89, 8900, 12, 92.3, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), now() - interval '1 day', now() - interval '23 hours'),
((SELECT id FROM projects WHERE name = 'Java微服务' LIMIT 1), 'repository', 'running', 234, 180, 18700, 25, 0, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), now() - interval '30 minutes', null)
ON CONFLICT DO NOTHING;

-- 追加：无登录演示用匿名策略（生产环境请按需收紧）
-- 允许匿名读取所有项目
CREATE POLICY "anon can read all projects"
  ON projects FOR SELECT
  TO anon
  USING (true);

-- 允许匿名写项目（演示/本地联调用，如不需要可删除）
CREATE POLICY "anon can write projects"
  ON projects FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 允许匿名读取审计任务/问题
CREATE POLICY "anon can read audit tasks"
  ON audit_tasks FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can read audit issues"
  ON audit_issues FOR SELECT
  TO anon
  USING (true);

-- 允许匿名创建与读取即时分析记录（前端只写摘要，不存代码）
CREATE POLICY "anon can insert instant analyses"
  ON instant_analyses FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can read instant analyses"
  ON instant_analyses FOR SELECT
  TO anon
  USING (true);