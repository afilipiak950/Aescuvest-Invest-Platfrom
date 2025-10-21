# 🚀 GCS Migration Guide - In Depth Explanation

## **The Problem**

Your deployed app at https://aescuvest.replit.app can't access PDF documents because:
- **100% of your documents** (all 100 files) are stored with local filesystem paths like:
  - `extracted/OneDrive_1_30.7.2025/3.0 Commercial/...`
  - `uploads/deal-1/filename.pdf`
- **Replit deployments wipe the filesystem** on every deploy
- Only Google Cloud Storage (GCS) paths persist in production

## **The Solution - Automatic Migration Script**

### **What the Migration Script Does**

#### **Phase 1: Discovery** 🔍
1. Scans your PostgreSQL database for all documents
2. Identifies which documents need migration (local paths vs GCS paths)
3. Shows you statistics before starting:
   ```
   Total documents: 100
   Already in GCS: 0
   Need migration: 100
   ```

#### **Phase 2: Migration** 📤
For each document:
1. **Finds the local file** using smart path resolution:
   - `extracted/...` → looks in `uploads/extracted/...`
   - `uploads/...` → looks in `uploads/...`
   - Handles nested folder structures automatically

2. **Uploads to Google Cloud Storage**:
   - Uses your existing GCS credentials
   - Creates organized path: `gs://bucket/deals/{dealId}/documents/{timestamp}_{filename}`
   - Keeps original filename for easy identification

3. **Updates database**:
   - Changes path from `extracted/file.pdf` → `gs://aescuvest-documents/deals/3/documents/1234567890_file.pdf`
   - Your existing analysis data stays intact
   - Agent assignments remain unchanged

4. **Logs everything**:
   - Creates `gcs-migration-log.json` with complete record
   - Tracks: success, failures, skipped files
   - Allows resume if interrupted

#### **Phase 3: Verification** ✅
- Shows final statistics
- Confirms files are accessible in GCS
- Provides rollback option if needed

### **Safety Features**

1. **Resume Capability**: If migration crashes at file 47/100, just re-run and it skips already-migrated files

2. **Rollback Function**: Can restore all original paths if something goes wrong
   ```bash
   npx tsx server/migrate-to-gcs.ts rollback
   ```

3. **Detailed Logging**: Every operation logged to `gcs-migration-log.json`
   ```json
   {
     "documentId": 17,
     "originalPath": "extracted/file.pdf",
     "gcsPath": "gs://bucket/deals/3/documents/123_file.pdf",
     "status": "success",
     "timestamp": "2025-10-21T13:45:00.000Z"
   }
   ```

4. **Non-Destructive**: Keeps local files until you confirm migration worked

5. **Handles Errors Gracefully**: 
   - File not found? → Skips with warning
   - Upload fails? → Logs error, continues with next file
   - Network issue? → Can resume from where it stopped

### **How to Use It**

#### **Step 1: Verify Current Status**
```bash
npx tsx server/migrate-to-gcs.ts verify
```
This shows:
- How many documents need migration
- Current GCS vs local split
- Sample problematic paths

#### **Step 2: Run Migration**
```bash
npx tsx server/migrate-to-gcs.ts migrate
```
This will:
- Process all 100 documents automatically
- Show live progress: `[47/100] Processing: filename.pdf`
- Take approximately 2-5 minutes depending on file sizes
- Create detailed log file

#### **Step 3: Verify Success**
```bash
npx tsx server/migrate-to-gcs.ts verify
```
Should show:
```
In GCS: 100 ✅
Still local: 0 ✅
```

#### **Step 4: Deploy & Test**
1. Deploy your app: Click "Deploy" button
2. Visit https://aescuvest.replit.app
3. Open a deal with documents
4. Click on a PDF → Should load instantly from GCS!

### **What Happens Behind the Scenes**

#### **Before Migration:**
```
Database: document.path = "extracted/folder/file.pdf"
Filesystem: /home/runner/workspace/uploads/extracted/folder/file.pdf
Production: ❌ File doesn't exist (filesystem wiped)
```

#### **During Migration:**
```javascript
1. Read file from local path
2. Upload to GCS using gcsService.uploadFile()
3. GCS returns: "gs://aescuvest-documents/deals/3/documents/1234_file.pdf"
4. Update database: SET path = "gs://..."
```

#### **After Migration:**
```
Database: document.path = "gs://aescuvest-documents/deals/3/documents/1234_file.pdf"
Filesystem: Not needed anymore
Production: ✅ File streams directly from GCS
```

### **Technical Details**

#### **Upload Process**
The script uses your existing `googleCloudStorage.ts` service:
```typescript
await gcsService.uploadFile(
  localPath,      // "/workspace/uploads/extracted/file.pdf"
  dealId,         // 3
  fileName        // "file.pdf"
);
// Returns: "gs://aescuvest-documents/deals/3/documents/1234567890_file.pdf"
```

#### **Database Update**
```sql
UPDATE documents 
SET path = 'gs://aescuvest-documents/deals/3/documents/1234_file.pdf'
WHERE id = 17;
```

#### **GCS Storage Structure**
```
aescuvest-documents/
  ├── deals/
  │   ├── 1/
  │   │   └── documents/
  │   │       ├── 1760123456789_agreement.pdf
  │   │       └── 1760123456790_patent.pdf
  │   ├── 3/
  │   │   └── documents/
  │   │       └── 1760123456791_pitch-deck.pdf
```

### **Expected Output Example**

```
🚀 STARTING GCS MIGRATION
======================================================================

📊 MIGRATION STATS:
Total documents: 100
Already in GCS: 0
Need migration: 100

🔄 Starting migration of 100 documents...

[1/100] Processing: Neteera - Warrant - James Egan - EXECUTED - 210111.pdf
  Original path: extracted/OneDrive_1_30.7.2025/3.0 Commercial/...
  📁 File size: 2.34 MB
  ✅ SUCCESS: Uploaded to gs://aescuvest-documents/deals/1/documents/1729512345678_Neteera...pdf

[2/100] Processing: Engagement Letter - Audit.pdf
  Original path: extracted/OneDrive_1_30.7.2025/3.0 Commercial/...
  📁 File size: 1.87 MB
  ✅ SUCCESS: Uploaded to gs://aescuvest-documents/deals/1/documents/1729512345679_Engagement...pdf

...

[100/100] Processing: Final document.pdf
  ✅ SUCCESS: Uploaded to gs://...

======================================================================
🎉 MIGRATION COMPLETE

✅ Successfully migrated: 98
⏭️  Skipped (file not found): 2
❌ Failed: 0

📋 Full migration log saved to: gcs-migration-log.json

✅ Your production deployment will now have access to migrated files!
Deploy at: https://aescuvest.replit.app
======================================================================
```

### **FAQ**

**Q: Will this delete my local files?**  
A: No. Local files remain untouched. Only database paths are updated.

**Q: What if migration fails halfway?**  
A: Just re-run the command. It will skip already-migrated files and continue.

**Q: Can I undo the migration?**  
A: Yes! Run `npx tsx server/migrate-to-gcs.ts rollback`

**Q: How long will it take?**  
A: Approximately 2-5 minutes for 100 files, depending on file sizes.

**Q: Will my analysis data be lost?**  
A: No. Only the `path` field changes. All OCR text, AI summaries, and agent analyses remain intact.

**Q: What if some files are missing?**  
A: The script will skip them with a warning and continue with the rest.

### **Next Steps After Migration**

1. ✅ Verify migration completed successfully
2. ✅ Deploy your app (publish button)
3. ✅ Test PDF viewing in production
4. ✅ New uploads will automatically use GCS
5. ✅ You're production-ready!

### **Troubleshooting**

**Issue: "File not found"**
- Some files may have been deleted or moved
- The script logs these and continues
- You can re-upload missing files manually

**Issue: "GCS upload failed"**
- Check your GCS credentials: `GOOGLE_CLOUD_STORAGE_BUCKET` and `GOOGLE_CLOUD_STORAGE_KEY`
- Verify they're set as Replit secrets
- Contact Replit support if credentials are invalid

**Issue: "Database update failed"**
- Check PostgreSQL connection
- Ensure database is accessible
- Restart and try again
