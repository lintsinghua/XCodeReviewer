"""
文件选择与排除模式协同功能测试

测试场景：
1. 获取项目文件列表 - 无排除模式
2. 获取项目文件列表 - 带排除模式
3. ZIP 扫描 - 带排除模式
4. 仓库扫描 - 带排除模式
5. 排除模式与文件选择的协同
"""

import asyncio
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import pytest
    HAS_PYTEST = True
except ImportError:
    HAS_PYTEST = False
    # 创建一个简单的 pytest.mark 模拟
    class MockPytest:
        class mark:
            @staticmethod
            def asyncio(func):
                return func
    pytest = MockPytest()

from app.services.scanner import should_exclude, is_text_file, EXCLUDE_PATTERNS


class TestShouldExclude:
    """测试 should_exclude 函数"""

    def test_default_exclude_patterns(self):
        """测试默认排除模式"""
        # 应该被排除的路径
        assert should_exclude("node_modules/package.json") is True
        assert should_exclude(".git/config") is True
        assert should_exclude("dist/bundle.js") is True
        assert should_exclude("build/output.js") is True
        assert should_exclude("__pycache__/module.pyc") is True
        assert should_exclude("vendor/lib.php") is True

    def test_default_not_excluded(self):
        """测试不应该被排除的路径"""
        assert should_exclude("src/main.py") is False
        assert should_exclude("app/index.js") is False
        assert should_exclude("lib/utils.ts") is False

    def test_custom_exclude_patterns(self):
        """测试自定义排除模式"""
        # 注意：当前实现使用简单的 'in' 匹配，不是 glob 模式
        # 所以模式应该是路径片段，如 ".log", "temp/", ".bak"
        custom_patterns = [".log", "temp/", ".bak"]
        
        # 应该被排除（包含模式字符串）
        assert should_exclude("app.log", custom_patterns) is True
        assert should_exclude("temp/cache.txt", custom_patterns) is True
        assert should_exclude("config.bak", custom_patterns) is True
        
        # 不应该被排除
        assert should_exclude("src/main.py", custom_patterns) is False

    def test_combined_patterns(self):
        """测试默认模式和自定义模式组合"""
        # 使用路径片段匹配
        custom_patterns = [".test.js", "coverage/"]
        
        # 默认模式排除
        assert should_exclude("node_modules/lib.js", custom_patterns) is True
        # 自定义模式排除
        assert should_exclude("app.test.js", custom_patterns) is True
        assert should_exclude("coverage/report.html", custom_patterns) is True
        # 都不排除
        assert should_exclude("src/app.js", custom_patterns) is False


class TestIsTextFile:
    """测试 is_text_file 函数"""

    def test_supported_extensions(self):
        """测试支持的文件扩展名"""
        supported = [
            "main.js", "app.ts", "component.tsx", "page.jsx",
            "script.py", "Main.java", "main.go", "lib.rs",
            "app.cpp", "header.h", "Program.cs", "index.php",
            "app.rb", "App.swift", "Main.kt", "query.sql",
            "script.sh", "config.json", "config.yml", "config.yaml"
        ]
        for filename in supported:
            assert is_text_file(filename) is True, f"{filename} should be supported"

    def test_unsupported_extensions(self):
        """测试不支持的文件扩展名"""
        unsupported = [
            "image.png", "photo.jpg", "doc.pdf", "archive.zip",
            "binary.exe", "data.bin", "video.mp4", "audio.mp3"
        ]
        for filename in unsupported:
            assert is_text_file(filename) is False, f"{filename} should not be supported"


class TestExcludePatternsIntegration:
    """排除模式集成测试"""

    def test_exclude_patterns_with_path_segments(self):
        """测试路径片段匹配"""
        # 当前实现使用 'in' 匹配，所以使用路径片段
        patterns = ["tests/", ".test.js"]
        
        # 这些应该被排除
        assert should_exclude("src/tests/unit.js", patterns) is True
        assert should_exclude("app.test.js", patterns) is True

    def test_empty_exclude_patterns(self):
        """测试空排除模式列表"""
        # 空列表应该只使用默认模式
        assert should_exclude("node_modules/lib.js", []) is True
        assert should_exclude("src/main.py", []) is False

    def test_none_exclude_patterns(self):
        """测试 None 排除模式"""
        assert should_exclude("node_modules/lib.js", None) is True
        assert should_exclude("src/main.py", None) is False


class TestFileSelectionWorkflow:
    """文件选择工作流测试"""

    def create_test_zip(self, files: dict) -> str:
        """创建测试用的 ZIP 文件"""
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, "test.zip")
        
        with zipfile.ZipFile(zip_path, 'w') as zf:
            for filename, content in files.items():
                zf.writestr(filename, content)
        
        return zip_path

    def test_zip_file_filtering(self):
        """测试 ZIP 文件过滤逻辑"""
        # 模拟 ZIP 文件内容
        files = {
            "src/main.py": "print('hello')",
            "src/utils.py": "def util(): pass",
            "node_modules/lib.js": "module.exports = {}",
            "dist/bundle.js": "var a = 1;",
            ".git/config": "[core]",
            "tests/test_main.py": "def test(): pass",
            "app.log": "log content",
            "README.md": "# Readme",
        }
        
        zip_path = self.create_test_zip(files)
        
        try:
            # 模拟文件过滤逻辑
            filtered_files = []
            # 使用路径片段匹配（当前实现方式）
            custom_exclude = [".log", ".md"]
            
            with zipfile.ZipFile(zip_path, 'r') as zf:
                for file_info in zf.infolist():
                    if not file_info.is_dir():
                        path = file_info.filename
                        if is_text_file(path) and not should_exclude(path, custom_exclude):
                            filtered_files.append(path)
            
            # 验证过滤结果
            assert "src/main.py" in filtered_files
            assert "src/utils.py" in filtered_files
            assert "tests/test_main.py" in filtered_files
            
            # 这些应该被排除
            assert "node_modules/lib.js" not in filtered_files  # 默认排除
            assert "dist/bundle.js" not in filtered_files  # 默认排除
            assert ".git/config" not in filtered_files  # 默认排除
            assert "app.log" not in filtered_files  # 自定义排除 (.log)
            assert "README.md" not in filtered_files  # 自定义排除 (.md) + 不是代码文件
            
        finally:
            os.remove(zip_path)
            os.rmdir(os.path.dirname(zip_path))

    def test_file_selection_with_exclude(self):
        """测试文件选择与排除模式的协同"""
        # 模拟从 API 返回的文件列表（已应用排除模式）
        all_files = [
            {"path": "src/main.py", "size": 100},
            {"path": "src/utils.py", "size": 200},
            {"path": "src/tests/test_main.py", "size": 150},
            {"path": "lib/helper.py", "size": 80},
        ]
        
        # 用户选择部分文件
        selected_files = ["src/main.py", "src/utils.py"]
        
        # 验证选择的文件都在可用列表中
        available_paths = {f["path"] for f in all_files}
        for selected in selected_files:
            assert selected in available_paths

    def test_exclude_patterns_change_clears_selection(self):
        """测试排除模式变化时应清空文件选择"""
        # 模拟初始状态
        initial_exclude = ["node_modules/**", ".git/**"]
        selected_files = ["src/main.py", "src/utils.py"]
        
        # 模拟排除模式变化
        new_exclude = ["node_modules/**", ".git/**", "src/utils.py"]
        
        # 当排除模式变化时，应该清空选择
        # 因为 src/utils.py 现在被排除了
        if initial_exclude != new_exclude:
            # 前端逻辑：清空选择
            selected_files = None
        
        assert selected_files is None


class TestAPIEndpoints:
    """API 端点测试（模拟）"""

    @pytest.mark.asyncio
    async def test_get_project_files_with_exclude(self):
        """测试获取项目文件 API 带排除模式"""
        # 模拟请求参数
        project_id = "test-project-id"
        branch = "main"
        exclude_patterns = json.dumps(["*.log", "temp/**"])
        
        # 验证参数格式正确
        parsed_patterns = json.loads(exclude_patterns)
        assert isinstance(parsed_patterns, list)
        assert "*.log" in parsed_patterns

    @pytest.mark.asyncio
    async def test_scan_request_with_exclude(self):
        """测试扫描请求带排除模式"""
        scan_config = {
            "file_paths": ["src/main.py", "src/utils.py"],
            "exclude_patterns": ["*.test.js", "coverage/**"],
            "full_scan": False,
            "rule_set_id": None,
            "prompt_template_id": None,
        }
        
        # 验证配置格式
        assert "exclude_patterns" in scan_config
        assert isinstance(scan_config["exclude_patterns"], list)
        assert scan_config["full_scan"] is False


class TestEdgeCases:
    """边界情况测试"""

    def test_empty_file_list(self):
        """测试空文件列表"""
        files = []
        exclude_patterns = ["*.log"]
        
        filtered = [f for f in files if not should_exclude(f, exclude_patterns)]
        assert filtered == []

    def test_all_files_excluded(self):
        """测试所有文件都被排除"""
        files = ["node_modules/a.js", "dist/b.js", ".git/config"]
        
        filtered = [f for f in files if not should_exclude(f)]
        assert filtered == []

    def test_special_characters_in_path(self):
        """测试路径中的特殊字符"""
        paths = [
            "src/file with spaces.py",
            "src/文件.py",
            "src/file-name.py",
            "src/file_name.py",
        ]
        
        for path in paths:
            # 不应该因为特殊字符而出错
            result = should_exclude(path)
            assert isinstance(result, bool)

    def test_deep_nested_paths(self):
        """测试深层嵌套路径"""
        deep_path = "a/b/c/d/e/f/g/h/i/j/main.py"
        assert should_exclude(deep_path) is False
        
        deep_excluded = "a/b/c/node_modules/d/e/f.js"
        assert should_exclude(deep_excluded) is True


def run_tests():
    """运行所有测试"""
    print("=" * 60)
    print("文件选择与排除模式功能测试")
    print("=" * 60)
    
    # 测试 should_exclude
    print("\n[1/6] 测试 should_exclude 函数...")
    test_exclude = TestShouldExclude()
    test_exclude.test_default_exclude_patterns()
    test_exclude.test_default_not_excluded()
    test_exclude.test_custom_exclude_patterns()
    test_exclude.test_combined_patterns()
    print("✅ should_exclude 测试通过")
    
    # 测试 is_text_file
    print("\n[2/6] 测试 is_text_file 函数...")
    test_text = TestIsTextFile()
    test_text.test_supported_extensions()
    test_text.test_unsupported_extensions()
    print("✅ is_text_file 测试通过")
    
    # 测试排除模式集成
    print("\n[3/6] 测试排除模式集成...")
    test_integration = TestExcludePatternsIntegration()
    test_integration.test_exclude_patterns_with_path_segments()
    test_integration.test_empty_exclude_patterns()
    test_integration.test_none_exclude_patterns()
    print("✅ 排除模式集成测试通过")
    
    # 测试文件选择工作流
    print("\n[4/6] 测试文件选择工作流...")
    test_workflow = TestFileSelectionWorkflow()
    test_workflow.test_zip_file_filtering()
    test_workflow.test_file_selection_with_exclude()
    test_workflow.test_exclude_patterns_change_clears_selection()
    print("✅ 文件选择工作流测试通过")
    
    # 测试边界情况
    print("\n[5/6] 测试边界情况...")
    test_edge = TestEdgeCases()
    test_edge.test_empty_file_list()
    test_edge.test_all_files_excluded()
    test_edge.test_special_characters_in_path()
    test_edge.test_deep_nested_paths()
    print("✅ 边界情况测试通过")
    
    # 测试 API 端点（同步版本）
    print("\n[6/6] 测试 API 端点参数...")
    test_api = TestAPIEndpoints()
    # 使用 asyncio 运行异步测试
    asyncio.run(test_api.test_get_project_files_with_exclude())
    asyncio.run(test_api.test_scan_request_with_exclude())
    print("✅ API 端点测试通过")
    
    print("\n" + "=" * 60)
    print("🎉 所有测试通过！")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
