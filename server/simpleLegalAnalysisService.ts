import { db } from './db';
import { agentAnalyses, documents } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LEGAL_QUESTIONS = [
  {
    id: 'sha_1',
    category: 'Shareholders Agreement',
    question: 'What class of shares exist?',
    keywords: ['shares', 'equity', 'common', 'preferred', 'class']
  },
  {
    id: 'sha_2', 
    category: 'Shareholders Agreement',
    question: 'Are liquidation preferences defined?',
    keywords: ['liquidation', 'preference', 'waterfall', 'distribution']
  },
  {
    id: 'ip_1',
    category: 'IP Assignment',
    question: 'Are IP assignment agreements in place?',
    keywords: ['intellectual property', 'ip assignment', 'patent', 'copyright', 'trademark']
  },
  {
    id: 'gov_1',
    category: 'Governance',
    question: 'Is board composition defined?',
    keywords: ['board', 'director', 'governance', 'voting', 'composition']
  },
  {
    id: 'com_1',
    category: 'Commercial',
    question: 'Are commercial agreements properly structured?',
    keywords: ['commercial', 'agreement', 'contract', 'terms', 'sla']
  }
];

export class SimpleLegalAnalysisService {
  
  async runSimpleLegalAnalysis(dealId: number): Promise<any> {
    console.log(`🚀 Starting simple legal analysis for deal ${dealId}`);
    
    try {
      // Add a delay to ensure this runs after any cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Get legal documents 
      const legalDocs = await this.getLegalDocuments(dealId);
      console.log(`📄 Found ${legalDocs.length} legal documents`);
      
      // Debug: Log document names
      legalDocs.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.name} (${doc.ocrText ? 'OCR' : 'Summary'}: ${(doc.ocrText || doc.aiSummary || '').length} chars)`);
      });
      
      if (legalDocs.length === 0) {
        throw new Error('No legal documents found');
      }
      
      // Process questions quickly
      const legalAnswers: Record<string, any> = {};
      
      for (const question of LEGAL_QUESTIONS) {
        console.log(`🔍 Processing: ${question.question}`);
        
        const answer = await this.processQuestion(question, legalDocs);
        legalAnswers[question.id] = answer;
        
        console.log(`✅ Completed: ${question.question}`);
      }
      
      // Generate findings
      const findings = this.generateFindings(legalAnswers);
      const recommendations = this.generateRecommendations(legalAnswers);
      
      // Store results
      await this.storeResults(dealId, legalAnswers, findings, recommendations, legalDocs);
      
      console.log(`✅ Simple legal analysis completed for deal ${dealId}`);
      
      return {
        success: true,
        documentsAnalyzed: legalDocs.length,
        questionsAnswered: Object.keys(legalAnswers).length,
        findings: findings.length,
        recommendations: recommendations.length
      };
      
    } catch (error) {
      console.error(`❌ Error in simple legal analysis:`, error);
      throw error;
    }
  }
  
  private async getLegalDocuments(dealId: number): Promise<any[]> {
    const allDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    // Get documents with legal keywords
    return allDocs.filter(doc => {
      if (!doc.ocrText && !doc.aiSummary) return false;
      
      const content = (doc.name + ' ' + (doc.ocrText || '') + ' ' + (doc.aiSummary || '')).toLowerCase();
      
      const legalKeywords = [
        'agreement', 'contract', 'legal', 'shareholder', 'equity', 'shares',
        'investment', 'employment', 'consulting', 'board', 'governance',
        'intellectual property', 'patent', 'trademark', 'license'
      ];
      
      return legalKeywords.some(keyword => content.includes(keyword));
    }).slice(0, 50); // Limit to 50 docs for speed
  }
  
  private async processQuestion(question: any, documents: any[]): Promise<any> {
    // Find relevant documents
    const relevantDocs = documents.filter(doc => {
      const content = (doc.name + ' ' + (doc.ocrText || '') + ' ' + (doc.aiSummary || '')).toLowerCase();
      return question.keywords.some((keyword: string) => content.includes(keyword));
    }).slice(0, 10); // Limit to 10 most relevant docs
    
    if (relevantDocs.length === 0) {
      return {
        question: question.question,
        answer: 'No relevant information found in available documents.',
        confidence: 20,
        sources: [],
        evidenceCount: 0
      };
    }
    
    // Create summary of relevant content
    const documentSummaries = relevantDocs.map(doc => {
      const content = doc.aiSummary || doc.ocrText || '';
      const contentStr = typeof content === 'string' ? content : String(content);
      return {
        name: doc.name,
        content: contentStr.substring(0, 500)
      };
    });
    
    const prompt = `Analyze legal documents to answer: "${question.question}"

Document summaries:
${documentSummaries.map((doc, i) => `${i+1}. ${doc.name}: ${doc.content}`).join('\n\n')}

Provide a comprehensive legal analysis in JSON format:
{
  "answer": "Direct answer to the question based on documents",
  "confidence": 0-100,
  "sources": ["document1.pdf", "document2.pdf"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "evidenceSummary": "Summary of evidence found"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        answer: analysis.answer || 'Analysis completed',
        confidence: analysis.confidence || 70,
        sources: relevantDocs.map(d => d.name),
        keyFindings: analysis.keyFindings || [],
        evidenceSummary: analysis.evidenceSummary || '',
        evidenceCount: relevantDocs.length
      };
      
    } catch (error) {
      console.error(`Error processing question ${question.id}:`, error);
      return {
        question: question.question,
        answer: 'Analysis temporarily unavailable.',
        confidence: 50,
        sources: relevantDocs.map(d => d.name),
        evidenceCount: relevantDocs.length
      };
    }
  }
  
  private generateFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    Object.values(answers).forEach((answer: any, index) => {
      if (answer.confidence > 60) {
        findings.push({
          id: index + 1,
          type: 'positive',
          content: `${answer.question}: ${answer.answer.substring(0, 100)}...`,
          confidence: answer.confidence / 100,
          category: 'legal',
          source: answer.sources[0] || 'Legal Documents'
        });
      }
      
      if (answer.confidence < 50) {
        findings.push({
          id: findings.length + 1,
          type: 'risk',
          content: `Insufficient documentation for: ${answer.question}`,
          confidence: 0.3,
          category: 'gaps',
          source: 'Legal Analysis'
        });
      }
    });
    
    return findings;
  }
  
  private generateRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    Object.values(answers).forEach((answer: any) => {
      if (answer.confidence < 60) {
        recommendations.push({
          title: `Legal Documentation Review: ${answer.question}`,
          description: `Review and potentially update documentation related to: ${answer.question}`,
          priority: answer.confidence < 40 ? 'high' : 'medium',
          category: 'legal',
          impact: 'moderate'
        });
      }
    });
    
    return recommendations;
  }
  
  private async storeResults(
    dealId: number,
    legalAnswers: Record<string, any>,
    findings: any[],
    recommendations: any[],
    documents: any[]
  ): Promise<void> {
    
    // Delete any existing legal analysis
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'legal')
      ));
    
    console.log(`🗑️ Cleared existing legal analysis for deal ${dealId}`);
    
    // Insert new analysis
    const analysisData = {
      dealId,
      agentType: 'legal' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      legalAnswers: JSON.stringify(legalAnswers),
      documentSources: JSON.stringify(documents.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Stored simple legal analysis for deal ${dealId} with ${Object.keys(legalAnswers).length} questions`);
  }
}