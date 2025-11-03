"""Repository Scanner
Main scanner service that orchestrates GitHub/GitLab/ZIP scanning.
"""
from typing import Dict, List, Optional, Any
from loguru import logger
from datetime import datetime

from services.repository.github_client import GitHubClient, parse_github_url
from services.repository.gitlab_client import GitLabClient, parse_gitlab_url
from services.repository.zip_handler import ZipHandler
from services.repository.file_filter import FileFilter
from core.exceptions import RepositoryError
from models.project import ProjectSource


class RepositoryScanner:
    """Repository scanner service"""
    
    def __init__(self):
        """Initialize repository scanner"""
        self.file_filter = FileFilter()
    
    async def scan_repository(
        self,
        source_type: ProjectSource,
        source_url: Optional[str] = None,
        zip_path: Optional[str] = None,
        branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scan repository and return file tree with metadata.
        
        Args:
            source_type: Source type (github, gitlab, zip, local)
            source_url: Repository URL (for github/gitlab)
            zip_path: Path to ZIP file (for zip)
            branch: Branch name (optional)
            
        Returns:
            Dictionary with scan results
        """
        try:
            if source_type == ProjectSource.GITHUB:
                return await self._scan_github(source_url, branch)
            elif source_type == ProjectSource.GITLAB:
                return await self._scan_gitlab(source_url, branch)
            elif source_type == ProjectSource.ZIP:
                return await self._scan_zip(zip_path)
            else:
                raise RepositoryError(f"Unsupported source type: {source_type}")
                
        except Exception as e:
            logger.error(f"Error scanning repository: {e}")
            raise
    
    async def _scan_github(
        self,
        url: str,
        branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scan GitHub repository.
        
        Args:
            url: GitHub repository URL
            branch: Branch name (optional)
            
        Returns:
            Scan results
        """
        try:
            # Parse URL
            owner, repo, default_branch = await parse_github_url(url)
            branch = branch or default_branch
            
            async with GitHubClient() as client:
                # Check rate limit
                if not await client.check_rate_limit():
                    raise RepositoryError("GitHub rate limit exceeded")
                
                # Get repository info
                repo_info = await client.get_repository(owner, repo)
                
                # Get file tree
                tree = await client.get_file_tree(owner, repo, branch)
                
                # Filter files
                files = self._convert_github_tree(tree)
                filtered_files = self.file_filter.filter_files(files)
                
                # Get languages
                languages = await client.get_languages(owner, repo)
                
                # Get statistics
                stats = self.file_filter.get_statistics(filtered_files)
                
                return {
                    "source_type": "github",
                    "repository_name": f"{owner}/{repo}",
                    "branch": branch,
                    "description": repo_info.get("description"),
                    "files": filtered_files,
                    "total_files": stats["total_files"],
                    "code_files": stats["code_files"],
                    "languages": languages,
                    "primary_language": stats["primary_language"],
                    "total_size": stats["total_size"],
                    "scanned_at": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error scanning GitHub repository: {e}")
            raise RepositoryError(f"Error scanning GitHub repository: {e}")
    
    async def _scan_gitlab(
        self,
        url: str,
        branch: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scan GitLab repository.
        
        Args:
            url: GitLab repository URL
            branch: Branch name (optional)
            
        Returns:
            Scan results
        """
        try:
            # Parse URL
            project_path, default_branch = await parse_gitlab_url(url)
            branch = branch or default_branch
            
            async with GitLabClient() as client:
                # Get project info
                project_info = await client.get_project(project_path)
                
                # Get repository tree
                tree = await client.get_repository_tree(project_path, ref=branch)
                
                # Filter files
                files = self._convert_gitlab_tree(tree)
                filtered_files = self.file_filter.filter_files(files)
                
                # Get languages
                languages = await client.get_languages(project_path)
                
                # Get statistics
                stats = self.file_filter.get_statistics(filtered_files)
                
                return {
                    "source_type": "gitlab",
                    "repository_name": project_path,
                    "branch": branch,
                    "description": project_info.get("description"),
                    "files": filtered_files,
                    "total_files": stats["total_files"],
                    "code_files": stats["code_files"],
                    "languages": languages,
                    "primary_language": stats["primary_language"],
                    "total_size": stats["total_size"],
                    "scanned_at": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error scanning GitLab repository: {e}")
            raise RepositoryError(f"Error scanning GitLab repository: {e}")
    
    async def _scan_zip(self, zip_path: str) -> Dict[str, Any]:
        """
        Scan ZIP file.
        
        Args:
            zip_path: Path to ZIP file
            
        Returns:
            Scan results
        """
        try:
            async with ZipHandler(zip_path) as handler:
                # Get file tree
                files = await handler.get_file_tree()
                
                # Filter files
                filtered_files = self.file_filter.filter_files(files)
                
                # Get statistics
                stats = self.file_filter.get_statistics(filtered_files)
                
                return {
                    "source_type": "zip",
                    "repository_name": "Uploaded ZIP",
                    "branch": None,
                    "description": None,
                    "files": filtered_files,
                    "total_files": stats["total_files"],
                    "code_files": stats["code_files"],
                    "languages": stats["languages"],
                    "primary_language": stats["primary_language"],
                    "total_size": stats["total_size"],
                    "scanned_at": datetime.utcnow().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error scanning ZIP file: {e}")
            raise RepositoryError(f"Error scanning ZIP file: {e}")
    
    def _convert_github_tree(self, tree: List[Dict]) -> List[Dict]:
        """
        Convert GitHub tree format to standard format.
        
        Args:
            tree: GitHub tree data
            
        Returns:
            Standardized file list
        """
        files = []
        
        for item in tree:
            if item.get("type") == "blob":  # File
                files.append({
                    "path": item.get("path"),
                    "type": "blob",
                    "size": item.get("size", 0),
                    "mode": item.get("mode"),
                    "sha": item.get("sha")
                })
        
        return files
    
    def _convert_gitlab_tree(self, tree: List[Dict]) -> List[Dict]:
        """
        Convert GitLab tree format to standard format.
        
        Args:
            tree: GitLab tree data
            
        Returns:
            Standardized file list
        """
        files = []
        
        for item in tree:
            if item.get("type") == "blob":  # File
                files.append({
                    "path": item.get("path"),
                    "type": "blob",
                    "size": 0,  # GitLab doesn't provide size in tree
                    "mode": item.get("mode"),
                    "id": item.get("id")
                })
        
        return files
    
    async def get_file_content(
        self,
        source_type: ProjectSource,
        file_path: str,
        source_url: Optional[str] = None,
        zip_path: Optional[str] = None,
        branch: Optional[str] = None
    ) -> str:
        """
        Get file content from repository.
        
        Args:
            source_type: Source type
            file_path: File path
            source_url: Repository URL (for github/gitlab)
            zip_path: Path to ZIP file (for zip)
            branch: Branch name (optional)
            
        Returns:
            File content as string
        """
        try:
            if source_type == ProjectSource.GITHUB:
                owner, repo, default_branch = await parse_github_url(source_url)
                branch = branch or default_branch
                
                async with GitHubClient() as client:
                    return await client.get_file_content(owner, repo, file_path, branch)
                    
            elif source_type == ProjectSource.GITLAB:
                project_path, default_branch = await parse_gitlab_url(source_url)
                branch = branch or default_branch
                
                async with GitLabClient() as client:
                    return await client.get_file_content(project_path, file_path, branch)
                    
            elif source_type == ProjectSource.ZIP:
                async with ZipHandler(zip_path) as handler:
                    return await handler.get_file_content(file_path)
                    
            else:
                raise RepositoryError(f"Unsupported source type: {source_type}")
                
        except Exception as e:
            logger.error(f"Error getting file content: {e}")
            raise RepositoryError(f"Error getting file content: {e}")


# Global scanner instance
_scanner: Optional[RepositoryScanner] = None


def get_repository_scanner() -> RepositoryScanner:
    """
    Get global repository scanner instance.
    
    Returns:
        Repository scanner instance
    """
    global _scanner
    if _scanner is None:
        _scanner = RepositoryScanner()
    return _scanner
