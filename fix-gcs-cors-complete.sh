#!/bin/bash

echo "========================================"
echo "GCS CORS COMPLETE FIX"
echo "========================================"
echo ""
echo "SCHRITT 1: Erstelle perfekte CORS config"
echo "----------------------------------------"

cat > /tmp/gcs-cors-ultimate.json << 'JSON'
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"],
    "responseHeader": ["*"],
    "maxAgeSeconds": 3600
  }
]
JSON

echo "✅ CORS config erstellt mit:"
echo "   - Alle Origins erlaubt (*)"
echo "   - Alle HTTP Methoden"
echo "   - ALLE Response Headers (*)"
echo ""
echo "SCHRITT 2: Wende CORS auf Bucket an"
echo "----------------------------------------"
echo ""
echo "FÜHRE DIESEN BEFEHL IN GOOGLE CLOUD SHELL AUS:"
echo ""
echo "gsutil cors set /tmp/gcs-cors-ultimate.json gs://aescuvest-uploads-2025"
echo ""
echo "SCHRITT 3: Verifiziere CORS"
echo "----------------------------------------"
echo ""
echo "DANACH FÜHRE AUS:"
echo "gsutil cors get gs://aescuvest-uploads-2025"
echo ""
echo "========================================"
