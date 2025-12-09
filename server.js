import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { ChatOllama } from '@langchain/ollama';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory session storage
const sessions = new Map();

// Initialize Ollama LLM
const llm = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
  temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7'),
});

// System prompt for Adobe Assurance context
const SYSTEM_PROMPT = `You are an AI assistant specialized in Adobe Assurance debugging. 
You help developers debug and understand Adobe Experience Platform SDK events, analyze tracking issues, 
and provide insights into mobile app implementations.

You are knowledgeable about:
- Adobe Experience Platform Mobile SDKs
- Event tracking and validation
- Common debugging patterns
- SDK configuration issues
- Data collection problems

Provide clear, actionable answers and always consider the context of mobile app debugging.`;

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  try {
    await llm.invoke('test');
    res.json({ 
      status: 'healthy',
      ollama: 'connected',
      model: process.env.OLLAMA_MODEL,
      activeSessions: sessions.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy',
      ollama: 'disconnected',
      error: error.message 
    });
  }
});

/**
 * Initialize a new debugging session
 * POST /api/session/init
 * Body: { userId?: string, metadata?: object }
 */
app.post('/api/session/init', (req, res) => {
  const { userId, metadata } = req.body;
  
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    userId: userId || 'anonymous',
    createdAt: new Date().toISOString(),
    metadata: metadata || {},
    conversationHistory: [],
    events: [],
  };
  
  sessions.set(sessionId, session);
  
  console.log(`✅ New session created: ${sessionId}`);
  
  res.json({
    success: true,
    sessionId,
    message: 'Session initialized successfully',
    session: {
      id: session.id,
      createdAt: session.createdAt,
      userId: session.userId
    }
  });
});

/**
 * Chat endpoint - Send message and get AI response
 * POST /api/chat
 * Body: { sessionId: string, message: string }
 */
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  
  // Validation
  if (!sessionId) {
    return res.status(400).json({ 
      success: false, 
      error: 'sessionId is required' 
    });
  }
  
  if (!message) {
    return res.status(400).json({ 
      success: false, 
      error: 'message is required' 
    });
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ 
      success: false, 
      error: 'Session not found. Please initialize a session first.' 
    });
  }
  
  try {
    console.log(`💬 [${sessionId.substring(0, 8)}] User: ${message}`);
    
    // Build conversation context
    const conversationContext = session.conversationHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    
    // Create prompt with context
    const fullPrompt = `${SYSTEM_PROMPT}

Previous conversation:
${conversationContext || 'No previous messages'}

User: ${message}
`;
    
    // Get AI response
    const aiResponse = await llm.invoke(fullPrompt);
    
    // Extract content from AIMessage object
    const responseText = aiResponse.content;
    
    // Save to conversation history
    session.conversationHistory.push({ role: 'user', content: message });
    session.conversationHistory.push({ role: 'assistant', content: responseText });
    
    console.log(`🤖 [${sessionId.substring(0, 8)}] Assistant: ${responseText.substring(0, 100)}...`);
    
    res.json({
      success: true,
      response: responseText,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`❌ Error in chat:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get session conversation history
 * GET /api/session/:sessionId/history
 */
app.get('/api/session/:sessionId/history', (req, res) => {
  const { sessionId } = req.params;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  
  res.json({
    success: true,
    sessionId,
    history: session.conversationHistory,
    totalMessages: session.conversationHistory.length
  });
});

/**
 * Get all active sessions
 * GET /api/sessions
 */
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.values()).map(s => ({
    id: s.id,
    userId: s.userId,
    createdAt: s.createdAt,
    messageCount: s.conversationHistory.length
  }));
  
  res.json({
    success: true,
    sessions: sessionList,
    total: sessionList.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Adobe Assurance AI Agent Server`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🤖 Ollama Model: ${process.env.OLLAMA_MODEL || 'llama3.1:8b'}`);
  console.log(`\n📝 Available endpoints:`);
  console.log(`   GET  /api/health`);
  console.log(`   POST /api/session/init`);
  console.log(`   POST /api/chat`);
  console.log(`   GET  /api/session/:sessionId/history`);
  console.log(`   GET  /api/sessions`);
  console.log(`\n✨ Ready to assist with Adobe Assurance debugging!\n`);
});

