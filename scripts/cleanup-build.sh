#!/bin/bash

echo "🧹 Starting deployment cleanup process..."

# Remove build artifacts and cache
echo "📦 Cleaning build artifacts..."
rm -rf dist/
rm -rf build/
rm -rf .next/
rm -rf out/
rm -rf coverage/

# Clean npm and node caches (excluding Replit system files)
echo "🗑️ Cleaning npm and node caches..."
rm -rf node_modules/.cache/
rm -rf .npm/
rm -rf .vite/
rm -rf .eslintcache
rm -rf .nyc_output/
# Skip .cache directory to avoid Replit system files

# Clean up uploads directory but preserve structure
echo "📁 Cleaning uploads directory..."
find uploads -type f -delete 2>/dev/null || true
touch uploads/.gitkeep

# Clean up attached_assets but preserve essential files
echo "🖼️ Cleaning attached_assets directory..."
find attached_assets -type f -name "*.png" -not -path "*/generated_images/*" -delete 2>/dev/null || true
find attached_assets -type f -name "*.jpg" -delete 2>/dev/null || true
find attached_assets -type f -name "*.jpeg" -delete 2>/dev/null || true
find attached_assets -type f -name "*.pdf" -delete 2>/dev/null || true
find attached_assets -type f -name "*.docx" -delete 2>/dev/null || true
find attached_assets -type f -name "*.zip" -delete 2>/dev/null || true

# Optimize node_modules for deployment
echo "⚡ Optimizing node_modules..."
find node_modules -name "*.md" -type f -delete 2>/dev/null || true
find node_modules -name "*.txt" -type f -delete 2>/dev/null || true
find node_modules -name "README*" -type f -delete 2>/dev/null || true
find node_modules -name "LICENSE*" -type f -delete 2>/dev/null || true
find node_modules -name "CHANGELOG*" -type f -delete 2>/dev/null || true
find node_modules -name "HISTORY*" -type f -delete 2>/dev/null || true
find node_modules -name "AUTHORS*" -type f -delete 2>/dev/null || true
find node_modules -name "CONTRIBUTORS*" -type f -delete 2>/dev/null || true

# Remove test and example directories
find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "spec" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "example" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "demo" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "demos" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "sample" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "samples" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "docs" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "documentation" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove test files
find node_modules -name "*.test.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.test.ts" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.ts" -type f -delete 2>/dev/null || true
find node_modules -name "*.test.jsx" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.jsx" -type f -delete 2>/dev/null || true
find node_modules -name "*.test.tsx" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.tsx" -type f -delete 2>/dev/null || true

# Remove source maps and development files
find node_modules -name "*.map" -type f -delete 2>/dev/null || true
find node_modules -name "*.d.ts.map" -type f -delete 2>/dev/null || true

# Remove large binary files that might be in dependencies
find node_modules -name "*.pdf" -type f -delete 2>/dev/null || true
find node_modules -name "*.zip" -type f -delete 2>/dev/null || true
find node_modules -name "*.tar.gz" -type f -delete 2>/dev/null || true
find node_modules -name "*.tgz" -type f -delete 2>/dev/null || true
find node_modules -name "*.exe" -type f -delete 2>/dev/null || true
find node_modules -name "*.dmg" -type f -delete 2>/dev/null || true
find node_modules -name "*.iso" -type f -delete 2>/dev/null || true

# Clean log files
echo "📝 Cleaning log files..."
find . -name "*.log" -type f -delete 2>/dev/null || true
find . -name "npm-debug.log*" -type f -delete 2>/dev/null || true
find . -name "yarn-debug.log*" -type f -delete 2>/dev/null || true
find . -name "yarn-error.log*" -type f -delete 2>/dev/null || true

# Remove OS generated files
echo "🖥️ Cleaning OS generated files..."
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
find . -name "Thumbs.db" -type f -delete 2>/dev/null || true
find . -name "desktop.ini" -type f -delete 2>/dev/null || true

echo "✅ Cleanup completed successfully!"

# Display final size
echo "📊 Final project size:"
du -sh . 2>/dev/null | head -1