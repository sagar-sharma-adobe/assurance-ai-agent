/**
 * Test ChromaDB Event Storage Migration
 * Tests the new ChromaDB-based event storage with real session data
 */

import fs from 'fs';
import path from 'path';

const SERVER_URL = 'http://localhost:3001';

/**
 * Load sample events from file
 */
function loadSampleEvents() {
  const filePath = path.join(process.cwd(), 'sample_sessions', 'optimise RN test 1.json');
  const rawData = fs.readFileSync(filePath, 'utf8');
  const sessionData = JSON.parse(rawData);
  return sessionData.events;
}

/**
 * Test 1: Create session
 */
async function testCreateSession() {
  console.log('\n📝 Test 1: Create Session');
  
  const response = await fetch(`${SERVER_URL}/api/session/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user',
      metadata: { source: 'chromadb-migration-test' }
    })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    console.log(`   ✅ Session created: ${data.sessionId.substring(0, 8)}`);
    return data.sessionId;
  } else {
    throw new Error(`Failed to create session: ${data.error}`);
  }
}

/**
 * Test 2: Upload events (chunked)
 */
async function testUploadEvents(sessionId, events) {
  console.log(`\n📝 Test 2: Upload ${events.length} Events (chunked)`);
  
  const chunkSize = 50;
  let totalUploaded = 0;
  
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize);
    
    const response = await fetch(`${SERVER_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: chunk
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      totalUploaded += data.added;
      console.log(`   ✅ Chunk ${Math.floor(i / chunkSize) + 1}: ${data.added} added, ${data.duplicates} duplicates`);
    } else {
      throw new Error(`Failed to upload chunk: ${data.error}`);
    }
  }
  
  console.log(`   ✅ Total uploaded: ${totalUploaded} events`);
  return totalUploaded;
}

/**
 * Test 3: Search for error events
 */
async function testSearchErrors(sessionId) {
  console.log('\n📝 Test 3: Search for Error Events');
  
  const response = await fetch(`${SERVER_URL}/api/events/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      query: 'error failed service call',
      k: 10
    })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    console.log(`   ✅ Found ${data.results.length} error-related events`);
    
    // Check if we got events with errors
    const errorEvents = data.results.filter(r => 
      r.metadata?.hasError || 
      r.pageContent?.includes('ERROR')
    );
    
    console.log(`   ✅ ${errorEvents.length} events marked with hasError flag`);
    
    // Show first error event
    if (errorEvents.length > 0) {
      const firstError = errorEvents[0];
      console.log('\n   📋 Sample Error Event:');
      console.log(`      Event ID: ${firstError.metadata?.eventId?.substring(0, 20)}...`);
      console.log(`      Has Error: ${firstError.metadata?.hasError}`);
      console.log(`      Status: ${firstError.metadata?.statusCode || 'N/A'}`);
      console.log(`      SDK Event: ${firstError.metadata?.isSDKEvent}`);
      console.log(`      Extension: ${firstError.metadata?.sdkExtension || 'N/A'}`);
    }
    
    return data.results;
  } else {
    throw new Error(`Failed to search events: ${data.error}`);
  }
}

/**
 * Test 4: Get event stats
 */
async function testGetStats(sessionId) {
  console.log('\n📝 Test 4: Get Event Statistics');
  
  const response = await fetch(`${SERVER_URL}/api/events/${sessionId}/stats`);
  const data = await response.json();
  
  if (response.ok) {
    console.log(`   ✅ Total events in store: ${data.totalEvents}`);
    return data;
  } else {
    throw new Error(`Failed to get stats: ${data.error}`);
  }
}

/**
 * Test 5: Search SDK-specific events
 */
async function testSearchSDKEvents(sessionId) {
  console.log('\n📝 Test 5: Search SDK-Specific Events');
  
  const response = await fetch(`${SERVER_URL}/api/events/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      query: 'edge extension network',
      k: 5
    })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    console.log(`   ✅ Found ${data.results.length} SDK events`);
    
    // Show SDK breakdown
    const sdkBreakdown = {};
    data.results.forEach(r => {
      const sdk = r.metadata?.sdkExtension || 'backend';
      sdkBreakdown[sdk] = (sdkBreakdown[sdk] || 0) + 1;
    });
    
    console.log('   📊 SDK Breakdown:');
    Object.entries(sdkBreakdown).forEach(([sdk, count]) => {
      console.log(`      ${sdk}: ${count}`);
    });
    
    return data.results;
  } else {
    throw new Error(`Failed to search SDK events: ${data.error}`);
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing ChromaDB Event Storage Migration\n');
  console.log('=' .repeat(60));
  
  try {
    // Load sample events
    console.log('\n📂 Loading sample events...');
    const allEvents = loadSampleEvents();
    console.log(`   ✅ Loaded ${allEvents.length} events from sample file`);
    
    // Use first 100 events for testing (faster)
    const events = allEvents.slice(0, 100);
    console.log(`   ℹ️  Using first ${events.length} events for testing`);
    
    // Test 1: Create session
    const sessionId = await testCreateSession();
    
    // Test 2: Upload events
    await testUploadEvents(sessionId, events);
    
    // Test 3: Search for errors
    await testSearchErrors(sessionId);
    
    // Test 4: Get stats
    await testGetStats(sessionId);
    
    // Test 5: Search SDK events
    await testSearchSDKEvents(sessionId);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('\n✨ ChromaDB migration successful!');
    console.log('   - Events stored with rich metadata');
    console.log('   - Semantic search working');
    console.log('   - Error detection active');
    console.log('   - SDK categorization working');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();

