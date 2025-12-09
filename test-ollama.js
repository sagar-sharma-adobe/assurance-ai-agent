import { ChatOllama } from '@langchain/ollama';
import dotenv from 'dotenv';

dotenv.config();

async function testOllama() {
  console.log('🧪 Testing Ollama connection...\n');
  
  const llm = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
    temperature: 0.1,
  });

  try {
    console.log(`📡 Connecting to: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`);
    console.log(`🤖 Using model: ${process.env.OLLAMA_MODEL || 'llama3.1:8b'}\n`);
    
    const response = await llm.invoke(
      "Explain what Adobe Experience Platform is in one sentence."
    );
    
    console.log('✅ Ollama is working!\n');
    console.log('Response:', response);
    console.log('\n✨ Success! LangChain can communicate with Ollama.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure Ollama is running: ollama serve');
    console.log('   2. Check if model is downloaded: ollama list');
    console.log('   3. Verify OLLAMA_BASE_URL in .env');
  }
}

testOllama();