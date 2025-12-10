/**
 * Event Deduplication Test
 * Tests that duplicate events are properly detected and skipped
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

console.log('🧪 Testing Event Deduplication\n');
console.log('='.repeat(60));

async function testDeduplication() {
  try {
    // 1. Create session
    console.log('\n1️⃣  Creating test session...');
    const sessionRes = await fetch(`${BASE_URL}/api/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test-dedup' }),
    });
    const { sessionId } = await sessionRes.json();
    console.log(`✅ Session created: ${sessionId.substring(0, 16)}...`);

    // 2. Upload initial events
    console.log('\n2️⃣  Uploading initial batch (5 events with IDs)...');
    const initialEvents = [
      { id: 'evt-1', type: 'Analytics', name: 'trackAction', data: 'first' },
      { id: 'evt-2', type: 'Lifecycle', name: 'launch', data: 'second' },
      { id: 'evt-3', type: 'Edge', name: 'sendEvent', data: 'third' },
      { id: 'evt-4', type: 'Analytics', name: 'trackState', data: 'fourth' },
      { id: 'evt-5', type: 'Lifecycle', name: 'pause', data: 'fifth' },
    ];

    const upload1Res = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, events: initialEvents }),
    });
    
    const upload1 = await upload1Res.json();
    console.log(`✅ Upload 1 result:`);
    console.log(`   Processed: ${upload1.processed}`);
    console.log(`   Added: ${upload1.added}`);
    console.log(`   Duplicates: ${upload1.duplicates}`);
    console.log(`   Total in session: ${upload1.totalEventsInSession}`);

    if (upload1.added !== 5 || upload1.duplicates !== 0) {
      throw new Error(`Expected 5 added, 0 duplicates. Got: ${upload1.added} added, ${upload1.duplicates} duplicates`);
    }

    // 3. Upload exact duplicates (same 5 events)
    console.log('\n3️⃣  Uploading EXACT duplicates (same 5 events)...');
    const upload2Res = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, events: initialEvents }),
    });
    
    const upload2 = await upload2Res.json();
    console.log(`✅ Upload 2 result:`);
    console.log(`   Processed: ${upload2.processed}`);
    console.log(`   Added: ${upload2.added}`);
    console.log(`   Duplicates: ${upload2.duplicates}`);
    console.log(`   Total in session: ${upload2.totalEventsInSession}`);

    if (upload2.added !== 0 || upload2.duplicates !== 5) {
      throw new Error(`Expected 0 added, 5 duplicates. Got: ${upload2.added} added, ${upload2.duplicates} duplicates`);
    }

    console.log(`✅ DEDUPLICATION WORKING: All 5 events detected as duplicates!`);

    // 4. Upload partial duplicates (3 old, 2 new)
    console.log('\n4️⃣  Uploading PARTIAL duplicates (3 old, 2 new)...');
    const mixedEvents = [
      { id: 'evt-1', type: 'Analytics', name: 'trackAction', data: 'duplicate' },
      { id: 'evt-2', type: 'Lifecycle', name: 'launch', data: 'duplicate' },
      { id: 'evt-6', type: 'Edge', name: 'newEvent', data: 'NEW EVENT 1' },
      { id: 'evt-3', type: 'Edge', name: 'sendEvent', data: 'duplicate' },
      { id: 'evt-7', type: 'Analytics', name: 'newEvent', data: 'NEW EVENT 2' },
    ];

    const upload3Res = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, events: mixedEvents }),
    });
    
    const upload3 = await upload3Res.json();
    console.log(`✅ Upload 3 result:`);
    console.log(`   Processed: ${upload3.processed}`);
    console.log(`   Added: ${upload3.added}`);
    console.log(`   Duplicates: ${upload3.duplicates}`);
    console.log(`   Total in session: ${upload3.totalEventsInSession}`);

    if (upload3.added !== 2 || upload3.duplicates !== 3) {
      throw new Error(`Expected 2 added, 3 duplicates. Got: ${upload3.added} added, ${upload3.duplicates} duplicates`);
    }

    console.log(`✅ PARTIAL DEDUPLICATION WORKING: 2 new added, 3 duplicates skipped!`);

    // 5. Test events without IDs (content-based deduplication)
    console.log('\n5️⃣  Testing events WITHOUT IDs (content-based hash)...');
    const noIdEvents = [
      { type: 'Test', name: 'noId1', payload: { data: 'unique1' } },
      { type: 'Test', name: 'noId2', payload: { data: 'unique2' } },
    ];

    const upload4Res = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, events: noIdEvents }),
    });
    
    const upload4 = await upload4Res.json();
    console.log(`✅ Upload 4 result (no IDs):`);
    console.log(`   Added: ${upload4.added}`);
    console.log(`   Duplicates: ${upload4.duplicates}`);

    // Upload same events again (should be detected as duplicates by content hash)
    const upload5Res = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, events: noIdEvents }),
    });
    
    const upload5 = await upload5Res.json();
    console.log(`✅ Upload 5 result (same events, no IDs):`);
    console.log(`   Added: ${upload5.added}`);
    console.log(`   Duplicates: ${upload5.duplicates}`);

    if (upload5.duplicates !== 2) {
      throw new Error(`Content-based deduplication failed. Expected 2 duplicates, got ${upload5.duplicates}`);
    }

    console.log(`✅ CONTENT-BASED DEDUPLICATION WORKING!`);

    // 6. Verify final state
    console.log('\n6️⃣  Verifying final event count...');
    const eventsRes = await fetch(`${BASE_URL}/api/events/${sessionId}`);
    const { totalEvents, events } = await eventsRes.json();
    
    console.log(`✅ Final event count: ${totalEvents}`);
    console.log(`   Expected: 9 unique events (5 + 2 + 2)`);
    
    if (totalEvents !== 9) {
      throw new Error(`Expected 9 total events, got ${totalEvents}`);
    }

    // 7. Test idempotency (chunked upload retry scenario)
    console.log('\n7️⃣  Testing idempotency (chunk retry scenario)...');
    const chunkEvents = [
      { id: 'evt-8', type: 'Analytics', name: 'chunk1' },
      { id: 'evt-9', type: 'Lifecycle', name: 'chunk1' },
    ];

    // Upload chunk 1
    const chunk1Res = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: chunkEvents,
        chunkInfo: { current: 1, total: 5, isLast: false },
      }),
    });
    const chunk1 = await chunk1Res.json();
    console.log(`   Chunk 1 (first attempt): ${chunk1.added} added`);

    // Retry chunk 1 (network failure simulation)
    const chunk1RetryRes = await fetch(`${BASE_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: chunkEvents,
        chunkInfo: { current: 1, total: 5, isLast: false },
      }),
    });
    const chunk1Retry = await chunk1RetryRes.json();
    console.log(`   Chunk 1 (retry): ${chunk1Retry.added} added, ${chunk1Retry.duplicates} duplicates`);

    if (chunk1Retry.duplicates !== 2 || chunk1Retry.added !== 0) {
      throw new Error('Idempotency failed: retry should have 0 added, 2 duplicates');
    }

    console.log(`✅ IDEMPOTENCY WORKING: Safe to retry failed chunks!`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL DEDUPLICATION TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ ID-based deduplication working`);
    console.log(`   ✅ Content-based deduplication working`);
    console.log(`   ✅ Partial duplicates handled correctly`);
    console.log(`   ✅ 100% duplicate requests handled (idempotent)`);
    console.log(`   ✅ Chunk retry scenario working`);
    console.log(`   ✅ Accurate event counts maintained`);
    console.log('\n💡 The API is now idempotent and safe to retry!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nMake sure server is running: npm start');
    process.exit(1);
  }
}

// Run test
testDeduplication();

