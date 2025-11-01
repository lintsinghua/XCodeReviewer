"""Data Importer
Imports user data from JSON format into backend database.
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
from core.exceptions import XCodeReviewerException


class DataImportError(XCodeReviewerException):
    """Data import error"""
    pass


class SchemaVersionMismatch(DataImportError):
    """Schema version mismatch error"""
    pass


class DataImporter:
    """Import user data from JSON format into database"""
    
    SUPPORTED_SCHEMA_VERSIONS = ["2.0.0"]
    
    def __init__(self, db: AsyncSession):
        """
        Initialize data importer.
        
        Args:
            db: Database session
        """
        self.db = db
        self.import_stats = {
            "users": 0,
            "projects": 0,
            "tasks": 0,
            "issues": 0,
            "errors": []
        }
    
    async def import_user_data(
        self,
        data: Dict[str, Any],
        user_id: Optional[str] = None,
        skip_existing: bool = True,
        validate_only: bool = False
    ) -> Dict[str, Any]:
        """
        Import user data from export format.
        
        Args:
            data: Exported data dictionary
            user_id: Target user ID (if different from export)
            skip_existing: Skip existing records instead of updating
            validate_only: Only validate data without importing
            
        Returns:
            Import statistics
        """
        logger.info("Starting data import")
        
        # Reset stats
        self.import_stats = {
            "users": 0,
            "projects": 0,
            "tasks": 0,
            "issues": 0,
            "errors": []
        }
        
        try:
            # Validate schema version
            self._validate_schema_version(data)
            
            # Validate data structure
            self._validate_data_structure(data)
            
            if validate_only:
                logger.info("Validation completed successfully")
                return {"status": "valid", "stats": self.import_stats}
            
            # Use provided user_id or from export
            target_user_id = user_id or data.get("user_id")
            
            # Import user profile
            await self._import_user_profile(
                data["data"]["user"],
                target_user_id,
                skip_existing
            )
            
            # Import projects
            if "projects" in data["data"]:
                await self._import_projects(
                    data["data"]["projects"],
                    target_user_id,
                    skip_existing
                )
            
            # Import audit tasks
            if "audit_tasks" in data["data"]:
                await self._import_audit_tasks(
                    data["data"]["audit_tasks"],
                    skip_existing
                )
            
            # Import audit issues
            if "audit_issues" in data["data"]:
                await self._import_audit_issues(
                    data["data"]["audit_issues"],
                    skip_existing
                )
            
            # Import user settings
            if "settings" in data["data"]:
                await self._import_user_settings(
                    data["data"]["settings"],
                    target_user_id
                )
            
            # Commit transaction
            await self.db.commit()
            
            logger.info(f"Data import completed: {self.import_stats}")
            return {"status": "success", "stats": self.import_stats}
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error importing data: {e}")
            self.import_stats["errors"].append(str(e))
            raise DataImportError(f"Import failed: {e}")
    
    def _validate_schema_version(self, data: Dict[str, Any]) -> None:
        """Validate schema version compatibility"""
        schema_version = data.get("schema_version")
        
        if not schema_version:
            raise SchemaVersionMismatch("Missing schema_version in export data")
        
        if schema_version not in self.SUPPORTED_SCHEMA_VERSIONS:
            raise SchemaVersionMismatch(
                f"Unsupported schema version: {schema_version}. "
                f"Supported versions: {', '.join(self.SUPPORTED_SCHEMA_VERSIONS)}"
            )
    
    def _validate_data_structure(self, data: Dict[str, Any]) -> None:
        """Validate data structure"""
        required_fields = ["schema_version", "export_timestamp", "user_id", "data"]
        
        for field in required_fields:
            if field not in data:
                raise DataImportError(f"Missing required field: {field}")
        
        if "user" not in data["data"]:
            raise DataImportError("Missing user data")
    
    async def _import_user_profile(
        self,
        user_data: Dict[str, Any],
        user_id: str,
        skip_existing: bool
    ) -> None:
        """Import user profile"""
        try:
            # Check if user exists
            result = await self.db.execute(
                select(User).where(User.id == user_id)
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                if skip_existing:
                    logger.info(f"User {user_id} already exists, skipping")
                    return
                else:
                    # Update existing user
                    existing_user.email = user_data.get("email", existing_user.email)
                    existing_user.username = user_data.get("username", existing_user.username)
                    existing_user.full_name = user_data.get("full_name", existing_user.full_name)
                    logger.info(f"Updated user {user_id}")
            else:
                # Create new user
                new_user = User(
                    id=user_id,
                    email=user_data["email"],
                    username=user_data["username"],
                    full_name=user_data.get("full_name"),
                    role=user_data.get("role", "user"),
                    is_active=user_data.get("is_active", True),
                    hashed_password=""  # Will need to be reset
                )
                self.db.add(new_user)
                logger.info(f"Created user {user_id}")
            
            self.import_stats["users"] += 1
            
        except Exception as e:
            error_msg = f"Error importing user profile: {e}"
            logger.error(error_msg)
            self.import_stats["errors"].append(error_msg)
            raise
    
    async def _import_projects(
        self,
        projects_data: List[Dict[str, Any]],
        user_id: str,
        skip_existing: bool
    ) -> None:
        """Import projects"""
        for project_data in projects_data:
            try:
                project_id = project_data["id"]
                
                # Check if project exists
                result = await self.db.execute(
                    select(Project).where(Project.id == project_id)
                )
                existing_project = result.scalar_one_or_none()
                
                if existing_project:
                    if skip_existing:
                        logger.debug(f"Project {project_id} already exists, skipping")
                        continue
                    else:
                        # Update existing project
                        existing_project.name = project_data.get("name", existing_project.name)
                        existing_project.description = project_data.get("description", existing_project.description)
                        existing_project.status = project_data.get("status", existing_project.status)
                        logger.debug(f"Updated project {project_id}")
                else:
                    # Create new project
                    new_project = Project(
                        id=project_id,
                        user_id=user_id,
                        name=project_data["name"],
                        description=project_data.get("description"),
                        repository_url=project_data.get("repository_url"),
                        repository_type=project_data.get("repository_type"),
                        default_branch=project_data.get("default_branch", "main"),
                        language=project_data.get("language"),
                        status=project_data.get("status", "active")
                    )
                    self.db.add(new_project)
                    logger.debug(f"Created project {project_id}")
                
                self.import_stats["projects"] += 1
                
            except Exception as e:
                error_msg = f"Error importing project {project_data.get('id')}: {e}"
                logger.error(error_msg)
                self.import_stats["errors"].append(error_msg)
                # Continue with next project
    
    async def _import_audit_tasks(
        self,
        tasks_data: List[Dict[str, Any]],
        skip_existing: bool
    ) -> None:
        """Import audit tasks"""
        for task_data in tasks_data:
            try:
                task_id = task_data["id"]
                
                # Check if task exists
                result = await self.db.execute(
                    select(AuditTask).where(AuditTask.id == task_id)
                )
                existing_task = result.scalar_one_or_none()
                
                if existing_task:
                    if skip_existing:
                        logger.debug(f"Task {task_id} already exists, skipping")
                        continue
                    else:
                        # Update existing task
                        existing_task.status = task_data.get("status", existing_task.status)
                        existing_task.progress = task_data.get("progress", existing_task.progress)
                        logger.debug(f"Updated task {task_id}")
                else:
                    # Create new task
                    new_task = AuditTask(
                        id=task_id,
                        project_id=task_data["project_id"],
                        task_type=task_data.get("task_type", "full_audit"),
                        status=task_data.get("status", "pending"),
                        progress=task_data.get("progress", 0),
                        total_files=task_data.get("total_files", 0),
                        analyzed_files=task_data.get("analyzed_files", 0),
                        issues_found=task_data.get("issues_found", 0),
                        error_message=task_data.get("error_message"),
                        result_summary=task_data.get("result_summary")
                    )
                    self.db.add(new_task)
                    logger.debug(f"Created task {task_id}")
                
                self.import_stats["tasks"] += 1
                
            except Exception as e:
                error_msg = f"Error importing task {task_data.get('id')}: {e}"
                logger.error(error_msg)
                self.import_stats["errors"].append(error_msg)
                # Continue with next task
    
    async def _import_audit_issues(
        self,
        issues_data: List[Dict[str, Any]],
        skip_existing: bool
    ) -> None:
        """Import audit issues"""
        for issue_data in issues_data:
            try:
                issue_id = issue_data["id"]
                
                # Check if issue exists
                result = await self.db.execute(
                    select(AuditIssue).where(AuditIssue.id == issue_id)
                )
                existing_issue = result.scalar_one_or_none()
                
                if existing_issue:
                    if skip_existing:
                        logger.debug(f"Issue {issue_id} already exists, skipping")
                        continue
                    else:
                        # Update existing issue
                        existing_issue.status = issue_data.get("status", existing_issue.status)
                        logger.debug(f"Updated issue {issue_id}")
                else:
                    # Create new issue
                    new_issue = AuditIssue(
                        id=issue_id,
                        task_id=issue_data["task_id"],
                        severity=issue_data.get("severity", "medium"),
                        category=issue_data.get("category", "general"),
                        title=issue_data["title"],
                        description=issue_data.get("description"),
                        file_path=issue_data.get("file_path"),
                        line_number=issue_data.get("line_number"),
                        code_snippet=issue_data.get("code_snippet"),
                        suggestion=issue_data.get("suggestion"),
                        status=issue_data.get("status", "open")
                    )
                    self.db.add(new_issue)
                    logger.debug(f"Created issue {issue_id}")
                
                self.import_stats["issues"] += 1
                
            except Exception as e:
                error_msg = f"Error importing issue {issue_data.get('id')}: {e}"
                logger.error(error_msg)
                self.import_stats["errors"].append(error_msg)
                # Continue with next issue
    
    async def _import_user_settings(
        self,
        settings_data: Dict[str, Any],
        user_id: str
    ) -> None:
        """Import user settings (placeholder for future implementation)"""
        # TODO: Implement when user settings model is added
        logger.debug(f"User settings import not yet implemented for user {user_id}")
    
    def load_from_json(self, filepath: str) -> Dict[str, Any]:
        """
        Load data from JSON file.
        
        Args:
            filepath: Path to input file
            
        Returns:
            Loaded data dictionary
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logger.info(f"Data loaded from {filepath}")
            return data
        except Exception as e:
            logger.error(f"Error reading import file {filepath}: {e}")
            raise DataImportError(f"Failed to load file: {e}")
    
    def load_from_json_string(self, json_string: str) -> Dict[str, Any]:
        """
        Load data from JSON string.
        
        Args:
            json_string: JSON string
            
        Returns:
            Loaded data dictionary
        """
        try:
            return json.loads(json_string)
        except Exception as e:
            logger.error(f"Error parsing JSON string: {e}")
            raise DataImportError(f"Failed to parse JSON: {e}")
