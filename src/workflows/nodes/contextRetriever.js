/**
 * Context Retrieval Node
 * Retrieves relevant contexts from vector stores IN PARALLEL
 */

export async function retrieveContexts(state) {
  console.log("📚 Retrieving contexts...");
  
  const { sessionId, userMessage, intent } = state;
  
  // Import dynamically to avoid circular dependencies
  const sessionManager = (await import("../../services/sessionManager.js")).default;
  const { getVectorStore } = await import("../../services/vectorStore.js");
  
  try {
    // Parallel retrieval for speed
    const [rawEvents, rawDocs] = await Promise.all([
      // Retrieve events from session
      (async () => {
        const eventVectorStore = sessionManager.getEventVectorStore(sessionId);
        if (!eventVectorStore) return [];
        
        const { searchEvents } = await import("../../services/eventVectorStore.js");
        
        // Retrieve more for debugging, less for general
        const k = intent === "debug" ? 15 : 5;
        return await searchEvents(eventVectorStore, userMessage, k);
      })(),
      
      // Retrieve knowledge base docs
      (async () => {
        const knowledgeBase = getVectorStore();
        if (!knowledgeBase) return [];
        
        // Only retrieve docs if question seems documentation-related
        const needsDocs = intent === "general" || 
                         userMessage.toLowerCase().includes("how") ||
                         userMessage.toLowerCase().includes("what is");
        
        if (!needsDocs) return [];
        
        return await knowledgeBase.similaritySearch(userMessage, 3);
      })(),
    ]);
    
    console.log(`   ✓ Retrieved ${rawEvents.length} events, ${rawDocs.length} docs`);
    
    return {
      rawEvents,
      rawDocs,
    };
  } catch (error) {
    console.error("❌ Context retrieval failed:", error);
    return {
      rawEvents: [],
      rawDocs: [],
    };
  }
}

