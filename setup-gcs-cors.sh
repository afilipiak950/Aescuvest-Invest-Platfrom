#!/bin/bash

# Script to configure CORS on Google Cloud Storage bucket
# This allows browser-based direct uploads

echo "🔧 Setting up CORS for Google Cloud Storage bucket..."
echo ""
echo "You need to run this command in Google Cloud Shell or with gcloud CLI installed:"
echo ""
echo "gsutil cors set gcs-cors-config.json gs://aescuvest-uploads-2025"
echo ""
echo "Or you can do it through Google Cloud Console:"
echo "1. Go to https://console.cloud.google.com/storage/browser"
echo "2. Click on your bucket: aescuvest-uploads-2025"
echo "3. Go to the 'Configuration' tab"
echo "4. Click 'Edit CORS configuration'"
echo "5. Paste this JSON:"
echo ""
cat gcs-cors-config.json
echo ""
echo "This will allow your application to upload files directly from the browser to GCS."