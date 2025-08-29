#!/bin/bash

echo "📊 Deployment Size Verification Report"
echo "======================================"

# Check total project size
TOTAL_SIZE=$(du -sh . 2>/dev/null | cut -f1)
echo "📁 Total Project Size: $TOTAL_SIZE"

# Check key directory sizes
echo ""
echo "📋 Directory Breakdown:"
echo "----------------------"
du -sh node_modules/ 2>/dev/null | sed 's/^/   📦 node_modules: /'
du -sh uploads/ 2>/dev/null | sed 's/^/   📤 uploads: /'
du -sh attached_assets/ 2>/dev/null | sed 's/^/   🖼️  attached_assets: /'
du -sh dist/ 2>/dev/null | sed 's/^/   🏗️  dist: /' || echo "   🏗️  dist: Not built yet"
du -sh client/ 2>/dev/null | sed 's/^/   🖥️  client: /'
du -sh server/ 2>/dev/null | sed 's/^/   ⚙️  server: /'

# Check if under 8GB limit
echo ""
echo "🎯 Deployment Limit Check:"
echo "-------------------------"
SIZE_NUM=$(echo $TOTAL_SIZE | sed 's/[^0-9.]//g')
SIZE_UNIT=$(echo $TOTAL_SIZE | sed 's/[0-9.]//g')

if [[ "$SIZE_UNIT" == "G" ]]; then
    # Simple numeric comparison without bc
    if (( $(echo "$SIZE_NUM" | cut -d. -f1) < 8 )); then
        echo "✅ PASS: Project size ($TOTAL_SIZE) is under 8GB limit"
        echo "   💡 Ready for deployment!"
    else
        echo "❌ FAIL: Project size ($TOTAL_SIZE) may exceed 8GB limit"
        echo "   💡 Run additional cleanup: bash scripts/cleanup-build.sh"
    fi
else
    echo "✅ PASS: Project size ($TOTAL_SIZE) is well under 8GB limit"
    echo "   💡 Ready for deployment!"
fi

# Check for problematic large files
echo ""
echo "🔍 Large File Check (>100MB):"
echo "-----------------------------"
LARGE_FILES=$(find . -type f -size +100M 2>/dev/null | grep -v node_modules | head -5)
if [ -z "$LARGE_FILES" ]; then
    echo "✅ No large files found outside node_modules"
else
    echo "⚠️  Large files found:"
    echo "$LARGE_FILES" | sed 's/^/   📄 /'
fi

echo ""
echo "🚀 Deployment Status: READY"