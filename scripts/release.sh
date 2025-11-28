#!/bin/bash

# 版本发布辅助脚本
# 用法: ./scripts/release.sh [major|minor|patch|version]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印彩色消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "当前目录不是 Git 仓库"
    exit 1
fi

# 检查工作区是否干净
if [ -n "$(git status --porcelain)" ]; then
    print_warn "工作区有未提交的更改"
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 获取当前版本号（从前端项目）
if [ -f "frontend/package.json" ]; then
    CURRENT_VERSION=$(node -p "require('./frontend/package.json').version")
else
    print_error "找不到 frontend/package.json 文件"
    exit 1
fi
print_info "当前版本: v$CURRENT_VERSION"

# 解析版本号
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# 确定新版本号
if [ -z "$1" ]; then
    print_error "请指定版本类型: major, minor, patch 或具体版本号"
    echo "用法: ./scripts/release.sh [major|minor|patch|version]"
    echo ""
    echo "示例:"
    echo "  ./scripts/release.sh patch    # 0.0.1 -> 0.0.2"
    echo "  ./scripts/release.sh minor    # 0.0.1 -> 0.1.0"
    echo "  ./scripts/release.sh major    # 0.0.1 -> 1.0.0"
    echo "  ./scripts/release.sh 1.2.3    # 直接指定版本号"
    exit 1
fi

case "$1" in
    major)
        NEW_MAJOR=$((MAJOR + 1))
        NEW_VERSION="${NEW_MAJOR}.0.0"
        ;;
    minor)
        NEW_MINOR=$((MINOR + 1))
        NEW_VERSION="${MAJOR}.${NEW_MINOR}.0"
        ;;
    patch)
        NEW_PATCH=$((PATCH + 1))
        NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
        ;;
    *)
        # 假设是具体版本号
        NEW_VERSION="$1"
        # 去掉可能的 v 前缀
        NEW_VERSION="${NEW_VERSION#v}"
        ;;
esac

print_info "新版本: v$NEW_VERSION"

# 确认发布
read -p "确认发布版本 v$NEW_VERSION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "已取消"
    exit 0
fi

# 更新前端 package.json
print_info "更新前端 package.json..."
cd frontend
npm version "$NEW_VERSION" --no-git-tag-version
cd ..

# 提交更改
print_info "提交版本更改..."
git add frontend/package.json frontend/package-lock.json 2>/dev/null || true
git add frontend/pnpm-lock.yaml 2>/dev/null || true
git add README.md 2>/dev/null || true
git commit -m "chore: bump version to v$NEW_VERSION" || true

# 创建 tag
print_info "创建 Git tag..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

# 推送
print_info "推送到远程仓库..."
echo ""
print_warn "即将执行以下操作:"
echo "  1. git push origin main"
echo "  2. git push origin v$NEW_VERSION"
echo ""
read -p "确认推送? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main || print_warn "推送 main 分支失败（可能没有更改）"
    git push origin "v$NEW_VERSION"
    
    echo ""
    print_info "✅ 版本 v$NEW_VERSION 发布成功！"
    echo ""
    print_info "GitHub Actions 将自动开始构建和发布流程"
    print_info "查看进度: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
else
    print_warn "已创建本地 tag，但未推送到远程"
    print_info "如需推送，请手动执行:"
    echo "  git push origin main"
    echo "  git push origin v$NEW_VERSION"
fi


