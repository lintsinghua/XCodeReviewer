"""ZIP File Handler
Handler for processing ZIP file uploads.
"""
import zipfile
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Any
from loguru import logger

from core.exceptions import RepositoryError


class ZipHandler:
    """ZIP file handler"""
    
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    MAX_FILES = 10000  # Maximum number of files in ZIP
    
    def __init__(self, zip_path: str):
        """
        Initialize ZIP handler.
        
        Args:
            zip_path: Path to ZIP file
        """
        self.zip_path = zip_path
        self.extract_dir = None
    
    async def validate(self) -> bool:
        """
        Validate ZIP file.
        
        Returns:
            True if valid, raises exception otherwise
        """
        try:
            # Check file size
            file_size = os.path.getsize(self.zip_path)
            if file_size > self.MAX_FILE_SIZE:
                raise RepositoryError(
                    f"ZIP file too large: {file_size / 1024 / 1024:.2f}MB "
                    f"(max: {self.MAX_FILE_SIZE / 1024 / 1024}MB)"
                )
            
            # Check if valid ZIP
            if not zipfile.is_zipfile(self.zip_path):
                raise RepositoryError("Invalid ZIP file")
            
            # Check number of files
            with zipfile.ZipFile(self.zip_path, 'r') as zf:
                file_count = len(zf.namelist())
                if file_count > self.MAX_FILES:
                    raise RepositoryError(
                        f"Too many files in ZIP: {file_count} "
                        f"(max: {self.MAX_FILES})"
                    )
                
                # Check for suspicious files
                for name in zf.namelist():
                    # Check for path traversal
                    if ".." in name or name.startswith("/"):
                        raise RepositoryError(f"Suspicious file path: {name}")
            
            return True
            
        except zipfile.BadZipFile:
            raise RepositoryError("Corrupted ZIP file")
        except Exception as e:
            logger.error(f"Error validating ZIP: {e}")
            raise RepositoryError(f"Error validating ZIP: {e}")
    
    async def extract(self) -> str:
        """
        Extract ZIP file to temporary directory.
        
        Returns:
            Path to extraction directory
        """
        try:
            # Validate first
            await self.validate()
            
            # Create temporary directory
            self.extract_dir = tempfile.mkdtemp(prefix="xcodereviewer_")
            
            # Extract ZIP
            with zipfile.ZipFile(self.zip_path, 'r') as zf:
                zf.extractall(self.extract_dir)
            
            logger.info(f"Extracted ZIP to {self.extract_dir}")
            return self.extract_dir
            
        except Exception as e:
            # Clean up on error
            if self.extract_dir and os.path.exists(self.extract_dir):
                import shutil
                shutil.rmtree(self.extract_dir, ignore_errors=True)
            raise RepositoryError(f"Error extracting ZIP: {e}")
    
    async def get_file_tree(self) -> List[Dict[str, Any]]:
        """
        Get file tree from extracted ZIP.
        
        Returns:
            List of files with metadata
        """
        if not self.extract_dir:
            await self.extract()
        
        files = []
        base_path = Path(self.extract_dir)
        
        for file_path in base_path.rglob("*"):
            if file_path.is_file():
                relative_path = file_path.relative_to(base_path)
                
                files.append({
                    "path": str(relative_path),
                    "type": "blob",
                    "size": file_path.stat().st_size,
                    "mode": "100644"
                })
        
        return files
    
    async def get_file_content(self, file_path: str) -> str:
        """
        Get file content from extracted ZIP.
        
        Args:
            file_path: Relative file path
            
        Returns:
            File content as string
        """
        if not self.extract_dir:
            await self.extract()
        
        try:
            full_path = os.path.join(self.extract_dir, file_path)
            
            # Security check
            if not os.path.abspath(full_path).startswith(os.path.abspath(self.extract_dir)):
                raise RepositoryError(f"Invalid file path: {file_path}")
            
            if not os.path.exists(full_path):
                raise RepositoryError(f"File not found: {file_path}")
            
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
                
        except UnicodeDecodeError:
            raise RepositoryError(f"File {file_path} is not a text file")
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            raise RepositoryError(f"Error reading file: {e}")
    
    def cleanup(self):
        """Clean up extracted files"""
        if self.extract_dir and os.path.exists(self.extract_dir):
            import shutil
            try:
                shutil.rmtree(self.extract_dir)
                logger.info(f"Cleaned up {self.extract_dir}")
            except Exception as e:
                logger.error(f"Error cleaning up: {e}")
    
    def __del__(self):
        """Cleanup on deletion"""
        self.cleanup()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()
