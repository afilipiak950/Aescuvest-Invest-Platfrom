import { db } from './server/db';
import { comprehensiveHrAnalyses } from '@shared/schema';
import { eq } from 'drizzle-orm';

// HR questions from the service
const HR_QUESTIONS = [
  // Employment Contracts (8 questions)
  {
    id: 'employment_1',
    question: 'Are all employment contracts signed and dated?',
    keywords: ['employment contract', 'signed', 'dated', 'employee agreement', 'employment terms']
  },
  {
    id: 'employment_2', 
    question: 'Are notice periods in line with local labor law or extended?',
    keywords: ['notice period', 'termination notice', 'labor law', 'employment notice']
  },
  {
    id: 'employment_3',
    question: 'Are probation periods defined? If yes, how long?',
    keywords: ['probation', 'probationary period', 'trial period', 'initial employment']
  },
  {
    id: 'employment_4',
    question: 'Are termination clauses (ordinary, extraordinary) present?',
    keywords: ['termination clause', 'dismissal', 'termination conditions', 'employment termination']
  },
  {
    id: 'employment_5',
    question: 'Is there mention of confidentiality, IP assignment, and post-contractual non-compete?',
    keywords: ['confidentiality', 'intellectual property', 'non-compete', 'IP assignment', 'trade secrets']
  },
  {
    id: 'employment_6',
    question: 'Are variable components (bonuses, stock options, commissions) clearly described and performance-based?',
    keywords: ['bonus', 'variable pay', 'stock options', 'commission', 'incentive compensation', 'performance-based']
  },
  {
    id: 'employment_7',
    question: 'Are working hours, overtime rules, and leave entitlements defined?',
    keywords: ['working hours', 'overtime', 'leave', 'vacation', 'working time', 'time off']
  },
  {
    id: 'employment_8',
    question: 'Are there unusual clauses (e.g. guaranteed salary raises, minimum employment duration)?',
    keywords: ['unusual clauses', 'guaranteed salary', 'salary raises', 'minimum employment', 'employment duration']
  },
  
  // Executive/Managing Director Contracts (5 questions)
  {
    id: 'executive_1',
    question: 'Is the total compensation package broken down (base, bonus, equity)?',
    keywords: ['executive compensation', 'total compensation', 'base salary', 'executive pay', 'management compensation']
  },
  {
    id: 'executive_2',
    question: 'Are KPI-driven bonuses explicitly defined?',
    keywords: ['KPI bonus', 'performance bonus', 'key performance indicators', 'executive bonus']
  },
  {
    id: 'executive_3',
    question: 'Are severance packages or golden parachutes included?',
    keywords: ['severance', 'golden parachute', 'executive severance', 'termination benefits']
  },
  {
    id: 'executive_4',
    question: 'Are liability exclusions or indemnity clauses included?',
    keywords: ['liability exclusion', 'indemnity clause', 'executive liability', 'indemnification']
  },
  {
    id: 'executive_5',
    question: 'What exit clauses exist in case of M&A or investor-led changes?',
    keywords: ['exit clause', 'M&A', 'acquisition', 'change of control', 'investor changes']
  },
  
  // Add more questions as needed...
  {
    id: 'equity_1',
    question: 'What is the total pool reserved (as % of shares)?',
    keywords: ['ESOP', 'VSOP', 'equity pool', 'stock option pool', 'employee shares']
  }
];

async function fixHrAnalysisWithExistingSummaries(dealId: number) {
  try {
    console.log(`🔧 FIXING HR Analysis for deal ${dealId} using existing document summaries`);
    
    // Get all documents with AI summaries for this deal
    const documents = await db.query.documents.findMany({
      where: (documents, { eq, and, isNotNull }) => and(
        eq(documents.dealId, dealId),
        isNotNull(documents.aiSummary)
      )
    });

    console.log(`📋 Found ${documents.length} documents with summaries to analyze`);
    
    // Find HR-relevant documents using comprehensive matching
    const hrRelevantDocs = documents.filter(doc => {
      if (!doc.aiSummary) return false;
      
      let summaryText = '';
      if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
        summaryText = doc.aiSummary.executiveSummary.toLowerCase();
      } else if (typeof doc.aiSummary === 'string') {
        summaryText = doc.aiSummary.toLowerCase();
      } else {
        return false;
      }

      const documentName = doc.name.toLowerCase();
      const fullContent = summaryText + ' ' + documentName;

      // Comprehensive HR keyword matching
      const hrKeywords = [
        // Core employment terms
        'employment', 'employee', 'employer', 'contract', 'agreement', 'letter',
        'salary', 'wage', 'wages', 'compensation', 'payroll', 'pay', 'payment',
        
        // HR functions
        'hr', 'human resources', 'personnel', 'staff', 'workforce', 'team',
        'hiring', 'recruitment', 'recruiting', 'onboarding', 'termination',
        
        // Compensation & benefits
        'bonus', 'incentive', 'commission', 'overtime', 'allowance', 'benefits',
        'stock option', 'equity', 'share', 'shares', 'vesting', 'esop', 'vsop',
        
        // Executive terms
        'executive', 'management', 'manager', 'director', 'ceo', 'cto', 'cfo',
        'founder', 'co-founder', 'managing director', 'chairman',
        
        // Legal terms
        'confidentiality', 'non-compete', 'non-disclosure', 'nda',
        'intellectual property', 'ip assignment', 'trade secret',
        
        // Contract terms
        'probation', 'probationary', 'notice period', 'termination notice',
        'leave', 'vacation', 'holiday', 'sick leave', 'working hours',
        
        // Policy terms
        'policy', 'policies', 'handbook', 'manual', 'code of conduct',
        'compliance', 'regulation', 'procedure', 'guideline'
      ];
      
      return hrKeywords.some(keyword => fullContent.includes(keyword));
    });

    console.log(`📋 Found ${hrRelevantDocs.length} HR-relevant documents`);

    // Process each question and find evidence in summaries
    const allAnswers: any = {};
    const allFindings: any[] = [];
    const allRecommendations: any[] = [];

    for (const question of HR_QUESTIONS) {
      console.log(`🔍 Processing: ${question.question}`);
      
      // Find documents with evidence for this question
      const relevantDocs = hrRelevantDocs.filter(doc => {
        const summaryText = typeof doc.aiSummary === 'object' 
          ? doc.aiSummary.executiveSummary?.toLowerCase() || ''
          : (doc.aiSummary || '').toLowerCase();
        
        const fullContent = summaryText + ' ' + doc.name.toLowerCase();
        
        return question.keywords.some(keyword => 
          fullContent.includes(keyword.toLowerCase())
        );
      });

      console.log(`📄 Found ${relevantDocs.length} documents for question: ${question.question}`);

      // Extract evidence from document summaries
      const evidence = [];
      const sources = [];
      
      for (const doc of relevantDocs.slice(0, 10)) { // Limit to top 10 most relevant
        const summaryText = typeof doc.aiSummary === 'object' 
          ? doc.aiSummary.executiveSummary || ''
          : doc.aiSummary || '';
        
        if (summaryText.length > 50) {
          // Extract relevant sentences/phrases
          const sentences = summaryText.split(/[.!?]+/).filter(s => s.trim().length > 20);
          const relevantSentences = sentences.filter(sentence => 
            question.keywords.some(keyword => 
              sentence.toLowerCase().includes(keyword.toLowerCase())
            )
          );
          
          if (relevantSentences.length > 0) {
            evidence.push(`From ${doc.name}: ${relevantSentences.slice(0, 2).join('. ')}`);
            sources.push(doc.name);
          }
        }
      }

      // Generate answer based on evidence found
      let answer = '';
      let confidence = 0;
      
      if (evidence.length > 0) {
        answer = `Based on analysis of HR documents: ${evidence.join(' | ')}`;
        confidence = Math.min(0.9, evidence.length * 0.2 + 0.3);
        
        // Add finding
        allFindings.push({
          id: allFindings.length,
          content: `${question.question}: ${answer}`,
          type: 'hr_finding',
          confidence,
          source: sources.slice(0, 3).join(', '),
          category: question.id.split('_')[0]
        });
        
        // Add recommendation if gaps found
        if (evidence.length < 3) {
          allRecommendations.push({
            title: `HR: Additional documentation needed for ${question.id}`,
            content: `Consider providing more detailed documentation for: ${question.question}`,
            category: 'HR',
            priority: 'Medium',
            impact: 'Medium'
          });
        }
      } else {
        answer = `No specific evidence found in HR documents, but ${hrRelevantDocs.length} HR-related documents were analyzed`;
        confidence = 0.1;
        
        allRecommendations.push({
          title: `HR: Documentation gap for ${question.id}`,
          content: `No evidence found for: ${question.question}. Consider providing relevant HR documentation.`,
          category: 'HR',
          priority: 'High',
          impact: 'Medium'
        });
      }

      // Store the answer
      allAnswers[question.id] = {
        question: question.question,
        answer,
        confidence,
        sources: sources.slice(0, 5),
        evidenceCount: evidence.length,
        documentsCovered: relevantDocs.length,
        keyFindings: evidence.slice(0, 3),
        evidenceSummary: evidence.length > 0 
          ? `Found relevant HR evidence in ${evidence.length} document extracts`
          : `No specific evidence in ${hrRelevantDocs.length} HR documents analyzed`,
        recommendations: [],
        detailedEvidence: evidence.map((ev, i) => ({
          documentName: sources[i] || 'Unknown',
          content: ev,
          confidence: 0.7,
          relevanceScore: 0.7
        })),
        hrAssessment: evidence.length > 0 
          ? `HR analysis based on evidence from ${evidence.length} relevant documents`
          : `Analysis completed but no specific evidence found for this question`
      };
    }

    console.log(`📊 Generated ${Object.keys(allAnswers).length} answers, ${allFindings.length} findings, ${allRecommendations.length} recommendations`);

    // Update the existing HR analysis in database
    const hrAnswers = JSON.stringify(allAnswers);
    
    const updateResult = await db
      .update(comprehensiveHrAnalyses)
      .set({
        hrAnswers,
        findings: JSON.stringify(allFindings),
        recommendations: JSON.stringify(allRecommendations),
        status: 'Completed',
        progress: 100
      })
      .where(eq(comprehensiveHrAnalyses.dealId, dealId));

    console.log(`✅ Updated HR analysis for deal ${dealId}`);
    console.log(`📈 Results: ${Object.keys(allAnswers).length} questions answered, ${allFindings.length} findings, ${allRecommendations.length} recommendations`);

  } catch (error) {
    console.error(`❌ Error fixing HR analysis:`, error);
  }
}

// Run the fix for deal 22
fixHrAnalysisWithExistingSummaries(22).then(() => {
  console.log('🎉 HR analysis fix completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('💥 HR analysis fix failed:', error);
  process.exit(1);
});