#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

// Configure WebSocket for Neon
const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function monitorImportProgress(): Promise<void> {
  console.log('📊 Monitoring Affinity Organization Import Progress...\n');
  
  let previousCount = 0;
  let checkCount = 0;
  const maxChecks = 60; // Monitor for 10 minutes (60 checks * 10 seconds)
  
  while (checkCount < maxChecks) {
    try {
      // Get current count
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.organizations);
      
      const currentCount = result[0].count;
      const progress = currentCount - previousCount;
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      
      // Show progress
      console.log(`[${timestamp}] Organizations: ${currentCount} (${progress >= 0 ? '+' : ''}${progress})`);
      
      // Check if import is making progress
      if (progress === 0 && checkCount > 5) {
        console.log('⚠️  Import may have stalled - checking process...');
        
        // Show sample of recent organizations
        const recentOrgs = await db
          .select({
            id: schema.organizations.id,
            name: schema.organizations.name,
            affinityId: schema.organizations.affinityId,
            syncStatus: schema.organizations.syncStatus,
            updatedAt: schema.organizations.updatedAt
          })
          .from(schema.organizations)
          .orderBy(sql`updated_at DESC`)
          .limit(5);
        
        console.log('📋 Recent organizations imported:');
        recentOrgs.forEach(org => {
          console.log(`   - ${org.name} (ID: ${org.affinityId})`);
        });
      }
      
      // Check if we've reached expected target
      if (currentCount >= 8000) {
        console.log('🎯 SUCCESS: Imported 8,000+ organizations!');
        break;
      }
      
      previousCount = currentCount;
      checkCount++;
      
      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
      
    } catch (error) {
      console.error('❌ Error monitoring progress:', error);
      break;
    }
  }
  
  // Final summary
  console.log('\n📊 Final Import Summary:');
  
  const finalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.organizations);
  
  console.log(`   Total Organizations: ${finalResult[0].count}`);
  
  // Show sync status breakdown
  const statusBreakdown = await db
    .select({
      syncStatus: schema.organizations.syncStatus,
      count: sql<number>`count(*)`
    })
    .from(schema.organizations)
    .groupBy(schema.organizations.syncStatus);
  
  console.log('   Sync Status Breakdown:');
  statusBreakdown.forEach(status => {
    console.log(`     ${status.syncStatus}: ${status.count}`);
  });
  
  await pool.end();
  console.log('\n✅ Monitoring complete');
}

monitorImportProgress()
  .catch(console.error);