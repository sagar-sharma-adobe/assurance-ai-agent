# 🚀 Deployment Guide

Guide for deploying and operating the Adobe Assurance AI Agent.

---

## Quick Deploy (Local)

```bash
# 1. Install Docker Desktop (for ChromaDB)
# Download from: https://www.docker.com/products/docker-desktop

# 2. Start ChromaDB
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma:latest

# 3. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 4. Pull models
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# 5. Clone & setup
git clone git@github.com:sagar-sharma-adobe/assurance-ai-agent.git
cd assurance-ai-agent
npm install --legacy-peer-deps

# 6. Configure
cp .env.example .env

# 7. Start Ollama (separate terminal)
ollama serve

# 8. Start server
npm start
```

Server runs on `http://localhost:3001`

---

## System Requirements

### Minimum
- **CPU:** 4 cores
- **RAM:** 8GB
- **Storage:** 10GB free
- **OS:** macOS, Linux, or Windows (WSL2)
- **Node.js:** v18+

### Recommended
- **CPU:** 8+ cores (Apple M1/M2 or modern Intel/AMD)
- **RAM:** 16GB+
- **Storage:** 20GB+ SSD
- **GPU:** Optional but helpful for faster inference

---

## Installation Steps

### 1. Install Docker (for ChromaDB)

**macOS:**
```bash
brew install --cask docker
# Or download from: https://www.docker.com/products/docker-desktop
```

**Linux:**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify
docker --version
```

**Windows:**
Download Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)

### 2. Start ChromaDB Container

```bash
# Pull image
docker pull chromadb/chroma:latest

# Run container with persistent storage
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma:latest

# Verify it's running
docker ps | grep chromadb
curl http://localhost:8000/api/v2/heartbeat
```

**ChromaDB Management:**
```bash
# Stop
docker stop chromadb

# Start
docker start chromadb

# Restart
docker restart chromadb

# View logs
docker logs chromadb

# Remove (data persists in volume)
docker rm chromadb
```

### 3. Install Ollama

**macOS:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download from [ollama.com/download](https://ollama.com/download)

**Verify:**
```bash
ollama --version
```

### 4. Pull Required Models

```bash
# Chat model (8GB download)
ollama pull llama3.1:8b

# Embedding model (300MB download)
ollama pull nomic-embed-text

# Verify
ollama list
```

### 5. Install Node.js Dependencies

```bash
cd assurance-ai-agent
npm install --legacy-peer-deps
```

**Why `--legacy-peer-deps`?**
Some LangChain packages have peer dependency conflicts. This flag bypasses them safely.

### 6. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
PORT=3001
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TEMPERATURE=0.5
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

---

## Running the Server

### Development Mode

```bash
# Start Ollama (Terminal 1)
ollama serve

# Start server (Terminal 2)
npm start
```

### Production Mode

Use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start Ollama as service
# (varies by OS - see Ollama docs)

# Start server with PM2
pm2 start server.js --name assurance-ai-agent

# View logs
pm2 logs assurance-ai-agent

# Monitor
pm2 monit

# Restart
pm2 restart assurance-ai-agent

# Stop
pm2 stop assurance-ai-agent
```

---

## Verification

### 1. Check Ollama

```bash
# Test Ollama
curl http://localhost:11434/api/tags

# Test model
ollama run llama3.1:8b "test"
```

### 2. Check Server

```bash
# Health check
curl http://localhost:3001/api/health | python3 -m json.tool

# Expected output:
# {
#   "status": "healthy",
#   "ollama": "connected",
#   ...
# }
```

### 3. Run Tests

```bash
# All tests
npm test

# Specific tests
node tests/test-ollama.js
node tests/test-chunked-upload.js
node tests/test-rag.js
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama API URL |
| `OLLAMA_MODEL` | llama3.1:8b | Chat model |
| `OLLAMA_TEMPERATURE` | 0.5 | Creativity (0-1) |
| `OLLAMA_EMBEDDING_MODEL` | nomic-embed-text | Embedding model |

### Application Constants

Edit `src/config/constants.js`:

```javascript
// Chunk sizes
export const EVENT_UPLOAD_CHUNK_SIZE = 100;
export const MAX_EVENTS_PER_REQUEST = 200;
export const EMBEDDING_BATCH_SIZE = 10;

// System prompt
export const SYSTEM_PROMPT = `...`;
```

---

## Performance Tuning

### 1. Ollama Performance

**Set concurrent requests:**
```bash
# In environment or Ollama config
OLLAMA_NUM_PARALLEL=4
```

**Use GPU acceleration:**
```bash
# Ollama automatically uses GPU if available
# Verify: ollama should show "GPU: NVIDIA/AMD/Apple Metal"
```

### 2. Node.js Performance

**Increase memory limit:**
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

**Use clustering (multi-core):**
```javascript
// server.js
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  startServer();
}
```

### 3. Vector Store Optimization

**ChromaDB Configuration:**
- Knowledge base uses ChromaDB (running in Docker)
- No code changes needed - ChromaDB is already optimized
- To scale: allocate more resources to Docker container
```bash
# Example: Run ChromaDB with more memory
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  --memory="4g" \
  chromadb/chroma:latest
  }
);
```

---

## Monitoring

### Logs

**View logs:**
```bash
# If using PM2
pm2 logs assurance-ai-agent

# If running directly
# Logs go to stdout/stderr
```

**Log format:**
```
✅ Session created: abc-123
📊 [abc-123] Processing 100 events
💬 [abc-123] User: What is Adobe Assurance?
🤖 [abc-123] Assistant: Adobe Assurance is...
```

### Metrics to Track

1. **Request latency**
   - Chat: Should be < 5s
   - Event upload: < 1s per 100 events
   - KB search: < 100ms

2. **Error rates**
   - Watch for Ollama connection errors
   - Watch for vector store errors

3. **Resource usage**
   - Memory: Monitor Node.js heap
   - CPU: Should be < 80% average
   - Disk: Vector store size

### Health Checks

```bash
# Add to monitoring system
curl http://localhost:3001/api/health

# Should return 200 OK with:
# { "status": "healthy", "ollama": "connected" }
```

---

## Troubleshooting

### Server Won't Start

**Error:** `Cannot connect to Ollama`

**Solution:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

---

**Error:** `Port 3001 already in use`

**Solution:**
```bash
# Find process using port
lsof -ti:3001

# Kill it
kill -9 $(lsof -ti:3001)

# Or change port in .env
PORT=3002
```

---

**Error:** `Module not found`

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

---

### Ollama Issues

**Error:** `Model not found`

**Solution:**
```bash
# List installed models
ollama list

# Pull required models
ollama pull llama3.1:8b
ollama pull nomic-embed-text
```

---

**Error:** `Ollama too slow`

**Solution:**
```bash
# 1. Check GPU is being used
ollama run llama3.1:8b "test"
# Should show GPU info

# 2. Reduce concurrent requests
# Edit .env:
OLLAMA_NUM_PARALLEL=2

# 3. Use smaller model
ollama pull llama3.1:7b  # Smaller, faster
```

---

### Memory Issues

**Error:** `JavaScript heap out of memory`

**Solution:**
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Or add to package.json scripts:
"start": "NODE_OPTIONS='--max-old-space-size=4096' node server.js"
```

---

### Vector Store Issues

**Error:** `Failed to initialize ChromaDB vector store`

**Solution:**
```bash
# Check if ChromaDB is running
docker ps | grep chromadb

# If not running, start it
docker start chromadb

# If container doesn't exist, create it
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma:latest

# Verify ChromaDB is responding
curl http://localhost:8000/api/v2/heartbeat
```

---

**Error:** `ChromaDB client not initialized`

**Solution:**
```bash
# Ensure ChromaDB is accessible
docker logs chromadb

# Check port 8000 is not in use by another service
lsof -i :8000

# Restart ChromaDB
docker restart chromadb
```

---

**Error:** `Vector store not initialized` or `Collection not found`

**Solution:**
```bash
# Reset ChromaDB collection
docker stop chromadb
docker rm chromadb
docker volume rm chroma_data

# Start fresh
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma:latest

# Clear metadata
rm -rf vector_store/documents.json

# Restart server
npm start
```

---

### Performance Issues

**Issue:** Chat responses too slow

**Debugging:**
1. Check Ollama response time:
   ```bash
   time ollama run llama3.1:8b "test"
   ```

2. Check knowledge base search:
   ```bash
   curl -X POST http://localhost:3001/api/knowledge/search \
     -H "Content-Type: application/json" \
     -d '{"query": "test", "limit": 3}'
   ```

3. Reduce KB search results:
   ```javascript
   // In chat.routes.js
   const relevantDocs = await vectorStore.similaritySearch(message, 2); // Was 3
   ```

---

**Issue:** Event uploads timing out

**Solution:**
Reduce chunk size in client:
```javascript
const CHUNK_SIZE = 50; // Was 100
```

---

### Common Errors

**`response.substring is not a function`**

**Cause:** Trying to use string methods on AIMessage object

**Fix:** Access `.content` property first:
```javascript
const responseText = aiResponse.content; // ✅
const preview = responseText.substring(0, 100);
```

---

**`Session not found`**

**Cause:** Session expired or server restarted

**Fix:** Sessions are in-memory. Create a new session:
```bash
curl -X POST http://localhost:3001/api/session/init
```

---

**`Too many events in single request`**

**Cause:** Exceeded max events per request (200)

**Fix:** Use chunked upload - see [Client Guide](./CLIENT_GUIDE.md)

---

## Backup & Recovery

### Backup

**Knowledge Base:**
```bash
# Backup vector store
tar -czf vector_store_backup.tar.gz vector_store/

# Backup uploaded files
tar -czf knowledge_base_backup.tar.gz knowledge_base/
```

**Sessions:**
Sessions are in-memory (not persisted). Consider implementing session persistence if needed.

### Recovery

```bash
# Restore vector store
tar -xzf vector_store_backup.tar.gz

# Restore files
tar -xzf knowledge_base_backup.tar.gz

# Restart server
npm start
```

---

## Updating

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update packages
npm update

# Or update specific package
npm install @langchain/ollama@latest
```

### Update Ollama Models

```bash
# Pull latest version
ollama pull llama3.1:8b

# Verify
ollama list
```

---

## Security Checklist

### For Production

- [ ] Enable HTTPS/TLS
- [ ] Add authentication (API keys)
- [ ] Implement rate limiting
- [ ] Restrict CORS origins
- [ ] Add input sanitization
- [ ] Set file upload limits
- [ ] Use environment variables for secrets
- [ ] Enable audit logging
- [ ] Set up firewall rules
- [ ] Regular security updates

---

## Scaling Considerations

### When to Scale

You need to scale when:
- Chat requests > 10/second
- Multiple concurrent users (> 50)
- Knowledge base > 100MB
- Response times > 10s

### Horizontal Scaling

```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┬────────┐
    │         │        │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐
│ App 1 │ │ App 2│ │ App 3│
└───┬───┘ └──┬───┘ └──┬───┘
    │        │        │
    └────────┴────┬───┘
                  │
         ┌────────▼────────┐
         │  Shared Storage │
         │  • Redis        │
         │  • S3/Cloud     │
         │  • PostgreSQL   │
         └─────────────────┘
```

**Required changes:**
1. Move sessions to Redis
2. Move vector store to shared storage (S3 + Postgres with pgvector)
3. Use external LLM service (OpenAI, Claude) or multiple Ollama instances

---

## Monitoring Tools

### Recommended Tools

**For PoC:**
- PM2 (process management)
- PM2 Plus (monitoring)

**For Production:**
- **Logs:** ELK Stack, Datadog
- **Metrics:** Prometheus + Grafana
- **APM:** New Relic, Datadog APM
- **Alerting:** PagerDuty, Opsgenie

---

## Related Documentation

- **[Architecture](./ARCHITECTURE.md)** - System design & components
- **[API Reference](./API_REFERENCE.md)** - All endpoints with examples
- **[Development Guide](./DEVELOPMENT.md)** - How to develop & extend
- **[Client Guide](./CLIENT_GUIDE.md)** - Client-side implementation

---

**Need help?** Open an issue or contact the team!

