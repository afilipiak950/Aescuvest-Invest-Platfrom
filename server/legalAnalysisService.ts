/**
 * Enhanced Legal Analysis Service
 * Provides comprehensive legal analysis for all assigned legal documents
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced legal questions with detailed analysis criteria
export const LEGAL_QUESTIONS = [
  {
    id: 'sha_1',
    category: 'Shareholders Agreement',
    question: 'What class of shares exist?',
    searchTerms: ['shares', 'equity', 'common', 'preferred', 'class', 'stock', 'securities', 'voting'],
    priority: 'high'
  },
  {
    id: 'sha_2', 
    category: 'Shareholders Agreement',
    question: 'Are liquidation preferences defined?',
    searchTerms: ['liquidation', 'preference', 'priority', 'distribution', 'winding up', 'dissolution'],
    priority: 'high'
  },
  {
    id: 'sha_3',
    category: 'Shareholders Agreement', 
    question: 'Is anti-dilution protection present?',
    searchTerms: ['anti-dilution', 'dilution', 'protection', 'adjustment', 'weighted average', 'ratchet'],
    priority: 'high'
  },
  {
    id: 'gov_1',
    category: 'Governance',
    question: 'Are there special voting rights or veto rights?',
    searchTerms: ['voting', 'veto', 'consent', 'approval', 'board', 'resolution', 'quorum'],
    priority: 'high'
  },
  {
    id: 'gov_2',
    category: 'Governance',
    question: 'What is the board composition?',
    searchTerms: ['board', 'director', 'composition', 'appointment', 'seats', 'nominees'],
    priority: 'medium'
  },
  {
    id: 'ip_1',
    category: 'Intellectual Property',
    question: 'Are IP assignment agreements in place?',
    searchTerms: ['intellectual property', 'IP', 'assignment', 'invention', 'patent', 'copyright'],
    priority: 'high'
  },
  {
    id: 'ip_2',
    category: 'Intellectual Property',
    question: 'Are there any IP disputes or litigation?',
    searchTerms: ['dispute', 'litigation', 'infringement', 'claim', 'lawsuit', 'IP', 'patent'],
    priority: 'high'
  },
  {
    id: 'emp_1',
    category: 'Employment',
    question: 'Are key personnel agreements in place?',
    searchTerms: ['employment', 'personnel', 'key man', 'executive', 'founder', 'agreement'],
    priority: 'medium'
  },
  {
    id: 'emp_2',
    category: 'Employment',
    question: 'Are there non-compete and confidentiality agreements?',
    searchTerms: ['non-compete', 'confidentiality', 'NDA', 'restraint', 'covenant'],
    priority: 'medium'
  },
  {
    id: 'com_1',
    category: 'Commercial',
    question: 'What are the key commercial agreements?',
    searchTerms: ['commercial', 'contract', 'agreement', 'customer', 'supplier', 'partnership'],
    priority: 'medium'
  },
  {
    id: 'com_2',
    category: 'Commercial',
    question: 'Are there any termination or exclusivity clauses?',
    searchTerms: ['termination', 'exclusivity', 'exclusive', 'breach', 'default', 'penalty'],
    priority: 'medium'
  },
  {
    id: 'reg_1',
    category: 'Regulatory',
    question: 'What regulatory approvals are required?',
    searchTerms: ['regulatory', 'approval', 'license', 'permit', 'compliance', 'authority'],
    priority: 'high'
  },
  {
    id: 'reg_2',
    category: 'Regulatory',
    question: 'Are there any regulatory risks or violations?',
    searchTerms: ['violation', 'breach', 'non-compliance', 'penalty', 'fine', 'regulatory'],
    priority: 'high'
  },
  {
    id: 'fin_1',
    category: 'Financial',
    question: 'What are the financial audit findings?',
    searchTerms: ['audit', 'financial', 'accounting', 'revenue', 'expense', 'finding'],
    priority: 'medium'
  },
  {
    id: 'fin_2',
    category: 'Financial',
    question: 'Are there any financial guarantees or warranties?',
    searchTerms: ['guarantee', 'warranty', 'representation', 'indemnity', 'financial'],
    priority: 'medium'
  }
];

export class LegalAnalysisService {
  
  /**
   * Run comprehensive legal analysis for a specific deal
   */
  async runComprehensiveAnalysis(dealId: number): Promise<any> {
    console.log(`🚀 Starting comprehensive legal analysis for deal ${dealId}`);
    
    // Get all documents for the deal
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Found ${allDocuments.length} total documents`);
    
    // Filter for legal documents (documents with legal content)
    const legalDocuments = this.filterLegalDocuments(allDocuments);
    console.log(`⚖️ Identified ${legalDocuments.length} legal documents`);
    
    if (legalDocuments.length === 0) {
      throw new Error('No legal documents found for analysis');
    }
    
    // Analyze each legal question
    const legalAnswers: Record<string, any> = {};
    
    for (const question of LEGAL_QUESTIONS) {
      console.log(`🔍 Analyzing: ${question.question}`);
      
      const relevantDocs = this.findRelevantDocuments(legalDocuments, question);
      console.log(`📋 Found ${relevantDocs.length} relevant documents`);
      
      const answer = await this.analyzeQuestion(question, relevantDocs);
      legalAnswers[question.id] = answer;
      
      // Brief delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Generate comprehensive findings and recommendations
    const findings = this.generateFindings(legalAnswers);
    const recommendations = this.generateRecommendations(legalAnswers);
    
    // Store the analysis results
    await this.storeAnalysisResults(dealId, legalAnswers, findings, recommendations, legalDocuments);
    
    console.log(`✅ Comprehensive legal analysis completed for deal ${dealId}`);
    
    return {
      success: true,
      documentsAnalyzed: legalDocuments.length,
      questionsAnswered: Object.keys(legalAnswers).length,
      findings: findings.length,
      recommendations: recommendations.length
    };
  }
  
  /**
   * Filter documents that contain legal content
   */
  private filterLegalDocuments(documents: any[]): any[] {
    const legalKeywords = [
      'agreement', 'contract', 'legal', 'law', 'terms', 'conditions', 'clause',
      'shareholders', 'investment', 'employment', 'intellectual property', 'IP',
      'confidentiality', 'non-disclosure', 'NDA', 'license', 'regulatory',
      'compliance', 'board', 'director', 'governance', 'audit', 'financial',
      'commercial', 'partnership', 'litigation', 'dispute', 'warranty'
    ];
    
    return documents.filter(doc => {
      if (!doc.ocrText && !doc.aiSummary) return false;
      
      const content = `${doc.ocrText || ''} ${doc.aiSummary?.executiveSummary || ''}`.toLowerCase();
      const filename = doc.name.toLowerCase();
      
      // Check if document contains legal keywords
      const hasLegalContent = legalKeywords.some(keyword => 
        content.includes(keyword) || filename.includes(keyword)
      );
      
      return hasLegalContent;
    });
  }
  
  /**
   * Find documents relevant to a specific legal question
   */
  private findRelevantDocuments(documents: any[], question: any): any[] {
    const relevantDocs = [];
    
    for (const doc of documents) {
      const content = `${doc.ocrText || ''} ${doc.aiSummary?.executiveSummary || ''}`.toLowerCase();
      const filename = doc.name.toLowerCase();
      
      // Calculate relevance score based on search terms
      let relevanceScore = 0;
      
      for (const term of question.searchTerms) {
        const termLower = term.toLowerCase();
        const contentMatches = (content.match(new RegExp(termLower, 'g')) || []).length;
        const filenameMatches = (filename.match(new RegExp(termLower, 'g')) || []).length;
        
        relevanceScore += contentMatches + (filenameMatches * 2); // Filename matches weighted higher
      }
      
      if (relevanceScore > 0) {
        relevantDocs.push({
          ...doc,
          relevanceScore,
          content: content.substring(0, 3000) // Limit content for API
        });
      }
    }
    
    // Sort by relevance and return top 8 documents
    return relevantDocs
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);
  }
  
  /**
   * Analyze a specific legal question using OpenAI
   */
  private async analyzeQuestion(question: any, documents: any[]): Promise<any> {
    if (documents.length === 0) {
      return {
        question: question.question,
        answer: `No relevant documents found for this question. This information may not be available in the current document set.`,
        confidence: 20,
        sources: [],
        keyFindings: [],
        relevantDocuments: 0
      };
    }
    
    const prompt = `You are a senior legal analyst conducting due diligence. 

QUESTION: ${question.question}
CATEGORY: ${question.category}

DOCUMENTS TO ANALYZE:
${documents.map((doc, idx) => `
Document ${idx + 1}: ${doc.name}
Content: ${doc.content}
`).join('\n')}

Please provide a comprehensive legal analysis:
1. Answer the question based on the documents
2. Identify specific documents that contain relevant information
3. Highlight key legal findings
4. Assess your confidence level (0-100)
5. Note any gaps in information

Respond in JSON format:
{
  "answer": "Detailed legal analysis based on the documents",
  "confidence": 85,
  "sources": ["Document1.pdf", "Document2.pdf"],
  "keyFindings": ["Key finding 1", "Key finding 2"],
  "riskLevel": "low|medium|high",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        answer: analysis.answer || 'Unable to analyze question',
        confidence: analysis.confidence || 50,
        sources: analysis.sources || [],
        keyFindings: analysis.keyFindings || [],
        riskLevel: analysis.riskLevel || 'medium',
        recommendations: analysis.recommendations || [],
        relevantDocuments: documents.length
      };
      
    } catch (error) {
      console.error(`Error analyzing question ${question.id}:`, error);
      return {
        question: question.question,
        answer: `Analysis temporarily unavailable. Please try again.`,
        confidence: 10,
        sources: [],
        keyFindings: [],
        relevantDocuments: documents.length
      };
    }
  }
  
  /**
   * Generate findings from legal answers
   */
  private generateFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = LEGAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      const findingType = answer.riskLevel === 'high' ? 'risk' : 
                         answer.confidence > 70 ? 'positive' : 'neutral';
      
      findings.push({
        id: findings.length + 1,
        type: findingType,
        content: answer.answer.substring(0, 200) + '...',
        source: answer.sources.length > 0 ? answer.sources[0] : 'Legal Documents',
        confidence: answer.confidence / 100,
        category: question.category.toLowerCase(),
        questionId: questionId
      });
    }
    
    return findings;
  }
  
  /**
   * Generate recommendations from legal answers
   */
  private generateRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer.recommendations && answer.recommendations.length > 0) {
        for (const rec of answer.recommendations) {
          recommendations.push({
            title: `${answer.question} - Action Required`,
            description: rec,
            priority: answer.riskLevel === 'high' ? 'high' : 'medium',
            category: 'legal',
            impact: answer.riskLevel === 'high' ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.confidence < 60) {
        recommendations.push({
          title: `Further Investigation Required`,
          description: `Low confidence analysis for: ${answer.question}. Additional documentation may be needed.`,
          priority: 'high',
          category: 'legal',
          impact: 'critical'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Store analysis results in database
   */
  private async storeAnalysisResults(
    dealId: number, 
    legalAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documents: any[]
  ): Promise<void> {
    
    const documentSources = documents.map(doc => doc.name);
    
    // Delete existing legal analysis
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'legal')
      ));
    
    // Insert new comprehensive analysis
    await db
      .insert(agentAnalyses)
      .values({
        dealId: dealId,
        agentType: 'legal',
        status: 'completed',
        progress: 100,
        findings: findings,
        recommendations: recommendations,
        documentSources: documentSources,
        legalAnswers: legalAnswers
      });
    
    console.log(`💾 Legal analysis stored for deal ${dealId}`);
  }
}

export const legalAnalysisService = new LegalAnalysisService();