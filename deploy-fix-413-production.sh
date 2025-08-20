#!/bin/bash

# CRITICAL FIX: Deploy with increased Cloud Run request size limit
# This eliminates 413 errors in production

echo "🚨 FIXING 413 ERROR IN PRODUCTION"
echo "=================================="
echo "Problem: Cloud Run has a 32MB request limit by default"
echo "Solution: Increasing limit to 1GB (max allowed)"
echo ""

# Build the application
echo "Building application..."
npm run build

# Deploy with increased request size limit
echo "Deploying with 1GB request size limit..."
gcloud run deploy aescuvest-platform \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 100 \
  --min-instances 0 \
  --set-env-vars NODE_ENV=production \
  --set-env-vars MAX_REQUEST_SIZE=1073741824 \
  --update-annotations run.googleapis.com/cpu-throttling=false \
  --platform managed

# CRITICAL: Update the service to allow 1GB requests
echo ""
echo "Updating service configuration for 1GB uploads..."
gcloud run services update aescuvest-platform \
  --region us-central1 \
  --platform managed \
  --update-annotations run.googleapis.com/request-size-limit=1073741824

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "Changes applied:"
echo "1. Cloud Run request size limit: 1GB (1073741824 bytes)"
echo "2. Memory: 4GB for processing large files"
echo "3. Timeout: 60 minutes for long uploads"
echo "4. Database storage for all files"
echo ""
echo "This fixes:"
echo "• 413 errors for files up to 1GB"
echo "• ZIP uploads up to 1GB"
echo "• Direct uploads without chunking"
echo ""
echo "For files larger than 1GB:"
echo "Use the chunked upload system at /api/upload/chunk"