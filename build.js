#!/usr/bin/env node

// NPM build.js script for Replit deployment
// This file acts as the build script when npm run build is called

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting deployment build...');

try {
  // Make build script executable
  execSync('chmod +x ./build', { stdio: 'inherit' });
  
  // Run our comprehensive build script
  execSync('./build', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('✅ Deployment build completed successfully!');
  process.exit(0);
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}