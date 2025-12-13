@echo off
chcp 65001 >nul 2>&1
title DeepAudit 安全工具安装

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║     DeepAudit 安全工具一键安装脚本 (Windows)                 ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

:: 检查 PowerShell
where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] PowerShell 未找到！
    echo 请确保已安装 Windows PowerShell 5.1 或更高版本
    pause
    exit /b 1
)

:: 获取脚本目录
set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%setup_security_tools.ps1

:: 检查 PowerShell 脚本是否存在
if not exist "%PS_SCRIPT%" (
    echo [错误] 找不到 PowerShell 脚本: %PS_SCRIPT%
    pause
    exit /b 1
)

:: 运行 PowerShell 脚本
echo 正在启动 PowerShell 安装脚本...
echo.

powershell -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*

echo.
echo 按任意键退出...
pause >nul
