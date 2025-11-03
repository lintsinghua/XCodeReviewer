"""File Upload Validator
Validates uploaded files for size, type, and security.
"""
import os
import magic
from typing import Optional, List, Set
from fastapi import UploadFile, HTTPException
from loguru import logger

from app.config import settings


class FileValidator:
    """Validate uploaded files"""
    
    # Maximum file size (100MB)
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB in bytes
    
    # Allowed MIME types
    ALLOWED_MIME_TYPES: Set[str] = {
        # Archives
        "application/zip",
        "application/x-zip-compressed",
        "application/x-tar",
        "application/gzip",
        "application/x-gzip",
        
        # Code files
        "text/plain",
        "text/x-python",
        "text/x-java",
        "text/x-c",
        "text/x-c++",
        "text/javascript",
        "application/javascript",
        "application/json",
        "text/html",
        "text/css",
        "text/xml",
        "application/xml",
        
        # Documents
        "application/pdf",
        "text/markdown",
        "text/x-markdown",
    }
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS: Set[str] = {
        # Archives
        ".zip", ".tar", ".gz", ".tgz",
        
        # Code files
        ".py", ".java", ".js", ".ts", ".jsx", ".tsx",
        ".c", ".cpp", ".h", ".hpp",
        ".go", ".rs", ".rb", ".php",
        ".html", ".css", ".scss", ".sass",
        ".json", ".xml", ".yaml", ".yml",
        ".sh", ".bash",
        
        # Documents
        ".md", ".txt", ".pdf",
    }
    
    # Dangerous file patterns
    DANGEROUS_PATTERNS: List[str] = [
        # Executable files
        ".exe", ".dll", ".so", ".dylib",
        ".bat", ".cmd", ".ps1",
        
        # Scripts that could be dangerous
        ".vbs", ".wsf",
        
        # Compressed executables
        ".exe.zip", ".dll.zip",
    ]
    
    @classmethod
    def validate_file(
        cls,
        file: UploadFile,
        max_size: Optional[int] = None,
        allowed_types: Optional[Set[str]] = None,
        allowed_extensions: Optional[Set[str]] = None
    ) -> None:
        """
        Validate uploaded file.
        
        Args:
            file: Uploaded file
            max_size: Maximum file size in bytes (optional)
            allowed_types: Allowed MIME types (optional)
            allowed_extensions: Allowed file extensions (optional)
            
        Raises:
            HTTPException: If validation fails
        """
        # Use defaults if not provided
        max_size = max_size or cls.MAX_FILE_SIZE
        allowed_types = allowed_types or cls.ALLOWED_MIME_TYPES
        allowed_extensions = allowed_extensions or cls.ALLOWED_EXTENSIONS
        
        # Validate filename
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="Filename is required"
            )
        
        # Check for dangerous patterns
        filename_lower = file.filename.lower()
        for pattern in cls.DANGEROUS_PATTERNS:
            if pattern in filename_lower:
                logger.warning(f"Dangerous file pattern detected: {file.filename}")
                raise HTTPException(
                    status_code=400,
                    detail=f"File type not allowed: {pattern}"
                )
        
        # Validate file extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            logger.warning(f"Invalid file extension: {file_ext}")
            raise HTTPException(
                status_code=400,
                detail=f"File extension '{file_ext}' not allowed. "
                       f"Allowed extensions: {', '.join(sorted(allowed_extensions))}"
            )
        
        # Validate file size
        if file.size and file.size > max_size:
            logger.warning(f"File too large: {file.size} bytes")
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {max_size / (1024*1024):.0f}MB"
            )
        
        logger.info(f"File validation passed: {file.filename}")
    
    @classmethod
    async def validate_file_content(
        cls,
        file: UploadFile,
        allowed_types: Optional[Set[str]] = None
    ) -> str:
        """
        Validate file content by checking MIME type.
        
        Args:
            file: Uploaded file
            allowed_types: Allowed MIME types (optional)
            
        Returns:
            Detected MIME type
            
        Raises:
            HTTPException: If validation fails
        """
        allowed_types = allowed_types or cls.ALLOWED_MIME_TYPES
        
        try:
            # Read first chunk to detect MIME type
            chunk = await file.read(2048)
            await file.seek(0)  # Reset file pointer
            
            # Detect MIME type
            mime_type = magic.from_buffer(chunk, mime=True)
            
            # Validate MIME type
            if mime_type not in allowed_types:
                logger.warning(f"Invalid MIME type: {mime_type}")
                raise HTTPException(
                    status_code=400,
                    detail=f"File type '{mime_type}' not allowed"
                )
            
            logger.info(f"File content validation passed: {mime_type}")
            return mime_type
            
        except Exception as e:
            logger.error(f"Error validating file content: {e}")
            raise HTTPException(
                status_code=500,
                detail="Error validating file content"
            )
    
    @classmethod
    async def scan_for_malware(cls, file: UploadFile) -> bool:
        """
        Scan file for malware (placeholder for future implementation).
        
        Args:
            file: Uploaded file
            
        Returns:
            True if file is safe, False if malware detected
            
        Note:
            This is a placeholder. In production, integrate with:
            - ClamAV
            - VirusTotal API
            - Cloud-based malware scanning service
        """
        # TODO: Implement malware scanning
        # For now, just check for suspicious patterns
        
        try:
            # Read file content
            content = await file.read()
            await file.seek(0)  # Reset file pointer
            
            # Check for suspicious patterns (very basic)
            suspicious_patterns = [
                b"<script>",
                b"eval(",
                b"exec(",
                b"system(",
                b"shell_exec(",
            ]
            
            content_lower = content.lower()
            for pattern in suspicious_patterns:
                if pattern in content_lower:
                    logger.warning(f"Suspicious pattern found in file: {pattern}")
                    return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error scanning file: {e}")
            return False
    
    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        """
        Sanitize filename to prevent path traversal attacks.
        
        Args:
            filename: Original filename
            
        Returns:
            Sanitized filename
        """
        # Remove path components
        filename = os.path.basename(filename)
        
        # Remove dangerous characters
        dangerous_chars = ['..', '/', '\\', '\0', '\n', '\r']
        for char in dangerous_chars:
            filename = filename.replace(char, '_')
        
        # Limit length
        max_length = 255
        if len(filename) > max_length:
            name, ext = os.path.splitext(filename)
            filename = name[:max_length - len(ext)] + ext
        
        return filename
    
    @classmethod
    async def validate_and_save(
        cls,
        file: UploadFile,
        upload_dir: str,
        max_size: Optional[int] = None,
        scan_malware: bool = True
    ) -> str:
        """
        Validate file and save to disk.
        
        Args:
            file: Uploaded file
            upload_dir: Directory to save file
            max_size: Maximum file size (optional)
            scan_malware: Whether to scan for malware
            
        Returns:
            Path to saved file
            
        Raises:
            HTTPException: If validation fails
        """
        # Validate file
        cls.validate_file(file, max_size=max_size)
        
        # Validate content
        await cls.validate_file_content(file)
        
        # Scan for malware
        if scan_malware:
            is_safe = await cls.scan_for_malware(file)
            if not is_safe:
                raise HTTPException(
                    status_code=400,
                    detail="File failed security scan"
                )
        
        # Sanitize filename
        safe_filename = cls.sanitize_filename(file.filename)
        
        # Create upload directory if it doesn't exist
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename if file already exists
        file_path = os.path.join(upload_dir, safe_filename)
        if os.path.exists(file_path):
            name, ext = os.path.splitext(safe_filename)
            counter = 1
            while os.path.exists(file_path):
                safe_filename = f"{name}_{counter}{ext}"
                file_path = os.path.join(upload_dir, safe_filename)
                counter += 1
        
        # Save file
        try:
            content = await file.read()
            with open(file_path, 'wb') as f:
                f.write(content)
            
            logger.info(f"File saved: {file_path}")
            return file_path
            
        except Exception as e:
            logger.error(f"Error saving file: {e}")
            raise HTTPException(
                status_code=500,
                detail="Error saving file"
            )


# Convenience function
async def validate_upload(
    file: UploadFile,
    max_size: Optional[int] = None
) -> None:
    """
    Validate uploaded file (convenience function).
    
    Args:
        file: Uploaded file
        max_size: Maximum file size (optional)
    """
    FileValidator.validate_file(file, max_size=max_size)
    await FileValidator.validate_file_content(file)
