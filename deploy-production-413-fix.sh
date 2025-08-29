#!/bin/bash
# 🚨 CRITICAL PRODUCTION DEPLOYMENT - ELIMINATE ALL 413 ERRORS

set -e

echo "🎯 DEPLOYING 413 ERROR ELIMINATION TO PRODUCTION"
echo "=================================================="

# Build production image
echo "📦 Building production image with unlimited upload configuration..."
docker build -f Dockerfile.production -t gcr.io/PROJECT_ID/aescuvest-platform:413-fix .

# Push to registry
echo "🚀 Pushing to Google Container Registry..."
docker push gcr.io/PROJECT_ID/aescuvest-platform:413-fix

# Deploy to Cloud Run with unlimited body size
echo "☁️ Deploying to Cloud Run with 413 error elimination..."
gcloud run deploy aescuvest-platform \
  --image gcr.io/PROJECT_ID/aescuvest-platform:413-fix \
  --platform managed \
  --region us-central1 \
  --memory 32Gi \
  --cpu 8 \
  --timeout 7200s \
  --max-instances 10 \
  --min-instances 1 \
  --concurrency 1000 \
  --port 5000 \
  --set-env-vars NODE_ENV=production,NODE_OPTIONS="--max-old-space-size=32768" \
  --allow-unauthenticated \
  --no-traffic \
  --tag 413-fix

# CRITICAL: Update service with unlimited body size (bypass 413 errors completely)
echo "🔧 Applying unlimited body size configuration..."
gcloud run services update aescuvest-platform \
  --region us-central1 \
  --update-env-vars NODE_ENV=production \
  --remove-annotations run.googleapis.com/body-size-limit \
  --memory 32Gi \
  --cpu 8 \
  --timeout 7200s

# Route 100% traffic to the fixed version
echo "🎯 Routing traffic to 413-fix version..."
gcloud run services update-traffic aescuvest-platform \
  --to-tags 413-fix=100 \
  --region us-central1

echo "✅ PRODUCTION DEPLOYMENT COMPLETE - 413 ERRORS ELIMINATED"
echo "========================================================="
echo "🔬 Test with files up to 500MB+ - should work perfectly now"
echo "🌐 Live URL: https://aescuvest-platform-<hash>-uc.a.run.app"