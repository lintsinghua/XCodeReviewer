"""
漏洞类型知识模块

包含各种漏洞类型的专业知识
"""

from .injection import SQL_INJECTION, NOSQL_INJECTION, COMMAND_INJECTION, CODE_INJECTION
from .xss import XSS_REFLECTED, XSS_STORED, XSS_DOM
from .auth import AUTH_BYPASS, IDOR, BROKEN_ACCESS_CONTROL
from .crypto import WEAK_CRYPTO, HARDCODED_SECRETS
from .ssrf import SSRF
from .deserialization import INSECURE_DESERIALIZATION
from .path_traversal import PATH_TRAVERSAL
from .xxe import XXE
from .race_condition import RACE_CONDITION

# 所有漏洞知识文档
ALL_VULNERABILITY_DOCS = [
    # 注入类
    SQL_INJECTION,
    NOSQL_INJECTION,
    COMMAND_INJECTION,
    CODE_INJECTION,
    # XSS类
    XSS_REFLECTED,
    XSS_STORED,
    XSS_DOM,
    # 认证授权类
    AUTH_BYPASS,
    IDOR,
    BROKEN_ACCESS_CONTROL,
    # 加密类
    WEAK_CRYPTO,
    HARDCODED_SECRETS,
    # 其他
    SSRF,
    INSECURE_DESERIALIZATION,
    PATH_TRAVERSAL,
    XXE,
    RACE_CONDITION,
]

__all__ = [
    "ALL_VULNERABILITY_DOCS",
    "SQL_INJECTION",
    "NOSQL_INJECTION", 
    "COMMAND_INJECTION",
    "CODE_INJECTION",
    "XSS_REFLECTED",
    "XSS_STORED",
    "XSS_DOM",
    "AUTH_BYPASS",
    "IDOR",
    "BROKEN_ACCESS_CONTROL",
    "WEAK_CRYPTO",
    "HARDCODED_SECRETS",
    "SSRF",
    "INSECURE_DESERIALIZATION",
    "PATH_TRAVERSAL",
    "XXE",
    "RACE_CONDITION",
]
