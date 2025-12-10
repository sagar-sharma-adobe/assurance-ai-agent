/**
 * Knowledge Base Routes
 * API endpoints for managing the knowledge base (RAG implementation)
 * 
 * Features:
 * - Load documents from URLs
 * - Upload PDF/text files
 * - List loaded documents
 * - Search knowledge base
 * - Delete documents
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from "crypto";
import { loadDocument, loadDocuments } from "../services/documentLoader.js";
import {
  getVectorStore,
  getLoadedDocumentsMetadata,
  addDocumentMetadata,
  saveVectorStore,
  findDocumentByUrl,
  deleteDocumentsByUrl,
  updateDocumentMetadata,
} from "../services/vectorStore.js";
import { UPLOAD_DIR } from "../config/constants.js";
import fs from "fs";

const router = express.Router();

/**
 * Generate content hash for deduplication
 * @param {string} content - Document content
 * @returns {string} SHA-256 hash
 */
function generateContentHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".pdf", ".txt", ".md"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Unsupported file type. Allowed: ${allowedTypes.join(", ")}`)
      );
    }
  },
});

/**
 * GET /api/knowledge/documents
 * List all loaded documents in the knowledge base
 */
router.get("/documents", (req, res) => {
  try {
    const documents = getLoadedDocumentsMetadata();

    res.json({
      success: true,
      documents,
      total: documents.length,
    });
  } catch (error) {
    console.error("❌ Error listing documents:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge/load-url
 * Load or update a document from a URL
 *
 * Features:
 * - URL-based deduplication (checks if URL already loaded)
 * - Content-hash comparison (detects if content changed)
 * - Automatic update (replaces old chunks with new ones)
 *
 * Body: {
 *   url: string,
 *   title?: string,
 *   chunkSize?: number,
 *   chunkOverlap?: number,
 *   forceUpdate?: boolean  // Force update even if content hash matches
 * }
 */
router.post("/load-url", async (req, res) => {
  const { url, title, chunkSize, chunkOverlap, forceUpdate = false } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "url is required",
    });
  }

  try {
    console.log(`📥 Loading document from URL: ${url}`);

    // Load and chunk document
    const document = await loadDocument(
      { type: "url", url },
      { chunkSize, chunkOverlap }
    );

    // Override title if provided
    if (title) {
      document.title = title;
      document.metadata.title = title;
    }

    // Generate content hash for deduplication
    const contentHash = generateContentHash(document.content);

    // Check if URL already exists
    const existingDoc = findDocumentByUrl(url);

    if (existingDoc) {
      // URL exists - check if content changed
      if (
        !forceUpdate &&
        existingDoc.contentHash &&
        existingDoc.contentHash === contentHash
      ) {
        console.log(`ℹ️  Document unchanged: ${document.title}`);
        return res.json({
          success: true,
          message: "Document unchanged (no update needed)",
          action: "skipped",
          document: {
            id: existingDoc.id,
            title: existingDoc.title,
            source: url,
            chunkCount: existingDoc.chunkCount,
            contentLength: existingDoc.contentLength,
            loadedAt: existingDoc.loadedAt,
          },
        });
      }

      // Content changed or no hash exists (legacy document) - update document
      console.log(`🔄 Updating document: ${document.title}`);
      if (existingDoc.contentHash) {
        console.log(
          `   Old hash: ${existingDoc.contentHash.substring(0, 12)}...`
        );
      } else {
        console.log(`   Old hash: N/A (legacy document)`);
      }
      console.log(`   New hash: ${contentHash.substring(0, 12)}...`);

      // Delete old chunks from vector store
      await deleteDocumentsByUrl(url);

      // Add new chunks
      const vectorStore = getVectorStore();
      await vectorStore.addDocuments(document.chunks);

      // Update metadata
      updateDocumentMetadata(existingDoc.id, {
        title: document.title,
        contentHash,
        chunkCount: document.chunkCount,
        contentLength: document.contentLength,
        updatedAt: new Date().toISOString(),
        status: "updated",
      });

      console.log(
        `✅ Document updated: ${document.title} (${document.chunkCount} chunks)`
      );

      return res.json({
        success: true,
        message: "Document updated (content changed)",
        action: "updated",
        document: {
          id: existingDoc.id,
          title: document.title,
          source: url,
          chunkCount: document.chunkCount,
          contentLength: document.contentLength,
          updatedAt: new Date().toISOString(),
        },
        changes: {
          oldHash: existingDoc.contentHash
            ? existingDoc.contentHash.substring(0, 12)
            : "N/A",
          newHash: contentHash.substring(0, 12),
          oldChunks: existingDoc.chunkCount,
          newChunks: document.chunkCount,
        },
      });
    }

    // New URL - load fresh
    console.log(`✨ New document: ${document.title}`);

    // Add to vector store
    const vectorStore = getVectorStore();
    await vectorStore.addDocuments(document.chunks);

    // Track document metadata
    addDocumentMetadata({
      id: document.id,
      type: "url",
      title: document.title,
      url,
      contentHash,
      loadedAt: new Date().toISOString(),
      chunkCount: document.chunkCount,
      contentLength: document.contentLength,
      status: "loaded",
    });

    console.log(
      `✅ Document loaded: ${document.title} (${document.chunkCount} chunks)`
    );

    res.json({
      success: true,
      message: "Document loaded successfully",
      action: "created",
      document: {
        id: document.id,
        title: document.title,
        source: url,
        chunkCount: document.chunkCount,
        contentLength: document.contentLength,
      },
    });
  } catch (error) {
    console.error("❌ Error loading URL:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge/upload
 * Upload and load a document file (PDF, TXT, MD)
 * 
 * Multipart form data with 'document' field
 */
router.post('/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded. Use "document" field in form data.',
    });
  }

  try {
    const { originalname, filename, path: filePath, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    console.log(`📥 Processing uploaded file: ${originalname}`);

    // Determine document type
    let documentType = 'text';
    if (ext === '.pdf') documentType = 'pdf';
    else if (ext === '.md') documentType = 'markdown';

    // Load and chunk document
    const document = await loadDocument(
      { 
        type: documentType === 'pdf' ? 'pdf' : 'file',
        data: documentType === 'pdf' ? filePath : filePath,
        fileName: originalname,
      },
      {
        chunkSize: parseInt(req.body.chunkSize) || 1000,
        chunkOverlap: parseInt(req.body.chunkOverlap) || 200,
      }
    );

    // Add to vector store
    const vectorStore = getVectorStore();
    await vectorStore.addDocuments(document.chunks);

    // Save vector store to disk
    await saveVectorStore();

    // Track document metadata
    addDocumentMetadata({
      id: document.id,
      type: documentType,
      title: document.title,
      fileName: originalname,
      filePath: filename, // Stored filename
      fileSize: size,
      loadedAt: new Date().toISOString(),
      chunkCount: document.chunkCount,
      contentLength: document.contentLength,
      status: 'loaded',
    });

    console.log(`✅ File loaded: ${document.title} (${document.chunkCount} chunks)`);

    res.json({
      success: true,
      message: 'File uploaded and loaded successfully',
      document: {
        id: document.id,
        title: document.title,
        fileName: originalname,
        type: documentType,
        chunkCount: document.chunkCount,
        contentLength: document.contentLength,
        fileSize: size,
      },
    });

  } catch (error) {
    console.error('❌ Error uploading file:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge/load-batch
 * Load multiple documents from URLs in batch
 * 
 * Body: {
 *   urls: string[],
 *   chunkSize?: number,
 *   chunkOverlap?: number
 * }
 */
router.post('/load-batch', async (req, res) => {
  const { urls, chunkSize, chunkOverlap } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'urls array is required and must not be empty',
    });
  }

  try {
    console.log(`📥 Batch loading ${urls.length} documents...`);

    const sources = urls.map(url => ({ type: 'url', url }));
    const result = await loadDocuments(sources, { chunkSize, chunkOverlap });

    // Add successful documents to vector store
    const vectorStore = getVectorStore();
    for (const doc of result.documents) {
      await vectorStore.addDocuments(doc.chunks);
      
      addDocumentMetadata({
        id: doc.id,
        type: 'url',
        title: doc.title,
        url: doc.source,
        loadedAt: new Date().toISOString(),
        chunkCount: doc.chunkCount,
        contentLength: doc.contentLength,
        status: 'loaded',
      });
    }

    // Save vector store
    await saveVectorStore();

    console.log(`✅ Batch load complete: ${result.successCount}/${urls.length} successful`);

    res.json({
      success: true,
      message: `Loaded ${result.successCount}/${urls.length} documents`,
      results: {
        successCount: result.successCount,
        errorCount: result.errorCount,
        documents: result.documents.map(d => ({
          id: d.id,
          title: d.title,
          source: d.source,
          chunkCount: d.chunkCount,
        })),
        errors: result.errors,
      },
    });

  } catch (error) {
    console.error('❌ Error batch loading:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/knowledge/search
 * Search the knowledge base
 * 
 * Body: {
 *   query: string,
 *   limit?: number (default: 5)
 * }
 */
router.post('/search', async (req, res) => {
  const { query, limit = 5 } = req.body;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'query is required',
    });
  }

  try {
    const vectorStore = getVectorStore();
    const results = await vectorStore.similaritySearch(query, limit);

    res.json({
      success: true,
      query,
      results: results.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata,
      })),
      totalResults: results.length,
    });

  } catch (error) {
    console.error('❌ Error searching knowledge base:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

