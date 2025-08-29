#!/usr/bin/env node

// NPM build script for Replit deployment
// This script acts as a bridge to run the existing build scripts

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Replit deployment build via npm...');

// Run the comprehensive production build script
const buildScript = join(__dirname, 'build-production.sh');

const buildProcess = spawn('bash', [buildScript], {
  stdio: 'inherit',
  cwd: __dirname
});

buildProcess.on('error', (error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Build completed successfully!');
    process.exit(0);
  } else {
    console.error(`❌ Build failed with code ${code}`);
    process.exit(code);
  }
});