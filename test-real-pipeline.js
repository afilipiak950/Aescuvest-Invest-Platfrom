/**
 * Simple Test Script for Real Analysis Pipeline
 */

const runAnalysisTest = async () => {
  try {
    console.log('🧪 Testing Real OpenAI Analysis Pipeline...');
    
    // Step 1: Start real analysis
    console.log('📤 Starting analysis for Deal 30...');
    const analysisResponse = await fetch('http://localhost:5000/api/deals/30/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!analysisResponse.ok) {
      console.log('❌ Analysis request failed:', analysisResponse.status);
      return;
    }
    
    const analysisResult = await analysisResponse.text();
    console.log('✅ Analysis response:', analysisResult);
    
    // Step 2: Wait for processing
    console.log('⏳ Waiting 15 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Step 3: Check results
    console.log('📊 Checking analysis results...');
    const resultsResponse = await fetch('http://localhost:5000/api/analyses/30');
    const analyses = await resultsResponse.json();
    
    console.log(`✅ Found ${analyses.length} analyses:`);
    analyses.forEach(analysis => {
      console.log(`  - ${analysis.agentType}: ${analysis.status}, Progress: ${analysis.progress}%`);
      
      // Check for findings
      if (analysis.findings && analysis.findings.length > 0) {
        console.log(`    Findings: ${analysis.findings.length}`);
        console.log(`    Sample: ${analysis.findings[0]?.content?.substring(0, 100)}...`);
      }
      
      // Check for agent-specific answers
      if (analysis.agentType === 'Legal' && analysis.legalAnswers) {
        const answerCount = Object.keys(analysis.legalAnswers).length;
        console.log(`    Legal Answers: ${answerCount}`);
      }
    });
    
    // Step 4: Get acceptance report
    console.log('📋 Generating acceptance report...');
    const reportResponse = await fetch('http://localhost:5000/api/deals/30/acceptance-report');
    const reportResult = await reportResponse.json();
    
    if (reportResult.success) {
      console.log('📊 ACCEPTANCE REPORT:\n' + reportResult.report);
    } else {
      console.log('❌ Report generation failed:', reportResult.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

runAnalysisTest();