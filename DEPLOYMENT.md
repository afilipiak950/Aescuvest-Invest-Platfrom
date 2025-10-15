# Deployment Configuration Guide

## ✅ Pre-Deployment Checklist

### 1. Environment Variables (REQUIRED)
Set these in your deployment environment (Cloud Run, Replit Autoscale, etc.):

```bash
# Core API Keys (REQUIRED for agents to work)
OPENAI_API_KEY=sk-your-openai-key-here
MISTRAL_API_KEY=your-mistral-key-here

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:port/database

# Session Security (REQUIRED)
SESSION_SECRET=random-secure-string-at-least-32-chars

# Environment
NODE_ENV=production
PORT=5000
```

### 2. Build Configuration
The app is configured to:
- Build frontend: `vite build --mode production`
- Build backend: `esbuild server/index.ts → dist/index.js`
- Start command: `npm run start` → `node dist/index.js`

### 3. Server Configuration
- Binds to: `0.0.0.0:${PORT}` (from environment)
- Health check endpoint: `/health`
- Default port: 5000 (overridden by PORT env var)

## 🚀 Deployment Steps

### For Replit Autoscale Deployment:

1. **Set Secrets First**
   - Go to Tools → Secrets
   - Add each required environment variable listed above
   - Verify they're set for **deployment** (not just development)

2. **Build the App**
   ```bash
   npm run build
   ```

3. **Deploy**
   - Click "Deploy" button
   - Select "Autoscale" deployment
   - Verify environment variables are configured
   - Deploy

### For Cloud Run Deployment:

1. **Set Environment Variables**
   - Go to Cloud Run console
   - Select your service
   - Click "Edit & Deploy New Revision"
   - Under "Variables & Secrets", add all required variables

2. **Verify Configuration**
   - Container port: 5000 (or use PORT env var)
   - Memory: 1GB minimum
   - CPU: 1 minimum
   - Request timeout: 300 seconds
   - Max instances: 10 (or as needed)

3. **Deploy**
   - Build will happen automatically
   - Monitor deployment logs for errors

## 🔍 Debugging Deployment Issues

### Check Logs
Look for these startup messages:
```
🚀 Starting server initialization...
📊 Environment check: { NODE_ENV, PORT, DATABASE_URL, OPENAI_API_KEY }
✅ SERVER READY - Listening on 5000
```

### Common Issues:

1. **"Port already in use"**
   - Check if PORT env var is set correctly
   - Verify no other service is using the port

2. **"Database connection failed"**
   - Verify DATABASE_URL is correct
   - Check database credentials
   - Ensure database accepts connections from deployment IP

3. **"Missing API key"**
   - Verify OPENAI_API_KEY and MISTRAL_API_KEY are set
   - Check they're set for production deployment (not just dev)

4. **"Application not responding"**
   - Check health endpoint: `curl https://your-url/health`
   - Verify server binds to 0.0.0.0 (not localhost)
   - Check logs for startup errors

## 🧪 Testing Production Deployment

After deployment:

1. **Health Check**
   ```bash
   curl https://your-deployment-url/health
   ```
   Should return: `{"status":"healthy",...}`

2. **Upload Test**
   - Try uploading a document
   - Check if it appears in dataroom
   - Verify OCR processing starts

3. **Agent Test**
   - Assign documents to agents
   - Run a simple analysis
   - Check if results are generated

## 📋 Post-Deployment Verification

- [ ] Health endpoint responds (GET /health)
- [ ] Documents can be uploaded
- [ ] OCR processing works
- [ ] Agent assignment works
- [ ] Analysis can be triggered
- [ ] Results are saved to database
- [ ] UI loads correctly
- [ ] No errors in logs

## 🚨 Critical for Agents to Work

Agents REQUIRE:
1. ✅ `OPENAI_API_KEY` - For AI analysis
2. ✅ `MISTRAL_API_KEY` - For OCR text extraction
3. ✅ `DATABASE_URL` - To save/load data
4. ✅ Documents uploaded and assigned to agents
5. ✅ OCR processing completed on documents

Without these, agents will show 0% progress and no results.
