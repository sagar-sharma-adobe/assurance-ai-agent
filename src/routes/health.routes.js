/**
 * Health Check Routes
 * Endpoint to verify server and Ollama connection status
 */

import express from 'express';
import { llm } from '../config/ollama.js';
import sessionManager from '../services/sessionManager.js';

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint - verifies server and Ollama are running
 */
router.get('/health', async (req, res) => {
  try {
    // Test Ollama connection with a simple query
    await llm.invoke('test');
    
    res.json({
      status: 'healthy',
      ollama: 'connected',
      model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
      activeSessions: sessionManager.getAllSessions().length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      ollama: 'disconnected',
      error: error.message,
    });
  }
});

export default router;

