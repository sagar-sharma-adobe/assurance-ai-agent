# 🛠️ Development Guide

Guide for developers working on the Adobe Assurance AI Agent.

---

## Getting Started

### Prerequisites

- **Node.js** v18+ ([download](https://nodejs.org/))
- **Ollama** installed locally ([download](https://ollama.com/download))
- **Git** for version control

### Initial Setup

```bash
# 1. Clone repository
git clone git@github.com:sagar-sharma-adobe/assurance-ai-agent.git
cd assurance-ai-agent

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Setup environment
cp .env.example .env

# 4. Pull Ollama models
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# 5. Start Ollama (in separate terminal)
ollama serve

# 6. Test setup
npm test

# 7. Start development server
npm start
```

Server will run on `http://localhost:3001`

---

## Project Structure

```
assurance-ai-agent/
├── src/                          # Source code
│   ├── config/                   # Configuration
│   │   ├── constants.js          # App constants
│   │   └── ollama.js             # LLM initialization
│   │
│   ├── services/                 # Business logic
│   │   ├── sessionManager.js     # Session CRUD (Class)
│   │   ├── vectorStore.js        # Knowledge base vector store
│   │   ├── eventVectorStore.js   # Per-session event embeddings
│   │   └── documentLoader.js     # Document loading utilities
│   │
│   ├── routes/                   # API endpoints (Express routers)
│   │   ├── health.routes.js      # Health check
│   │   ├── session.routes.js     # Session management
│   │   ├── chat.routes.js        # RAG-enabled chat
│   │   ├── events.routes.js      # Event upload & search
│   │   ├── knowledge.routes.js   # Knowledge base management
│   │   └── index.js              # Route aggregator
│   │
│   └── app.js                    # Express app configuration
│
├── tests/                        # Test scripts
│   ├── test-ollama.js            # Ollama connectivity test
│   ├── test-chunked-upload.js    # Event upload test
│   └── test-rag.js               # RAG pipeline test
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # System architecture
│   ├── API_REFERENCE.md          # API documentation
│   ├── DEVELOPMENT.md            # This file
│   ├── DEPLOYMENT.md             # Deployment guide
│   └── CLIENT_GUIDE.md           # Client implementation
│
├── vector_store/                 # Vector DB storage (gitignored)
├── knowledge_base/               # Uploaded documents (gitignored)
├── server.js                     # Entry point
├── package.json                  # Dependencies
└── README.md                     # Quick start guide
```

---

## Where to Find Things

### Need to modify an API endpoint?
- **Health check** → `src/routes/health.routes.js`
- **Session management** → `src/routes/session.routes.js`
- **Chat logic** → `src/routes/chat.routes.js`
- **Event upload/search** → `src/routes/events.routes.js`
- **Knowledge base** → `src/routes/knowledge.routes.js`

### Need to change business logic?
- **Session operations** → `src/services/sessionManager.js`
- **Knowledge base vector store** → `src/services/vectorStore.js`
- **Event vector store** → `src/services/eventVectorStore.js`
- **Document loading** → `src/services/documentLoader.js`

### Need to update configuration?
- **Environment variables** → `.env`
- **Constants/prompts** → `src/config/constants.js`
- **LLM setup** → `src/config/ollama.js`

### Adding new features?
1. Add service logic in `src/services/`
2. Create new routes in `src/routes/`
3. Register routes in `src/routes/index.js`
4. No need to touch `server.js` or `app.js`

---

## Code Patterns & Conventions

### 1. Classes vs Functions

**Use Classes when:**
- State needs to be managed
- Multiple methods operate on shared data

```javascript
// Example: SessionManager
class SessionManager {
  constructor() {
    this.sessions = new Map(); // Shared state
  }
  
  createSession(userId) { ... }
  getSession(sessionId) { ... }
}

export default new SessionManager(); // Singleton
```

**Use Functions when:**
- Operations are stateless
- Utilities and helpers

```javascript
// Example: Document loading
export async function loadFromURL(url) { ... }
export async function chunkDocument(content) { ... }
```

### 2. Route Structure

```javascript
import express from 'express';
const router = express.Router();

/**
 * GET /api/example
 * Description of what this endpoint does
 */
router.get('/example', async (req, res) => {
  // 1. Validate input
  if (!req.query.param) {
    return res.status(400).json({ success: false, error: '...' });
  }
  
  // 2. Business logic (delegate to service)
  try {
    const result = await someService.doSomething(req.query.param);
    
    // 3. Send response
    res.json({ success: true, data: result });
  } catch (error) {
    // 4. Error handling
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

### 3. Error Handling

```javascript
// Always use try-catch in async routes
router.post('/endpoint', async (req, res) => {
  try {
    // Your logic here
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### 4. Logging Conventions

Use emojis for visual scanning:
```javascript
console.log('✅ Success message');
console.log('❌ Error message');
console.log('📊 Data/stats message');
console.log('💬 User interaction');
console.log('🔧 System operation');
console.log('⚠️  Warning message');
```

### 5. Response Format

Always use consistent response format:
```javascript
// Success
res.json({
  success: true,
  data: { ... },
  message: 'Optional success message'
});

// Error
res.status(code).json({
  success: false,
  error: 'Error message'
});
```

---

## Development Workflow

### Running Locally

```bash
# Start server with auto-reload (Node 18+)
npm run dev

# Or standard start
npm start
```

### Running Tests

```bash
# Test Ollama connectivity
node tests/test-ollama.js

# Test chunked event upload
node tests/test-chunked-upload.js

# Test RAG pipeline
node tests/test-rag.js
```

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Follow code patterns above
   - Add JSDoc comments
   - Update relevant tests

3. **Test your changes**
   ```bash
   npm start
   # Test your feature manually
   ```

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: description of your feature"
   ```

5. **Push**
   ```bash
   git push origin feature/your-feature-name
   ```

---

## Adding New Features

### Example: Adding a New Route

**1. Create route file** (`src/routes/myfeature.routes.js`):
```javascript
import express from 'express';
const router = express.Router();

router.get('/endpoint', async (req, res) => {
  res.json({ success: true, message: 'It works!' });
});

export default router;
```

**2. Register route** (`src/routes/index.js`):
```javascript
import myFeatureRoutes from './myfeature.routes.js';

export function registerRoutes(app) {
  // ... existing routes
  app.use('/api/myfeature', myFeatureRoutes);
}
```

**3. Test**:
```bash
curl http://localhost:3001/api/myfeature/endpoint
```

### Example: Adding a New Service

**1. Create service** (`src/services/myService.js`):
```javascript
/**
 * My Service
 * Description of what this service does
 */

export function doSomething(param) {
  // Your logic here
  return result;
}

export async function doSomethingAsync(param) {
  // Async logic
  return result;
}
```

**2. Use in route**:
```javascript
import { doSomething } from '../services/myService.js';

router.get('/endpoint', (req, res) => {
  const result = doSomething(req.query.param);
  res.json({ success: true, result });
});
```

---

## Working with Vector Stores

### Knowledge Base Vector Store (ChromaDB)

**Technology:** ChromaDB (full CRUD, persistent via Docker)

```javascript
import { getVectorStore, saveVectorStore } from '../services/vectorStore.js';

// Search
const vectorStore = getVectorStore();
const results = await vectorStore.similaritySearch(query, 3);

// Add documents
await vectorStore.addDocuments(chunks);
await saveVectorStore(); // No-op for ChromaDB (auto-persists)
```

### Event Vector Store (HNSWLib, Per-Session)

**Technology:** HNSWLib (lightweight, in-memory with disk persistence)

```javascript
import sessionManager from '../services/sessionManager.js';
import { searchEvents } from '../services/eventVectorStore.js';

// Get session's event store
const eventVectorStore = sessionManager.getEventVectorStore(sessionId);

// Search events
const results = await searchEvents(eventVectorStore, query, 5);
```

---

## Working with LLM

### Basic LLM Call

```javascript
import { llm } from '../config/ollama.js';

const response = await llm.invoke('Your prompt here');
const text = response.content; // Extract text from AIMessage
```

### Creating Embeddings

```javascript
import { embeddings } from '../config/ollama.js';

// Single text
const embedding = await embeddings.embedQuery('text to embed');

// Multiple texts (batched)
const embeddingsList = await embeddings.embedDocuments([
  'text 1',
  'text 2',
  'text 3'
]);
```

---

## Environment Variables

Edit `.env` to customize:

```bash
# Server
PORT=3001

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TEMPERATURE=0.5
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

---

## Debugging

### Enable Verbose Logging

Add to your route:
```javascript
console.log('🔍 Debug:', JSON.stringify(data, null, 2));
```

### Check Ollama Status

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# List models
ollama list

# Test model
ollama run llama3.1:8b "test"
```

### Check Vector Store

```javascript
// In server code
console.log('Vector store size:', vectorStore.index?.currentCount);
```

### View Session Data

```bash
# List all sessions
curl http://localhost:3001/api/sessions | python3 -m json.tool

# Get session history
curl http://localhost:3001/api/session/SESSION_ID/history | python3 -m json.tool
```

---

## Common Tasks

### Resetting Knowledge Base

```bash
# Stop server
# Delete vector store
rm -rf vector_store/
# Restart server (will create fresh store)
npm start
```

### Clearing Sessions

Sessions are in-memory. Just restart the server:
```bash
# Ctrl+C to stop
npm start
```

### Updating System Prompt

Edit `src/config/constants.js`:
```javascript
export const SYSTEM_PROMPT = `Your new prompt here`;
```

### Changing Chunk Size

Edit `src/config/constants.js`:
```javascript
export const EVENT_UPLOAD_CHUNK_SIZE = 150; // Increase chunk size
```

---

## Testing Strategy

### Manual Testing

```bash
# 1. Health check
curl http://localhost:3001/api/health

# 2. Create session
curl -X POST http://localhost:3001/api/session/init \
  -H "Content-Type: application/json" \
  -d '{"userId": "test"}'

# 3. Send chat message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "SESSION_ID", "message": "test"}'
```

### Automated Tests

```bash
# Run all tests
npm test

# Run specific test
node tests/test-ollama.js
```

---

## Performance Tips

### 1. Batch Embeddings
```javascript
// ❌ Slow: One at a time
for (const text of texts) {
  await embeddings.embedQuery(text);
}

// ✅ Fast: Batch
await embeddings.embedDocuments(texts);
```

### 2. Reuse Vector Store
```javascript
// ✅ Get once, reuse
const vectorStore = getVectorStore();
const results1 = await vectorStore.similaritySearch(query1, 3);
const results2 = await vectorStore.similaritySearch(query2, 3);
```

### 3. Limit Search Results
```javascript
// Only get what you need
const results = await vectorStore.similaritySearch(query, 3); // Not 100
```

---

## Integration Points for Team Members

### Working on Event Analysis?

**Files to modify:**
1. `src/services/eventVectorStore.js`
   - `addEventsToVectorStore()` - Customize event parsing
   - `getEventStats()` - Implement analytics

2. `src/routes/events.routes.js`
   - Add validation for event structure
   - Add filters for event search
   - Create custom analytics endpoints

**Access event vector store:**
```javascript
const eventVectorStore = sessionManager.getEventVectorStore(sessionId);
const relevantEvents = await searchEvents(eventVectorStore, query, 5);
```

### Working on Knowledge Base?

**Files to extend:**
1. `src/services/documentLoader.js`
   - Add new document sources
   - Customize text extraction
   - Add preprocessing logic

2. `src/routes/knowledge.routes.js`
   - Add document management endpoints
   - Add advanced search features
   - Add document versioning

**Access knowledge base:**
```javascript
const vectorStore = getVectorStore();
const docs = await vectorStore.similaritySearch(query, 3);
```

---

## Best Practices

### 1. Always Validate Input
```javascript
if (!sessionId || !message) {
  return res.status(400).json({
    success: false,
    error: 'sessionId and message are required'
  });
}
```

### 2. Use Try-Catch
```javascript
try {
  // Your async code
} catch (error) {
  console.error('❌ Error:', error);
  res.status(500).json({ success: false, error: error.message });
}
```

### 3. Log Important Events
```javascript
console.log(`✅ Session created: ${sessionId}`);
console.log(`📊 Loaded ${docs.length} documents`);
console.log(`💬 User: ${message}`);
```

### 4. Return Consistent Responses
```javascript
// Always include 'success' field
res.json({ success: true, data: result });
res.json({ success: false, error: 'message' });
```

### 5. Document Your Code
```javascript
/**
 * Brief description
 * @param {string} param - Parameter description
 * @returns {Promise<Object>} What it returns
 */
async function myFunction(param) { ... }
```

---

## Related Documentation

- **[Architecture](./ARCHITECTURE.md)** - System design & components
- **[API Reference](./API_REFERENCE.md)** - All endpoints with examples
- **[Deployment Guide](./DEPLOYMENT.md)** - Deployment & troubleshooting
- **[Client Guide](./CLIENT_GUIDE.md)** - Client-side implementation

---

**Questions?** Open an issue or ask the team!

