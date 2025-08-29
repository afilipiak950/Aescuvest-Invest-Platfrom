#!/usr/bin/env node

// NPM build.js script for Replit deployment
// This file acts as the build script when npm run build is called

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting deployment build...');

// Fallback build function using direct Node.js commands
function fallbackBuild() {
  console.log('🔄 Using fallback build process...');
  
  // Set production environment
  process.env.NODE_ENV = 'production';
  
  // Basic cleanup
  execSync('rm -rf dist 2>/dev/null || true', { stdio: 'inherit' });
  execSync('rm -rf build 2>/dev/null || true', { stdio: 'inherit' });
  execSync('rm -rf node_modules/.cache 2>/dev/null || true', { stdio: 'inherit' });
  execSync('rm -rf .vite 2>/dev/null || true', { stdio: 'inherit' });
  
  // Clean upload directories
  console.log('📁 Preparing deployment directories...');
  execSync('find uploads -type f -delete 2>/dev/null || true', { stdio: 'inherit' });
  execSync('find attached_assets -type f -delete 2>/dev/null || true', { stdio: 'inherit' });
  
  // Build frontend
  console.log('🔨 Building frontend...');
  execSync('cd client && npx vite build --mode production', { stdio: 'inherit' });
  
  // Build backend
  console.log('🔨 Building backend...');
  execSync(`npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify --tree-shaking=true --target=node18`, { stdio: 'inherit' });
  
  console.log('✅ Production build completed successfully!');
}

try {
  // Try using the shell script first
  if (existsSync('./build')) {
    console.log('📋 Using shell script build process...');
    execSync('chmod +x ./build', { stdio: 'inherit' });
    execSync('./build', { stdio: 'inherit', cwd: process.cwd() });
  } else {
    // Fall back to direct Node.js implementation
    fallbackBuild();
  }
  
  console.log('✅ Deployment build completed successfully!');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  
  // Try fallback if shell script failed
  if (existsSync('./build')) {
    console.log('🔄 Shell script failed, trying fallback...');
    try {
      fallbackBuild();
      process.exit(0);
    } catch (fallbackError) {
      console.error('❌ Fallback build also failed:', fallbackError.message);
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}