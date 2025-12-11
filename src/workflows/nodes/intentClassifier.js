/**
 * Intent Classification Node
 * Determines what the user is trying to do
 */

import { llm } from "../../config/ollama.js";

const INTENT_PROMPT = `Classify the user's intent into one of these categories:
- "debug": User is debugging an issue (crash, error, unexpected behavior)
- "analytics": User wants analytics/event analysis
- "general": General questions about SDK/documentation

User message: "{message}"

Respond with ONLY ONE WORD: debug, analytics, or general`;

export async function classifyIntent(state) {
  console.log("🧠 Classifying user intent...");
  
  try {
    const prompt = INTENT_PROMPT.replace("{message}", state.userMessage);
    const response = await llm.invoke(prompt);
    const intent = response.content.toLowerCase().trim();
    
    // Validate intent
    const validIntents = ["debug", "analytics", "general"];
    const finalIntent = validIntents.includes(intent) ? intent : "general";
    
    console.log(`   ✓ Intent: ${finalIntent}`);
    
    return {
      intent: finalIntent,
    };
  } catch (error) {
    console.warn("⚠️  Intent classification failed, defaulting to general");
    return { intent: "general" };
  }
}

