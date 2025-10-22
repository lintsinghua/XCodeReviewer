@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🚀 XCodeReviewer 项目设置开始...

REM 检查 Node.js 版本
echo 📋 检查 Node.js 版本...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do (
    set NODE_MAJOR=%%a
    set NODE_MAJOR=!NODE_MAJOR:~1!
)

if !NODE_MAJOR! LSS 18 (
    echo ❌ Node.js 版本过低，需要 18+，当前版本: 
    node -v
    pause
    exit /b 1
)

echo ✅ Node.js 版本检查通过: 
node -v

REM 检查包管理器
echo 📦 检查包管理器...
pnpm -v >nul 2>&1
if not errorlevel 1 (
    set PKG_MANAGER=pnpm
    echo ✅ 使用 pnpm
    goto install_deps
)

yarn -v >nul 2>&1
if not errorlevel 1 (
    set PKG_MANAGER=yarn
    echo ✅ 使用 yarn
    goto install_deps
)

npm -v >nul 2>&1
if not errorlevel 1 (
    set PKG_MANAGER=npm
    echo ✅ 使用 npm
    goto install_deps
)

echo ❌ 未找到包管理器，请安装 npm、yarn 或 pnpm
pause
exit /b 1

:install_deps
REM 安装依赖
echo 📥 安装项目依赖...
%PKG_MANAGER% install

REM 检查环境变量文件
echo 🔧 检查环境变量配置...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ✅ 已创建 .env 文件，请编辑配置必要的环境变量
        echo.
        echo 📝 必需配置的环境变量：
        echo    VITE_GEMINI_API_KEY - Google Gemini API 密钥
        echo.
        echo 📝 可选配置的环境变量：
        echo    VITE_SUPABASE_URL - Supabase 项目 URL
        echo    VITE_SUPABASE_ANON_KEY - Supabase 匿名密钥
        echo    VITE_GITHUB_TOKEN - GitHub 访问令牌
        echo.
        echo ⚠️  请在启动项目前配置 VITE_GEMINI_API_KEY
    ) else (
        echo ❌ 未找到 .env.example 文件
        pause
        exit /b 1
    )
) else (
    echo ✅ .env 文件已存在
)

REM 检查 Gemini API Key
if exist ".env" (
    findstr /C:"VITE_GEMINI_API_KEY=your_gemini_api_key_here" .env >nul
    if not errorlevel 1 (
        echo ⚠️  请配置 Google Gemini API Key：
        echo    1. 访问 https://makersuite.google.com/app/apikey
        echo    2. 创建 API Key
        echo    3. 在 .env 文件中设置 VITE_GEMINI_API_KEY
    ) else (
        findstr /C:"VITE_GEMINI_API_KEY=" .env >nul
        if not errorlevel 1 (
            echo ✅ Gemini API Key 已配置
        ) else (
            echo ⚠️  请在 .env 文件中配置 VITE_GEMINI_API_KEY
        )
    )
)

echo.
echo 🎉 项目设置完成！
echo.
echo 📚 接下来的步骤：
echo    1. 编辑 .env 文件，配置必要的环境变量
echo    2. 运行 '%PKG_MANAGER% dev' 启动开发服务器
echo    3. 在浏览器中访问 http://localhost:5173
echo.
echo 📖 更多信息请查看：
echo    - README.md - 项目介绍和使用指南
echo    - DEPLOYMENT.md - 部署指南
echo    - FEATURES.md - 功能特性详解
echo.
echo 🆘 需要帮助？
echo    - GitHub Issues: https://github.com/lintsinghua/XCodeReviewer/issues
echo    - 邮箱: tsinghuaiiilove@gmail.com
echo.
echo Happy coding! 🚀
pause