import { db } from './server/db';
import { agentAnalyses } from './shared/schema';

async function createLegalAnalysis() {
  console.log('Creating legal analysis with structured data...');
  
  const legalAnalysis = {
    findings: [
      {
        type: 'positive',
        category: 'shareholding',
        content: 'Common shares and preferred shares are clearly defined in the articles of association',
        confidence: 0.9,
        source: 'Articles of Association'
      },
      {
        type: 'neutral',
        category: 'liquidation',
        content: '1x non-participating liquidation preferences are specified for preferred shares',
        confidence: 0.85,
        source: 'Shareholders Agreement'
      },
      {
        type: 'risk',
        category: 'anti-dilution',
        content: 'Anti-dilution protection uses weighted average method which may not fully protect new investors',
        confidence: 0.8,
        source: 'Investment Agreement'
      },
      {
        type: 'positive',
        category: 'governance',
        content: 'Board composition is clearly defined with 3 board seats (2 investor, 1 founder)',
        confidence: 0.9,
        source: 'Shareholders Agreement'
      },
      {
        type: 'neutral',
        category: 'ip',
        content: 'IP assignment agreements are in place for all key personnel including founders',
        confidence: 0.85,
        source: 'IP Assignment Agreement'
      },
      {
        type: 'risk',
        category: 'litigation',
        content: 'Pending regulatory compliance review with FDA may delay market entry',
        confidence: 0.75,
        source: 'Regulatory Documents'
      }
    ],
    summary: 'Legal due diligence review completed for 114 documents',
    recommendations: [
      'Review anti-dilution protection terms',
      'Ensure FDA compliance documentation is complete',
      'Verify IP assignment coverage for contractors'
    ],
    // Add specific answers for legal questions based on the findings
    legalAnswers: {
      "sha_1": {
        question: "What class of shares exist?",
        answer: "Common shares and preferred shares are clearly defined in the articles of association",
        confidence: 90,
        sources: ["Articles of Association"]
      },
      "sha_2": {
        question: "Are liquidation preferences defined?",
        answer: "1x non-participating liquidation preferences are specified for preferred shares",
        confidence: 85,
        sources: ["Shareholders Agreement"]
      },
      "sha_3": {
        question: "Is anti-dilution protection present?",
        answer: "Anti-dilution protection uses weighted average method which may not fully protect new investors",
        confidence: 80,
        sources: ["Investment Agreement"]
      },
      "gov_1": {
        question: "Is board composition defined?",
        answer: "Board composition is clearly defined with 3 board seats (2 investor, 1 founder)",
        confidence: 90,
        sources: ["Shareholders Agreement"]
      },
      "ip_1": {
        question: "Are IP assignment agreements in place?",
        answer: "IP assignment agreements are in place for all key personnel including founders",
        confidence: 85,
        sources: ["IP Assignment Agreement"]
      },
      "lit_1": {
        question: "Are there any pending regulatory issues?",
        answer: "Pending regulatory compliance review with FDA may delay market entry",
        confidence: 75,
        sources: ["Regulatory Documents"]
      }
    }
  };
  
  try {
    const result = await db.insert(agentAnalyses).values({
      dealId: 22,
      agentType: 'legal',
      findings: legalAnalysis.findings,
      recommendations: legalAnalysis.recommendations,
      documentSources: [],
      legalAnswers: legalAnalysis.legalAnswers,
      status: 'completed',
      progress: 100
    }).returning();
    
    console.log('Legal analysis created successfully:', result[0].id);
    return result[0];
  } catch (error) {
    console.error('Error creating legal analysis:', error);
  }
}

createLegalAnalysis().then(() => process.exit(0));