import { db } from './db';
import { agentAnalyses, documents } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LEGAL_QUESTIONS = [
  {
    id: 'sha_1',
    category: 'Shareholders Agreement',
    question: 'What class of shares exist?',
    keywords: ['shares', 'equity', 'common', 'preferred', 'class', 'aoa', 'articles']
  },
  {
    id: 'sha_2', 
    category: 'Shareholders Agreement',
    question: 'Are liquidation preferences defined?',
    keywords: ['liquidation', 'preference', 'waterfall', 'distribution', 'aoa', 'articles']
  },
  {
    id: 'sha_3',
    category: 'Shareholders Agreement',
    question: 'Is anti-dilution protection present?',
    keywords: ['anti-dilution', 'dilution', 'protection', 'ratchet', 'weighted', 'average']
  },
  {
    id: 'gov_1',
    category: 'Governance',
    question: 'Is board composition defined?',
    keywords: ['board', 'director', 'governance', 'voting', 'composition']
  },
  {
    id: 'gov_2',
    category: 'Governance',
    question: 'Are voting rights clearly specified?',
    keywords: ['voting', 'rights', 'procedures', 'majority', 'veto', 'quorum']
  },
  {
    id: 'ip_1',
    category: 'IP Assignment',
    question: 'Are IP assignment agreements in place?',
    keywords: ['intellectual property', 'ip assignment', 'patent', 'copyright', 'trademark', 'employment']
  },
  {
    id: 'ip_2',
    category: 'IP Assignment',
    question: 'Are all founders/key personnel covered?',
    keywords: ['founders', 'key personnel', 'employees', 'consultants', 'advisors', 'ip assignment']
  },
  {
    id: 'commercial_1',
    category: 'Commercial',
    question: 'Are SLAs, warranties, and indemnity clauses present?',
    keywords: ['sla', 'service level', 'warranty', 'indemnity', 'commercial', 'agreement']
  },
  {
    id: 'commercial_2',
    category: 'Commercial',
    question: 'Are termination clauses fair and mutual?',
    keywords: ['termination', 'clause', 'notice', 'period', 'commercial', 'agreement']
  },
  {
    id: 'lit_1',
    category: 'Litigation',
    question: 'Are there pending litigations or regulatory proceedings?',
    keywords: ['litigation', 'lawsuit', 'proceeding', 'regulatory', 'investigation', 'compliance']
  },
  {
    id: 'lit_2',
    category: 'Litigation',
    question: 'Is financial exposure quantified?',
    keywords: ['financial', 'exposure', 'damages', 'legal costs', 'settlement', 'liability']
  },
  {
    id: 'reg_1',
    category: 'Regulatory',
    question: 'Are there FDA submissions or regulatory approvals?',
    keywords: ['fda', 'regulatory', 'approval', 'submission', 'clinical', 'trial']
  },
  {
    id: 'reg_2',
    category: 'Regulatory',
    question: 'Are there any regulatory compliance issues?',
    keywords: ['regulatory', 'compliance', 'violation', 'warning', 'audit', 'finding']
  },
  {
    id: 'financial_1',
    category: 'Financial',
    question: 'Are there warrants or convertible instruments?',
    keywords: ['warrant', 'convertible', 'instrument', 'exercise', 'conversion', 'terms']
  },
  {
    id: 'financial_2',
    category: 'Financial',
    question: 'What are the interest rates and maturity for debt instruments?',
    keywords: ['interest rate', 'maturity', 'debt', 'instrument', 'conversion', 'feature']
  }
];

export class SimpleLegalAnalysisService {
  
  async runSimpleLegalAnalysis(dealId: number): Promise<any> {
    console.log(`🚀 Starting simple legal analysis for deal ${dealId}`);
    
    // Create background job for progress tracking
    const jobId = `legal_analysis_${dealId}_${Date.now()}`;
    await storage.createBackgroundJob({
      jobId,
      dealId,
      status: 'processing',
      progress: 0,
      jobType: 'comprehensive_legal_analysis',
      currentStep: 'Initializing legal analysis...'
    });
    
    try {
      // Add a delay to ensure this runs after any cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update progress: Finding documents
      await this.updateProgress(jobId, 5, 'Finding legal documents...');
      
      // Get legal documents 
      const legalDocs = await this.getLegalDocuments(dealId);
      console.log(`📄 Found ${legalDocs.length} legal documents`);
      
      // Debug: Log document names
      legalDocs.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.name} (${doc.ocrText ? 'OCR' : 'Summary'}: ${(doc.ocrText || doc.aiSummary || '').length} chars)`);
      });
      
      if (legalDocs.length === 0) {
        await storage.updateBackgroundJob(jobId, { 
          status: 'completed', 
          progress: 100, 
          currentStep: 'No legal documents found' 
        });
        throw new Error('No legal documents found');
      }
      
      await this.updateProgress(jobId, 10, `Analyzing ${legalDocs.length} legal documents...`);
      
      // Process questions with progress updates
      const legalAnswers: Record<string, any> = {};
      const totalQuestions = LEGAL_QUESTIONS.length;
      
      for (let i = 0; i < LEGAL_QUESTIONS.length; i++) {
        const question = LEGAL_QUESTIONS[i];
        const questionProgress = Math.round(10 + (i / totalQuestions) * 70); // 10% to 80%
        
        await this.updateProgress(jobId, questionProgress, `Processing: ${question.question}`);
        console.log(`🔍 Processing: ${question.question}`);
        
        const answer = await this.processQuestion(question, legalDocs);
        legalAnswers[question.id] = answer;
        
        console.log(`✅ Completed: ${question.question}`);
      }
      
      // Generate findings
      await this.updateProgress(jobId, 85, 'Generating findings and recommendations...');
      const findings = this.generateFindings(legalAnswers);
      const recommendations = this.generateRecommendations(legalAnswers);
      
      // Store results
      await this.updateProgress(jobId, 95, 'Storing analysis results...');
      await this.storeResults(dealId, legalAnswers, findings, recommendations, legalDocs);
      
      // Complete the job
      await storage.updateBackgroundJob(jobId, { 
        status: 'completed', 
        progress: 100, 
        currentStep: `Legal analysis completed - ${Object.keys(legalAnswers).length} questions analyzed` 
      });
      
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
      await storage.updateBackgroundJob(jobId, { 
        status: 'failed', 
        currentStep: `Error: ${error.message}` 
      });
      throw error;
    }
  }

  private async updateProgress(jobId: string, progress: number, currentStep: string) {
    try {
      // Ensure progress is an integer to avoid database errors
      await storage.updateBackgroundJob(jobId, { 
        progress: Math.round(progress), 
        currentStep 
      });
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }
  
  private async getLegalDocuments(dealId: number): Promise<any[]> {
    const allDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    // Get documents specifically assigned to legal agents
    const legalDocs = allDocs.filter(doc => {
      if (!doc.ocrText && !doc.aiSummary) return false;
      
      // Check if document is assigned to legal agent
      const assignedAgents = doc.assignedAgents || [];
      const isAssignedToLegal = assignedAgents.includes('legal');
      
      if (isAssignedToLegal) {
        console.log(`📋 Legal assigned document: ${doc.name}`);
        return true;
      }
      
      // Fallback: Use keyword matching if no assignments exist
      const content = (doc.name + ' ' + (doc.ocrText || '') + ' ' + (doc.aiSummary || '')).toLowerCase();
      const legalKeywords = [
        'agreement', 'contract', 'legal', 'shareholder', 'equity', 'shares',
        'investment', 'employment', 'consulting', 'board', 'governance',
        'intellectual property', 'patent', 'trademark', 'license', 'aoa', 'articles'
      ];
      
      const isLegalByKeywords = legalKeywords.some(keyword => content.includes(keyword));
      if (isLegalByKeywords) {
        console.log(`🔍 Legal keyword match: ${doc.name}`);
      }
      
      return isLegalByKeywords;
    });
    
    console.log(`📊 Total legal documents found: ${legalDocs.length}`);
    return legalDocs.slice(0, 100); // Increased limit for comprehensive analysis
  }
  
  private async processQuestion(question: any, documents: any[]): Promise<any> {
    console.log(`🔍 Processing question: ${question.question}`);
    console.log(`📄 Available documents: ${documents.length}`);
    
    // Find relevant documents with actual content matching
    const relevantDocsWithQuotes = [];
    
    for (const doc of documents) {
      const content = doc.ocrText || doc.aiSummary || '';
      const contentStr = typeof content === 'string' ? content : String(content);
      
      if (!contentStr || contentStr.length < 10) continue;
      
      // Check if document contains relevant keywords
      const hasRelevantContent = question.keywords.some((keyword: string) => 
        contentStr.toLowerCase().includes(keyword.toLowerCase()) ||
        doc.name.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (hasRelevantContent) {
        relevantDocsWithQuotes.push({
          name: doc.name,
          content: contentStr,
          id: doc.id
        });
      }
    }
    
    console.log(`📋 Found ${relevantDocsWithQuotes.length} relevant documents for: ${question.question}`);
    
    if (relevantDocsWithQuotes.length === 0) {
      return {
        question: question.question,
        answer: 'No relevant information found in assigned legal documents.',
        confidence: 10,
        sources: [],
        quotes: [],
        keyFindings: [],
        evidenceSummary: 'No documents contain relevant information for this question.',
        evidenceCount: 0
      };
    }
    
    // Prepare documents for deep analysis with quote extraction
    const documentContents = relevantDocsWithQuotes.slice(0, 8).map((doc, i) => 
      `Document ${i+1}: ${doc.name}\nContent: ${doc.content.substring(0, 2000)}`
    ).join('\n\n---\n\n');
    
    const prompt = `You are a senior legal analyst conducting comprehensive due diligence. Analyze the provided legal documents to answer: "${question.question}"

CRITICAL INSTRUCTIONS:
1. Extract EXACT QUOTES from documents that directly relate to the question
2. Provide detailed analysis with specific evidence
3. Only reference documents that contain actual relevant information
4. Include confidence scores based on evidence quality
5. Provide comprehensive legal assessment

Documents to analyze:
${documentContents}

Provide response in JSON format:
{
  "answer": "Detailed, comprehensive answer with specific legal analysis (minimum 200 words)",
  "confidence": 0-100,
  "sources": ["document1.pdf", "document2.pdf"],
  "quotes": [
    {
      "document": "document_name.pdf",
      "text": "exact quote from document",
      "relevance": "why this quote is relevant to the question"
    }
  ],
  "keyFindings": ["Detailed finding 1", "Detailed finding 2", "Detailed finding 3"],
  "evidenceSummary": "Comprehensive summary of all evidence found",
  "legalAssessment": "Professional legal opinion based on evidence",
  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate that we have actual quotes and relevant content
      const hasValidQuotes = analysis.quotes && analysis.quotes.length > 0;
      const actualSources = hasValidQuotes ? 
        analysis.sources || [] : 
        [];
      
      console.log(`✅ Question "${question.question}" - Found ${hasValidQuotes ? analysis.quotes.length : 0} quotes from ${actualSources.length} documents`);
      
      return {
        question: question.question,
        answer: analysis.answer || 'Comprehensive analysis completed',
        confidence: analysis.confidence || 70,
        sources: actualSources,
        quotes: analysis.quotes || [],
        keyFindings: Array.isArray(analysis.keyFindings) ? analysis.keyFindings : [],
        evidenceSummary: analysis.evidenceSummary || '',
        legalAssessment: analysis.legalAssessment || '',
        recommendations: analysis.recommendations || [],
        evidenceCount: relevantDocsWithQuotes.length,
        hasActualEvidence: hasValidQuotes
      };
      
    } catch (error) {
      console.error(`❌ Error processing question "${question.question}":`, error);
      return {
        question: question.question,
        answer: 'Error occurred during comprehensive legal analysis',
        confidence: 0,
        sources: [],
        quotes: [],
        evidenceCount: 0,
        hasActualEvidence: false
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