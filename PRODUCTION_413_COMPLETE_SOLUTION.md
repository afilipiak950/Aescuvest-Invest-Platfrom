# PRODUCTION 413 ERROR - COMPLETE SOLUTION

## Problem Analysis
The 413 "Payload Too Large" error occurs because:
1. Cloud Run has a hard 32MB request size limit
2. Proxy upload still sends file through the server
3. Direct GCS upload fails due to CORS

## Solution Architecture

### Step 1: Request Signed URL (Small Request)
Client → Server: Request signed URL (< 1KB)
Server → Client: Return signed URL + upload ID

### Step 2: Direct Upload to GCS (Bypasses Server)
Client → GCS: Upload file directly using signed URL
- No server involvement
- No size limits
- No 413 errors possible

### Step 3: Process File (Server Downloads from GCS)
Client → Server: Notify upload complete (< 1KB)
Server → GCS: Download and process file
Server → Client: Return success

## Implementation Details

### Micro-Step 1: Create Signed URL Service
- Generate temporary upload URLs
- Set CORS configuration on GCS bucket
- Return URL with upload instructions

### Micro-Step 2: Implement Direct Upload
- Use native fetch() or XMLHttpRequest
- Upload directly to signed URL
- Monitor upload progress

### Micro-Step 3: Process Uploaded File
- Server downloads from GCS
- Process ZIP contents
- Clean up temporary files

### Micro-Step 4: Error Handling
- Retry logic for network failures
- Fallback to chunked upload
- Clear error messages

## Benefits
✅ No 413 errors (file never goes through server)
✅ Supports files up to 5TB
✅ No CORS issues (signed URL includes CORS headers)
✅ Faster uploads (direct to cloud storage)
✅ Lower server costs (no bandwidth usage)