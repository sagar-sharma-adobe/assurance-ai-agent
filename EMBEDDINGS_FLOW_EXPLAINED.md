# How Embeddings Work in RAG Systems

## The Question
When storing/retrieving events from vector stores:
- Do we get embeddings back or raw events?
- What gets fed to the LLM - embeddings or raw text?

## Short Answer
✅ **Raw events get fed to the LLM, NOT embeddings**
✅ **Embeddings are only used for SEARCH, not for LLM input**

---

## The Complete Flow

### Phase 1: Storage (Upload Events)

```
Raw Event (JSON)
      ↓
┌──────────────────────────────────────────────┐
│  {                                           │
│    "type": "Analytics",                      │
│    "name": "trackAction",                    │
│    "payload": {                              │
│      "action": "AddToCart",                  │
│      "product": "Blue Shoes"                 │
│    }                                         │
│  }                                           │
└──────────────────────────────────────────────┘
      ↓
  [Format for embedding]
      ↓
┌──────────────────────────────────────────────┐
│  Text String:                                │
│  "Event Type: Analytics                      │
│   Event Name: trackAction                    │
│   Timestamp: 2025-12-11T06:00:00Z            │
│   Payload: {                                 │
│     action: AddToCart,                       │
│     product: Blue Shoes                      │
│   }"                                         │
└──────────────────────────────────────────────┘
      ↓
  [Send to Ollama embedding model]
      ↓
┌──────────────────────────────────────────────┐
│  Embedding (768-dimensional vector):         │
│  [0.234, -0.891, 0.456, ..., 0.123]         │
│  (768 numbers representing semantic meaning) │
└──────────────────────────────────────────────┘
      ↓
  [Store in Vector Store]
      ↓
┌──────────────────────────────────────────────┐
│  Vector Store Entry:                         │
│  {                                           │
│    embedding: [0.234, -0.891, ...],  ← Used for search │
│    pageContent: "Event Type: Analytics...",  ← Returned │
│    metadata: {                               ← Returned │
│      eventType: "Analytics",                 │
│      eventName: "trackAction",               │
│      timestamp: "2025-12-11T06:00:00Z"       │
│    }                                         │
│  }                                           │
└──────────────────────────────────────────────┘
```

**Key Point**: Vector store stores BOTH:
- ✅ Embedding (for similarity search)
- ✅ Original text + metadata (to return)

---

### Phase 2: Retrieval (User Asks Question)

```
User Question: "What products were added to cart?"
      ↓
  [Create embedding of question]
      ↓
┌──────────────────────────────────────────────┐
│  Question Embedding:                         │
│  [0.123, -0.567, 0.789, ..., 0.321]         │
└──────────────────────────────────────────────┘
      ↓
  [Search vector store for similar embeddings]
      ↓
┌──────────────────────────────────────────────┐
│  Similarity Comparison:                      │
│  Query: [0.123, -0.567, ...]                 │
│         ↓ cosine similarity                  │
│  Event 1: [0.234, -0.891, ...] → 0.87 ✅     │
│  Event 2: [0.456, -0.123, ...] → 0.45       │
│  Event 3: [0.678, -0.234, ...] → 0.92 ✅     │
│  Event 4: [0.890, -0.345, ...] → 0.23       │
└──────────────────────────────────────────────┘
      ↓
  [Return top K matches]
      ↓
┌──────────────────────────────────────────────┐
│  Retrieved Documents (NOT embeddings):       │
│  [                                           │
│    {                                         │
│      pageContent: "Event Type: Analytics...",│ ← RAW TEXT
│      metadata: { eventType: "Analytics" }    │ ← METADATA
│    },                                        │
│    {                                         │
│      pageContent: "Event Type: Analytics...",│
│      metadata: { eventType: "Analytics" }    │
│    }                                         │
│  ]                                           │
│  ❌ NO EMBEDDINGS in response                │
└──────────────────────────────────────────────┘
```

**Key Point**: Vector store returns:
- ✅ Original text (`pageContent`)
- ✅ Metadata
- ❌ Does NOT return embeddings

---

### Phase 3: LLM Input (Generate Response)

```
Retrieved Events (Raw Text)
      ↓
┌──────────────────────────────────────────────┐
│  Build Prompt (Text-only):                   │
│                                              │
│  "You are an AI debugging assistant...       │
│                                              │
│   Relevant session events:                   │
│                                              │
│   Event Type: Analytics                      │ ← RAW TEXT
│   Event Name: trackAction                    │ ← RAW TEXT
│   Payload: { action: AddToCart, ... }        │ ← RAW TEXT
│                                              │
│   Event Type: Analytics                      │
│   Event Name: trackState                     │
│   Payload: { screen: ProductDetails }        │
│                                              │
│   User: What products were added to cart?"   │
└──────────────────────────────────────────────┘
      ↓
  [Send to LLM]
      ↓
┌──────────────────────────────────────────────┐
│  LLM Input: Plain text prompt                │
│  LLM Output: Plain text response             │
│                                              │
│  "Based on the events, the product          │
│   'Blue Shoes' was added to the cart..."    │
└──────────────────────────────────────────────┘
```

**Key Point**: LLM receives:
- ✅ Plain text (human-readable event descriptions)
- ❌ NOT embeddings (LLMs can't read embeddings)

---

## Why This Design?

### Embeddings are for SEARCH, not UNDERSTANDING

```
Embedding = [0.234, -0.891, 0.456, ...]
           ↓
    Used for: "Find similar content"
    ❌ NOT for: "Understand content"
```

**Why?**
- Embeddings are numeric vectors (just numbers)
- LLMs need text to generate responses
- Embeddings capture semantic similarity, not literal meaning

### Analogy

```
Library with Books:
├─ Index Cards (Embeddings) → Find books by topic
│   [Romance: Shelf A-3]
│   [Mystery: Shelf B-7]
│
└─ Actual Books (Raw Text) → Read to understand
    "Once upon a time..."
```

When you ask "Find me romance books":
1. Use index cards (embeddings) to FIND books
2. Read actual books (raw text) to UNDERSTAND story

Same with RAG:
1. Use embeddings to FIND relevant events
2. Feed raw text to LLM to UNDERSTAND and respond

---

## Code Evidence

### Storage (What Gets Stored)

**File**: `src/services/eventVectorStore.js`

```javascript
// Line 96-143 in eventVectorStore.js
export async function addEventsToVectorStore(vectorStore, events) {
  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    
    // Format events as TEXT
    const eventTexts = batch.map((event) => {
      return `
Event Type: ${event.type || "unknown"}
Event Name: ${event.name || "unnamed"}
Timestamp: ${event.timestamp || "unknown"}
Payload: ${JSON.stringify(event.payload || {}, null, 2)}
      `.trim();
    });
    
    const metadata = batch.map((event) => ({
      eventId: event.id || event.eventId,
      eventType: event.type,
      eventName: event.name,
      timestamp: event.timestamp,
    }));
    
    // Store: embeddings are created internally, but we provide TEXT
    await vectorStore.addDocuments(
      eventTexts.map((text, idx) => ({
        pageContent: text,        // ← Raw text stored
        metadata: metadata[idx],  // ← Metadata stored
      }))
    );
  }
}
```

**What happens internally**:
```javascript
// Inside vectorStore.addDocuments():
for (const doc of documents) {
  // 1. Create embedding from pageContent
  const embedding = await embeddings.embedQuery(doc.pageContent);
  //    → [0.234, -0.891, 0.456, ...]
  
  // 2. Store BOTH embedding AND pageContent
  store.add({
    vector: embedding,         // ← For search
    content: doc.pageContent,  // ← For retrieval
    metadata: doc.metadata     // ← For retrieval
  });
}
```

---

### Retrieval (What Gets Retrieved)

**File**: `src/services/eventVectorStore.js`

```javascript
// Line 169-177
export async function searchEvents(vectorStore, query, k = 5) {
  try {
    const results = await vectorStore.similaritySearch(query, k);
    //                                                          ↓
    // Returns: Array of { pageContent: string, metadata: object }
    //          NOT: Array of embeddings
    
    return results;
  } catch (error) {
    console.error('❌ Failed to search events:', error);
    return [];
  }
}
```

**What `results` looks like**:
```javascript
[
  {
    pageContent: "Event Type: Analytics\nEvent Name: trackAction\n...", // ← TEXT
    metadata: { eventType: "Analytics", eventName: "trackAction" }       // ← METADATA
    // ❌ NO 'embedding' field
  },
  {
    pageContent: "Event Type: Lifecycle\nEvent Name: AppLaunch\n...",
    metadata: { eventType: "Lifecycle", eventName: "AppLaunch" }
  }
]
```

---

### LLM Input (What Gets Fed to LLM)

**File**: `src/routes/chat.routes.js` (current Phase 1)

```javascript
// Line 86-108
// Retrieve events (get RAW TEXT, not embeddings)
const relevantEvents = await searchEvents(eventVectorStore, message, 5);

if (relevantEvents.length > 0) {
  eventContext = "\n\nRelevant session events:\n" +
    relevantEvents.map((doc, i) => 
      `[Event ${i + 1}]\n${doc.pageContent}`  // ← RAW TEXT to LLM
    ).join("\n\n");
}

// Build prompt (ALL TEXT, no embeddings)
const fullPrompt = `${SYSTEM_PROMPT}${knowledgeContext}${eventContext}

Previous conversation:
${conversationContext || "No previous messages"}

User: ${message}
`;

// Send TEXT to LLM
const aiResponse = await llm.invoke(fullPrompt);
```

**Prompt looks like**:
```
You are an AI assistant specialized in Adobe Assurance debugging...

Relevant session events:

[Event 1]
Event Type: Analytics          ← HUMAN-READABLE TEXT
Event Name: trackAction
Timestamp: 2025-12-11T06:00:00Z
Payload: {
  action: "AddToCart",
  product: "Blue Shoes"
}

[Event 2]
Event Type: Lifecycle
Event Name: AppLaunch
Timestamp: 2025-12-11T05:59:00Z
Payload: {
  appVersion: "1.0.0"
}

User: What products were added to cart?
```

❌ **NO embeddings anywhere in this prompt!**

---

## Common Misconceptions

### ❌ Myth 1: "LLMs read embeddings"
**Reality**: LLMs only read text. Embeddings are numeric vectors that LLMs can't interpret.

### ❌ Myth 2: "We send embeddings to save tokens"
**Reality**: Embeddings don't save tokens. They're not even compatible with LLM input.

### ❌ Myth 3: "Retrieval returns embeddings for similarity"
**Reality**: Retrieval uses embeddings internally for search, but returns original text.

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────┐
│                    STORAGE PHASE                         │
├─────────────────────────────────────────────────────────┤
│  Raw Event → Format to Text → Create Embedding          │
│                                      ↓                   │
│              ┌───────────────────────────────────┐      │
│              │  Vector Store                     │      │
│              │  ┌─────────────────────────────┐ │      │
│              │  │ embedding: [0.23, -0.89]  │ │ Search│
│              │  │ pageContent: "Event Type..." │ Return│
│              │  │ metadata: {...}            │ │      │
│              │  └─────────────────────────────┘ │      │
│              └───────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   RETRIEVAL PHASE                        │
├─────────────────────────────────────────────────────────┤
│  User Query → Create Query Embedding → Search           │
│                                           ↓              │
│                    Find Similar Embeddings               │
│                                           ↓              │
│                Return pageContent + metadata             │
│                (NOT embeddings)                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                      LLM PHASE                           │
├─────────────────────────────────────────────────────────┤
│  Build Prompt with pageContent (raw text)               │
│                    ↓                                     │
│              Send TEXT to LLM                            │
│                    ↓                                     │
│            LLM generates TEXT response                   │
└─────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. ✅ **Embeddings = Search tool** (like index cards in a library)
2. ✅ **Raw text = Understanding tool** (like actual books)
3. ✅ **Vector store stores BOTH** (embeddings for search, text for retrieval)
4. ✅ **Vector store returns TEXT** (not embeddings)
5. ✅ **LLM receives TEXT** (can't read embeddings)

---

## Why This Matters for Token Management

When we talk about "truncating events" or "token budgets":
- We're talking about the **RAW TEXT** that goes to the LLM
- NOT about the embeddings

Example:
```javascript
// Full event: 10,000 characters
const fullEvent = JSON.stringify(event.payload);

// Create embedding (always same size regardless of input length)
const embedding = await embeddings.embedQuery(fullEvent);
// → [768 numbers] (always 768 dimensions for nomic-embed-text)

// But for LLM, we need to truncate the TEXT:
const truncated = fullEvent.substring(0, 1600);
// → 1600 characters ≈ 400 tokens
```

**Embeddings don't have "token cost"** - they're fixed-size vectors.
**Raw text has token cost** - that's what we feed to LLMs.

---

## Conclusion

**Flow Summary**:
1. **Storage**: Raw events → Text → Embeddings → Store both
2. **Retrieval**: Query → Embedding → Search → Return TEXT (not embeddings)
3. **LLM**: TEXT goes in → TEXT comes out

**Embeddings are never fed to LLMs** - they're a search mechanism only!

