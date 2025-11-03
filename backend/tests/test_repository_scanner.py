"""Repository Scanner Tests
Tests for repository scanning services.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import tempfile
import zipfile
import os

from services.repository.file_filter import FileFilter
from services.repository.scanner import RepositoryScanner
from models.project import ProjectSource


class TestFileFilter:
    """Test file filter"""
    
    def test_should_include_code_files(self):
        """Test that code files are included"""
        filter = FileFilter()
        
        assert filter.should_include("src/main.py")
        assert filter.should_include("app.js")
        assert filter.should_include("index.html")
    
    def test_should_exclude_binary_files(self):
        """Test that binary files are excluded"""
        filter = FileFilter()
        
        assert not filter.should_include("image.png")
        assert not filter.should_include("video.mp4")
        assert not filter.should_include("archive.zip")
    
    def test_should_exclude_node_modules(self):
        """Test that node_modules is excluded"""
        filter = FileFilter()
        
        assert not filter.should_include("node_modules/package/index.js")
        assert not filter.should_include("vendor/lib.php")
    
    def test_should_exclude_git_directory(self):
        """Test that .git directory is excluded"""
        filter = FileFilter()
        
        assert not filter.should_include(".git/config")
        assert not filter.should_include(".gitignore")  # This might be included
    
    def test_is_code_file(self):
        """Test code file detection"""
        filter = FileFilter()
        
        assert filter.is_code_file("main.py")
        assert filter.is_code_file("app.js")
        assert filter.is_code_file("style.css")
        assert not filter.is_code_file("image.png")
    
    def test_detect_language(self):
        """Test language detection"""
        filter = FileFilter()
        
        assert filter.detect_language("main.py") == "Python"
        assert filter.detect_language("app.js") == "JavaScript"
        assert filter.detect_language("main.go") == "Go"
        assert filter.detect_language("unknown.xyz") is None
    
    def test_filter_files(self):
        """Test filtering file list"""
        filter = FileFilter()
        
        files = [
            {"path": "src/main.py", "size": 1000},
            {"path": "image.png", "size": 5000},
            {"path": "node_modules/lib.js", "size": 2000},
            {"path": "app.js", "size": 1500},
        ]
        
        filtered = filter.filter_files(files)
        
        assert len(filtered) == 2
        assert any(f["path"] == "src/main.py" for f in filtered)
        assert any(f["path"] == "app.js" for f in filtered)
    
    def test_get_statistics(self):
        """Test getting file statistics"""
        filter = FileFilter()
        
        files = [
            {"path": "src/main.py", "size": 1000},
            {"path": "app.js", "size": 1500},
            {"path": "README.md", "size": 500},
        ]
        
        stats = filter.get_statistics(files)
        
        assert stats["total_files"] == 3
        assert stats["code_files"] == 2
        assert "Python" in stats["languages"]
        assert "JavaScript" in stats["languages"]


class TestGitHubURLParsing:
    """Test GitHub URL parsing"""
    
    @pytest.mark.asyncio
    async def test_parse_github_url_basic(self):
        """Test parsing basic GitHub URL"""
        from services.repository.github_client import parse_github_url
        
        owner, repo, branch = await parse_github_url(
            "https://github.com/owner/repo"
        )
        
        assert owner == "owner"
        assert repo == "repo"
        assert branch == "main"
    
    @pytest.mark.asyncio
    async def test_parse_github_url_with_branch(self):
        """Test parsing GitHub URL with branch"""
        from services.repository.github_client import parse_github_url
        
        owner, repo, branch = await parse_github_url(
            "https://github.com/owner/repo/tree/develop"
        )
        
        assert owner == "owner"
        assert repo == "repo"
        assert branch == "develop"
    
    @pytest.mark.asyncio
    async def test_parse_github_url_with_git_extension(self):
        """Test parsing GitHub URL with .git extension"""
        from services.repository.github_client import parse_github_url
        
        owner, repo, branch = await parse_github_url(
            "https://github.com/owner/repo.git"
        )
        
        assert owner == "owner"
        assert repo == "repo"
        assert branch == "main"


class TestGitLabURLParsing:
    """Test GitLab URL parsing"""
    
    @pytest.mark.asyncio
    async def test_parse_gitlab_url_basic(self):
        """Test parsing basic GitLab URL"""
        from services.repository.gitlab_client import parse_gitlab_url
        
        project_path, branch = await parse_gitlab_url(
            "https://gitlab.com/owner/repo"
        )
        
        assert project_path == "owner/repo"
        assert branch == "main"
    
    @pytest.mark.asyncio
    async def test_parse_gitlab_url_with_branch(self):
        """Test parsing GitLab URL with branch"""
        from services.repository.gitlab_client import parse_gitlab_url
        
        project_path, branch = await parse_gitlab_url(
            "https://gitlab.com/owner/repo/-/tree/develop"
        )
        
        assert project_path == "owner/repo"
        assert branch == "develop"


class TestZipHandler:
    """Test ZIP handler"""
    
    @pytest.mark.asyncio
    async def test_zip_validation(self):
        """Test ZIP file validation"""
        from services.repository.zip_handler import ZipHandler
        
        # Create a test ZIP file
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            zip_path = tmp.name
            
            with zipfile.ZipFile(zip_path, 'w') as zf:
                zf.writestr("test.txt", "Hello, World!")
        
        try:
            handler = ZipHandler(zip_path)
            is_valid = await handler.validate()
            
            assert is_valid
        finally:
            os.unlink(zip_path)
    
    @pytest.mark.asyncio
    async def test_zip_extraction(self):
        """Test ZIP file extraction"""
        from services.repository.zip_handler import ZipHandler
        
        # Create a test ZIP file
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            zip_path = tmp.name
            
            with zipfile.ZipFile(zip_path, 'w') as zf:
                zf.writestr("test.txt", "Hello, World!")
                zf.writestr("src/main.py", "print('Hello')")
        
        try:
            async with ZipHandler(zip_path) as handler:
                extract_dir = await handler.extract()
                
                assert os.path.exists(extract_dir)
                assert os.path.exists(os.path.join(extract_dir, "test.txt"))
                assert os.path.exists(os.path.join(extract_dir, "src", "main.py"))
        finally:
            os.unlink(zip_path)
    
    @pytest.mark.asyncio
    async def test_zip_get_file_tree(self):
        """Test getting file tree from ZIP"""
        from services.repository.zip_handler import ZipHandler
        
        # Create a test ZIP file
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            zip_path = tmp.name
            
            with zipfile.ZipFile(zip_path, 'w') as zf:
                zf.writestr("test.txt", "Hello, World!")
                zf.writestr("src/main.py", "print('Hello')")
        
        try:
            async with ZipHandler(zip_path) as handler:
                files = await handler.get_file_tree()
                
                assert len(files) == 2
                assert any(f["path"] == "test.txt" for f in files)
                assert any(f["path"] == "src/main.py" for f in files)
        finally:
            os.unlink(zip_path)


class TestRepositoryScanner:
    """Test repository scanner"""
    
    @pytest.mark.asyncio
    async def test_scanner_initialization(self):
        """Test scanner initialization"""
        scanner = RepositoryScanner()
        
        assert scanner is not None
        assert scanner.file_filter is not None
    
    @pytest.mark.asyncio
    async def test_scan_zip(self):
        """Test scanning ZIP file"""
        # Create a test ZIP file
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            zip_path = tmp.name
            
            with zipfile.ZipFile(zip_path, 'w') as zf:
                zf.writestr("main.py", "print('Hello')")
                zf.writestr("app.js", "console.log('Hello')")
                zf.writestr("image.png", b"fake image data")
        
        try:
            scanner = RepositoryScanner()
            result = await scanner.scan_repository(
                source_type=ProjectSource.ZIP,
                zip_path=zip_path
            )
            
            assert result["source_type"] == "zip"
            assert result["total_files"] >= 2
            assert result["code_files"] >= 2
            assert "scanned_at" in result
        finally:
            os.unlink(zip_path)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
