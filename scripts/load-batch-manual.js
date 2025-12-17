#!/usr/bin/env node

/**
 * Manual Batch Loader
 * 
 * Loads URLs in batches of 5, one batch at a time for easy monitoring.
 * Press Enter to continue to next batch, or Ctrl+C to stop.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const URLS_FILE = path.join(__dirname, '../docs/knowledge-base-urls.json');
const BATCH_SIZE = 5;

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

async function askToContinue(rl, batchNum, totalBatches) {
  return new Promise((resolve) => {
    rl.question(
      `\n${colors.yellow}Press Enter to load batch ${batchNum}/${totalBatches}, or Ctrl+C to stop...${colors.reset} `,
      () => resolve()
    );
  });
}

async function main() {
  log('\n📦 Manual Batch Loader\n', 'cyan');

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
  log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let totalSuccess = 0;
  let totalErrors = 0;
  let totalChunks = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;

    // Ask before loading (except first batch)
    if (i > 0) {
      await askToContinue(rl, batchNum, batches.length);
    }

    log('', 'reset');
    log('━'.repeat(60), 'cyan');
    log(`📦 Batch ${batchNum}/${batches.length} (${batch.length} URLs)`, 'cyan');
    log('━'.repeat(60), 'cyan');

    // Show URLs
    batch.forEach((url, idx) => {
      log(`   ${idx + 1}. ${url}`, 'blue');
    });

    log('', 'reset');
    log('⏳ Loading batch...', 'yellow');

    try {
      const result = await loadBatch(batch);

      if (result.success) {
        totalSuccess += result.results.successCount;
        totalErrors += result.results.errorCount;

        log(`✅ Batch complete: ${result.results.successCount}/${batch.length} successful`, 'green');
        
        result.results.documents.forEach((doc) => {
          totalChunks += doc.chunkCount;
          log(`   ✅ ${doc.title} (${doc.chunkCount} chunks)`, 'green');
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
    log('', 'reset');
    log(`📊 Progress: ${totalSuccess}/${allUrls.length} documents loaded, ${totalChunks} chunks`, 'blue');
  }

  rl.close();

  // Final summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 FINAL SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`✅ Successfully loaded: ${totalSuccess} documents`, 'green');
  log(`🧩 Total chunks created: ${totalChunks}`, 'blue');
  if (totalErrors > 0) {
    log(`❌ Failed: ${totalErrors} documents`, 'red');
  }
  log('='.repeat(60) + '\n', 'cyan');

  if (totalSuccess > 0) {
    log('🎉 Knowledge base population complete!', 'green');
  }
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

