/**
 * Events Routes
 * Endpoints for uploading and managing Assurance session events
 * 
 * INTEGRATION POINT: Team working on event analysis should implement these endpoints
 */

import express from 'express';
import sessionManager from '../services/sessionManager.js';
import { searchEvents } from '../services/eventVectorStore.js';

const router = express.Router();

/**
 * POST /api/events/upload
 * Upload Assurance events to a session
 * 
 * INTEGRATION POINT: Team should implement event validation and parsing here
 * 
 * Body: { 
 *   sessionId: string, 
 *   events: Array<AssuranceEvent>
 * }
 */
router.post('/upload', async (req, res) => {
  const { sessionId, events } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'sessionId is required',
    });
  }

  if (!events || !Array.isArray(events)) {
    return res.status(400).json({
      success: false,
      error: 'events array is required',
    });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
    });
  }

  try {
    // TODO: Team to implement
    // - Validate event structure
    // - Parse event types
    // - Extract relevant fields
    // - Add any preprocessing
    
    // Add events to session (stores raw + creates embeddings)
    await sessionManager.addEvents(sessionId, events);

    console.log(`📊 [${sessionId.substring(0, 8)}] Uploaded ${events.length} events`);

    res.json({
      success: true,
      message: `${events.length} events uploaded successfully`,
      sessionId,
      totalEvents: session.events.length,
    });
    
  } catch (error) {
    console.error('❌ Error uploading events:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/events/:sessionId
 * Get all raw events for a session
 */
router.get('/:sessionId', (req, res) => {
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
    events: session.events,
    totalEvents: session.events.length,
  });
});

/**
 * POST /api/events/search
 * Semantic search for events in a session
 * 
 * INTEGRATION POINT: Team can enhance this with filters, event type classification, etc.
 * 
 * Body: { sessionId: string, query: string, limit?: number }
 */
router.post('/search', async (req, res) => {
  const { sessionId, query, limit = 5 } = req.body;

  if (!sessionId || !query) {
    return res.status(400).json({
      success: false,
      error: 'sessionId and query are required',
    });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
    });
  }

  try {
    const eventVectorStore = sessionManager.getEventVectorStore(sessionId);
    const results = await searchEvents(eventVectorStore, query, limit);

    res.json({
      success: true,
      sessionId,
      query,
      results: results.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata,
      })),
      totalResults: results.length,
    });
    
  } catch (error) {
    console.error('❌ Error searching events:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/events/:sessionId/stats
 * Get event statistics for a session
 * 
 * INTEGRATION POINT: Team can implement analytics here
 * - Event type distribution
 * - Error rate
 * - Timeline analysis
 * - etc.
 */
router.get('/:sessionId/stats', async (req, res) => {
  const { sessionId } = req.params;

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
    });
  }

  try {
    // TODO: Team to implement detailed analytics
    // For now, return basic stats
    
    const eventVectorStore = sessionManager.getEventVectorStore(sessionId);
    const { getEventStats } = await import('../services/eventVectorStore.js');
    const stats = await getEventStats(eventVectorStore);

    res.json({
      success: true,
      sessionId,
      stats: {
        totalEvents: session.events.length,
        ...stats
      },
    });
    
  } catch (error) {
    console.error('❌ Error getting event stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

