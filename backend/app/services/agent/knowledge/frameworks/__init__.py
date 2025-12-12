"""
框架安全知识模块

包含各种框架的安全特性和常见漏洞模式
"""

from .fastapi import FASTAPI_SECURITY
from .django import DJANGO_SECURITY
from .flask import FLASK_SECURITY
from .express import EXPRESS_SECURITY
from .react import REACT_SECURITY
from .supabase import SUPABASE_SECURITY

# 所有框架知识文档
ALL_FRAMEWORK_DOCS = [
    FASTAPI_SECURITY,
    DJANGO_SECURITY,
    FLASK_SECURITY,
    EXPRESS_SECURITY,
    REACT_SECURITY,
    SUPABASE_SECURITY,
]

__all__ = [
    "ALL_FRAMEWORK_DOCS",
    "FASTAPI_SECURITY",
    "DJANGO_SECURITY",
    "FLASK_SECURITY",
    "EXPRESS_SECURITY",
    "REACT_SECURITY",
    "SUPABASE_SECURITY",
]
