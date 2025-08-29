#!/bin/bash

echo "🏗️ Starting optimized production build..."

# Step 1: Clean the project
echo "🧹 Step 1: Cleaning project for deployment..."
bash ./optimize-build.sh

# Step 2: Reinstall only production dependencies
echo "📦 Step 2: Installing production dependencies..."
rm -rf node_modules package-lock.json
npm ci --production=false

# Step 3: Build frontend with optimizations
echo "🔨 Step 3: Building optimized frontend..."
npx vite build --mode production

# Step 4: Build backend with optimizations
echo "🔧 Step 4: Building optimized backend..."
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
  --keep-names=false \
  --drop:console \
  --drop:debugger

# Step 5: Remove development dependencies
echo "🧹 Step 5: Removing development dependencies..."
npm prune --production

# Step 6: Final optimizations
echo "🎯 Step 6: Final production optimizations..."

# Remove unnecessary files from node_modules
find node_modules -name "*.md" -type f -delete 2>/dev/null || true
find node_modules -name "*.txt" -type f -delete 2>/dev/null || true
find node_modules -name "CHANGELOG*" -type f -delete 2>/dev/null || true
find node_modules -name "LICENSE*" -type f -delete 2>/dev/null || true
find node_modules -name "AUTHORS*" -type f -delete 2>/dev/null || true
find node_modules -name "CONTRIBUTORS*" -type f -delete 2>/dev/null || true

# Remove test directories and files
find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "*.test.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.js" -type f -delete 2>/dev/null || true
find node_modules -name "*.test.ts" -type f -delete 2>/dev/null || true
find node_modules -name "*.spec.ts" -type f -delete 2>/dev/null || true

# Remove example and demo directories
find node_modules -name "example" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "demo" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "demos" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "sample" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "samples" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove source maps and typescript files
find node_modules -name "*.map" -type f -delete 2>/dev/null || true
find node_modules -name "*.ts" -not -name "*.d.ts" -type f -delete 2>/dev/null || true

# Remove documentation directories
find node_modules -name "doc" -type d -exec rm -rf {} + 2>/dev/null || true
find node_modules -name "docs" -type d -exec rm -rf {} + 2>/dev/null || true

# Step 7: Create runtime directories
echo "📁 Step 7: Creating runtime directories..."
mkdir -p uploads
mkdir -p dist/uploads
touch uploads/.gitkeep

# Step 8: Verify build
echo "✅ Step 8: Verifying build..."
if [ -f "dist/index.js" ]; then
    echo "✅ Backend build successful"
else
    echo "❌ Backend build failed"
    exit 1
fi

if [ -d "dist/public" ]; then
    echo "✅ Frontend build successful"
else
    echo "❌ Frontend build failed"
    exit 1
fi

# Step 9: Calculate final size
echo "📊 Step 9: Final size calculation..."
PROJECT_SIZE=$(du -sh . 2>/dev/null | cut -f1 || echo "Unknown")
NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1 || echo "Unknown")
DIST_SIZE=$(du -sh dist 2>/dev/null | cut -f1 || echo "Unknown")

echo ""
echo "🎉 Production build complete!"
echo ""
echo "📊 Size Report:"
echo "  Total project size: $PROJECT_SIZE"
echo "  Node modules size: $NODE_MODULES_SIZE"
echo "  Build output size: $DIST_SIZE"
echo ""
echo "✅ Optimizations applied:"
echo "  - Attached assets removed (~112MB saved)"
echo "  - Upload directories cleaned"
echo "  - Node modules optimized"
echo "  - Development dependencies removed"
echo "  - Source maps and TS files removed"
echo "  - Documentation and examples removed"
echo "  - Console logs stripped from production build"
echo "  - Code minified and tree-shaken"
echo ""
echo "🚀 Ready for deployment!"
echo "   Use: npm start"