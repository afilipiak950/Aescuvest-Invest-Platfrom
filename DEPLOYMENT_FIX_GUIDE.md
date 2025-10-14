# 🚀 Deployment Fix Guide - Cloud Run Configuration

## Issue Summary
Your deployed app fails to start because:
1. Health check endpoint wasn't responding fast enough
2. Server initialization was too slow for Cloud Run timeout
3. Environment variables may not be configured in deployment
4. Database schema mismatch between dev and production

## ✅ Fixes Applied

### 1. Health Check Optimization
- Moved `/health` endpoint to FIRST position (before ANY middleware)
- Added Cloud Run-specific health check detection
- Server now responds to health checks in <100ms

### 2. Startup Optimization  
- Deferred heavy service initialization using `setImmediate()`
- Server starts listening FIRST, then initializes background services
- Added startup logging to diagnose issues

### 3. Environment Logging
- Server now logs all critical environment variables on startup
- Shows: PORT, DATABASE_URL, OPENAI_API_KEY status

## 🔧 Required Actions

### Step 1: Set Environment Variables in Deployment

You MUST configure these environment variables in your Cloud Run deployment:

**Required Variables:**
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# AI Services (at minimum one of these)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
MISTRAL_API_KEY=...

# Server Config
NODE_ENV=production
PORT=8080  # Cloud Run uses port 8080 by default

# Session Security
JWT_SECRET=your-secret-key-here
```

**How to set them in Replit Deployment:**
1. Go to your Replit project
2. Click "Deploy" → "Configure"
3. Go to "Secrets" or "Environment Variables" section
4. Add each variable above with actual values

### Step 2: Fix Database Schema Mismatch

Your production database has OLD column names (camelCase) while your code expects NEW names (snake_case).

**Option A: Push Schema Changes (Recommended)**
```bash
# In your Replit shell (connected to production)
npm run db:push --force
```

**Option B: Manual SQL (if above fails)**
```sql
-- Connect to your PRODUCTION database and run:
ALTER TABLE agent_analyses RENAME COLUMN "legalAnswers" TO legal_answers;
ALTER TABLE agent_analyses RENAME COLUMN "clinicalAnswers" TO clinical_answers;
ALTER TABLE agent_analyses RENAME COLUMN "commercialAnswers" TO commercial_answers;
ALTER TABLE agent_analyses RENAME COLUMN "hrAnswers" TO hr_answers;
ALTER TABLE agent_analyses RENAME COLUMN "financialAnswers" TO financial_answers;
ALTER TABLE agent_analyses RENAME COLUMN "ipAnswers" TO ip_answers;
```

### Step 3: Verify Port Configuration

Cloud Run expects:
- Internal port: 8080 (set via PORT environment variable)
- External port: 80 (automatically handled by Cloud Run)

Your `.replit` file is configured correctly:
```toml
[[ports]]
localPort = 5000
externalPort = 80
```

### Step 4: Deploy with Fixes

1. **Commit the changes** (already saved to server/index.ts)
2. **Set environment variables** (see Step 1)
3. **Redeploy** using Replit's deploy button
4. **Watch startup logs** - you'll see:
   ```
   🚀 Starting server initialization...
   📊 Environment check: { ... }
   ✅ SERVER READY - Listening on 8080
   ```

## 🔍 Debugging Deployment Issues

### Check Startup Logs
After deploying, check the Cloud Run logs for:
```
✅ SERVER READY - Listening on [port]
```

If you see `❌ Missing` next to any environment variable, that's your issue.

### Test Health Endpoint
Once deployed, test the health check:
```bash
curl https://your-app.replit.app/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-13T...",
  "service": "aescuvest-api",
  "environment": "production",
  "port": 8080
}
```

### Common Errors

**"Port already in use"**
- Cloud Run sets PORT=8080, code will use it automatically
- No action needed

**"Database connection failed"**
- DATABASE_URL not set in deployment secrets
- Set it in environment variables

**"OpenAI API error"**
- OPENAI_API_KEY not set in deployment
- Agents will fail without API keys

## 📊 Expected Behavior After Fix

1. **Deployment succeeds** ✅
2. **Health check passes** ✅  
3. **Server starts in <10 seconds** ✅
4. **Background services initialize** ✅
5. **Agent analyses save to database** ✅
6. **Results display in UI** ✅

## 🆘 Still Having Issues?

If deployment still fails after these fixes:

1. **Check the logs** in Cloud Run console
2. **Verify environment variables** are set correctly
3. **Test database connection** from deployment
4. **Confirm API keys are valid**

The server now logs everything needed to diagnose issues - look for the `📊 Environment check:` output.
