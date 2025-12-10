# 🕷️ Web Crawler Guide

## Overview

The Web Crawler automatically discovers and loads documentation pages from a starting URL. Instead of manually providing every URL, you can crawl entire documentation sections with a single API call.

---

## Features

✅ **Recursive Link Discovery** - Follows links on pages  
✅ **Depth Control** - Limit how deep to crawl  
✅ **Page Limit** - Prevent runaway crawls  
✅ **Same-Domain Filter** - Only crawl within same domain  
✅ **Pattern Filtering** - Include/exclude specific URL patterns  
✅ **Deduplication** - Skip already loaded URLs  
✅ **Auto-Load** - Optionally load discovered pages immediately  
✅ **Progress Tracking** - See crawl statistics  

---

## API Endpoint

### **POST /api/knowledge/crawl**

Crawl a website and optionally load discovered documentation.

**Request Body:**
```json
{
  "startUrl": "https://developer.adobe.com/client-sdks/documentation/",
  "maxDepth": 2,              // How deep to crawl (default: 2)
  "maxPages": 30,             // Maximum pages to crawl (default: 30)
  "sameDomain": true,         // Only crawl same domain (default: true)
  "includePatterns": [        // Optional: URLs must match these
    "/documentation/"
  ],
  "excludePatterns": [        // Optional: URLs must NOT match these
    "/release-notes",
    "/tabs/"
  ],
  "autoLoad": true            // Load discovered URLs (default: true)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Crawled and loaded 25/30 documents",
  "crawl": {
    "startUrl": "https://...",
    "discovered": 30,
    "crawled": 28,
    "failed": 2,
    "skipped": 0
  },
  "load": {
    "attempted": 25,
    "succeeded": 23,
    "failed": 2,
    "errors": [...]
  }
}
```

---

## Use Cases

### 1. Load Entire Documentation Section

**Scenario:** Load all Adobe Analytics documentation

```bash
curl -X POST http://localhost:3001/api/knowledge/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://developer.adobe.com/client-sdks/documentation/adobe-analytics/",
    "maxDepth": 2,
    "maxPages": 50,
    "autoLoad": true
  }'
```

### 2. Preview URLs Before Loading

**Scenario:** See what URLs would be discovered

```bash
curl -X POST http://localhost:3001/api/knowledge/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://developer.adobe.com/client-sdks/documentation/",
    "maxDepth": 1,
    "maxPages": 20,
    "autoLoad": false
  }'
```

Response includes `urls` array with discovered URLs.

### 3. Filter Specific Content

**Scenario:** Only load API reference pages

```bash
curl -X POST http://localhost:3001/api/knowledge/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://developer.adobe.com/client-sdks/documentation/",
    "maxDepth": 2,
    "maxPages": 100,
    "includePatterns": ["/api-reference/"],
    "excludePatterns": ["/tabs/", "/images/"],
    "autoLoad": true
  }'
```

### 4. Shallow Crawl (Direct Links Only)

**Scenario:** Only crawl pages directly linked from start URL

```bash
curl -X POST http://localhost:3001/api/knowledge/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://developer.adobe.com/client-sdks/documentation/",
    "maxDepth": 1,
    "maxPages": 20,
    "autoLoad": true
  }'
```

---

## Parameters Explained

### **maxDepth**
- **Default:** 2
- **Description:** How many link levels to follow
- **Example:**
  - Depth 0: Only start URL
  - Depth 1: Start URL + directly linked pages
  - Depth 2: Start URL + linked pages + their links

### **maxPages**
- **Default:** 30
- **Description:** Maximum pages to crawl (safety limit)
- **Recommended:** 20-50 for documentation sections

### **sameDomain**
- **Default:** true
- **Description:** Only crawl URLs on the same domain
- **Recommended:** Keep true to avoid crawling external links

### **includePatterns**
- **Default:** [] (empty, include all)
- **Description:** URLs must contain at least one pattern
- **Example:** `["/documentation/", "/api/"]`

### **excludePatterns**
- **Default:** [] (empty, exclude none)
- **Description:** URLs must NOT contain any pattern
- **Example:** `["/release-notes", "/images/"]`

### **autoLoad**
- **Default:** true
- **Description:** Automatically load discovered URLs
- **false:** Just return URLs without loading

---

## Best Practices

### ✅ DO

- **Start with small scope** - Use `maxDepth: 1` and `maxPages: 10` first
- **Preview before loading** - Set `autoLoad: false` to see URLs
- **Use filters** - `includePatterns` to target specific content
- **Monitor progress** - Check response statistics
- **Be polite** - Don't crawl too aggressively (500ms delay built-in)

### ❌ DON'T

- **Crawl entire websites** - Focus on documentation sections
- **Set maxPages too high** - Start with 30-50
- **Skip patterns** - Use filters to avoid irrelevant pages
- **Ignore errors** - Check `load.errors` for failed URLs

---

## Automatic Filters

The crawler automatically skips:
- Static assets (`.jpg`, `.png`, `.css`, `.js`, etc.)
- Binary files (`.pdf`, `.zip`)
- API endpoints (`/api/`)
- Asset directories (`/images/`, `/assets/`)
- Already loaded URLs (checks knowledge base)

---

## Examples

### Load All Adobe Analytics Docs

```javascript
const response = await fetch('http://localhost:3001/api/knowledge/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startUrl: 'https://developer.adobe.com/client-sdks/documentation/adobe-analytics/',
    maxDepth: 2,
    maxPages: 40,
    autoLoad: true
  })
});

const result = await response.json();
console.log(`Loaded ${result.load.succeeded} documents`);
```

### Load All SDK Documentation

```bash
# This would discover and load most SDK docs
curl -X POST http://localhost:3001/api/knowledge/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "startUrl": "https://developer.adobe.com/client-sdks/documentation/",
    "maxDepth": 2,
    "maxPages": 100,
    "includePatterns": ["/documentation/"],
    "excludePatterns": ["/release-notes", "/tabs/", "/previous-versions"],
    "autoLoad": true
  }'
```

---

## Troubleshooting

### Crawler Returns Few URLs

**Problem:** Expected more URLs but only got a few

**Solutions:**
1. Increase `maxDepth` (try 2 or 3)
2. Increase `maxPages` 
3. Check `includePatterns` aren't too restrictive
4. Check if URLs were already loaded (check `skipped` count)

### Some Pages Failed to Load

**Problem:** `load.failed > 0`

**Solutions:**
1. Check `load.errors` for specific error messages
2. Some pages may return 404 or be protected
3. Retry failed URLs individually if needed

### Crawl is Slow

**Expected:** Each page takes ~500ms (politeness delay)

**For 30 pages:** ~15 seconds for crawl + loading time

---

## Performance

### Crawl Speed
- **Rate:** ~2 pages/second (with 500ms delay)
- **30 pages:** ~15 seconds crawl time
- **50 pages:** ~25 seconds crawl time

### Loading Speed
- **Per page:** 1-3 seconds (fetch + parse + embed)
- **Batch of 30:** 30-90 seconds total

### Recommendations
- **First crawl:** 10-20 pages (test)
- **Production:** 30-50 pages per section
- **Large sections:** Break into multiple crawls

---

## Monitoring

### Check What Was Crawled

```bash
curl http://localhost:3001/api/knowledge/documents | \
  python3 -c "import sys, json; docs=[d for d in json.load(sys.stdin)['documents'] if 'crawledFrom' in d]; print(f'Crawled docs: {len(docs)}')"
```

### See Crawl Statistics

Look for `crawledFrom` field in document metadata:
```bash
curl http://localhost:3001/api/knowledge/documents | grep "crawledFrom"
```

---

## Related Documentation

- [API Reference](./API_REFERENCE.md) - All endpoints
- [Development Guide](./DEVELOPMENT.md) - Extend the crawler
- [Knowledge Base Size](./KNOWLEDGE_BASE_SIZE.md) - Size management

---

## Future Enhancements

Potential future features:
- Sitemap.xml parsing
- Robots.txt respect
- Rate limiting configuration
- Concurrent crawling
- Resume partial crawls
- Schedule periodic updates

