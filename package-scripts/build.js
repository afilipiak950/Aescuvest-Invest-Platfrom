#!/usr/bin/env node
// Build script for deployment
const { execSync } = require('child_process');

console.log('🚀 Starting production build...');

try {
  // Make the build script executable
  execSync('chmod +x ./build', { stdio: 'inherit' });
  
  // Run the build
  execSync('./build', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}