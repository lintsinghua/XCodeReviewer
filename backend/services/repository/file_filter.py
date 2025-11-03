"""File Filter Service
Service for filtering files based on patterns and types.
"""
import re
import mimetypes
from pathlib import Path
from typing import List, Set, Optional
from loguru import logger


class FileFilter:
    """File filter service"""
    
    # Default exclusion patterns
    DEFAULT_EXCLUDE_PATTERNS = [
        # Version control
        r"\.git/",
        r"\.svn/",
        r"\.hg/",
        
        # Dependencies
        r"node_modules/",
        r"vendor/",
        r"venv/",
        r"\.venv/",
        r"__pycache__/",
        r"\.pytest_cache/",
        
        # Build outputs
        r"dist/",
        r"build/",
        r"target/",
        r"out/",
        r"\.next/",
        
        # IDE
        r"\.idea/",
        r"\.vscode/",
        r"\.vs/",
        
        # OS
        r"\.DS_Store",
        r"Thumbs\.db",
        
        # Logs
        r"\.log$",
        r"logs/",
        
        # Temporary files
        r"\.tmp$",
        r"\.temp$",
        r"~$",
    ]
    
    # Binary file extensions
    BINARY_EXTENSIONS = {
        # Images
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
        # Videos
        ".mp4", ".avi", ".mov", ".wmv", ".flv",
        # Audio
        ".mp3", ".wav", ".flac", ".aac",
        # Archives
        ".zip", ".tar", ".gz", ".rar", ".7z",
        # Executables
        ".exe", ".dll", ".so", ".dylib",
        # Documents
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        # Fonts
        ".ttf", ".otf", ".woff", ".woff2",
        # Other
        ".pyc", ".pyo", ".class", ".o", ".a",
    }
    
    # Code file extensions
    CODE_EXTENSIONS = {
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".h", ".hpp",
        ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".scala", ".r",
        ".m", ".mm", ".sh", ".bash", ".zsh", ".ps1", ".sql", ".html", ".css",
        ".scss", ".sass", ".less", ".vue", ".dart", ".lua", ".perl", ".pl",
    }
    
    def __init__(
        self,
        exclude_patterns: Optional[List[str]] = None,
        include_patterns: Optional[List[str]] = None,
        max_file_size: int = 1024 * 1024  # 1MB
    ):
        """
        Initialize file filter.
        
        Args:
            exclude_patterns: Additional exclusion patterns
            include_patterns: Inclusion patterns (overrides exclusions)
            max_file_size: Maximum file size in bytes
        """
        self.exclude_patterns = self.DEFAULT_EXCLUDE_PATTERNS.copy()
        if exclude_patterns:
            self.exclude_patterns.extend(exclude_patterns)
        
        self.include_patterns = include_patterns or []
        self.max_file_size = max_file_size
        
        # Compile regex patterns
        self.exclude_regex = [re.compile(p) for p in self.exclude_patterns]
        self.include_regex = [re.compile(p) for p in self.include_patterns]
    
    def should_include(self, file_path: str, file_size: Optional[int] = None) -> bool:
        """
        Check if file should be included.
        
        Args:
            file_path: File path
            file_size: File size in bytes (optional)
            
        Returns:
            True if file should be included
        """
        # Check include patterns first (highest priority)
        if self.include_regex:
            for pattern in self.include_regex:
                if pattern.search(file_path):
                    return True
            return False
        
        # Check exclude patterns
        for pattern in self.exclude_regex:
            if pattern.search(file_path):
                return False
        
        # Check if binary file
        if self.is_binary(file_path):
            return False
        
        # Check file size
        if file_size and file_size > self.max_file_size:
            logger.debug(f"Skipping large file: {file_path} ({file_size} bytes)")
            return False
        
        return True
    
    def is_binary(self, file_path: str) -> bool:
        """
        Check if file is binary.
        
        Args:
            file_path: File path
            
        Returns:
            True if file is binary
        """
        # Check extension
        ext = Path(file_path).suffix.lower()
        if ext in self.BINARY_EXTENSIONS:
            return True
        
        # Check MIME type
        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type:
            if not mime_type.startswith("text/") and mime_type != "application/json":
                return True
        
        return False
    
    def is_code_file(self, file_path: str) -> bool:
        """
        Check if file is a code file.
        
        Args:
            file_path: File path
            
        Returns:
            True if file is a code file
        """
        ext = Path(file_path).suffix.lower()
        return ext in self.CODE_EXTENSIONS
    
    def detect_language(self, file_path: str) -> Optional[str]:
        """
        Detect programming language from file extension.
        
        Args:
            file_path: File path
            
        Returns:
            Language name or None
        """
        ext = Path(file_path).suffix.lower()
        
        language_map = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".jsx": "JavaScript",
            ".tsx": "TypeScript",
            ".java": "Java",
            ".c": "C",
            ".cpp": "C++",
            ".h": "C/C++",
            ".hpp": "C++",
            ".cs": "C#",
            ".go": "Go",
            ".rs": "Rust",
            ".rb": "Ruby",
            ".php": "PHP",
            ".swift": "Swift",
            ".kt": "Kotlin",
            ".scala": "Scala",
            ".r": "R",
            ".m": "Objective-C",
            ".sh": "Shell",
            ".bash": "Bash",
            ".sql": "SQL",
            ".html": "HTML",
            ".css": "CSS",
            ".vue": "Vue",
            ".dart": "Dart",
        }
        
        return language_map.get(ext)
    
    def filter_files(self, files: List[dict]) -> List[dict]:
        """
        Filter list of files.
        
        Args:
            files: List of file dictionaries with 'path' and optionally 'size'
            
        Returns:
            Filtered list of files
        """
        filtered = []
        
        for file in files:
            path = file.get("path", "")
            size = file.get("size")
            
            if self.should_include(path, size):
                filtered.append(file)
        
        return filtered
    
    def get_statistics(self, files: List[dict]) -> dict:
        """
        Get statistics about files.
        
        Args:
            files: List of file dictionaries
            
        Returns:
            Statistics dictionary
        """
        total_files = len(files)
        code_files = 0
        languages = {}
        total_size = 0
        
        for file in files:
            path = file.get("path", "")
            size = file.get("size", 0)
            
            if self.is_code_file(path):
                code_files += 1
                
                lang = self.detect_language(path)
                if lang:
                    languages[lang] = languages.get(lang, 0) + 1
            
            total_size += size
        
        return {
            "total_files": total_files,
            "code_files": code_files,
            "languages": languages,
            "total_size": total_size,
            "primary_language": max(languages.items(), key=lambda x: x[1])[0] if languages else None
        }
