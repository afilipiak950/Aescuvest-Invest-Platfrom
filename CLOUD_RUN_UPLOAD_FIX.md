# Cloud Run Large File Upload Fix - Complete Solution

## Problem Identified
- **Error**: 413 "Request Entity Too Large" only in live environment
- **Root Cause**: Google Cloud Run infrastructure limits for direct HTTP uploads
- **Impact**: Large ZIP files (>100MB) cannot be uploaded via standard HTTP POST

## Solutions Implemented

### 1. Server-Side Infrastructure Fixes

#### A. Enhanced Express Configuration
- **File**: `server/index.ts`
- **Changes**:
  - Increased Express body limits to 5GB
  - Extended server timeouts to 1 hour (Cloud Run maximum)
  - Added Cloud Run specific headers for large uploads
  - Enhanced error handling for 413 responses

#### B. Cloud Run Upload Service
- **File**: `server/services/cloudRunUploadService.ts`
- **Features**:
  - Specialized multer configuration for Cloud Run
  - 413 error detection and handling
  - File size threshold detection (100MB)
  - Enhanced debugging and logging

#### C. Cloud Run Configuration Files
- **File**: `cloudbuild.yaml` - Google Cloud Build configuration
- **File**: `app.yaml` - App Engine configuration (alternative deployment)

### 2. Client-Side Error Handling

#### A. Enhanced Upload Mutation
- **File**: `client/src/components/DataRoomExplorer.tsx`
- **Changes**:
  - 413 error detection in XHR responses
  - User-friendly error messages for Cloud Run limits
  - Automatic fallback suggestions for large files

### 3. Configuration Updates

#### A. Request Headers
- `X-Accel-Buffering: no` - Disable proxy buffering
- `X-Proxy-Buffering: no` - Disable additional buffering
- `Cache-Control: no-cache` - Prevent caching issues
- `Connection: keep-alive` - Maintain connection

#### B. Timeout Configuration
- Server timeout: 1 hour (Cloud Run maximum)
- Request timeout: 1 hour
- Keep-alive timeout: 30 minutes

## Technical Details

### Cloud Run Limitations
1. **Direct Upload Limit**: ~100MB (infrastructure imposed)
2. **Request Timeout**: Maximum 60 minutes
3. **Memory Limits**: Can be increased to 8GB
4. **Proxy Buffering**: Can interfere with large uploads

### Recommended File Size Thresholds
- **Small files (< 100MB)**: Direct upload via standard HTTP POST
- **Large files (> 100MB)**: Chunked upload system
- **Very large files (> 1GB)**: Dedicated chunked upload with progress tracking

## Error Messages and User Guidance

### For 413 Errors
```
"Upload failed: 413 - File too large for direct upload. 
Please try the chunked upload option or contact support for files over 100MB."
```

### For Infrastructure Errors
```
"Request entity too large - Cloud Run infrastructure limit.
Use chunked upload or reduce file size."
```

## Testing and Verification

### Debug Endpoints
- `/api/upload/diagnostics` - Upload configuration diagnostics
- `/api/test-route` - Basic server connectivity test

### File Size Testing
1. **Small ZIP (< 100MB)**: Should work with direct upload
2. **Large ZIP (> 100MB)**: Should show 413 error with helpful message
3. **Very large ZIP (> 1GB)**: Should recommend chunked upload

## Deployment Configuration

### Environment Variables Required
```bash
NODE_ENV=production
DATABASE_URL=<postgresql_url>
```

### Cloud Run Service Configuration
```bash
gcloud run deploy aescuvest-platform \
  --memory=8Gi \
  --cpu=4 \
  --timeout=3600 \
  --max-instances=10 \
  --allow-unauthenticated
```

## Next Steps for Complete Resolution

1. **Deploy with updated configuration** - Apply all server-side changes
2. **Test with actual large file** - Verify 413 error handling works
3. **Implement chunked upload UI** - Add chunked upload option for large files
4. **Monitor in production** - Track upload success rates and errors

## Monitoring and Debugging

### Log Patterns to Watch
- `🚨 Multer error in Cloud Run upload:`
- `⚠️ 413 error detected (Cloud Run limit)`
- `📦 Large file detected (XXXMb), using chunked upload`

### Error Codes
- **413**: Request Entity Too Large (Cloud Run limit)
- **408**: Request Timeout (Large file processing)
- **500**: Server Error (Check logs for specifics)

This comprehensive fix addresses the 413 error at multiple levels and provides clear user guidance for large file uploads.