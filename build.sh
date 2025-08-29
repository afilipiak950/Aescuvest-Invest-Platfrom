#!/bin/bash

echo "🚀 Starting production build with optimizations..."

# Set production environment
export NODE_ENV=production

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf node_modules/.cache
rm -rf .vite

# Install dependencies without dev dependencies for final bundle
echo "📦 Installing production dependencies..."
npm ci --production=false

# Build frontend with optimizations
echo "🔨 Building frontend..."
npx vite build --mode production

# Build backend with optimizations
echo "🔨 Building backend..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist \
  --minify \
  --tree-shaking=true \
  --target=node18 \
  --sourcemap=false

# Clean up development dependencies after build
echo "🧹 Removing development dependencies..."
npm prune --production

# Remove unnecessary files from node_modules
echo "🧹 Optimizing node_modules..."
find node_modules -name "*.md" -type f -delete 2>/dev/null || true
find node_modules -name "*.txt" -type f -delete 2>/dev/null || true
find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "*.test.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.js" -type f -delete 2>/dev/null || true

# Ensure runtime directories exist
echo "📁 Creating runtime directories..."
mkdir -p uploads
mkdir -p dist/uploads
touch uploads/.gitkeep

echo "✅ Production build complete!"
echo "📊 Build summary:"
du -sh dist/ 2>/dev/null || echo "  - Backend bundle: Built"
du -sh client/dist/ 2>/dev/null || echo "  - Frontend bundle: Built"
du -sh node_modules/ 2>/dev/null || echo "  - Dependencies: Optimized"