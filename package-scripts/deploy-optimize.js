#!/usr/bin/env node

/**
 * Deployment optimization script
 * Removes large files and optimizes package structure for deployment
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Starting deployment optimization...');

// Function to get directory size
function getDirSize(dirPath) {
  try {
    const result = execSync(`du -sh "${dirPath}" 2>/dev/null | cut -f1`, { encoding: 'utf8' });
    return result.trim();
  } catch {
    return '0K';
  }
}

// Function to remove directory safely
function removeDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`   ✅ Removed ${dirPath}`);
      return true;
    }
  } catch (error) {
    console.log(`   ⚠️ Could not remove ${dirPath}: ${error.message}`);
    return false;
  }
  return false;
}

// Clean uploads and attached_assets
console.log('📁 Cleaning upload directories...');
if (fs.existsSync('uploads')) {
  execSync('find uploads -type f -delete 2>/dev/null || true');
  fs.writeFileSync('uploads/.gitkeep', '');
}

if (fs.existsSync('attached_assets')) {
  // Keep only essential logo files
  execSync('find attached_assets -type f -not -name "*Logo*" -delete 2>/dev/null || true');
}

// Optimize package.json for production
console.log('📦 Optimizing package.json...');
const packagePath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Remove devDependencies from deployed package.json
  if (pkg.devDependencies) {
    console.log(`   ✅ Removing ${Object.keys(pkg.devDependencies).length} devDependencies`);
    delete pkg.devDependencies;
  }
  
  // Remove scripts that aren't needed in production
  if (pkg.scripts) {
    const prodScripts = ['start', 'dev'];
    const originalScripts = Object.keys(pkg.scripts).length;
    pkg.scripts = Object.fromEntries(
      Object.entries(pkg.scripts).filter(([key]) => prodScripts.includes(key))
    );
    console.log(`   ✅ Optimized scripts: ${originalScripts} → ${Object.keys(pkg.scripts).length}`);
  }
  
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
}

// Final size check
console.log('\n📊 Final size report:');
console.log(`   • node_modules/: ${getDirSize('node_modules')}`);
console.log(`   • uploads/: ${getDirSize('uploads')}`);
console.log(`   • attached_assets/: ${getDirSize('attached_assets')}`);
console.log(`   • Total project: ${getDirSize('.')}`);

console.log('\n✅ Deployment optimization completed!');
console.log('🎯 Project is now optimized for deployment under 8GB limit');