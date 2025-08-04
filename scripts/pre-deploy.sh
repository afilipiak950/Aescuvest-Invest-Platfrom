#!/bin/bash

echo "🚀 Pre-deployment optimization script..."

# Run the build with optimizations
echo "🔨 Running optimized build..."
bash build.sh

# Additional deployment-specific optimizations
echo "⚡ Additional deployment optimizations..."

# Remove any remaining large files from the project root
find . -maxdepth 1 -name "*.zip" -delete 2>/dev/null || true
find . -maxdepth 1 -name "*.rar" -delete 2>/dev/null || true
find . -maxdepth 1 -name "*.pdf" -delete 2>/dev/null || true

# Clean any leftover log files
find . -name "*.log" -not -path "./node_modules/*" -not -path "./dist/*" -delete 2>/dev/null || true

# Ensure proper permissions for runtime directories
chmod 755 uploads 2>/dev/null || true
chmod 755 dist/uploads 2>/dev/null || true

# Final size check
echo "📊 Final deployment size check:"
TOTAL_SIZE=$(du -sh . | cut -f1)
UPLOADS_SIZE=$(du -sh uploads/ 2>/dev/null | cut -f1 || echo "0K")
NODE_MODULES_SIZE=$(du -sh node_modules/ | cut -f1)
DIST_SIZE=$(du -sh dist/ 2>/dev/null | cut -f1 || echo "0K")

echo "   • Total project size: $TOTAL_SIZE"
echo "   • uploads/ directory: $UPLOADS_SIZE"
echo "   • node_modules/ size: $NODE_MODULES_SIZE"
echo "   • dist/ build size: $DIST_SIZE"

echo "✅ Pre-deployment optimization complete!"