/**
 * Chat Service
 * Wrapper around LangGraph workflow with session management
 */

import chatWorkflow from "../workflows/chatWorkflow.js";
import sessionManager from "./sessionManager.js";

export class ChatService {
  constructor() {
    this.workflow = chatWorkflow;
  }
  
  /**
   * Process a chat message through the LangGraph workflow
   */
  async chat(sessionId, message) {
    // Validate session
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Get conversation history and format as string
    const conversationHistoryArray = sessionManager.getConversationHistory(sessionId);
    const conversationHistory = conversationHistoryArray
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n");
    
    // Invoke workflow
    console.log(`\n💬 [${sessionId.substring(0, 8)}] Processing: "${message}"`);
    
    const result = await this.workflow.invoke({
      sessionId,
      userMessage: message,
      conversationHistory,
    });
    
    // Save to session history
    sessionManager.addMessage(sessionId, "user", message);
    sessionManager.addMessage(sessionId, "assistant", result.response);
    
    console.log(`✅ [${sessionId.substring(0, 8)}] Response generated\n`);
    
    return {
      response: result.response,
      metadata: {
        intent: result.intent,
        eventContextUsed: result.formattedEventContext?.length > 0,
        knowledgeBaseUsed: result.formattedKnowledgeContext?.length > 0,
        tokensUsed: result.tokensUsed,
        ...result.metadata,
      },
    };
  }
}

// Export singleton
export default new ChatService();

