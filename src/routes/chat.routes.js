/**
 * Chat Routes
 * Endpoints for AI-powered conversation
 */

import express from 'express';
import { llm } from '../config/ollama.js';
import { SYSTEM_PROMPT } from '../config/constants.js';
import sessionManager from '../services/sessionManager.js';

const router = express.Router();

/**
 * POST /api/chat
 * Send a message and get AI response
 * Body: { sessionId: string, message: string }
 */
router.post('/', async (req, res) => {
  const { sessionId, message } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'sessionId is required',
    });
  }

  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'message is required',
    });
  }

  // Check if session exists
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found. Please initialize a session first.',
    });
  }

  try {
    console.log(`💬 [${sessionId.substring(0, 8)}] User: ${message}`);

    // Get conversation history
    const conversationHistory =
      sessionManager.getConversationHistory(sessionId);

    // Build conversation context
    const conversationContext = conversationHistory
      .map(
        (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n");

    // TODO: When Knowledge Base is ready, add retrieval here
    // const kbDocs = await searchSimilarDocuments(message, 3);

    // TODO: Team can add event context from session event vector store
    // const eventVectorStore = sessionManager.getEventVectorStore(sessionId);
    // const relevantEvents = await searchEvents(eventVectorStore, message, 5);

    // Create full prompt with system instructions + history + new message
    const fullPrompt = `${SYSTEM_PROMPT}

Previous conversation:
${conversationContext || "No previous messages"}

User: ${message}
`;

    // Get AI response
    const aiResponse = await llm.invoke(fullPrompt);

    // Extract text content from AIMessage object
    const responseText = aiResponse.content;

    // Save to conversation history
    sessionManager.addMessage(sessionId, "user", message);
    sessionManager.addMessage(sessionId, "assistant", responseText);

    console.log(
      `🤖 [${sessionId.substring(0, 8)}] Assistant: ${responseText.substring(
        0,
        100
      )}...`
    );

    res.json({
      success: true,
      response: responseText,
      sessionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ Error in chat:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

