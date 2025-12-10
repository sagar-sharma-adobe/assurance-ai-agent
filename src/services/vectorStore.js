/**
 * Vector Store Service
 * Handles document embeddings storage and retrieval using ChromaDB
 * 
 * KEY IMPROVEMENT: ChromaDB supports full CRUD operations including deletion,
 * which enables proper document updates when content changes.
 */

import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import fs from "fs";
import { embeddings } from '../config/ollama.js';
import {
  CHROMA_URL,
  DOCS_METADATA_FILE,
  UPLOAD_DIR,
} from "../config/constants.js";

// Global variables
let vectorStore = null;
let chromaClient = null;
const COLLECTION_NAME = "assurance_knowledge_base";

/**
 * Initialize ChromaDB vector store on server startup
 * 
 * @returns {Promise<void>}
 */
export async function initializeVectorStore() {
  try {
    console.log("🔧 Initializing ChromaDB Vector Store...");

    // Create upload directory if it doesn't exist
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      console.log("   📁 Created knowledge_base/uploads directory");
    }

    // Initialize ChromaDB client
    chromaClient = new ChromaClient({
      path: CHROMA_URL,
    });

    // Test connection
    await chromaClient.heartbeat();
    console.log("   ✅ Connected to ChromaDB server");

    // Initialize LangChain Chroma vector store
    vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName: COLLECTION_NAME,
      url: CHROMA_URL,
    });

    console.log(`   ✅ Using collection: ${COLLECTION_NAME}`);

    // Initialize metadata file if it doesn't exist
    if (!fs.existsSync(DOCS_METADATA_FILE)) {
      fs.writeFileSync(
        DOCS_METADATA_FILE,
        JSON.stringify({ documents: [] }, null, 2)
      );
      console.log("   📄 Created documents metadata file");
    }

    console.log("   ✨ Knowledge base ready!\n");
  } catch (error) {
    console.error("❌ Failed to initialize ChromaDB vector store:", error);
    console.error(
      "   💡 Make sure ChromaDB is running: docker ps | grep chromadb"
    );
    throw error;
  }
}

/**
 * Get the current vector store instance
 * @returns {Chroma} Vector store instance
 */
export function getVectorStore() {
  if (!vectorStore) {
    throw new Error(
      "Vector store not initialized. Call initializeVectorStore() first."
    );
  }
  return vectorStore;
}

/**
 * Get the ChromaDB client
 * @returns {ChromaClient} ChromaDB client instance
 */
export function getChromaClient() {
  if (!chromaClient) {
    throw new Error("ChromaDB client not initialized.");
  }
  return chromaClient;
}

/**
 * Save vector store to disk (No-op for ChromaDB - auto-persists)
 * Kept for API compatibility
 * @returns {Promise<void>}
 */
export async function saveVectorStore() {
  // ChromaDB auto-persists, no explicit save needed
  // Keeping this function for backward compatibility
  return Promise.resolve();
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

/**
 * Delete documents by URL from vector store
 * ChromaDB enables proper document updates (delete old + add new)
 * 
 * @param {string} url - URL of document to delete
 * @returns {Promise<number>} Number of documents deleted
 */
export async function deleteDocumentsByUrl(url) {
  if (!chromaClient) {
    throw new Error('ChromaDB client not initialized');
  }

  try {
    const collection = await chromaClient.getCollection({ name: COLLECTION_NAME });
    
    // Delete all chunks with this URL in metadata
    const deleteResult = await collection.delete({
      where: { url: url }
    });

    console.log(`🗑️  Deleted chunks for URL: ${url}`);
    return deleteResult || 0;
  } catch (error) {
    console.error(`❌ Error deleting documents for URL ${url}:`, error);
    throw error;
  }
}

/**
 * Delete documents by document ID from vector store
 * 
 * @param {string} docId - Document ID to delete
 * @returns {Promise<number>} Number of documents deleted
 */
export async function deleteDocumentById(docId) {
  if (!chromaClient) {
    throw new Error('ChromaDB client not initialized');
  }

  try {
    const collection = await chromaClient.getCollection({ name: COLLECTION_NAME });
    
    // Delete all chunks with this document ID in metadata
    const deleteResult = await collection.delete({
      where: { documentId: docId }
    });

    console.log(`🗑️  Deleted chunks for document ID: ${docId}`);
    return deleteResult || 0;
  } catch (error) {
    console.error(`❌ Error deleting document ${docId}:`, error);
    throw error;
  }
}

/**
 * Get all loaded documents metadata
 * @returns {Array} Array of document metadata objects
 */
export function getLoadedDocumentsMetadata() {
  try {
    if (!fs.existsSync(DOCS_METADATA_FILE)) {
      return [];
    }
    
    const data = fs.readFileSync(DOCS_METADATA_FILE, 'utf8');
    const json = JSON.parse(data);
    return json.documents || [];
  } catch (error) {
    console.error('❌ Error reading documents metadata:', error);
    return [];
  }
}

/**
 * Add document metadata to tracking file
 * @param {Object} metadata - Document metadata to add
 */
export function addDocumentMetadata(metadata) {
  try {
    const documents = getLoadedDocumentsMetadata();
    documents.push(metadata);
    
    fs.writeFileSync(
      DOCS_METADATA_FILE,
      JSON.stringify({ documents }, null, 2)
    );
    
    console.log(`📝 Added document metadata: ${metadata.title}`);
  } catch (error) {
    console.error('❌ Error adding document metadata:', error);
    throw error;
  }
}

/**
 * Update document metadata in tracking file
 * @param {string} docId - Document ID to update
 * @param {Object} updates - Fields to update
 */
export function updateDocumentMetadata(docId, updates) {
  try {
    const documents = getLoadedDocumentsMetadata();
    const docIndex = documents.findIndex(doc => doc.id === docId);
    
    if (docIndex === -1) {
      throw new Error(`Document ${docId} not found in metadata`);
    }
    
    // Merge updates
    documents[docIndex] = {
      ...documents[docIndex],
      ...updates,
    };
    
    fs.writeFileSync(
      DOCS_METADATA_FILE,
      JSON.stringify({ documents }, null, 2)
    );
    
    console.log(`📝 Updated document metadata: ${documents[docIndex].title}`);
  } catch (error) {
    console.error('❌ Error updating document metadata:', error);
    throw error;
  }
}

/**
 * Delete document metadata from tracking file
 * @param {string} docId - Document ID to delete
 */
export function deleteDocumentMetadata(docId) {
  try {
    const documents = getLoadedDocumentsMetadata();
    const filteredDocs = documents.filter(doc => doc.id !== docId);
    
    fs.writeFileSync(
      DOCS_METADATA_FILE,
      JSON.stringify({ documents: filteredDocs }, null, 2)
    );
    
    console.log(`📝 Deleted document metadata: ${docId}`);
  } catch (error) {
    console.error('❌ Error deleting document metadata:', error);
    throw error;
  }
}

/**
 * Find document by URL in metadata
 * @param {string} url - URL to search for
 * @returns {Object|null} Document metadata or null
 */
export function findDocumentByUrl(url) {
  const documents = getLoadedDocumentsMetadata();
  return documents.find(doc => doc.url === url) || null;
}
