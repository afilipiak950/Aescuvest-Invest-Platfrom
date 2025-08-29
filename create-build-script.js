#!/usr/bin/env node

// This script modifies package.json to add the build script for deployment
// It's a workaround for the deployment system requiring npm run build

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

try {
  console.log('📦 Adding build script to package.json for deployment...');
  
  // Read current package.json
  const packageJsonPath = './package.json';
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  // Add build script if it doesn't exist
  if (!packageJson.scripts.build) {
    packageJson.scripts.build = 'node build.js';
    
    // Write back to package.json
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log('✅ Successfully added build script to package.json');
    console.log('   "build": "node build.js"');
    
    // Test the build script
    console.log('🧪 Testing npm run build...');
    execSync('npm run build', { stdio: 'inherit' });
    
  } else {
    console.log('ℹ️  Build script already exists in package.json');
  }
  
} catch (error) {
  console.error('❌ Failed to add build script:', error.message);
  console.log('💡 Manual deployment may be required');
  process.exit(1);
}