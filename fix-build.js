#!/usr/bin/env node

// Comprehensive build fix script for Replit deployment
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

console.log('🔧 Starting comprehensive build fix...');

try {
  // Step 1: Clean previous builds
  console.log('🧹 Cleaning previous builds...');
  try {
    execSync('rm -rf dist test-dist client/dist', { stdio: 'inherit' });
  } catch (e) {
    console.log('Nothing to clean');
  }

  // Step 2: Create required directories
  console.log('📁 Creating required directories...');
  mkdirSync('dist', { recursive: true });
  mkdirSync('dist/public', { recursive: true });
  
  // Step 3: Build frontend with explicit config
  console.log('🔨 Building frontend...');
  process.chdir('client');
  
  // Create a minimal index.html for the build if it doesn't exist
  const indexPath = 'index.html';
  if (!existsSync(indexPath)) {
    console.log('Creating minimal index.html...');
    execSync(`echo '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VC Intelligence Platform</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>' > index.html`, { stdio: 'inherit' });
  }
  
  // Build with vite
  execSync('npx vite build --outDir ../dist/public --emptyOutDir', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  // Step 4: Build backend
  console.log('🔧 Building backend...');
  process.chdir('..');
  
  execSync(`npx esbuild server/index.ts \\
    --platform=node \\
    --packages=external \\
    --bundle \\
    --format=esm \\
    --outdir=dist \\
    --minify \\
    --tree-shaking=true \\
    --target=node18 \\
    --sourcemap=false`, { stdio: 'inherit' });

  // Step 5: Create startup script
  console.log('📝 Creating startup script...');
  execSync(`echo '#!/bin/bash
export NODE_ENV=production
node dist/index.js' > dist/start.sh`, { stdio: 'inherit' });
  
  execSync('chmod +x dist/start.sh', { stdio: 'inherit' });

  console.log('✅ Build completed successfully!');
  console.log('📊 Build summary:');
  
  try {
    execSync('ls -la dist/', { stdio: 'inherit' });
    execSync('du -sh dist/', { stdio: 'inherit' });
  } catch (e) {
    console.log('Could not display build summary');
  }
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}