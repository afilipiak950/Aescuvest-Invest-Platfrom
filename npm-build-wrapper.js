#!/usr/bin/env node

// This file acts as a workaround for npm run build
// It's called by the deployment system when build is needed

const { execSync } = require('child_process');

console.log('🚀 Deployment build started...');

try {
  // Make sure our build script is executable
  execSync('chmod +x ./build', { stdio: 'inherit' });
  
  // Execute our build script
  execSync('./build', { stdio: 'inherit' });
  
  console.log('✅ Deployment build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
