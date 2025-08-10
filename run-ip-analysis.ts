#!/usr/bin/env tsx

// Use the granular reset endpoint to trigger fresh IP analysis
async function runIPAnalysis() {
  try {
    console.log('🚀 Triggering fresh IP analysis for deal 33...');
    
    const response = await fetch('http://localhost:5000/api/granular-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dealId: 33,
        resetType: 'agents',  
        agentTypes: ['IP']
      })
    });
    
    const result = await response.text();
    console.log('📊 Reset response:', result);
    
    // Now trigger the agents to run
    const runResponse = await fetch('http://localhost:5000/api/enterprise/deals/33/agents/run', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentTypes: ['IP'],
        force: true
      })
    });
    
    const runResult = await runResponse.text();
    console.log('🔄 Run response:', runResult);
    
    console.log('✅ IP analysis triggered successfully!');
    console.log('💡 Check the IP tab in the UI to see progress');
    
  } catch (error) {
    console.error('❌ Failed to trigger IP analysis:', error);
  }
}

runIPAnalysis();