# 🤖 Adobe Assurance AI Agent

**AI-powered debugging assistant for Adobe Assurance sessions using local LLM (Ollama) and LangChain.**

RAG-enabled conversational AI that helps developers debug Adobe Experience Platform SDK events, analyze tracking issues, and troubleshoot mobile app implementations.

---

## ⚡ Quick Start

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

# 4. Pull required models
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# 5. Clone and setup
git clone git@github.com:sagar-sharma-adobe/assurance-ai-agent.git
cd assurance-ai-agent
npm install --legacy-peer-deps

# 6. Configure
cp .env.example .env

# 7. Start Ollama (Terminal 1)
ollama serve

# 8. Start server (Terminal 2)
npm start
```

**Server:** `http://localhost:3001`

**Test:** `npm test`

---

## 🎯 What It Does

- **💬 RAG-Enabled Chat** - Ask questions, get answers from documentation
- **📊 Event Analysis** - Upload & search Assurance events semantically
- **📚 Knowledge Base** - Load docs from URLs/PDFs for AI context
- **🔍 Smart Search** - Vector similarity search across events & docs
- **💾 Session Management** - Track conversations & debugging sessions

---

## 📖 Documentation

### **For New Users**
- **[📚 Quick Start](#-quick-start)** - Get running in 5 minutes (above)
- **[🏗️ Architecture](./docs/ARCHITECTURE.md)** - How the system works
- **[📡 API Reference](./docs/API_REFERENCE.md)** - All endpoints with examples

### **For Developers**
- **[🛠️ Development Guide](./docs/DEVELOPMENT.md)** - Develop & extend features
- **[🚀 Deployment Guide](./docs/DEPLOYMENT.md)** - Deploy & troubleshoot

### **For Client Developers**
- **[📱 Client Guide](./docs/CLIENT_GUIDE.md)** - Implement chunked event uploads

---

## 📚 Pre-loaded Knowledge Base

This repository includes a pre-loaded document for testing:
- **Adobe Assurance Overview** (14 chunks, 10,637 characters)
- **Storage:** ChromaDB (Docker container) + metadata in `vector_store/documents.json`
- Ready to use immediately after starting ChromaDB and server
- Add more documents via API or delete metadata to start fresh

**Knowledge Base Management:**
```bash
# List all loaded documents
curl http://localhost:3001/api/knowledge/documents

# Check metadata file size
du -sh vector_store/

# Load a new document
curl -X POST http://localhost:3001/api/knowledge/load-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/docs", "title": "My Doc"}'
```

### 🔄 Repopulating the Knowledge Base

The complete list of URLs is saved in `docs/knowledge-base-urls.json`. Use this to rebuild the knowledge base from scratch:

```bash
# Populate entire knowledge base from URL list
npm run kb:populate

# Populate with custom batch size and delay
node scripts/populate-knowledge-base.js --batch-size=5 --delay=3000

# Populate specific categories only
node scripts/populate-knowledge-base.js --categories="XDM Schemas,Edge Network"

# Force update existing documents
npm run kb:populate -- --force

# Export current URLs to file
npm run kb:export
```

**When to use:**
- ✅ Setting up a fresh ChromaDB instance
- ✅ Sharing the project with team members
- ✅ Recovering from data loss
- ✅ Rebuilding after major updates

---

## 🚀 Core Features

### 1. **RAG-Enabled Chat**

```bash
# Create session
curl -X POST http://localhost:3001/api/session/init \
  -H "Content-Type: application/json" \
  -d '{"userId": "developer"}'

# Ask a question (AI searches knowledge base automatically)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "message": "What is Adobe Assurance?"
  }'
```

**Response includes:** AI answer + `knowledgeBaseUsed` flag

### 2. **Event Upload (Chunked)**

For large event batches (500-1500 events), use chunked uploads:

```bash
# Upload events in chunks of 100
curl -X POST http://localhost:3001/api/events/upload \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID",
    "events": [...100 events...],
    "chunkInfo": { "current": 1, "total": 15, "isLast": false }
  }'
```

**See:** [Client Guide](./docs/CLIENT_GUIDE.md) for full implementation

### 3. **Knowledge Base Management**

```bash
# Load documentation from URL
curl -X POST http://localhost:3001/api/knowledge/load-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://developer.adobe.com/client-sdks/documentation/platform-assurance/",
    "title": "Adobe Assurance Overview"
  }'

# Upload PDF/text file
curl -X POST http://localhost:3001/api/knowledge/upload \
  -F "document=@/path/to/guide.pdf"

# List loaded documents
curl http://localhost:3001/api/knowledge/documents
```

---

## 🧪 Testing

```bash
# Test Ollama connectivity
npm test

# Test chunked upload
npm run test:upload

# Test RAG pipeline
npm run test:rag

# Run all tests
npm run test:all
```

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/session/init` | POST | Create session |
| `/api/chat` | POST | RAG-enabled chat |
| `/api/events/upload` | POST | Upload events (chunked) |
| `/api/events/search` | POST | Search events |
| `/api/knowledge/load-url` | POST | Load from URL |
| `/api/knowledge/upload` | POST | Upload PDF/text |
| `/api/knowledge/search` | POST | Search knowledge base |

**Full API documentation:** [API Reference](./docs/API_REFERENCE.md)

---

## 🏗️ Architecture

```
┌──────────────────────────────────┐
│     Express.js REST API          │
│  (Session, Chat, Events, KB)     │
└────────┬─────────────────────────┘
         │
    ┌────┴─────┬──────────┐
    │          │          │
┌───▼────┐ ┌──▼──────┐ ┌─▼────────┐
│Session │ │Knowledge│ │  Ollama  │
│Manager │ │  Base   │ │  (LLM)   │
│        │ │ (RAG)   │ │          │
└────────┘ └─────────┘ └──────────┘
```

**Tech Stack:**
- **Runtime:** Node.js v18+ (ES modules)
- **Framework:** Express.js
- **LLM:** Ollama (llama3.1:8b)
- **Embeddings:** nomic-embed-text
- **Vector Store:** ChromaDB (Docker container)
- **Doc Loading:** Cheerio, pdf-parse, Axios

**Learn more:** [Architecture Guide](./docs/ARCHITECTURE.md)

---

## 🛠️ Development

```bash
# Start with auto-reload
npm run dev

# Project structure
src/
├── config/         # Configuration & LLM setup
├── services/       # Business logic
├── routes/         # API endpoints
└── app.js          # Express app

tests/              # Test scripts
docs/               # Documentation
```

**Developer guide:** [Development Guide](./docs/DEVELOPMENT.md)

---

## 🚀 Deployment

### Local (PoC)
```bash
npm start
```

### Production
```bash
# Use PM2 for process management
npm install -g pm2
pm2 start server.js --name assurance-ai-agent
pm2 logs
```

**Full deployment guide:** [Deployment Guide](./docs/DEPLOYMENT.md)

---

## 📚 How RAG Works

1. **User asks a question**
2. **System searches** knowledge base for relevant docs (top 3 chunks)
3. **AI receives** question + relevant documentation
4. **AI generates** answer using both documentation & conversation context
5. **Response returned** with `knowledgeBaseUsed: true`

**Result:** Accurate, contextual answers based on actual documentation!

---

## 🎯 Use Cases

- **Debug SDK events** - "Why isn't my analytics event firing?"
- **Understand Assurance** - "What is Adobe Assurance?"
- **Troubleshoot issues** - "How do I fix tracking problems?"
- **Learn best practices** - "What's the recommended SDK setup?"

---

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

**Development guide:** [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

---

## 📝 License

Apache License 2.0 - See [LICENSE](./LICENSE) for details

---

## 🆘 Troubleshooting

**Server won't start?**
- Check Ollama is running: `curl http://localhost:11434/api/tags`
- Check models are installed: `ollama list`

**Slow responses?**
- Ollama using GPU? Check during startup logs
- Try smaller model: `ollama pull llama3.1:7b`

**Can't connect?**
- Server running on correct port? Check `.env` file
- Firewall blocking? Check security settings

**Full troubleshooting:** [Deployment Guide - Troubleshooting](./docs/DEPLOYMENT.md#troubleshooting)

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/sagar-sharma-adobe/assurance-ai-agent/issues)
- **Docs:** [Documentation](./docs/)
- **Email:** sagsharma@adobe.com

---

## 🎉 What's New

### v1.0.0 (Current)
- ✅ RAG-enabled chat with knowledge base
- ✅ Chunked event upload (500-1500 events)
- ✅ Document loading (URLs, PDFs, text)
- ✅ Per-session event vector stores
- ✅ Semantic search across events & docs
- ✅ Comprehensive API & documentation

---

## 🗺️ Roadmap

- [ ] Event type classification & analytics
- [ ] Knowledge graph extraction
- [ ] Multi-language support
- [ ] Cloud LLM integration (OpenAI, Claude)
- [ ] Web UI for debugging
- [ ] Session persistence (Redis/PostgreSQL)

---

**Built with ❤️ for Adobe Assurance developers**
