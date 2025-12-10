/**
 * Document Loader Service
 * Loads documents from various sources (URLs, PDFs, text files) for Knowledge Base
 * 
 * Supports:
 * - Web pages (HTML with Cheerio parsing)
 * - PDF files (via pdf-parse)
 * - Plain text files
 * - Markdown files
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createRequire } from 'module';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Import pdf-parse (CommonJS module)
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Load and parse a document from a URL
 * 
 * @param {string} url - URL to load
 * @returns {Promise<Object>} Parsed document with metadata
 */
export async function loadFromURL(url) {
  try {
    console.log(`📄 Loading URL: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AssuranceAI/1.0)',
      },
    });

    const contentType = response.headers['content-type'] || '';
    
    // Handle HTML content
    if (contentType.includes('text/html')) {
      const $ = cheerio.load(response.data);
      
      // Remove script, style, and navigation elements
      $('script, style, nav, header, footer, aside').remove();
      
      // Extract main content
      const title = $('title').text().trim() || url;
      const mainContent = $('main, article, .content, #content, body').first();
      const text = mainContent.length > 0 
        ? mainContent.text() 
        : $('body').text();
      
      // Clean up whitespace
      const cleanText = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      console.log(`✅ Loaded HTML: ${cleanText.length} characters`);

      return {
        content: cleanText,
        metadata: {
          source: url,
          type: 'url',
          title,
          contentType: 'text/html',
          loadedAt: new Date().toISOString(),
        },
      };
    }
    
    // Handle plain text
    if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      const text = response.data;
      console.log(`✅ Loaded text: ${text.length} characters`);
      
      return {
        content: text,
        metadata: {
          source: url,
          type: 'url',
          title: url.split('/').pop() || url,
          contentType,
          loadedAt: new Date().toISOString(),
        },
      };
    }

    throw new Error(`Unsupported content type: ${contentType}`);
    
  } catch (error) {
    console.error(`❌ Failed to load URL ${url}:`, error.message);
    throw new Error(`Failed to load URL: ${error.message}`);
  }
}

/**
 * Load and parse a PDF file
 * 
 * @param {Buffer|string} pdfData - PDF file buffer or path
 * @param {string} fileName - Original file name
 * @returns {Promise<Object>} Parsed document with metadata
 */
export async function loadFromPDF(pdfData, fileName) {
  try {
    console.log(`📄 Loading PDF: ${fileName}`);
    
    // If pdfData is a file path, read it
    const buffer = typeof pdfData === 'string' 
      ? fs.readFileSync(pdfData)
      : pdfData;

    const data = await pdfParse(buffer);
    
    // Extract text and metadata
    const text = data.text.trim();
    const pageCount = data.numpages;

    console.log(`✅ Loaded PDF: ${pageCount} pages, ${text.length} characters`);

    return {
      content: text,
      metadata: {
        source: fileName,
        type: 'pdf',
        title: fileName.replace('.pdf', ''),
        pageCount,
        loadedAt: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    console.error(`❌ Failed to load PDF ${fileName}:`, error.message);
    throw new Error(`Failed to load PDF: ${error.message}`);
  }
}

/**
 * Load text from a file
 * 
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} Parsed document with metadata
 */
export async function loadFromFile(filePath) {
  try {
    console.log(`📄 Loading file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);

    console.log(`✅ Loaded file: ${content.length} characters`);

    return {
      content,
      metadata: {
        source: filePath,
        type: ext === '.md' ? 'markdown' : 'text',
        title: fileName,
        loadedAt: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    console.error(`❌ Failed to load file ${filePath}:`, error.message);
    throw new Error(`Failed to load file: ${error.message}`);
  }
}

/**
 * Split document into chunks for embedding
 * Uses RecursiveCharacterTextSplitter for intelligent chunking
 * 
 * @param {string} content - Document content
 * @param {Object} metadata - Document metadata
 * @param {Object} options - Chunking options
 * @returns {Promise<Array>} Array of document chunks with metadata
 */
export async function chunkDocument(content, metadata, options = {}) {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
  } = options;

  console.log(`🔪 Chunking document: ${metadata.title}`);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  const chunks = await splitter.createDocuments(
    [content],
    [metadata]
  );

  console.log(`✅ Created ${chunks.length} chunks`);

  // Add chunk-specific metadata
  return chunks.map((chunk, index) => ({
    pageContent: chunk.pageContent,
    metadata: {
      ...chunk.metadata,
      chunkIndex: index,
      chunkCount: chunks.length,
    },
  }));
}

/**
 * Load and process a document from any source
 * 
 * This is the main entry point for loading documents
 * 
 * @param {Object} source - Document source info
 * @param {string} source.type - Type: 'url', 'pdf', 'text', 'file'
 * @param {string} source.url - URL (if type is 'url')
 * @param {Buffer|string} source.data - File data or path (if type is 'pdf' or 'file')
 * @param {string} source.fileName - File name (if type is 'pdf')
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed document with chunks
 */
export async function loadDocument(source, options = {}) {
  let document;

  // Load based on type
  switch (source.type) {
    case 'url':
      document = await loadFromURL(source.url);
      break;
      
    case 'pdf':
      document = await loadFromPDF(source.data, source.fileName);
      break;
      
    case 'file':
    case 'text':
    case 'markdown':
      document = await loadFromFile(source.data);
      break;
      
    default:
      throw new Error(`Unsupported source type: ${source.type}`);
  }

  // Chunk the document
  const chunks = await chunkDocument(document.content, document.metadata, options);

  // Generate unique document ID
  const documentId = uuidv4();

  return {
    id: documentId,
    title: document.metadata.title,
    source: document.metadata.source,
    type: document.metadata.type,
    metadata: document.metadata,
    chunks,
    chunkCount: chunks.length,
    contentLength: document.content.length,
  };
}

/**
 * Batch load multiple documents
 * 
 * @param {Array<Object>} sources - Array of document sources
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Array of processed documents
 */
export async function loadDocuments(sources, options = {}) {
  console.log(`📚 Loading ${sources.length} documents...`);
  
  const results = [];
  const errors = [];

  for (const source of sources) {
    try {
      const doc = await loadDocument(source, options);
      results.push(doc);
    } catch (error) {
      console.error(`❌ Failed to load document:`, error.message);
      errors.push({
        source,
        error: error.message,
      });
    }
  }

  console.log(`✅ Loaded ${results.length}/${sources.length} documents`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} documents failed to load`);
  }

  return {
    documents: results,
    errors,
    successCount: results.length,
    errorCount: errors.length,
  };
}

