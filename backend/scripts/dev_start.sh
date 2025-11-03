#!/bin/bash
# 一键启动开发环境

set -e

echo "=========================================="
echo "XCodeReviewer - 开发环境启动脚本"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 进入 backend 目录
cd "$(dirname "$0")/.."

echo -e "${BLUE}步骤 1/5: 检查 Docker${NC}"
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 和 Docker Compose 已安装"
echo ""

echo -e "${BLUE}步骤 2/5: 启动服务${NC}"
echo "正在启动 PostgreSQL, Redis, MinIO, Backend, Celery..."
docker-compose -f docker-compose.dev.yml up -d

echo ""
echo -e "${BLUE}步骤 3/5: 等待服务就绪${NC}"
echo "等待数据库启动..."
sleep 10

# 检查服务状态
echo "检查服务状态..."
docker-compose -f docker-compose.dev.yml ps

echo ""
echo -e "${BLUE}步骤 4/5: 初始化数据库${NC}"

# 检查数据库是否已初始化
if docker-compose -f docker-compose.dev.yml exec -T backend alembic current 2>/dev/null | grep -q "head"; then
    echo "✅ 数据库已初始化"
else
    echo "正在运行数据库迁移..."
    docker-compose -f docker-compose.dev.yml exec -T backend alembic upgrade head
    echo "✅ 数据库迁移完成"
fi

echo ""
echo -e "${BLUE}步骤 5/5: 创建管理员用户${NC}"
read -p "是否创建管理员用户？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose -f docker-compose.dev.yml exec backend python scripts/create_admin.py
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ 开发环境启动完成！${NC}"
echo "=========================================="
echo ""
echo "服务访问地址："
echo "  🌐 Backend API:        http://localhost:8000"
echo "  📚 API 文档 (Swagger): http://localhost:8000/docs"
echo "  📖 API 文档 (ReDoc):   http://localhost:8000/redoc"
echo "  🌸 Flower (任务监控):   http://localhost:5555"
echo "  📦 MinIO (存储):       http://localhost:9001"
echo "  📊 Prometheus:         http://localhost:9090"
echo "  📈 Grafana:            http://localhost:3001"
echo ""
echo "默认账号："
echo "  MinIO:   minioadmin / minioadmin"
echo "  Grafana: admin / admin"
echo ""
echo "常用命令："
echo "  查看日志:   docker-compose -f docker-compose.dev.yml logs -f backend"
echo "  停止服务:   docker-compose -f docker-compose.dev.yml down"
echo "  重启服务:   docker-compose -f docker-compose.dev.yml restart"
echo "  测试服务:   ./scripts/test_services.sh"
echo ""
echo "开始开发吧！ 🚀"
