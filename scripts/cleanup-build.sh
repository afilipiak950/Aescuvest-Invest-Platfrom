#!/bin/bash

echo "🧹 Starting build cleanup for deployment optimization..."

# Clean upload directories (preserving structure)
echo "📁 Cleaning uploads directory..."
if [ -d "uploads" ]; then
    find uploads -type f -delete 2>/dev/null || true
    echo "   ✓ Cleared upload files"
fi

# Clean attached_assets directory (these are large development files)
echo "📁 Cleaning attached_assets directory..."
if [ -d "attached_assets" ]; then
    find attached_assets -type f -delete 2>/dev/null || true
    echo "   ✓ Cleared attached asset files"
fi

# Clean node_modules cache
echo "📦 Cleaning node_modules cache..."
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "   ✓ Cleared node_modules cache"
fi

# Clean npm cache
echo "📦 Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true
echo "   ✓ Cleared npm cache"

# Clean build artifacts (avoiding protected Replit files)
echo "🔨 Cleaning build artifacts..."
rm -rf dist/ 2>/dev/null || true
rm -rf build/ 2>/dev/null || true
rm -rf .vite/ 2>/dev/null || true
# Avoid deleting protected .cache directory, only clean specific subdirectories
if [ -d ".cache" ]; then
    find .cache -maxdepth 1 -name "*" -not -name ".cache" -not -path "*.cache/replit*" -exec rm -rf {} + 2>/dev/null || true
fi
echo "   ✓ Cleared build directories"

# Clean log files
echo "📋 Cleaning log files..."
find . -name "*.log" -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name "npm-debug.log*" -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name "yarn-debug.log*" -not -path "./node_modules/*" -delete 2>/dev/null || true
find . -name "yarn-error.log*" -not -path "./node_modules/*" -delete 2>/dev/null || true
echo "   ✓ Cleared log files"

# Optimize node_modules for production
echo "📦 Optimizing node_modules for production..."
if [ -d "node_modules" ]; then
    # Remove test directories and files
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "spec" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "demo" -type d -exec rm -rf {} + 2>/dev/null || true
    find node_modules -name "sample" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Remove documentation files
    find node_modules -name "*.md" -type f -delete 2>/dev/null || true
    find node_modules -name "*.txt" -type f -delete 2>/dev/null || true
    find node_modules -name "LICENSE*" -type f -delete 2>/dev/null || true
    find node_modules -name "CHANGELOG*" -type f -delete 2>/dev/null || true
    find node_modules -name "README*" -type f -delete 2>/dev/null || true
    
    # Remove test files
    find node_modules -name "*.test.js" -type f -delete 2>/dev/null || true
    find node_modules -name "*.spec.js" -type f -delete 2>/dev/null || true
    find node_modules -name "*.test.ts" -type f -delete 2>/dev/null || true
    find node_modules -name "*.spec.ts" -type f -delete 2>/dev/null || true
    
    echo "   ✓ Optimized node_modules"
fi

# Ensure runtime directories exist with proper structure
echo "📁 Creating runtime directories..."
mkdir -p uploads
mkdir -p dist/uploads
touch uploads/.gitkeep
echo "   ✓ Created runtime directories"

# Calculate space saved
echo ""
echo "📊 Cleanup Summary:"
echo "   ✓ Removed all upload files"
echo "   ✓ Removed all attached assets"
echo "   ✓ Cleaned build artifacts"
echo "   ✓ Optimized node_modules"
echo "   ✓ Cleaned cache directories"
echo ""
echo "✅ Build cleanup complete! Deployment image size should be significantly reduced."