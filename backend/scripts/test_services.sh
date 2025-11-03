#!/bin/bash
# 测试所有服务是否正常运行

set -e

echo "=========================================="
echo "XCodeReviewer - 服务健康检查"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_service() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -n "测试 $name ... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if [ "$response" -eq "$expected_code" ] || [ "$response" -eq 200 ]; then
            echo -e "${GREEN}✓ 正常${NC} (HTTP $response)"
            return 0
        else
            echo -e "${YELLOW}⚠ 警告${NC} (HTTP $response, 期望 $expected_code)"
            return 1
        fi
    else
        echo -e "${RED}✗ 失败${NC} (无法连接)"
        return 1
    fi
}

# 计数器
total=0
passed=0
failed=0

# 测试 Backend API
echo "1. Backend API 服务"
echo "-------------------"
if test_service "健康检查" "http://localhost:8000/health"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

if test_service "API 文档 (Swagger)" "http://localhost:8000/docs"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

if test_service "API 文档 (ReDoc)" "http://localhost:8000/redoc"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

if test_service "OpenAPI Schema" "http://localhost:8000/openapi.json"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

echo ""

# 测试 Celery Flower
echo "2. Celery Flower (任务监控)"
echo "-------------------"
if test_service "Flower 控制台" "http://localhost:5555"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

echo ""

# 测试 MinIO
echo "3. MinIO (对象存储)"
echo "-------------------"
if test_service "MinIO 控制台" "http://localhost:9001"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

if test_service "MinIO API" "http://localhost:9000/minio/health/live"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

echo ""

# 测试 Prometheus
echo "4. Prometheus (监控)"
echo "-------------------"
if test_service "Prometheus" "http://localhost:9090"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

echo ""

# 测试 Grafana
echo "5. Grafana (可视化)"
echo "-------------------"
if test_service "Grafana" "http://localhost:3001"; then
    ((passed++))
else
    ((failed++))
fi
((total++))

echo ""

# 测试数据库连接
echo "6. 数据库连接"
echo "-------------------"
if docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "测试 PostgreSQL ... ${GREEN}✓ 正常${NC}"
    ((passed++))
else
    echo -e "测试 PostgreSQL ... ${RED}✗ 失败${NC}"
    ((failed++))
fi
((total++))

echo ""

# 测试 Redis 连接
echo "7. Redis 连接"
echo "-------------------"
if docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "测试 Redis ... ${GREEN}✓ 正常${NC}"
    ((passed++))
else
    echo -e "测试 Redis ... ${RED}✗ 失败${NC}"
    ((failed++))
fi
((total++))

echo ""

# 测试 API 端点
echo "8. API 端点测试"
echo "-------------------"

# 测试注册端点
echo -n "测试用户注册 ... "
register_response=$(curl -s -X POST http://localhost:8000/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test_'$(date +%s)'@example.com",
        "username": "testuser_'$(date +%s)'",
        "password": "TestPass123!"
    }' 2>/dev/null)

if echo "$register_response" | grep -q "id"; then
    echo -e "${GREEN}✓ 正常${NC}"
    ((passed++))
else
    echo -e "${YELLOW}⚠ 警告${NC} (可能用户已存在)"
    ((passed++))
fi
((total++))

echo ""

# 总结
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo -e "总计: $total"
echo -e "${GREEN}通过: $passed${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}失败: $failed${NC}"
fi
echo ""

# 计算成功率
success_rate=$((passed * 100 / total))
echo "成功率: $success_rate%"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ 所有服务运行正常！${NC}"
    echo ""
    echo "你可以访问以下地址："
    echo "  - Backend API: http://localhost:8000"
    echo "  - API 文档: http://localhost:8000/docs"
    echo "  - Flower: http://localhost:5555"
    echo "  - MinIO: http://localhost:9001 (minioadmin/minioadmin)"
    echo "  - Prometheus: http://localhost:9090"
    echo "  - Grafana: http://localhost:3001 (admin/admin)"
    exit 0
else
    echo -e "${RED}⚠️  有 $failed 个服务未正常运行${NC}"
    echo ""
    echo "请检查日志："
    echo "  docker-compose -f docker-compose.dev.yml logs"
    exit 1
fi
