"""GitLab Client
Client for fetching repository data from GitLab.
"""
import httpx
from typing import Dict, List, Optional, Any
from loguru import logger
from urllib.parse import quote

from core.exceptions import RepositoryError
from app.config import settings


class GitLabClient:
    """GitLab API client"""
    
    API_BASE = "https://gitlab.com/api/v4"
    
    def __init__(self, token: Optional[str] = None, base_url: Optional[str] = None):
        """
        Initialize GitLab client.
        
        Args:
            token: GitLab personal access token (optional)
            base_url: GitLab API base URL (default: gitlab.com)
        """
        self.token = token or settings.GITLAB_TOKEN
        self.base_url = base_url or self.API_BASE
        
        headers = {
            "User-Agent": "XCodeReviewer"
        }
        
        if self.token:
            headers["PRIVATE-TOKEN"] = self.token
        
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=30.0
        )
    
    async def get_project(self, project_id: str) -> Dict[str, Any]:
        """
        Get project information.
        
        Args:
            project_id: Project ID or path (e.g., "owner/repo")
            
        Returns:
            Project information
        """
        try:
            # URL encode project ID
            encoded_id = quote(project_id, safe="")
            
            response = await self.client.get(f"/projects/{encoded_id}")
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RepositoryError(f"Project {project_id} not found")
            elif e.response.status_code == 401:
                raise RepositoryError("GitLab authentication failed")
            else:
                raise RepositoryError(f"GitLab API error: {e}")
        except Exception as e:
            logger.error(f"Error fetching project: {e}")
            raise RepositoryError(f"Error fetching project: {e}")
    
    async def get_repository_tree(
        self,
        project_id: str,
        path: str = "",
        ref: str = "main",
        recursive: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get repository tree.
        
        Args:
            project_id: Project ID or path
            path: Path within repository (default: root)
            ref: Branch or tag name (default: main)
            recursive: Get tree recursively (default: True)
            
        Returns:
            List of files and directories
        """
        try:
            encoded_id = quote(project_id, safe="")
            
            params = {
                "ref": ref,
                "recursive": str(recursive).lower(),
                "per_page": 100
            }
            
            if path:
                params["path"] = path
            
            all_items = []
            page = 1
            
            while True:
                params["page"] = page
                response = await self.client.get(
                    f"/projects/{encoded_id}/repository/tree",
                    params=params
                )
                response.raise_for_status()
                
                items = response.json()
                if not items:
                    break
                
                all_items.extend(items)
                
                # Check if there are more pages
                if "x-next-page" not in response.headers or not response.headers["x-next-page"]:
                    break
                
                page += 1
            
            return all_items
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RepositoryError(f"Branch {ref} not found in project {project_id}")
            else:
                raise RepositoryError(f"GitLab API error: {e}")
        except Exception as e:
            logger.error(f"Error fetching repository tree: {e}")
            raise RepositoryError(f"Error fetching repository tree: {e}")
    
    async def get_file_content(
        self,
        project_id: str,
        file_path: str,
        ref: str = "main"
    ) -> str:
        """
        Get file content from repository.
        
        Args:
            project_id: Project ID or path
            file_path: File path
            ref: Branch or tag name (default: main)
            
        Returns:
            File content as string
        """
        try:
            encoded_id = quote(project_id, safe="")
            encoded_path = quote(file_path, safe="")
            
            response = await self.client.get(
                f"/projects/{encoded_id}/repository/files/{encoded_path}/raw",
                params={"ref": ref}
            )
            response.raise_for_status()
            
            return response.text
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise RepositoryError(f"File {file_path} not found")
            else:
                raise RepositoryError(f"GitLab API error: {e}")
        except Exception as e:
            logger.error(f"Error fetching file content: {e}")
            raise RepositoryError(f"Error fetching file content: {e}")
    
    async def get_languages(self, project_id: str) -> Dict[str, float]:
        """
        Get project languages.
        
        Args:
            project_id: Project ID or path
            
        Returns:
            Dictionary of languages and their percentages
        """
        try:
            encoded_id = quote(project_id, safe="")
            
            response = await self.client.get(f"/projects/{encoded_id}/languages")
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error fetching languages: {e}")
            return {}
    
    async def get_branches(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get project branches.
        
        Args:
            project_id: Project ID or path
            
        Returns:
            List of branches
        """
        try:
            encoded_id = quote(project_id, safe="")
            
            response = await self.client.get(f"/projects/{encoded_id}/repository/branches")
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Error fetching branches: {e}")
            return []
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()


async def parse_gitlab_url(url: str) -> tuple[str, str]:
    """
    Parse GitLab URL to extract project path and branch.
    
    Args:
        url: GitLab URL
        
    Returns:
        Tuple of (project_path, branch)
    """
    import re
    
    # Pattern: https://gitlab.com/owner/repo or https://gitlab.com/owner/repo/-/tree/branch
    pattern = r"gitlab\.com/([^/]+/[^/]+)(?:/-/tree/([^/]+))?"
    match = re.search(pattern, url)
    
    if not match:
        raise RepositoryError(f"Invalid GitLab URL: {url}")
    
    project_path = match.group(1).replace(".git", "")
    branch = match.group(2) or "main"
    
    return project_path, branch
