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
   * @returns {HNSWLib} Event vector store instance
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
   * INTEGRATION POINT: Team working on event analysis should call this
   * to upload Assurance session events
   *
   * @param {string} sessionId
   * @param {Array} events - Array of Assurance event objects
   * @returns {Promise<void>}
   */
  async addEvents(sessionId, events) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Store raw events in session
    session.events.push(...events);

    // Add to event vector store for semantic search
    const eventVectorStore = this.eventVectorStores.get(sessionId);
    const { addEventsToVectorStore } = await import("./eventVectorStore.js");
    await addEventsToVectorStore(eventVectorStore, events);

    console.log(
      `✅ Added ${events.length} events to session ${sessionId.substring(0, 8)}`
    );
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
   * @returns {boolean} True if deleted, false if not found
   */
  deleteSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    this.eventVectorStores.delete(sessionId);

    if (deleted) {
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
