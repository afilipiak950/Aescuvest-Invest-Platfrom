#!/usr/bin/env tsx

/**
 * Restart Enhanced HR Analysis with 10x Better Document Coverage
 * This script clears existing HR analysis and runs the enhanced comprehensive analysis
 * that analyzes ALL relevant documents for better salary, contract, and policy insights.
 */

import { db } from './server/db';
import { comprehensiveHrAnalyses, backgroundJobs } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import { startComprehensiveHrAnalysis } from './server/comprehensiveHrAnalysisService';

async function restartEnhancedHrAnalysis() {
  const dealId = 22; // Intellywave deal ID
  
  try {
    console.log(`🏢 Starting enhanced HR analysis restart for deal ${dealId}...`);
    
    // Step 1: Clear any existing background jobs
    console.log('🧹 Clearing existing HR background jobs...');
    const deletedJobs = await db
      .delete(backgroundJobs)
      .where(and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.agentType, 'hr')
      ));
    console.log(`✅ Cleared ${deletedJobs.rowCount || 0} existing HR background jobs`);
    
    // Step 2: Clear existing comprehensive HR analysis
    console.log('🧹 Clearing existing comprehensive HR analysis...');
    const deletedAnalysis = await db
      .delete(comprehensiveHrAnalyses)
      .where(eq(comprehensiveHrAnalyses.dealId, dealId));
    console.log(`✅ Cleared ${deletedAnalysis.rowCount || 0} existing HR analyses`);
    
    // Step 3: Start enhanced comprehensive HR analysis
    console.log('🚀 Starting enhanced comprehensive HR analysis...');
    const result = await startComprehensiveHrAnalysis(dealId);
    
    if (result.success) {
      console.log(`✅ Enhanced HR analysis started successfully!`);
      console.log(`📊 Job ID: ${result.jobId}`);
      console.log(`📋 The enhanced system will now analyze ALL relevant documents with:`);
      console.log(`   • 10x better document coverage (all 263 documents if needed)`);
      console.log(`   • Enhanced keyword matching for salary/compensation questions`);
      console.log(`   • Comprehensive evidence extraction using detailed AI prompts`);
      console.log(`   • Broader document filtering for maximum coverage`);
      console.log(`   • Improved analysis across all 32 HR questions in 7 categories`);
      console.log(`\n🔄 Monitor progress at: http://localhost:5000/deals/${dealId}/due-diligence`);
    } else {
      console.error(`❌ Failed to start enhanced HR analysis: ${result.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error during enhanced HR analysis restart:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the enhanced HR analysis restart
restartEnhancedHrAnalysis().catch(console.error);

export { restartEnhancedHrAnalysis };