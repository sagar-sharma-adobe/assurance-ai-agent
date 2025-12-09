/**
 * Session Manager Service
 * Manages user debugging sessions with conversation history
 */

import { v4 as uuidv4 } from 'uuid';

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
  }

  /**
   * Initialize a new debugging session
   * @param {string} userId - Optional user identifier
   * @param {object} metadata - Optional metadata (appVersion, platform, etc.)
   * @returns {object} New session object
   */
  createSession(userId, metadata = {}) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      userId: userId || 'anonymous',
      createdAt: new Date().toISOString(),
      metadata: metadata,
      conversationHistory: [],
      events: [],
    };

    this.sessions.set(sessionId, session);
    console.log(`✅ New session created: ${sessionId}`);

    return session;
  }

  /**
   * Get session by ID
   * @param {string} sessionId
   * @returns {object|null} Session object or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Add message to conversation history
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
   * Get all active sessions
   * @returns {array} Array of session summaries
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      userId: s.userId,
      createdAt: s.createdAt,
      messageCount: s.conversationHistory.length,
    }));
  }

  /**
   * Delete a session
   * @param {string} sessionId
   * @returns {boolean} True if deleted, false if not found
   */
  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }
}

// Export singleton instance (one SessionManager for the entire app)
export default new SessionManager();

