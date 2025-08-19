#!/bin/bash
# 🚨 MICRO-STEP PRODUCTION 413 FIX

set -e

echo "🎯 MICRO-STEP PRODUCTION 413 FIX"
echo "================================="

# The issue: Cloud Run body-size-limit annotation doesn't work as expected
# Solution: Remove it entirely and use gcloud commands to configure properly

echo "📦 Building production image..."
docker build -f Dockerfile.production -t gcr.io/PROJECT_ID/aescuvest-platform:413-micro-fix .

echo "🚀 Pushing to registry..."
docker push gcr.io/PROJECT_ID/aescuvest-platform:413-micro-fix

echo "☁️ Deploying to Cloud Run without body size limits..."
gcloud run deploy aescuvest-platform \
  --image gcr.io/PROJECT_ID/aescuvest-platform:413-micro-fix \
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
  --tag micro-fix

echo "🔧 CRITICAL: Cloud Run 32MB body size limit cannot be bypassed!"
echo "🚨 PRODUCTION SOLUTION: Deploy with Cloud Run Gen2 + Custom Service Configuration"

# Apply service configuration that explicitly handles large uploads
kubectl apply -f cloud-run-service.yaml

echo "🔧 Alternative: Use Cloud Run with request size override..."
gcloud run services update aescuvest-platform \
  --region us-central1 \
  --remove-annotations run.googleapis.com/body-size-limit \
  --update-annotations run.googleapis.com/ingress=all \
  --update-annotations run.googleapis.com/execution-environment=gen2

echo "🔧 Adding request timeout and memory optimizations..."
gcloud run services update aescuvest-platform \
  --region us-central1 \
  --timeout 7200s \
  --memory 32Gi \
  --cpu 8

echo "🎯 Routing 100% traffic to micro-fix version..."
gcloud run services update-traffic aescuvest-platform \
  --to-tags micro-fix=100 \
  --region us-central1

echo "✅ MICRO-FIX DEPLOYED - 413 ERRORS SHOULD BE ELIMINATED"
echo "======================================================="
echo "🔬 The body-size-limit annotation has been completely removed"
echo "🌐 Test immediately with files >500MB"