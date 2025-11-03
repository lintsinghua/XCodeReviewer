#!/bin/bash
# Test Runner Script
# Runs tests with coverage reporting

set -e

echo "🧪 Running XCodeReviewer Test Suite"
echo "===================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo -e "${RED}❌ pytest not found. Installing...${NC}"
    pip install pytest pytest-cov pytest-asyncio pytest-timeout
fi

# Clean previous coverage data
echo -e "${YELLOW}🧹 Cleaning previous coverage data...${NC}"
rm -rf htmlcov .coverage coverage.xml

# Run tests with coverage
echo -e "${YELLOW}🏃 Running tests...${NC}"
pytest tests/ \
    --verbose \
    --cov=. \
    --cov-report=html \
    --cov-report=xml \
    --cov-report=term-missing \
    --cov-branch \
    --tb=short \
    -v

# Check exit code
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit $TEST_EXIT_CODE
fi

# Display coverage summary
echo ""
echo "📊 Coverage Summary"
echo "==================="
coverage report --skip-covered

# Check coverage threshold
COVERAGE=$(coverage report | grep TOTAL | awk '{print $4}' | sed 's/%//')
THRESHOLD=80

echo ""
if (( $(echo "$COVERAGE >= $THRESHOLD" | bc -l) )); then
    echo -e "${GREEN}✅ Coverage: ${COVERAGE}% (threshold: ${THRESHOLD}%)${NC}"
else
    echo -e "${RED}❌ Coverage: ${COVERAGE}% (below threshold: ${THRESHOLD}%)${NC}"
    exit 1
fi

# Generate badge
echo ""
echo "📈 Coverage report generated:"
echo "   - HTML: htmlcov/index.html"
echo "   - XML: coverage.xml"
echo ""
echo -e "${GREEN}✨ Test suite completed successfully!${NC}"
