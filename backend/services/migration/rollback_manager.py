"""Rollback Manager
Manages backup and rollback of data during migration.
"""
import json
import os
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from services.migration.data_exporter import DataExporter
from services.migration.data_importer import DataImporter


class RollbackManager:
    """Manage backup and rollback operations"""
    
    def __init__(self, db: AsyncSession, backup_dir: str = "backups"):
        """
        Initialize rollback manager.
        
        Args:
            db: Database session
            backup_dir: Directory to store backups
        """
        self.db = db
        self.backup_dir = backup_dir
        self.exporter = DataExporter(db)
        self.importer = DataImporter(db)
        
        # Create backup directory if it doesn't exist
        os.makedirs(backup_dir, exist_ok=True)
    
    async def create_backup(
        self,
        user_id: str,
        backup_name: Optional[str] = None
    ) -> str:
        """
        Create backup before migration.
        
        Args:
            user_id: User ID to backup
            backup_name: Optional backup name
            
        Returns:
            Path to backup file
        """
        logger.info(f"Creating backup for user {user_id}")
        
        try:
            # Generate backup filename
            if not backup_name:
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                backup_name = f"backup_{user_id}_{timestamp}"
            
            backup_path = os.path.join(self.backup_dir, f"{backup_name}.json")
            
            # Export user data
            data = await self.exporter.export_user_data(user_id)
            
            # Add backup metadata
            data["backup_metadata"] = {
                "backup_name": backup_name,
                "backup_timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "backup_type": "pre_migration"
            }
            
            # Save to file
            self.exporter.export_to_json(data, backup_path)
            
            logger.info(f"Backup created: {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"Error creating backup: {e}")
            raise
    
    async def restore_backup(
        self,
        backup_path: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Restore data from backup.
        
        Args:
            backup_path: Path to backup file
            user_id: Optional target user ID
            
        Returns:
            Restore result
        """
        logger.info(f"Restoring backup from {backup_path}")
        
        try:
            # Load backup data
            data = self.importer.load_from_json(backup_path)
            
            # Validate backup
            if "backup_metadata" not in data:
                logger.warning("Backup metadata not found, proceeding anyway")
            
            # Use provided user_id or from backup
            target_user_id = user_id or data.get("user_id")
            
            # Import data (skip_existing=False to overwrite)
            result = await self.importer.import_user_data(
                data=data,
                user_id=target_user_id,
                skip_existing=False,
                validate_only=False
            )
            
            logger.info(f"Backup restored successfully: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Error restoring backup: {e}")
            raise
    
    def list_backups(self, user_id: Optional[str] = None) -> list[Dict[str, Any]]:
        """
        List available backups.
        
        Args:
            user_id: Optional filter by user ID
            
        Returns:
            List of backup information
        """
        backups = []
        
        try:
            for filename in os.listdir(self.backup_dir):
                if not filename.endswith('.json'):
                    continue
                
                filepath = os.path.join(self.backup_dir, filename)
                
                try:
                    # Read backup metadata
                    with open(filepath, 'r') as f:
                        data = json.load(f)
                    
                    backup_user_id = data.get("user_id")
                    
                    # Filter by user_id if provided
                    if user_id and backup_user_id != user_id:
                        continue
                    
                    backup_info = {
                        "filename": filename,
                        "filepath": filepath,
                        "user_id": backup_user_id,
                        "export_timestamp": data.get("export_timestamp"),
                        "schema_version": data.get("schema_version"),
                        "file_size": os.path.getsize(filepath),
                        "created_at": datetime.fromtimestamp(
                            os.path.getctime(filepath)
                        ).isoformat()
                    }
                    
                    # Add backup metadata if available
                    if "backup_metadata" in data:
                        backup_info["backup_metadata"] = data["backup_metadata"]
                    
                    # Add statistics if available
                    if "statistics" in data:
                        backup_info["statistics"] = data["statistics"]
                    
                    backups.append(backup_info)
                    
                except Exception as e:
                    logger.warning(f"Error reading backup {filename}: {e}")
                    continue
            
            # Sort by creation time (newest first)
            backups.sort(key=lambda x: x["created_at"], reverse=True)
            
            return backups
            
        except Exception as e:
            logger.error(f"Error listing backups: {e}")
            return []
    
    def delete_backup(self, backup_path: str) -> bool:
        """
        Delete a backup file.
        
        Args:
            backup_path: Path to backup file
            
        Returns:
            True if deleted successfully
        """
        try:
            if os.path.exists(backup_path):
                os.remove(backup_path)
                logger.info(f"Backup deleted: {backup_path}")
                return True
            else:
                logger.warning(f"Backup not found: {backup_path}")
                return False
        except Exception as e:
            logger.error(f"Error deleting backup: {e}")
            return False
    
    async def create_migration_checkpoint(
        self,
        user_id: str,
        checkpoint_name: str
    ) -> str:
        """
        Create a checkpoint during migration.
        
        Args:
            user_id: User ID
            checkpoint_name: Name for the checkpoint
            
        Returns:
            Path to checkpoint file
        """
        logger.info(f"Creating migration checkpoint: {checkpoint_name}")
        
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        backup_name = f"checkpoint_{checkpoint_name}_{user_id}_{timestamp}"
        
        return await self.create_backup(user_id, backup_name)
    
    async def rollback_to_checkpoint(
        self,
        checkpoint_path: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rollback to a specific checkpoint.
        
        Args:
            checkpoint_path: Path to checkpoint file
            user_id: Optional target user ID
            
        Returns:
            Rollback result
        """
        logger.info(f"Rolling back to checkpoint: {checkpoint_path}")
        
        return await self.restore_backup(checkpoint_path, user_id)
    
    def cleanup_old_backups(
        self,
        days: int = 30,
        keep_minimum: int = 5
    ) -> int:
        """
        Clean up old backup files.
        
        Args:
            days: Delete backups older than this many days
            keep_minimum: Always keep at least this many backups
            
        Returns:
            Number of backups deleted
        """
        logger.info(f"Cleaning up backups older than {days} days")
        
        try:
            backups = self.list_backups()
            
            # Keep minimum number of backups
            if len(backups) <= keep_minimum:
                logger.info(f"Only {len(backups)} backups, keeping all")
                return 0
            
            # Calculate cutoff date
            from datetime import timedelta
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            deleted_count = 0
            
            for backup in backups[keep_minimum:]:  # Skip the newest backups
                backup_date = datetime.fromisoformat(backup["created_at"])
                
                if backup_date < cutoff_date:
                    if self.delete_backup(backup["filepath"]):
                        deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} old backups")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up backups: {e}")
            return 0
