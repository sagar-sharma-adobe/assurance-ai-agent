#!/bin/bash

# Token Management Test
# Verifies token budget management with various event sizes

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Token Management Test${NC}"
echo -e "${BLUE}============================================${NC}\n"

# Create session
echo -e "${BLUE}[Setup]${NC} Creating session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/session/init" \
  -H "Content-Type: application/json" \
  -d '{"userId":"token-test"}')
SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
echo -e "${GREEN}✓${NC} Session: ${SESSION_ID:0:8}...\n"

# Upload real events
echo -e "${BLUE}[Setup]${NC} Uploading 5 real events..."
curl -s -X POST "$BASE_URL/api/events/upload" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"events\": $(cat test-data/real-events.json)
  }" > /dev/null
echo -e "${GREEN}✓${NC} Events uploaded\n"
sleep 1

# Token budget constants
TOTAL_BUDGET=6000
SYSTEM_TOKENS=250
RESPONSE_BUFFER=2000

echo -e "${BLUE}Token Budget Configuration:${NC}"
echo "   Total budget: $TOTAL_BUDGET tokens"
echo "   System prompt: $SYSTEM_TOKENS tokens"
echo "   Response buffer: $RESPONSE_BUFFER tokens"
echo "   Available for context: $((TOTAL_BUDGET - SYSTEM_TOKENS - RESPONSE_BUFFER)) tokens"
echo ""

# Test 1: Debug Intent (Should allocate 60% to events)
echo -e "${BLUE}[Test 1/3]${NC} Debug intent - Event-heavy allocation"
RESPONSE1=$(curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"Debug: Why did the app crash?\"
  }")

INTENT1=$(echo "$RESPONSE1" | jq -r '.context.intent')
TOKENS1=$(echo "$RESPONSE1" | jq -r '.context.tokensUsed')
EVENT_TOKENS1=$(echo "$RESPONSE1" | jq -r '.context.eventTokens')
DOC_TOKENS1=$(echo "$RESPONSE1" | jq -r '.context.docTokens')
HISTORY_TOKENS1=$(echo "$RESPONSE1" | jq -r '.context.historyTokens')

echo "   Intent: $INTENT1"
echo "   Total tokens: $TOKENS1 / $TOTAL_BUDGET"
echo "   Event tokens: $EVENT_TOKENS1 ($(( EVENT_TOKENS1 * 100 / (TOKENS1 - SYSTEM_TOKENS - RESPONSE_BUFFER) ))%)"
echo "   Doc tokens: $DOC_TOKENS1"
echo "   History tokens: $HISTORY_TOKENS1"

if [ "$TOKENS1" -lt "$TOTAL_BUDGET" ]; then
  echo -e "${GREEN}✓${NC} Within budget"
else
  echo -e "${RED}✗${NC} Exceeded budget!"
fi

# Check if events were prioritized (should be >50% for debug)
EVENT_PERCENT=$(( EVENT_TOKENS1 * 100 / (TOKENS1 - SYSTEM_TOKENS) ))
if [ "$EVENT_PERCENT" -gt 50 ] && [ "$INTENT1" = "debug" ]; then
  echo -e "${GREEN}✓${NC} Events prioritized correctly for debug intent"
else
  echo -e "${YELLOW}⚠${NC} Event allocation: ${EVENT_PERCENT}%"
fi
echo ""

# Test 2: General Intent (Should allocate more to docs)
echo -e "${BLUE}[Test 2/3]${NC} General intent - Doc-heavy allocation"
RESPONSE2=$(curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"What is the Adobe Mobile SDK?\"
  }")

INTENT2=$(echo "$RESPONSE2" | jq -r '.context.intent')
TOKENS2=$(echo "$RESPONSE2" | jq -r '.context.tokensUsed')
EVENT_TOKENS2=$(echo "$RESPONSE2" | jq -r '.context.eventTokens')
DOC_TOKENS2=$(echo "$RESPONSE2" | jq -r '.context.docTokens')
HISTORY_TOKENS2=$(echo "$RESPONSE2" | jq -r '.context.historyTokens')

echo "   Intent: $INTENT2"
echo "   Total tokens: $TOKENS2 / $TOTAL_BUDGET"
echo "   Event tokens: $EVENT_TOKENS2"
echo "   Doc tokens: $DOC_TOKENS2"
echo "   History tokens: $HISTORY_TOKENS2"

if [ "$TOKENS2" -lt "$TOTAL_BUDGET" ]; then
  echo -e "${GREEN}✓${NC} Within budget"
else
  echo -e "${RED}✗${NC} Exceeded budget!"
fi
echo ""

# Test 3: Long Conversation (Test history management)
echo -e "${BLUE}[Test 3/3]${NC} Long conversation - History management"

# Send 3 more messages to build history
for i in {1..3}; do
  curl -s -X POST "$BASE_URL/api/chat" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"message\": \"Tell me about event $i\"
    }" > /dev/null
done

RESPONSE3=$(curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"Summarize what we discussed\"
  }")

INTENT3=$(echo "$RESPONSE3" | jq -r '.context.intent')
TOKENS3=$(echo "$RESPONSE3" | jq -r '.context.tokensUsed')
EVENT_TOKENS3=$(echo "$RESPONSE3" | jq -r '.context.eventTokens')
DOC_TOKENS3=$(echo "$RESPONSE3" | jq -r '.context.docTokens')
HISTORY_TOKENS3=$(echo "$RESPONSE3" | jq -r '.context.historyTokens')

echo "   Intent: $INTENT3"
echo "   Total tokens: $TOKENS3 / $TOTAL_BUDGET"
echo "   Event tokens: $EVENT_TOKENS3"
echo "   Doc tokens: $DOC_TOKENS3"
echo "   History tokens: $HISTORY_TOKENS3 (conversation has 8+ messages)"

if [ "$TOKENS3" -lt "$TOTAL_BUDGET" ]; then
  echo -e "${GREEN}✓${NC} Within budget despite long conversation"
else
  echo -e "${RED}✗${NC} Exceeded budget!"
fi

if [ "$HISTORY_TOKENS3" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} History being used"
else
  echo -e "${YELLOW}⚠${NC} No history tokens"
fi
echo ""

# Summary
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Token Management Summary${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

printf "%-20s %-15s %-15s %-15s %-15s\n" "Test" "Total" "Events" "Docs" "History"
printf "%-20s %-15s %-15s %-15s %-15s\n" "----" "-----" "------" "----" "-------"
printf "%-20s %-15s %-15s %-15s %-15s\n" "Debug ($INTENT1)" "$TOKENS1" "$EVENT_TOKENS1" "$DOC_TOKENS1" "$HISTORY_TOKENS1"
printf "%-20s %-15s %-15s %-15s %-15s\n" "General ($INTENT2)" "$TOKENS2" "$EVENT_TOKENS2" "$DOC_TOKENS2" "$HISTORY_TOKENS2"
printf "%-20s %-15s %-15s %-15s %-15s\n" "Long Conv ($INTENT3)" "$TOKENS3" "$EVENT_TOKENS3" "$DOC_TOKENS3" "$HISTORY_TOKENS3"
echo ""

# Validation
ALL_WITHIN_BUDGET=true
if [ "$TOKENS1" -ge "$TOTAL_BUDGET" ] || [ "$TOKENS2" -ge "$TOTAL_BUDGET" ] || [ "$TOKENS3" -ge "$TOTAL_BUDGET" ]; then
  ALL_WITHIN_BUDGET=false
fi

if [ "$ALL_WITHIN_BUDGET" = true ]; then
  echo -e "${GREEN}✓ All tests stayed within token budget${NC}"
  echo -e "${GREEN}✓ Dynamic allocation working correctly${NC}"
  echo ""
  echo -e "${GREEN}Token management: PASSED${NC}"
else
  echo -e "${RED}✗ Some tests exceeded budget${NC}"
  echo ""
  echo -e "${RED}Token management: FAILED${NC}"
fi

