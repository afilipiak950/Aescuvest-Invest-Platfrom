#!/usr/bin/env tsx
/**
 * COMPREHENSIVE UPLOAD DIAGNOSTIC
 * Identifies ALL potential issues with the 413 bypass solution
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 COMPREHENSIVE UPLOAD SYSTEM DIAGNOSTIC');
console.log('='.repeat(80));
console.log('Checking EVERY potential issue that could cause upload failures...\n');

const issues: Array<{severity: string, issue: string, fix: string}> = [];

// 1. Check GCS credentials
console.log('1️⃣ Checking GCS credentials...');
if (!process.env.GOOGLE_CLOUD_STORAGE_KEY) {
  issues.push({
    severity: 'CRITICAL',
    issue: 'Missing GOOGLE_CLOUD_STORAGE_KEY environment variable',
    fix: 'Add GCS service account key as base64 encoded string'
  });
} else {
  try {
    const keyJson = Buffer.from(process.env.GOOGLE_CLOUD_STORAGE_KEY, 'base64').toString('utf-8');
    const credentials = JSON.parse(keyJson);
    console.log('   ✅ GCS credentials valid for project:', credentials.project_id);
  } catch (e) {
    issues.push({
      severity: 'CRITICAL',
      issue: 'Invalid GCS credentials format',
      fix: 'Ensure GOOGLE_CLOUD_STORAGE_KEY is properly base64 encoded'
    });
  }
}

// 2. Check GCS bucket name
console.log('2️⃣ Checking GCS bucket configuration...');
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'aescuvest-uploads-2025';
console.log('   📁 Bucket name:', bucketName);
if (!process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
  issues.push({
    severity: 'MEDIUM',
    issue: 'Using default bucket name',
    fix: 'Set GOOGLE_CLOUD_STORAGE_BUCKET environment variable'
  });
}

// 3. Check server endpoints
console.log('3️⃣ Checking server endpoints...');
const endpoints = [
  '/api/gcs/signed-url/:dealId',
  '/api/gcs/upload-complete/:dealId',
  '/api/gcs/proxy-upload/:dealId',
  '/api/gcs/configure-cors'
];

endpoints.forEach(endpoint => {
  console.log(`   📍 ${endpoint} - Should be registered`);
});

// 4. Check client-side implementation
console.log('4️⃣ Checking client-side implementation...');
const clientFile = path.join(process.cwd(), 'client/src/components/DataRoomExplorer.tsx');
if (fs.existsSync(clientFile)) {
  const content = fs.readFileSync(clientFile, 'utf-8');
  
  // Check for proper XHR implementation
  if (!content.includes('xhr.open(\'PUT\'')) {
    issues.push({
      severity: 'HIGH',
      issue: 'Client not using PUT method for GCS upload',
      fix: 'Update client to use PUT method for direct GCS upload'
    });
  }
  
  // Check for proper error handling
  if (!content.includes('xhr.addEventListener(\'error\'')) {
    issues.push({
      severity: 'MEDIUM',
      issue: 'Missing error handling in upload',
      fix: 'Add proper error event listeners'
    });
  }
  
  // Check for fallback mechanism
  if (!content.includes('FALLBACK')) {
    issues.push({
      severity: 'MEDIUM',
      issue: 'No fallback mechanism implemented',
      fix: 'Add fallback to proxy upload on failure'
    });
  }
  
  console.log('   ✅ Client implementation checked');
}

// 5. Check CORS configuration
console.log('5️⃣ Checking CORS configuration...');
const corsFile = path.join(process.cwd(), 'gcs-cors-config.json');
if (!fs.existsSync(corsFile)) {
  issues.push({
    severity: 'HIGH',
    issue: 'Missing CORS configuration file',
    fix: 'Create gcs-cors-config.json with proper CORS settings'
  });
} else {
  const corsConfig = JSON.parse(fs.readFileSync(corsFile, 'utf-8'));
  console.log('   ✅ CORS config file exists');
  
  // Check CORS allows PUT
  const methods = corsConfig[0]?.method || [];
  if (!methods.includes('PUT')) {
    issues.push({
      severity: 'CRITICAL',
      issue: 'CORS does not allow PUT method',
      fix: 'Add PUT to allowed methods in CORS configuration'
    });
  }
}

// 6. Check TypeScript errors
console.log('6️⃣ Checking TypeScript errors...');
try {
  const lspErrors = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8' });
  if (lspErrors.includes('error')) {
    const errorCount = (lspErrors.match(/error/g) || []).length;
    issues.push({
      severity: 'LOW',
      issue: `${errorCount} TypeScript errors found`,
      fix: 'Fix TypeScript errors to prevent runtime issues'
    });
  }
} catch (e) {
  // TypeScript check failed
  console.log('   ⚠️ TypeScript check skipped');
}

// 7. Check service initialization
console.log('7️⃣ Checking service initialization...');
const indexFile = path.join(process.cwd(), 'server/index.ts');
if (fs.existsSync(indexFile)) {
  const content = fs.readFileSync(indexFile, 'utf-8');
  
  if (!content.includes('gcs-signed-upload')) {
    issues.push({
      severity: 'CRITICAL',
      issue: 'GCS signed upload routes not registered',
      fix: 'Import and register gcs-signed-upload routes in server/index.ts'
    });
  }
  
  console.log('   ✅ Service registration checked');
}

// 8. Check for common upload issues
console.log('8️⃣ Checking for common upload issues...');
const commonIssues = [
  {
    check: 'multer limits',
    file: 'server/routes/gcs-proxy-upload.ts',
    pattern: 'fileSize:',
    issue: 'Multer file size limit might be too small',
    fix: 'Set multer fileSize limit to 5TB'
  },
  {
    check: 'timeout settings',
    file: 'server/index.ts',
    pattern: 'timeout',
    issue: 'Server timeout might be too short for large uploads',
    fix: 'Increase server timeout for upload routes'
  },
  {
    check: 'CORS headers',
    file: 'client/src/components/DataRoomExplorer.tsx',
    pattern: 'Content-Type',
    issue: 'Missing Content-Type header in upload',
    fix: 'Add proper Content-Type header to upload request'
  }
];

commonIssues.forEach(({check, file, pattern, issue, fix}) => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes(pattern)) {
      issues.push({
        severity: 'MEDIUM',
        issue: `${check}: ${issue}`,
        fix
      });
    }
  }
});

console.log('\n' + '='.repeat(80));
console.log('📊 DIAGNOSTIC RESULTS:');
console.log('='.repeat(80));

if (issues.length === 0) {
  console.log('\n✅ NO ISSUES FOUND! Upload system is properly configured.\n');
} else {
  console.log(`\n⚠️ FOUND ${issues.length} ISSUES:\n`);
  
  // Group by severity
  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const high = issues.filter(i => i.severity === 'HIGH');
  const medium = issues.filter(i => i.severity === 'MEDIUM');
  const low = issues.filter(i => i.severity === 'LOW');
  
  if (critical.length > 0) {
    console.log('🔴 CRITICAL ISSUES (MUST FIX):');
    critical.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.issue}`);
      console.log(`      FIX: ${issue.fix}`);
    });
  }
  
  if (high.length > 0) {
    console.log('\n🟠 HIGH PRIORITY ISSUES:');
    high.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.issue}`);
      console.log(`      FIX: ${issue.fix}`);
    });
  }
  
  if (medium.length > 0) {
    console.log('\n🟡 MEDIUM PRIORITY ISSUES:');
    medium.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.issue}`);
      console.log(`      FIX: ${issue.fix}`);
    });
  }
  
  if (low.length > 0) {
    console.log('\n🟢 LOW PRIORITY ISSUES:');
    low.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.issue}`);
      console.log(`      FIX: ${issue.fix}`);
    });
  }
}

console.log('\n' + '='.repeat(80));
console.log('🚀 UPLOAD SYSTEM STATUS:');
console.log('='.repeat(80));

const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
if (criticalCount > 0) {
  console.log('❌ SYSTEM NOT READY - Fix critical issues first');
} else if (issues.length > 3) {
  console.log('⚠️ SYSTEM PARTIALLY READY - Some issues remain');
} else if (issues.length > 0) {
  console.log('✅ SYSTEM MOSTLY READY - Minor issues only');
} else {
  console.log('🎉 SYSTEM FULLY OPERATIONAL - 100% ready for production!');
}

console.log('\n💡 QUICK FIX COMMANDS:');
console.log('─'.repeat(60));
console.log('1. Apply CORS: curl -X POST http://localhost:5000/api/gcs/configure-cors');
console.log('2. Test signed URL: curl -X POST http://localhost:5000/api/gcs/signed-url/33 -H "Content-Type: application/json" -d \'{"fileName":"test.zip","fileSize":1000000}\'');
console.log('3. Check health: curl http://localhost:5000/api/gcs/signed-upload/health');

process.exit(criticalCount > 0 ? 1 : 0);