/**
 * Event Vector Store Service
 * Manages per-session Assurance event embeddings for semantic search
 * 
 * PURPOSE: Store and search Assurance session events using vector embeddings
 * INTEGRATION POINT: Team members working on event analysis should extend this
 */

import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { embeddings } from '../config/ollama.js';
import path from 'path';
import fs from 'fs';

/**
 * Create a new event vector store for a session
 * 
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<HNSWLib>} Initialized vector store for events
 */
export async function createEventVectorStore(sessionId) {
  try {
    // Create empty vector store with initialization document
    const vectorStore = await HNSWLib.fromTexts(
      ['Session initialized - events will be added here'],
      [{ source: 'init', sessionId }],
      embeddings
    );
    
    console.log(`   📊 Created event vector store for session: ${sessionId.substring(0, 8)}`);
    return vectorStore;
    
  } catch (error) {
    console.error(`❌ Failed to create event vector store:`, error);
    throw error;
  }
}

/**
 * Load existing event vector store from disk
 * 
 * @param {string} sessionId - Session identifier
 * @returns {Promise<HNSWLib|null>} Loaded vector store or null if not found
 */
export async function loadEventVectorStore(sessionId) {
  const storePath = path.join('./vector_store/sessions', sessionId);
  
  if (fs.existsSync(storePath)) {
    try {
      const vectorStore = await HNSWLib.load(storePath, embeddings);
      console.log(`   ✅ Loaded event vector store for session: ${sessionId.substring(0, 8)}`);
      return vectorStore;
    } catch (error) {
      console.error(`⚠️  Could not load event vector store for ${sessionId}:`, error.message);
      return null;
    }
  }
  
  return null;
}

/**
 * Save event vector store to disk
 * 
 * @param {string} sessionId - Session identifier
 * @param {HNSWLib} vectorStore - Vector store instance to save
 * @returns {Promise<void>}
 */
export async function saveEventVectorStore(sessionId, vectorStore) {
  const storePath = path.join('./vector_store/sessions', sessionId);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  await vectorStore.save(storePath);
  console.log(`   💾 Saved event vector store for session: ${sessionId.substring(0, 8)}`);
}

/**
 * Add Assurance events to session vector store
 * 
 * INTEGRATION POINT: Team members should implement event parsing here
 * 
 * @param {HNSWLib} vectorStore - Session's event vector store
 * @param {Array} events - Array of Assurance event objects
 * @returns {Promise<void>}
 */
export async function addEventsToVectorStore(vectorStore, events) {
  if (!events || events.length === 0) {
    return;
  }
  
  try {
    // TODO: Team to implement - Parse and format events for embedding
    // Current implementation is a basic example
    
    const eventTexts = events.map(event => {
      // Format event as searchable text
      // Team can customize this based on event structure
      return `
Event Type: ${event.type || 'unknown'}
Event Name: ${event.name || 'unnamed'}
Timestamp: ${event.timestamp || 'unknown'}
Payload: ${JSON.stringify(event.payload || {}, null, 2)}
      `.trim();
    });
    
    const metadata = events.map(event => ({
      eventId: event.id || event.eventId,
      eventType: event.type,
      eventName: event.name,
      timestamp: event.timestamp
    }));
    
    // Add documents to vector store
    await vectorStore.addDocuments(
      eventTexts.map((text, i) => ({
        pageContent: text,
        metadata: metadata[i]
      }))
    );
    
    console.log(`   ✅ Added ${events.length} events to vector store`);
    
  } catch (error) {
    console.error('❌ Failed to add events to vector store:', error);
    throw error;
  }
}

/**
 * Search for relevant events in vector store
 * 
 * @param {HNSWLib} vectorStore - Session's event vector store
 * @param {string} query - Search query
 * @param {number} k - Number of results to return
 * @returns {Promise<Array>} Relevant event documents
 */
export async function searchEvents(vectorStore, query, k = 5) {
  try {
    const results = await vectorStore.similaritySearch(query, k);
    return results;
  } catch (error) {
    console.error('❌ Failed to search events:', error);
    return [];
  }
}

/**
 * Get event statistics from vector store
 * 
 * INTEGRATION POINT: Team can add analytics here
 * 
 * @param {HNSWLib} vectorStore - Session's event vector store
 * @returns {Promise<Object>} Statistics about stored events
 */
export async function getEventStats(vectorStore) {
  // TODO: Team can implement detailed analytics
  // For now, return basic info
  
  return {
    message: 'Event statistics - to be implemented by event analysis team',
    totalEvents: 0  // Team to implement actual count
  };
}

