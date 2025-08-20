#!/bin/bash

echo "🔧 Fixing Google Cloud Storage CORS configuration..."
echo ""
echo "Please run these commands in Google Cloud Shell:"
echo ""
echo "1. First, verify current CORS settings:"
echo "   gsutil cors get gs://aescuvest-uploads-2025"
echo ""
echo "2. Create new CORS configuration file:"
cat << 'EOF'
cat > cors-fixed.json << EOCORS
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
EOCORS
EOF
echo ""
echo "3. Apply the fixed CORS configuration:"
echo "   gsutil cors set cors-fixed.json gs://aescuvest-uploads-2025"
echo ""
echo "4. Verify it was applied:"
echo "   gsutil cors get gs://aescuvest-uploads-2025"
echo ""
echo "This should fix the CORS issue and allow direct uploads from the browser."