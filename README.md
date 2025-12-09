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
├── server.js              # Main Express server
├── test-ollama.js         # Ollama connection test
├── package.json           # Dependencies
├── .env                   # Local configuration (not in git)
├── .env.example           # Example configuration
├── .npmrc                 # NPM registry config
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

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
✅ **REST API** - Easy integration with any frontend

## Development

```bash
npm run dev  # Run with auto-reload (Node 18+)
```

## Troubleshooting

**Cannot connect to Ollama**
- Ensure Ollama is running: `ollama serve`
- Check models: `ollama list` (should show `llama3.1:8b` and `nomic-embed-text`)

**Dependency conflicts**
- Use `npm install --legacy-peer-deps`

**Corporate network issues**
- Create `.npmrc`: `echo "registry=https://registry.npmjs.org/" > .npmrc`

## License

MIT