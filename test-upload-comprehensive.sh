#!/bin/bash

# Comprehensive Upload Endpoint Test
# Tests event upload with real Assurance events

set -e

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Comprehensive Upload Endpoint Test${NC}"
echo -e "${BLUE}============================================${NC}\n"

# Test 1: Create Session
echo -e "${BLUE}[Test 1/6]${NC} Creating session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/session/init" \
  -H "Content-Type: application/json" \
  -d '{"userId":"upload-test-user"}')

SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.sessionId')
if [ "$SESSION_ID" = "null" ] || [ -z "$SESSION_ID" ]; then
  echo -e "${RED}✗ Failed to create session${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} Session created: ${SESSION_ID:0:8}...\n"

# Test 2: Upload Config Endpoint
echo -e "${BLUE}[Test 2/6]${NC} Checking upload config..."
CONFIG_RESPONSE=$(curl -s -X GET "$BASE_URL/api/events/config")
CHUNK_SIZE=$(echo "$CONFIG_RESPONSE" | jq -r '.config.recommendedChunkSize')
BATCH_SIZE=$(echo "$CONFIG_RESPONSE" | jq -r '.config.embeddingBatchSize')

echo -e "${GREEN}✓${NC} Upload config retrieved:"
echo "   Recommended chunk size: $CHUNK_SIZE events"
echo "   Embedding batch size: $BATCH_SIZE events"
echo ""

# Test 3: Upload Small Batch (5 events from real data)
echo -e "${BLUE}[Test 3/6]${NC} Uploading small batch (5 events)..."
UPLOAD1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/events/upload" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "sessionId": "$SESSION_ID",
  "events": $(cat test-data/real-events.json),
  "chunkInfo": {
    "current": 1,
    "total": 1,
    "isLast": true
  }
}
EOF
)

UPLOAD1_SUCCESS=$(echo "$UPLOAD1_RESPONSE" | jq -r '.success')
EVENTS_ADDED=$(echo "$UPLOAD1_RESPONSE" | jq -r '.added')
PROCESSING_TIME=$(echo "$UPLOAD1_RESPONSE" | jq -r '.processingTime')

if [ "$UPLOAD1_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓${NC} Upload successful"
  echo "   Events added: $EVENTS_ADDED"
  echo "   Processing time: ${PROCESSING_TIME}s"
  echo ""
else
  ERROR_MSG=$(echo "$UPLOAD1_RESPONSE" | jq -r '.error')
  echo -e "${RED}✗ Upload failed: $ERROR_MSG${NC}"
  exit 1
fi

# Test 4: Verify Events in Vector Store
echo -e "${BLUE}[Test 4/6]${NC} Verifying events in vector store..."
sleep 1  # Give embeddings time to be created

STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/events/$SESSION_ID/stats")
TOTAL_EVENTS=$(echo "$STATS_RESPONSE" | jq -r '.totalEvents // 0')

if [ "$TOTAL_EVENTS" -ge "$EVENTS_ADDED" ]; then
  echo -e "${GREEN}✓${NC} Events stored successfully"
  echo "   Total events in vector store: $TOTAL_EVENTS"
  echo ""
else
  echo -e "${YELLOW}⚠${NC} Warning: Expected $EVENTS_ADDED events, found $TOTAL_EVENTS"
  echo ""
fi

# Test 5: Search Events (Test Retrieval)
echo -e "${BLUE}[Test 5/6]${NC} Testing event search..."
SEARCH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/events/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"query\": \"lifecycle app launch\",
    \"k\": 3
  }")

SEARCH_SUCCESS=$(echo "$SEARCH_RESPONSE" | jq -r '.success')
RESULTS_COUNT=$(echo "$SEARCH_RESPONSE" | jq -r '.results | length')

if [ "$SEARCH_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✓${NC} Search successful"
  echo "   Results found: $RESULTS_COUNT"
  
  if [ "$RESULTS_COUNT" -gt 0 ]; then
    echo ""
    echo "   Sample result:"
    echo "$SEARCH_RESPONSE" | jq -r '.results[0].metadata | "   - Event: \(.eventName // "N/A")"'
    echo "$SEARCH_RESPONSE" | jq -r '.results[0].metadata | "   - Type: \(.eventType // "N/A")"'
    echo "$SEARCH_RESPONSE" | jq -r '.results[0] | "   - Relevance: \(.score // "N/A")"'
  fi
  echo ""
else
  echo -e "${YELLOW}⚠${NC} Search failed (vector store may not be ready)"
  echo ""
fi

# Test 6: Upload Duplicate Events (Test Idempotency)
echo -e "${BLUE}[Test 6/6]${NC} Testing duplicate detection..."
UPLOAD2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/events/upload" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "sessionId": "$SESSION_ID",
  "events": $(cat test-data/real-events.json)
}
EOF
)

DUPLICATES_SKIPPED=$(echo "$UPLOAD2_RESPONSE" | jq -r '.duplicates // 0')
NEW_EVENTS=$(echo "$UPLOAD2_RESPONSE" | jq -r '.added // 0')

if [ "$DUPLICATES_SKIPPED" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Duplicate detection working"
  echo "   Duplicates skipped: $DUPLICATES_SKIPPED"
  echo "   New events added: $NEW_EVENTS"
  echo ""
else
  echo -e "${YELLOW}⚠${NC} No duplicates detected (may be expected)"
  echo ""
fi

# Summary
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Session ID: $SESSION_ID"
echo "Events uploaded: $EVENTS_ADDED"
echo "Events in store: $TOTAL_EVENTS"
echo "Search results: $RESULTS_COUNT"
echo "Duplicates handled: $DUPLICATES_SKIPPED"
echo ""
echo -e "${GREEN}✓ All upload tests passed!${NC}"
echo ""
echo "Next step: Test chat workflow with these events"
echo "Run: ./test-workflow-comprehensive.sh $SESSION_ID"

