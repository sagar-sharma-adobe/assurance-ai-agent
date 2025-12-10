# 📡 API Reference

Complete reference for all Adobe Assurance AI Agent API endpoints.

**Base URL:** `http://localhost:3001`

---

## Table of Contents

- [Health & System](#health--system)
- [Session Management](#session-management)
- [Chat (RAG-Enabled)](#chat-rag-enabled)
- [Events Management](#events-management)
- [Knowledge Base](#knowledge-base)

---

## Health & System

### GET /api/health

Check server health and Ollama connectivity.

**Request:**
```bash
curl http://localhost:3001/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "ollama": "connected",
  "model": "llama3.1:8b",
  "activeSessions": 2,
  "timestamp": "2025-12-10T10:00:00.000Z"
}
```

**Status Codes:**
- `200` - Server healthy
- `503` - Ollama disconnected

---

## Session Management

### POST /api/session/init

Initialize a new debugging session.

**Request:**
```bash
curl -X POST http://localhost:3001/api/session/init \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "developer123",
    "metadata": {
      "appVersion": "1.0.0",
      "platform": "iOS"
    }
  }'
```

**Body Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | string | No | User identifier (default: "anonymous") |
| `metadata` | object | No | Additional session metadata |

**Response:**
```json
{
  "success": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Session initialized successfully",
  "session": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2025-12-10T10:00:00.000Z",
    "userId": "developer123"
  }
}
```

---

### GET /api/session/:sessionId/history

Get conversation history for a session.

**Request:**
```bash
curl http://localhost:3001/api/session/abc123/history
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "history": [
    {
      "role": "user",
      "content": "What is Adobe Assurance?",
      "timestamp": "2025-12-10T10:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Adobe Assurance is a product from Adobe Experience Cloud...",
      "timestamp": "2025-12-10T10:00:05.000Z"
    }
  ],
  "totalMessages": 2
}
```

**Status Codes:**
- `200` - Success
- `404` - Session not found

---

### GET /api/sessions

List all active sessions.

**Request:**
```bash
curl http://localhost:3001/api/sessions
```

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "abc123",
      "userId": "developer123",
      "createdAt": "2025-12-10T10:00:00.000Z",
      "messageCount": 4,
      "metadata": {}
    }
  ],
  "total": 1
}
```

---

## Chat (RAG-Enabled)

### POST /api/chat

Send a message and get AI response (with RAG).

**Request:**
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc123",
    "message": "How do I debug tracking issues in Adobe Assurance?"
  }'
```

**Body Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID from /api/session/init |
| `message` | string | Yes | User's question or message |

**Response:**
```json
{
  "success": true,
  "response": "To debug tracking issues in Adobe Assurance, you can...",
  "sessionId": "abc123",
  "timestamp": "2025-12-10T10:00:05.000Z",
  "context": {
    "knowledgeBaseUsed": true
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `response` | string | AI-generated answer |
| `context.knowledgeBaseUsed` | boolean | Whether KB was used for answer |

**Status Codes:**
- `200` - Success
- `400` - Missing sessionId or message
- `404` - Session not found
- `500` - AI processing error

---

## Events Management

### GET /api/events/config

Get configuration for chunked uploads.

**Request:**
```bash
curl http://localhost:3001/api/events/config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "recommendedChunkSize": 100,
    "maxEventsPerRequest": 200,
    "embeddingBatchSize": 10
  },
  "usage": {
    "description": "For optimal performance, split large event batches into chunks",
    "example": "For 1500 events, split into 15 chunks of 100 events each"
  }
}
```

---

### POST /api/events/upload

Upload Assurance events (supports chunking).

**Request:**
```bash
curl -X POST http://localhost:3001/api/events/upload \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc123",
    "events": [
      {
        "type": "Analytics",
        "name": "trackAction",
        "timestamp": "2025-12-10T10:00:00Z",
        "payload": { "action": "buttonClick" }
      }
    ],
    "chunkInfo": {
      "current": 1,
      "total": 5,
      "isLast": false
    }
  }'
```

**Body Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID |
| `events` | array | Yes | Array of event objects |
| `chunkInfo` | object | No | Chunk metadata for progress tracking |
| `chunkInfo.current` | number | No | Current chunk number (1-indexed) |
| `chunkInfo.total` | number | No | Total number of chunks |
| `chunkInfo.isLast` | boolean | No | Is this the last chunk? |

**Response:**
```json
{
  "success": true,
  "message": "Chunk 1/5 processed successfully",
  "processed": 100,
  "totalEventsInSession": 100,
  "processingTime": 850,
  "chunkInfo": {
    "current": 1,
    "total": 5,
    "isLast": false
  },
  "performance": {
    "eventsPerSecond": 117,
    "avgTimePerEvent": 8
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing or invalid parameters
- `404` - Session not found
- `413` - Too many events (> 200 per request)
- `500` - Processing error

**For large batches:** See [Client Guide](./CLIENT_GUIDE.md) for chunked upload implementation.

---

### GET /api/events/:sessionId

Get all events for a session.

**Request:**
```bash
curl http://localhost:3001/api/events/abc123
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "events": [
    {
      "type": "Analytics",
      "name": "trackAction",
      "timestamp": "2025-12-10T10:00:00Z",
      "payload": { "action": "buttonClick" }
    }
  ],
  "totalEvents": 250
}
```

---

### POST /api/events/search

Semantic search across session events.

**Request:**
```bash
curl -X POST http://localhost:3001/api/events/search \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "abc123",
    "query": "analytics tracking issues",
    "limit": 5
  }'
```

**Body Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Session ID |
| `query` | string | Yes | Search query |
| `limit` | number | No | Number of results (default: 5) |

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "query": "analytics tracking issues",
  "results": [
    {
      "content": "Event Type: Analytics\nEvent Name: trackAction...",
      "metadata": {
        "eventType": "Analytics",
        "eventName": "trackAction",
        "timestamp": "2025-12-10T10:00:00Z"
      }
    }
  ],
  "totalResults": 5
}
```

---

### GET /api/events/:sessionId/stats

Get event statistics for a session.

**Request:**
```bash
curl http://localhost:3001/api/events/abc123/stats
```

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "stats": {
    "totalEvents": 250,
    "message": "Event statistics - to be implemented by event analysis team"
  }
}
```

**Note:** This endpoint is a placeholder for team to implement detailed analytics.

---

## Knowledge Base

### GET /api/knowledge/documents

List all loaded documents.

**Request:**
```bash
curl http://localhost:3001/api/knowledge/documents
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc-uuid-123",
      "type": "url",
      "title": "Adobe Assurance Overview",
      "url": "https://developer.adobe.com/...",
      "loadedAt": "2025-12-10T10:00:00.000Z",
      "chunkCount": 7,
      "contentLength": 5408,
      "status": "loaded"
    }
  ],
  "total": 1
}
```

---

### POST /api/knowledge/load-url

Load a document from a URL.

**Request:**
```bash
curl -X POST http://localhost:3001/api/knowledge/load-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://developer.adobe.com/client-sdks/documentation/platform-assurance/",
    "title": "Adobe Assurance Overview",
    "chunkSize": 1000,
    "chunkOverlap": 200
  }'
```

**Body Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | URL to load |
| `title` | string | No | Custom title (overrides extracted) |
| `chunkSize` | number | No | Chunk size (default: 1000) |
| `chunkOverlap` | number | No | Overlap between chunks (default: 200) |

**Response:**
```json
{
  "success": true,
  "message": "Document loaded successfully",
  "document": {
    "id": "doc-uuid-123",
    "title": "Adobe Assurance Overview",
    "source": "https://developer.adobe.com/...",
    "chunkCount": 7,
    "contentLength": 5408
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing or invalid URL
- `500` - Loading error (network, parsing, etc.)

---

### POST /api/knowledge/upload

Upload a document file (PDF, TXT, MD).

**Request:**
```bash
curl -X POST http://localhost:3001/api/knowledge/upload \
  -F "document=@/path/to/assurance-guide.pdf"
```

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document` | file | Yes | PDF, TXT, or MD file (max 10MB) |

**Response:**
```json
{
  "success": true,
  "message": "File uploaded and loaded successfully",
  "document": {
    "id": "doc-uuid-456",
    "title": "assurance-guide",
    "fileName": "assurance-guide.pdf",
    "type": "pdf",
    "chunkCount": 12,
    "contentLength": 15678,
    "fileSize": 245678
  }
}
```

**Supported File Types:**
- `.pdf` - PDF documents
- `.txt` - Plain text
- `.md` - Markdown

**File Size Limit:** 10MB

---

### POST /api/knowledge/load-batch

Batch load multiple URLs.

**Request:**
```bash
curl -X POST http://localhost:3001/api/knowledge/load-batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://developer.adobe.com/client-sdks/documentation/platform-assurance/",
      "https://developer.adobe.com/client-sdks/documentation/platform-assurance/api-reference/"
    ],
    "chunkSize": 1000,
    "chunkOverlap": 200
  }'
```

**Body Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `urls` | array | Yes | Array of URLs to load |
| `chunkSize` | number | No | Chunk size (default: 1000) |
| `chunkOverlap` | number | No | Overlap between chunks (default: 200) |

**Response:**
```json
{
  "success": true,
  "message": "Loaded 2/2 documents",
  "results": {
    "successCount": 2,
    "errorCount": 0,
    "documents": [
      {
        "id": "doc-uuid-789",
        "title": "Adobe Assurance Overview",
        "source": "https://...",
        "chunkCount": 7
      },
      {
        "id": "doc-uuid-012",
        "title": "API Reference",
        "source": "https://...",
        "chunkCount": 15
      }
    ],
    "errors": []
  }
}
```

---

### POST /api/knowledge/search

Search the knowledge base.

**Request:**
```bash
curl -X POST http://localhost:3001/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is Adobe Assurance?",
    "limit": 3
  }'
```

**Body Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `limit` | number | No | Number of results (default: 5) |

**Response:**
```json
{
  "success": true,
  "query": "What is Adobe Assurance?",
  "results": [
    {
      "content": "Adobe Experience Platform Assurance is a product from Adobe Experience Cloud to help you inspect, proof, simulate, and validate how you collect data or serve experiences in your mobile app.",
      "metadata": {
        "source": "https://developer.adobe.com/...",
        "type": "url",
        "title": "Adobe Assurance Overview",
        "chunkIndex": 0,
        "chunkCount": 7
      }
    }
  ],
  "totalResults": 3
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Error Codes:**
- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found (session, document, etc.)
- `413` - Payload Too Large
- `500` - Internal Server Error
- `503` - Service Unavailable (Ollama down)

---

## Rate Limiting

**Current:** No rate limiting (PoC)

**Production:** Implement rate limiting per user/IP:
- Chat: 10 requests/minute
- Events: 100 chunks/minute
- Knowledge: 10 uploads/hour

---

## Authentication

**Current:** No authentication (PoC)

**Production:** Add API key or OAuth:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3001/api/chat
```

---

## Related Documentation

- **[Architecture](./ARCHITECTURE.md)** - System design & components
- **[Development Guide](./DEVELOPMENT.md)** - How to develop & extend
- **[Client Guide](./CLIENT_GUIDE.md)** - Client-side implementation
- **[Deployment Guide](./DEPLOYMENT.md)** - Deployment & troubleshooting

---

**Need help?** Check the troubleshooting guide or open an issue!

