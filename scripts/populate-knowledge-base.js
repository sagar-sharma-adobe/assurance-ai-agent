#!/usr/bin/env node

/**
 * Knowledge Base Population Script
 * 
 * Loads all URLs from docs/knowledge-base-urls.json into the knowledge base.
 * Useful for setting up a fresh ChromaDB instance or recovering from data loss.
 * 
 * IMPORTANT: Processes documents sequentially to avoid overwhelming ChromaDB.
 * 
 * Usage:
 *   node scripts/populate-knowledge-base.js [options]
 * 
 * Options:
 *   --batch-size   Number of URLs to load per batch (default: 5)
 *   --delay        Delay in ms between batches (default: 2000)
 *   --doc-delay    Delay in ms between documents within a batch (default: 500)
 *   --force        Force update even if URL already exists
 *   --categories   Comma-separated list of categories to load
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  batchSize: 5, // Reduced from 10 to avoid overwhelming ChromaDB
  delay: 2000, // Delay between batches
  docDelay: 500, // Delay between individual documents in a batch
  force: false,
  categories: null,
};

for (const arg of args) {
  if (arg.startsWith('--batch-size=')) {
    config.batchSize = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--delay=')) {
    config.delay = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--doc-delay=')) {
    config.docDelay = parseInt(arg.split('=')[1]);
  } else if (arg === '--force') {
    config.force = true;
  } else if (arg.startsWith('--categories=')) {
    config.categories = arg.split('=')[1].split(',');
  }
}

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const URLS_FILE = path.join(__dirname, '../docs/knowledge-base-urls.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function loadBatch(urls, forceUpdate = false, delayMs = 500) {
  try {
    const response = await fetch(`${SERVER_URL}/api/knowledge/load-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, forceUpdate, delayMs }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    log(`❌ Batch load failed: ${error.message}`, "red");
    return { success: false, error: error.message };
  }
}

async function checkServerHealth() {
  try {
    const response = await fetch(`${SERVER_URL}/api/health`);
    if (!response.ok) {
      throw new Error('Server not healthy');
    }
    return true;
  } catch (error) {
    log(`❌ Server not reachable at ${SERVER_URL}`, 'red');
    log(`   Make sure the server is running: npm start`, 'yellow');
    return false;
  }
}

async function main() {
  log('\n🕷️  Knowledge Base Population Script\n', 'cyan');

  // Check if server is running
  if (!(await checkServerHealth())) {
    process.exit(1);
  }

  // Load URLs file
  if (!fs.existsSync(URLS_FILE)) {
    log(`❌ URLs file not found: ${URLS_FILE}`, 'red');
    process.exit(1);
  }

  const urlsData = JSON.parse(fs.readFileSync(URLS_FILE, 'utf-8'));
  log(`📚 Found ${urlsData.metadata.total_documents} URLs to load`, 'blue');
  log(`📊 Expected chunks: ${urlsData.metadata.total_chunks}`, 'blue');

  // Filter by categories if specified
  let urlsToLoad = urlsData.urls;
  if (config.categories) {
    log(`\n🎯 Filtering by categories: ${config.categories.join(', ')}`, 'yellow');
    urlsToLoad = [];
    for (const category of config.categories) {
      if (urlsData.categories[category]) {
        urlsToLoad.push(...urlsData.categories[category]);
      } else {
        log(`   ⚠️  Category not found: ${category}`, 'yellow');
      }
    }
    log(`   Found ${urlsToLoad.length} URLs in selected categories`, 'blue');
  }

  if (urlsToLoad.length === 0) {
    log('❌ No URLs to load', 'red');
    process.exit(1);
  }

  // Load in batches
  const batches = [];
  for (let i = 0; i < urlsToLoad.length; i += config.batchSize) {
    batches.push(urlsToLoad.slice(i, i + config.batchSize));
  }

  log(`\n🚀 Starting load process:`, 'cyan');
  log(`   Batch size: ${config.batchSize}`, 'blue');
  log(`   Total batches: ${batches.length}`, 'blue');
  log(`   Delay between batches: ${config.delay}ms`, 'blue');
  log(`   Delay between documents: ${config.docDelay}ms`, "blue");
  log(`   Force update: ${config.force}`, 'blue');
  log('');

  let totalSuccess = 0;
  let totalErrors = 0;
  let totalChunks = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    log(`\n📦 Batch ${batchNum}/${batches.length} (${batch.length} URLs)`, 'cyan');

    const result = await loadBatch(batch, config.force, config.docDelay);

    if (result.success && result.results) {
      totalSuccess += result.results.successCount;
      totalErrors += result.results.errorCount;

      for (const doc of result.results.documents || []) {
        totalChunks += doc.chunkCount;
        const action = doc.action || 'loaded';
        const emoji = action === 'updated' ? '🔄' : action === 'skipped' ? '⏭️' : '✅';
        log(`   ${emoji} ${doc.title} (${doc.chunkCount} chunks)`, 'green');
      }

      if (result.results.errors && result.results.errors.length > 0) {
        for (const error of result.results.errors) {
          log(`   ❌ ${error.source.url}: ${error.error}`, 'red');
        }
      }
    } else {
      log(`   ❌ Batch failed: ${result.error || 'Unknown error'}`, 'red');
      totalErrors += batch.length;
    }

    // Delay before next batch (except for last batch)
    if (i < batches.length - 1) {
      log(`   ⏳ Waiting ${config.delay}ms before next batch...`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, config.delay));
    }
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`✅ Successfully loaded: ${totalSuccess} documents`, 'green');
  log(`🧩 Total chunks created: ${totalChunks}`, 'blue');
  if (totalErrors > 0) {
    log(`❌ Failed: ${totalErrors} documents`, 'red');
  }
  log('='.repeat(60) + '\n', 'cyan');

  if (totalSuccess > 0) {
    log('🎉 Knowledge base population complete!', 'green');
    log(`\n💡 Tip: Run "npm run test:rag" to verify the knowledge base\n`, 'yellow');
  }
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

