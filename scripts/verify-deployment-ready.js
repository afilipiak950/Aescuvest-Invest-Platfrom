#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying deployment readiness...');

let issues = [];
let warnings = [];

// Check for large directories that shouldn't be in deployment
const largeDirs = ['uploads', 'node_modules/.cache', '.vite', 'test-*'];
largeDirs.forEach(dir => {
  if (fs.existsSync(dir) && dir !== 'uploads') {
    const stats = fs.statSync(dir);
    if (stats.isDirectory()) {
      issues.push(`Large directory found: ${dir}`);
    }
  }
});

// Check uploads directory is empty but exists
if (fs.existsSync('uploads')) {
  const files = fs.readdirSync('uploads').filter(f => f !== '.gitkeep');
  if (files.length > 0) {
    warnings.push(`Uploads directory contains ${files.length} files - these will increase deployment size`);
  }
} else {
  issues.push('Uploads directory missing - will be created at runtime');
}

// Check .dockerignore exists
if (!fs.existsSync('.dockerignore')) {
  issues.push('.dockerignore file missing');
} else {
  console.log('✅ .dockerignore file present');
}

// Check for log files
const logFiles = [];
function findLogFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
      findLogFiles(fullPath);
    } else if (item.endsWith('.log')) {
      logFiles.push(fullPath);
    }
  });
}

findLogFiles('.');
if (logFiles.length > 0) {
  warnings.push(`Found ${logFiles.length} log files that could be removed`);
}

// Check environment example file
if (!fs.existsSync('.env.example')) {
  issues.push('Missing .env.example file for deployment guidance');
} else {
  console.log('✅ Environment example file present');
}

// Check build script
if (!fs.existsSync('build.sh')) {
  issues.push('Missing optimized build script');
} else {
  console.log('✅ Build script present');
}

// Check package.json for production readiness
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!pkg.scripts.start) {
    issues.push('Missing start script in package.json');
  }
  if (!pkg.scripts.build) {
    issues.push('Missing build script in package.json');
  }
  console.log('✅ Package.json scripts present');
}

// Estimate deployment size
function getDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let size = 0;
  const items = fs.readdirSync(dirPath);
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else {
      size += stats.size;
    }
  });
  return size;
}

const nodeModulesSize = getDirectorySize('node_modules');
const uploadsSize = getDirectorySize('uploads');
const totalSize = nodeModulesSize + uploadsSize;

console.log('\n📊 Deployment Size Analysis:');
console.log(`  Node modules: ${(nodeModulesSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Uploads: ${(uploadsSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Estimated total: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);

if (totalSize > 8 * 1024 * 1024 * 1024) { // 8GB
  issues.push(`Deployment size (${(totalSize / 1024 / 1024 / 1024).toFixed(1)} GB) exceeds 8GB limit`);
}

// Print results
console.log('\n📋 Deployment Readiness Report:');
if (issues.length === 0) {
  console.log('✅ No critical issues found');
} else {
  console.log('❌ Issues found:');
  issues.forEach(issue => console.log(`  - ${issue}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  Warnings:');
  warnings.forEach(warning => console.log(`  - ${warning}`));
}

console.log('\n🚀 Deployment Tips:');
console.log('  1. Run ./build.sh for optimized production build');
console.log('  2. Set all environment variables from .env.example');
console.log('  3. Ensure database connection is configured');
console.log('  4. Test with NODE_ENV=production locally first');

const isReady = issues.length === 0;
console.log(`\n${isReady ? '✅' : '❌'} Deployment ${isReady ? 'READY' : 'NOT READY'}`);

process.exit(isReady ? 0 : 1);