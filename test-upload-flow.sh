#!/bin/bash

echo "====================================="
echo "TESTING COMPLETE UPLOAD FLOW"
echo "====================================="
echo ""

FILE="test-upload.zip"
FILE_SIZE=$(stat -c%s "$FILE")
CHUNK_SIZE=5242880
DEAL_ID=23

echo "📁 File: $FILE"
echo "📏 Size: $(ls -lh $FILE | awk '{print $5}')"
echo "🎯 Deal ID: $DEAL_ID"
echo ""

# Step 1: Initialize chunked upload
echo "1️⃣ Initializing chunked upload..."
INIT_RESPONSE=$(curl -s "http://localhost:5000/api/upload/chunk/init?fileName=$FILE&totalSize=$FILE_SIZE&chunkSize=$CHUNK_SIZE")
UPLOAD_ID=$(echo $INIT_RESPONSE | grep -o '"uploadId":"[^"]*' | cut -d'"' -f4)

if [ -n "$UPLOAD_ID" ]; then
  echo "✅ Upload initialized with ID: $UPLOAD_ID"
else
  echo "❌ Failed to initialize upload"
  echo "Response: $INIT_RESPONSE"
  exit 1
fi
echo ""

# Step 2: Upload chunks
echo "2️⃣ Uploading file chunks..."
TOTAL_CHUNKS=$(( ($FILE_SIZE + $CHUNK_SIZE - 1) / $CHUNK_SIZE ))
echo "   Total chunks: $TOTAL_CHUNKS"

for ((i=0; i<$TOTAL_CHUNKS; i++)); do
  START=$(($i * $CHUNK_SIZE))
  END=$(($START + $CHUNK_SIZE))
  if [ $END -gt $FILE_SIZE ]; then
    END=$FILE_SIZE
  fi
  
  # Extract chunk and upload
  dd if="$FILE" bs=1 skip=$START count=$(($END - $START)) 2>/dev/null | \
    curl -s -X POST "http://localhost:5000/api/upload/chunk/$UPLOAD_ID/$i" \
      -F "chunk=@-;filename=chunk$i" > /dev/null
  
  echo "   ✅ Uploaded chunk $((i+1))/$TOTAL_CHUNKS"
done
echo ""

# Step 3: Complete upload
echo "3️⃣ Completing upload and processing..."
COMPLETE_RESPONSE=$(curl -s -X POST "http://localhost:5000/api/deals/$DEAL_ID/upload-chunked/$UPLOAD_ID" \
  -H "Content-Type: application/json" \
  -d '{"folderName": "Test Upload"}')

if echo "$COMPLETE_RESPONSE" | grep -q "success"; then
  echo "✅ Upload completed successfully!"
  echo ""
  echo "Response: $COMPLETE_RESPONSE" | head -c 200
else
  echo "❌ Failed to complete upload"
  echo "Response: $COMPLETE_RESPONSE"
fi
echo ""

echo "====================================="
echo "TEST COMPLETE!"
echo "====================================="
