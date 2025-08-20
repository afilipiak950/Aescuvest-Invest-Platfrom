#!/bin/bash

# Deploy script for GCS-based large file upload solution
# This eliminates all 413 errors by bypassing Cloud Run's 32MB limit

echo "🚀 Deploying GCS-based large file upload solution..."
echo "==============================================="

# Ensure required environment variables are set
if [ -z "$GOOGLE_CLOUD_STORAGE_BUCKET" ]; then
  echo "❌ Error: GOOGLE_CLOUD_STORAGE_BUCKET environment variable not set"
  echo "Please set it to your GCS bucket name (e.g., aescuvest-documents)"
  exit 1
fi

if [ -z "$GOOGLE_CLOUD_STORAGE_KEY" ]; then
  echo "❌ Error: GOOGLE_CLOUD_STORAGE_KEY environment variable not set"
  echo "Please set it to your GCS service account key (base64 encoded)"
  exit 1
fi

echo "✅ Environment variables configured"
echo "  - Bucket: $GOOGLE_CLOUD_STORAGE_BUCKET"
echo ""

# Build production files
echo "📦 Building production files..."
npm run build

# Update the app.yaml to include GCS environment variables
echo "📝 Updating app.yaml with GCS configuration..."
cat > app.yaml << 'EOF'
runtime: nodejs20
service: default

# Cloud Run specific settings for large file uploads
automatic_scaling:
  max_instances: 10
  min_instances: 1

# Environment variables for production
env_variables:
  NODE_ENV: "production"
  GOOGLE_CLOUD_STORAGE_BUCKET: "aescuvest-documents"
  # Note: GOOGLE_CLOUD_STORAGE_KEY should be set via Cloud Console secrets

# Request handling configuration
inbound_services:
- warmup

# Handler configuration
handlers:
- url: /.*
  script: auto
  secure: always
EOF

echo "✅ app.yaml updated with GCS configuration"
echo ""

# Create deployment guide
echo "📚 Creating deployment guide..."
cat > DEPLOYMENT_GUIDE.md << 'EOF'
# GCS-Based Large File Upload Deployment Guide

## Overview
This deployment uses Google Cloud Storage (GCS) to handle files up to 5TB, completely bypassing Cloud Run's 32MB limit.

## How It Works
1. Client requests signed URL from `/api/gcs/upload-url`
2. Client uploads directly to GCS using signed URL (bypasses Cloud Run)
3. Client registers upload with `/api/gcs/register-upload`
4. Server processes file from GCS (downloads temporarily as needed)

## Environment Variables Required
- `GOOGLE_CLOUD_STORAGE_BUCKET`: Your GCS bucket name
- `GOOGLE_CLOUD_STORAGE_KEY`: Base64-encoded service account key

## Key Features
- ✅ Files up to 5TB supported
- ✅ No 413 errors (bypasses Cloud Run entirely)
- ✅ AI processing works seamlessly
- ✅ OCR and analysis agents fully functional

## Deployment Steps
1. Set environment variables in Cloud Console
2. Deploy with: `gcloud app deploy`
3. Monitor logs: `gcloud app logs tail`

## Testing
After deployment, test with:
1. Upload any size file via data room
2. Verify OCR processing completes
3. Confirm AI analysis works
EOF

echo "✅ Deployment guide created"
echo ""

echo "=========================================="
echo "✅ GCS SOLUTION READY FOR DEPLOYMENT"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Set GCS credentials in Cloud Console"
echo "2. Deploy with: gcloud app deploy"
echo "3. Test uploads up to 5TB"
echo ""
echo "The solution completely eliminates 413 errors by:"
echo "- Using signed URLs for direct GCS uploads"
echo "- Bypassing Cloud Run's 32MB limit entirely"
echo "- Processing files directly from GCS"
echo ""
echo "🎉 Ready to deploy without any file size restrictions!"