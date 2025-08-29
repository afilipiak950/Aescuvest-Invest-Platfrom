#!/bin/bash

echo "🚀 Starting pre-deployment optimization process..."

# Set production environment
export NODE_ENV=production

# Run comprehensive cleanup first
echo "🧹 Running comprehensive cleanup..."
if [ -f "scripts/cleanup-build.sh" ]; then
    bash scripts/cleanup-build.sh
else
    echo "⚠️  Cleanup script not found, running basic cleanup..."
    rm -rf dist/ build/ node_modules/.cache/ .vite/ .cache/
fi

# Clean npm cache
echo "🗑️ Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true

# Reinstall dependencies for production
echo "📦 Installing production dependencies..."
npm ci --no-audit --no-fund --prefer-offline

# Additional aggressive node_modules optimization for deployment
echo "⚡ Performing aggressive node_modules optimization..."

# Remove TypeScript declaration map files
find node_modules -name "*.d.ts.map" -type f -delete 2>/dev/null || true

# Remove unnecessary config files
find node_modules -name "tsconfig.json" -type f -delete 2>/dev/null || true
find node_modules -name "webpack.config.js" -type f -delete 2>/dev/null || true
find node_modules -name "rollup.config.js" -type f -delete 2>/dev/null || true
find node_modules -name "jest.config.js" -type f -delete 2>/dev/null || true
find node_modules -name ".eslintrc*" -type f -delete 2>/dev/null || true
find node_modules -name ".prettierrc*" -type f -delete 2>/dev/null || true

# Remove benchmark and performance test files
find node_modules -name "bench" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "benchmark" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "benchmarks" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "perf" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove editor config files
find node_modules -name ".editorconfig" -type f -delete 2>/dev/null || true
find node_modules -name ".vscode" -type d -exec rm -rf {} + 2>/dev/null || true

# Build optimized frontend
echo "🔨 Building optimized frontend..."
npx vite build --mode production --logLevel warn

# Build optimized backend
echo "🔨 Building optimized backend..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist \
  --minify \
  --tree-shaking=true \
  --target=node18 \
  --sourcemap=false \
  --log-level=warning \
  --drop:console \
  --drop:debugger

# Remove development dependencies after build
echo "📦 Pruning development dependencies..."
npm prune --production --no-audit --no-fund

# Ensure required runtime directories exist
echo "📁 Creating required runtime directories..."
mkdir -p uploads
mkdir -p dist/uploads
mkdir -p attached_assets/generated_images
touch uploads/.gitkeep
touch dist/uploads/.gitkeep

# Final size verification and reporting
echo "📊 Deployment size verification..."
TOTAL_SIZE=$(du -sh . 2>/dev/null | cut -f1)
echo "✅ Total project size: $TOTAL_SIZE"

# Check if size is under limit (rough check)
SIZE_NUM=$(echo $TOTAL_SIZE | sed 's/[^0-9.]//g')
SIZE_UNIT=$(echo $TOTAL_SIZE | sed 's/[0-9.]//g')

if [[ "$SIZE_UNIT" == "G" ]]; then
    if (( $(echo "$SIZE_NUM < 8" | bc -l) )); then
        echo "✅ Project size is under 8GB limit - ready for deployment!"
    else
        echo "⚠️  Project size may still be close to 8GB limit"
    fi
else
    echo "✅ Project size is well under 8GB limit - ready for deployment!"
fi

echo "🚀 Pre-deployment optimization completed successfully!"