/**
 * Direct ChromaDB Test
 * Tests ChromaDB functions directly without going through sessionManager
 */

import { createEventVectorStore, addEventsToVectorStore, searchEvents } from '../src/services/eventVectorStore.js';

async function testDirect() {
  console.log('\n🔬 DIRECT CHROMADB TEST\n');
  
  const testSessionId = 'direct-test-' + Date.now();
  
  try {
    // 1. Create vector store directly
    console.log('1️⃣  Creating ChromaDB vector store directly...');
    const vectorStore = await createEventVectorStore(testSessionId);
    console.log('   Type:', vectorStore.constructor.name);
    console.log('   Has similaritySearch:', typeof vectorStore.similaritySearch);
    
    // 2. Add one event directly
    console.log('\n2️⃣  Adding event directly...');
    await addEventsToVectorStore(vectorStore, [{
      uuid: 'direct-test',
      vendor: 'com.adobe.test',
      type: 'test',
      timestamp: Date.now(),
      payload: {
        logLevel: 'error',
        context: { status: 500 },
        messages: ['Direct test error']
      }
    }]);
    
    // 3. Search directly
    console.log('\n3️⃣  Searching directly...');
    const results = await searchEvents(vectorStore, 'error', 5);
    console.log('   Results:', results.length);
    
    if (results.length > 0) {
      const first = results[0];
      console.log('\n📋 First result:');
      console.log('   Has pageContent:', !!first.pageContent);
      console.log('   Has metadata:', !!first.metadata);
      console.log('   Has rawEvent:', !!first.rawEvent);
      
      if (first.pageContent) {
        console.log('   Content preview:', first.pageContent.substring(0, 100));
      }
      
      if (first.metadata) {
        console.log('   Metadata keys:', Object.keys(first.metadata).join(', '));
        console.log('   hasError:', first.metadata.hasError);
        console.log('   statusCode:', first.metadata.statusCode);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testDirect();

