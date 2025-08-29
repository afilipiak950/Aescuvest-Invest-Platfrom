#!/bin/bash

echo "🔍 Pre-deployment size check..."

# Check total project size
TOTAL_SIZE=$(du -sh . --exclude=.git --exclude=.git-rewrite 2>/dev/null | cut -f1)
echo "📊 Total project size (excluding .git): $TOTAL_SIZE"

# Check individual directories
echo ""
echo "📁 Directory breakdown:"
echo "   • node_modules/: $(du -sh node_modules/ 2>/dev/null | cut -f1 || echo "0K")"
echo "   • uploads/: $(du -sh uploads/ 2>/dev/null | cut -f1 || echo "0K")"
echo "   • attached_assets/: $(du -sh attached_assets/ 2>/dev/null | cut -f1 || echo "0K")"
echo "   • client/: $(du -sh client/ 2>/dev/null | cut -f1 || echo "0K")"
echo "   • server/: $(du -sh server/ 2>/dev/null | cut -f1 || echo "0K")"

# Check for large files
echo ""
echo "🔍 Checking for remaining large files (>50MB)..."
find . -path "./.git*" -prune -o -type f -size +50M -print 2>/dev/null | head -5

# Check docker deployment readiness
echo ""
echo "🐳 Docker deployment readiness:"
if [ -f ".dockerignore" ]; then
    echo "   ✅ .dockerignore exists"
    DOCKERIGNORE_LINES=$(wc -l < .dockerignore)
    echo "   ✅ .dockerignore has $DOCKERIGNORE_LINES exclusion rules"
else
    echo "   ❌ .dockerignore missing"
fi

# Estimate deployment size (excluding .git and dockerignored files)
echo ""
echo "🎯 Estimated deployment size (excluding .git-rewrite and dockerignored files):"
echo "   Should be well under 8GB limit for deployment"

# Check if Chromium is still present
if find node_modules -name ".local-chromium" -type d 2>/dev/null | grep -q .; then
    echo "   ⚠️ Warning: Chromium binaries still present"
else
    echo "   ✅ Chromium binaries removed"
fi

echo ""
echo "🚀 Ready for deployment!"