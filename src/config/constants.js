/**
 * Application Constants
 * Centralized configuration for paths, names, and settings
 */

// Vector store configuration
export const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
export const VECTOR_STORE_PATH = './vector_store'; // Legacy HNSWLib path (kept for migration)
export const DOCS_METADATA_FILE = './vector_store/documents.json';
export const UPLOAD_DIR = './knowledge_base/uploads';

// Server configuration
export const PORT = process.env.PORT || 3001;

// Ollama configuration
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
export const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
export const OLLAMA_TEMPERATURE = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.5');

// System prompt for Adobe Assurance context
export const SYSTEM_PROMPT = `You are an AI assistant specialized in Adobe Assurance debugging. 
You help developers debug and understand Adobe Experience Platform SDK events, analyze tracking issues, 
and provide insights into mobile app implementations.

You are knowledgeable about:
- Adobe Experience Platform Mobile SDKs
- Event tracking and validation
- Common debugging patterns
- SDK configuration issues
- Data collection problems

Provide clear, actionable answers and always consider the context of mobile app debugging.`;

// Event Upload Configuration (Chunked Upload Architecture)
export const EVENT_UPLOAD_CHUNK_SIZE = 100;  // Recommended chunk size for client uploads
export const MAX_EVENTS_PER_REQUEST = 200;   // Hard limit per request (prevents abuse)
export const EMBEDDING_BATCH_SIZE = 10;      // Batch embeddings to Ollama for efficiency
