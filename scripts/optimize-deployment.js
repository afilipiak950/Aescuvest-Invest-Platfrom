#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🚀 Starting deployment optimization...');

// 1. Clean up large directories and files
const dirsToClean = [
  'uploads',
  'node_modules/.cache',
  'dist',
  '.vite',
  'server/uploads'
];

dirsToClean.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`🧹 Removing ${dir}...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 2. Clean up log files
const logFiles = [
  '*.log',
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*'
];

console.log('🧹 Cleaning log files...');
try {
  execSync('find . -name "*.log" -type f -delete', { stdio: 'inherit' });
} catch (error) {
  console.log('No log files to clean');
}

// 3. Ensure uploads directory is recreated for runtime
console.log('📁 Creating empty uploads directory...');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// 4. Create .dockerignore for better deployment
const dockerIgnoreContent = `node_modules/.cache
uploads/*
!uploads/.gitkeep
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
.vscode
.idea
test-*
scripts/
attached_assets/
*.zip
*.rar
*.7z
*.gz
*.bz2
*.pdf
*.docx
*.xlsx
README.md
.git
.gitignore
`;

fs.writeFileSync('.dockerignore', dockerIgnoreContent);
console.log('📝 Created .dockerignore');

// 5. Create empty .gitkeep in uploads to ensure directory exists
fs.writeFileSync('uploads/.gitkeep', '');
console.log('📝 Created uploads/.gitkeep');

console.log('✅ Deployment optimization complete!');
console.log('💡 Size reduction achieved:');
console.log('  - Removed uploads directory content');
console.log('  - Cleaned node_modules cache');
console.log('  - Added deployment ignore patterns');
console.log('  - Ensured runtime directories exist');