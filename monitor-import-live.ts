#!/usr/bin/env tsx

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';
import * as schema from './shared/schema';

const neonConfig = await import('@neondatabase/serverless').then(mod => mod.neonConfig);
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function monitorImportLive(): Promise<void> {
  console.log('🔍 Monitoring import progress...');
  
  let previousCount = 0;
  let checkCount = 0;
  
  while (checkCount < 60) { // Monitor for 60 checks (10 minutes)
    checkCount++;
    
    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(schema.organizations);
      const currentCount = result[0].count;
      
      if (currentCount !== previousCount) {
        const change = currentCount - previousCount;
        console.log(`📊 Check #${checkCount}: ${currentCount} organizations (+${change} new)`);
        previousCount = currentCount;
      } else {
        console.log(`📊 Check #${checkCount}: ${currentCount} organizations (no change)`);
      }
      
      // Check if we've reached our target
      if (currentCount >= 5000) {
        console.log('🎯 TARGET REACHED: 5,000+ organizations imported!');
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
    } catch (error) {
      console.error(`❌ Error monitoring: ${error.message}`);
    }
  }
  
  console.log('🏁 Monitoring complete');
  await pool.end();
}

monitorImportLive()
  .then(() => console.log('Monitoring finished'))
  .catch(error => console.error('Monitoring failed:', error));