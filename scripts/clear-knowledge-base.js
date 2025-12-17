#!/usr/bin/env node

/**
 * Clear Knowledge Base Script
 * 
 * Clears all documents from the ChromaDB collection and metadata file.
 * Use this when you want to start fresh and repopulate the knowledge base.
 * 
 * Usage:
 *   node scripts/clear-knowledge-base.js
 */

import { ChromaClient } from 'chromadb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const COLLECTION_NAME = 'assurance_knowledge_base';
const METADATA_FILE = path.join(__dirname, '../vector_store/documents.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function clearKnowledgeBase() {
  try {
    log('\n🗑️  Knowledge Base Clearing Script\n', 'cyan');

    // Initialize ChromaDB client
    const chromaClient = new ChromaClient({
      path: CHROMA_URL,
    });

    // Test connection
    log('📡 Connecting to ChromaDB...', 'yellow');
    await chromaClient.heartbeat();
    log('   ✅ Connected to ChromaDB\n', 'green');

    // Delete the collection
    log(`🗑️  Deleting collection: ${COLLECTION_NAME}`, 'yellow');
    try {
      await chromaClient.deleteCollection({ name: COLLECTION_NAME });
      log('   ✅ Collection deleted', 'green');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        log('   ℹ️  Collection does not exist (already empty)', 'yellow');
      } else {
        throw error;
      }
    }

    // Recreate empty collection
    log('\n📦 Recreating empty collection...', 'yellow');
    await chromaClient.createCollection({ name: COLLECTION_NAME });
    log('   ✅ Empty collection created', 'green');

    // Clear metadata file
    log('\n📄 Clearing metadata file...', 'yellow');
    if (fs.existsSync(METADATA_FILE)) {
      fs.writeFileSync(
        METADATA_FILE,
        JSON.stringify({ documents: [] }, null, 2)
      );
      log('   ✅ Metadata file cleared', 'green');
    } else {
      log('   ℹ️  Metadata file does not exist', 'yellow');
    }

    log('\n' + '='.repeat(60), 'cyan');
    log('✅ Knowledge base cleared successfully!', 'green');
    log('='.repeat(60), 'cyan');
    log('\n💡 Next steps:', 'yellow');
    log('   1. Restart the server: npm start', 'cyan');
    log('   2. Populate the knowledge base: npm run kb:populate\n', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

clearKnowledgeBase();

