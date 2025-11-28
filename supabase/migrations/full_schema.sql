-- 智能代码审计平台数据库架构
-- 创建时间: 2024-01-15
-- 版本: 1.0.0

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 用户配置表
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(100),
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    github_username VARCHAR(100),
    gitlab_username VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_type VARCHAR(20) DEFAULT 'repository' CHECK (source_type IN ('repository', 'zip')),
    repository_url TEXT,
    repository_type VARCHAR(20) DEFAULT 'other' CHECK (repository_type IN ('github', 'gitlab', 'other')),
    default_branch VARCHAR(100) DEFAULT 'main',
    programming_languages JSONB DEFAULT '[]',
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 项目成员表
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- 审计任务表
CREATE TABLE IF NOT EXISTS audit_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_type VARCHAR(20) DEFAULT 'repository' CHECK (task_type IN ('repository', 'instant')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    branch_name VARCHAR(100),
    exclude_patterns JSONB DEFAULT '[]',
    scan_config JSONB DEFAULT '{}',
    total_files INTEGER DEFAULT 0,
    scanned_files INTEGER DEFAULT 0,
    total_lines INTEGER DEFAULT 0,
    issues_count INTEGER DEFAULT 0,
    quality_score DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 审计问题表
CREATE TABLE IF NOT EXISTS audit_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES audit_tasks(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    line_number INTEGER,
    column_number INTEGER,
    issue_type VARCHAR(20) DEFAULT 'maintainability' CHECK (issue_type IN ('bug', 'security', 'performance', 'style', 'maintainability')),
    severity VARCHAR(20) DEFAULT 'low' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    suggestion TEXT,
    code_snippet TEXT,
    ai_explanation TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'false_positive')),
    resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 即时分析表
CREATE TABLE IF NOT EXISTS instant_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    language VARCHAR(50) NOT NULL,
    code_content TEXT DEFAULT '', -- 不存储实际代码内容，仅保留空字符串
    analysis_result JSONB DEFAULT '{}',
    issues_count INTEGER DEFAULT 0,
    quality_score DECIMAL(5,2) DEFAULT 0,
    analysis_time DECIMAL(8,3) DEFAULT 0, -- 分析耗时（秒）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 系统通知表
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_tasks_project_id ON audit_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_status ON audit_tasks(status);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_created_by ON audit_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_tasks_created_at ON audit_tasks(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_issues_task_id ON audit_issues(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_severity ON audit_issues(severity);
CREATE INDEX IF NOT EXISTS idx_audit_issues_status ON audit_issues(status);
CREATE INDEX IF NOT EXISTS idx_audit_issues_issue_type ON audit_issues(issue_type);

CREATE INDEX IF NOT EXISTS idx_instant_analyses_user_id ON instant_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_instant_analyses_language ON instant_analyses(language);
CREATE INDEX IF NOT EXISTS idx_instant_analyses_created_at ON instant_analyses(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认系统配置
INSERT INTO system_configs (key, value, description) VALUES
    ('max_file_size', '204800', '最大文件大小限制（字节）'),
    ('supported_languages', '["javascript", "typescript", "python", "java", "go", "rust", "cpp", "csharp", "php", "ruby"]', '支持的编程语言列表'),
    ('analysis_timeout', '25000', '分析超时时间（毫秒）'),
    ('max_concurrent_tasks', '5', '最大并发任务数'),
    ('notification_settings', '{"email_enabled": true, "webhook_url": null}', '通知设置')
ON CONFLICT (key) DO NOTHING;

-- 创建RLS (Row Level Security) 策略
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE instant_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 基本的RLS策略（可根据需要调整）
-- 用户只能查看和修改自己的数据
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- 项目访问策略
CREATE POLICY "Users can view projects they own or are members of" ON projects
    FOR SELECT USING (
        owner_id = auth.uid() OR 
        id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners can update their projects" ON projects
    FOR UPDATE USING (owner_id = auth.uid());

-- 项目成员策略
CREATE POLICY "Users can view project members for their projects" ON project_members
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid()
        ) OR user_id = auth.uid()
    );

-- 审计任务策略
CREATE POLICY "Users can view audit tasks for their projects" ON audit_tasks
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects WHERE owner_id = auth.uid() OR 
            id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
        )
    );

-- 即时分析策略
CREATE POLICY "Users can view own instant analyses" ON instant_analyses
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create instant analyses" ON instant_analyses
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- 通知策略
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- 创建视图以简化查询
CREATE OR REPLACE VIEW project_stats AS
SELECT 
    p.id,
    p.name,
    p.owner_id,
    COUNT(DISTINCT at.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN at.status = 'completed' THEN at.id END) as completed_tasks,
    COUNT(DISTINCT ai.id) as total_issues,
    COUNT(DISTINCT CASE WHEN ai.status = 'resolved' THEN ai.id END) as resolved_issues,
    AVG(at.quality_score) as avg_quality_score
FROM projects p
LEFT JOIN audit_tasks at ON p.id = at.project_id
LEFT JOIN audit_issues ai ON at.id = ai.task_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.owner_id;

-- 创建函数以获取项目统计信息
CREATE OR REPLACE FUNCTION get_project_stats()
RETURNS TABLE (
    total_projects BIGINT,
    active_projects BIGINT,
    total_tasks BIGINT,
    completed_tasks BIGINT,
    total_issues BIGINT,
    resolved_issues BIGINT,
    avg_quality_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT p.id) as total_projects,
        COUNT(DISTINCT CASE WHEN p.is_active THEN p.id END) as active_projects,
        COUNT(DISTINCT at.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN at.status = 'completed' THEN at.id END) as completed_tasks,
        COUNT(DISTINCT ai.id) as total_issues,
        COUNT(DISTINCT CASE WHEN ai.status = 'resolved' THEN ai.id END) as resolved_issues,
        AVG(at.quality_score) as avg_quality_score
    FROM projects p
    LEFT JOIN audit_tasks at ON p.id = at.project_id
    LEFT JOIN audit_issues ai ON at.id = ai.task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建清理过期数据的函数
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- 清理30天前的即时分析记录（不保留代码内容）
    DELETE FROM instant_analyses 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- 清理已读的通知（7天前）
    DELETE FROM notifications 
    WHERE read = true AND created_at < NOW() - INTERVAL '7 days';
    
    -- 清理失败的审计任务（7天前）
    DELETE FROM audit_tasks 
    WHERE status = 'failed' AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建定时清理任务（需要pg_cron扩展，可选）
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');

COMMENT ON TABLE profiles IS '用户配置表';
COMMENT ON TABLE projects IS '项目表';
COMMENT ON TABLE project_members IS '项目成员表';
COMMENT ON TABLE audit_tasks IS '审计任务表';
COMMENT ON TABLE audit_issues IS '审计问题表';
COMMENT ON TABLE instant_analyses IS '即时分析表';
COMMENT ON TABLE notifications IS '系统通知表';
COMMENT ON TABLE system_configs IS '系统配置表';

COMMENT ON FUNCTION get_project_stats() IS '获取项目统计信息';
COMMENT ON FUNCTION cleanup_old_data() IS '清理过期数据';

-- 完成
SELECT 'Database schema created successfully!' as message;