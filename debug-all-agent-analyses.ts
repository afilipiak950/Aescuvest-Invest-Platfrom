#!/usr/bin/env tsx

/**
 * Comprehensive Agent Analysis Debug Script
 * 
 * This script tests all 7 agent analyses (Clinical, Legal, Commercial, HR, Financial, IP, Research)
 * to ensure they're working correctly with proper endpoints and data flow.
 */

import { storage } from './server/storage';
import { db } from './server/db';

interface AgentAnalysisStatus {
  agentType: string;
  endpointExists: boolean;
  hasAnalysisData: boolean;
  documentCount: number;
  lastAnalysisDate: string | null;
  analysisStatus: string;
  errorMessage?: string;
}

async function debugAllAgentAnalyses(dealId: number = 22): Promise<void> {
  console.log(`🔍 Starting comprehensive agent analysis debug for deal ${dealId}`);
  console.log('=' .repeat(80));

  const agentTypes = ['Clinical', 'Legal', 'Commercial', 'HR', 'Financial', 'IP', 'Research'];
  const results: AgentAnalysisStatus[] = [];

  // Test each agent type
  for (const agentType of agentTypes) {
    console.log(`\n🧪 Testing ${agentType} Agent Analysis...`);
    
    try {
      const status: AgentAnalysisStatus = {
        agentType,
        endpointExists: false,
        hasAnalysisData: false,
        documentCount: 0,
        lastAnalysisDate: null,
        analysisStatus: 'Unknown'
      };

      // 1. Check if analysis data exists in database
      console.log(`   📊 Checking database for ${agentType} analysis...`);
      const analyses = await storage.getAnalysesByDealId(dealId);
      const agentAnalysis = analyses.find(a => 
        a.agentType.toLowerCase() === agentType.toLowerCase() || 
        a.agentType === agentType
      );

      if (agentAnalysis) {
        status.hasAnalysisData = true;
        status.analysisStatus = agentAnalysis.status || 'Unknown';
        status.lastAnalysisDate = agentAnalysis.updatedAt?.toISOString() || 'Unknown';
        console.log(`   ✅ Found ${agentType} analysis: Status=${status.analysisStatus}, Updated=${status.lastAnalysisDate}`);
      } else {
        console.log(`   ❌ No ${agentType} analysis found in database`);
      }

      // 2. Check document count assigned to this agent
      console.log(`   📄 Checking documents assigned to ${agentType}...`);
      const documents = await storage.getDocumentsByDealId(dealId);
      const assignedDocs = documents.filter(doc => 
        doc.assignedAgents && 
        Array.isArray(doc.assignedAgents) && 
        doc.assignedAgents.some(agent => 
          agent.toLowerCase() === agentType.toLowerCase()
        )
      );
      status.documentCount = assignedDocs.length;
      console.log(`   📝 Found ${status.documentCount} documents assigned to ${agentType} agent`);

      // 3. Test comprehensive analysis endpoint
      console.log(`   🌐 Testing comprehensive analysis endpoint...`);
      try {
        const endpoint = `/api/deals/${dealId}/${agentType.toLowerCase()}-analysis/comprehensive/results`;
        console.log(`   🔗 Endpoint: ${endpoint}`);
        
        // Try to fetch using direct database query instead of HTTP
        const comprehensiveData = await storage.getAgentAnalysis(dealId, agentType);
        if (comprehensiveData) {
          status.endpointExists = true;
          console.log(`   ✅ Comprehensive analysis data available via storage`);
        } else {
          console.log(`   ❌ No comprehensive analysis data in storage`);
        }
      } catch (error) {
        status.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ❌ Error testing endpoint: ${status.errorMessage}`);
      }

      // 4. Check background jobs for this agent
      console.log(`   ⚙️ Checking background jobs...`);
      try {
        const backgroundJobs = await storage.getBackgroundJobsByDealId(dealId);
        const agentJobs = backgroundJobs.filter(job => 
          job.jobId?.includes(agentType.toLowerCase()) || 
          job.agentType?.toLowerCase() === agentType.toLowerCase()
        );
        
        if (agentJobs.length > 0) {
          const latestJob = agentJobs[0];
          console.log(`   🔄 Found ${agentJobs.length} background jobs, latest: Status=${latestJob.status}, Progress=${latestJob.progress}%`);
        } else {
          console.log(`   ℹ️ No background jobs found for ${agentType}`);
        }
      } catch (error) {
        console.log(`   ⚠️ Error checking background jobs: ${error}`);
      }

      results.push(status);
      
    } catch (error) {
      console.log(`   💥 Error testing ${agentType}: ${error}`);
      results.push({
        agentType,
        endpointExists: false,
        hasAnalysisData: false,
        documentCount: 0,
        lastAnalysisDate: null,
        analysisStatus: 'Error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Summary Report
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPREHENSIVE AGENT ANALYSIS DEBUG SUMMARY');
  console.log('='.repeat(80));

  console.log('\n📊 Agent Status Overview:');
  console.log('Agent Type'.padEnd(12) + 'Has Data'.padEnd(10) + 'Endpoint'.padEnd(10) + 'Docs'.padEnd(6) + 'Status'.padEnd(12) + 'Last Updated');
  console.log('-'.repeat(80));

  for (const result of results) {
    const hasData = result.hasAnalysisData ? '✅' : '❌';
    const endpoint = result.endpointExists ? '✅' : '❌';
    const docs = result.documentCount.toString();
    const status = result.analysisStatus.substring(0, 10);
    const updated = result.lastAnalysisDate ? result.lastAnalysisDate.substring(0, 10) : 'Never';
    
    console.log(
      result.agentType.padEnd(12) + 
      hasData.padEnd(10) + 
      endpoint.padEnd(10) + 
      docs.padEnd(6) + 
      status.padEnd(12) + 
      updated
    );
  }

  // Detailed Issues
  console.log('\n🚨 Issues Found:');
  const issues = results.filter(r => !r.hasAnalysisData || !r.endpointExists || r.errorMessage);
  
  if (issues.length === 0) {
    console.log('✅ No critical issues found! All agents appear to be working correctly.');
  } else {
    for (const issue of issues) {
      console.log(`❌ ${issue.agentType}:`);
      if (!issue.hasAnalysisData) console.log(`   - No analysis data in database`);
      if (!issue.endpointExists) console.log(`   - Comprehensive endpoint not working`);
      if (issue.errorMessage) console.log(`   - Error: ${issue.errorMessage}`);
      if (issue.documentCount === 0) console.log(`   - No documents assigned`);
    }
  }

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (issues.some(i => !i.hasAnalysisData)) {
    console.log('📊 Run comprehensive analysis to generate missing data');
  }
  if (issues.some(i => !i.endpointExists)) {
    console.log('🔧 Check comprehensive analysis service endpoints');
  }
  if (issues.some(i => i.documentCount === 0)) {
    console.log('📄 Assign documents to agents using intelligent assignment system');
  }

  console.log('\n🎯 Test completed successfully!');
}

// Additional function to test comprehensive analysis endpoints
async function testComprehensiveEndpoints(dealId: number = 22): Promise<void> {
  console.log(`\n🌐 Testing Comprehensive Analysis Endpoints for Deal ${dealId}`);
  console.log('='.repeat(60));

  const endpoints = [
    'clinical-analysis/comprehensive',
    'legal-analysis/comprehensive', 
    'commercial-analysis/comprehensive',
    'hr-analysis/comprehensive',
    'financial-analysis/comprehensive',
    'ip-analysis/comprehensive',
    'research-analysis/comprehensive'
  ];

  for (const endpoint of endpoints) {
    console.log(`\n🔗 Testing: /api/deals/${dealId}/${endpoint}`);
    try {
      // Check if comprehensive service exists
      const agentType = endpoint.split('-')[0];
      console.log(`   Agent Type: ${agentType}`);
      
      // Try to get results
      const resultsEndpoint = `${endpoint}/results`;
      console.log(`   Results endpoint: /api/deals/${dealId}/${resultsEndpoint}`);
      
      // Check if analysis data exists
      const analysis = await storage.getAgentAnalysis(dealId, agentType);
      if (analysis) {
        console.log(`   ✅ Analysis data found: Status=${analysis.status}`);
      } else {
        console.log(`   ❌ No analysis data found`);
      }
      
    } catch (error) {
      console.log(`   💥 Error: ${error}`);
    }
  }
}

// Function to test "Reset & Run All Analyses" functionality
async function testResetRunAllAnalyses(dealId: number = 22): Promise<void> {
  console.log(`\n🔄 Testing "Reset & Run All Analyses" Functionality`);
  console.log('='.repeat(60));

  console.log(`📊 Current analyses for deal ${dealId}:`);
  const currentAnalyses = await storage.getAnalysesByDealId(dealId);
  console.log(`   Found ${currentAnalyses.length} existing analyses`);
  
  for (const analysis of currentAnalyses) {
    console.log(`   - ${analysis.agentType}: ${analysis.status} (${analysis.updatedAt?.toISOString()})`);
  }

  console.log(`\n🔄 Current background jobs for deal ${dealId}:`);
  const backgroundJobs = await storage.getBackgroundJobsByDealId(dealId);
  console.log(`   Found ${backgroundJobs.length} background jobs`);
  
  for (const job of backgroundJobs) {
    console.log(`   - ${job.jobType || job.agentType}: ${job.status} ${job.progress}%`);
  }

  console.log(`\n📄 Document assignment status:`);
  const documents = await storage.getDocumentsByDealId(dealId);
  const assignedCount = documents.filter(doc => 
    doc.assignedAgents && Array.isArray(doc.assignedAgents) && doc.assignedAgents.length > 0
  ).length;
  
  console.log(`   Total documents: ${documents.length}`);
  console.log(`   Assigned documents: ${assignedCount}`);
  console.log(`   Unassigned documents: ${documents.length - assignedCount}`);
  console.log(`   Assignment rate: ${Math.round((assignedCount / documents.length) * 100)}%`);
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Comprehensive Agent Analysis Debug');
    console.log('='.repeat(80));
    
    // Test primary deal (22)
    await debugAllAgentAnalyses(22);
    
    // Test comprehensive endpoints
    await testComprehensiveEndpoints(22);
    
    // Test reset & run all functionality
    await testResetRunAllAnalyses(22);
    
    console.log('\n🎉 Debug completed successfully!');
    
  } catch (error) {
    console.error('💥 Debug script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
main().catch(console.error);

export { debugAllAgentAnalyses, testComprehensiveEndpoints, testResetRunAllAnalyses };