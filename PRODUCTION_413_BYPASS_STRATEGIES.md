# 🚨 PRODUCTION 413 BYPASS STRATEGIES

## STRATEGY 1: REMOVE CLOUD RUN LIMITS COMPLETELY
```bash
gcloud run services update aescuvest-platform \
  --region us-central1 \
  --remove-annotations run.googleapis.com/body-size-limit \
  --set-env-vars DISABLE_BODY_SIZE_LIMIT=true
```

## STRATEGY 2: USE CLOUD STORAGE SIGNED URLS
Instead of uploading through Cloud Run:
1. Client requests signed URL from server
2. Client uploads directly to Cloud Storage  
3. Server processes file from Cloud Storage

## STRATEGY 3: STREAM-BASED UPLOAD
```javascript
// Don't buffer entire file in memory
app.post('/api/stream-upload', (req, res) => {
  const stream = fs.createWriteStream('upload.zip');
  req.pipe(stream);
  req.on('end', () => {
    res.json({ success: true });
  });
});
```

## STRATEGY 4: NGINX CONFIGURATION
If nginx is in front:
```nginx
server {
  client_max_body_size 0; # Unlimited
  proxy_request_buffering off;
  proxy_buffering off;
  
  location /api/upload {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    client_max_body_size 0;
  }
}
```

## STRATEGY 5: CHUNKED UPLOAD (CLIENT-SIDE)
```javascript
// Split file into 10MB chunks client-side
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
const chunks = Math.ceil(file.size / CHUNK_SIZE);

for (let i = 0; i < chunks; i++) {
  const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  await uploadChunk(chunk, i, chunks);
}
```

## STRATEGY 6: WEBSOCKET UPLOAD
```javascript
// Use WebSocket for unlimited size
const ws = new WebSocket('wss://api/ws-upload');
ws.send(file);
```

## DEPLOYMENT COMMANDS

### Option A: Complete Bypass
```bash
# Deploy with all limits removed
gcloud run deploy aescuvest-platform \
  --image gcr.io/PROJECT_ID/aescuvest-platform:latest \
  --platform managed \
  --region us-central1 \
  --memory 32Gi \
  --cpu 8 \
  --timeout 7200s \
  --set-env-vars BYPASS_413=true \
  --remove-annotations run.googleapis.com/body-size-limit
```

### Option B: Use App Engine Instead
```bash
# App Engine has different limits
gcloud app deploy app.yaml --version 413-fix
```

### Option C: Use Compute Engine
```bash
# No limits on Compute Engine
gcloud compute instances create aescuvest-vm \
  --machine-type e2-highmem-8 \
  --image-family debian-11 \
  --boot-disk-size 100GB
```