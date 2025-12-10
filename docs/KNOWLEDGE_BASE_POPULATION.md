# 📚 Knowledge Base Population Guide

This guide explains how to populate and manage the knowledge base using the saved URL list.

## Overview

The knowledge base is stored in **ChromaDB** (Docker volume), which is **not committed to Git**. Instead, we commit:
- ✅ `docs/knowledge-base-urls.json` - Complete list of URLs
- ✅ `scripts/populate-knowledge-base.js` - Script to load URLs
- ✅ `vector_store/documents.json` - Metadata only (small file)

This approach allows team members to reconstruct the exact same knowledge base from the URL list.

---

## 🚀 Quick Start

### 1. Fresh Setup (New Team Member)

```bash
# Start ChromaDB
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma:latest

# Start the server
npm start

# In another terminal, populate the knowledge base
npm run kb:populate
```

This will load all **137 documents** (~4,000 chunks) from the URL list.

---

## 📖 Usage

### Basic Commands

```bash
# Populate entire knowledge base
npm run kb:populate

# Custom batch size (default: 10)
node scripts/populate-knowledge-base.js --batch-size=5

# Custom delay between batches (default: 2000ms)
node scripts/populate-knowledge-base.js --delay=3000

# Force update existing documents
npm run kb:populate -- --force

# Populate specific categories only
node scripts/populate-knowledge-base.js --categories="XDM Schemas,Edge Network"
```

### Available Categories

- `XDM Schemas` (19 docs, 695 chunks)
- `Mobile Core` (44 docs, 1,289 chunks)
- `Identity` (11 docs, 616 chunks)
- `Edge Network` (10 docs, 615 chunks)
- `Journey Optimizer` (8 docs, 411 chunks)
- `Decisioning/Target` (3 docs, 408 chunks)
- `Getting Started` (18 docs, 247 chunks)
- `Lifecycle` (14 docs, 175 chunks)
- `Assurance` (8 docs, 97 chunks)
- `Analytics` (2 docs, 78 chunks)

---

## 🔄 Keeping URLs Updated

### Exporting Current URLs

After adding new documents to the knowledge base:

```bash
# Export URLs to knowledge-base-urls.json
npm run kb:export

# Commit the updated file
git add docs/knowledge-base-urls.json
git commit -m "docs: Update knowledge base URLs"
git push
```

### Manual Export

```bash
# Get current documents
curl -s http://localhost:3001/api/knowledge/documents | \
  jq '{metadata: {total: .total, date: (now|todate)}, urls: [.documents[].url]}' \
  > docs/knowledge-base-urls.json
```

---

## 📊 Monitoring Progress

The population script provides real-time feedback:

```
🕷️  Knowledge Base Population Script

📚 Found 137 URLs to load
📊 Expected chunks: 4013

🚀 Starting load process:
   Batch size: 10
   Total batches: 14
   Delay between batches: 2000ms

📦 Batch 1/14 (10 URLs)
   ✅ Mobile SDK overview (3 chunks)
   ✅ Getting Started (2 chunks)
   ...

=============================================================
📊 SUMMARY
=============================================================
✅ Successfully loaded: 137 documents
🧩 Total chunks created: 4013
=============================================================

🎉 Knowledge base population complete!
```

---

## 🛠️ Troubleshooting

### Server Not Reachable

```
❌ Server not reachable at http://localhost:3001
   Make sure the server is running: npm start
```

**Solution:** Start the server in another terminal: `npm start`

### ChromaDB Connection Error

```
❌ Failed to connect to ChromaDB server
```

**Solution:** Ensure ChromaDB is running:

```bash
docker ps | grep chromadb

# If not running, start it:
docker start chromadb

# Or create new container:
docker run -d --name chromadb \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma:latest
```

### Embedding Timeout

```
❌ Batch load failed: EOF
```

**Solution:** Reduce batch size and increase delay:

```bash
node scripts/populate-knowledge-base.js --batch-size=5 --delay=5000
```

### Memory Issues (Large Knowledge Base)

If Ollama runs out of memory:

```bash
# Restart Ollama
ollama restart

# Use smaller batches with longer delays
node scripts/populate-knowledge-base.js --batch-size=3 --delay=10000
```

---

## 🎯 Best Practices

### 1. **Version Control URLs, Not Data**

✅ **DO:**
- Commit `docs/knowledge-base-urls.json`
- Keep it updated when adding/removing docs
- Document major changes in commit messages

❌ **DON'T:**
- Commit ChromaDB data (in Docker volume)
- Commit large vector embeddings

### 2. **Categorize for Faster Iteration**

When developing/testing, load only needed categories:

```bash
# Load only XDM and Mobile Core for development
node scripts/populate-knowledge-base.js --categories="XDM Schemas,Mobile Core"
```

### 3. **Regular Updates**

Update the URL list when:
- Adding new documentation
- Removing outdated URLs
- Reorganizing categories

```bash
# After making changes to knowledge base
npm run kb:export
git add docs/knowledge-base-urls.json
git commit -m "docs: Update KB with new XDM schemas"
```

### 4. **Backup Strategy**

For production deployments:

```bash
# Export ChromaDB data
docker exec chromadb tar -czf - /chroma/chroma > chroma-backup.tar.gz

# Restore from backup
docker exec -i chromadb tar -xzf - < chroma-backup.tar.gz
```

---

## 📁 File Structure

```
assurance-ai-agent/
├── docs/
│   ├── knowledge-base-urls.json      # ✅ Committed (source of truth)
│   └── KNOWLEDGE_BASE_POPULATION.md  # This guide
├── scripts/
│   └── populate-knowledge-base.js    # ✅ Committed (population script)
├── vector_store/
│   └── documents.json                # ✅ Committed (metadata only)
└── [ChromaDB Docker volume]          # ❌ Not committed (data storage)
```

---

## 🔍 Advanced Usage

### Incremental Updates

Update only changed documents:

```bash
# Default behavior: skip unchanged URLs
npm run kb:populate

# Force update all documents
npm run kb:populate -- --force
```

The script uses content hashing to detect changes and only updates modified documents.

### Custom Server URL

```bash
# Point to remote server
SERVER_URL=https://staging.example.com node scripts/populate-knowledge-base.js
```

### Dry Run (Check Without Loading)

```bash
# See what would be loaded
node scripts/populate-knowledge-base.js --batch-size=1000 --dry-run
```

---

## 📈 Performance

**Expected Times:**

| Documents | Chunks | Batch Size | Delay | Total Time |
|-----------|--------|------------|-------|------------|
| 137 docs  | 4,013  | 10         | 2s    | ~5-8 min   |
| 137 docs  | 4,013  | 5          | 3s    | ~10-15 min |
| 50 docs   | 1,500  | 10         | 2s    | ~2-3 min   |

**Factors affecting speed:**
- Ollama embedding generation speed
- Network latency (for URL fetching)
- Document size (more chunks = slower)
- ChromaDB write performance

---

## 🎓 Tutorial: Adding New Documentation

### Step 1: Load the New URL

```bash
# Load a single URL
curl -X POST http://localhost:3001/api/knowledge/load-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://developer.adobe.com/new-feature",
    "title": "New Feature Documentation"
  }'
```

### Step 2: Export Updated URL List

```bash
npm run kb:export
```

### Step 3: Verify the Update

```bash
# Check the diff
git diff docs/knowledge-base-urls.json

# Should show your new URL added
```

### Step 4: Commit and Share

```bash
git add docs/knowledge-base-urls.json
git commit -m "docs: Add New Feature documentation to KB"
git push
```

Now team members can run `npm run kb:populate` to get the updated knowledge base!

---

## 💡 Tips

1. **Start Small:** Test with `--categories` for one category first
2. **Monitor Resources:** Watch Ollama memory usage during population
3. **Batch Wisely:** Use larger batches (15-20) if your system can handle it
4. **Document Changes:** Update `knowledge-base-urls.json` comments when reorganizing
5. **Test After Population:** Run `npm run test:rag` to verify everything works

---

## 🤝 Team Workflow

### For Knowledge Base Maintainers

```bash
# 1. Add new docs via API or web crawler
curl -X POST http://localhost:3001/api/knowledge/crawl ...

# 2. Export URLs
npm run kb:export

# 3. Commit and push
git add docs/knowledge-base-urls.json
git commit -m "docs: Add new SDK documentation"
git push
```

### For New Team Members

```bash
# 1. Clone repo
git clone git@github.com:sagar-sharma-adobe/assurance-ai-agent.git
cd assurance-ai-agent

# 2. Install dependencies
npm install

# 3. Start ChromaDB
docker run -d --name chromadb -p 8000:8000 -v chroma_data:/chroma/chroma chromadb/chroma

# 4. Start server
npm start

# 5. Populate KB (in another terminal)
npm run kb:populate

# 6. Test it
npm run test:rag
```

Done! 🎉

---

## 📞 Support

If you encounter issues:
1. Check `docs/DEPLOYMENT.md` for troubleshooting
2. Verify Docker and Ollama are running
3. Check server logs for errors
4. Try smaller batches with longer delays

For questions, contact the team or file an issue in the repo.

