#!/bin/bash

# Test LangGraph Workflow
# Simple test to see the workflow in action

BASE_URL="http://localhost:3001"

echo "Testing LangGraph Workflow..."
echo "================================"
echo ""

# Create session
echo "[1/3] Creating session..."
SESSION_ID=$(curl -s -X POST "$BASE_URL/api/session/init" \
  -H "Content-Type: application/json" \
  -d '{"userId":"langgraph-test"}' | jq -r '.sessionId')

echo "✓ Session: $SESSION_ID"
echo ""

# Upload events
echo "[2/3] Uploading events..."
curl -s -X POST "$BASE_URL/api/events/upload" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"events\": [
      {
        \"id\": \"e1\",
        \"type\": \"Analytics\",
        \"name\": \"trackAction\",
        \"timestamp\": \"2025-12-11T07:00:00Z\",
        \"payload\": {\"action\": \"AppCrash\", \"reason\": \"Memory overflow\"}
      }
    ]
  }" > /dev/null

echo "✓ Events uploaded"
sleep 1
echo ""

# Test chat with debugging query
echo "[3/3] Testing chat (watch server logs)..."
echo ""

RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"message\": \"Why did my app crash?\"
  }")

echo "Response:"
echo "$RESPONSE" | jq '.response' | sed 's/^"//;s/"$//' | fold -w 80 -s
echo ""

echo "Metadata:"
echo "$RESPONSE" | jq '.context'

