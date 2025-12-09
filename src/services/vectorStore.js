/**
 * Vector Store Service
 * Handles document embeddings storage and retrieval using HNSWLib
 */

import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import fs from 'fs';
import path from 'path';
import { embeddings } from '../config/ollama.js';
import { VECTOR_STORE_PATH, DOCS_METADATA_FILE, UPLOAD_DIR } from '../config/constants.js';

// Global variable to hold the vector store instance
let vectorStore = null;

/**
 * Initialize vector store on server startup
 * Loads existing store from disk or creates a new empty one
 * 
 * Why a function? Vector store initialization is a one-time operation
 * @returns {Promise<void>}
 */
export async function initializeVectorStore() {
  try {
    console.log('🔧 Initializing Vector Store...');

    // Create directories if they don't exist
    if (!fs.existsSync(VECTOR_STORE_PATH)) {
      fs.mkdirSync(VECTOR_STORE_PATH, { recursive: true });
      console.log('   📁 Created vector_store directory');
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      console.log('   📁 Created knowledge_base/uploads directory');
    }

    // Try to load existing vector store from disk
    const vectorStorePath = path.join(VECTOR_STORE_PATH, 'docstore');

    if (fs.existsSync(vectorStorePath)) {
      try {
        vectorStore = await HNSWLib.load(vectorStorePath, embeddings);
        console.log('   ✅ Loaded existing vector store');
      } catch (error) {
        console.log('   ⚠️  Could not load existing store, creating new one');
        vectorStore = null;
      }
    }

    // If no existing store, create empty one
    if (!vectorStore) {
      vectorStore = await HNSWLib.fromTexts(
        ['Initialization document - this will be replaced when you load real documents'],
        [{ source: 'init' }],
        embeddings
      );
      console.log('   ✅ Created new empty vector store');
    }

    // Initialize metadata file if it doesn't exist
    if (!fs.existsSync(DOCS_METADATA_FILE)) {
      fs.writeFileSync(
        DOCS_METADATA_FILE,
        JSON.stringify({ documents: [] }, null, 2)
      );
      console.log('   📄 Created documents metadata file');
    }

    console.log('   ✨ Knowledge base ready!\n');
  } catch (error) {
    console.error('❌ Failed to initialize vector store:', error);
    throw error;
  }
}

/**
 * Get the current vector store instance
 * @returns {HNSWLib|null} Vector store instance or null if not initialized
 */
export function getVectorStore() {
  if (!vectorStore) {
    throw new Error('Vector store not initialized. Call initializeVectorStore() first.');
  }
  return vectorStore;
}

/**
 * Save vector store to disk
 * @returns {Promise<void>}
 */
export async function saveVectorStore() {
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }

  const vectorStorePath = path.join(VECTOR_STORE_PATH, 'docstore');
  await vectorStore.save(vectorStorePath);
  console.log('💾 Vector store saved to disk');
}

/**
 * Search for similar documents in vector store
 * @param {string} query - Search query
 * @param {number} k - Number of results to return
 * @returns {Promise<Array>} Array of similar documents
 */
export async function searchSimilarDocuments(query, k = 4) {
  if (!vectorStore) {
    throw new Error('Vector store not initialized');
  }

  const results = await vectorStore.similaritySearch(query, k);
  return results;
}

