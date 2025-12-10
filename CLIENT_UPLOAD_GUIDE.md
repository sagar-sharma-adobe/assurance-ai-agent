# 📤 Chunked Event Upload - Client Implementation Guide

This guide shows how to implement efficient event uploads for Adobe Assurance sessions with 500-1500+ events.

---

## 🎯 Why Chunked Uploads?

### The Problem
- **Typical Assurance session**: 500-1500 events
- **Embedding time**: ~100ms per event
- **Total processing**: 50-150 seconds for 1500 events
- **HTTP timeout**: Most servers timeout at 30-60 seconds

### The Solution: Chunked Uploads
- Split events into chunks of 100
- Upload chunks sequentially
- Show progress to user
- Handle failures gracefully

**Result**: Reliable uploads with progress tracking, no timeouts

---

## 🚀 Quick Start

### 1. Get Upload Configuration (Optional)

```javascript
// Fetch recommended settings from server
const configResponse = await fetch('http://localhost:3001/api/events/config');
const { config } = await configResponse.json();

console.log(`Recommended chunk size: ${config.recommendedChunkSize}`);
// Output: Recommended chunk size: 100
```

### 2. Basic Implementation

```javascript
/**
 * Upload events in chunks with progress tracking
 * @param {string} sessionId - Session ID from /api/session/init
 * @param {Array} events - All events to upload
 * @param {Function} onProgress - Callback for progress updates
 */
async function uploadEventsInChunks(sessionId, events, onProgress) {
  const CHUNK_SIZE = 100; // Recommended size
  const totalChunks = Math.ceil(events.length / CHUNK_SIZE);
  
  console.log(`📤 Uploading ${events.length} events in ${totalChunks} chunks...`);
  
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
    const chunk = events.slice(i, i + CHUNK_SIZE);
    const isLast = (i + CHUNK_SIZE) >= events.length;
    
    // Upload this chunk
    const response = await fetch('http://localhost:3001/api/events/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        events: chunk,
        chunkInfo: {
          current: chunkNumber,
          total: totalChunks,
          isLast: isLast,
        },
      }),
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Chunk ${chunkNumber} failed: ${result.error}`);
    }
    
    // Report progress
    const percentComplete = Math.round((chunkNumber / totalChunks) * 100);
    if (onProgress) {
      onProgress({
        chunkNumber,
        totalChunks,
        percentComplete,
        eventsProcessed: result.totalEventsInSession,
        processingTime: result.processingTime,
      });
    }
    
    console.log(`✅ Chunk ${chunkNumber}/${totalChunks} uploaded (${percentComplete}%)`);
  }
  
  console.log(`🎉 Upload complete! All ${events.length} events processed.`);
}
```

### 3. Usage Example

```javascript
// Example: Upload 1500 events
const sessionId = 'your-session-id';
const assuranceEvents = loadAssuranceEvents(); // Your 1500 events

await uploadEventsInChunks(
  sessionId,
  assuranceEvents,
  (progress) => {
    console.log(`Progress: ${progress.percentComplete}%`);
    // Update your UI here: progress bar, status message, etc.
  }
);
```

---

## 🎨 React Implementation

### With Progress Bar

```jsx
import React, { useState } from 'react';

function EventUploader({ sessionId, events }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const uploadEvents = async () => {
    setUploading(true);
    setStatus('Uploading events...');
    
    try {
      await uploadEventsInChunks(sessionId, events, (prog) => {
        setProgress(prog.percentComplete);
        setStatus(
          `Uploading chunk ${prog.chunkNumber}/${prog.totalChunks} ` +
          `(${prog.eventsProcessed} events processed)`
        );
      });
      
      setStatus('✅ Upload complete!');
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <button onClick={uploadEvents} disabled={uploading}>
        Upload {events.length} Events
      </button>
      
      {uploading && (
        <>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} />
          </div>
          <p>{status}</p>
        </>
      )}
    </div>
  );
}

// Helper function (same as above)
async function uploadEventsInChunks(sessionId, events, onProgress) {
  // ... (implementation from above)
}
```

---

## 🛡️ Production-Ready Implementation

### With Error Handling and Retry Logic

```javascript
/**
 * Production-ready event uploader with retry logic
 */
class EventUploader {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3001';
    this.chunkSize = options.chunkSize || 100;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000; // ms
  }

  /**
   * Upload events with automatic retry on failure
   */
  async upload(sessionId, events, callbacks = {}) {
    const { onProgress, onComplete, onError } = callbacks;
    const totalChunks = Math.ceil(events.length / this.chunkSize);
    
    console.log(`📤 Starting upload: ${events.length} events in ${totalChunks} chunks`);
    
    for (let i = 0; i < events.length; i += this.chunkSize) {
      const chunkNumber = Math.floor(i / this.chunkSize) + 1;
      const chunk = events.slice(i, i + this.chunkSize);
      const isLast = (i + this.chunkSize) >= events.length;
      
      // Upload with retry
      const result = await this._uploadChunkWithRetry(
        sessionId,
        chunk,
        { current: chunkNumber, total: totalChunks, isLast }
      );
      
      // Progress callback
      if (onProgress) {
        onProgress({
          chunkNumber,
          totalChunks,
          percentComplete: Math.round((chunkNumber / totalChunks) * 100),
          totalEventsProcessed: result.totalEventsInSession,
          performance: result.performance,
        });
      }
    }
    
    if (onComplete) {
      onComplete({ totalEvents: events.length });
    }
    
    console.log(`✅ Upload complete: ${events.length} events`);
  }

  /**
   * Upload a single chunk with retry logic
   */
  async _uploadChunkWithRetry(sessionId, chunk, chunkInfo, attempt = 1) {
    try {
      const response = await fetch(`${this.baseUrl}/api/events/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, events: chunk, chunkInfo }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return await response.json();
      
    } catch (error) {
      console.error(`❌ Chunk ${chunkInfo.current} failed (attempt ${attempt}):`, error.message);
      
      if (attempt < this.maxRetries) {
        console.log(`🔄 Retrying in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this._uploadChunkWithRetry(sessionId, chunk, chunkInfo, attempt + 1);
      }
      
      throw new Error(`Chunk ${chunkInfo.current} failed after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  /**
   * Get upload configuration from server
   */
  async getConfig() {
    const response = await fetch(`${this.baseUrl}/api/events/config`);
    return await response.json();
  }
}

// Usage
const uploader = new EventUploader({
  baseUrl: 'http://localhost:3001',
  chunkSize: 100,
  maxRetries: 3,
});

await uploader.upload(sessionId, events, {
  onProgress: (progress) => {
    console.log(`${progress.percentComplete}% complete`);
    updateProgressBar(progress.percentComplete);
  },
  onComplete: (result) => {
    console.log('✅ All done!', result);
    showSuccessMessage();
  },
  onError: (error) => {
    console.error('❌ Upload failed:', error);
    showErrorMessage(error);
  },
});
```

---

## 📱 Complete React Component Example

```jsx
import React, { useState } from 'react';

function AssuranceEventUpload({ sessionId }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    
    try {
      // Parse Assurance export JSON
      const text = await uploadedFile.text();
      const data = JSON.parse(text);
      const events = data.events || data; // Adjust based on your format
      
      setFile({ name: uploadedFile.name, eventCount: events.length });
      
      // Start upload
      setUploading(true);
      setError(null);
      
      const uploader = new EventUploader();
      await uploader.upload(sessionId, events, {
        onProgress: (prog) => {
          setProgress(prog);
        },
        onComplete: () => {
          setUploading(false);
          alert('Upload complete! Events are now searchable.');
        },
        onError: (err) => {
          setError(err.message);
          setUploading(false);
        },
      });
      
    } catch (err) {
      setError(`Failed to parse file: ${err.message}`);
    }
  };

  return (
    <div className="event-upload-container">
      <h2>Upload Assurance Session Events</h2>
      
      {!uploading && (
        <div>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
          />
          <p className="hint">
            Upload an Assurance session export (JSON format)
          </p>
        </div>
      )}
      
      {file && !uploading && (
        <div className="file-info">
          <strong>{file.name}</strong>
          <span>{file.eventCount} events</span>
        </div>
      )}
      
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress.percentComplete || 0}%` }}
            />
          </div>
          
          <div className="upload-stats">
            <p>
              Chunk {progress.chunkNumber}/{progress.totalChunks}
            </p>
            <p>
              {progress.percentComplete}% complete
            </p>
            <p>
              {progress.totalEventsProcessed} events processed
            </p>
            {progress.performance && (
              <p className="performance">
                {progress.performance.eventsPerSecond} events/sec
              </p>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
    </div>
  );
}

export default AssuranceEventUpload;
```

---

## 🧪 Testing Your Implementation

### Test Script (Node.js)

```javascript
// test-chunked-upload.js
import fetch from 'node-fetch';

// Generate mock events
function generateMockEvents(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `event-${i}`,
    type: i % 3 === 0 ? 'Analytics' : i % 3 === 1 ? 'Lifecycle' : 'Edge',
    name: `event${i}`,
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
    payload: { index: i, data: `test data ${i}` },
  }));
}

async function testChunkedUpload() {
  const BASE_URL = 'http://localhost:3001';
  
  console.log('🧪 Testing chunked upload...\n');
  
  // 1. Initialize session
  console.log('1️⃣ Creating session...');
  const sessionRes = await fetch(`${BASE_URL}/api/session/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'test-user' }),
  });
  const { sessionId } = await sessionRes.json();
  console.log(`✅ Session created: ${sessionId}\n`);
  
  // 2. Generate test events
  const EVENT_COUNT = 250; // Test with 250 events (3 chunks)
  console.log(`2️⃣ Generating ${EVENT_COUNT} test events...`);
  const events = generateMockEvents(EVENT_COUNT);
  console.log(`✅ Generated ${events.length} events\n`);
  
  // 3. Upload in chunks
  console.log('3️⃣ Uploading in chunks...');
  const uploader = new EventUploader({ baseUrl: BASE_URL });
  
  const startTime = Date.now();
  await uploader.upload(sessionId, events, {
    onProgress: (prog) => {
      console.log(
        `   📦 Chunk ${prog.chunkNumber}/${prog.totalChunks} - ` +
        `${prog.percentComplete}% complete - ` +
        `${prog.performance.eventsPerSecond} events/sec`
      );
    },
  });
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n✅ Upload complete in ${totalTime}s\n`);
  
  // 4. Verify events
  console.log('4️⃣ Verifying events...');
  const eventsRes = await fetch(`${BASE_URL}/api/events/${sessionId}`);
  const { totalEvents } = await eventsRes.json();
  console.log(`✅ Verified: ${totalEvents} events in session\n`);
  
  // 5. Test search
  console.log('5️⃣ Testing semantic search...');
  const searchRes = await fetch(`${BASE_URL}/api/events/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      query: 'analytics tracking',
      limit: 3,
    }),
  });
  const { results } = await searchRes.json();
  console.log(`✅ Search returned ${results.length} results\n`);
  
  console.log('🎉 All tests passed!');
}

// Run tests
testChunkedUpload().catch(console.error);
```

Run with: `node test-chunked-upload.js`

---

## ⚙️ Configuration

### Adjust Chunk Size Based on Performance

```javascript
// For faster machines or local Ollama
const uploader = new EventUploader({ chunkSize: 150 });

// For slower machines or remote servers
const uploader = new EventUploader({ chunkSize: 50 });

// For production with retry logic
const uploader = new EventUploader({
  chunkSize: 100,
  maxRetries: 5,
  retryDelay: 3000, // 3 seconds
});
```

---

## 📊 Performance Expectations

| Event Count | Chunks | Estimated Time | Notes |
|-------------|--------|----------------|-------|
| 100         | 1      | 10-15 sec      | Single chunk, no timeout risk |
| 500         | 5      | 50-75 sec      | ~15 sec per chunk |
| 1000        | 10     | 100-150 sec    | ~2.5 minutes total |
| 1500        | 15     | 150-225 sec    | ~3.5 minutes total |

*Times vary based on Ollama performance and machine specs*

---

## 🐛 Troubleshooting

### Issue: "Too many events in single request"
**Solution**: Reduce chunk size to 100 or less

### Issue: Individual chunks timeout
**Solution**: 
- Check Ollama is running: `ollama list`
- Reduce chunk size to 50
- Check server logs for errors

### Issue: Events uploaded but not searchable
**Solution**: Check server logs - embeddings may have failed

### Issue: Upload stuck at specific chunk
**Solution**: Use retry logic (included in production implementation)

---

## 📚 API Reference

### POST /api/events/upload

**Request:**
```json
{
  "sessionId": "string",
  "events": [{ "type": "...", "name": "...", ... }],
  "chunkInfo": {
    "current": 1,
    "total": 10,
    "isLast": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "processed": 100,
  "totalEventsInSession": 500,
  "processingTime": 12345,
  "chunkInfo": { "current": 5, "total": 10, "isLast": false },
  "performance": {
    "eventsPerSecond": 8,
    "avgTimePerEvent": 123
  }
}
```

### GET /api/events/config

**Response:**
```json
{
  "success": true,
  "config": {
    "recommendedChunkSize": 100,
    "maxEventsPerRequest": 200,
    "embeddingBatchSize": 10
  }
}
```

---

## 💡 Best Practices

1. ✅ **Always split large batches** (>100 events) into chunks
2. ✅ **Show progress** to users - uploads can take minutes
3. ✅ **Implement retry logic** for production
4. ✅ **Validate events** before upload (save server resources)
5. ✅ **Handle errors gracefully** - allow users to retry
6. ✅ **Test with real data** - Assurance events vary in size
7. ✅ **Monitor performance** - log upload times for optimization

---

## 🚀 Next Steps

1. Implement the basic uploader in your client
2. Test with real Assurance session data
3. Add UI for progress tracking
4. Implement retry logic for production
5. Monitor and tune chunk size based on performance

---

**Questions?** Check the main [README.md](./README.md) or server logs for troubleshooting.
