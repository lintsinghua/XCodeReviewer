"""Tests for File Validator"""
import pytest
from io import BytesIO
from fastapi import UploadFile, HTTPException
from core.file_validator import FileValidator


class TestFileValidator:
    """Test file validator"""
    
    def test_validate_file_valid(self):
        """Test validating valid file"""
        file = UploadFile(
            filename="test.py",
            file=BytesIO(b"print('hello')"),
        )
        file.size = 100
        
        # Should not raise exception
        FileValidator.validate_file(file)
    
    def test_validate_file_too_large(self):
        """Test validating file that's too large"""
        file = UploadFile(
            filename="test.py",
            file=BytesIO(b"x" * 1000),
        )
        file.size = 200 * 1024 * 1024  # 200MB
        
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_file(file)
        
        assert exc_info.value.status_code == 413
    
    def test_validate_file_invalid_extension(self):
        """Test validating file with invalid extension"""
        file = UploadFile(
            filename="test.exe",
            file=BytesIO(b"binary"),
        )
        file.size = 100
        
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_file(file)
        
        assert exc_info.value.status_code == 400
    
    def test_validate_file_dangerous_pattern(self):
        """Test validating file with dangerous pattern"""
        file = UploadFile(
            filename="malware.exe.zip",
            file=BytesIO(b"data"),
        )
        file.size = 100
        
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_file(file)
        
        assert exc_info.value.status_code == 400
    
    def test_sanitize_filename(self):
        """Test filename sanitization"""
        # Path traversal attempt
        assert FileValidator.sanitize_filename("../../../etc/passwd") == "passwd"
        
        # Null bytes
        assert FileValidator.sanitize_filename("test\x00.txt") == "test_.txt"
        
        # Normal filename
        assert FileValidator.sanitize_filename("test.py") == "test.py"
        
        # Long filename
        long_name = "a" * 300 + ".txt"
        sanitized = FileValidator.sanitize_filename(long_name)
        assert len(sanitized) <= 255
        assert sanitized.endswith(".txt")
    
    def test_validate_file_no_filename(self):
        """Test validating file without filename"""
        file = UploadFile(
            filename="",
            file=BytesIO(b"data"),
        )
        
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_file(file)
        
        assert exc_info.value.status_code == 400
