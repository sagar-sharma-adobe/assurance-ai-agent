// Test script for chunked event upload
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Generate mock events
function generateMockEvents(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `event-${i}`,
    type: i % 3 === 0 ? 'Analytics' : i % 3 === 1 ? 'Lifecycle' : 'Edge',
    name: `testEvent${i}`,
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
    payload: { index: i, data: `test data for event ${i}` },
  }));
}

async function testChunkedUpload() {
  console.log('🧪 Testing Chunked Upload Implementation\n');
  console.log('=' .repeat(60));
  
  // 1. Create session
  console.log('\n📋 Step 1: Creating session...');
  const sessionRes = await fetch(`${BASE_URL}/api/session/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'test-chunked-upload' }),
  });
  const { sessionId } = await sessionRes.json();
  console.log(`✅ Session created: ${sessionId.substring(0, 16)}...`);
  
  // 2. Generate test events
  const TOTAL_EVENTS = 250; // Simulate 250 events (3 chunks of ~83 events)
  const CHUNK_SIZE = 100;
  console.log(`\n📊 Step 2: Generating ${TOTAL_EVENTS} mock events...`);
  const events = generateMockEvents(TOTAL_EVENTS);
  console.log(`✅ Generated ${events.length} events`);
  
  // 3. Upload in chunks
  const totalChunks = Math.ceil(events.length / CHUNK_SIZE);
  console.log(`\n📤 Step 3: Uploading in ${totalChunks} chunks (${CHUNK_SIZE} events per chunk)...\n`);
  
  const uploadStartTime = Date.now();
  
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
    const chunk = events.slice(i, i + CHUNK_SIZE);
    const isLast = (i + CHUNK_SIZE) >= events.length;
    
    const chunkStart = Date.now();
    
    const response = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: chunk,
        chunkInfo: {
          current: chunkNumber,
          total: totalChunks,
          isLast: isLast,
        },
      }),
    });
    
    const result = await response.json();
    const chunkTime = ((Date.now() - chunkStart) / 1000).toFixed(2);
    
    if (!result.success) {
      console.error('Response:', JSON.stringify(result, null, 2));
      throw new Error(`Chunk ${chunkNumber} failed: ${result.error}`);
    }
    
    const percentComplete = Math.round((chunkNumber / totalChunks) * 100);
    const throughput = result.performance?.eventsPerSecond || Math.round(chunk.length / parseFloat(chunkTime));
    
    console.log(
      `  ✅ Chunk ${chunkNumber}/${totalChunks} ` +
      `(${chunk.length} events) - ` +
      `${percentComplete}% complete - ` +
      `${chunkTime}s - ` +
      `~${throughput} events/sec`
    );
  }
  
  const totalUploadTime = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
  console.log(`\n✅ Upload complete in ${totalUploadTime}s`);
  
  // 4. Verify total events
  console.log(`\n📊 Step 4: Verifying event count...`);
  const eventsRes = await fetch(`${BASE_URL}/api/events/${sessionId}`);
  const { totalEvents } = await eventsRes.json();
  console.log(`✅ Total events in session: ${totalEvents}`);
  
  if (totalEvents !== TOTAL_EVENTS) {
    throw new Error(`Mismatch! Expected ${TOTAL_EVENTS}, got ${totalEvents}`);
  }
  
  // 5. Test semantic search
  console.log(`\n🔍 Step 5: Testing semantic search...`);
  const searchRes = await fetch(`${BASE_URL}/api/events/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      query: 'analytics tracking data',
      limit: 3,
    }),
  });
  const searchResult = await searchRes.json();
  console.log(`✅ Search returned ${searchResult.results.length} results`);
  if (searchResult.results[0]) {
    console.log(`   Top result: ${searchResult.results[0].metadata?.eventType || 'N/A'}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 ALL TESTS PASSED!');
  console.log('='.repeat(60));
  console.log(`\n📈 Performance Summary:`);
  console.log(`   Total events: ${TOTAL_EVENTS}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Total time: ${totalUploadTime}s`);
  console.log(`   Avg time per chunk: ${(parseFloat(totalUploadTime) / totalChunks).toFixed(2)}s`);
  console.log(`   Overall throughput: ${Math.round(TOTAL_EVENTS / parseFloat(totalUploadTime))} events/sec\n`);
}

// Run test
testChunkedUpload().catch((error) => {
  console.error('\n❌ TEST FAILED:', error.message);
  process.exit(1);
});
