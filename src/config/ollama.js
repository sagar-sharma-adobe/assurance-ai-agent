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

