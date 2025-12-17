#!/usr/bin/env node

/**
 * Automatic Batch Loader
 * 
 * Loads all URLs in batches of 5 with delays between batches.
 * Simple, reliable, with clear progress output.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const URLS_FILE = path.join(__dirname, '../docs/knowledge-base-urls.json');
const BATCH_SIZE = 5;
const BATCH_DELAY = 2000; // 2 seconds between batches

// Colors
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

async function loadBatch(urls) {
  try {
    const response = await fetch(`${SERVER_URL}/api/knowledge/load-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, delayMs: 500 }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || response.statusText);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed: ${error.message}`);
  }
}

async function main() {
  log('\n📦 Automatic Batch Loader\n', 'cyan');

  // Load URLs
  const urlsData = JSON.parse(fs.readFileSync(URLS_FILE, 'utf-8'));
  const allUrls = urlsData.urls;

  // Split into batches
  const batches = [];
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    batches.push(allUrls.slice(i, i + BATCH_SIZE));
  }

  log(`📚 Total URLs: ${allUrls.length}`, 'blue');
  log(`📦 Total batches: ${batches.length} (${BATCH_SIZE} URLs per batch)`, 'blue');
  log(`⏱️  Estimated time: ${Math.ceil((batches.length * BATCH_DELAY) / 1000 / 60)} minutes`, 'blue');
  log('');

  let totalSuccess = 0;
  let totalErrors = 0;
  let totalChunks = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    log('━'.repeat(60), 'cyan');
    log(`📦 Batch ${batchNum}/${batches.length} - Loading ${batch.length} URLs...`, 'cyan');
    log('━'.repeat(60), 'cyan');

    try {
      const result = await loadBatch(batch);

      if (result.success) {
        totalSuccess += result.results.successCount;
        totalErrors += result.results.errorCount;

        log(`✅ Success: ${result.results.successCount}/${batch.length} documents`, 'green');
        
        result.results.documents.forEach((doc) => {
          totalChunks += doc.chunkCount;
          log(`   📄 ${doc.title} (${doc.chunkCount} chunks)`, 'blue');
        });

        if (result.results.errors && result.results.errors.length > 0) {
          result.results.errors.forEach((err) => {
            log(`   ❌ ${err.source.url}: ${err.error}`, 'red');
          });
        }
      } else {
        log(`❌ Batch failed: ${result.error}`, 'red');
        totalErrors += batch.length;
      }
    } catch (error) {
      log(`❌ Error: ${error.message}`, 'red');
      totalErrors += batch.length;
    }

    // Show running total
    const percentComplete = ((totalSuccess / allUrls.length) * 100).toFixed(1);
    log(`📊 Progress: ${totalSuccess}/${allUrls.length} (${percentComplete}%) | ${totalChunks} chunks total`, 'yellow');

    // Delay before next batch (except for last batch)
    if (i < batches.length - 1) {
      log(`⏳ Waiting ${BATCH_DELAY / 1000}s before next batch...\n`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  // Final summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 FINAL SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`✅ Successfully loaded: ${totalSuccess}/${allUrls.length} documents`, 'green');
  log(`🧩 Total chunks created: ${totalChunks}`, 'blue');
  if (totalErrors > 0) {
    log(`❌ Failed: ${totalErrors} documents`, 'red');
  }
  log('='.repeat(60) + '\n', 'cyan');

  if (totalSuccess === allUrls.length) {
    log('🎉 All documents loaded successfully!', 'green');
    log('💡 Run "npm run test:rag" to verify the knowledge base\n', 'yellow');
  } else if (totalSuccess > 0) {
    log(`⚠️  Partially complete: ${totalSuccess}/${allUrls.length} documents loaded`, 'yellow');
  }
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

