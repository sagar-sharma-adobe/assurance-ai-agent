# Phase 2: Enhanced LangGraph Workflow Design

## 🎯 Goals
1. Leverage ChromaDB event storage with rich metadata
2. Build event stories using relationships (parentEventId, requestId)
3. Handle multiple query types (debug, analytics, general)
4. Allocate context intelligently based on intent
5. Support multiple calls for complex queries

---

## 📊 Current Workflow (Simple - 4 Nodes)

```
START
  ↓
classifyIntent
  ↓
retrieveContexts (parallel: events + docs)
  ↓
formatContexts
  ↓
generateResponse
  ↓
END
```

**Issues:**
- No story building
- No relationship traversal
- No error-specific handling
- Fixed token allocation
- Can't handle complex multi-step queries

---

## 🚀 Proposed Enhanced Workflow (8 Nodes)

```
START
  ↓
┌─────────────────────┐
│ 1. classifyIntent   │  Enhanced: Detect query type & event focus
│    ├─ intent        │  
│    ├─ isEventQuery  │  NEW: Does query need events?
│    ├─ needsStory    │  NEW: Does query need story building?
│    └─ complexity    │  NEW: simple/medium/complex
└──────────┬──────────┘
           ↓
┌──────────────────────────────────────────────────────┐
│ 2. retrieveContexts (PARALLEL)                       │
│    ├─ retrieveEvents (conditional on isEventQuery)   │  Enhanced
│    │   ├─ Apply intent-based filters                 │
│    │   ├─ hasError filter for debug intent           │
│    │   ├─ Detect if results contain errors           │
│    │   └─ Flag needsStoryExpansion                   │
│    └─ retrieveDocs (existing)                        │
│        └─ Semantic search in knowledge base          │
└──────────┬───────────────────────────────────────────┘
           ↓
      [CONDITIONAL BRANCH]
           ↓
    needsStory == true?
       /          \
     YES           NO
      ↓             ↓
┌──────────────┐   Skip to
│ 3. buildStory│   formatContexts
│    (NEW)     │
└──────┬───────┘
       ↓
┌──────────────────────────────────────────────┐
│ 3a. expandEventRelationships                 │  NEW
│     FOR EACH error event:                    │
│     ├─ Get parent event (parentEventId)      │
│     ├─ Get related events (requestId)        │
│     ├─ Get child events (getByParentId)      │
│     ├─ Sort by timestamp (timeline)          │
│     └─ Identify config changes               │
└──────────┬───────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────┐
│ 3b. analyzeErrorPatterns                     │  NEW
│     ├─ Group errors by type                  │
│     ├─ Find error sequences                  │
│     ├─ Identify root cause candidates        │
│     └─ Calculate error timeline              │
└──────────┬───────────────────────────────────┘
           ↓
      [MERGE PATHS]
           ↓
┌──────────────────────────────────────────────┐
│ 4. formatContexts (Enhanced)                 │
│    ├─ Allocate token budget by intent        │
│    │   ├─ debug: 60% events, 10% docs, 30% history │
│    │   ├─ general: 20% events, 50% docs, 30% history │
│    │   └─ analytics: 50% events, 20% docs, 30% history │
│    ├─ Format event stories (if present)      │
│    ├─ Format doc context                     │
│    ├─ Format conversation history            │
│    └─ Ensure within token limits             │
└──────────┬───────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────┐
│ 5. generateResponse                          │  Enhanced
│    ├─ Use intent-specific prompt             │
│    ├─ Reference events explicitly            │
│    ├─ Show event IDs for verification        │
│    └─ Suggest next steps                     │
└──────────┬───────────────────────────────────┘
           ↓
END
```

---

## 🔍 Detailed Node Specifications

### **Node 1: classifyIntent (Enhanced)**

**Input:**
```javascript
{
  sessionId: string,
  userMessage: string,
  conversationHistory: Array
}
```

**Processing:**
```javascript
// LLM prompt to classify:
1. intent: "debug" | "analytics" | "general"
2. isEventQuery: boolean  // Does query need session events?
3. needsStory: boolean     // Does query need event relationships?
4. complexity: "simple" | "medium" | "complex"
5. keywords: string[]      // Extract key terms

Examples:
- "Why did my analytics call fail?" 
  → intent: debug, isEventQuery: true, needsStory: true
  
- "How do I configure the SDK?"
  → intent: general, isEventQuery: false, needsStory: false
  
- "Show me all errors in the last session"
  → intent: analytics, isEventQuery: true, needsStory: false
```

**Output:**
```javascript
{
  intent: string,
  isEventQuery: boolean,
  needsStory: boolean,
  complexity: string,
  keywords: string[]
}
```

---

### **Node 2: retrieveContexts (Parallel - Enhanced)**

**Sub-node 2a: retrieveEvents (Conditional)**

**Condition:** `isEventQuery === true`

**Processing:**
```javascript
// Build filters based on intent
const filters = {};

if (intent === "debug") {
  filters.hasError = true;  // Only error events
  k = 15;  // More events for debugging
} else if (intent === "analytics") {
  // No filter, get diverse events
  k = 10;
} else {
  k = 5;  // Fewer events for general queries
}

// Search with semantic + metadata
const events = await searchEvents(
  vectorStore, 
  userMessage, 
  k, 
  filters
);

// Detect if story building needed
const hasErrors = events.some(e => e.metadata.hasError);
const hasRelationships = events.some(e => 
  e.metadata.parentEventId || e.metadata.requestId
);

return {
  rawEvents: events,
  needsStoryExpansion: hasErrors && hasRelationships && needsStory
};
```

**Sub-node 2b: retrieveDocs (Existing)**
```javascript
// Semantic search in knowledge base
const docs = await knowledgeBase.similaritySearch(userMessage, k);
```

**Output:**
```javascript
{
  rawEvents: Array<Event>,
  rawDocs: Array<Doc>,
  needsStoryExpansion: boolean
}
```

---

### **Node 3: buildStory (NEW - Conditional)**

**Condition:** `needsStoryExpansion === true`

**Sub-node 3a: expandEventRelationships**

**Processing:**
```javascript
const stories = [];

for (const errorEvent of rawEvents.filter(e => e.metadata.hasError)) {
  const story = {
    centerEvent: errorEvent,
    context: []
  };
  
  // 1. Get parent event (root cause)
  if (errorEvent.metadata.parentEventId) {
    const parent = await getEventById(
      sessionId, 
      errorEvent.metadata.parentEventId
    );
    if (parent) {
      story.context.push({ 
        role: 'parent', 
        event: parent,
        relation: 'This triggered the error'
      });
    }
  }
  
  // 2. Get all related events (same request)
  if (errorEvent.metadata.requestId) {
    const related = await getEventsByRequestId(
      sessionId,
      errorEvent.metadata.requestId
    );
    story.context.push(...related.map(e => ({
      role: 'related',
      event: e,
      relation: 'Part of same request'
    })));
  }
  
  // 3. Get child events (downstream effects)
  const children = await getEventsByParentId(
    sessionId,
    errorEvent.metadata.eventId
  );
  story.context.push(...children.map(e => ({
    role: 'child',
    event: e,
    relation: 'Caused by this error'
  })));
  
  // 4. Sort by timestamp (timeline)
  story.timeline = [errorEvent, ...story.context.map(c => c.event)]
    .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
  
  // 5. Identify config changes
  story.configChanges = story.timeline.filter(e => 
    e.metadata.hasStateChange
  );
  
  stories.push(story);
}

return { eventStories: stories };
```

**Sub-node 3b: analyzeErrorPatterns**

**Processing:**
```javascript
const analysis = {
  errorTypes: {},      // Group by statusCode or error type
  errorSequence: [],   // Timeline of errors
  rootCauses: [],      // Events that triggered errors
  affectedSDKs: []     // Which SDK extensions had errors
};

// Group errors by type
for (const story of eventStories) {
  const error = story.centerEvent;
  const errorType = error.metadata.statusCode || 'unknown';
  
  if (!analysis.errorTypes[errorType]) {
    analysis.errorTypes[errorType] = [];
  }
  analysis.errorTypes[errorType].push(error);
}

// Find root causes (events with children that are errors)
for (const story of eventStories) {
  if (story.context.some(c => c.role === 'parent')) {
    const rootCause = story.context.find(c => c.role === 'parent').event;
    if (!analysis.rootCauses.some(e => e.metadata.eventId === rootCause.metadata.eventId)) {
      analysis.rootCauses.push(rootCause);
    }
  }
}

// Build error timeline
analysis.errorSequence = eventStories
  .map(s => s.centerEvent)
  .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp)
  .map(e => ({
    timestamp: new Date(e.metadata.timestamp).toISOString(),
    error: e.metadata.statusCode,
    sdk: e.metadata.sdkExtension || e.metadata.vendor,
    message: e.pageContent.split('\n')[0] // First line (error message)
  }));

return { errorAnalysis: analysis };
```

**Output:**
```javascript
{
  eventStories: Array<{
    centerEvent: Event,
    context: Array<{role, event, relation}>,
    timeline: Array<Event>,
    configChanges: Array<Event>
  }>,
  errorAnalysis: {
    errorTypes: Object,
    errorSequence: Array,
    rootCauses: Array,
    affectedSDKs: Array
  }
}
```

---

### **Node 4: formatContexts (Enhanced)**

**Processing:**
```javascript
// Token budget allocation based on intent
const tokenBudgets = {
  debug: { events: 0.60, docs: 0.10, history: 0.30 },
  general: { events: 0.20, docs: 0.50, history: 0.30 },
  analytics: { events: 0.50, docs: 0.20, history: 0.30 }
};

const budget = tokenBudgets[intent];
const maxTokens = 6000; // Leave room for response

// Calculate token allocations
const tokens = {
  events: Math.floor(maxTokens * budget.events),
  docs: Math.floor(maxTokens * budget.docs),
  history: Math.floor(maxTokens * budget.history)
};

// Format event context
let eventContext = '';

if (eventStories && eventStories.length > 0) {
  // Format stories
  for (const story of eventStories) {
    eventContext += formatStory(story, tokens.events / eventStories.length);
  }
} else if (rawEvents && rawEvents.length > 0) {
  // Format raw events
  for (const event of rawEvents) {
    eventContext += formatEvent(event);
  }
}

// Format doc context
const docContext = rawDocs
  .map(doc => doc.pageContent)
  .join('\n\n')
  .substring(0, tokens.docs);

// Format conversation history
const historyContext = conversationHistory
  .slice(-5) // Last 5 messages
  .map(m => `${m.role}: ${m.content}`)
  .join('\n')
  .substring(0, tokens.history);

return {
  formattedEventContext: eventContext,
  formattedDocContext: docContext,
  formattedHistoryContext: historyContext,
  tokensAllocated: {
    events: estimateTokens(eventContext),
    docs: estimateTokens(docContext),
    history: estimateTokens(historyContext)
  }
};
```

**Helper: formatStory**
```javascript
function formatStory(story, maxTokens) {
  const lines = [];
  
  // Error event (center)
  lines.push('🚨 ERROR EVENT:');
  lines.push(`  Event: ${story.centerEvent.metadata.eventName}`);
  lines.push(`  Status: ${story.centerEvent.metadata.statusCode}`);
  lines.push(`  Time: ${new Date(story.centerEvent.metadata.timestamp).toISOString()}`);
  lines.push(`  ${story.centerEvent.pageContent.split('\n')[0]}`); // Error message
  lines.push('');
  
  // Parent event (what triggered it)
  const parent = story.context.find(c => c.role === 'parent');
  if (parent) {
    lines.push('⬆️  PARENT EVENT (Triggered by):');
    lines.push(`  Event: ${parent.event.metadata.eventName}`);
    lines.push(`  Time: ${new Date(parent.event.metadata.timestamp).toISOString()}`);
    lines.push('');
  }
  
  // Related events (same request)
  const related = story.context.filter(c => c.role === 'related');
  if (related.length > 0) {
    lines.push('🔗 RELATED EVENTS (Same Request):');
    related.forEach(r => {
      lines.push(`  - ${r.event.metadata.eventName} at ${new Date(r.event.metadata.timestamp).toISOString()}`);
    });
    lines.push('');
  }
  
  // Config changes
  if (story.configChanges.length > 0) {
    lines.push('⚙️  CONFIG CHANGES:');
    story.configChanges.forEach(c => {
      lines.push(`  - ${c.metadata.stateOwner} changed at ${new Date(c.metadata.timestamp).toISOString()}`);
    });
    lines.push('');
  }
  
  // Timeline
  lines.push('📅 TIMELINE:');
  story.timeline.slice(0, 5).forEach((e, i) => {
    const isError = e.metadata.hasError ? '🚨' : '  ';
    lines.push(`  ${i + 1}. ${isError} ${new Date(e.metadata.timestamp).toISOString()} - ${e.metadata.eventName}`);
  });
  
  return lines.join('\n');
}
```

---

### **Node 5: generateResponse (Enhanced)**

**Processing:**
```javascript
// Build intent-specific system prompt
const systemPrompts = {
  debug: `You are debugging an error. The user has session events showing errors.
Your task:
1. Identify the root cause from the error story
2. Explain what triggered the error (parent event)
3. Show the impact (child events)
4. Reference specific event IDs and timestamps
5. Suggest fixes based on documentation`,

  general: `You are answering a general question about Adobe Assurance SDK.
Use documentation as primary source, events as examples if relevant.`,

  analytics: `You are analyzing session events for patterns.
Show statistics, trends, and insights from the events.`
};

const prompt = `${systemPrompts[intent]}

## Session Events:
${formattedEventContext}

## Documentation:
${formattedDocContext}

## Conversation History:
${formattedHistoryContext}

## User Question:
${userMessage}

## Your Response:
`;

const response = await llm.invoke(prompt);

return {
  response: response.content,
  tokensUsed: response.usage.total_tokens
};
```

---

## 🎛️ State Schema (Enhanced)

```javascript
const GraphState = Annotation.Root({
  // Input
  sessionId: Annotation<string>,
  userMessage: Annotation<string>,
  conversationHistory: Annotation<Array>,
  
  // Intent Classification
  intent: Annotation<string>,           // debug | general | analytics
  isEventQuery: Annotation<boolean>,    // NEW
  needsStory: Annotation<boolean>,      // NEW
  complexity: Annotation<string>,       // NEW
  keywords: Annotation<Array>,          // NEW
  
  // Raw Retrieval
  rawEvents: Annotation<Array>,
  rawDocs: Annotation<Array>,
  needsStoryExpansion: Annotation<boolean>, // NEW
  
  // Story Building (NEW)
  eventStories: Annotation<Array>,      // NEW
  errorAnalysis: Annotation<Object>,    // NEW
  
  // Formatted Context
  formattedEventContext: Annotation<string>,
  formattedDocContext: Annotation<string>,
  formattedHistoryContext: Annotation<string>,
  
  // Output
  response: Annotation<string>,
  
  // Metadata
  tokensUsed: Annotation<number>,
  tokensAllocated: Annotation<Object>   // NEW
});
```

---

## 🔀 Conditional Edges

```javascript
// After classifyIntent
workflow.addConditionalEdges(
  "classifyIntent",
  (state) => state.isEventQuery ? "retrieveContexts" : "retrieveDocsOnly"
);

// After retrieveContexts
workflow.addConditionalEdges(
  "retrieveContexts",
  (state) => state.needsStoryExpansion ? "buildStory" : "formatContexts"
);

// After buildStory
workflow.addEdge("buildStory", "formatContexts");

// After retrieveDocsOnly (skip events)
workflow.addEdge("retrieveDocsOnly", "formatContexts");
```

---

## 📊 Example Flows

### **Example 1: Debug Query with Story**
```
User: "Why did my analytics call fail?"

Flow:
classifyIntent 
  → intent: debug, isEventQuery: true, needsStory: true
  
retrieveContexts
  → 15 events (hasError filter), 2 docs
  → needsStoryExpansion: true (found error with parentEventId)
  
buildStory
  → expandEventRelationships: Build 2 error stories
  → analyzeErrorPatterns: Found root cause in parent event
  
formatContexts
  → 60% tokens to event stories, 10% to docs, 30% to history
  
generateResponse
  → "The analytics call failed because the parent request (Event ID: 853008E9) 
     had a 502 error from the target service at 10:45:10..."
```

### **Example 2: General Query (No Events)**
```
User: "How do I configure the SDK?"

Flow:
classifyIntent
  → intent: general, isEventQuery: false
  
retrieveDocsOnly
  → 5 relevant docs from knowledge base
  
formatContexts
  → 50% tokens to docs, 30% to history, 20% reserved
  
generateResponse
  → "To configure the SDK, you need to..."
```

### **Example 3: Analytics Query (No Story)**
```
User: "Show me all errors in my session"

Flow:
classifyIntent
  → intent: analytics, isEventQuery: true, needsStory: false
  
retrieveContexts
  → 10 events, needsStoryExpansion: false
  
formatContexts
  → 50% tokens to events, 20% to docs, 30% to history
  
generateResponse
  → "I found 4 errors in your session:
     1. Target service error (502) at 10:45:10
     2. ..."
```

---

## ✅ Benefits of This Design

1. **Flexible**: Handles simple and complex queries
2. **Efficient**: Only builds stories when needed
3. **Comprehensive**: Uses all relationship data (parent, request, children)
4. **Intent-Aware**: Different strategies for different query types
5. **Token-Optimized**: Smart allocation based on query
6. **Extensible**: Easy to add new nodes (e.g., analyzeTimeline)
7. **Multiple Calls**: Story building makes multiple ChromaDB calls
8. **Testable**: Each node is independent and testable

---

## 🤔 Questions for Discussion

### 1. **Node Granularity**
Should we split `buildStory` into two nodes:
- `expandRelationships` 
- `analyzePatterns`

Or keep as one node with sub-functions?

### 2. **Parallel Execution**
Should `expandRelationships` run in parallel for multiple errors?
Or sequential to avoid overwhelming ChromaDB?

### 3. **Caching**
Should we cache frequently accessed parent events?
Or always fetch fresh (simpler, more reliable)?

### 4. **Error Limits**
If 10 errors found, should we:
- Build stories for all 10?
- Build stories for top 3 most recent?
- Let user specify?

### 5. **Timeline Scope**
When building timeline, how far before/after error?
- All events in request (via requestId)?
- ±5 events by timestamp?
- ±30 seconds by timestamp?

### 6. **Additional Nodes**
Should we add more nodes?
- `validateQuery` - Check if session has events
- `suggestFollowups` - Generate follow-up questions
- `formatForUI` - Structure response for frontend
- `extractInsights` - Summary statistics

### 7. **Fallback Handling**
What if story building fails (no relationships found)?
- Fall back to showing raw events?
- Show warning to user?
- Try semantic grouping instead?

---

## 🚦 Ready to Implement?

Once we agree on:
1. Node structure (current proposal or modifications?)
2. Conditional logic (when to branch?)
3. Error handling (fallbacks?)
4. Performance considerations (parallel vs sequential?)

We can:
1. Update `state.js` with new fields
2. Enhance existing nodes
3. Create new nodes (buildStory, analyzePatterns)
4. Update workflow edges
5. Test with real queries

**What would you like to adjust or clarify?**

