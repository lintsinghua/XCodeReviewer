"""
仓库扫描服务 - 支持GitHub和GitLab仓库扫描
"""

import asyncio
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from urllib.parse import urlparse, quote
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditTask, AuditIssue
from app.models.project import Project
from app.services.llm.service import LLMService
from app.core.config import settings


# 支持的文本文件扩展名
TEXT_EXTENSIONS = [
    ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", 
    ".cpp", ".c", ".h", ".cc", ".hh", ".cs", ".php", ".rb", 
    ".kt", ".swift", ".sql", ".sh", ".json", ".yml", ".yaml"
]

# 排除的目录和文件模式
EXCLUDE_PATTERNS = [
    "node_modules/", "vendor/", "dist/", "build/", ".git/",
    "__pycache__/", ".pytest_cache/", "coverage/", ".nyc_output/",
    ".vscode/", ".idea/", ".vs/", "target/", "out/",
    "__MACOSX/", ".DS_Store", "package-lock.json", "yarn.lock",
    "pnpm-lock.yaml", ".min.js", ".min.css", ".map"
]


def is_text_file(path: str) -> bool:
    """检查是否为文本文件"""
    return any(path.lower().endswith(ext) for ext in TEXT_EXTENSIONS)


def should_exclude(path: str, exclude_patterns: List[str] = None) -> bool:
    """检查是否应该排除该文件"""
    all_patterns = EXCLUDE_PATTERNS + (exclude_patterns or [])
    return any(pattern in path for pattern in all_patterns)


def get_language_from_path(path: str) -> str:
    """从文件路径获取语言类型"""
    ext = path.split('.')[-1].lower() if '.' in path else ''
    language_map = {
        'js': 'javascript', 'jsx': 'javascript',
        'ts': 'typescript', 'tsx': 'typescript',
        'py': 'python', 'java': 'java', 'go': 'go',
        'rs': 'rust', 'cpp': 'cpp', 'c': 'cpp',
        'cc': 'cpp', 'h': 'cpp', 'hh': 'cpp',
        'cs': 'csharp', 'php': 'php', 'rb': 'ruby',
        'kt': 'kotlin', 'swift': 'swift'
    }
    return language_map.get(ext, 'text')


class TaskControlManager:
    """任务控制管理器 - 用于取消运行中的任务"""
    
    def __init__(self):
        self._cancelled_tasks: set = set()
    
    def cancel_task(self, task_id: str):
        """取消任务"""
        self._cancelled_tasks.add(task_id)
        print(f"🛑 任务 {task_id} 已标记为取消")
    
    def is_cancelled(self, task_id: str) -> bool:
        """检查任务是否被取消"""
        return task_id in self._cancelled_tasks
    
    def cleanup_task(self, task_id: str):
        """清理已完成任务的控制状态"""
        self._cancelled_tasks.discard(task_id)


# 全局任务控制器
task_control = TaskControlManager()


async def github_api(url: str, token: str = None) -> Any:
    """调用GitHub API"""
    headers = {"Accept": "application/vnd.github+json"}
    t = token or settings.GITHUB_TOKEN
    if t:
        headers["Authorization"] = f"Bearer {t}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 403:
            raise Exception("GitHub API 403：请配置 GITHUB_TOKEN 或确认仓库权限/频率限制")
        if response.status_code != 200:
            raise Exception(f"GitHub API {response.status_code}: {url}")
        return response.json()


async def gitlab_api(url: str, token: str = None) -> Any:
    """调用GitLab API"""
    headers = {"Content-Type": "application/json"}
    t = token or settings.GITLAB_TOKEN
    if t:
        headers["PRIVATE-TOKEN"] = t
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 401:
            raise Exception("GitLab API 401：请配置 GITLAB_TOKEN 或确认仓库权限")
        if response.status_code == 403:
            raise Exception("GitLab API 403：请确认仓库权限/频率限制")
        if response.status_code != 200:
            raise Exception(f"GitLab API {response.status_code}: {url}")
        return response.json()


async def fetch_file_content(url: str, headers: Dict[str, str] = None) -> Optional[str]:
    """获取文件内容"""
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.get(url, headers=headers or {})
            if response.status_code == 200:
                return response.text
        except Exception as e:
            print(f"获取文件内容失败: {url}, 错误: {e}")
    return None


async def get_github_files(repo_url: str, branch: str, token: str = None) -> List[Dict[str, str]]:
    """获取GitHub仓库文件列表"""
    # 解析仓库URL
    match = repo_url.rstrip('/').rstrip('.git')
    if 'github.com/' in match:
        parts = match.split('github.com/')[-1].split('/')
        if len(parts) >= 2:
            owner, repo = parts[0], parts[1]
        else:
            raise Exception("GitHub 仓库 URL 格式错误")
    else:
        raise Exception("GitHub 仓库 URL 格式错误")
    
    # 获取仓库文件树
    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{quote(branch)}?recursive=1"
    tree_data = await github_api(tree_url, token)
    
    files = []
    for item in tree_data.get("tree", []):
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"]):
            size = item.get("size", 0)
            if size <= settings.MAX_FILE_SIZE_BYTES:
                files.append({
                    "path": item["path"],
                    "url": f"https://raw.githubusercontent.com/{owner}/{repo}/{quote(branch)}/{item['path']}"
                })
    
    return files


async def get_gitlab_files(repo_url: str, branch: str, token: str = None) -> List[Dict[str, str]]:
    """获取GitLab仓库文件列表"""
    parsed = urlparse(repo_url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    
    # 从URL中提取token（如果存在）
    extracted_token = token
    if parsed.username:
        if parsed.username == 'oauth2' and parsed.password:
            extracted_token = parsed.password
        elif parsed.username and not parsed.password:
            extracted_token = parsed.username
    
    # 解析项目路径
    path = parsed.path.strip('/').rstrip('.git')
    if not path:
        raise Exception("GitLab 仓库 URL 格式错误")
    
    project_path = quote(path, safe='')
    
    # 获取仓库文件树
    tree_url = f"{base}/api/v4/projects/{project_path}/repository/tree?ref={quote(branch)}&recursive=true&per_page=100"
    tree_data = await gitlab_api(tree_url, extracted_token)
    
    files = []
    for item in tree_data:
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"]):
            files.append({
                "path": item["path"],
                "url": f"{base}/api/v4/projects/{project_path}/repository/files/{quote(item['path'], safe='')}/raw?ref={quote(branch)}",
                "token": extracted_token
            })
    
    return files


async def scan_repo_task(task_id: str, db_session_factory, user_config: dict = None):
    """
    后台仓库扫描任务
    
    Args:
        task_id: 任务ID
        db_session_factory: 数据库会话工厂
        user_config: 用户配置字典（包含llmConfig和otherConfig）
    """
    async with db_session_factory() as db:
        task = await db.get(AuditTask, task_id)
        if not task:
            return

        try:
            # 1. 更新状态为运行中
            task.status = "running"
            task.started_at = datetime.utcnow()
            await db.commit()
            
            # 创建使用用户配置的LLM服务实例
            llm_service = LLMService(user_config=user_config or {})

            # 2. 获取项目信息
            project = await db.get(Project, task.project_id)
            if not project or not project.repository_url:
                raise Exception("仓库地址不存在")

            repo_url = project.repository_url
            branch = task.branch_name or project.default_branch or "main"
            repo_type = project.repository_type or "other"

            print(f"🚀 开始扫描仓库: {repo_url}, 分支: {branch}, 类型: {repo_type}")

            # 3. 获取文件列表
            # 从用户配置中读取 GitHub/GitLab Token（优先使用用户配置，然后使用系统配置）
            user_other_config = (user_config or {}).get('otherConfig', {})
            github_token = user_other_config.get('githubToken') or settings.GITHUB_TOKEN
            gitlab_token = user_other_config.get('gitlabToken') or settings.GITLAB_TOKEN
            
            files: List[Dict[str, str]] = []
            extracted_gitlab_token = None
            
            if repo_type == "github":
                files = await get_github_files(repo_url, branch, github_token)
            elif repo_type == "gitlab":
                files = await get_gitlab_files(repo_url, branch, gitlab_token)
                # GitLab文件可能带有token
                if files and 'token' in files[0]:
                    extracted_gitlab_token = files[0].get('token')
            else:
                raise Exception("不支持的仓库类型，仅支持 GitHub 和 GitLab 仓库")

            # 限制文件数量
            files = files[:settings.MAX_ANALYZE_FILES]
            
            task.total_files = len(files)
            await db.commit()

            print(f"📊 获取到 {len(files)} 个文件，开始分析")

            # 4. 分析文件
            total_issues = 0
            total_lines = 0
            quality_scores = []
            scanned_files = 0
            failed_files = 0
            consecutive_failures = 0
            MAX_CONSECUTIVE_FAILURES = 5

            for file_info in files:
                # 检查是否取消
                if task_control.is_cancelled(task_id):
                    print(f"🛑 任务 {task_id} 已被用户取消")
                    task.status = "cancelled"
                    task.completed_at = datetime.utcnow()
                    await db.commit()
                    task_control.cleanup_task(task_id)
                    return

                # 检查连续失败次数
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    print(f"❌ 任务 {task_id}: 连续失败 {consecutive_failures} 次，停止分析")
                    raise Exception(f"连续失败 {consecutive_failures} 次，可能是 LLM API 服务异常")

                try:
                    # 获取文件内容
                    headers = {}
                    # 使用提取的 GitLab token 或用户配置的 token
                    token_to_use = extracted_gitlab_token or gitlab_token
                    if token_to_use:
                        headers["PRIVATE-TOKEN"] = token_to_use
                    
                    content = await fetch_file_content(file_info["url"], headers)
                    if not content:
                        continue
                    
                    if len(content) > settings.MAX_FILE_SIZE_BYTES:
                        continue
                    
                    total_lines += content.count('\n') + 1
                    language = get_language_from_path(file_info["path"])
                    
                    # LLM分析
                    analysis = await llm_service.analyze_code(content, language)
                    
                    # 再次检查是否取消（LLM分析后）
                    if task_control.is_cancelled(task_id):
                        print(f"🛑 任务 {task_id} 在LLM分析后被取消")
                        task.status = "cancelled"
                        task.completed_at = datetime.utcnow()
                        await db.commit()
                        task_control.cleanup_task(task_id)
                        return
                    
                    # 保存问题
                    issues = analysis.get("issues", [])
                    for issue in issues:
                        audit_issue = AuditIssue(
                            task_id=task.id,
                            file_path=file_info["path"],
                            line_number=issue.get("line", 1),
                            column_number=issue.get("column"),
                            issue_type=issue.get("type", "maintainability"),
                            severity=issue.get("severity", "low"),
                            title=issue.get("title", "Issue"),
                            message=issue.get("description") or issue.get("title", "Issue"),
                            suggestion=issue.get("suggestion"),
                            code_snippet=issue.get("code_snippet"),
                            ai_explanation=issue.get("ai_explanation"),
                            status="open"
                        )
                        db.add(audit_issue)
                        total_issues += 1
                    
                    if "quality_score" in analysis:
                        quality_scores.append(analysis["quality_score"])
                    
                    consecutive_failures = 0  # 成功后重置
                    scanned_files += 1
                    
                    # 更新进度
                    task.scanned_files = scanned_files
                    task.total_lines = total_lines
                    task.issues_count = total_issues
                    await db.commit()
                    
                    print(f"📈 任务 {task_id}: 进度 {scanned_files}/{len(files)} ({int(scanned_files/len(files)*100)}%)")
                    
                    # 请求间隔
                    await asyncio.sleep(settings.LLM_GAP_MS / 1000)
                    
                except Exception as file_error:
                    failed_files += 1
                    consecutive_failures += 1
                    print(f"❌ 分析文件失败 ({file_info['path']}): {file_error}")
                    await asyncio.sleep(settings.LLM_GAP_MS / 1000)

            # 5. 完成任务
            avg_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 100.0
            
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            task.scanned_files = scanned_files
            task.total_lines = total_lines
            task.issues_count = total_issues
            task.quality_score = avg_quality_score
            await db.commit()
            
            print(f"✅ 任务 {task_id} 完成: 扫描 {scanned_files} 个文件, 发现 {total_issues} 个问题, 质量分 {avg_quality_score:.1f}")
            task_control.cleanup_task(task_id)

        except Exception as e:
            print(f"❌ 扫描失败: {e}")
            task.status = "failed"
            task.completed_at = datetime.utcnow()
            await db.commit()
            task_control.cleanup_task(task_id)
