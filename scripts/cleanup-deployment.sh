#!/bin/bash

echo "🧹 Starting aggressive deployment cleanup..."

# Skip .git-rewrite (protected) but ensure it's excluded in .dockerignore
echo "📁 Skipping .git-rewrite (protected, but excluded in .dockerignore)..."

# Clean uploads directory completely
echo "📁 Cleaning uploads directory..."
find uploads -type f -delete 2>/dev/null || true
find uploads -type d -mindepth 1 -delete 2>/dev/null || true
mkdir -p uploads
touch uploads/.gitkeep

# Clean attached_assets but preserve essential logos
echo "📁 Cleaning attached_assets..."
find attached_assets -type f -not -name "*Logo*" -delete 2>/dev/null || true
find attached_assets -type d -mindepth 1 -empty -delete 2>/dev/null || true

# Remove Chromium binaries (largest contributor)
echo "🌐 Removing Chromium binaries..."
find node_modules -name ".local-chromium" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "chromium" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "chrome-linux" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "chrome-mac" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "chrome-win" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "chrome" -type f -size +10M -delete 2>/dev/null || true

# Remove other large binaries
echo "🔧 Removing large binaries..."
find node_modules -name "*.node" -size +5M -delete 2>/dev/null || true
find node_modules -name "*.dylib" -delete 2>/dev/null || true
find node_modules -name "*.so" -size +1M -delete 2>/dev/null || true
find node_modules -name "*.dll" -size +1M -delete 2>/dev/null || true

# Clean PDF processing artifacts
echo "📄 Cleaning PDF processing files..."
find node_modules -path "*/pdfjs-dist/build/*" -delete 2>/dev/null || true
find node_modules -path "*/sharp/vendor/*" -delete 2>/dev/null || true

# Remove development files from node_modules
echo "📚 Removing development files..."
find node_modules -name "*.md" -type f -delete 2>/dev/null || true
find node_modules -name "*.txt" -type f -delete 2>/dev/null || true
find node_modules -name "README*" -type f -delete 2>/dev/null || true
find node_modules -name "LICENSE*" -type f -delete 2>/dev/null || true
find node_modules -name "CHANGELOG*" -type f -delete 2>/dev/null || true
find node_modules -name "HISTORY*" -type f -delete 2>/dev/null || true

# Remove test directories
find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "spec" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "demo" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "sample" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove test files
find node_modules -name "*.test.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.test.ts" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.ts" -type f -delete 2>/dev/null || true

# Clean caches
echo "🗂️ Cleaning caches..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .cache 2>/dev/null || true
rm -rf .vite 2>/dev/null || true
rm -rf dist 2>/dev/null || true
rm -rf .npm 2>/dev/null || true

# Clean temporary files
echo "🧽 Cleaning temporary files..."
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name "*.temp" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true
find . -name "Thumbs.db" -delete 2>/dev/null || true

# Create essential runtime directories
mkdir -p uploads
mkdir -p dist/uploads
touch uploads/.gitkeep

echo "✅ Deployment cleanup completed!"

# Show final sizes
echo ""
echo "📊 Final directory sizes:"
UPLOAD_SIZE=$(du -sh uploads/ 2>/dev/null | cut -f1 || echo "0K")
ASSETS_SIZE=$(du -sh attached_assets/ 2>/dev/null | cut -f1 || echo "0K")
NODE_MODULES_SIZE=$(du -sh node_modules/ 2>/dev/null | cut -f1 || echo "Unknown")
TOTAL_SIZE=$(du -sh . 2>/dev/null | cut -f1 || echo "Unknown")

echo "   • uploads/: $UPLOAD_SIZE"
echo "   • attached_assets/: $ASSETS_SIZE"
echo "   • node_modules/: $NODE_MODULES_SIZE"
echo "   • Total project: $TOTAL_SIZE"
echo ""
echo "🎯 Project should now be well under 8GB deployment limit!"