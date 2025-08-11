/**
 * Comprehensive Legal Analysis System
 * Complete rebuild to analyze all 114 legal documents and provide accurate answers
 */

import { db } from './server/db';
import { documents, agentAnalyses } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced legal questions with specific search criteria
const COMPREHENSIVE_LEGAL_QUESTIONS = [
  {
    id: 'sha_1',
    category: 'Shareholders Agreement',
    question: 'What class of shares exist?',
    searchTerms: ['shares', 'equity', 'common', 'preferred', 'class', 'stock', 'securities'],
    context: 'Look for share classes, equity structures, common vs preferred shares, and voting rights'
  },
  {
    id: 'sha_2', 
    category: 'Shareholders Agreement',
    question: 'Are liquidation preferences defined?',
    searchTerms: ['liquidation', 'preference', 'priority', 'distribution', 'winding up', 'dissolution'],
    context: 'Search for liquidation waterfall, preference rights, and distribution priorities'
  },
  {
    id: 'sha_3',
    category: 'Shareholders Agreement', 
    question: 'Is anti-dilution protection present?',
    searchTerms: ['anti-dilution', 'dilution', 'protection', 'adjustment', 'weighted average', 'ratchet'],
    context: 'Look for anti-dilution mechanisms, price adjustments, and investor protections'
  },
  {
    id: 'gov_1',
    category: 'Governance',
    question: 'Are there special voting rights or veto rights?',
    searchTerms: ['voting', 'veto', 'consent', 'approval', 'board', 'resolution', 'quorum'],
    context: 'Search for special voting requirements, veto rights, and governance controls'
  },
  {
    id: 'gov_2',
    category: 'Governance',
    question: 'What is the board composition?',
    searchTerms: ['board', 'director', 'composition', 'appointment', 'seats', 'nominees'],
    context: 'Look for board structure, director appointments, and governance arrangements'
  },
  {
    id: 'ip_1',
    category: 'Intellectual Property',
    question: 'Are IP assignment agreements in place?',
    searchTerms: ['intellectual property', 'IP', 'assignment', 'invention', 'patent', 'copyright', 'trademark'],
    context: 'Search for IP assignment agreements, invention disclosures, and IP ownership'
  },
  {
    id: 'ip_2',
    category: 'Intellectual Property',
    question: 'Are there any IP disputes or litigation?',
    searchTerms: ['dispute', 'litigation', 'infringement', 'claim', 'lawsuit', 'IP', 'patent'],
    context: 'Look for IP disputes, patent litigation, and infringement claims'
  },
  {
    id: 'emp_1',
    category: 'Employment',
    question: 'Are key personnel agreements in place?',
    searchTerms: ['employment', 'personnel', 'key man', 'executive', 'founder', 'agreement'],
    context: 'Search for employment agreements, key personnel contracts, and founder arrangements'
  },
  {
    id: 'emp_2',
    category: 'Employment',
    question: 'Are there non-compete and confidentiality agreements?',
    searchTerms: ['non-compete', 'confidentiality', 'NDA', 'restraint', 'covenant', 'secrecy'],
    context: 'Look for non-compete clauses, confidentiality agreements, and restrictive covenants'
  },
  {
    id: 'com_1',
    category: 'Commercial',
    question: 'What are the key commercial agreements?',
    searchTerms: ['commercial', 'contract', 'agreement', 'customer', 'supplier', 'partnership'],
    context: 'Search for commercial contracts, customer agreements, and business partnerships'
  },
  {
    id: 'com_2',
    category: 'Commercial',
    question: 'Are there any termination or exclusivity clauses?',
    searchTerms: ['termination', 'exclusivity', 'exclusive', 'breach', 'default', 'penalty'],
    context: 'Look for termination rights, exclusivity arrangements, and breach provisions'
  },
  {
    id: 'reg_1',
    category: 'Regulatory',
    question: 'What regulatory approvals are required?',
    searchTerms: ['regulatory', 'approval', 'license', 'permit', 'compliance', 'authority'],
    context: 'Search for regulatory requirements, licenses, permits, and compliance obligations'
  },
  {
    id: 'reg_2',
    category: 'Regulatory',
    question: 'Are there any regulatory risks or violations?',
    searchTerms: ['violation', 'breach', 'non-compliance', 'penalty', 'fine', 'regulatory'],
    context: 'Look for regulatory violations, compliance breaches, and potential penalties'
  },
  {
    id: 'fin_1',
    category: 'Financial',
    question: 'What are the financial audit findings?',
    searchTerms: ['audit', 'financial', 'accounting', 'revenue', 'expense', 'finding'],
    context: 'Search for audit reports, financial findings, and accounting issues'
  },
  {
    id: 'fin_2',
    category: 'Financial',
    question: 'Are there any financial guarantees or warranties?',
    searchTerms: ['guarantee', 'warranty', 'representation', 'indemnity', 'financial', 'liability'],
    context: 'Look for financial guarantees, warranties, and indemnification provisions'
  }
];

async function comprehensiveLegalAnalysis(): Promise<void> {
  console.log('🚀 Starting comprehensive legal analysis system...');
  
  // Get all legal documents for deal 22
  const legalDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.dealId, 22));
  
  console.log(`📄 Found ${legalDocuments.length} legal documents to analyze`);
  
  if (legalDocuments.length === 0) {
    console.log('❌ No legal documents found');
    return;
  }
  
  // Analyze each question separately
  const questionAnswers: Record<string, any> = {};
  
  for (const question of COMPREHENSIVE_LEGAL_QUESTIONS) {
    console.log(`🔍 Analyzing question: ${question.question}`);
    
    // Find relevant documents for this question
    const relevantDocuments = await findRelevantDocuments(legalDocuments, question);
    console.log(`📋 Found ${relevantDocuments.length} relevant documents for question ${question.id}`);
    
    // Analyze the question with relevant documents
    const answer = await analyzeQuestionWithDocuments(question, relevantDocuments);
    questionAnswers[question.id] = answer;
    
    console.log(`✅ Completed analysis for question ${question.id}`);
  }
  
  // Store the comprehensive analysis
  await storeLegalAnalysis(questionAnswers, legalDocuments);
  
  console.log('🎉 Comprehensive legal analysis completed!');
}

async function findRelevantDocuments(documents: any[], question: any): Promise<any[]> {
  const relevantDocs = [];
  
  for (const doc of documents) {
    if (!doc.ocrText && !doc.aiSummary) continue;
    
    const content = `${doc.ocrText || ''} ${doc.aiSummary?.executiveSummary || ''}`.toLowerCase();
    
    // Check if document contains relevant search terms
    const relevanceScore = question.searchTerms.reduce((score: number, term: string) => {
      const termCount = (content.match(new RegExp(term.toLowerCase(), 'g')) || []).length;
      return score + termCount;
    }, 0);
    
    if (relevanceScore > 0) {
      relevantDocs.push({
        ...doc,
        relevanceScore,
        content: content.substring(0, 4000) // Limit content length
      });
    }
  }
  
  // Sort by relevance score and return top 10
  return relevantDocs
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
}

async function analyzeQuestionWithDocuments(question: any, documents: any[]): Promise<any> {
  if (documents.length === 0) {
    return {
      question: question.question,
      answer: `No relevant documents found for this question. This information may not be available in the current document set or may require additional legal documents.`,
      confidence: 20,
      sources: [],
      relevantDocuments: 0
    };
  }
  
  // Create comprehensive prompt for analysis
  const documentContext = documents.map(doc => ({
    name: doc.name,
    content: doc.content,
    summary: doc.aiSummary?.executiveSummary || 'No summary available'
  }));
  
  const prompt = `You are a legal expert analyzing documents for due diligence. 

QUESTION: ${question.question}

CONTEXT: ${question.context}

SEARCH TERMS: ${question.searchTerms.join(', ')}

DOCUMENTS TO ANALYZE:
${documentContext.map((doc, idx) => `
Document ${idx + 1}: ${doc.name}
Summary: ${doc.summary}
Content: ${doc.content.substring(0, 2000)}...
`).join('\n')}

Please provide a comprehensive legal analysis that includes:
1. A detailed answer to the question based on the documents
2. Specific references to document names where information was found
3. Any gaps or limitations in the available information
4. Your confidence level (0-100) based on the quality and completeness of the information

Respond in JSON format:
{
  "answer": "Detailed answer based on document analysis",
  "confidence": 85,
  "sources": ["Document1.pdf", "Document2.pdf"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Gap 1", "Gap 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1
    });
    
    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      question: question.question,
      answer: analysis.answer || 'Unable to analyze question',
      confidence: analysis.confidence || 50,
      sources: analysis.sources || [],
      keyFindings: analysis.keyFindings || [],
      gaps: analysis.gaps || [],
      recommendations: analysis.recommendations || [],
      relevantDocuments: documents.length
    };
    
  } catch (error) {
    console.error('Error analyzing question:', error);
    return {
      question: question.question,
      answer: `Error analyzing this question: ${error.message}. Please try again.`,
      confidence: 10,
      sources: [],
      relevantDocuments: documents.length
    };
  }
}

async function storeLegalAnalysis(questionAnswers: Record<string, any>, documents: any[]): Promise<void> {
  const findings = generateFindingsFromAnswers(questionAnswers);
  const recommendations = generateRecommendationsFromAnswers(questionAnswers);
  const documentSources = documents.map(doc => doc.name);
  
  // Delete existing legal analysis if it exists
  await db
    .delete(agentAnalyses)
    .where(and(
      eq(agentAnalyses.dealId, 22),
      eq(agentAnalyses.agentType, 'legal')
    ));
  
  // Insert new legal analysis
  await db
    .insert(agentAnalyses)
    .values({
      dealId: 22,
      agentType: 'legal',
      status: 'completed',
      progress: 100,
      findings: findings,
      recommendations: recommendations,
      documentSources: documentSources,
      legalAnswers: questionAnswers
    });
  
  console.log('💾 Legal analysis stored successfully');
}

function generateFindingsFromAnswers(answers: Record<string, any>): any[] {
  const findings = [];
  
  for (const [questionId, answer] of Object.entries(answers)) {
    const question = COMPREHENSIVE_LEGAL_QUESTIONS.find(q => q.id === questionId);
    if (!question) continue;
    
    findings.push({
      type: answer.confidence > 70 ? 'positive' : answer.confidence > 40 ? 'neutral' : 'risk',
      category: question.category.toLowerCase(),
      content: answer.answer.substring(0, 200) + '...',
      confidence: answer.confidence / 100,
      source: answer.sources.length > 0 ? answer.sources[0] : 'Legal Documents',
      questionId: questionId
    });
  }
  
  return findings;
}

function generateRecommendationsFromAnswers(answers: Record<string, any>): any[] {
  const recommendations = [];
  
  for (const [questionId, answer] of Object.entries(answers)) {
    if (answer.recommendations && answer.recommendations.length > 0) {
      for (const rec of answer.recommendations) {
        recommendations.push({
          title: `${answer.question} - Action Required`,
          description: rec,
          priority: answer.confidence < 60 ? 'high' : 'medium',
          category: 'legal',
          impact: answer.confidence < 60 ? 'critical' : 'moderate'
        });
      }
    }
    
    if (answer.confidence < 60) {
      recommendations.push({
        title: `Investigation Required`,
        description: `Further investigation needed for: ${answer.question}`,
        priority: 'high',
        category: 'legal',
        impact: 'critical'
      });
    }
  }
  
  return recommendations;
}

// Run the comprehensive analysis
comprehensiveLegalAnalysis().catch(console.error);