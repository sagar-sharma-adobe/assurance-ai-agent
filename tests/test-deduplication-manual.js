#!/usr/bin/env node

/**
 * Manual Deduplication Test
 * 
 * Tests the knowledge base deduplication logic:
 * 1. Load a URL for the first time (should succeed)
 * 2. Load the same URL again (should skip - unchanged)
 * 3. Force update the same URL (should update)
 * 4. Verify metadata tracking
 */

const SERVER_URL = 'http://localhost:3001';
const TEST_URL = 'https://developer.adobe.com/client-sdks/documentation/getting-started/';

// Colors for output
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

async function checkHealth() {
  try {
    const response = await fetch(`${SERVER_URL}/api/health`);
    if (!response.ok) throw new Error('Server not healthy');
    log('✅ Server is running\n', 'green');
    return true;
  } catch (error) {
    log('❌ Server not reachable at ' + SERVER_URL, 'red');
    log('   Start the server: npm start\n', 'yellow');
    return false;
  }
}

async function getDocuments() {
  const response = await fetch(`${SERVER_URL}/api/knowledge/documents`);
  if (!response.ok) throw new Error('Failed to get documents');
  return await response.json();
}

async function loadUrl(url, forceUpdate = false) {
  const response = await fetch(`${SERVER_URL}/api/knowledge/load-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, forceUpdate }),
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

async function runTest() {
  log('🧪 Knowledge Base Deduplication Test\n', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Check server
  if (!(await checkHealth())) {
    process.exit(1);
  }
  
  // Get initial document count
  log('📊 Step 1: Check initial state', 'cyan');
  const initialDocs = await getDocuments();
  log(`   Current documents: ${initialDocs.total}`, 'blue');
  
  // Find if test URL already exists
  const existingDoc = initialDocs.documents.find(doc => doc.url === TEST_URL);
  if (existingDoc) {
    log(`   ⚠️  Test URL already exists in KB`, 'yellow');
    log(`      ID: ${existingDoc.id}`, 'yellow');
    log(`      Title: ${existingDoc.title}`, 'yellow');
    log(`      Chunks: ${existingDoc.chunkCount}`, 'yellow');
    log(`      Hash: ${existingDoc.contentHash?.substring(0, 12)}...`, 'yellow');
  } else {
    log(`   ✅ Test URL not in KB (clean slate)`, 'green');
  }
  
  // Test 1: Load URL for the first time (or if it exists, this serves as baseline)
  log('\n📥 Step 2: Load test URL', 'cyan');
  log(`   URL: ${TEST_URL}`, 'blue');
  
  const result1 = await loadUrl(TEST_URL, false);
  log(`   Action: ${result1.action}`, result1.action === 'created' ? 'green' : 'yellow');
  log(`   Title: ${result1.document.title}`, 'blue');
  log(`   Chunks: ${result1.document.chunkCount}`, 'blue');
  
  if (result1.action === 'skipped') {
    log(`   ℹ️  Document was unchanged (expected if already loaded)`, 'yellow');
  } else if (result1.action === 'updated') {
    log(`   ✅ Document was updated (content changed)`, 'green');
  } else if (result1.action === 'created') {
    log(`   ✅ Document loaded successfully (first time)`, 'green');
  }
  
  const firstLoadId = result1.document.id;
  const firstLoadChunks = result1.document.chunkCount;
  
  // Test 2: Load the same URL again (should skip - unchanged content)
  log('\n🔄 Step 3: Load same URL again (should skip)', 'cyan');
  
  const result2 = await loadUrl(TEST_URL, false);
  log(`   Action: ${result2.action}`, 'blue');
  
  if (result2.action === 'skipped') {
    log(`   ✅ PASS: URL deduplication works!`, 'green');
    log(`      Content unchanged, skipped loading`, 'green');
  } else {
    log(`   ⚠️  UNEXPECTED: Expected 'skipped' but got '${result2.action}'`, 'yellow');
    if (result2.changes) {
      log(`      Old hash: ${result2.changes.oldHash}`, 'yellow');
      log(`      New hash: ${result2.changes.newHash}`, 'yellow');
    }
  }
  
  // Test 3: Force update the same URL
  log('\n🔨 Step 4: Force update same URL', 'cyan');
  
  const result3 = await loadUrl(TEST_URL, true);
  log(`   Action: ${result3.action}`, 'blue');
  
  if (result3.action === 'updated' || result3.action === 'created') {
    log(`   ✅ PASS: Force update works!`, 'green');
    log(`      Document was reloaded despite unchanged content`, 'green');
  } else {
    log(`   ❌ FAIL: Force update didn't work (got '${result3.action}')`, 'red');
  }
  
  // Test 4: Verify document count
  log('\n📊 Step 5: Verify final state', 'cyan');
  
  const finalDocs = await getDocuments();
  log(`   Total documents: ${finalDocs.total}`, 'blue');
  
  const finalDoc = finalDocs.documents.find(doc => doc.url === TEST_URL);
  if (finalDoc) {
    log(`   ✅ Test document exists in KB`, 'green');
    log(`      ID: ${finalDoc.id}`, 'blue');
    log(`      Title: ${finalDoc.title}`, 'blue');
    log(`      Chunks: ${finalDoc.chunkCount}`, 'blue');
    log(`      Hash: ${finalDoc.contentHash?.substring(0, 12)}...`, 'blue');
    log(`      Status: ${finalDoc.status}`, 'blue');
    
    // Verify ID didn't change
    if (finalDoc.id === firstLoadId) {
      log(`   ✅ Document ID preserved across updates`, 'green');
    } else {
      log(`   ⚠️  Document ID changed (unexpected)`, 'yellow');
      log(`      Initial ID: ${firstLoadId}`, 'yellow');
      log(`      Final ID: ${finalDoc.id}`, 'yellow');
    }
  } else {
    log(`   ❌ FAIL: Test document not found in KB`, 'red');
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const tests = [
    { name: 'Initial load', pass: result1.action === 'created' || result1.action === 'skipped' || result1.action === 'updated' },
    { name: 'Duplicate detection (skip unchanged)', pass: result2.action === 'skipped' },
    { name: 'Force update', pass: result3.action === 'updated' || result3.action === 'created' },
    { name: 'Metadata tracking', pass: !!finalDoc },
    { name: 'ID preservation', pass: finalDoc && finalDoc.id === firstLoadId },
  ];
  
  const passed = tests.filter(t => t.pass).length;
  const failed = tests.filter(t => !t.pass).length;
  
  tests.forEach(test => {
    const status = test.pass ? '✅ PASS' : '❌ FAIL';
    const color = test.pass ? 'green' : 'red';
    log(`${status}: ${test.name}`, color);
  });
  
  log('='.repeat(60), 'cyan');
  log(`\n${passed}/${tests.length} tests passed`, passed === tests.length ? 'green' : 'yellow');
  
  if (passed === tests.length) {
    log('\n🎉 All deduplication tests passed!', 'green');
    log('   Knowledge base is ready for population.\n', 'green');
  } else {
    log(`\n⚠️  ${failed} test(s) failed - review the logic`, 'yellow');
    process.exit(1);
  }
}

runTest().catch(error => {
  log(`\n❌ Test failed with error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

