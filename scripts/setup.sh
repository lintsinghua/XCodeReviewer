#!/bin/bash

# XCodeReviewer 项目设置脚本
# 用于快速设置开发环境

set -e

echo "🚀 XCodeReviewer 项目设置开始..."

# 检查 Node.js 版本
echo "📋 检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 版本过低，需要 18+，当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js 版本检查通过: $(node -v)"

# 检查包管理器
echo "📦 检查包管理器..."
if command -v pnpm &> /dev/null; then
    PKG_MANAGER="pnpm"
    echo "✅ 使用 pnpm"
elif command -v yarn &> /dev/null; then
    PKG_MANAGER="yarn"
    echo "✅ 使用 yarn"
elif command -v npm &> /dev/null; then
    PKG_MANAGER="npm"
    echo "✅ 使用 npm"
else
    echo "❌ 未找到包管理器，请安装 npm、yarn 或 pnpm"
    exit 1
fi

# 安装依赖
echo "📥 安装项目依赖..."
$PKG_MANAGER install

# 检查环境变量文件
echo "🔧 检查环境变量配置..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请编辑配置必要的环境变量"
        echo ""
        echo "📝 必需配置的环境变量："
        echo "   VITE_GEMINI_API_KEY - Google Gemini API 密钥"
        echo ""
        echo "📝 可选配置的环境变量："
        echo "   VITE_SUPABASE_URL - Supabase 项目 URL"
        echo "   VITE_SUPABASE_ANON_KEY - Supabase 匿名密钥"
        echo "   VITE_GITHUB_TOKEN - GitHub 访问令牌"
        echo ""
        echo "⚠️  请在启动项目前配置 VITE_GEMINI_API_KEY"
    else
        echo "❌ 未找到 .env.example 文件"
        exit 1
    fi
else
    echo "✅ .env 文件已存在"
fi

# 检查 Gemini API Key
if [ -f ".env" ]; then
    if grep -q "VITE_GEMINI_API_KEY=your_gemini_api_key_here" .env || ! grep -q "VITE_GEMINI_API_KEY=" .env; then
        echo "⚠️  请配置 Google Gemini API Key："
        echo "   1. 访问 https://makersuite.google.com/app/apikey"
        echo "   2. 创建 API Key"
        echo "   3. 在 .env 文件中设置 VITE_GEMINI_API_KEY"
    else
        echo "✅ Gemini API Key 已配置"
    fi
fi

# 构建检查
echo "🔨 检查构建配置..."
if $PKG_MANAGER run build --dry-run &> /dev/null; then
    echo "✅ 构建配置正常"
else
    echo "⚠️  构建配置可能有问题，请检查"
fi

echo ""
echo "🎉 项目设置完成！"
echo ""
echo "📚 接下来的步骤："
echo "   1. 编辑 .env 文件，配置必要的环境变量"
echo "   2. 运行 '$PKG_MANAGER dev' 启动开发服务器"
echo "   3. 在浏览器中访问 http://localhost:5173"
echo ""
echo "📖 更多信息请查看："
echo "   - README.md - 项目介绍和使用指南"
echo "   - DEPLOYMENT.md - 部署指南"
echo "   - FEATURES.md - 功能特性详解"
echo ""
echo "🆘 需要帮助？"
echo "   - GitHub Issues: https://github.com/lintsinghua/XCodeReviewer/issues"
echo "   - 邮箱: tsinghuaiiilove@gmail.com"
echo ""
echo "Happy coding! 🚀"