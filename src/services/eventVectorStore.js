/**
 * Event Vector Store Service (ChromaDB)
 * Manages per-session Assurance event embeddings for semantic search
 * 
 * ARCHITECTURE:
 * - One ChromaDB collection per session: `session_<sessionId>`
 * - Rich metadata for filtering and relationship queries
 * - Full event storage for display
 * 
 * BENEFITS over HNSWLib:
 * - Metadata filtering (hasError, isSDKEvent, requestId, etc.)
 * - Relationship queries (get by parentEventId, requestId)
 * - Retrieve by ID (for story building)
 * - Consistent with knowledge base architecture
 */

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { embeddings } from "../config/ollama.js";
import { CHROMA_URL } from "../config/constants.js";

// Shared ChromaDB client
let chromaClient = null;

/**
 * Get or initialize ChromaDB client
 * @returns {ChromaClient}
 */
function getChromaClient() {
  if (!chromaClient) {
    chromaClient = new ChromaClient({ path: CHROMA_URL });
  }
  return chromaClient;
}

/**
 * Generate session collection name
 * @param {string} sessionId - Unique session identifier
 * @returns {string} Collection name
 */
function getSessionCollectionName(sessionId) {
  return `session_${sessionId}`;
}

/**
 * Initialize ChromaDB client and cleanup old sessions on server startup
 * Called once during server initialization
 *
 * @returns {Promise<void>}
 */
export async function initializeEventStore() {
  try {
    console.log("🔧 Initializing Event Store (ChromaDB)...");

    const client = getChromaClient();

    // Test connection
    await client.heartbeat();
    console.log("   ✅ Connected to ChromaDB");

    // Cleanup old session collections
    const collections = await client.listCollections();
    const sessionCollections = collections.filter((col) =>
      col.name.startsWith("session_")
    );

    if (sessionCollections.length > 0) {
      console.log(
        `   🧹 Cleaning up ${sessionCollections.length} old session collection(s)...`
      );

      for (const collection of sessionCollections) {
        try {
          await client.deleteCollection({ name: collection.name });
          console.log(`      ✓ Deleted: ${collection.name}`);
        } catch (error) {
          console.warn(
            `      ⚠️  Failed to delete ${collection.name}:`,
            error.message
          );
        }
      }

      console.log("   ✅ Session cleanup complete");
    } else {
      console.log("   ℹ️  No old session collections to clean up");
    }

    console.log("   ✨ Event store ready!");
  } catch (error) {
    console.error("❌ Failed to initialize event store:", error);
    throw error;
  }
}

/**
 * Create a new event vector store for a session
 * 
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<Chroma>} Initialized vector store for events
 */
export async function createEventVectorStore(sessionId) {
  try {
    const client = getChromaClient();
    const collectionName = getSessionCollectionName(sessionId);

    // Create collection with metadata
    await client.createCollection({
      name: collectionName,
      metadata: {
        type: "events",
        sessionId,
        createdAt: Date.now().toString(),
      },
    });

    // Initialize LangChain Chroma vector store
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: CHROMA_URL,
    });

    console.log(
      `   📊 Created event vector store for session: ${sessionId.substring(
        0,
        8
      )}`
    );
    return vectorStore;
  } catch (error) {
    console.error(`❌ Failed to create event vector store:`, error);
    throw error;
  }
}

/**
 * Load existing event vector store from ChromaDB
 *
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Chroma|null>} Loaded vector store or null if not found
 */
export async function loadEventVectorStore(sessionId) {
  try {
    const client = getChromaClient();
    const collectionName = getSessionCollectionName(sessionId);

    // Check if collection exists
    const collections = await client.listCollections();
    const exists = collections.some((col) => col.name === collectionName);

    if (!exists) {
      return null;
    }

    // Load existing collection
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName,
      url: CHROMA_URL,
    });

    console.log(
      `   ✅ Loaded event vector store for session: ${sessionId.substring(
        0,
        8
      )}`
    );
    return vectorStore;
  } catch (error) {
    console.warn(
      `⚠️  Could not load event vector store for ${sessionId}:`,
      error.message
    );
    return null;
  }
}

/**
 * Delete event vector store for a session
 *
 * @param {string} sessionId - Session identifier
 * @returns {Promise<void>}
 */
export async function deleteEventVectorStore(sessionId) {
  try {
    const client = getChromaClient();
    const collectionName = getSessionCollectionName(sessionId);

    await client.deleteCollection({ name: collectionName });
    console.log(
      `   🗑️  Deleted event vector store for session: ${sessionId.substring(
        0,
        8
      )}`
    );
  } catch (error) {
    if (error.message.includes("not found")) {
      console.log(
        `   ℹ️  Event vector store not found for session: ${sessionId.substring(
          0,
          8
        )}`
      );
    } else {
      console.error(`❌ Failed to delete event vector store:`, error);
      throw error;
    }
  }
}

/**
 * Add Assurance events to session vector store
 * 
 * Optimized for batch processing with rich metadata:
 * - Processes events in batches to optimize memory usage
 * - Extracts semantic content for embeddings
 * - Stores rich metadata for filtering and relationships
 * - Preserves full event for display
 * 
 * @param {Chroma} vectorStore - Session's event vector store
 * @param {Array} events - Array of Assurance event objects
 * @param {number} batchSize - Optional batch size (default: from config)
 * @returns {Promise<void>}
 */
export async function addEventsToVectorStore(
  vectorStore,
  events,
  batchSize = null
) {
  if (!events || events.length === 0) {
    return;
  }

  // Import batch size from config if not provided
  if (!batchSize) {
    const { EMBEDDING_BATCH_SIZE } = await import("../config/constants.js");
    batchSize = EMBEDDING_BATCH_SIZE;
  }

  try {
    const startTime = Date.now();

    // Process events in batches to optimize Ollama embedding calls
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);

      // Format batch events with smart extraction and rich metadata
      const documents = batch.map((event) => {
        const payload = event.payload || {};
        const eventData = payload.ACPExtensionEventData || {};

        // Extract semantic content for embedding
        const semanticParts = [];

        // 1. SDK/Extension Events (ACPExtensionEvent* pattern)
        if (payload.ACPExtensionEventType) {
          semanticParts.push(`SDK Extension: ${payload.ACPExtensionEventType}`);
          semanticParts.push(`Event: ${payload.ACPExtensionEventName}`);
          if (payload.ACPExtensionEventSource) {
            semanticParts.push(`Source: ${payload.ACPExtensionEventSource}`);
          }
        }
        // 2. Backend/Service Events
        else {
          semanticParts.push(`Vendor: ${event.vendor}`);
          semanticParts.push(`Type: ${event.type}`);
          if (payload.name) {
            semanticParts.push(`Service: ${payload.name}`);
          }
        }

        // 3. Error Information (highest priority - prepend)
        const errorInfo = extractErrorInfo(event);
        if (errorInfo) {
          semanticParts.unshift(`🚨 ERROR: ${errorInfo}`);
        }

        // 4. Actions & State Changes
        if (eventData.action) {
          semanticParts.push(`Action: ${eventData.action}`);
        }
        if (eventData.stateowner) {
          semanticParts.push(`State Owner: ${eventData.stateowner}`);
        }

        // 5. Important messages
        if (payload.messages && Array.isArray(payload.messages)) {
          const messages = payload.messages
            .filter((m) => typeof m === "string" && m.length < 200)
            .join(" ");
          if (messages) {
            semanticParts.push(messages);
          }
        }

        const semanticContent = semanticParts.filter(Boolean).join("\n");

        // Build rich metadata for filtering and relationships
        const metadata = {
          // Identity & Relationships (for story building)
          eventId: payload.ACPExtensionEventUniqueIdentifier || event.uuid,
          parentEventId: payload.ACPExtensionEventParentIdentifier || null,
          requestId:
            eventData.requestId || payload.attributes?.requestId || null,

          // Categorization (field-based, not hardcoded)
          isSDKEvent: !!payload.ACPExtensionEventType,
          sdkExtension: payload.ACPExtensionEventType || null,
          eventName: payload.ACPExtensionEventName || null,
          eventSource: payload.ACPExtensionEventSource || null,
          vendor: event.vendor || null,
          serviceType: event.type || null,

          // Error Detection
          hasError: detectError(event),
          statusCode:
            eventData.status ||
            payload.status ||
            payload.context?.status ||
            null,
          logLevel: payload.logLevel || null,

          // State Changes (critical for story building)
          hasStateChange:
            !!eventData.stateowner || !!payload.metadata?.["state.data"],
          stateOwner: eventData.stateowner || null,

          // Timing
          timestamp: event.timestamp,
          eventNumber: event.eventNumber || 0,

          // Store full event as JSON string (for display)
          rawEvent: JSON.stringify(event),
        };

        return {
          pageContent: semanticContent,
          metadata,
        };
      });

      // Add batch to vector store (embeddings created here)
      await vectorStore.addDocuments(documents);

      // Progress logging for large batches
      if (events.length > batchSize) {
        const processed = Math.min(i + batchSize, events.length);
        console.log(`   📦 Processed ${processed}/${events.length} events`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `   ✅ Added ${events.length} events to vector store in ${duration}s`
    );
  } catch (error) {
    console.error("❌ Failed to add events to vector store:", error);
    throw error;
  }
}

/**
 * Extract error information from event (universal patterns)
 * @param {object} event - Assurance event
 * @returns {string|null} Error description or null
 */
function extractErrorInfo(event) {
  const payload = event.payload || {};
  const eventData = payload.ACPExtensionEventData || {};
  const context = payload.context || {};

  // Pattern 1: Explicit error in ACPExtensionEventData (SDK events)
  if (eventData.status >= 400 || eventData.title || eventData.detail) {
    return `${eventData.status || ""} ${eventData.title || ""} - ${
      eventData.detail || ""
    }`.trim();
  }

  // Pattern 2: Backend error with status in context
  if (context.status && context.status >= 400) {
    const messages = Array.isArray(payload.messages)
      ? payload.messages.join(" ")
      : payload.messages || "";
    return `${context.status} ${context.errorType || ""} - ${messages}`
      .trim()
      .substring(0, 200);
  }

  // Pattern 3: Error in logLevel with messages
  if (payload.logLevel === "error" && payload.messages) {
    return Array.isArray(payload.messages)
      ? payload.messages.join(" ").substring(0, 200)
      : payload.messages.substring(0, 200);
  }

  // Pattern 4: Error in event source (SDK events)
  if (payload.ACPExtensionEventSource?.includes("error")) {
    return `Error from ${payload.ACPExtensionEventName || "unknown"}`;
  }

  // Pattern 5: Error in payload.errors array
  if (
    payload.errors &&
    Array.isArray(payload.errors) &&
    payload.errors.length > 0
  ) {
    return JSON.stringify(payload.errors).substring(0, 200);
  }

  return null;
}

/**
 * Detect if event contains an error (universal patterns)
 * @param {object} event - Assurance event
 * @returns {boolean}
 */
function detectError(event) {
  const payload = event.payload || {};
  const eventData = payload.ACPExtensionEventData || {};
  const context = payload.context || {};

  return (
    // SDK event error patterns
    (eventData.status && eventData.status >= 400) ||
    (payload.ACPExtensionEventSource &&
      payload.ACPExtensionEventSource.includes("error")) ||
    (eventData.title && eventData.title.toLowerCase().includes("fail")) ||
    // Backend event error patterns
    payload.logLevel === "error" ||
    (context.status && context.status >= 400) ||
    payload.name?.includes("/error") ||
    // General error patterns
    (payload.errors &&
      Array.isArray(payload.errors) &&
      payload.errors.length > 0)
  );
}

/**
 * Search for relevant events in vector store
 *
 * @param {Chroma} vectorStore - Session's event vector store
 * @param {string} query - Search query
 * @param {number} k - Number of results to return
 * @param {object} filters - Optional metadata filters
 * @returns {Promise<Array>} Relevant event documents with parsed rawEvent
 */
export async function searchEvents(vectorStore, query, k = 5, filters = {}) {
  try {
    // Build where clause from filters
    const where = {};

    if (filters.hasError !== undefined) {
      where.hasError = filters.hasError;
    }
    if (filters.isSDKEvent !== undefined) {
      where.isSDKEvent = filters.isSDKEvent;
    }
    if (filters.sdkExtension) {
      where.sdkExtension = filters.sdkExtension;
    }
    if (filters.vendor) {
      where.vendor = filters.vendor;
    }
    if (filters.requestId) {
      where.requestId = filters.requestId;
    }

    // Perform semantic search with metadata filtering
    const results = await vectorStore.similaritySearch(
      query,
      k,
      Object.keys(where).length > 0 ? where : undefined
    );

    // Parse rawEvent from JSON string
    return results.map((doc) => ({
      ...doc,
      rawEvent: JSON.parse(doc.metadata.rawEvent),
    }));
  } catch (error) {
    console.error("❌ Failed to search events:", error);
    return [];
  }
}

/**
 * Get events by requestId (for story building)
 *
 * @param {string} sessionId - Session identifier
 * @param {string} requestId - Request ID to filter by
 * @returns {Promise<Array>} Events with matching requestId
 */
export async function getEventsByRequestId(sessionId, requestId) {
  try {
    const client = getChromaClient();
    const collectionName = getSessionCollectionName(sessionId);

    const collection = await client.getCollection({ name: collectionName });

    const results = await collection.get({
      where: { requestId },
    });

    if (!results.documents || results.documents.length === 0) {
      return [];
    }

    return results.documents.map((doc, i) => ({
      pageContent: doc,
      metadata: results.metadatas[i],
      rawEvent: JSON.parse(results.metadatas[i].rawEvent),
    }));
  } catch (error) {
    console.error("❌ Failed to get events by requestId:", error);
    return [];
  }
}

/**
 * Get event by ID (for story building)
 *
 * @param {string} sessionId - Session identifier
 * @param {string} eventId - Event ID to retrieve
 * @returns {Promise<object|null>} Event document or null if not found
 */
export async function getEventById(sessionId, eventId) {
  try {
    const client = getChromaClient();
    const collectionName = getSessionCollectionName(sessionId);

    const collection = await client.getCollection({ name: collectionName });

    const results = await collection.get({
      where: { eventId },
    });

    if (!results.documents || results.documents.length === 0) {
      return null;
    }

    return {
      pageContent: results.documents[0],
      metadata: results.metadatas[0],
      rawEvent: JSON.parse(results.metadatas[0].rawEvent),
    };
  } catch (error) {
    console.error("❌ Failed to get event by ID:", error);
    return null;
  }
}

/**
 * Get events by parent event ID (for story building - find children)
 *
 * @param {string} sessionId - Session identifier
 * @param {string} parentEventId - Parent event ID
 * @returns {Promise<Array>} Child events
 */
export async function getEventsByParentId(sessionId, parentEventId) {
  try {
    const client = getChromaClient();
    const collectionName = getSessionCollectionName(sessionId);

    const collection = await client.getCollection({ name: collectionName });

    const results = await collection.get({
      where: { parentEventId },
    });

    if (!results.documents || results.documents.length === 0) {
      return [];
    }

    return results.documents.map((doc, i) => ({
      pageContent: doc,
      metadata: results.metadatas[i],
      rawEvent: JSON.parse(results.metadatas[i].rawEvent),
    }));
  } catch (error) {
    console.error("❌ Failed to get events by parentId:", error);
    return [];
  }
}

/**
 * Get event statistics from vector store
 *
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Statistics about stored events
 */
export async function getEventStats(sessionId) {
  try {
    const client = getChromaClient();
    const collectionName = getSessionCollectionName(sessionId);

    const collection = await client.getCollection({ name: collectionName });
    const count = await collection.count();

    return {
      totalEvents: count,
      sessionId,
    };
  } catch (error) {
    console.error("❌ Failed to get event stats:", error);
    return {
      totalEvents: 0,
      sessionId,
      error: error.message,
    };
  }
}
