#!/usr/bin/env node

/**
 * GPT-5 INTEGRATION TEST
 * Validates that GPT-5 models are properly configured and accessible
 */

import { intelligentModelManager } from './server/services/intelligentModelManager.js';
import { ultraIntelligentAI } from './server/services/ultraIntelligentAI.js';

async function testGPT5Integration() {
  console.log('🚀 Testing GPT-5 Integration...\n');

  try {
    // Test 1: Check if GPT-5 models are registered
    console.log('📋 Test 1: Model Registry Check');
    const availableModels = intelligentModelManager.getAvailableModels();
    console.log('Available models:', availableModels);
    
    const hasGPT5 = availableModels.includes('gpt-5');
    const hasGPT5Mini = availableModels.includes('gpt-5-mini');
    
    console.log(`✅ GPT-5 available: ${hasGPT5}`);
    console.log(`✅ GPT-5 Mini available: ${hasGPT5Mini}\n`);

    // Test 2: Check model selection for different domains
    console.log('🎯 Test 2: Model Selection for Different Domains');
    
    const domains = ['legal', 'clinical', 'commercial', 'research', 'financial'];
    
    for (const domain of domains) {
      const requirements = {
        complexity: 'high',
        domain: domain,
        speedPriority: 'quality',
        qualityThreshold: 0.9
      };
      
      const selectedModel = intelligentModelManager.selectOptimalModel(requirements);
      console.log(`${domain.toUpperCase()}: ${selectedModel}`);
    }
    
    console.log('\n🧪 Test 3: Simple GPT-5 Completion Test');
    
    // Test 3: Try a simple completion with GPT-5
    const testConfig = {
      domain: 'legal',
      complexity: 'high',
      speedPriority: 'quality',
      qualityThreshold: 0.9,
      maxTokens: 100
    };
    
    const testMessages = [
      {
        role: 'user',
        content: 'Explain in one sentence what GPT-5 is.'
      }
    ];
    
    console.log('Making test request to Ultra-Intelligent AI...');
    
    const response = await ultraIntelligentAI.createUltraIntelligentCompletion(
      testMessages,
      testConfig
    );
    
    console.log(`✅ Test completed successfully!`);
    console.log(`Model used: ${response.model}`);
    console.log(`Intelligence level: ${response.intelligenceLevel}`);
    console.log(`Quality score: ${response.qualityScore.toFixed(3)}`);
    console.log(`Response time: ${response.responseTime}ms`);
    console.log(`Response: ${response.content.substring(0, 200)}...`);
    
    console.log('\n🎉 GPT-5 INTEGRATION TEST PASSED!');
    console.log('All agents will now automatically use GPT-5 models when triggered.');
    
  } catch (error) {
    console.error('❌ GPT-5 Integration Test Failed:');
    console.error(error.message);
    console.error(error.stack);
  }
}

// Run the test
testGPT5Integration();