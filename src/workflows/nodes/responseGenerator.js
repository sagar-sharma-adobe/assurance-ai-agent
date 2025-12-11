/**
 * Response Generation Node
 * Generates LLM response with full context
 */

import { llm } from "../../config/ollama.js";
import { SYSTEM_PROMPT } from "../../config/constants.js";

export async function generateResponse(state) {
  console.log("🤖 Generating response...");
  
  const {
    userMessage,
    formattedEventContext,
    formattedKnowledgeContext,
    conversationHistory,
  } = state;
  
  // Build prompt with all context
  let fullPrompt = SYSTEM_PROMPT;
  
  // Add knowledge base context if available
  if (formattedKnowledgeContext) {
    fullPrompt += `\n\nRelevant documentation:\n${formattedKnowledgeContext}`;
  }
  
  // Add event context if available
  if (formattedEventContext) {
    fullPrompt += `\n\nRelevant session events:\n${formattedEventContext}`;
  }
  
  // Add conversation history
  if (conversationHistory) {
    fullPrompt += `\n\nPrevious conversation:\n${conversationHistory}`;
  } else {
    fullPrompt += `\n\nPrevious conversation:\nNo previous messages`;
  }
  
  // Add user message
  fullPrompt += `\n\nUser: ${userMessage}\n`;
  
  try {
    const aiResponse = await llm.invoke(fullPrompt);
    
    console.log(`   ✓ Response generated (${aiResponse.content.length} chars)`);
    
    return {
      response: aiResponse.content,
    };
  } catch (error) {
    console.error("❌ Response generation failed:", error);
    return {
      response: "I encountered an error generating a response. Please try again.",
    };
  }
}

