"""Data Exporter
Exports user data from backend database to JSON format for migration.
"""
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from models.user import User
from models.project import Project
from models.audit_task import AuditTask
from models.audit_issue import AuditIssue


class DataExporter:
    """Export user data from database to JSON format"""
    
    SCHEMA_VERSION = "2.0.0"
    
    def __init__(self, db: AsyncSession):
        """
        Initialize data exporter.
        
        Args:
            db: Database session
        """
        self.db = db
    
    async def export_user_data(
        self,
        user_id: str,
        include_projects: bool = True,
        include_tasks: bool = True,
        include_issues: bool = True,
        include_settings: bool = True
    ) -> Dict[str, Any]:
        """
        Export all data for a specific user.
        
        Args:
            user_id: User ID to export data for
            include_projects: Include project data
            include_tasks: Include audit task data
            include_issues: Include audit issue data
            include_settings: Include user settings
            
        Returns:
            Dictionary containing exported data
        """
        logger.info(f"Starting data export for user {user_id}")
        
        export_data = {
            "schema_version": self.SCHEMA_VERSION,
            "export_timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "data": {}
        }
        
        try:
            # Export user profile
            user = await self._export_user_profile(user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")
            
            export_data["data"]["user"] = user
            
            # Export projects
            if include_projects:
                projects = await self._export_projects(user_id)
                export_data["data"]["projects"] = projects
                logger.info(f"Exported {len(projects)} projects")
            
            # Export audit tasks
            if include_tasks:
                tasks = await self._export_audit_tasks(user_id)
                export_data["data"]["audit_tasks"] = tasks
                logger.info(f"Exported {len(tasks)} audit tasks")
            
            # Export audit issues
            if include_issues:
                issues = await self._export_audit_issues(user_id)
                export_data["data"]["audit_issues"] = issues
                logger.info(f"Exported {len(issues)} audit issues")
            
            # Export user settings
            if include_settings:
                settings = await self._export_user_settings(user_id)
                export_data["data"]["settings"] = settings
                logger.info("Exported user settings")
            
            # Add statistics
            export_data["statistics"] = {
                "total_projects": len(export_data["data"].get("projects", [])),
                "total_tasks": len(export_data["data"].get("audit_tasks", [])),
                "total_issues": len(export_data["data"].get("audit_issues", [])),
            }
            
            logger.info(f"Data export completed for user {user_id}")
            return export_data
            
        except Exception as e:
            logger.error(f"Error exporting data for user {user_id}: {e}")
            raise
    
    async def _export_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Export user profile data"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            return None
        
        return {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        }
    
    async def _export_projects(self, user_id: str) -> List[Dict[str, Any]]:
        """Export user's projects"""
        result = await self.db.execute(
            select(Project).where(Project.user_id == user_id)
        )
        projects = result.scalars().all()
        
        return [
            {
                "id": str(project.id),
                "name": project.name,
                "description": project.description,
                "repository_url": project.repository_url,
                "repository_type": project.repository_type,
                "default_branch": project.default_branch,
                "language": project.language,
                "status": project.status,
                "created_at": project.created_at.isoformat() if project.created_at else None,
                "updated_at": project.updated_at.isoformat() if project.updated_at else None,
            }
            for project in projects
        ]
    
    async def _export_audit_tasks(self, user_id: str) -> List[Dict[str, Any]]:
        """Export user's audit tasks"""
        # Get user's projects first
        result = await self.db.execute(
            select(Project.id).where(Project.user_id == user_id)
        )
        project_ids = [row[0] for row in result.all()]
        
        if not project_ids:
            return []
        
        # Get tasks for user's projects
        result = await self.db.execute(
            select(AuditTask).where(AuditTask.project_id.in_(project_ids))
        )
        tasks = result.scalars().all()
        
        return [
            {
                "id": str(task.id),
                "project_id": str(task.project_id),
                "task_type": task.task_type,
                "status": task.status,
                "progress": task.progress,
                "total_files": task.total_files,
                "analyzed_files": task.analyzed_files,
                "issues_found": task.issues_found,
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                "error_message": task.error_message,
                "result_summary": task.result_summary,
                "created_at": task.created_at.isoformat() if task.created_at else None,
                "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            }
            for task in tasks
        ]
    
    async def _export_audit_issues(self, user_id: str) -> List[Dict[str, Any]]:
        """Export user's audit issues"""
        # Get user's tasks first
        result = await self.db.execute(
            select(Project.id).where(Project.user_id == user_id)
        )
        project_ids = [row[0] for row in result.all()]
        
        if not project_ids:
            return []
        
        result = await self.db.execute(
            select(AuditTask.id).where(AuditTask.project_id.in_(project_ids))
        )
        task_ids = [row[0] for row in result.all()]
        
        if not task_ids:
            return []
        
        # Get issues for user's tasks
        result = await self.db.execute(
            select(AuditIssue).where(AuditIssue.task_id.in_(task_ids))
        )
        issues = result.scalars().all()
        
        return [
            {
                "id": str(issue.id),
                "task_id": str(issue.task_id),
                "severity": issue.severity,
                "category": issue.category,
                "title": issue.title,
                "description": issue.description,
                "file_path": issue.file_path,
                "line_number": issue.line_number,
                "code_snippet": issue.code_snippet,
                "suggestion": issue.suggestion,
                "status": issue.status,
                "created_at": issue.created_at.isoformat() if issue.created_at else None,
                "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
            }
            for issue in issues
        ]
    
    async def _export_user_settings(self, user_id: str) -> Dict[str, Any]:
        """Export user settings (placeholder for future implementation)"""
        # TODO: Implement when user settings model is added
        return {
            "theme": "light",
            "language": "en",
            "notifications_enabled": True,
        }
    
    def export_to_json(self, data: Dict[str, Any], filepath: str) -> None:
        """
        Export data to JSON file.
        
        Args:
            data: Data to export
            filepath: Path to output file
        """
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"Data exported to {filepath}")
        except Exception as e:
            logger.error(f"Error writing export file {filepath}: {e}")
            raise
    
    def export_to_json_string(self, data: Dict[str, Any]) -> str:
        """
        Export data to JSON string.
        
        Args:
            data: Data to export
            
        Returns:
            JSON string
        """
        return json.dumps(data, indent=2, ensure_ascii=False)
    
    async def export_all_users(
        self,
        output_dir: str = "exports"
    ) -> List[str]:
        """
        Export data for all users (admin function).
        
        Args:
            output_dir: Directory to save export files
            
        Returns:
            List of exported file paths
        """
        import os
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Get all users
        result = await self.db.execute(select(User))
        users = result.scalars().all()
        
        exported_files = []
        
        for user in users:
            try:
                # Export user data
                data = await self.export_user_data(str(user.id))
                
                # Save to file
                filename = f"user_{user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
                filepath = os.path.join(output_dir, filename)
                self.export_to_json(data, filepath)
                
                exported_files.append(filepath)
                logger.info(f"Exported data for user {user.email}")
                
            except Exception as e:
                logger.error(f"Error exporting data for user {user.email}: {e}")
                continue
        
        logger.info(f"Exported data for {len(exported_files)} users")
        return exported_files
