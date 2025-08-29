/**
 * Test Research Storage - Minimal completion test
 */

import { comprehensiveResearchAnalysisService } from './comprehensiveResearchAnalysisComplete';

export async function testResearchStorage(dealId: number) {
  console.log('🧪 Testing Research storage with minimal data...');
  
  // Create minimal test data
  const testResults = {
    'test_question_1': {
      question: 'Test research methodology question?',
      category: 'Technical Methodology',
      answer: 'Test research analysis completed successfully.',
      confidence: 75,
      evidenceCount: 1,
      keyFindings: [{ document: 'Test Document', finding: 'Test finding', confidence: 80 }],
      supportingEvidence: []
    }
  };

  const testFindings = [
    {
      type: 'technical_approach',
      description: 'Test technical finding',
      confidence: 75,
      evidence: ['Test evidence'],
      impact: 'moderate'
    }
  ];

  const testRecommendations = [
    {
      title: 'Test Research Recommendation',
      description: 'Test recommendation for research analysis',
      priority: 'medium',
      category: 'research',
      impact: 'moderate'
    }
  ];

  const testDocuments = [{ name: 'Test Document.pdf' }];

  // Call the private method through a test wrapper
  await (comprehensiveResearchAnalysisService as any).storeComprehensiveResults(
    dealId,
    testResults,
    testFindings,
    testRecommendations,
    testDocuments
  );

  console.log('✅ Test Research storage completed!');
}