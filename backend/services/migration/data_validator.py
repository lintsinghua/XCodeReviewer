"""Data Validator
Validates and compares data between source and destination.
"""
from typing import Dict, Any, List, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger

from models.user import User
from models.project import Project
from models.audit_task import AuditTask
from models.audit_issue import AuditIssue


class DataValidator:
    """Validate and compare data"""
    
    def __init__(self, db: AsyncSession):
        """
        Initialize data validator.
        
        Args:
            db: Database session
        """
        self.db = db
        self.validation_report = {
            "timestamp": datetime.utcnow().isoformat(),
            "checks": [],
            "errors": [],
            "warnings": [],
            "summary": {}
        }
    
    async def validate_export_data(
        self,
        export_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate exported data structure and content.
        
        Args:
            export_data: Exported data to validate
            
        Returns:
            Validation report
        """
        logger.info("Starting export data validation")
        
        # Reset report
        self.validation_report = {
            "timestamp": datetime.utcnow().isoformat(),
            "checks": [],
            "errors": [],
            "warnings": [],
            "summary": {}
        }
        
        # Check schema version
        self._check_schema_version(export_data)
        
        # Check required fields
        self._check_required_fields(export_data)
        
        # Check data integrity
        self._check_data_integrity(export_data)
        
        # Check relationships
        self._check_relationships(export_data)
        
        # Generate summary
        self._generate_summary()
        
        logger.info("Export data validation completed")
        return self.validation_report
    
    async def compare_data(
        self,
        user_id: str,
        export_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compare exported data with database data.
        
        Args:
            user_id: User ID to compare
            export_data: Exported data to compare
            
        Returns:
            Comparison report
        """
        logger.info(f"Starting data comparison for user {user_id}")
        
        comparison_report = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "differences": [],
            "statistics": {}
        }
        
        try:
            # Compare user profile
            user_diff = await self._compare_user_profile(user_id, export_data)
            if user_diff:
                comparison_report["differences"].append(user_diff)
            
            # Compare projects
            projects_diff = await self._compare_projects(user_id, export_data)
            if projects_diff:
                comparison_report["differences"].extend(projects_diff)
            
            # Compare tasks
            tasks_diff = await self._compare_tasks(user_id, export_data)
            if tasks_diff:
                comparison_report["differences"].extend(tasks_diff)
            
            # Compare issues
            issues_diff = await self._compare_issues(user_id, export_data)
            if issues_diff:
                comparison_report["differences"].extend(issues_diff)
            
            # Generate statistics
            comparison_report["statistics"] = {
                "total_differences": len(comparison_report["differences"]),
                "match_percentage": self._calculate_match_percentage(
                    export_data,
                    comparison_report["differences"]
                )
            }
            
            logger.info(f"Data comparison completed: {len(comparison_report['differences'])} differences found")
            return comparison_report
            
        except Exception as e:
            logger.error(f"Error comparing data: {e}")
            raise
    
    def _check_schema_version(self, data: Dict[str, Any]) -> None:
        """Check schema version"""
        check = {
            "name": "Schema Version",
            "status": "pass",
            "message": ""
        }
        
        if "schema_version" not in data:
            check["status"] = "fail"
            check["message"] = "Missing schema_version field"
            self.validation_report["errors"].append(check["message"])
        else:
            version = data["schema_version"]
            if not isinstance(version, str):
                check["status"] = "fail"
                check["message"] = f"Invalid schema_version type: {type(version)}"
                self.validation_report["errors"].append(check["message"])
            else:
                check["message"] = f"Schema version: {version}"
        
        self.validation_report["checks"].append(check)
    
    def _check_required_fields(self, data: Dict[str, Any]) -> None:
        """Check required fields"""
        required_fields = ["schema_version", "export_timestamp", "user_id", "data"]
        
        for field in required_fields:
            check = {
                "name": f"Required Field: {field}",
                "status": "pass" if field in data else "fail",
                "message": f"Field '{field}' {'present' if field in data else 'missing'}"
            }
            
            if check["status"] == "fail":
                self.validation_report["errors"].append(check["message"])
            
            self.validation_report["checks"].append(check)
    
    def _check_data_integrity(self, data: Dict[str, Any]) -> None:
        """Check data integrity"""
        if "data" not in data:
            return
        
        data_section = data["data"]
        
        # Check user data
        if "user" in data_section:
            user_data = data_section["user"]
            required_user_fields = ["id", "email", "username"]
            
            for field in required_user_fields:
                check = {
                    "name": f"User Field: {field}",
                    "status": "pass" if field in user_data else "fail",
                    "message": f"User field '{field}' {'present' if field in user_data else 'missing'}"
                }
                
                if check["status"] == "fail":
                    self.validation_report["errors"].append(check["message"])
                
                self.validation_report["checks"].append(check)
        
        # Check projects data
        if "projects" in data_section:
            projects = data_section["projects"]
            
            check = {
                "name": "Projects Data Type",
                "status": "pass" if isinstance(projects, list) else "fail",
                "message": f"Projects is {'a list' if isinstance(projects, list) else f'not a list ({type(projects)})'}"
            }
            
            if check["status"] == "fail":
                self.validation_report["errors"].append(check["message"])
            
            self.validation_report["checks"].append(check)
    
    def _check_relationships(self, data: Dict[str, Any]) -> None:
        """Check data relationships"""
        if "data" not in data:
            return
        
        data_section = data["data"]
        
        # Get all IDs
        project_ids = set()
        task_ids = set()
        
        if "projects" in data_section:
            project_ids = {p["id"] for p in data_section["projects"]}
        
        if "audit_tasks" in data_section:
            task_ids = {t["id"] for t in data_section["audit_tasks"]}
            
            # Check task -> project relationships
            for task in data_section["audit_tasks"]:
                if task.get("project_id") not in project_ids:
                    warning = f"Task {task['id']} references non-existent project {task.get('project_id')}"
                    self.validation_report["warnings"].append(warning)
        
        if "audit_issues" in data_section:
            # Check issue -> task relationships
            for issue in data_section["audit_issues"]:
                if issue.get("task_id") not in task_ids:
                    warning = f"Issue {issue['id']} references non-existent task {issue.get('task_id')}"
                    self.validation_report["warnings"].append(warning)
    
    def _generate_summary(self) -> None:
        """Generate validation summary"""
        self.validation_report["summary"] = {
            "total_checks": len(self.validation_report["checks"]),
            "passed_checks": sum(1 for c in self.validation_report["checks"] if c["status"] == "pass"),
            "failed_checks": sum(1 for c in self.validation_report["checks"] if c["status"] == "fail"),
            "total_errors": len(self.validation_report["errors"]),
            "total_warnings": len(self.validation_report["warnings"]),
            "valid": len(self.validation_report["errors"]) == 0
        }
    
    async def _compare_user_profile(
        self,
        user_id: str,
        export_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Compare user profile"""
        if "data" not in export_data or "user" not in export_data["data"]:
            return None
        
        export_user = export_data["data"]["user"]
        
        # Get user from database
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        db_user = result.scalar_one_or_none()
        
        if not db_user:
            return {
                "type": "user",
                "id": user_id,
                "difference": "User not found in database"
            }
        
        # Compare fields
        differences = []
        
        if export_user.get("email") != db_user.email:
            differences.append(f"email: {export_user.get('email')} != {db_user.email}")
        
        if export_user.get("username") != db_user.username:
            differences.append(f"username: {export_user.get('username')} != {db_user.username}")
        
        if differences:
            return {
                "type": "user",
                "id": user_id,
                "differences": differences
            }
        
        return None
    
    async def _compare_projects(
        self,
        user_id: str,
        export_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Compare projects"""
        if "data" not in export_data or "projects" not in export_data["data"]:
            return []
        
        export_projects = {p["id"]: p for p in export_data["data"]["projects"]}
        
        # Get projects from database
        result = await self.db.execute(
            select(Project).where(Project.user_id == user_id)
        )
        db_projects = {str(p.id): p for p in result.scalars().all()}
        
        differences = []
        
        # Check for missing projects
        for project_id in export_projects:
            if project_id not in db_projects:
                differences.append({
                    "type": "project",
                    "id": project_id,
                    "difference": "Project in export but not in database"
                })
        
        # Check for extra projects
        for project_id in db_projects:
            if project_id not in export_projects:
                differences.append({
                    "type": "project",
                    "id": project_id,
                    "difference": "Project in database but not in export"
                })
        
        return differences
    
    async def _compare_tasks(
        self,
        user_id: str,
        export_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Compare audit tasks"""
        if "data" not in export_data or "audit_tasks" not in export_data["data"]:
            return []
        
        export_tasks = {t["id"]: t for t in export_data["data"]["audit_tasks"]}
        
        # Get user's project IDs
        result = await self.db.execute(
            select(Project.id).where(Project.user_id == user_id)
        )
        project_ids = [row[0] for row in result.all()]
        
        if not project_ids:
            return []
        
        # Get tasks from database
        result = await self.db.execute(
            select(AuditTask).where(AuditTask.project_id.in_(project_ids))
        )
        db_tasks = {str(t.id): t for t in result.scalars().all()}
        
        differences = []
        
        # Check for missing tasks
        for task_id in export_tasks:
            if task_id not in db_tasks:
                differences.append({
                    "type": "task",
                    "id": task_id,
                    "difference": "Task in export but not in database"
                })
        
        # Check for extra tasks
        for task_id in db_tasks:
            if task_id not in export_tasks:
                differences.append({
                    "type": "task",
                    "id": task_id,
                    "difference": "Task in database but not in export"
                })
        
        return differences
    
    async def _compare_issues(
        self,
        user_id: str,
        export_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Compare audit issues"""
        if "data" not in export_data or "audit_issues" not in export_data["data"]:
            return []
        
        export_issues = {i["id"]: i for i in export_data["data"]["audit_issues"]}
        
        # Get user's project IDs
        result = await self.db.execute(
            select(Project.id).where(Project.user_id == user_id)
        )
        project_ids = [row[0] for row in result.all()]
        
        if not project_ids:
            return []
        
        # Get task IDs
        result = await self.db.execute(
            select(AuditTask.id).where(AuditTask.project_id.in_(project_ids))
        )
        task_ids = [row[0] for row in result.all()]
        
        if not task_ids:
            return []
        
        # Get issues from database
        result = await self.db.execute(
            select(AuditIssue).where(AuditIssue.task_id.in_(task_ids))
        )
        db_issues = {str(i.id): i for i in result.scalars().all()}
        
        differences = []
        
        # Check for missing issues
        for issue_id in export_issues:
            if issue_id not in db_issues:
                differences.append({
                    "type": "issue",
                    "id": issue_id,
                    "difference": "Issue in export but not in database"
                })
        
        # Check for extra issues
        for issue_id in db_issues:
            if issue_id not in export_issues:
                differences.append({
                    "type": "issue",
                    "id": issue_id,
                    "difference": "Issue in database but not in export"
                })
        
        return differences
    
    def _calculate_match_percentage(
        self,
        export_data: Dict[str, Any],
        differences: List[Dict[str, Any]]
    ) -> float:
        """Calculate match percentage"""
        if "data" not in export_data:
            return 0.0
        
        data_section = export_data["data"]
        
        total_items = 0
        total_items += 1  # user
        total_items += len(data_section.get("projects", []))
        total_items += len(data_section.get("audit_tasks", []))
        total_items += len(data_section.get("audit_issues", []))
        
        if total_items == 0:
            return 100.0
        
        mismatches = len(differences)
        matches = total_items - mismatches
        
        return (matches / total_items) * 100.0
