#!/bin/bash
# 🚨 ULTRA-AGGRESSIVE 413 ELIMINATION DEPLOYMENT

set -e

echo "🔥 ULTRA-AGGRESSIVE 413 ELIMINATION DEPLOYMENT"
echo "==============================================="
echo ""

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
echo "📍 Project ID: $PROJECT_ID"

# Step 1: Build with all fixes
echo "📦 STEP 1: Building production image with ULTRA-BYPASS..."
docker build -f Dockerfile.production -t gcr.io/$PROJECT_ID/aescuvest-platform:ultra-bypass-413 .

# Step 2: Push to registry
echo "🚀 STEP 2: Pushing to Google Container Registry..."
docker push gcr.io/$PROJECT_ID/aescuvest-platform:ultra-bypass-413

# Step 3: Deploy with MAXIMUM bypass configuration
echo "☁️ STEP 3: Deploying with ULTRA-BYPASS configuration..."
gcloud run deploy aescuvest-platform \
  --image gcr.io/$PROJECT_ID/aescuvest-platform:ultra-bypass-413 \
  --platform managed \
  --region us-central1 \
  --memory 32Gi \
  --cpu 8 \
  --timeout 7200s \
  --max-instances 10 \
  --min-instances 1 \
  --concurrency 1000 \
  --port 5000 \
  --set-env-vars NODE_ENV=production,NODE_OPTIONS="--max-old-space-size=32768",BYPASS_413=true,USE_ULTRA_BYPASS=true \
  --allow-unauthenticated \
  --no-traffic \
  --tag ultra-bypass

# Step 4: Remove ALL possible limiting annotations
echo "🔧 STEP 4: Aggressively removing ALL annotations..."
gcloud run services update aescuvest-platform \
  --region us-central1 \
  --remove-annotations \
    run.googleapis.com/body-size-limit,\
    run.googleapis.com/request-timeout,\
    run.googleapis.com/cpu-throttling,\
    run.googleapis.com/startup-cpu-boost,\
    run.googleapis.com/execution-environment

# Step 5: Apply maximum resources
echo "💪 STEP 5: Applying MAXIMUM resources..."
gcloud run services update aescuvest-platform \
  --region us-central1 \
  --timeout 7200s \
  --memory 32Gi \
  --cpu 8 \
  --cpu-throttling=false \
  --cpu-boost

# Step 6: Route ALL traffic to ultra-bypass version
echo "🎯 STEP 6: Routing 100% traffic to ULTRA-BYPASS version..."
gcloud run services update-traffic aescuvest-platform \
  --to-tags ultra-bypass=100 \
  --region us-central1

echo ""
echo "✅ ULTRA-FIX DEPLOYED SUCCESSFULLY"
echo "=================================="
echo ""
echo "🧪 TEST THE FIX:"
echo "1. Test with small file (1MB): Should work"
echo "2. Test with medium file (100MB): Should work"
echo "3. Test with large file (500MB+): Should work"
echo ""
echo "📊 MONITORING:"
echo "- Check logs: gcloud run logs read --service aescuvest-platform"
echo "- Look for: '🔧 BYPASSING body parsing for upload route'"
echo "- Look for: '🔧 MULTER: Processing file'"
echo ""
echo "🔍 DEBUG ENDPOINTS:"
echo "- /api/test-upload-limit - Test raw upload limits"
echo "- /api/test-multer-upload - Test multer handling"
echo "- /api/deals/[ID]/stream-upload - Stream-based upload"
echo "- /api/deals/[ID]/raw-upload - Raw body upload"
echo ""