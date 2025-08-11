/**
 * DIAGNOSE FIELD MAPPING ISSUE
 * 
 * Find out why the legal analysis isn't being saved properly to the database
 */

import { storage } from './server/storage';
import { execute_sql_tool } from '@replit/agent-toolbox';

async function diagnoseFieldMappingIssue() {
  console.log('🔍 DIAGNOSING FIELD MAPPING ISSUE');
  console.log('================================');
  
  const dealId = 33;
  
  try {
    // 1. Check the current database record
    console.log('\n1. CURRENT DATABASE RECORD:');
    const analysis = await storage.getAnalysisByDealAndAgent(dealId, 'Legal');
    
    if (analysis) {
      console.log(`✅ Found analysis record (ID: ${analysis.id})`);
      console.log(`Status: ${analysis.status}`);
      console.log(`Agent Type: ${analysis.agentType}`);
      
      // Check all possible answer fields
      const possibleFields = [
        'legal_answers', 'legalAnswers', 'answers', 'findings', 
        'recommendations', 'documentSources', 'clinicalAnswers',
        'commercialAnswers', 'ip_answers', 'hr_answers', 
        'financial_answers', 'research_answers'
      ];
      
      console.log('\n2. CHECKING ALL POSSIBLE ANSWER FIELDS:');
      possibleFields.forEach(field => {
        const value = analysis[field];
        if (value !== null && value !== undefined) {
          console.log(`✅ ${field}: ${typeof value}`);
          if (typeof value === 'object') {
            console.log(`   Keys: ${Object.keys(value).join(', ')}`);
            if (Object.keys(value).length > 0) {
              const firstKey = Object.keys(value)[0];
              const firstValue = value[firstKey];
              console.log(`   Sample (${firstKey}): ${JSON.stringify(firstValue).substring(0, 100)}...`);
            }
          } else {
            console.log(`   Value: ${String(value).substring(0, 100)}...`);
          }
        } else {
          console.log(`❌ ${field}: null/undefined`);
        }
      });
      
    } else {
      console.log('❌ No legal analysis found');
      return;
    }
    
    // 2. Check the database schema
    console.log('\n3. CHECKING DATABASE SCHEMA:');
    
    // Use direct SQL to inspect the table structure
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'agent_analyses' 
      ORDER BY ordinal_position;
    `;
    
    console.log('Running schema query...');
    // This would show the actual table structure
    
    // 3. Check recent job processing logs
    console.log('\n4. CHECKING RECENT PROCESSING STATUS:');
    
    // Get the most recent analysis update
    const recentAnalyses = await storage.db
      .select()
      .from(storage.schema.agentAnalyses)
      .where(storage.schema.agentAnalyses.dealId.eq(dealId))
      .orderBy(storage.schema.agentAnalyses.updatedAt.desc())
      .limit(5);
    
    console.log(`Found ${recentAnalyses.length} recent analyses:`);
    recentAnalyses.forEach((analysis, i) => {
      console.log(`${i + 1}. ID: ${analysis.id}, Agent: ${analysis.agentType}, Updated: ${analysis.updatedAt}`);
    });
    
    // 4. Test field access through storage interface
    console.log('\n5. TESTING STORAGE INTERFACE:');
    
    const testAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'Legal');
    if (testAnalysis) {
      console.log('Testing field access patterns:');
      
      // Test different access patterns
      console.log(`Direct legal_answers: ${!!testAnalysis.legal_answers}`);
      console.log(`Direct legalAnswers: ${!!testAnalysis.legalAnswers}`);
      console.log(`Direct answers: ${!!testAnalysis.answers}`);
      
      // Test if the data exists but in a different structure
      const rawData = JSON.stringify(testAnalysis, null, 2);
      const answerKeywordCount = (rawData.match(/answer/gi) || []).length;
      const questionKeywordCount = (rawData.match(/question/gi) || []).length;
      
      console.log(`Raw data contains ${answerKeywordCount} instances of "answer"`);
      console.log(`Raw data contains ${questionKeywordCount} instances of "question"`);
      
      // Check if answers might be nested differently
      if (testAnalysis.legal_answers && typeof testAnalysis.legal_answers === 'object') {
        const legalKeys = Object.keys(testAnalysis.legal_answers);
        console.log(`Legal answers keys: ${legalKeys.join(', ')}`);
        
        if (legalKeys.length > 0) {
          console.log('🎉 FOUND ANSWERS IN legal_answers FIELD!');
          const firstAnswer = testAnalysis.legal_answers[legalKeys[0]];
          console.log(`First answer structure:`, typeof firstAnswer);
          if (typeof firstAnswer === 'object') {
            console.log(`Answer keys: ${Object.keys(firstAnswer).join(', ')}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run diagnosis
diagnoseFieldMappingIssue()
  .then(() => console.log('\n✅ Diagnosis complete'))
  .catch(error => console.error('❌ Diagnosis error:', error));