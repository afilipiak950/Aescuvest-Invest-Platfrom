#!/usr/bin/env node

// Production startup check script
// This helps diagnose deployment issues

console.log('🚀 Production Startup Check');
console.log('============================');

// Check critical environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'MISTRAL_API_KEY',
  'GOOGLE_CLOUD_STORAGE_BUCKET',
  'GOOGLE_CLOUD_STORAGE_KEY'
];

let missingVars = [];

console.log('\n📋 Environment Variables Check:');
for (const varName of requiredEnvVars) {
  if (process.env[varName]) {
    console.log(`✅ ${varName}: Set`);
  } else {
    console.log(`❌ ${varName}: Missing`);
    missingVars.push(varName);
  }
}

// Check PORT configuration
const port = process.env.PORT || 5000;
console.log(`\n🔌 PORT Configuration: ${port}`);

// Check NODE_ENV
console.log(`🏭 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// Check if dist folder exists
const fs = require('fs');
const path = require('path');

console.log('\n📦 Build Files Check:');
if (fs.existsSync('./dist/index.js')) {
  const stats = fs.statSync('./dist/index.js');
  console.log(`✅ dist/index.js exists (${(stats.size / 1024).toFixed(2)} KB)`);
} else {
  console.log('❌ dist/index.js not found');
}

if (fs.existsSync('./client/dist')) {
  console.log('✅ client/dist folder exists');
} else {
  console.log('❌ client/dist folder not found');
}

// Summary
console.log('\n============================');
if (missingVars.length > 0) {
  console.log('⚠️  DEPLOYMENT WILL FAIL!');
  console.log(`Missing environment variables: ${missingVars.join(', ')}`);
  console.log('\n📝 To fix:');
  console.log('1. Go to Replit Secrets tab (🔒 icon)');
  console.log('2. Add the missing environment variables');
  console.log('3. Redeploy your application');
  process.exit(1);
} else {
  console.log('✅ All critical environment variables are set');
  console.log('The deployment should succeed if database connection works');
}