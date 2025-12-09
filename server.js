/**
 * Server Entry Point
 * Initializes and starts the Adobe Assurance AI Agent server
 */

import dotenv from 'dotenv';
import { createApp } from './src/app.js';
import { initializeVectorStore } from './src/services/vectorStore.js';
import { PORT, OLLAMA_MODEL, OLLAMA_EMBEDDING_MODEL } from './src/config/constants.js';

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
    console.log('\n🚀 Starting Adobe Assurance AI Agent Server...\n');

    // Step 1: Initialize vector store
    await initializeVectorStore();

    // Step 2: Create and configure Express app
    const app = createApp();

    // Step 3: Start listening
    app.listen(PORT, () => {
      console.log('🚀 Adobe Assurance AI Agent Server');
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`🤖 Ollama Model: ${OLLAMA_MODEL}`);
      console.log(`🔮 Embedding Model: ${OLLAMA_EMBEDDING_MODEL}`);
      console.log('\n📝 Available endpoints:');
      console.log('   GET  /api/health');
      console.log('   POST /api/session/init');
      console.log('   POST /api/chat');
      console.log('   GET  /api/session/:sessionId/history');
      console.log('   GET  /api/sessions');
      console.log('\n✨ Ready to assist with Adobe Assurance debugging!\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

