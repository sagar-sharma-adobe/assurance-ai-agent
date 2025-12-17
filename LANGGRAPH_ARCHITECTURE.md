# LangGraph Architecture for Assurance AI Agent

## Why LangGraph is Perfect for Debugging

### Traditional Chatbot (Simple)
```
User Message → Retrieve Context → LLM → Response
```

### Debugging Assistant (Complex)
```
User: "Why did the app crash?"
   ↓
┌──────────────────────────────────────┐
│ 1. Classify Intent                   │
│    → Debugging vs General Question   │
└─────────────┬────────────────────────┘
              ↓
    ┌─────────┴─────────┐
    │                   │
    v                   v
[Debug Flow]      [General Flow]
    │                   │
    v                   │
┌─────────────────┐    │
│ 2. Find Errors  │    │
│    (Event Search)│   │
└────────┬────────┘    │
         ↓             │
┌─────────────────┐    │
│ 3. Analyze      │    │
│    Timeline     │    │
└────────┬────────┘    │
         ↓             │
┌─────────────────┐    │
│ 4. Check State  │    │
└────────┬────────┘    │
         ↓             │
┌─────────────────┐    │
│ 5. Synthesize   │◄───┘
│    Diagnosis    │
└─────────────────┘
```

This is **exactly** what LangGraph enables!

---

## LangGraph Core Concepts

### 1. State
```javascript
// State flows through the entire graph
const GraphState = {
  // Input
  sessionId: string,
  userMessage: string,
  
  // Context
  eventContext: Array<Event>,
  knowledgeContext: Array<Doc>,
  conversationHistory: Array<Message>,
  
  // Analysis
  intent: "debug" | "general" | "analytics",
  errorEvents: Array<Event>,
  timeline: Array<Event>,
  
  // Output
  response: string,
  suggestions: Array<string>,
  
  // Metadata
  tokensUsed: number,
  eventsAnalyzed: number,
};
```

### 2. Nodes (Processing Steps)
Each node does ONE thing:
- `classifyIntent` - Determine what user wants
- `retrieveEvents` - Search event vector store
- `retrieveKnowledge` - Search knowledge base
- `analyzeErrors` - Find error patterns
- `buildTimeline` - Order events chronologically
- `generateResponse` - Create answer
- `formatResponse` - Make it pretty

### 3. Edges (Flow Control)
- **Conditional**: Route based on state
- **Parallel**: Run multiple nodes simultaneously
- **Sequential**: One after another

---

## Full Implementation

### Directory Structure
```
src/
├── workflows/
│   ├── chatWorkflow.js          # Main LangGraph workflow
│   ├── nodes/
│   │   ├── intentClassifier.js  # Classify user intent
│   │   ├── contextRetriever.js  # Retrieve contexts in parallel
│   │   ├── errorAnalyzer.js     # Debug-specific analysis
│   │   ├── responseGenerator.js # LLM response generation
│   │   └── responseFormatter.js # Format for UI
│   └── state.js                 # State schema
├── services/
│   └── chatService.js           # Service wrapper
└── utils/
    ├── eventFormatter.js        # Assurance-specific formatting
    └── tokenManager.js          # Token budget management
```

---

## Step-by-Step Implementation

### Step 1: Define State Schema

**File**: `src/workflows/state.js`

```javascript
/**
 * State Schema for Chat Workflow
 * Defines what data flows through the graph
 */

export const GraphState = {
  // === INPUT ===
  sessionId: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  userMessage: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  
  // === CONTEXT ===
  rawEvents: {
    value: (x, y) => y ?? x,
    default: () => [],
  },
  rawDocs: {
    value: (x, y) => y ?? x,
    default: () => [],
  },
  conversationHistory: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
  
  // === ANALYSIS ===
  intent: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  formattedEventContext: {
    value: (x, y) => y ?? x,
    default: () => "",
  },
  formattedKnowledgeContext: {
    value: (x, y) => y ?? x,
    default: () => "",
  },
  errorEvents: {
    value: (x, y) => y ?? x,
    default: () => [],
  },
  
  // === OUTPUT ===
  response: {
    value: (x, y) => y ?? x,
    default: () => null,
  },
  metadata: {
    value: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  },
  
  // === INTERNAL ===
  tokensUsed: {
    value: (x, y) => y ?? x,
    default: () => 0,
  },
};

export default GraphState;
```

---

### Step 2: Create Workflow Nodes

**File**: `src/workflows/nodes/intentClassifier.js`

```javascript
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
```

---

**File**: `src/workflows/nodes/contextRetriever.js`

```javascript
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
```

---

**File**: `src/workflows/nodes/errorAnalyzer.js`

```javascript
/**
 * Error Analysis Node (Debug Flow Only)
 * Finds error/crash events and analyzes patterns
 */

export async function analyzeErrors(state) {
  console.log("🔍 Analyzing errors...");
  
  const { rawEvents } = state;
  
  // Filter for error-related events
  const errorEvents = rawEvents.filter(event => {
    const content = event.pageContent.toLowerCase();
    const metadata = event.metadata;
    
    return (
      content.includes("error") ||
      content.includes("crash") ||
      content.includes("exception") ||
      content.includes("failed") ||
      metadata.eventType?.toLowerCase().includes("error")
    );
  });
  
  console.log(`   ✓ Found ${errorEvents.length} error-related events`);
  
  // Build timeline of events leading to error
  const timeline = rawEvents
    .sort((a, b) => {
      const timeA = new Date(a.metadata.timestamp || 0);
      const timeB = new Date(b.metadata.timestamp || 0);
      return timeA - timeB;
    })
    .slice(-10); // Last 10 events
  
  return {
    errorEvents,
    metadata: {
      hasErrors: errorEvents.length > 0,
      errorCount: errorEvents.length,
      timelineLength: timeline.length,
    },
  };
}
```

---

**File**: `src/workflows/nodes/contextFormatter.js`

```javascript
/**
 * Context Formatting Node
 * Formats events and docs with token budget management
 */

import { formatEventsForContext } from "../../utils/eventFormatter.js";
import { estimateTokens } from "../../utils/tokenManager.js";

export async function formatContexts(state) {
  console.log("📝 Formatting contexts with token budget...");
  
  const { rawEvents, rawDocs, intent, conversationHistory } = state;
  
  // Calculate token budget
  const TOTAL_BUDGET = 10000;
  const SYSTEM_PROMPT_TOKENS = 500;
  const USER_MESSAGE_TOKENS = estimateTokens(state.userMessage);
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
  
  // Format conversation history with budget
  let formattedHistory = "";
  let historyTokens = 0;
  
  const reversedHistory = [...conversationHistory].reverse(); // Most recent first
  for (const msg of reversedHistory) {
    const msgText = `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
    const tokens = estimateTokens(msgText);
    
    if (historyTokens + tokens > historyBudget) break;
    
    formattedHistory = msgText + formattedHistory; // Prepend to maintain order
    historyTokens += tokens;
  }
  
  const totalTokens = eventTokens + docTokens + historyTokens + SYSTEM_PROMPT_TOKENS + USER_MESSAGE_TOKENS;
  
  console.log(`   ✓ Token allocation: Events=${eventTokens}, Docs=${docTokens}, History=${historyTokens}`);
  console.log(`   ✓ Total context: ${totalTokens}/${TOTAL_BUDGET} tokens`);
  
  return {
    formattedEventContext,
    formattedKnowledgeContext,
    conversationHistory: formattedHistory,
    tokensUsed: totalTokens,
    metadata: {
      eventTokens,
      docTokens,
      historyTokens,
    },
  };
}
```

---

**File**: `src/workflows/nodes/responseGenerator.js`

```javascript
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
    intent,
    metadata,
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
  
  // Add error analysis for debug intent
  if (intent === "debug" && metadata.hasErrors) {
    fullPrompt += `\n\n⚠️ ${metadata.errorCount} error-related events were found in the session.`;
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
```

---

### Step 3: Build the Workflow Graph

**File**: `src/workflows/chatWorkflow.js`

```javascript
/**
 * Main Chat Workflow using LangGraph
 * Orchestrates the entire conversation flow
 */

import { StateGraph, END } from "@langchain/langgraph";
import GraphState from "./state.js";

// Import nodes
import { classifyIntent } from "./nodes/intentClassifier.js";
import { retrieveContexts } from "./nodes/contextRetriever.js";
import { analyzeErrors } from "./nodes/errorAnalyzer.js";
import { formatContexts } from "./nodes/contextFormatter.js";
import { generateResponse } from "./nodes/responseGenerator.js";

/**
 * Create the chat workflow graph
 */
export function createChatWorkflow() {
  // Initialize graph with state schema
  const workflow = new StateGraph({ channels: GraphState });
  
  // Add nodes
  workflow.addNode("classifyIntent", classifyIntent);
  workflow.addNode("retrieveContexts", retrieveContexts);
  workflow.addNode("analyzeErrors", analyzeErrors);
  workflow.addNode("formatContexts", formatContexts);
  workflow.addNode("generateResponse", generateResponse);
  
  // Set entry point
  workflow.setEntryPoint("classifyIntent");
  
  // Define edges (flow control)
  workflow.addEdge("classifyIntent", "retrieveContexts");
  
  // Conditional edge: Only analyze errors for debug intent
  workflow.addConditionalEdges(
    "retrieveContexts",
    (state) => state.intent,
    {
      debug: "analyzeErrors",
      analytics: "formatContexts",
      general: "formatContexts",
    }
  );
  
  workflow.addEdge("analyzeErrors", "formatContexts");
  workflow.addEdge("formatContexts", "generateResponse");
  workflow.addEdge("generateResponse", END);
  
  // Compile the graph
  return workflow.compile();
}

// Export singleton instance
export const chatWorkflow = createChatWorkflow();

export default chatWorkflow;
```

---

### Step 4: Create Service Wrapper

**File**: `src/services/chatService.js`

```javascript
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
   * Process a chat message through the workflow
   */
  async chat(sessionId, message) {
    // Validate session
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    
    // Get conversation history
    const conversationHistory = sessionManager.getConversationHistory(sessionId);
    
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
```

---

### Step 5: Update Chat Route

**File**: `src/routes/chat.routes.js` (REPLACE)

```javascript
/**
 * Chat Routes (LangGraph Version)
 */

import express from "express";
import sessionManager from "../services/sessionManager.js";
import chatService from "../services/chatService.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { sessionId, message } = req.body;
  
  // Validation
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "sessionId is required",
    });
  }
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: "message is required",
    });
  }
  
  // Check session exists
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Session not found. Please initialize a session first.",
    });
  }
  
  try {
    // Process through LangGraph workflow
    const result = await chatService.chat(sessionId, message);
    
    res.json({
      success: true,
      response: result.response,
      sessionId,
      timestamp: new Date().toISOString(),
      context: result.metadata,
    });
  } catch (error) {
    console.error(`❌ Error in chat:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
```

---

## Benefits of This Architecture

### 1. **Clarity**
```
Every node has ONE job:
  - classifyIntent → Determine what user wants
  - retrieveContexts → Get data
  - analyzeErrors → Find problems
  - formatContexts → Prepare for LLM
  - generateResponse → Create answer
```

### 2. **Flexibility**
```
Easy to add new nodes:
  - suggestFixes → Recommend solutions
  - compareEvents → Compare sessions
  - generateReport → Export analysis
```

### 3. **Conditional Logic**
```
If debugging → analyzeErrors
If general question → skip to formatContexts
If analytics → different formatting
```

### 4. **Parallel Execution**
```javascript
const [events, docs] = await Promise.all([
  searchEvents(),
  searchDocs(),
]); // Both run simultaneously
```

### 5. **State Management**
```
All data flows through state
Easy to debug: console.log(state)
Easy to test: inject mock state
```

### 6. **Visual Debugging**
```
LangGraph Studio can visualize the flow:

[Start] → [Intent] → [Retrieve] → [Format] → [Generate] → [End]
                         ↓
                    [Analyze Errors]
                    (if debug intent)
```

---

## Installation

```bash
cd /Users/mashraf/Desktop/adobe-codes/assurance-ai-agent

npm install @langchain/langgraph @langchain/core
```

---

## Comparison: Before vs After

### Before (Current Phase 1)
```javascript
// 140 lines, all in one file
router.post("/", async (req, res) => {
  // Get contexts
  const docs = await knowledgeBase.search();
  const events = await eventStore.search();
  
  // Build prompt
  const prompt = buildPrompt(docs, events, history, message);
  
  // Generate
  const response = await llm.invoke(prompt);
});
```

### After (LangGraph)
```javascript
// Clean separation of concerns
const result = await chatWorkflow.invoke({
  sessionId,
  userMessage: message,
  conversationHistory,
});

// Workflow handles:
// - Intent classification
// - Context retrieval (parallel)
// - Error analysis (conditional)
// - Token management
// - Response generation
```

---

## Migration Timeline

### Week 1: Setup (2-3 hours)
- Install LangGraph
- Create state schema
- Build basic nodes
- Test with simple query

### Week 2: Enhancement (3-4 hours)
- Add error analysis node
- Add conditional routing
- Add token management
- Test with complex queries

### Week 3: Polish (1-2 hours)
- Add logging
- Add metrics
- Document workflow
- Train team

**Total**: ~8 hours for complete implementation

---

## Should We Do This?

### ✅ YES, if:
- You want a scalable, maintainable architecture
- You plan to add more debugging features
- You want clear separation of concerns
- You're okay with 2-3 days initial setup

### ⚠️ MAYBE, if:
- You want something working TODAY
- Team unfamiliar with LangChain/Graph concepts
- Very simple use case (just chat)

### Recommendation: **YES, go with LangGraph**

**Why**: You're building a debugging assistant, not just a chatbot. The conditional logic, multi-step analysis, and state management will pay off immediately.

---

## Next Steps

1. Install LangGraph: `npm install @langchain/langgraph`
2. Create state schema
3. Build first node (intentClassifier)
4. Test with simple flow
5. Add remaining nodes iteratively

**Ready to start?** I can implement this step-by-step.

