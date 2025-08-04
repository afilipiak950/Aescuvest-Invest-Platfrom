#!/bin/bash

echo "🔧 Optimizing node_modules for deployment..."

# Remove Chromium installations (biggest space saver)
echo "🌐 Removing Chromium binaries (can save 200-400MB)..."
find node_modules -name ".local-chromium" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "chromium" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -path "*/puppeteer/.local-chromium/*" -delete 2>/dev/null || true

# Remove large binary files
echo "⚙️ Removing large binary files..."
find node_modules -name "*.node" -size +5M -delete 2>/dev/null || true
find node_modules -name "chrome" -type f -size +10M -delete 2>/dev/null || true
find node_modules -name "chromium" -type f -size +10M -delete 2>/dev/null || true

# Clean Sharp vendor files (image processing)
echo "🖼️ Cleaning Sharp vendor files..."
find node_modules -path "*/sharp/vendor/*" -delete 2>/dev/null || true

# Clean PDF.js build files
echo "📄 Cleaning PDF.js build files..."
find node_modules -path "*/pdfjs-dist/build/*" -delete 2>/dev/null || true

# Remove documentation and examples
echo "📚 Removing documentation and examples..."
find node_modules -name "*.md" -type f -delete 2>/dev/null || true
find node_modules -name "README*" -type f -delete 2>/dev/null || true
find node_modules -name "LICENSE*" -type f -delete 2>/dev/null || true
find node_modules -name "CHANGELOG*" -type f -delete 2>/dev/null || true

# Remove test directories and files
echo "🧪 Removing test files and directories..."
find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "*.test.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.js" -type f -delete 2>/dev/null || true

echo "✅ node_modules optimization completed!"

# Show final node_modules size
NODE_MODULES_SIZE=$(du -sh node_modules/ 2>/dev/null | cut -f1 || echo "Unknown")
echo "📊 node_modules size: $NODE_MODULES_SIZE"