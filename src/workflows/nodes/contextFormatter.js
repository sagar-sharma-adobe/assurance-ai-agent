/**
 * Context Formatting Node
 * Formats events and docs with token budget management
 */

import { formatEventsForContext } from "../../utils/eventFormatter.js";
import { estimateTokens } from "../../utils/tokenManager.js";

export async function formatContexts(state) {
  console.log("📝 Formatting contexts with token budget...");
  
  const { rawEvents, rawDocs, intent, conversationHistory, userMessage } = state;
  
  // Calculate token budget
  const TOTAL_BUDGET = 6000;
  const SYSTEM_PROMPT_TOKENS = 250;
  const USER_MESSAGE_TOKENS = estimateTokens(userMessage);
  const RESPONSE_BUFFER = 2000;
  
  const availableBudget = TOTAL_BUDGET - SYSTEM_PROMPT_TOKENS - USER_MESSAGE_TOKENS - RESPONSE_BUFFER;
  
  // Allocate budget based on intent
  let eventBudget, docBudget, historyBudget;
  
  if (intent === "debug") {
    // Debugging: Prioritize events heavily
    eventBudget = Math.floor(availableBudget * 0.6); // 60%
    historyBudget = Math.floor(availableBudget * 0.3); // 30%
    docBudget = Math.floor(availableBudget * 0.1); // 10%
  } else if (intent === "general") {
    // General: Prioritize docs
    docBudget = Math.floor(availableBudget * 0.5); // 50%
    historyBudget = Math.floor(availableBudget * 0.3); // 30%
    eventBudget = Math.floor(availableBudget * 0.2); // 20%
  } else {
    // Analytics: Balanced
    eventBudget = Math.floor(availableBudget * 0.5); // 50%
    historyBudget = Math.floor(availableBudget * 0.3); // 30%
    docBudget = Math.floor(availableBudget * 0.2); // 20%
  }
  
  // Format events with budget
  const { formatted: formattedEventContext, totalTokens: eventTokens } = 
    formatEventsForContext(rawEvents, eventBudget);
  
  // Format docs with budget
  let formattedKnowledgeContext = "";
  let docTokens = 0;
  
  for (const doc of rawDocs.slice(0, 3)) {
    const docText = `[${doc.metadata.title || doc.metadata.source}]\n${doc.pageContent}`;
    const tokens = estimateTokens(docText);
    
    if (docTokens + tokens > docBudget) break;
    
    formattedKnowledgeContext += docText + "\n\n";
    docTokens += tokens;
  }
  
  // Conversation history already formatted as string
  const historyTokens = estimateTokens(conversationHistory);
  
  const totalTokens = eventTokens + docTokens + historyTokens + SYSTEM_PROMPT_TOKENS + USER_MESSAGE_TOKENS;
  
  console.log(`   ✓ Token allocation: Events=${eventTokens}, Docs=${docTokens}, History=${historyTokens}`);
  console.log(`   ✓ Total context: ${totalTokens}/${TOTAL_BUDGET} tokens`);
  
  return {
    formattedEventContext,
    formattedKnowledgeContext,
    tokensUsed: totalTokens,
    metadata: {
      eventTokens,
      docTokens,
      historyTokens,
    },
  };
}

