# Adobe Assurance AI Agent

AI-powered debugging assistant for Adobe Assurance sessions using local LLM (Ollama) and LangChain.

## Quick Start (For Team Members)

```bash
# 1. Install Ollama (if not already installed)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull required models
ollama pull llama3.1:8b
ollama pull nomic-embed-text

# 3. Clone and setup project
cd assurance_ai_agent
npm install --legacy-peer-deps

# 4. Configure environment
cp .env.example .env

# 5. Start Ollama service (in a separate terminal)
ollama serve

# 6. Test the setup
npm test

# 7. Start the server
npm start
```

The server will be available at `http://localhost:3001`

## Prerequisites

- **Node.js** v18+ 
- **Ollama** installed locally ([ollama.com](https://ollama.com/download))

**Note:** This project uses `@langchain/ollama` (not the deprecated `@langchain/community` package)

## Project Structure

```
assurance-ai-agent/
├── server.js                      # Entry point - starts the server
├── test-ollama.js                 # Ollama connection test
│
├── src/                           # Source code (modular architecture)
│   ├── config/                    # Configuration
│   │   ├── constants.js           # App constants (paths, prompts, etc.)
│   │   └── ollama.js              # LLM and embeddings setup
│   │
│   ├── services/                  # Business logic
│   │   ├── sessionManager.js      # Session management (Class)
│   │   └── vectorStore.js         # Vector store operations (Functions)
│   │
│   ├── routes/                    # API endpoint definitions
│   │   ├── health.routes.js       # Health check endpoint
│   │   ├── session.routes.js      # Session management endpoints
│   │   ├── chat.routes.js         # Chat/conversation endpoint
│   │   └── index.js               # Route aggregator
│   │
│   └── app.js                     # Express app configuration
│
├── vector_store/                  # Vector DB storage (gitignored)
├── knowledge_base/                # Uploaded documents (gitignored)
│
├── package.json                   # Dependencies
├── .env                           # Local configuration (not in git)
├── .env.example                   # Example configuration
└── README.md                      # This file
```

### Code Organization

The codebase follows a **modular architecture** for better maintainability:

- **`config/`** - Environment and setup configuration
- **`services/`** - Business logic (uses classes when state is needed, functions otherwise)
- **`routes/`** - API endpoint definitions (Express routers)
- **`app.js`** - Express middleware and app configuration
- **`server.js`** - Simple entry point that initializes and starts everything

## API Endpoints

### Health Check
```bash
GET http://localhost:3001/api/health
```
Returns server status and Ollama connection state.

### Initialize Session
```bash
POST http://localhost:3001/api/session/init
Content-Type: application/json

{
  "userId": "test-user",
  "metadata": {
    "appVersion": "1.0.0",
    "platform": "iOS"
  }
}
```
Returns a `sessionId` for subsequent requests.

### Send Chat Message
```bash
POST http://localhost:3001/api/chat
Content-Type: application/json

{
  "sessionId": "<your-session-id>",
  "message": "What is Adobe Assurance?"
}
```
Returns AI response with conversation context maintained.

### Get Conversation History
```bash
GET http://localhost:3001/api/session/<session-id>/history
```
Returns full conversation history for a session.

### List All Sessions
```bash
GET http://localhost:3001/api/sessions
```
Returns all active sessions with metadata.

## Features

✅ **Conversation Management** - Maintains context across multiple messages  
✅ **Session Tracking** - Multiple independent debugging sessions  
✅ **Adobe Assurance Context** - Specialized AI for Adobe SDK debugging  
✅ **Local LLM** - Privacy-focused with Ollama (no cloud API needed)  
✅ **Vector Store Ready** - HNSWLib integration for document embeddings  
✅ **Modular Architecture** - Clean, maintainable, team-friendly codebase  
✅ **REST API** - Easy integration with any frontend

## Technology Stack

- **Runtime:** Node.js v18+ with ES Modules
- **Framework:** Express.js for REST API
- **LLM:** Ollama with llama3.1:8b model
- **Embeddings:** nomic-embed-text via Ollama
- **Vector Store:** HNSWLib (in-process, no separate server needed)
- **Language:** JavaScript with JSDoc comments

## Development

```bash
npm run dev  # Run with auto-reload (Node 18+)
```

### For Developers: Where to Find Things

**Need to modify an API endpoint?**
- Health check → `src/routes/health.routes.js`
- Session management → `src/routes/session.routes.js`
- Chat logic → `src/routes/chat.routes.js`

**Need to change business logic?**
- Session operations → `src/services/sessionManager.js`
- Vector store operations → `src/services/vectorStore.js`

**Need to update configuration?**
- Environment variables → `.env`
- Constants/prompts → `src/config/constants.js`
- LLM setup → `src/config/ollama.js`

**Adding new features?**
1. Add service logic in `src/services/`
2. Create new routes in `src/routes/`
3. Register routes in `src/routes/index.js`
4. No need to touch `server.js` or `app.js`

### Architecture Principles

- **Classes** are used when state needs to be managed (e.g., `SessionManager`)
- **Functions** are used for stateless operations (e.g., vector store utilities)
- **Routes** only handle HTTP request/response - delegate logic to services
- **Services** contain business logic and can be tested independently

## Troubleshooting

**Cannot connect to Ollama**
- Ensure Ollama is running: `ollama serve`
- Check models: `ollama list` (should show `llama3.1:8b` and `nomic-embed-text`)
- Test connection: `npm test`

**Dependency conflicts**
- Use `npm install --legacy-peer-deps`
- Make sure you're using Node.js v18+

**Corporate network issues**
- Create `.npmrc`: `echo "registry=https://registry.npmjs.org/" > .npmrc`

**Vector store initialization fails**
- Check if `vector_store/` directory has write permissions
- Delete `vector_store/` and restart server to recreate
- Ensure sufficient disk space for embeddings storage

**Module import errors**
- This project uses ES Modules (`"type": "module"` in package.json)
- Use `import` not `require`
- Some packages (like pdf-parse) need special handling - see `server.js` for examples

## Roadmap / Upcoming Features

🚧 **Knowledge Base Integration (RAG)**
- Load documentation from URLs and PDFs
- Semantic search across knowledge base
- AI responses powered by actual Adobe Assurance documentation

🚧 **Event Analysis**
- Upload Assurance session events
- Semantic search for events
- AI-powered event sequence analysis

🚧 **Advanced Query Routing**
- Classify queries (general vs document-specific vs event-specific)
- Route to appropriate handler

## Contributing

This project follows a modular architecture to make collaboration easy:

1. **Fork and clone** the repository
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** in the appropriate module (`src/services/`, `src/routes/`, etc.)
4. **Test locally** with `npm start`
5. **Commit** with clear messages (`git commit -m 'Add amazing feature'`)
6. **Push** and create a Pull Request

**Code Style:**
- Use ES6+ features (async/await, arrow functions, destructuring)
- Add JSDoc comments for functions
- Follow existing patterns (classes for state, functions for utilities)
- Keep files focused (single responsibility)

## License

Apache License 2.0 - see [LICENSE](LICENSE) file for details

Copyright 2025 Sagar Sharma