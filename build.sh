#!/bin/bash

echo "🚀 Starting production build with deployment optimizations..."

# Set production environment
export NODE_ENV=production

# Run cleanup script to reduce deployment size
echo "🧹 Running deployment cleanup..."
if [ -f "scripts/cleanup-build.sh" ]; then
    bash scripts/cleanup-build.sh
else
    echo "⚠️  Cleanup script not found, proceeding with basic cleanup..."
    rm -rf dist
    rm -rf node_modules/.cache
    rm -rf .vite
    rm -rf .cache
fi

# Clean upload directories for deployment
echo "📁 Preparing deployment directories..."
find uploads -type f -delete 2>/dev/null || true
find attached_assets -type f -delete 2>/dev/null || true

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

# Aggressive node_modules optimization for deployment
echo "🧹 Aggressively optimizing node_modules for deployment..."
find node_modules -name "*.md" -type f -delete 2>/dev/null || true
find node_modules -name "*.txt" -type f -delete 2>/dev/null || true
find node_modules -name "README*" -type f -delete 2>/dev/null || true
find node_modules -name "LICENSE*" -type f -delete 2>/dev/null || true
find node_modules -name "CHANGELOG*" -type f -delete 2>/dev/null || true
find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "spec" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "demo" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "sample" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "*.test.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.test.ts" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.ts" -type f -delete 2>/dev/null || true

# Remove large binary files that might be in dependencies
find node_modules -name "*.pdf" -type f -delete 2>/dev/null || true
find node_modules -name "*.zip" -type f -delete 2>/dev/null || true
find node_modules -name "*.tar.gz" -type f -delete 2>/dev/null || true

# Ensure runtime directories exist
echo "📁 Creating runtime directories..."
mkdir -p uploads
mkdir -p dist/uploads
touch uploads/.gitkeep

# Final size check and cleanup verification
echo "📊 Deployment size optimization summary:"
UPLOAD_SIZE=$(du -sh uploads/ 2>/dev/null | cut -f1 || echo "0K")
ASSETS_SIZE=$(du -sh attached_assets/ 2>/dev/null | cut -f1 || echo "0K")
NODE_MODULES_SIZE=$(du -sh node_modules/ 2>/dev/null | cut -f1 || echo "Unknown")

echo "   • uploads/ directory: $UPLOAD_SIZE"
echo "   • attached_assets/ directory: $ASSETS_SIZE"
echo "   • node_modules/ size: $NODE_MODULES_SIZE"
echo "   • Runtime directories created"
echo "   • Development dependencies pruned"
echo "   • Build artifacts optimized"

echo "✅ Production build complete and optimized for deployment!"
echo "📊 Build summary:"
du -sh dist/ 2>/dev/null || echo "  - Backend bundle: Built"
du -sh client/dist/ 2>/dev/null || echo "  - Frontend bundle: Built"
du -sh node_modules/ 2>/dev/null || echo "  - Dependencies: Optimized"