/**
 * Session Management Routes
 * Endpoints for creating and managing debugging sessions
 */

import express from 'express';
import sessionManager from '../services/sessionManager.js';

const router = express.Router();

/**
 * POST /api/session/init
 * Initialize a new debugging session
 * Body: { userId?: string, metadata?: object }
 */
router.post("/init", async (req, res) => {
  const { userId, metadata } = req.body;

  try {
    const session = await sessionManager.createSession(userId, metadata);

    res.json({
      success: true,
      sessionId: session.id,
      message: "Session initialized successfully",
      session: {
        id: session.id,
        createdAt: session.createdAt,
        userId: session.userId,
      },
    });
  } catch (error) {
    console.error("❌ Error creating session:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/session/:sessionId/history
 * Get conversation history for a session
 */
router.get("/:sessionId/history", (req, res) => {
  const { sessionId } = req.params;

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Session not found",
    });
  }

  const history = sessionManager.getConversationHistory(sessionId);

  res.json({
    success: true,
    sessionId,
    history: history,
    totalMessages: history.length,
  });
});

/**
 * GET /api/sessions
 * Get all active sessions
 */
router.get('/', (req, res) => {
  const sessionList = sessionManager.getAllSessions();

  res.json({
    success: true,
    sessions: sessionList,
    total: sessionList.length,
  });
});

export default router;

