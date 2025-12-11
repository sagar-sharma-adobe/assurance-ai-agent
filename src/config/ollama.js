/**
 * Ollama Configuration Module
 * Initializes LLM and embeddings models
 */

import { ChatOllama } from '@langchain/ollama';
import { OllamaEmbeddings } from '@langchain/ollama';
import { 
  OLLAMA_BASE_URL, 
  OLLAMA_MODEL, 
  OLLAMA_EMBEDDING_MODEL,
  OLLAMA_TEMPERATURE 
} from './constants.js';

/**
 * Initialize Chat LLM
 * @returns {ChatOllama} Configured ChatOllama instance
 */
export function createLLM() {
  return new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: OLLAMA_MODEL,
    temperature: OLLAMA_TEMPERATURE,
  });
}

/**
 * Initialize Embeddings Model
 * @returns {OllamaEmbeddings} Configured embeddings instance
 */
export function createEmbeddings() {
  return new OllamaEmbeddings({
    baseUrl: OLLAMA_BASE_URL,
    model: OLLAMA_EMBEDDING_MODEL,
  });
}

// Create singleton instances (created once, reused everywhere)
export const llm = createLLM();
export const embeddings = createEmbeddings();

/**
 * Warm up the embedding model to avoid cold start delay (35s) on first request
 * This runs asynchronously on server startup
 */
export async function warmupEmbeddingModel() {
  try {
    console.log(`🔥 Warming up embedding model: ${OLLAMA_EMBEDDING_MODEL}...`);
    const startTime = Date.now();
    
    // Make a dummy embedding request to load the model into memory
    await embeddings.embedQuery("warmup");
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`   ✅ Embedding model ready (${duration}s)`);
  } catch (error) {
    console.warn(`   ⚠️  Failed to warm up embedding model:`, error.message);
    console.warn(`   First embedding request will take ~30s to load model`);
  }
}

