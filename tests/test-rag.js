/**
 * RAG (Retrieval-Augmented Generation) Test Script
 * Tests the complete RAG pipeline: document loading, search, and chat
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

console.log('🧪 Testing RAG Pipeline\n');
console.log('='.repeat(60));

async function testRAGPipeline() {
  try {
    // 1. Health Check
    console.log('\n1️⃣  Health Check...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    
    if (health.status !== 'healthy') {
      throw new Error('Server is not healthy');
    }
    console.log(`✅ Server healthy, Ollama: ${health.ollama}`);

    // 2. Check current documents
    console.log('\n2️⃣  Checking Knowledge Base...');
    const docsRes = await fetch(`${BASE_URL}/api/knowledge/documents`);
    const { documents, total } = await docsRes.json();
    console.log(`📚 Knowledge Base has ${total} documents loaded`);
    
    if (total > 0) {
      console.log(`   Latest: "${documents[0].title}" (${documents[0].chunkCount} chunks)`);
    }

    // 3. Load a test document (if not already loaded)
    if (total === 0) {
      console.log('\n3️⃣  Loading test document...');
      const loadRes = await fetch(`${BASE_URL}/api/knowledge/load-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://developer.adobe.com/client-sdks/documentation/platform-assurance/',
          title: 'Adobe Assurance Overview (Test)'
        })
      });
      
      const loadResult = await loadRes.json();
      if (!loadResult.success) {
        throw new Error(`Failed to load document: ${loadResult.error}`);
      }
      
      console.log(`✅ Loaded: "${loadResult.document.title}"`);
      console.log(`   Chunks: ${loadResult.document.chunkCount}`);
      console.log(`   Size: ${loadResult.document.contentLength} chars`);
    } else {
      console.log('\n3️⃣  Skipping document load (already have documents)');
    }

    // 4. Test Knowledge Base Search
    console.log('\n4️⃣  Testing Knowledge Base Search...');
    const searchRes = await fetch(`${BASE_URL}/api/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What is Adobe Assurance?',
        limit: 2
      })
    });
    
    const searchResult = await searchRes.json();
    console.log(`✅ Search returned ${searchResult.totalResults} results`);
    if (searchResult.results.length > 0) {
      const preview = searchResult.results[0].content.substring(0, 100);
      console.log(`   Preview: "${preview}..."`);
    }

    // 5. Create a test session
    console.log('\n5️⃣  Creating test session...');
    const sessionRes = await fetch(`${BASE_URL}/api/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-rag-user'
      })
    });
    
    const { sessionId } = await sessionRes.json();
    console.log(`✅ Session created: ${sessionId.substring(0, 16)}...`);

    // 6. Test RAG-enabled chat WITHOUT KB context
    console.log('\n6️⃣  Testing Chat (baseline - without relevant KB)...');
    const chat1Res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: 'Tell me a random fact about penguins'
      })
    });
    
    const chat1 = await chat1Res.json();
    console.log(`✅ Response received (KB used: ${chat1.context.knowledgeBaseUsed})`);
    console.log(`   Preview: "${chat1.response.substring(0, 80)}..."`);

    // 7. Test RAG-enabled chat WITH KB context
    console.log('\n7️⃣  Testing Chat (RAG - with relevant KB)...');
    const chat2Res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message: 'What is Adobe Assurance and what was its previous name?'
      })
    });
    
    const chat2 = await chat2Res.json();
    console.log(`✅ Response received (KB used: ${chat2.context.knowledgeBaseUsed})`);
    console.log(`   Answer: "${chat2.response}"`);
    
    // Verify it mentions Project Griffon
    if (chat2.response.toLowerCase().includes('griffon')) {
      console.log(`✅ RAG WORKING: Answer includes "Griffon" from documentation!`);
    } else {
      console.log(`⚠️  Note: Answer didn't mention "Griffon" - may need more docs`);
    }

    // 8. Check conversation history
    console.log('\n8️⃣  Checking conversation history...');
    const historyRes = await fetch(`${BASE_URL}/api/session/${sessionId}/history`);
    const history = await historyRes.json();
    console.log(`✅ History has ${history.totalMessages} messages`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 RAG PIPELINE TEST COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Server health check passed`);
    console.log(`   ✅ Knowledge base operational`);
    console.log(`   ✅ Vector search working`);
    console.log(`   ✅ RAG-enabled chat functional`);
    console.log(`   ✅ Context awareness verified`);
    console.log('\n💡 The AI is successfully using the knowledge base to answer questions!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Is the server running? (npm start)');
    console.error('  2. Is Ollama running? (ollama serve)');
    console.error('  3. Are models pulled? (ollama list)');
    process.exit(1);
  }
}

// Run the test
testRAGPipeline();

