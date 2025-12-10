# 🏗️ Architecture Documentation

## System Overview

The Adobe Assurance AI Agent is a **RAG-enabled (Retrieval-Augmented Generation)** conversational AI system designed to help developers debug Adobe Assurance sessions.

```
┌────────────────────────────────────────────────────────┐
│              Adobe Assurance AI Agent                  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │            Express.js REST API                    │ │
│  │  • Session Management  • Chat  • Events  • KB    │ │
│  └──────────────┬───────────────────────┬───────────┘ │
│                 │                       │              │
│  ┌──────────────▼─────────┐  ┌─────────▼────────────┐ │
│  │   Session Context      │  │  Knowledge Base      │ │
│  │   • Conversations      │  │  • Document Loader   │ │
│  │   • Event Storage      │  │  • Vector Store      │ │
│  │   • User Sessions      │  │  • RAG Pipeline      │ │
│  └────────────────────────┘  └──────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │                Ollama (Local LLM)                 │ │
│  │  • llama3.1:8b (Chat)                            │ │
│  │  • nomic-embed-text (Embeddings)                 │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

---

## Core Components

### **1. Express.js Server**
- **Port:** 3001 (configurable via `PORT` env var)
- **Framework:** Express.js with ES modules
- **Middleware:** CORS, JSON body parser, error handling

### **2. Session Management**
- **Implementation:** `src/services/sessionManager.js` (Singleton class)
- **Storage:** In-memory Map (sessions lost on restart)
- **Features:**
  - Unique session IDs (UUID v4)
  - Conversation history per session
  - Event vector stores per session
  - User metadata tracking

### **3. LLM Integration (Ollama)**
- **Chat Model:** llama3.1:8b (8 billion parameters)
- **Embedding Model:** nomic-embed-text (768 dimensions)
- **Temperature:** 0.5 (balanced creativity/accuracy)
- **Base URL:** http://localhost:11434 (local)

### **4. Vector Stores**
Two separate vector stores:

#### **a) Knowledge Base Vector Store**
- **Purpose:** Store documentation for RAG
- **Technology:** HNSWLib (in-memory, persistent to disk)
- **Location:** `./vector_store/docstore/`
- **Shared:** Across all sessions

#### **b) Event Vector Stores**
- **Purpose:** Store per-session Assurance events
- **Technology:** HNSWLib (in-memory)
- **Location:** `./vector_store/sessions/{sessionId}/`
- **Isolated:** One per session

---

## Request Flow

### **Chat Request (with RAG)**

```
1. User sends message
   POST /api/chat { sessionId, message }
        ↓
2. Retrieve session & conversation history
   sessionManager.getSession(sessionId)
        ↓
3. [RAG] Search Knowledge Base
   vectorStore.similaritySearch(message, 3)
   → Returns top 3 relevant document chunks
        ↓
4. Build prompt
   - System instructions
   - Retrieved documentation
   - Conversation history  
   - User message
        ↓
5. Call LLM
   llm.invoke(fullPrompt)
   → Returns AI response
        ↓
6. Save to conversation history
   sessionManager.addMessage(sessionId, role, content)
        ↓
7. Return response
   { response, knowledgeBaseUsed: true }
```

### **Event Upload (Chunked)**

```
1. Client splits 1500 events into chunks of 100
        ↓
2. For each chunk:
   POST /api/events/upload 
   { sessionId, events: [100 events], chunkInfo }
        ↓
3. Store raw events
   session.events.push(...events)
        ↓
4. Create embeddings (batched to Ollama)
   embeddings.embedDocuments(eventTexts)
   → Processes in batches of 10
        ↓
5. Add to session's event vector store
   eventVectorStore.addDocuments(chunks)
        ↓
6. Return progress
   { processed: 100, totalEventsInSession: 500 }
```

---

## Data Flow

### **Knowledge Base Loading**

```
URL/PDF/File
     ↓
[Document Loader]
     ↓
Extract text (Cheerio/pdf-parse)
     ↓
Clean & format
     ↓
[Chunking]
RecursiveCharacterTextSplitter
- 1000 chars per chunk
- 200 char overlap
     ↓
[Embedding]
Ollama nomic-embed-text
     ↓
[Vector Store]
HNSWLib (persisted to disk)
     ↓
Document metadata saved
./vector_store/documents.json
```

---

## Technology Stack

### **Runtime & Framework**
- **Node.js:** v18+ with ES modules
- **Express.js:** 4.x (REST API framework)
- **Package Manager:** npm

### **AI/ML**
- **LangChain:** JavaScript framework for LLM apps
  - `@langchain/ollama` - Ollama integration
  - `@langchain/community` - Vector stores, utilities
  - `@langchain/textsplitters` - Document chunking
- **Ollama:** Local LLM server
  - Model: llama3.1:8b
  - Embedding: nomic-embed-text

### **Vector Database**
- **HNSWLib:** Hierarchical Navigable Small World graphs
  - In-memory with disk persistence
  - Fast similarity search (cosine similarity)
  - No separate server needed

### **Document Processing**
- **Cheerio:** HTML parsing (jQuery-like API)
- **Axios:** HTTP client for fetching URLs
- **pdf-parse:** PDF text extraction
- **Multer:** File upload handling

### **Utilities**
- **UUID:** Unique ID generation
- **dotenv:** Environment variable management
- **CORS:** Cross-origin resource sharing

---

## File Structure

```
src/
├── config/
│   ├── constants.js       # Configuration values
│   └── ollama.js          # LLM & embeddings initialization
│
├── services/              # Business logic
│   ├── sessionManager.js  # Session CRUD (Class)
│   ├── vectorStore.js     # Knowledge base vector store
│   ├── eventVectorStore.js# Per-session event embeddings
│   └── documentLoader.js  # Load docs from URLs/PDFs
│
├── routes/                # API endpoints (Express routers)
│   ├── health.routes.js   # Health check
│   ├── session.routes.js  # Session management
│   ├── chat.routes.js     # RAG-enabled chat
│   ├── events.routes.js   # Event upload & search
│   ├── knowledge.routes.js# Knowledge base management
│   └── index.js           # Route aggregator
│
└── app.js                 # Express app configuration
```

---

## Design Patterns

### **1. Singleton Pattern**
- `SessionManager` - Single instance for all sessions
- Vector stores - Loaded once, shared across requests

### **2. Factory Pattern**
- `llm` and `embeddings` created via factory functions
- Easy to mock for testing

### **3. Middleware Pattern**
- Express middleware for CORS, body parsing, logging
- Error handling middleware for consistent error responses

### **4. Router Pattern**
- Each domain (chat, events, knowledge) has its own router
- Routes registered centrally in `routes/index.js`

### **5. Service Layer**
- Business logic separated from route handlers
- Services are testable independently

---

## Scalability Considerations

### **Current Limitations**
1. **In-memory sessions** - Lost on restart (no persistence)
2. **Single-process** - Can't scale horizontally
3. **Local Ollama** - Bottleneck for concurrent requests
4. **No caching** - Every query searches vector store

### **Future Improvements**
When you need to scale:

1. **Session Persistence**
   - Use Redis or PostgreSQL
   - Serialize/deserialize sessions

2. **Horizontal Scaling**
   - Deploy multiple instances behind load balancer
   - Use shared session store (Redis)
   - Share vector store (Postgres with pgvector)

3. **LLM Optimization**
   - Queue system for LLM requests (Bull/Redis)
   - Multiple Ollama instances
   - Or switch to cloud LLM (OpenAI, Claude)

4. **Caching Layer**
   - Cache knowledge base search results
   - Cache common queries
   - Use Redis for distributed cache

---

## Security Considerations

### **Current State**
⚠️ **This is a PoC** - Not production-hardened

### **Production Checklist**
- [ ] Add authentication (API keys, OAuth)
- [ ] Rate limiting (prevent abuse)
- [ ] Input validation (sanitize user input)
- [ ] HTTPS/TLS (encrypt in transit)
- [ ] File upload limits (prevent DOS)
- [ ] CORS restrictions (whitelist origins)
- [ ] Secrets management (not in code)
- [ ] Audit logging (track API usage)

---

## Performance Metrics

### **Measured Performance**

| Operation | Time | Throughput |
|-----------|------|------------|
| Chat (no KB) | 2-5s | N/A |
| Chat (with RAG) | 3-6s | N/A |
| Event upload (100 events) | 0.8-1.2s | ~100 events/sec |
| Document loading (5KB) | 3-5s | N/A |
| KB search | 50-100ms | N/A |

*Measured on MacBook Pro M1, local Ollama*

---

## Monitoring & Observability

### **Current Logging**
- Console logs with emojis (✅ ❌ 📊 etc.)
- Request/response logging
- Error stack traces

### **Production Additions**
- Structured logging (JSON format)
- Log aggregation (ELK, Datadog)
- Metrics (Prometheus)
  - Request latency
  - Error rates
  - LLM response times
  - Vector store query times
- Alerting (PagerDuty, Slack)

---

## Testing Strategy

### **Current Tests**
- `tests/test-ollama.js` - Ollama connectivity
- `tests/test-chunked-upload.js` - Event upload workflow
- `tests/test-rag.js` - RAG pipeline

### **Future Tests**
- Unit tests (Jest/Mocha)
  - Service layer functions
  - Document chunking logic
  - Session management
- Integration tests
  - API endpoint testing
  - RAG pipeline end-to-end
- Load tests
  - Concurrent chat requests
  - Large document uploads

---

## Deployment Architecture

### **Current: Local Development**
```
Developer Machine
├── Node.js app (port 3001)
├── Ollama server (port 11434)
└── Vector store (local disk)
```

### **Future: Production**
```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│ App 1 │ │ App 2│ │ App 3│ │ App N│
└───┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
    │        │        │        │
    └────────┴────┬───┴────────┘
                  │
         ┌────────▼────────┐
         │  Shared Storage │
         │  • Redis (sess) │
         │  • S3 (vectors) │
         │  • RDS (metadata)│
         └─────────────────┘
```

---

## Architecture Decisions

### **1. Why Monolithic?**
- **Decision:** Single server for all features
- **Reason:** PoC phase, simpler deployment, faster iteration
- **Trade-off:** Can't scale components independently
- **Future:** Split into microservices when scale demands

### **2. Why HNSWLib?**
- **Decision:** In-memory vector store
- **Reason:** Fast, no separate server, good for < 100K docs
- **Trade-off:** Memory usage, single-machine limit
- **Alternative:** Chroma, Pinecone, Weaviate (for scale)

### **3. Why In-Memory Sessions?**
- **Decision:** Map-based session storage
- **Reason:** Simple, fast, good for PoC
- **Trade-off:** Lost on restart, can't scale horizontally
- **Future:** Move to Redis or database

### **4. Why Local Ollama?**
- **Decision:** Local LLM server
- **Reason:** Privacy, no API costs, full control
- **Trade-off:** Slower than cloud, requires GPU
- **Alternative:** OpenAI, Claude (for scale/speed)

---

## Related Documentation

- **[API Reference](./API_REFERENCE.md)** - All endpoints with examples
- **[Development Guide](./DEVELOPMENT.md)** - How to develop & extend
- **[Deployment Guide](./DEPLOYMENT.md)** - How to deploy & troubleshoot
- **[Client Guide](./CLIENT_GUIDE.md)** - Client-side implementation

---

**Questions or suggestions?** Open an issue or PR!

