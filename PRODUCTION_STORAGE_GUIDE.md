# Google Cloud Storage Integration Guide

## Why Google Cloud Storage is Required

### Development Environment
- Files stored in local `uploads/` folder
- Persistent on your development machine
- Works perfectly for testing

### Production Environment (Cloud Run)
- **Containers are ephemeral** - restart = data loss
- **No shared filesystem** between instances
- **No persistent storage** on containers
- Files uploaded to one instance aren't accessible from others

## Setup Instructions

### 1. Create GCS Bucket

```bash
# Create bucket for document storage
gsutil mb -p YOUR_PROJECT_ID -c STANDARD -l us-central1 gs://aescuvest-documents/

# Set proper permissions
gsutil iam ch serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com:objectAdmin gs://aescuvest-documents/
```

### 2. Environment Variables

Add to your production environment:

```env
# Google Cloud Storage
GCS_BUCKET_NAME=aescuvest-documents
GCP_PROJECT_ID=your-project-id
NODE_ENV=production
```

### 3. Install Dependencies

```bash
npm install @google-cloud/storage
```

### 4. Service Account Permissions

Your Cloud Run service account needs:
- `Storage Object Admin` on the bucket
- `Storage Object Viewer` for read access

### 5. How It Works

The `gcsStorage` service automatically:

**In Development:**
- Stores files locally in `uploads/`
- Uses filesystem for all operations
- No cloud dependencies needed

**In Production:**
- Uploads files to Google Cloud Storage
- Generates secure URLs for access
- Handles all file operations in the cloud
- Automatically cleans up local temp files

## Usage Examples

```typescript
import { gcsStorage } from './services/gcsStorage';

// Upload a file
const cloudPath = await gcsStorage.uploadFile(
  localFilePath,  // Local file to upload
  'document.pdf'  // Destination name
);
// Returns: 'gs://aescuvest-documents/uploads/123456-document.pdf'

// Download a file
const buffer = await gcsStorage.downloadFile(cloudPath);

// Get temporary access URL
const url = await gcsStorage.getSignedUrl(cloudPath, 60); // 60 minutes

// Delete a file
await gcsStorage.deleteFile(cloudPath);
```

## Integration Points

Files need GCS integration at these points:

1. **Document Upload** (`/api/upload/document`)
   - After OCR processing
   - Store processed file in GCS

2. **ZIP Upload** (`/api/deals/:dealId/data-room/upload-zip`)
   - After extraction
   - Store all extracted files in GCS

3. **Chunked Upload** (`/api/deals/:dealId/chunked-upload/complete`)
   - After reassembly
   - Store final file in GCS

4. **Document Viewing** 
   - Generate signed URLs for PDFs
   - Temporary access for browser

5. **Document Download**
   - Fetch from GCS
   - Stream to user

## Database Changes

Update document records to store GCS paths:

```sql
-- Documents table stores GCS path
content: 'gs://aescuvest-documents/uploads/123456-document.pdf'

-- Instead of local path
content: '/uploads/document.pdf'
```

## Migration Strategy

1. **New uploads** → Use GCS immediately
2. **Existing files** → Migrate gradually or on-demand
3. **Fallback** → Check both GCS and local paths

## Cost Considerations

- **Storage**: ~$0.02/GB per month
- **Operations**: ~$0.005 per 10,000 operations
- **Bandwidth**: Free within same region
- **Typical cost**: <$10/month for most use cases

## Testing

### Local Testing with GCS
```bash
# Set credentials for local testing
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
export NODE_ENV=production
npm run dev
```

### Production Deployment
```bash
# Deploy with GCS enabled
gcloud run deploy aescuvest-platform \
  --set-env-vars GCS_BUCKET_NAME=aescuvest-documents \
  --set-env-vars GCP_PROJECT_ID=your-project-id \
  --set-env-vars NODE_ENV=production
```

## Benefits

✅ **Persistent Storage** - Files survive container restarts
✅ **Scalable** - Unlimited storage capacity
✅ **Multi-Instance** - All instances access same files
✅ **Secure** - Signed URLs for temporary access
✅ **Cost-Effective** - Pay only for what you use
✅ **Reliable** - 99.95% availability SLA

## Summary

Google Cloud Storage is **essential** for production because Cloud Run containers don't have persistent storage. The integration is seamless - development uses local storage, production automatically uses GCS.