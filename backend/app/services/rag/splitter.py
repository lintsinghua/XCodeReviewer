"""
代码分块器 - 基于 Tree-sitter AST 的智能代码分块
使用先进的 Python 库实现专业级代码解析
"""

import re
import asyncio
import hashlib
import logging
from typing import List, Dict, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class ChunkType(Enum):
    """代码块类型"""
    FILE = "file"
    MODULE = "module"
    CLASS = "class"
    FUNCTION = "function"
    METHOD = "method"
    INTERFACE = "interface"
    STRUCT = "struct"
    ENUM = "enum"
    IMPORT = "import"
    CONSTANT = "constant"
    CONFIG = "config"
    COMMENT = "comment"
    DECORATOR = "decorator"
    UNKNOWN = "unknown"


@dataclass
class CodeChunk:
    """代码块"""
    id: str
    content: str
    file_path: str
    language: str
    chunk_type: ChunkType
    
    # 位置信息
    line_start: int = 0
    line_end: int = 0
    byte_start: int = 0
    byte_end: int = 0
    
    # 语义信息
    name: Optional[str] = None
    parent_name: Optional[str] = None
    signature: Optional[str] = None
    docstring: Optional[str] = None
    
    # AST 信息
    ast_type: Optional[str] = None
    
    # 关联信息
    imports: List[str] = field(default_factory=list)
    calls: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    definitions: List[str] = field(default_factory=list)
    
    # 安全相关
    security_indicators: List[str] = field(default_factory=list)
    
    # 元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Token 估算
    estimated_tokens: int = 0
    
    def __post_init__(self):
        if not self.id:
            self.id = self._generate_id()
        if not self.estimated_tokens:
            self.estimated_tokens = self._estimate_tokens()
    
    def _generate_id(self) -> str:
        # 使用完整内容的 hash 确保唯一性
        content = f"{self.file_path}:{self.line_start}:{self.line_end}:{self.content}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    def _estimate_tokens(self) -> int:
        # 使用 tiktoken 如果可用
        try:
            import tiktoken
            enc = tiktoken.get_encoding("cl100k_base")
            return len(enc.encode(self.content))
        except ImportError:
            return len(self.content) // 4
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "id": self.id,
            "content": self.content,
            "file_path": self.file_path,
            "language": self.language,
            "chunk_type": self.chunk_type.value,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "name": self.name,
            "parent_name": self.parent_name,
            "signature": self.signature,
            "docstring": self.docstring,
            "ast_type": self.ast_type,
            "imports": self.imports,
            "calls": self.calls,
            "definitions": self.definitions,
            "security_indicators": self.security_indicators,
            "estimated_tokens": self.estimated_tokens,
        }
        # 将 metadata 中的字段提升到顶级，确保 file_hash 等字段可以被正确检索
        if self.metadata:
            for key, value in self.metadata.items():
                if key not in result:
                    result[key] = value
        return result
    
    def to_embedding_text(self) -> str:
        """生成用于嵌入的文本"""
        parts = []
        parts.append(f"File: {self.file_path}")
        if self.name:
            parts.append(f"{self.chunk_type.value.title()}: {self.name}")
        if self.parent_name:
            parts.append(f"In: {self.parent_name}")
        if self.signature:
            parts.append(f"Signature: {self.signature}")
        if self.docstring:
            parts.append(f"Description: {self.docstring[:300]}")
        parts.append(f"Code:\n{self.content}")
        return "\n".join(parts)


class TreeSitterParser:
    """
    基于 Tree-sitter 的代码解析器
    提供 AST 级别的代码分析
    """
    
    # 语言映射
    LANGUAGE_MAP = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".java": "java",
        ".go": "go",
        ".rs": "rust",
        ".cpp": "cpp",
        ".c": "c",
        ".h": "c",
        ".hpp": "cpp",
        ".cs": "csharp",
        ".php": "php",
        ".rb": "ruby",
        ".kt": "kotlin",
        ".swift": "swift",
    }
    
    # 各语言的函数/类节点类型
    DEFINITION_TYPES = {
        "python": {
            "class": ["class_definition"],
            "function": ["function_definition"],
            "method": ["function_definition"],
            "import": ["import_statement", "import_from_statement"],
        },
        "javascript": {
            "class": ["class_declaration", "class"],
            "function": ["function_declaration", "function", "arrow_function", "method_definition"],
            "import": ["import_statement"],
        },
        "typescript": {
            "class": ["class_declaration", "class"],
            "function": ["function_declaration", "function", "arrow_function", "method_definition"],
            "interface": ["interface_declaration"],
            "import": ["import_statement"],
        },
        "java": {
            "class": ["class_declaration"],
            "method": ["method_declaration", "constructor_declaration"],
            "interface": ["interface_declaration"],
            "import": ["import_declaration"],
        },
        "go": {
            "struct": ["type_declaration"],
            "function": ["function_declaration", "method_declaration"],
            "interface": ["type_declaration"],
            "import": ["import_declaration"],
        },
    }
    
    # tree-sitter-languages 支持的语言列表
    SUPPORTED_LANGUAGES = {
        "python", "javascript", "typescript", "tsx", "java", "go", "rust",
        "c", "cpp", "csharp", "php", "ruby", "kotlin", "swift", "bash",
        "json", "yaml", "html", "css", "sql", "markdown",
    }

    def __init__(self):
        self._parsers: Dict[str, Any] = {}
        self._initialized = False

    def _ensure_initialized(self, language: str) -> bool:
        """确保语言解析器已初始化"""
        if language in self._parsers:
            return True

        # 检查语言是否受支持
        if language not in self.SUPPORTED_LANGUAGES:
            # 不是 tree-sitter 支持的语言，静默跳过
            return False

        try:
            from tree_sitter_language_pack import get_parser

            parser = get_parser(language)
            self._parsers[language] = parser
            return True

        except ImportError:
            logger.warning("tree-sitter-languages not installed, falling back to regex parsing")
            return False
        except Exception as e:
            logger.warning(f"Failed to load tree-sitter parser for {language}: {e}")
            return False
    
    def parse(self, code: str, language: str) -> Optional[Any]:
        """解析代码返回 AST（同步方法）"""
        if not self._ensure_initialized(language):
            return None

        parser = self._parsers.get(language)
        if not parser:
            return None

        try:
            tree = parser.parse(code.encode())
            return tree
        except Exception as e:
            logger.warning(f"Failed to parse code: {e}")
            return None

    async def parse_async(self, code: str, language: str) -> Optional[Any]:
        """
        异步解析代码返回 AST

        将 CPU 密集型的 Tree-sitter 解析操作放到线程池中执行，
        避免阻塞事件循环
        """
        return await asyncio.to_thread(self.parse, code, language)

    def extract_definitions(self, tree: Any, code: str, language: str) -> List[Dict[str, Any]]:
        """从 AST 提取定义"""
        if tree is None:
            return []

        definitions = []
        definition_types = self.DEFINITION_TYPES.get(language, {})

        def traverse(node, parent_name=None):
            node_type = node.type

            # 检查是否是定义节点
            matched = False
            for def_category, types in definition_types.items():
                if node_type in types:
                    name = self._extract_name(node, language)

                    # 根据是否有 parent_name 来区分 function 和 method
                    actual_category = def_category
                    if def_category == "function" and parent_name:
                        actual_category = "method"
                    elif def_category == "method" and not parent_name:
                        # 跳过没有 parent 的 method 定义（由 function 类别处理）
                        continue

                    definitions.append({
                        "type": actual_category,
                        "name": name,
                        "parent_name": parent_name,
                        "start_point": node.start_point,
                        "end_point": node.end_point,
                        "start_byte": node.start_byte,
                        "end_byte": node.end_byte,
                        "node_type": node_type,
                    })

                    matched = True

                    # 对于类，继续遍历子节点找方法
                    if def_category == "class":
                        for child in node.children:
                            traverse(child, name)
                        return

                    # 匹配到一个类别后就不再匹配其他类别
                    break

            # 如果没有匹配到定义，继续遍历子节点
            if not matched:
                for child in node.children:
                    traverse(child, parent_name)

        traverse(tree.root_node)
        return definitions
    
    def _extract_name(self, node: Any, language: str) -> Optional[str]:
        """从节点提取名称"""
        # 查找 identifier 子节点
        for child in node.children:
            if child.type in ["identifier", "name", "type_identifier", "property_identifier"]:
                return child.text.decode() if isinstance(child.text, bytes) else child.text
        
        # 对于某些语言的特殊处理
        if language == "python":
            for child in node.children:
                if child.type == "name":
                    return child.text.decode() if isinstance(child.text, bytes) else child.text
        
        return None


class CodeSplitter:
    """
    高级代码分块器
    使用 Tree-sitter 进行 AST 解析，支持多种编程语言
    """
    
    # 危险函数/模式（用于安全指标）
    SECURITY_PATTERNS = {
        "python": [
            (r"\bexec\s*\(", "exec"),
            (r"\beval\s*\(", "eval"),
            (r"\bcompile\s*\(", "compile"),
            (r"\bos\.system\s*\(", "os_system"),
            (r"\bsubprocess\.", "subprocess"),
            (r"\bcursor\.execute\s*\(", "sql_execute"),
            (r"\.execute\s*\(.*%", "sql_format"),
            (r"\bpickle\.loads?\s*\(", "pickle"),
            (r"\byaml\.load\s*\(", "yaml_load"),
            (r"\brequests?\.", "http_request"),
            (r"password\s*=", "password_assign"),
            (r"secret\s*=", "secret_assign"),
            (r"api_key\s*=", "api_key_assign"),
        ],
        "javascript": [
            (r"\beval\s*\(", "eval"),
            (r"\bFunction\s*\(", "function_constructor"),
            (r"innerHTML\s*=", "innerHTML"),
            (r"outerHTML\s*=", "outerHTML"),
            (r"document\.write\s*\(", "document_write"),
            (r"\.exec\s*\(", "exec"),
            (r"\.query\s*\(.*\+", "sql_concat"),
            (r"password\s*[=:]", "password_assign"),
            (r"apiKey\s*[=:]", "api_key_assign"),
        ],
        "java": [
            (r"Runtime\.getRuntime\(\)\.exec", "runtime_exec"),
            (r"ProcessBuilder", "process_builder"),
            (r"\.executeQuery\s*\(.*\+", "sql_concat"),
            (r"ObjectInputStream", "deserialization"),
            (r"XMLDecoder", "xml_decoder"),
            (r"password\s*=", "password_assign"),
        ],
        "go": [
            (r"exec\.Command\s*\(", "exec_command"),
            (r"\.Query\s*\(.*\+", "sql_concat"),
            (r"\.Exec\s*\(.*\+", "sql_concat"),
            (r"template\.HTML\s*\(", "unsafe_html"),
            (r"password\s*=", "password_assign"),
        ],
        "php": [
            (r"\beval\s*\(", "eval"),
            (r"\bexec\s*\(", "exec"),
            (r"\bsystem\s*\(", "system"),
            (r"\bshell_exec\s*\(", "shell_exec"),
            (r"\$_GET\[", "get_input"),
            (r"\$_POST\[", "post_input"),
            (r"\$_REQUEST\[", "request_input"),
        ],
    }
    
    def __init__(
        self,
        max_chunk_size: int = 1500,
        min_chunk_size: int = 100,
        overlap_size: int = 50,
        preserve_structure: bool = True,
        use_tree_sitter: bool = True,
    ):
        self.max_chunk_size = max_chunk_size
        self.min_chunk_size = min_chunk_size
        self.overlap_size = overlap_size
        self.preserve_structure = preserve_structure
        self.use_tree_sitter = use_tree_sitter
        
        self._ts_parser = TreeSitterParser() if use_tree_sitter else None
    
    def detect_language(self, file_path: str) -> str:
        """检测编程语言"""
        ext = Path(file_path).suffix.lower()
        return TreeSitterParser.LANGUAGE_MAP.get(ext, "text")
    
    def split_file(
        self,
        content: str,
        file_path: str,
        language: Optional[str] = None
    ) -> List[CodeChunk]:
        """
        分割单个文件
        
        Args:
            content: 文件内容
            file_path: 文件路径
            language: 编程语言（可选）
            
        Returns:
            代码块列表
        """
        if not content or not content.strip():
            return []
        
        if language is None:
            language = self.detect_language(file_path)
        
        chunks = []
        
        try:
            # 尝试使用 Tree-sitter 解析
            if self.use_tree_sitter and self._ts_parser:
                tree = self._ts_parser.parse(content, language)
                if tree:
                    chunks = self._split_by_ast(content, file_path, language, tree)
            
            # 如果 AST 解析失败或没有结果，使用增强的正则解析
            if not chunks:
                chunks = self._split_by_enhanced_regex(content, file_path, language)
            
            # 如果还是没有，使用基于行的分块
            if not chunks:
                chunks = self._split_by_lines(content, file_path, language)
            
            # 后处理：提取安全指标
            for chunk in chunks:
                chunk.security_indicators = self._extract_security_indicators(
                    chunk.content, language
                )
            
            # 后处理：使用语义分析增强
            self._enrich_chunks_with_semantics(chunks, content, language)
            
        except Exception as e:
            logger.warning(f"分块失败 {file_path}: {e}, 使用简单分块")
            chunks = self._split_by_lines(content, file_path, language)

        return chunks

    async def split_file_async(
        self,
        content: str,
        file_path: str,
        language: Optional[str] = None
    ) -> List[CodeChunk]:
        """
        异步分割单个文件

        将 CPU 密集型的分块操作（包括 Tree-sitter 解析）放到线程池中执行，
        避免阻塞事件循环。

        Args:
            content: 文件内容
            file_path: 文件路径
            language: 编程语言（可选）

        Returns:
            代码块列表
        """
        return await asyncio.to_thread(self.split_file, content, file_path, language)

    def _split_by_ast(
        self,
        content: str,
        file_path: str,
        language: str,
        tree: Any
    ) -> List[CodeChunk]:
        """基于 AST 分块"""
        chunks = []
        lines = content.split('\n')
        
        # 提取定义
        definitions = self._ts_parser.extract_definitions(tree, content, language)
        
        if not definitions:
            return []
        
        # 为每个定义创建代码块
        for defn in definitions:
            start_line = defn["start_point"][0]
            end_line = defn["end_point"][0]
            
            # 提取代码内容
            chunk_lines = lines[start_line:end_line + 1]
            chunk_content = '\n'.join(chunk_lines)
            
            if len(chunk_content.strip()) < self.min_chunk_size // 4:
                continue
            
            chunk_type = ChunkType.CLASS if defn["type"] == "class" else \
                        ChunkType.FUNCTION if defn["type"] in ["function", "method"] else \
                        ChunkType.INTERFACE if defn["type"] == "interface" else \
                        ChunkType.STRUCT if defn["type"] == "struct" else \
                        ChunkType.IMPORT if defn["type"] == "import" else \
                        ChunkType.MODULE
            
            chunk = CodeChunk(
                id="",
                content=chunk_content,
                file_path=file_path,
                language=language,
                chunk_type=chunk_type,
                line_start=start_line + 1,
                line_end=end_line + 1,
                byte_start=defn["start_byte"],
                byte_end=defn["end_byte"],
                name=defn.get("name"),
                parent_name=defn.get("parent_name"),
                ast_type=defn.get("node_type"),
            )
            
            # 如果块太大，进一步分割
            if chunk.estimated_tokens > self.max_chunk_size:
                sub_chunks = self._split_large_chunk(chunk)
                chunks.extend(sub_chunks)
            else:
                chunks.append(chunk)
        
        return chunks
    
    def _split_by_enhanced_regex(
        self,
        content: str,
        file_path: str,
        language: str
    ) -> List[CodeChunk]:
        """增强的正则表达式分块（支持更多语言）"""
        chunks = []
        lines = content.split('\n')
        
        # 各语言的定义模式
        patterns = {
            "python": [
                (r"^(\s*)class\s+(\w+)(?:\s*\([^)]*\))?\s*:", ChunkType.CLASS),
                (r"^(\s*)(?:async\s+)?def\s+(\w+)\s*\([^)]*\)\s*(?:->[^:]+)?:", ChunkType.FUNCTION),
            ],
            "javascript": [
                (r"^(\s*)(?:export\s+)?class\s+(\w+)", ChunkType.CLASS),
                (r"^(\s*)(?:export\s+)?(?:async\s+)?function\s*(\w*)\s*\(", ChunkType.FUNCTION),
                (r"^(\s*)(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>", ChunkType.FUNCTION),
            ],
            "typescript": [
                (r"^(\s*)(?:export\s+)?(?:abstract\s+)?class\s+(\w+)", ChunkType.CLASS),
                (r"^(\s*)(?:export\s+)?interface\s+(\w+)", ChunkType.INTERFACE),
                (r"^(\s*)(?:export\s+)?(?:async\s+)?function\s*(\w*)", ChunkType.FUNCTION),
            ],
            "java": [
                (r"^(\s*)(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?class\s+(\w+)", ChunkType.CLASS),
                (r"^(\s*)(?:public|private|protected)?\s*interface\s+(\w+)", ChunkType.INTERFACE),
                (r"^(\s*)(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\],\s]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{", ChunkType.METHOD),
            ],
            "go": [
                (r"^type\s+(\w+)\s+struct\s*\{", ChunkType.STRUCT),
                (r"^type\s+(\w+)\s+interface\s*\{", ChunkType.INTERFACE),
                (r"^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\([^)]*\)", ChunkType.FUNCTION),
            ],
            "php": [
                (r"^(\s*)(?:abstract\s+)?class\s+(\w+)", ChunkType.CLASS),
                (r"^(\s*)interface\s+(\w+)", ChunkType.INTERFACE),
                (r"^(\s*)(?:public|private|protected)?\s*(?:static\s+)?function\s+(\w+)", ChunkType.FUNCTION),
            ],
        }
        
        lang_patterns = patterns.get(language, [])
        if not lang_patterns:
            return []
        
        # 找到所有定义的位置
        definitions = []
        for i, line in enumerate(lines):
            for pattern, chunk_type in lang_patterns:
                match = re.match(pattern, line)
                if match:
                    indent = len(match.group(1)) if match.lastindex >= 1 else 0
                    name = match.group(2) if match.lastindex >= 2 else None
                    definitions.append({
                        "line": i,
                        "indent": indent,
                        "name": name,
                        "type": chunk_type,
                    })
                    break
        
        if not definitions:
            return []
        
        # 计算每个定义的范围
        for i, defn in enumerate(definitions):
            start_line = defn["line"]
            base_indent = defn["indent"]
            
            # 查找结束位置
            end_line = len(lines) - 1
            for j in range(start_line + 1, len(lines)):
                line = lines[j]
                if line.strip():
                    current_indent = len(line) - len(line.lstrip())
                    # 如果缩进回到基础级别，检查是否是下一个定义
                    if current_indent <= base_indent:
                        # 检查是否是下一个定义
                        is_next_def = any(d["line"] == j for d in definitions)
                        if is_next_def or (current_indent < base_indent):
                            end_line = j - 1
                            break
            
            chunk_content = '\n'.join(lines[start_line:end_line + 1])
            
            if len(chunk_content.strip()) < 10:
                continue
            
            chunk = CodeChunk(
                id="",
                content=chunk_content,
                file_path=file_path,
                language=language,
                chunk_type=defn["type"],
                line_start=start_line + 1,
                line_end=end_line + 1,
                name=defn.get("name"),
            )
            
            if chunk.estimated_tokens > self.max_chunk_size:
                sub_chunks = self._split_large_chunk(chunk)
                chunks.extend(sub_chunks)
            else:
                chunks.append(chunk)
        
        return chunks
    
    def _split_by_lines(
        self,
        content: str,
        file_path: str,
        language: str
    ) -> List[CodeChunk]:
        """基于行数分块（回退方案）"""
        chunks = []
        lines = content.split('\n')
        
        # 估算每行 Token 数
        total_tokens = len(content) // 4
        avg_tokens_per_line = max(1, total_tokens // max(1, len(lines)))
        lines_per_chunk = max(10, self.max_chunk_size // avg_tokens_per_line)
        overlap_lines = self.overlap_size // avg_tokens_per_line
        
        for i in range(0, len(lines), lines_per_chunk - overlap_lines):
            end = min(i + lines_per_chunk, len(lines))
            chunk_content = '\n'.join(lines[i:end])
            
            if len(chunk_content.strip()) < 10:
                continue
            
            chunk = CodeChunk(
                id="",
                content=chunk_content,
                file_path=file_path,
                language=language,
                chunk_type=ChunkType.MODULE,
                line_start=i + 1,
                line_end=end,
            )
            chunks.append(chunk)
            
            if end >= len(lines):
                break
        
        return chunks
    
    def _split_large_chunk(self, chunk: CodeChunk) -> List[CodeChunk]:
        """分割过大的代码块"""
        sub_chunks = []
        lines = chunk.content.split('\n')
        
        avg_tokens_per_line = max(1, chunk.estimated_tokens // max(1, len(lines)))
        lines_per_chunk = max(10, self.max_chunk_size // avg_tokens_per_line)
        
        for i in range(0, len(lines), lines_per_chunk):
            end = min(i + lines_per_chunk, len(lines))
            sub_content = '\n'.join(lines[i:end])
            
            if len(sub_content.strip()) < 10:
                continue
            
            sub_chunk = CodeChunk(
                id="",
                content=sub_content,
                file_path=chunk.file_path,
                language=chunk.language,
                chunk_type=chunk.chunk_type,
                line_start=chunk.line_start + i,
                line_end=chunk.line_start + end - 1,
                name=chunk.name,
                parent_name=chunk.parent_name,
            )
            sub_chunks.append(sub_chunk)
        
        return sub_chunks if sub_chunks else [chunk]
    
    def _extract_security_indicators(self, content: str, language: str) -> List[str]:
        """提取安全相关指标"""
        indicators = []
        patterns = self.SECURITY_PATTERNS.get(language, [])
        
        # 添加通用模式
        common_patterns = [
            (r"password", "password"),
            (r"secret", "secret"),
            (r"api[_-]?key", "api_key"),
            (r"token", "token"),
            (r"private[_-]?key", "private_key"),
            (r"credential", "credential"),
        ]
        
        all_patterns = patterns + common_patterns
        
        for pattern, name in all_patterns:
            try:
                if re.search(pattern, content, re.IGNORECASE):
                    if name not in indicators:
                        indicators.append(name)
            except re.error:
                continue
        
        return indicators[:15]
    
    def _enrich_chunks_with_semantics(
        self,
        chunks: List[CodeChunk],
        full_content: str,
        language: str
    ):
        """使用语义分析增强代码块"""
        # 提取导入
        imports = self._extract_imports(full_content, language)
        
        for chunk in chunks:
            # 添加相关导入
            chunk.imports = self._filter_relevant_imports(imports, chunk.content)
            
            # 提取函数调用
            chunk.calls = self._extract_function_calls(chunk.content, language)
            
            # 提取定义
            chunk.definitions = self._extract_definitions(chunk.content, language)
    
    def _extract_imports(self, content: str, language: str) -> List[str]:
        """提取导入语句"""
        imports = []
        
        patterns = {
            "python": [
                r"^import\s+([\w.]+)",
                r"^from\s+([\w.]+)\s+import",
            ],
            "javascript": [
                r"^import\s+.*\s+from\s+['\"]([^'\"]+)['\"]",
                r"require\s*\(['\"]([^'\"]+)['\"]\)",
            ],
            "typescript": [
                r"^import\s+.*\s+from\s+['\"]([^'\"]+)['\"]",
            ],
            "java": [
                r"^import\s+([\w.]+);",
            ],
            "go": [
                r"['\"]([^'\"]+)['\"]",
            ],
        }
        
        for pattern in patterns.get(language, []):
            matches = re.findall(pattern, content, re.MULTILINE)
            imports.extend(matches)
        
        return list(set(imports))
    
    def _filter_relevant_imports(self, all_imports: List[str], chunk_content: str) -> List[str]:
        """过滤与代码块相关的导入"""
        relevant = []
        for imp in all_imports:
            module_name = imp.split('.')[-1]
            if re.search(rf'\b{re.escape(module_name)}\b', chunk_content):
                relevant.append(imp)
        return relevant[:20]
    
    def _extract_function_calls(self, content: str, language: str) -> List[str]:
        """提取函数调用"""
        pattern = r'\b(\w+)\s*\('
        matches = re.findall(pattern, content)
        
        keywords = {
            "python": {"if", "for", "while", "with", "def", "class", "return", "except", "print", "assert", "lambda"},
            "javascript": {"if", "for", "while", "switch", "function", "return", "catch", "console", "async", "await"},
            "java": {"if", "for", "while", "switch", "return", "catch", "throw", "new"},
            "go": {"if", "for", "switch", "return", "func", "go", "defer"},
        }
        
        lang_keywords = keywords.get(language, set())
        calls = [m for m in matches if m not in lang_keywords]
        
        return list(set(calls))[:30]
    
    def _extract_definitions(self, content: str, language: str) -> List[str]:
        """提取定义的标识符"""
        definitions = []
        
        patterns = {
            "python": [
                r"def\s+(\w+)\s*\(",
                r"class\s+(\w+)",
                r"(\w+)\s*=\s*",
            ],
            "javascript": [
                r"function\s+(\w+)",
                r"(?:const|let|var)\s+(\w+)",
                r"class\s+(\w+)",
            ],
        }
        
        for pattern in patterns.get(language, []):
            matches = re.findall(pattern, content)
            definitions.extend(matches)
        
        return list(set(definitions))[:20]

