# Enhanced LangGraph Workflow Design

## 🎯 Goal
Design a workflow that takes full advantage of:
1. **ChromaDB** - Rich metadata, relationship queries, filtering
2. **LangGraph** - Conditional branching, parallel execution, state management
3. **Event Intelligence** - Error detection, story building, temporal analysis

---

## 📊 Current Workflow (Simple Linear)

```
START → classifyIntent → retrieveContexts → formatContexts → generateResponse → END
```

### Current Limitations:
❌ No metadata filtering (doesn't use hasError, isSDKEvent)  
❌ No story building (doesn't follow parentEventId, requestId)  
❌ No error-focused retrieval  
❌ No relationship expansion  
❌ Same retrieval strategy for all intents  
❌ No conditional branching based on findings  

---

## 🚀 Proposed Enhanced Workflow

### **Architecture: Intent-Driven Conditional Graph**

```
                            START
                              ↓
                      classifyIntent
                              ↓
                    ┌─────────┴─────────┐
                    ↓                   ↓
            [debug/analytics]      [general]
                    ↓                   ↓
             retrieveEvents      retrieveBasicContexts
                    ↓                   ↓
            buildEventStory             │
                    ↓                   │
          expandRelationships           │
                    ↓                   ↓
            enrichWithDocs ←────────────┘
                    ↓
            formatContexts
         (+ metadata summaries
          + domain knowledge)
                    ↓
          generateResponse
         (enhanced prompts for
          AEP, SDKs, Edge, etc.)
                    ↓
                   END
```

### **Key Design Decisions:**
✅ **Story building for ALL session-related questions** (not just errors)  
✅ **Separate nodes** for buildEventStory and expandRelationships  
✅ **Metadata summaries** included in LLM context  
✅ **Domain knowledge** about Adobe ecosystem in prompts

---

## 🎨 Detailed Node Design

### **Node 1: classifyIntent** ✅ (Keep existing)
**Input:** userMessage, conversationHistory  
**Output:** intent (debug, analytics, general)  
**Logic:** LLM-based classification  

---

### **Node 2: retrieveEvents** 🆕 (NEW - Renamed from detectErrorEvents)
**When:** intent = "debug" OR intent = "analytics"  
**Input:** sessionId, userMessage, intent  
**Output:** relevantEvents[], eventMetadataSummary  

**Logic:**
```javascript
// Determine retrieval strategy based on query
let filters = {};
let k = 15;

// Check if query is error-focused
if (userMessage.toLowerCase().match(/error|fail|crash|broken|wrong/)) {
  filters.hasError = true;
  k = 20;  // Get more error events
}

// Check if query is analytics-focused
if (userMessage.toLowerCase().match(/track|analytic|data|report/)) {
  // Semantic search will handle this
  // Could add: filters.sdkExtension = "com.adobe.analytics"
}

// Retrieve events with optional filtering
const relevantEvents = await searchEvents(vectorStore, userMessage, k, filters);

// Sort by timestamp (most recent first)
relevantEvents.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);

// Generate metadata summary
const eventMetadataSummary = {
  totalEvents: relevantEvents.length,
  errorCount: relevantEvents.filter(e => e.metadata.hasError).length,
  sdkEvents: relevantEvents.filter(e => e.metadata.isSDKEvent).length,
  backendEvents: relevantEvents.filter(e => !e.metadata.isSDKEvent).length,
  uniqueExtensions: [...new Set(relevantEvents.map(e => e.metadata.sdkExtension).filter(Boolean))],
  uniqueVendors: [...new Set(relevantEvents.map(e => e.metadata.vendor).filter(Boolean))],
  timeRange: {
    earliest: new Date(Math.min(...relevantEvents.map(e => e.metadata.timestamp))).toISOString(),
    latest: new Date(Math.max(...relevantEvents.map(e => e.metadata.timestamp))).toISOString()
  }
};

return {
  relevantEvents,
  eventMetadataSummary
};
```

**Why:** Retrieve ALL relevant events for session-related questions, with optional error filtering. Generate metadata summary for LLM context.

---

### **Node 3: buildEventStory** 🆕 (NEW)
**When:** intent = "debug" OR intent = "analytics" (always for session-related queries)  
**Input:** relevantEvents[], sessionId  
**Output:** eventStories[]  

**Logic:**
```javascript
const stories = [];

// Group events by different criteria
const eventsToStoryBuild = [];

// Priority 1: Error events (if any)
const errorEvents = relevantEvents.filter(e => e.metadata.hasError);
eventsToStoryBuild.push(...errorEvents.slice(0, 3));  // Top 3 errors

// Priority 2: Events with requestId (indicates transaction flow)
const requestGroups = {};
for (const event of relevantEvents) {
  if (event.metadata.requestId && !eventsToStoryBuild.includes(event)) {
    if (!requestGroups[event.metadata.requestId]) {
      requestGroups[event.metadata.requestId] = [];
    }
    requestGroups[event.metadata.requestId].push(event);
  }
}

// Add top 2 request groups
const topRequests = Object.entries(requestGroups)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 2);

for (const [requestId, events] of topRequests) {
  eventsToStoryBuild.push(events[0]);  // Use first event of group as anchor
}

// Priority 3: Events with parent-child relationships
for (const event of relevantEvents.slice(0, 5)) {
  if (event.metadata.parentEventId && !eventsToStoryBuild.includes(event)) {
    eventsToStoryBuild.push(event);
  }
}

// Build stories for selected events
for (const anchorEvent of eventsToStoryBuild) {
  const story = {
    anchorEvent,
    parentEvent: null,
    childEvents: [],
    relatedEvents: [],
    timeline: []
  };
  
  // 1. Get parent event (upstream cause)
  if (anchorEvent.metadata.parentEventId) {
    story.parentEvent = await getEventById(
      sessionId, 
      anchorEvent.metadata.parentEventId
    );
  }
  
  // 2. Get child events (downstream effects)
  if (anchorEvent.metadata.eventId) {
    story.childEvents = await getEventsByParentId(
      sessionId,
      anchorEvent.metadata.eventId
    );
  }
  
  // 3. Get related events (same request)
  if (anchorEvent.metadata.requestId) {
    story.relatedEvents = await getEventsByRequestId(
      sessionId,
      anchorEvent.metadata.requestId
    );
    
    // Build timeline
    story.timeline = story.relatedEvents
      .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp)
      .map(e => ({
        time: new Date(e.metadata.timestamp).toISOString(),
        event: e.metadata.eventName || e.metadata.serviceType || e.metadata.vendor,
        hasError: e.metadata.hasError,
        extension: e.metadata.sdkExtension || e.metadata.vendor,
        statusCode: e.metadata.statusCode
      }));
  }
  
  stories.push(story);
}

return { eventStories: stories };
```

**Why:** Build complete event narratives for ANY session-related query, not just errors. Follow parent-child relationships and request flows.

---

### **Node 4: expandRelationships** 🆕 (NEW)
**When:** After buildEventStory  
**Input:** eventStories[]  
**Output:** expandedStories[]  

**Logic:**
```javascript
const expandedStories = [];

for (const story of eventStories) {
  const expanded = { ...story };
  
  // 1. Get child events (downstream effects)
  if (story.errorEvent.metadata.eventId) {
    expanded.childEvents = await getEventsByParentId(
      sessionId,
      story.errorEvent.metadata.eventId
    );
  }
  
  // 2. Get temporal context (events before/after)
  const errorTime = story.errorEvent.metadata.timestamp;
  const session = sessionManager.getSession(sessionId);
  
  expanded.beforeError = session.events
    .filter(e => e.timestamp < errorTime && e.timestamp > errorTime - 30000)  // 30s before
    .slice(-5);  // Last 5 events
  
  expanded.afterError = session.events
    .filter(e => e.timestamp > errorTime && e.timestamp < errorTime + 30000)  // 30s after
    .slice(0, 5);  // First 5 events
  
  // 3. Find config changes that might be relevant
  expanded.recentConfigChanges = session.events
    .filter(e => e.metadata?.hasStateChange && e.timestamp < errorTime)
    .slice(-2);  // Last 2 config changes
  
  expandedStories.push(expanded);
}

return { expandedStories };
```

**Why:** Add temporal and causal context around errors

---

### **Node 5: retrieveBasicContexts** ✅ (Enhanced)
**When:** intent = "general" OR hasErrors = false  
**Input:** sessionId, userMessage, intent  
**Output:** rawEvents[], rawDocs[]  

**Logic:**
```javascript
// Determine retrieval strategy based on intent
let eventFilters = {};
let eventCount = 5;
let docCount = 5;

if (intent === "analytics") {
  // Focus on analytics events
  eventFilters = { 
    // Look for events with specific SDK extensions
    // Or use semantic search for "tracking", "analytics"
  };
  eventCount = 10;
  docCount = 2;
}

// Parallel retrieval
const [rawEvents, rawDocs] = await Promise.all([
  searchEvents(vectorStore, userMessage, eventCount, eventFilters),
  knowledgeBase.similaritySearch(userMessage, docCount)
]);

return { rawEvents, rawDocs };
```

**Why:** Different strategies for different query types

---

### **Node 6: enrichWithDocs** 🆕 (NEW)
**When:** After story building OR basic retrieval  
**Input:** eventStories[], userMessage  
**Output:** relevantDocs[]  

**Logic:**
```javascript
// Extract SDK/service names from error stories
const mentionedSDKs = new Set();
const mentionedServices = new Set();

if (eventStories) {
  for (const story of eventStories) {
    if (story.errorEvent.metadata.sdkExtension) {
      mentionedSDKs.add(story.errorEvent.metadata.sdkExtension);
    }
    if (story.errorEvent.metadata.vendor) {
      mentionedServices.add(story.errorEvent.metadata.vendor);
    }
  }
}

// Build enhanced query for documentation
const docQuery = [
  userMessage,
  ...Array.from(mentionedSDKs).map(sdk => sdk.split('.').pop()),  // Extract last part
  ...Array.from(mentionedServices)
].join(' ');

// Retrieve relevant documentation
const docs = await knowledgeBase.similaritySearch(docQuery, 3);

return { relevantDocs: docs };
```

**Why:** Find documentation relevant to the specific SDKs/services involved in errors

---

### **Node 7: formatContexts** ✅ (Enhanced)
**When:** After enrichment  
**Input:** eventStories[], eventMetadataSummary, relevantEvents[], relevantDocs[], intent  
**Output:** formattedContext (string)  

**Logic:**
```javascript
let context = "";

// 1. Add domain knowledge primer
context += `# Adobe Experience Platform (AEP) Context

**Key Components:**
- **AEP Mobile SDK**: Client-side SDK that collects and sends data from mobile apps
- **AEP Web SDK**: Browser-based SDK for web applications
- **Extensions**: Modular SDK components (Analytics, Target, Identity, etc.)
- **Konductor**: Backend orchestration service that routes and processes requests
- **Edge Network**: Adobe's distributed data collection and routing infrastructure
- **Event Hub**: Internal event bus for SDK extension communication

**Event Flow:**
1. SDK Extension generates event (e.g., trackAction, trackState)
2. Event flows through Event Hub (parent-child relationships via ACPExtensionEventParentIdentifier)
3. Konductor processes request (backend services)
4. Edge Network routes to Adobe solutions

**Common Patterns:**
- Parent-child events indicate trigger relationships
- requestId groups related backend operations
- Status codes in 4xx/5xx indicate errors
- State changes show configuration updates

---

`;

// 2. Add metadata summary
if (eventMetadataSummary) {
  context += `## 📊 Event Overview\n\n`;
  context += `- **Total Events Analyzed:** ${eventMetadataSummary.totalEvents}\n`;
  context += `- **Errors Found:** ${eventMetadataSummary.errorCount}\n`;
  context += `- **SDK Events:** ${eventMetadataSummary.sdkEvents}\n`;
  context += `- **Backend Events:** ${eventMetadataSummary.backendEvents}\n`;
  
  if (eventMetadataSummary.uniqueExtensions.length > 0) {
    context += `- **SDK Extensions Involved:** ${eventMetadataSummary.uniqueExtensions.join(', ')}\n`;
  }
  
  if (eventMetadataSummary.uniqueVendors.length > 0) {
    context += `- **Backend Services:** ${eventMetadataSummary.uniqueVendors.join(', ')}\n`;
  }
  
  if (eventMetadataSummary.timeRange) {
    context += `- **Time Range:** ${eventMetadataSummary.timeRange.earliest} to ${eventMetadataSummary.timeRange.latest}\n`;
  }
  
  context += `\n`;
}

// 3. Format event stories
if (eventStories && eventStories.length > 0) {
  context += `## 🔍 Event Stories\n\n`;
  
  for (const story of eventStories) {
    const anchor = story.anchorEvent;
    const isError = anchor.metadata.hasError;
    const icon = isError ? '🚨' : '📋';
    
    context += `### ${icon} Story: ${anchor.metadata.eventName || anchor.metadata.serviceType || anchor.metadata.vendor}\n`;
    context += `- **Event ID:** ${anchor.metadata.eventId}\n`;
    context += `- **Timestamp:** ${new Date(anchor.metadata.timestamp).toISOString()}\n`;
    context += `- **Type:** ${anchor.metadata.isSDKEvent ? `SDK (${anchor.metadata.sdkExtension})` : `Backend (${anchor.metadata.vendor})`}\n`;
    
    if (isError) {
      context += `- **Status:** ❌ ERROR (${anchor.metadata.statusCode || anchor.metadata.logLevel})\n`;
    }
    
    // Parent event (upstream cause)
    if (story.parentEvent) {
      context += `- **⬆️ Triggered by:** ${story.parentEvent.metadata.eventName || story.parentEvent.metadata.eventId}\n`;
    }
    
    // Child events (downstream effects)
    if (story.childEvents && story.childEvents.length > 0) {
      context += `- **⬇️ Triggered:** ${story.childEvents.length} downstream event(s)\n`;
    }
    
    // Timeline
    if (story.timeline && story.timeline.length > 1) {
      context += `\n**Request Timeline** (${story.timeline.length} events):\n`;
      for (const t of story.timeline.slice(0, 10)) {  // Limit to 10 for readability
        const icon = t.hasError ? '❌' : '✅';
        const status = t.statusCode ? ` [${t.statusCode}]` : '';
        context += `${icon} ${t.time}: ${t.event}${status}\n`;
      }
      if (story.timeline.length > 10) {
        context += `... and ${story.timeline.length - 10} more events\n`;
      }
    }
    
    context += `\n**Event Content:**\n${anchor.pageContent}\n\n`;
  }
}

// 4. Format additional relevant events (not in stories)
if (relevantEvents && relevantEvents.length > 0) {
  const eventsNotInStories = relevantEvents.filter(e => 
    !eventStories.some(s => s.anchorEvent.metadata.eventId === e.metadata.eventId)
  ).slice(0, 5);
  
  if (eventsNotInStories.length > 0) {
    context += `## 📋 Additional Relevant Events\n\n`;
    for (const event of eventsNotInStories) {
      const icon = event.metadata.hasError ? '❌' : '✅';
      context += `${icon} **${event.metadata.eventName || event.metadata.vendor}**\n`;
      context += `   ${event.pageContent.split('\n')[0]}\n\n`;
    }
  }
}

// 5. Format documentation
if (relevantDocs && relevantDocs.length > 0) {
  context += `## 📚 Relevant Documentation\n\n`;
  for (const doc of relevantDocs) {
    context += `### ${doc.metadata.title || 'Documentation'}\n`;
    context += `${doc.pageContent}\n\n`;
  }
}

return { formattedContext: context };
```

**Why:** 
- **Domain Knowledge**: LLM understands AEP ecosystem
- **Metadata Summary**: Quick overview of event landscape
- **Structured Stories**: Clear cause-effect relationships
- **Timeline Visualization**: See event sequence
- **Comprehensive Context**: Events + Documentation together

---

### **Node 8: generateResponse** ✅ (Enhanced)
**Input:** formattedContext, userMessage, conversationHistory  
**Output:** response, tokensUsed  

**Enhanced System Prompt:**
```javascript
const systemPrompt = `You are an expert Adobe Experience Platform (AEP) debugging assistant.

**Your Expertise:**
- AEP Mobile SDK architecture and event flow
- SDK Extensions (Analytics, Target, Identity, Lifecycle, etc.)
- Konductor backend service patterns
- Edge Network routing and data collection
- Common debugging patterns and error resolution

**Your Approach:**
1. Analyze event relationships (parent-child, request grouping)
2. Identify root causes, not just symptoms
3. Consider temporal context (what happened before/after)
4. Reference official documentation when available
5. Provide actionable solutions

**Event Context Guidelines:**
- Parent events often reveal the trigger for errors
- RequestId groups show backend transaction flows
- State changes can explain behavior shifts
- Timestamps help identify timing issues
- Error patterns across extensions suggest SDK configuration issues

**Response Style:**
- Start with direct answer to the question
- Support with specific event evidence
- Reference event IDs and timestamps
- Suggest debugging steps if relevant
- Be concise but thorough

Now, using the provided event stories and documentation, answer the user's question.`;

// Use enhanced prompt
const response = await llm.invoke([
  { role: "system", content: systemPrompt },
  { role: "user", content: formattedContext },
  { role: "user", content: userMessage }
]);

return { response, tokensUsed };
```

**Why:** LLM has deep domain knowledge and proper debugging methodology  

---

## 🔀 Conditional Edges

### **Edge 1: Intent-Based Routing**
```javascript
function routeByIntent(state) {
  // Session-related queries → Event story building
  if (state.intent === "debug" || state.intent === "analytics") {
    return "retrieveEvents";
  }
  // General queries → Basic retrieval
  return "retrieveBasicContexts";
}

workflow.addConditionalEdges(
  "classifyIntent",
  routeByIntent,
  {
    "retrieveEvents": "retrieveEvents",
    "retrieveBasicContexts": "retrieveBasicContexts"
  }
);
```

**Simplified!** No need for error-based routing since we ALWAYS build stories for session-related queries.

---

## 📋 Complete Node & Edge List

### **Nodes (8 total):**
1. ✅ `classifyIntent` - Existing
2. 🆕 `retrieveEvents` - NEW (renamed from detectErrorEvents)
3. 🆕 `buildEventStory` - NEW
4. 🆕 `expandRelationships` - NEW
5. ✅ `retrieveBasicContexts` - Enhanced existing
6. 🆕 `enrichWithDocs` - NEW
7. ✅ `formatContexts` - **Heavily Enhanced** (metadata + domain knowledge)
8. ✅ `generateResponse` - **Enhanced** (better prompts)

### **Edges (9 total - Simplified!):**
1. `START → classifyIntent`
2. `classifyIntent → [conditional]` (intent-based routing only)
3. `classifyIntent → retrieveEvents` (if debug/analytics)
4. `classifyIntent → retrieveBasicContexts` (if general)
5. `retrieveEvents → buildEventStory` (always for session queries)
6. `buildEventStory → expandRelationships` (always)
7. `expandRelationships → enrichWithDocs`
8. `retrieveBasicContexts → enrichWithDocs`
9. `enrichWithDocs → formatContexts`
10. `formatContexts → generateResponse`
11. `generateResponse → END`

---

## 🎯 Benefits of This Design

### **1. Intent-Driven**
- Different paths for different query types
- Debug queries get error-focused treatment
- General queries get balanced retrieval

### **2. Error-Aware**
- Automatically detects and prioritizes errors
- Builds complete error narratives
- Includes cause-effect relationships

### **3. Relationship-Aware**
- Follows parentEventId chains
- Groups events by requestId
- Includes temporal context

### **4. Efficient**
- Parallel execution where possible
- Conditional paths avoid unnecessary work
- Metadata filtering reduces search space

### **5. Comprehensive**
- Events + Documentation together
- Timeline analysis
- Config change tracking

---

## 🧪 Example Flows (Updated)

### **Flow 1: Debug Query with Error**
```
User: "Why did my Analytics call fail?"
  → classifyIntent (intent=debug)
  → retrieveEvents (semantic search + error filter, finds 8 events including 2 errors)
  → buildEventStory (follows parentEventId, groups by requestId)
  → expandRelationships (adds before/after context, config changes)
  → enrichWithDocs (retrieves Analytics SDK docs based on com.adobe.analytics)
  → formatContexts (domain knowledge + metadata summary + error stories + timeline + docs)
  → generateResponse (enhanced prompt with AEP expertise)
```

**Context Includes:**
- AEP ecosystem primer
- Metadata: 8 events, 2 errors, 5 SDK events, 3 backend events, Analytics extension
- Error story with parent event, request timeline (7 events)
- Analytics SDK configuration documentation

### **Flow 2: Analytics Query (No Error)**
```
User: "Show me my tracking events from the last session"
  → classifyIntent (intent=analytics)
  → retrieveEvents (semantic search for "tracking", finds 12 events, 0 errors)
  → buildEventStory (groups by requestId, finds 3 tracking flows)
  → expandRelationships (adds lifecycle context, state changes)
  → enrichWithDocs (retrieves Analytics tracking docs)
  → formatContexts (metadata summary + 3 tracking stories + docs)
  → generateResponse
```

**Context Includes:**
- Metadata: 12 events, 0 errors, 8 SDK events, 4 backend events
- 3 tracking stories with timelines
- Lifecycle and state change context
- Analytics tracking documentation

### **Flow 3: General Query**
```
User: "How do I configure the SDK?"
  → classifyIntent (intent=general)
  → retrieveBasicContexts (5 events + 5 docs about configuration)
  → enrichWithDocs (add more SDK setup docs)
  → formatContexts (domain knowledge + basic events + comprehensive docs)
  → generateResponse
```

**Context Includes:**
- AEP ecosystem primer
- 5 recent events (for context)
- SDK configuration documentation (primary focus)

---

## ✅ Design Decisions (FINALIZED)

### **1. Node Granularity** ✅
**Decision:** Keep `buildEventStory` and `expandRelationships` as **separate nodes**
- Clearer responsibilities
- Easier to test and debug
- Can add conditional logic between them if needed

### **2. When to Build Stories** ✅
**Decision:** Build stories for **ALL session-related queries** (debug/analytics intent)
- Not just errors!
- Any question about events deserves full context
- Story building includes relationship following, timelines, etc.

### **3. Metadata in LLM Context** ✅
**Decision:** Include **rich metadata summaries** in formatted context
- Event count, error count, SDK/backend breakdown
- Extension and vendor lists
- Time ranges
- Helps LLM understand event landscape

### **4. Domain Knowledge in Prompts** ✅
**Decision:** Add **AEP ecosystem knowledge** to system prompts
- Explain AEP, Extensions, SDKs, Konductor, Edge
- Define event flow patterns
- Establish debugging methodology
- Helps LLM make sense of technical events

### **5. Documentation Strategy** ✅
**Decision:** Adaptive enrichment
- Always enrich with docs after story building
- Use SDK/service names from events to guide doc retrieval
- Sequential (not parallel) so we can use event findings

### **6. Remaining Questions** ❓

#### **A. Parallel Execution Opportunities?**
Currently sequential for safety. Could we parallelize:
- `buildEventStory` + `enrichWithDocs`? (No - need story to inform doc query)
- Within `buildEventStory` - fetch parent/child/request events in parallel? (Yes!)

#### **B. Token Budget Management?**
With rich context (stories + metadata + docs + domain knowledge), we could exceed token limits.

**Options:**
- Truncate less important events
- Summarize timelines if >10 events
- Limit stories to top 3-5
- Dynamic adjustment based on available tokens

**Your preference?**

#### **C. Analytics-Specific Handling?**
Should "analytics" intent have special logic?

**Possible enhancements:**
- Filter for `com.adobe.analytics` extension
- Focus on track calls, lifecycle events
- Different metadata summary (conversion rates, etc.)

**Worth adding?**

---

## 🚀 Implementation Priority

### **Phase 2A: Core Enhancement** (High Priority)
1. ✅ Update `state.js` - Add new state fields (relevantEvents, eventMetadataSummary, eventStories, expandedStories)
2. 🆕 Add `retrieveEvents` node - Semantic search with metadata filtering
3. 🆕 Add `buildEventStory` node - Follow parent/child/request relationships
4. 🆕 Add `expandRelationships` node - Add temporal context
5. 🔄 Update `formatContexts` - Add domain knowledge + metadata summaries
6. 🔄 Update `generateResponse` - Enhanced system prompt with AEP expertise
7. 🔀 Add conditional routing in `chatWorkflow.js`

### **Phase 2B: Advanced Features** (Medium Priority)
8. 🆕 Add `enrichWithDocs` node - Smart doc retrieval based on event findings
9. 🔄 Enhance `retrieveBasicContexts` - Better general query handling
10. 📊 Add parallel execution within nodes (e.g., fetch parent/child/request in parallel)

### **Phase 2C: Optimization** (Low Priority)
11. 💾 Add caching for relationship queries
12. 📏 Add token budget management
13. 📈 Add metric collection (story depth, error rates, etc.)
14. 🎯 Add analytics-specific handling

---

## 📊 Success Metrics

How do we know this is better?

1. **Error Query Accuracy**: % of debug queries that correctly identify root cause
2. **Context Relevance**: User feedback on answer quality
3. **Response Time**: Average time to response
4. **Token Efficiency**: Tokens used per query
5. **Story Completeness**: % of errors with parent/timeline

---

## 🎯 Next Steps

1. **Discuss & Decide:** Review this design, answer questions above
2. **Update State Schema:** Add new fields to `state.js`
3. **Implement Nodes:** Create new node files
4. **Update Workflow:** Modify `chatWorkflow.js` with conditional edges
5. **Test:** Create test cases for each flow
6. **Deploy:** Gradual rollout with monitoring

---

**Ready to discuss! What are your thoughts on:**
- Overall graph structure?
- Node granularity?
- Conditional routing logic?
- Missing anything?

