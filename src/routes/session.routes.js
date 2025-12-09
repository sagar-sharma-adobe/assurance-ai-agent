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
router.post('/init', (req, res) => {
  const { userId, metadata } = req.body;

  const session = sessionManager.createSession(userId, metadata);

  res.json({
    success: true,
    sessionId: session.id,
    message: 'Session initialized successfully',
    session: {
      id: session.id,
      createdAt: session.createdAt,
      userId: session.userId,
    },
  });
});

/**
 * GET /api/session/:sessionId/history
 * Get conversation history for a session
 */
router.get('/:sessionId/history', (req, res) => {
  const { sessionId } = req.params;

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
    });
  }

  res.json({
    success: true,
    sessionId,
    history: session.conversationHistory,
    totalMessages: session.conversationHistory.length,
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

