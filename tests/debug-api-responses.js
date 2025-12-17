/**
 * Debug API Responses
 * Shows exact response structure from APIs
 */

const SERVER_URL = 'http://localhost:3001';

async function debugAPIs() {
  console.log('\n🔍 DEBUGGING API RESPONSES\n');
  console.log('='.repeat(70));
  
  try {
    // 1. Create session
    console.log('\n1️⃣  Creating session...');
    const sessionRes = await fetch(`${SERVER_URL}/api/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'debug-user' })
    });
    const sessionData = await sessionRes.json();
    console.log('Response:', JSON.stringify(sessionData, null, 2));
    const sessionId = sessionData.sessionId;
    
    // 2. Upload one event
    console.log('\n2️⃣  Uploading 1 event...');
    const uploadRes = await fetch(`${SERVER_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: [{
          uuid: 'test-event-1',
          vendor: 'com.adobe.edge.konductor',
          type: 'service',
          timestamp: Date.now(),
          payload: {
            logLevel: 'error',
            context: { status: 502 },
            messages: ['Test error message']
          }
        }]
      })
    });
    const uploadData = await uploadRes.json();
    console.log('Response:', JSON.stringify(uploadData, null, 2));
    
    // Wait for embedding
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Get stats
    console.log('\n3️⃣  Getting stats...');
    const statsRes = await fetch(`${SERVER_URL}/api/events/${sessionId}/stats`);
    const statsData = await statsRes.json();
    console.log('Response:', JSON.stringify(statsData, null, 2));
    
    // 4. Search
    console.log('\n4️⃣  Searching...');
    const searchRes = await fetch(`${SERVER_URL}/api/events/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        query: 'error',
        k: 2
      })
    });
    const searchData = await searchRes.json();
    console.log('Response:', JSON.stringify(searchData, null, 2));
    
    if (searchData.results && searchData.results.length > 0) {
      console.log('\n📋 First Result Details:');
      const first = searchData.results[0];
      console.log('  Has pageContent:', !!first.pageContent);
      console.log('  Has metadata:', !!first.metadata);
      console.log('  Has rawEvent:', !!first.rawEvent);
      if (first.metadata) {
        console.log('  Metadata keys:', Object.keys(first.metadata));
        console.log('  hasError:', first.metadata.hasError);
        console.log('  statusCode:', first.metadata.statusCode);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
}

debugAPIs();

