/**
 * Events Routes
 * Endpoints for uploading and managing Assurance session events
 * 
 * ARCHITECTURE: Chunked Upload for High-Volume Event Processing
 * - Clients should upload events in chunks of 100 for optimal performance
 * - Server processes each chunk synchronously (with batch embedding optimization)
 * - Supports progress tracking via chunk metadata
 * 
 * INTEGRATION POINT: Team working on event analysis should implement these endpoints
 */

import express from 'express';
import sessionManager from '../services/sessionManager.js';
import { searchEvents } from '../services/eventVectorStore.js';
import {
  MAX_EVENTS_PER_REQUEST,
  EVENT_UPLOAD_CHUNK_SIZE,
} from "../config/constants.js";

const router = express.Router();

/**
 * GET /api/events/config
 * Get upload configuration for client implementation
 * 
 * Returns recommended settings for chunked uploads
 * NOTE: This route must be defined BEFORE parameterized routes like /:sessionId
 */
router.get('/config', async (req, res) => {
  const { EVENT_UPLOAD_CHUNK_SIZE, MAX_EVENTS_PER_REQUEST, EMBEDDING_BATCH_SIZE } = await import('../config/constants.js');
  
  res.json({
    success: true,
    config: {
      recommendedChunkSize: EVENT_UPLOAD_CHUNK_SIZE,
      maxEventsPerRequest: MAX_EVENTS_PER_REQUEST,
      embeddingBatchSize: EMBEDDING_BATCH_SIZE,
    },
    usage: {
      description: 'For optimal performance, split large event batches into chunks',
      example: `For 1500 events, split into ${Math.ceil(1500 / EVENT_UPLOAD_CHUNK_SIZE)} chunks of ${EVENT_UPLOAD_CHUNK_SIZE} events each`,
    },
  });
});

/**
 * POST /api/events/upload
 * Upload Assurance events to a session with chunked upload support
 * 
 * CHUNKED UPLOAD ARCHITECTURE:
 * For large event batches (500-1500 events), client should split into chunks:
 * - Recommended chunk size: 100 events
 * - Maximum per request: 200 events (enforced)
 * - Upload chunks sequentially for progress tracking
 * 
 * INTEGRATION POINT: Team should implement event validation and parsing here
 * 
 * Body: { 
 *   sessionId: string, 
 *   events: Array<AssuranceEvent>,
 *   chunkInfo?: {
 *     current: number,    // Current chunk number (1-based)
 *     total: number,      // Total number of chunks
 *     isLast: boolean     // Is this the last chunk?
 *   }
 * }
 * 
 * Response includes chunk progress for client-side progress tracking
 */
router.post('/upload', async (req, res) => {
  const { sessionId, events, chunkInfo } = req.body;

  // Import configuration
  const { MAX_EVENTS_PER_REQUEST, EVENT_UPLOAD_CHUNK_SIZE } = await import(
    "../config/constants.js"
  );

  // Validation: sessionId
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "sessionId is required",
    });
  }

  // Validation: events array
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({
      success: false,
      error: "events array is required",
    });
  }

  // Validation: request size limit
  if (events.length === 0) {
    return res.status(400).json({
      success: false,
      error: "events array cannot be empty",
    });
  }

  if (events.length > MAX_EVENTS_PER_REQUEST) {
    return res.status(413).json({
      success: false,
      error: `Too many events in single request. Maximum: ${MAX_EVENTS_PER_REQUEST} events.`,
      hint: `Split into chunks of ${EVENT_UPLOAD_CHUNK_SIZE} events. Received: ${events.length}`,
      received: events.length,
      maxAllowed: MAX_EVENTS_PER_REQUEST,
      recommendedChunkSize: EVENT_UPLOAD_CHUNK_SIZE,
    });
  }

  // Validation: session exists
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Session not found",
    });
  }

  try {
    const startTime = Date.now();

    // Log chunk progress if provided
    if (chunkInfo) {
      console.log(
        `📊 [${sessionId.substring(0, 8)}] Processing chunk ${
          chunkInfo.current
        }/${chunkInfo.total} (${events.length} events)`
      );
    } else {
      console.log(
        `📊 [${sessionId.substring(0, 8)}] Processing ${events.length} events`
      );
    }

    // TODO: Team to implement
    // - Validate event structure
    // - Parse event types
    // - Extract relevant fields
    // - Add any preprocessing

    // Add events to session (with automatic deduplication)
    const deduplicationStats = await sessionManager.addEvents(
      sessionId,
      events
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalEvents = session.events.length;

    // Log results
    if (deduplicationStats.duplicates > 0) {
      console.log(
        `⚠️  [${sessionId.substring(0, 8)}] ${
          deduplicationStats.duplicates
        } duplicates skipped, ` + `${deduplicationStats.added} new events added`
      );
    }

    console.log(
      `✅ [${sessionId.substring(0, 8)}] Processed ${
        events.length
      } events in ${duration}s (${deduplicationStats.added} new, ${
        deduplicationStats.duplicates
      } duplicates)`
    );

    // Build success message
    let message;
    if (deduplicationStats.duplicates > 0) {
      message = `${deduplicationStats.added} new events added, ${deduplicationStats.duplicates} duplicates skipped`;
    } else {
      message = `${events.length} events uploaded successfully`;
    }

    // Response with chunk progress info and deduplication stats
    const response = {
      success: true,
      message,
      sessionId,
      processed: events.length,
      added: deduplicationStats.added,
      duplicates: deduplicationStats.duplicates,
      totalEventsInSession: totalEvents,
      processingTime: parseFloat(duration),
    };

    // Include chunk info in response if provided
    if (chunkInfo) {
      response.chunkInfo = {
        current: chunkInfo.current,
        total: chunkInfo.total,
        isLast: chunkInfo.isLast,
        progress: Math.round((chunkInfo.current / chunkInfo.total) * 100),
      };
    }

    res.json(response);
  } catch (error) {
    console.error(
      `❌ [${sessionId.substring(0, 8)}] Error uploading events:`,
      error
    );
    res.status(500).json({
      success: false,
      error: error.message,
      sessionId,
      chunkInfo: chunkInfo || null,
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

