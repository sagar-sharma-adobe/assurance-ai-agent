/**
 * Server Entry Point
 * Initializes and starts the Adobe Assurance AI Agent server
 */

import dotenv from 'dotenv';
import { createApp } from './src/app.js';
import { initializeVectorStore } from './src/services/vectorStore.js';
import { initializeEventStore } from "./src/services/eventVectorStore.js";
import { warmupEmbeddingModel } from "./src/config/ollama.js";
import {
  PORT,
  OLLAMA_MODEL,
  OLLAMA_EMBEDDING_MODEL,
} from "./src/config/constants.js";

// Load environment variables
dotenv.config();

/**
 * Start the server
 * 1. Initialize vector store
 * 2. Create Express app
 * 3. Start listening
 */
async function startServer() {
  try {
    console.log("\n🚀 Starting Adobe Assurance AI Agent Server...\n");

    // Step 1: Initialize vector store for knowledge base
    await initializeVectorStore();

    // Step 2: Initialize event store and cleanup old sessions
    await initializeEventStore();

    // Step 3: Warm up embedding model (avoids 35s delay on first upload)
    await warmupEmbeddingModel();

    // Step 4: Create and configure Express app
    const app = createApp();

    // Step 5: Start listening
    app.listen(PORT, () => {
      console.log("🚀 Adobe Assurance AI Agent Server");
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`🤖 Ollama Model: ${OLLAMA_MODEL}`);
      console.log(`🔮 Embedding Model: ${OLLAMA_EMBEDDING_MODEL}`);
      console.log("\n📝 Available endpoints:");
      console.log("   GET  /api/health");
      console.log("   POST /api/session/init");
      console.log("   POST /api/chat                        (RAG-enabled)");
      console.log("   GET  /api/session/:sessionId/history");
      console.log("   GET  /api/sessions");
      console.log("   GET  /api/events/config");
      console.log("   POST /api/events/upload");
      console.log("   GET  /api/events/:sessionId");
      console.log("   POST /api/events/search");
      console.log("   GET  /api/events/:sessionId/stats");
      console.log("   GET  /api/knowledge/documents");
      console.log("   POST /api/knowledge/load-url");
      console.log("   POST /api/knowledge/upload");
      console.log("   POST /api/knowledge/load-batch");
      console.log("   POST /api/knowledge/crawl             (🕷️  Web Crawler)");
      console.log("   POST /api/knowledge/search");
      console.log("\n✨ Ready to assist with Adobe Assurance debugging!\n");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();

