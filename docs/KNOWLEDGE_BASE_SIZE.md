# 📏 Knowledge Base Size Guidelines

## Current Status (ChromaDB Architecture)

**Vector Store:** ChromaDB (Docker volume `chroma_data`)  
**Metadata File:** `vector_store/documents.json` (833 bytes)  
**Documents Loaded:** 2  
**Git Committed:** ✅ Only metadata file (< 1KB)

---

## 🎯 New Architecture Benefits

### ChromaDB Storage

**Vector embeddings** are stored in ChromaDB's Docker persistent volume:
- ✅ **Not in git** - Docker volume `chroma_data` handles all vector data
- ✅ **Scalable** - Can grow to GB without affecting git
- ✅ **Shareable** - Export/import Docker volumes for team sharing

**Only metadata** (`vector_store/documents.json`) is in git:
- Contains document titles, URLs, chunk counts, hashes
- Stays small (< 1KB per 100 documents)
- Always safe to commit

### Size Comparison

| Storage Type | Old (HNSWLib) | New (ChromaDB) |
|--------------|---------------|----------------|
| Vector data  | In git ❌     | Docker volume ✅ |
| Metadata     | In git ✅     | In git ✅ |
| Git impact   | Grows with docs | Minimal |
| Team sharing | Slow (git)    | Fast (volume export) |

---

## Metadata File Growth

The `documents.json` file grows linearly with document count:

| Documents | Metadata Size | Git Safe? |
|-----------|---------------|-----------|
| 10        | ~2KB         | ✅ Yes    |
| 100       | ~20KB        | ✅ Yes    |
| 1,000     | ~200KB       | ✅ Yes    |
| 10,000    | ~2MB         | ✅ Yes    |

**Verdict:** Metadata will always be safe to commit 🎉

---

## How to Monitor Size

### Metadata File (Committed to Git)

```bash
# Check metadata file size (always small)
du -sh vector_store/documents.json

# View all loaded documents
curl http://localhost:3001/api/knowledge/documents | python3 -m json.tool
```

### ChromaDB Vector Store (Docker Volume)

```bash
# Check Docker volume size
docker system df -v | grep chroma_data

# Or inspect the volume
docker volume inspect chroma_data

# View ChromaDB logs
docker logs chromadb
```

---

## Team Sharing Options

### Option 1: Share Docker Volume (Recommended)

**Export volume:**
```bash
# Create backup
docker run --rm \
  -v chroma_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/chroma_backup.tar.gz -C /data .

# Share chroma_backup.tar.gz with team
```

**Import volume:**
```bash
# Restore on another machine
docker volume create chroma_data
docker run --rm \
  -v chroma_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/chroma_backup.tar.gz -C /data
```

### Option 2: Share Metadata + Reload Docs

**Share:**
- Commit `vector_store/documents.json` to git (already done)
- Team clones repo

**Team Setup:**
```bash
# Start ChromaDB
docker start chromadb

# Run reload script (loads from metadata URLs)
npm run reload-docs  # TODO: Create this script
```

### Option 3: External ChromaDB Server

**For production or large teams:**

1. **Hosted ChromaDB**
   - Deploy ChromaDB to cloud (Docker, K8s)
   - Update `CHROMA_URL` in `.env`
   - All team members connect to same instance

2. **Managed Service**
   - Store URLs/PDFs in git
   - Load on first run
   - Script: `npm run init-kb`

---

## Best Practices

### ✅ DO
- Keep metadata (`documents.json`) in git
- Monitor Docker volume size periodically
- Document loaded documents in README
- Export/share Docker volumes for team setup
- Use URL-based document loading (reproducible)

### ❌ DON'T
- Commit Docker volumes to git (unnecessary)
- Forget to start ChromaDB before server
- Mix development and production ChromaDB instances
- Delete Docker volume without backup

---

## Automation Ideas

### Docker Volume Backup Script

```bash
# scripts/backup-chromadb.sh
#!/bin/bash
BACKUP_FILE="chroma_backup_$(date +%Y%m%d_%H%M%S).tar.gz"

docker run --rm \
  -v chroma_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/$BACKUP_FILE -C /data .

echo "✅ Backup created: $BACKUP_FILE"
```

### Document Reload Script

```bash
# scripts/reload-docs.sh
#!/bin/bash
# Load all documents from metadata file

DOCS=$(cat vector_store/documents.json | jq -r '.documents[] | select(.type=="url") | .url')

for URL in $DOCS; do
  echo "Loading: $URL"
  curl -X POST http://localhost:3001/api/knowledge/load-url \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\"}"
done
```

---

## Current Decision

**✅ Keeping in Git**
- PoC phase
- Size: 48KB (minimal)
- Team convenience
- Ready-to-go setup

**🔄 Review When:**
- Size exceeds 10MB
- Team needs custom KBs
- Moving to production
- Clone time becomes noticeable

---

**Last Updated:** Dec 10, 2025  
**Current Size:** 48KB (1 document)  
**Next Review:** When 20+ documents loaded or >5MB
