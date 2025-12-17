/**
 * Verify Timestamp Storage
 * Quick test to confirm timestamps are saved and retrievable
 */

const SERVER_URL = 'http://localhost:3001';

async function verifyTimestamp() {
  console.log('\n⏱️  VERIFYING TIMESTAMP STORAGE\n');
  
  try {
    // 1. Create session
    console.log('1️⃣  Creating session...');
    const sessionRes = await fetch(`${SERVER_URL}/api/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'timestamp-test' })
    });
    const { sessionId } = await sessionRes.json();
    console.log('   ✅ Session:', sessionId.substring(0, 8));
    
    // 2. Upload event with known timestamp
    const testTimestamp = Date.now();
    console.log('\n2️⃣  Uploading event with timestamp:', testTimestamp);
    console.log('   Human readable:', new Date(testTimestamp).toISOString());
    
    await fetch(`${SERVER_URL}/api/events/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: [{
          uuid: 'timestamp-test',
          vendor: 'com.adobe.test',
          type: 'test',
          timestamp: testTimestamp,
          payload: {
            name: 'Timestamp verification test'
          }
        }]
      })
    });
    
    // Wait for embedding
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Search and check timestamp
    console.log('\n3️⃣  Searching and checking timestamp...');
    const searchRes = await fetch(`${SERVER_URL}/api/events/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        query: 'timestamp verification',
        k: 2
      })
    });
    
    const { results } = await searchRes.json();
    
    if (results.length > 0) {
      const event = results[0];
      
      console.log('\n✅ Event found!');
      console.log('   Metadata keys:', Object.keys(event.metadata));
      console.log('\n📊 Timestamp Details:');
      console.log('   Stored timestamp:', event.metadata.timestamp);
      console.log('   Original timestamp:', testTimestamp);
      console.log('   Match:', event.metadata.timestamp === testTimestamp ? '✅ YES' : '❌ NO');
      console.log('   Human readable:', new Date(event.metadata.timestamp).toISOString());
      console.log('   Event number:', event.metadata.eventNumber);
      
      // Check if timestamp is in rawEvent too
      if (event.rawEvent) {
        console.log('\n📦 Raw Event:');
        console.log('   Raw timestamp:', event.rawEvent.timestamp);
        console.log('   Match with original:', event.rawEvent.timestamp === testTimestamp ? '✅ YES' : '❌ NO');
      }
      
    } else {
      console.log('\n❌ No events found in search results');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

verifyTimestamp();

