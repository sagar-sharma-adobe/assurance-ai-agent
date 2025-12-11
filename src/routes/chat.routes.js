/**
 * Chat Routes (LangGraph Version)
 * Endpoints for AI-powered conversation using LangGraph workflow
 */

import express from "express";
import sessionManager from "../services/sessionManager.js";
import chatService from "../services/chatService.js";

const router = express.Router();

/**
 * POST /api/chat
 * Send a message and get AI response through LangGraph workflow
 * Body: { sessionId: string, message: string }
 */
router.post("/", async (req, res) => {
  const { sessionId, message } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "sessionId is required",
    });
  }

  if (!message) {
    return res.status(400).json({
      success: false,
      error: "message is required",
    });
  }

  // Check if session exists
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Session not found. Please initialize a session first.",
    });
  }

  try {
    // Process through LangGraph workflow
    const result = await chatService.chat(sessionId, message);

    res.json({
      success: true,
      response: result.response,
      sessionId,
      timestamp: new Date().toISOString(),
      context: result.metadata,
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
