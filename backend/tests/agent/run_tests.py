#!/usr/bin/env python
"""
Agent 测试运行器
运行所有 Agent 相关测试并生成报告
"""

import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path


def run_tests():
    """运行测试"""
    # 获取项目根目录
    project_root = Path(__file__).parent.parent.parent
    os.chdir(project_root)
    
    print("=" * 60)
    print("DeepAudit Agent 测试套件")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    # 测试命令
    cmd = [
        sys.executable, "-m", "pytest",
        "tests/agent/",
        "-v",
        "--tb=short",
        "-x",  # 遇到第一个失败就停止
        "--color=yes",
    ]
    
    print(f"运行命令: {' '.join(cmd)}")
    print()
    
    # 运行测试
    result = subprocess.run(cmd, cwd=project_root)
    
    print()
    print("=" * 60)
    if result.returncode == 0:
        print("✅ 所有测试通过!")
    else:
        print(f"❌ 测试失败 (退出码: {result.returncode})")
    print("=" * 60)
    
    return result.returncode


def run_tests_with_coverage():
    """运行测试并生成覆盖率报告"""
    project_root = Path(__file__).parent.parent.parent
    os.chdir(project_root)
    
    cmd = [
        sys.executable, "-m", "pytest",
        "tests/agent/",
        "-v",
        "--cov=app/services/agent",
        "--cov-report=term-missing",
        "--cov-report=html:coverage_agent",
    ]
    
    result = subprocess.run(cmd, cwd=project_root)
    return result.returncode


def run_specific_test(test_name: str):
    """运行特定测试"""
    project_root = Path(__file__).parent.parent.parent
    os.chdir(project_root)
    
    cmd = [
        sys.executable, "-m", "pytest",
        f"tests/agent/{test_name}",
        "-v",
        "--tb=long",
        "-s",  # 显示 print 输出
    ]
    
    result = subprocess.run(cmd, cwd=project_root)
    return result.returncode


if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "--coverage":
            sys.exit(run_tests_with_coverage())
        else:
            sys.exit(run_specific_test(sys.argv[1]))
    else:
        sys.exit(run_tests())

