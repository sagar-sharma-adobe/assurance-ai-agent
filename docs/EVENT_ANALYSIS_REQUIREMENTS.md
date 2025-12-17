# Event Analysis Requirements & Architecture Discussion

## 📊 Real Event Structure (from sample sessions)

### Event Schema
```json
{
  "uuid": "event-id",                    // Unique event ID
  "eventNumber": 77,
  "clientId": "client-id",
  "timestamp": 1765881911231,
  "vendor": "com.adobe.griffon.mobile",
  "type": "generic",
  "payload": {
    "ACPExtensionEventName": "...",
    "ACPExtensionEventType": "...",
    "ACPExtensionEventSource": "...",
    "ACPExtensionEventUniqueIdentifier": "UUID",  // Alternative event ID
    "ACPExtensionEventParentIdentifier": "UUID",  // 🔑 KEY for story building!
    "ACPExtensionEventData": { ... },
    "metadata": {
      "state.data": { ... }  // Often contains redundant config
    }
  }
}
```

---

## 🚨 Error Event Example

**Target Service Failure:**
```json
{
  "uuid": "db86777f-ba45-4fa8-ada4-689ecda87fdd",
  "payload": {
    "ACPExtensionEventData": {
      "status": 502,
      "title": "The service call has failed.",
      "type": "https://ns.adobe.com/aep/errors/EXEG-0203-502",
      "detail": "An error occurred while calling the 'com.adobe.target' service..."
    },
    "ACPExtensionEventParentIdentifier": "853008E9-4EF0-47A5-83E8-59C83BCC8A88"
  }
}
```

---

## 🔍 Redundant Information Identified

### 1. **Lifecycle Context Data** (repeats in many events)
```json
"lifecyclecontextdata": {
  "systemlocale": "en-IN",          // Static
  "resolution": "1206x2622",        // Static
  "appid": "MessagingDemoAppSwiftUI 1.0 (1)",  // Static
  "osversion": "iOS 18.1",          // Static
  "devicename": "arm64",            // Static
  "previousosversion": "iOS 18.1",  // Static
  "previousappid": "...",           // Static
  ...
}
```

**Analysis:** This configuration data doesn't change between events and doesn't help with semantic search.

### 2. **Push Tokens** (repeat across multiple events)
```json
"pushTokens": "80A9C1C7F8DF2D86F4AB351B777BB7CFA52F76B02CDC69CE..."
```

**Analysis:** Tokens are identifiers, not semantic content.

### 3. **Shared State Events** (lots of boilerplate)
```json
{
  "ACPExtensionEventName": "Shared state change",
  "ACPExtensionEventType": "com.adobe.eventtype.hub",
  "ACPExtensionEventData": { "stateowner": "com.adobe.messaging" },
  "metadata": { "state.data": { /* huge config dump */ } }
}
```

**Analysis:** The state.data often contains repeated configuration.

---

## 🎯 Key Requirements from User

### 1. **Story Building with Event Relationships**
- Use `ACPExtensionEventParentIdentifier` to link events
- Use `requestId` to group related events
- Build causal chains: Request → Response → Error

**Example Query:** "Why did my Analytics call fail?"
**Expected Flow:**
1. Find error event
2. Get `ACPExtensionEventParentIdentifier` 
3. Retrieve parent event (the Analytics call)
4. Retrieve sibling events (same `requestId`)
5. Show the complete story

### 2. **Show Actual Events to User Along with the reasoning**
- Don't just analyze - show the raw event
- Let user inspect the actual payload
- Highlight the relevant parts

### 3. **Error-Focused Retrieval**
**Query:** "Show me events with errors"
- Filter for events with error indicators:
  - `status` >= 400
  - `logLevel`: "error"
  - `ACPExtensionEventSource`: "errorresponsecontent"
  - `type`: contains "error" or "fail"

### 4. **Timeout Analysis**
**Query:** "Why did my request timeout?"
- Look for timeout indicators
- Check elapsed time
- Find related network events

---

## 💡 Critical Fields for Extraction

### **Always Extract:**
1. **Event Identity**
   - `ACPExtensionEventName`
   - `ACPExtensionEventType`
   - `vendor`
   - `type`

2. **Relationships** (for story building)
   - `ACPExtensionEventParentIdentifier` ✅
   - `ACPExtensionEventUniqueIdentifier`
   - `requestId`
   - `requestEventId`

3. **Error Information**
   - `status` (HTTP status codes)
   - `title` (error title)
   - `detail` (error description)
   - `errorType`
   - `logLevel`

4. **Actions/State Changes**
   - `action` in payload
   - `eventType` (e.g., "application.close")
   - `stateChange`

### **Sometimes Extract:**
- `elapsed` (timing info)
- Specific data fields (depends on event type)

### **Skip (Redundant):**
- ❌ Timestamps (already in event metadata)
- ❌ UUIDs (already indexed)
- ❌ Static config (systemlocale, resolution, osversion, etc.)
- ❌ Long tokens
- ❌ Repeated lifecycle context data

---

## 🏗️ Proposed Architecture

### **Phase 1: Smart Event Extraction**

Extract only semantically meaningful content:
```javascript
extractEventContent(event) {
  return {
    semanticContent: `
Event: ${event.payload.ACPExtensionEventName}
Type: ${event.payload.ACPExtensionEventType}
${event.payload.ACPExtensionEventData.status ? 
  `🚨 ERROR (${status}): ${title} - ${detail}` : ''}
${event.payload.ACPExtensionEventData.action ? 
  `Action: ${action}` : ''}
    `,
    
    metadata: {
      eventId: event.payload.ACPExtensionEventUniqueIdentifier,
      parentEventId: event.payload.ACPExtensionEventParentIdentifier,  // 🔑
      requestId: event.payload.ACPExtensionEventData.requestId,
      hasError: status >= 400 || logLevel === 'error',
      errorType: determineErrorType(event),
      vendor: event.vendor,
      category: categorizeEvent(event)
    },
    
    rawEvent: event  // Keep for display to user
  };
}
```

### **Phase 2: Graph-Based Story Retrieval**

```javascript
buildEventStory(errorEventId) {
  const errorEvent = getEvent(errorEventId);
  const parentId = errorEvent.metadata.parentEventId;
  const requestId = errorEvent.metadata.requestId;
  
  return {
    rootCause: getEvent(parentId),           // The call that failed
    relatedEvents: getEventsByRequestId(requestId),  // All events in same request
    timeline: sortByTimestamp([...]),        // Chronological order
    childEvents: getEventsByParentId(errorEventId)  // Downstream effects
  };
}
```

### **Phase 3: Hybrid Search Strategy**

```javascript
searchStrategy(query, intent) {
  if (containsErrorKeywords(query)) {
    // Error-focused search
    return {
      primarySearch: semanticSearch(query, {
        filters: { hasError: true }
      }),
      expandStory: true,  // Include parent/child events
      display: 'full-event'  // Show raw payload
    };
  }
  
  if (containsTimeoutKeywords(query)) {
    return {
      primarySearch: semanticSearch(query, {
        filters: { category: 'network', hasError: true }
      }),
      expandStory: true,
      highlight: ['elapsed', 'status']
    };
  }
  
  // Default semantic search
  return {
    primarySearch: semanticSearch(query),
    expandStory: false,
    display: 'summary'
  };
}
```

---

## ❓ Open Questions for Discussion

### 1. **Story Expansion Depth**
When user asks "Why did my Analytics call fail?", how much context to include?
- Just the error event?
- Error + parent event?
- Error + parent + all siblings (same requestId)?
- Error + parent + siblings + children?

Answer - Events are important but our answer should be simple to read. Based off of the events for sure and we should show the summarised raw event hiding redundant information too if the user asks. So short answer is we would show the event when viewing the event itself addresses the problem more clearly than trying to explain via a long story.

### 2. **Vector Store Strategy**
- **Option A:** One vector store, rich metadata, filter-then-search
- **Option B:** Separate stores (errors vs normal events)
- **Option C:** Store event relationships separately (graph database)?

Answer - I am not proficient in data stores that is why the discussion. I believe this would also depend on how we plan to retrieve these events and related events to make decision on graph data base. But I am sure that we should make the storage and retirieval efficient in terms of removing redundant information while saving and filling that information back when retrieving.

### 3. **Event Display**
How to show events to user?
- Full JSON payload?
- Formatted summary with expandable details?
- Highlight critical fields?

Answer - Formatted summary with critical fields gighlighted should be fine. events can be really large and I don't think that full payload is that readable. We will create a separate UI in later stage of the project to be able to show complex information too. For now we only have a response.

### 4. **Category Taxonomy**
You mentioned defining categories. What categories are most useful?
- By vendor? (griffon, edge, target, etc.)
- By type? (lifecycle, analytics, network, error, etc.)
- By SDK extension? (messaging, identity, edge, etc.)
- Custom categories?

Answer - Great question. 

Assurance contains events from all layers of the architecture. Starting from Device SDKs, to platform that recieves the request to orchestrator and then upstreams. Vendor is the field that defines where these events originated from. To label some things, Griffon is the debigging service, Edge is platform name which supports all services, Target is an Upstream which is used for personalization, same is Decisioning/ODE. Other Upstreams include analytics, segmentation, etc.

Types can be really relevant while making sense of the story. but it is just meta information that should be indexable.

From my perspective SDKs are really important as these categorise each functioning component. Messaging - For inapp messages and content, Identity for managing profiles and identification, Edge for streamlining all services and requests, Optimize for content personalization, Config for saving configuration and state of each SDK, Core for managing communication between all SDKs, etc.

We should keep these points in mind while finalizing our approach.

### 5. **Performance Trade-offs**
- Graph traversal (follow parentEventId) adds latency but provides better context - A little latency is not an issue as reaoning is a difficult problem to solve in itlsef with such complexity.
- Is it acceptable to make multiple queries to build the story? - That is perfectly fine.
- Or should we pre-compute relationships during ingestion? - An event might be relevant for multiple stories so pre computing might be a wasteful operation.

---

## 🎯 Next Steps

1. **Define Event Categories** (User to provide)
2. **Approve Extraction Strategy** (What to keep, what to skip)
3. **Approve Story Building Approach** (How to link events)
4. **Design Event Display Format** (How to show to user)
5. **Implement & Test** with real session data

---

## 📝 Notes

- Session file has ~336K tokens = massive amount of events
- Need efficient indexing and retrieval
- Story building is key differentiator
- Don't just search - understand relationships
- Always show actual events, not just analysis

