"""
仓库扫描服务 - 支持GitHub, GitLab 和 Gitea 仓库扫描
"""

import asyncio
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from urllib.parse import urlparse, quote
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.repo_utils import parse_repository_url
from app.models.audit import AuditTask, AuditIssue
from app.models.project import Project
from app.services.llm.service import LLMService
from app.core.config import settings


def get_analysis_config(user_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    获取分析配置参数（优先使用用户配置，然后使用系统配置）

    Returns:
        包含以下字段的字典:
        - max_analyze_files: 最大分析文件数
        - llm_concurrency: LLM 并发数
        - llm_gap_ms: LLM 请求间隔（毫秒）
    """
    other_config = (user_config or {}).get('otherConfig', {})

    return {
        'max_analyze_files': other_config.get('maxAnalyzeFiles') or settings.MAX_ANALYZE_FILES,
        'llm_concurrency': other_config.get('llmConcurrency') or settings.LLM_CONCURRENCY,
        'llm_gap_ms': other_config.get('llmGapMs') or settings.LLM_GAP_MS,
    }


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



async def gitea_api(url: str, token: str = None) -> Any:
    """调用Gitea API"""
    headers = {"Content-Type": "application/json"}
    t = token or settings.GITEA_TOKEN
    if t:
        headers["Authorization"] = f"token {t}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 401:
            raise Exception("Gitea API 401：请配置 GITEA_TOKEN 或确认仓库权限")
        if response.status_code == 403:
            raise Exception("Gitea API 403：请确认仓库权限/频率限制")
        if response.status_code != 200:
            raise Exception(f"Gitea API {response.status_code}: {url}")
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


async def get_github_branches(repo_url: str, token: str = None) -> List[str]:
    """获取GitHub仓库分支列表"""
    repo_info = parse_repository_url(repo_url, "github")
    owner, repo = repo_info['owner'], repo_info['repo']
    
    branches_url = f"https://api.github.com/repos/{owner}/{repo}/branches?per_page=100"
    branches_data = await github_api(branches_url, token)
    
    return [b["name"] for b in branches_data]





async def get_gitea_branches(repo_url: str, token: str = None) -> List[str]:
    """获取Gitea仓库分支列表"""
    repo_info = parse_repository_url(repo_url, "gitea")
    base_url = repo_info['base_url'] # This is {base}/api/v1
    owner, repo = repo_info['owner'], repo_info['repo']
    
    branches_url = f"{base_url}/repos/{owner}/{repo}/branches"
    branches_data = await gitea_api(branches_url, token)
    
    return [b["name"] for b in branches_data]


async def get_gitlab_branches(repo_url: str, token: str = None) -> List[str]:
    """获取GitLab仓库分支列表"""
    parsed = urlparse(repo_url)
    
    extracted_token = token
    if parsed.username:
        if parsed.username == 'oauth2' and parsed.password:
            extracted_token = parsed.password
        elif parsed.username and not parsed.password:
            extracted_token = parsed.username
    
    repo_info = parse_repository_url(repo_url, "gitlab")
    base_url = repo_info['base_url']
    project_path = quote(repo_info['project_path'], safe='')
    
    branches_url = f"{base_url}/projects/{project_path}/repository/branches?per_page=100"
    branches_data = await gitlab_api(branches_url, extracted_token)
    
    return [b["name"] for b in branches_data]


async def get_github_files(repo_url: str, branch: str, token: str = None, exclude_patterns: List[str] = None) -> List[Dict[str, str]]:
    """获取GitHub仓库文件列表"""
    # 解析仓库URL
    repo_info = parse_repository_url(repo_url, "github")
    owner, repo = repo_info['owner'], repo_info['repo']
    
    # 获取仓库文件树
    tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{quote(branch)}?recursive=1"
    tree_data = await github_api(tree_url, token)
    
    files = []
    for item in tree_data.get("tree", []):
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"], exclude_patterns):
            size = item.get("size", 0)
            if size <= settings.MAX_FILE_SIZE_BYTES:
                files.append({
                    "path": item["path"],
                    "url": f"https://raw.githubusercontent.com/{owner}/{repo}/{quote(branch)}/{item['path']}"
                })
    
    return files


async def get_gitlab_files(repo_url: str, branch: str, token: str = None, exclude_patterns: List[str] = None) -> List[Dict[str, str]]:
    """获取GitLab仓库文件列表"""
    parsed = urlparse(repo_url)
    
    # 从URL中提取token（如果存在）
    extracted_token = token
    if parsed.username:
        if parsed.username == 'oauth2' and parsed.password:
            extracted_token = parsed.password
        elif parsed.username and not parsed.password:
            extracted_token = parsed.username
    
    # 解析项目路径
    repo_info = parse_repository_url(repo_url, "gitlab")
    base_url = repo_info['base_url'] # {base}/api/v4
    project_path = quote(repo_info['project_path'], safe='')
    
    # 获取仓库文件树
    tree_url = f"{base_url}/projects/{project_path}/repository/tree?ref={quote(branch)}&recursive=true&per_page=100"
    tree_data = await gitlab_api(tree_url, extracted_token)
    
    files = []
    for item in tree_data:
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"], exclude_patterns):
            files.append({
                "path": item["path"],
                "url": f"{base_url}/projects/{project_path}/repository/files/{quote(item['path'], safe='')}/raw?ref={quote(branch)}",
                "token": extracted_token
            })
    
    return files



async def get_gitea_files(repo_url: str, branch: str, token: str = None, exclude_patterns: List[str] = None) -> List[Dict[str, str]]:
    """获取Gitea仓库文件列表"""
    repo_info = parse_repository_url(repo_url, "gitea")
    base_url = repo_info['base_url']
    owner, repo = repo_info['owner'], repo_info['repo']
    
    # Gitea tree API: GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1
    # 可以直接使用分支名作为sha
    tree_url = f"{base_url}/repos/{owner}/{repo}/git/trees/{quote(branch)}?recursive=1"
    tree_data = await gitea_api(tree_url, token)
    
    files = []
    for item in tree_data.get("tree", []):
         # Gitea API returns 'type': 'blob' for files
        if item.get("type") == "blob" and is_text_file(item["path"]) and not should_exclude(item["path"], exclude_patterns):
            # 使用API raw endpoint: GET /repos/{owner}/{repo}/raw/{filepath}?ref={branch}
             files.append({
                "path": item["path"],
                "url": f"{base_url}/repos/{owner}/{repo}/raw/{quote(item['path'])}?ref={quote(branch)}",
                "token": token # 传递token以便fetch_file_content使用
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
            task.started_at = datetime.now(timezone.utc)
            await db.commit()
            
            # 创建使用用户配置的LLM服务实例
            llm_service = LLMService(user_config=user_config or {})

            # 2. 获取项目信息
            project = await db.get(Project, task.project_id)
            if not project:
                raise Exception("项目不存在")
            
            # 检查项目类型 - 仅支持仓库类型项目
            source_type = getattr(project, 'source_type', 'repository')
            if source_type == 'zip':
                raise Exception("ZIP类型项目请使用ZIP上传扫描接口")
            
            if not project.repository_url:
                raise Exception("仓库地址不存在")

            repo_url = project.repository_url
            branch = task.branch_name or project.default_branch or "main"
            repo_type = project.repository_type or "other"
            
            # 解析任务的排除模式
            import json as json_module
            task_exclude_patterns = []
            if task.exclude_patterns:
                try:
                    task_exclude_patterns = json_module.loads(task.exclude_patterns)
                except:
                    pass

            print(f"🚀 开始扫描仓库: {repo_url}, 分支: {branch}, 类型: {repo_type}, 来源: {source_type}")
            if task_exclude_patterns:
                print(f"📋 排除模式: {task_exclude_patterns}")

            # 3. 获取文件列表
            # 从用户配置中读取 GitHub/GitLab Token（优先使用用户配置，然后使用系统配置）
            user_other_config = (user_config or {}).get('otherConfig', {})
            github_token = user_other_config.get('githubToken') or settings.GITHUB_TOKEN
            gitlab_token = user_other_config.get('gitlabToken') or settings.GITLAB_TOKEN
            gitea_token = user_other_config.get('giteaToken') or settings.GITEA_TOKEN

            

            # 获取SSH私钥（如果配置了）
            ssh_private_key = None
            if 'sshPrivateKey' in user_other_config:
                from app.core.encryption import decrypt_sensitive_data
                ssh_private_key = decrypt_sensitive_data(user_other_config['sshPrivateKey'])

            files: List[Dict[str, str]] = []
            extracted_gitlab_token = None

            # 检查是否为SSH URL
            from app.services.git_ssh_service import GitSSHOperations
            is_ssh_url = GitSSHOperations.is_ssh_url(repo_url)

            if is_ssh_url:
                # 使用SSH方式获取文件
                if not ssh_private_key:
                    raise Exception("仓库使用SSH URL，但未配置SSH密钥。请先生成并配置SSH密钥。")

                print(f"🔐 使用SSH方式访问仓库: {repo_url}")
                try:
                    files_with_content = GitSSHOperations.get_repo_files_via_ssh(
                        repo_url, ssh_private_key, branch, task_exclude_patterns
                    )
                    # 转换为统一格式
                    files = [{'path': f['path'], 'content': f['content']} for f in files_with_content]
                    actual_branch = branch
                    print(f"✅ 通过SSH成功获取 {len(files)} 个文件")
                except Exception as e:
                    raise Exception(f"SSH方式获取仓库文件失败: {str(e)}")
            else:
                # 使用API方式获取文件（原有逻辑）
                # 构建分支尝试顺序（分支降级机制）
                branches_to_try = [branch]
                if project.default_branch and project.default_branch != branch:
                    branches_to_try.append(project.default_branch)
                for common_branch in ["main", "master"]:
                    if common_branch not in branches_to_try:
                        branches_to_try.append(common_branch)

                actual_branch = branch  # 实际使用的分支
                last_error = None

                for try_branch in branches_to_try:
                    try:
                        print(f"🔄 尝试获取分支 {try_branch} 的文件列表...")
                        if repo_type == "github":
                            files = await get_github_files(repo_url, try_branch, github_token, task_exclude_patterns)
                        elif repo_type == "gitlab":
                            files = await get_gitlab_files(repo_url, try_branch, gitlab_token, task_exclude_patterns)
                            # GitLab文件可能带有token
                            if files and 'token' in files[0]:
                                extracted_gitlab_token = files[0].get('token')
                        elif repo_type == "gitea":
                            files = await get_gitea_files(repo_url, try_branch, gitea_token, task_exclude_patterns)
                        else:
                            raise Exception("不支持的仓库类型，仅支持 GitHub, GitLab 和 Gitea 仓库")

                        if files:
                            actual_branch = try_branch
                            if try_branch != branch:
                                print(f"⚠️ 分支 {branch} 不存在或无法访问，已降级到分支 {try_branch}")
                            break
                    except Exception as e:
                        last_error = str(e)
                        print(f"⚠️ 获取分支 {try_branch} 失败: {last_error[:100]}")
                        continue

                if not files:
                    error_msg = f"无法获取仓库文件，所有分支尝试均失败"
                    if last_error:
                        if "404" in last_error or "Not Found" in last_error:
                            error_msg = f"仓库或分支不存在: {branch}"
                        elif "401" in last_error or "403" in last_error:
                            error_msg = "无访问权限，请检查 Token 配置"
                        else:
                            error_msg = f"获取文件失败: {last_error[:100]}"
                    raise Exception(error_msg)

            print(f"✅ 成功获取分支 {actual_branch} 的文件列表")

            # 获取分析配置（优先使用用户配置）
            analysis_config = get_analysis_config(user_config)
            max_analyze_files = analysis_config['max_analyze_files']
            llm_gap_ms = analysis_config['llm_gap_ms']

            # 限制文件数量
            # 如果指定了特定文件，则只分析这些文件
            target_files = (user_config or {}).get('scan_config', {}).get('file_paths', [])
            if target_files:
                print(f"🎯 指定分析 {len(target_files)} 个文件")
                files = [f for f in files if f['path'] in target_files]
            elif max_analyze_files > 0:
                files = files[:max_analyze_files]

            task.total_files = len(files)
            await db.commit()

            print(f"📊 获取到 {len(files)} 个文件，开始分析 (最大文件数: {max_analyze_files}, 请求间隔: {llm_gap_ms}ms)")

            # 4. 分析文件
            total_issues = 0
            total_lines = 0
            quality_scores = []
            scanned_files = 0
            failed_files = 0
            skipped_files = 0  # 跳过的文件（空文件、太大等）
            consecutive_failures = 0
            MAX_CONSECUTIVE_FAILURES = 5

            for file_info in files:
                # 检查是否取消
                if task_control.is_cancelled(task_id):
                    print(f"🛑 任务 {task_id} 已被用户取消")
                    task.status = "cancelled"
                    task.completed_at = datetime.now(timezone.utc)
                    await db.commit()
                    task_control.cleanup_task(task_id)
                    return

                # 检查连续失败次数
                if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                    print(f"❌ 任务 {task_id}: 连续失败 {consecutive_failures} 次，停止分析")
                    raise Exception(f"连续失败 {consecutive_failures} 次，可能是 LLM API 服务异常")

                try:
                    # 获取文件内容

                    if is_ssh_url:
                        # SSH方式已经包含了文件内容
                        content = file_info.get('content', '')
                        print(f"📥 正在处理SSH文件: {file_info['path']}")
                    else:
                        headers = {}
                        # 使用提取的 token 或用户配置的 token
                        
                        if repo_type == "gitlab":
                            token_to_use = file_info.get('token') or gitlab_token
                            if token_to_use:
                                headers["PRIVATE-TOKEN"] = token_to_use
                        elif repo_type == "gitea":
                            token_to_use = file_info.get('token') or gitea_token
                            if token_to_use:
                                headers["Authorization"] = f"token {token_to_use}"
                        elif repo_type == "github":
                            # GitHub raw URL 也是直接下载，通常public不需要token，private需要
                            # GitHub raw user content url: raw.githubusercontent.com
                            if github_token:
                                headers["Authorization"] = f"Bearer {github_token}"
                        
                        print(f"📥 正在获取文件: {file_info['path']}")
                        content = await fetch_file_content(file_info["url"], headers)

                    if not content or not content.strip():
                        print(f"⚠️ 文件内容为空，跳过: {file_info['path']}")
                        skipped_files += 1
                        continue
                    
                    if len(content) > settings.MAX_FILE_SIZE_BYTES:
                        print(f"⚠️ 文件太大，跳过: {file_info['path']}")
                        skipped_files += 1
                        continue
                    
                    file_lines = content.split('\n')
                    total_lines = len(file_lines) + 1
                    language = get_language_from_path(file_info["path"])
                    
                    print(f"🤖 正在调用 LLM 分析: {file_info['path']} ({language}, {len(content)} bytes)")
                    # LLM分析 - 支持规则集和提示词模板
                    scan_config = (user_config or {}).get('scan_config', {})
                    rule_set_id = scan_config.get('rule_set_id')
                    prompt_template_id = scan_config.get('prompt_template_id')
                    
                    if rule_set_id or prompt_template_id:
                        analysis = await llm_service.analyze_code_with_rules(
                            content, language,
                            rule_set_id=rule_set_id,
                            prompt_template_id=prompt_template_id,
                            db_session=db
                        )
                    else:
                        analysis = await llm_service.analyze_code(content, language)
                    print(f"✅ LLM 分析完成: {file_info['path']}")
                    
                    # 再次检查是否取消（LLM分析后）
                    if task_control.is_cancelled(task_id):
                        print(f"🛑 任务 {task_id} 在LLM分析后被取消")
                        task.status = "cancelled"
                        task.completed_at = datetime.now(timezone.utc)
                        await db.commit()
                        task_control.cleanup_task(task_id)
                        return
                    
                    # 保存问题
                    issues = analysis.get("issues", [])
                    for issue in issues:
                        line_num = issue.get("line", 1)
                        
                        # 健壮的代码片段提取逻辑
                        # 优先使用 LLM 返回的片段，如果为空则从源码提取
                        code_snippet = issue.get("code_snippet")
                        if not code_snippet or len(code_snippet.strip()) < 5:
                            # 从源码提取上下文 (前后2行)
                            try:
                                # line_num 是 1-based
                                idx = max(0, int(line_num) - 1)
                                start = max(0, idx - 2)
                                end = min(len(file_lines), idx + 3)
                                code_snippet = '\n'.join(file_lines[start:end])
                            except Exception:
                                code_snippet = ""

                        audit_issue = AuditIssue(
                            task_id=task.id,
                            file_path=file_info["path"],
                            line_number=line_num,
                            column_number=issue.get("column"),
                            issue_type=issue.get("type", "maintainability"),
                            severity=issue.get("severity", "low"),
                            title=issue.get("title", "Issue"),
                            message=issue.get("description") or issue.get("title", "Issue"),
                            suggestion=issue.get("suggestion"),
                            code_snippet=code_snippet,
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
                    await asyncio.sleep(llm_gap_ms / 1000)
                    
                except Exception as file_error:
                    failed_files += 1
                    consecutive_failures += 1
                    # 打印详细错误信息
                    import traceback
                    print(f"❌ 分析文件失败 ({file_info['path']}): {file_error}")
                    print(f"   错误类型: {type(file_error).__name__}")
                    print(f"   详细信息: {traceback.format_exc()}")
                    await asyncio.sleep(llm_gap_ms / 1000)

            # 5. 完成任务
            avg_quality_score = sum(quality_scores) / len(quality_scores) if quality_scores else 100.0
            
            # 判断任务状态
            # 如果所有文件都被跳过（空文件等），标记为完成但给出提示
            if len(files) > 0 and scanned_files == 0 and skipped_files == len(files):
                task.status = "completed"
                task.completed_at = datetime.now(timezone.utc)
                task.scanned_files = 0
                task.total_lines = 0
                task.issues_count = 0
                task.quality_score = 100.0
                await db.commit()
                print(f"⚠️ 任务 {task_id} 完成: 所有 {len(files)} 个文件均为空或被跳过，无需分析")
            # 如果有文件需要分析但全部失败（LLM调用失败），标记为失败
            elif len(files) > 0 and scanned_files == 0 and failed_files > 0:
                task.status = "failed"
                task.completed_at = datetime.now(timezone.utc)
                task.scanned_files = 0
                task.total_lines = total_lines
                task.issues_count = 0
                task.quality_score = 0
                await db.commit()
                print(f"❌ 任务 {task_id} 失败: {failed_files} 个文件分析失败，请检查 LLM API 配置")
            else:
                task.status = "completed"
                task.completed_at = datetime.now(timezone.utc)
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
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
            task_control.cleanup_task(task_id)
