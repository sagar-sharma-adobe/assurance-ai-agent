/**
 * Session Manager Service
 * Manages user debugging sessions with conversation history and event storage
 * 
 * Architecture:
 * - Simple conversation history (manual tracking - reliable & straightforward)
 * - LangChain event vector stores (per-session semantic search)
 * - Integration points clearly marked for future enhancements
 * 
 * UPGRADE PATH for LangChain Memory:
 * - Can use ChatMessageHistory from '@langchain/core/chat_history'
 * - Or integrate with ConversationalRetrievalQAChain for automatic memory management
 */

import { v4 as uuidv4 } from "uuid";
import { createEventVectorStore } from "./eventVectorStore.js";

/**
 * SessionManager Class
 * Handles CRUD operations for debugging sessions
 * 
 * Why a class? Because it maintains state (the sessions Map)
 */
class SessionManager {
  constructor() {
    // In-memory storage of all active sessions
    this.sessions = new Map();

    // Event vector stores per session (LangChain integrated for semantic event search)
    this.eventVectorStores = new Map();
  }

  /**
   * Initialize a new debugging session
   * Creates session metadata + event vector store
   *
   * @param {string} userId - Optional user identifier
   * @param {object} metadata - Optional metadata (appVersion, platform, etc.)
   * @returns {Promise<object>} New session object
   */
  async createSession(userId, metadata = {}) {
    const sessionId = uuidv4();

    // Session metadata and custom data
    const session = {
      id: sessionId,
      userId: userId || "anonymous",
      createdAt: new Date().toISOString(),
      metadata: metadata,
      conversationHistory: [], // Simple conversation tracking
      events: [], // Raw Assurance events (array storage)
      eventIds: new Set(), // Track event IDs for deduplication (O(1) lookup)
    };

    // Initialize event vector store for this session (LangChain integrated)
    const eventVectorStore = await createEventVectorStore(sessionId);

    // Store everything
    this.sessions.set(sessionId, session);
    this.eventVectorStores.set(sessionId, eventVectorStore);

    console.log(`✅ New session created: ${sessionId}`);

    return session;
  }

  /**
   * Get session by ID
   * @param {string} sessionId
   * @returns {object|null} Session object or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Add message to conversation history
   *
   * NOTE: Using simple manual tracking for reliability
   * UPGRADE PATH: Can be replaced with LangChain ChatMessageHistory or ConversationChain
   *
   * @param {string} sessionId
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  addMessage(sessionId, role, content) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get conversation history for a session
   * @param {string} sessionId
   * @returns {array} Array of messages
   */
  getConversationHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.conversationHistory : [];
  }

  /**
   * Get event vector store for a session
   *
   * INTEGRATION POINT: Team working on event analysis can use this
   * to access session-specific event embeddings for semantic search
   *
   * @param {string} sessionId
   * @returns {Chroma} Event vector store instance (ChromaDB)
   */
  getEventVectorStore(sessionId) {
    const eventStore = this.eventVectorStores.get(sessionId);
    if (!eventStore) {
      throw new Error(`Event vector store not found for session ${sessionId}`);
    }
    return eventStore;
  }

  /**
   * Add events to session (stores raw events + creates embeddings)
   *
   * Features:
   * - Automatic deduplication using Set (O(1) lookup)
   * - Tracks added vs duplicate counts
   * - Idempotent (safe to retry same request)
   *
   * INTEGRATION POINT: Team working on event analysis should call this
   * to upload Assurance session events
   *
   * @param {string} sessionId
   * @param {Array} events - Array of Assurance event objects
   * @returns {Promise<Object>} Stats: { added, duplicates, total }
   */
  async addEvents(sessionId, events) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Deduplicate events using Set
    const newEvents = [];
    let duplicateCount = 0;

    for (const event of events) {
      // Generate event ID (prefer event.id, fallback to eventId, then hash)
      const eventId = event.id || event.eventId;

      if (!eventId) {
        // Event has no ID - use content hash for deduplication
        const eventHash = this._hashEvent(event);

        if (session.eventIds.has(eventHash)) {
          duplicateCount++;
          continue; // Skip duplicate
        }

        session.eventIds.add(eventHash);
        newEvents.push(event);
      } else {
        // Event has ID - use it for deduplication
        if (session.eventIds.has(eventId)) {
          duplicateCount++;
          continue; // Skip duplicate
        }

        session.eventIds.add(eventId);
        newEvents.push(event);
      }
    }

    // Log deduplication results
    if (duplicateCount > 0) {
      console.log(
        `⚠️  [${sessionId.substring(
          0,
          8
        )}] Skipped ${duplicateCount} duplicate events`
      );
    }

    // If all events were duplicates, return early
    if (newEvents.length === 0) {
      console.log(
        `ℹ️  [${sessionId.substring(0, 8)}] All ${
          events.length
        } events were duplicates (idempotent request)`
      );
      return {
        added: 0,
        duplicates: duplicateCount,
        total: session.events.length,
      };
    }

    // Store only new events
    session.events.push(...newEvents);

    // Add to event vector store for semantic search (only new events)
    const eventVectorStore = this.eventVectorStores.get(sessionId);
    const { addEventsToVectorStore } = await import("./eventVectorStore.js");
    await addEventsToVectorStore(eventVectorStore, newEvents);

    console.log(
      `✅ [${sessionId.substring(0, 8)}] Added ${newEvents.length} events ` +
        `(${duplicateCount} duplicates skipped, total: ${session.events.length})`
    );

    return {
      added: newEvents.length,
      duplicates: duplicateCount,
      total: session.events.length,
    };
  }

  /**
   * Generate hash for event (for events without IDs)
   * @private
   * @param {Object} event - Event object
   * @returns {string} Hash of event
   */
  _hashEvent(event) {
    // Use JSON string as hash (simple but effective for deduplication)
    return JSON.stringify(event);
  }

  /**
   * Get all active sessions (metadata only)
   * @returns {array} Array of session summaries
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete a session and its associated data
   * @param {string} sessionId
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    this.eventVectorStores.delete(sessionId);

    // Delete ChromaDB collection
    if (deleted) {
      const { deleteEventVectorStore } = await import("./eventVectorStore.js");
      try {
        await deleteEventVectorStore(sessionId);
      } catch (error) {
        console.warn(
          `⚠️  Failed to delete event vector store for ${sessionId}:`,
          error.message
        );
      }
      console.log(`🗑️  Session deleted: ${sessionId}`);
    }

    return deleted;
  }

  /**
   * Get count of active sessions
   * @returns {number} Number of active sessions
   */
  getActiveSessionCount() {
    return this.sessions.size;
  }
}

// Export singleton instance
export default new SessionManager();
