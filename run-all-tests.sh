#!/bin/bash

# Master Test Runner
# Runs all comprehensive tests in sequence

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   LangGraph Implementation Test Suite     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Check if server is running
echo -e "${BLUE}[Prerequisite]${NC} Checking if server is running..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Server is running"
  echo ""
else
  echo -e "${RED}✗${NC} Server is not running"
  echo ""
  echo "Please start the server first:"
  echo "  cd /Users/mashraf/Desktop/adobe-codes/assurance-ai-agent"
  echo "  npm start"
  exit 1
fi

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Test 1: Upload Endpoint
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 1: Upload Endpoint${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

if ./test-upload-comprehensive.sh > /tmp/test-upload.log 2>&1; then
  SESSION_ID=$(grep "Session ID:" /tmp/test-upload.log | awk '{print $3}')
  echo -e "${GREEN}✓ Upload tests PASSED${NC}"
  echo "   Session ID: $SESSION_ID"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ Upload tests FAILED${NC}"
  echo "   Check /tmp/test-upload.log for details"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  SESSION_ID=""
fi
echo ""
sleep 2

# Test 2: Workflow with LangGraph
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 2: LangGraph Workflow${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

if [ -n "$SESSION_ID" ]; then
  if ./test-workflow-comprehensive.sh "$SESSION_ID" > /tmp/test-workflow.log 2>&1; then
    echo -e "${GREEN}✓ Workflow tests PASSED${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ Workflow tests FAILED${NC}"
    echo "   Check /tmp/test-workflow.log for details"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠ Skipped (upload test failed)${NC}"
fi
echo ""
sleep 2

# Test 3: Token Management
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Suite 3: Token Management${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

if ./test-token-management.sh > /tmp/test-tokens.log 2>&1; then
  echo -e "${GREEN}✓ Token management tests PASSED${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ Token management tests FAILED${NC}"
  echo "   Check /tmp/test-tokens.log for details"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi
echo ""

# Final Report
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            Test Results Summary            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo "Total test suites: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
else
  echo -e "Failed: $TESTS_FAILED"
fi
echo ""

# Detailed logs
echo "Detailed logs available at:"
echo "  - Upload: /tmp/test-upload.log"
echo "  - Workflow: /tmp/test-workflow.log"
echo "  - Tokens: /tmp/test-tokens.log"
echo ""

# Final status
if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✓ ALL TESTS PASSED                      ║${NC}"
  echo -e "${GREEN}║   LangGraph implementation is ready! 🚀    ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║   ✗ SOME TESTS FAILED                     ║${NC}"
  echo -e "${RED}║   Please review the logs above             ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════╝${NC}"
  exit 1
fi

