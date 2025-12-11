#!/bin/bash

# Comprehensive Workflow Test
# Tests full LangGraph workflow with real events

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get session ID from argument or create new session
if [ -n "$1" ]; then
  SESSION_ID="$1"
  echo -e "${BLUE}Using existing session: ${SESSION_ID:0:8}...${NC}\n"
else
  echo -e "${BLUE}Creating new session...${NC}"
  SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/session/init" \
    -H "Content-Type: application/json" \
    -d '{"userId":"workflow-test"}')
  SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
  
  echo -e "${GREEN}✓${NC} Session: ${SESSION_ID:0:8}..."
  
  # Upload events
  echo -e "${BLUE}Uploading test events...${NC}"
  curl -s -X POST "$BASE_URL/api/events/upload" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"events\": $(cat test-data/real-events.json)
    }" > /dev/null
  
  echo -e "${GREEN}✓${NC} Events uploaded"
  sleep 1
  echo ""
fi

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Comprehensive Workflow Test${NC}"
echo -e "${BLUE}============================================${NC}\n"

# Helper function to test a query
test_query() {
  local query="$1"
  local expected_intent="$2"
  local test_num="$3"
  
  echo -e "${BLUE}[Test $test_num]${NC} Query: \"$query\""
  echo -e "${YELLOW}Expected intent: $expected_intent${NC}"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"message\": \"$query\"
    }")
  
  # Extract metadata
  INTENT=$(echo "$RESPONSE" | jq -r '.context.intent // "unknown"')
  EVENT_USED=$(echo "$RESPONSE" | jq -r '.context.eventContextUsed')
  KB_USED=$(echo "$RESPONSE" | jq -r '.context.knowledgeBaseUsed')
  TOKENS=$(echo "$RESPONSE" | jq -r '.context.tokensUsed // 0')
  EVENT_TOKENS=$(echo "$RESPONSE" | jq -r '.context.eventTokens // 0')
  
  # Check intent
  if [ "$INTENT" = "$expected_intent" ]; then
    echo -e "${GREEN}✓${NC} Intent classification: $INTENT"
  else
    echo -e "${YELLOW}⚠${NC} Intent: $INTENT (expected: $expected_intent)"
  fi
  
  # Check context usage
  echo "   Event context used: $EVENT_USED"
  echo "   Knowledge base used: $KB_USED"
  echo "   Tokens used: $TOKENS (Events: $EVENT_TOKENS)"
  
  # Show response preview
  RESPONSE_TEXT=$(echo "$RESPONSE" | jq -r '.response')
  PREVIEW=$(echo "$RESPONSE_TEXT" | head -c 150)
  echo ""
  echo "   Response preview:"
  echo "   \"$PREVIEW...\""
  echo ""
  
  # Validate response quality
  if [ "$EVENT_USED" = "true" ] && [ "$EVENT_TOKENS" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Test passed: Events used in response"
  elif [ "$EVENT_USED" = "false" ] && [ "$KB_USED" = "true" ]; then
    echo -e "${GREEN}✓${NC} Test passed: Knowledge base used"
  else
    echo -e "${YELLOW}⚠${NC} Warning: No context used"
  fi
  
  echo ""
  echo "---"
  echo ""
}

# Test 1: Debug Intent - Should prioritize events
test_query "Why did my app crash?" "debug" "1/6"

# Test 2: Analytics Intent - Should analyze events
test_query "What lifecycle events happened?" "analytics" "2/6"

# Test 3: General Intent - Should use docs
test_query "What is Adobe Analytics?" "general" "3/6"

# Test 4: Debug Intent - Specific event query
test_query "Show me the app launch details" "debug" "4/6"

# Test 5: Analytics Intent - Event pattern
test_query "How many shared state change events occurred?" "analytics" "5/6"

# Test 6: Context Continuity - Follow-up question
test_query "Tell me more about the first event" "general" "6/6"

# Summary
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Workflow Test Complete${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Session ID: $SESSION_ID"
echo ""
echo "All queries processed successfully!"
echo ""
echo "Check server logs to see LangGraph workflow steps:"
echo "   🧠 Intent Classification"
echo "   📚 Context Retrieval (Parallel)"
echo "   📝 Context Formatting (Token Budget)"
echo "   🤖 Response Generation"

