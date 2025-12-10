# 📏 Knowledge Base Size Guidelines

## Current Status

**Vector Store Size:** 48KB  
**Documents Loaded:** 1  
**Status:** ✅ Safe to commit to git

---

## Size Growth Expectations

### Per Document Estimates

Based on Adobe Assurance Overview (5.4KB text):
- **Text:** 5.4KB
- **Storage:** 48KB total
- **Ratio:** ~9x overhead

**Formula:** `Total Size ≈ Text Size × 9`

### Projected Growth

| Documents | Avg Text Size | Est. Total Size | Git Safe? |
|-----------|---------------|-----------------|-----------|
| 1         | 5KB          | 48KB           | ✅ Yes    |
| 5         | 5KB          | 240KB          | ✅ Yes    |
| 10        | 10KB         | 900KB          | ✅ Yes    |
| 20        | 10KB         | 1.8MB          | ✅ Yes    |
| 50        | 10KB         | 4.5MB          | ✅ Yes    |
| 100       | 10KB         | 9MB            | ⚠️ Consider moving |
| 200       | 10KB         | 18MB           | ❌ Move to .gitignore |

---

## When to Move Out of Git

### ⚠️ Consider at ~10MB
- Git operations start slowing down
- Clone time increases noticeably
- Team members may have different KB needs

### ❌ Must move at ~50MB
- Git performance significantly impacted
- Large binary files don't belong in git
- Use external storage (S3, shared drive, etc.)

---

## How to Check Current Size

```bash
# Quick check
du -sh vector_store/

# Detailed breakdown
du -h vector_store/

# List all documents
curl http://localhost:3001/api/knowledge/documents | python3 -m json.tool
```

---

## Migration Path (When Needed)

### Step 1: Remove from Git Tracking

```bash
# Keep local files, stop tracking
git rm --cached -r vector_store/

# Commit the removal
git commit -m "chore: move vector store out of git tracking"

# Push
git push origin main
```

### Step 2: Update .gitignore

Uncomment the line in `.gitignore`:
```
vector_store/  # Now active
```

### Step 3: Document Setup for Team

Update README.md:
```markdown
## 📚 Knowledge Base Setup

After starting the server, load documents:

# Option 1: Load from shared location
cp -r /shared/drive/vector_store ./

# Option 2: Load documents via API
npm run load-docs  # Custom script
```

### Step 4: Consider Alternatives

**For Large Knowledge Bases (>50MB):**

1. **External Vector DB**
   - Chroma, Pinecone, Weaviate
   - Shared across team
   - Better for production

2. **Cloud Storage**
   - S3 + download on startup
   - Team syncs from cloud

3. **Document Bundle**
   - Store URLs/PDFs in git
   - Load on first run
   - Script: `npm run init-kb`

---

## Best Practices

### ✅ DO
- Monitor size regularly (`du -sh vector_store/`)
- Document what's loaded (`README.md`)
- Provide setup scripts for team
- Set size threshold alerts

### ❌ DON'T
- Commit >50MB vector stores to git
- Ignore growing repo size
- Forget to document migration
- Mix test/prod knowledge bases

---

## Automation Ideas

### Size Alert Script

```bash
# scripts/check-kb-size.sh
SIZE=$(du -sk vector_store/ | cut -f1)
THRESHOLD=10240  # 10MB in KB

if [ $SIZE -gt $THRESHOLD ]; then
  echo "⚠️  Vector store size: $((SIZE/1024))MB"
  echo "Consider moving to .gitignore"
fi
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/sh
SIZE=$(du -sk vector_store/ 2>/dev/null | cut -f1)
if [ ! -z "$SIZE" ] && [ $SIZE -gt 51200 ]; then
  echo "❌ Vector store too large (>50MB) for git"
  echo "Run: git rm --cached -r vector_store/"
  exit 1
fi
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
