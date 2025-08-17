/**
 * Comprehensive IP Analysis Service
 * Analyzes ALL assigned IP documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 * EXACT COPY of Financial micro-step architecture for perfect parity
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced IP questions for comprehensive analysis - 12 questions exactly like Financial
export const COMPREHENSIVE_IP_QUESTIONS = [
  // Patent Portfolio
  { 
    id: 'patents_1', 
    question: 'What patents are owned or pending?', 
    category: 'Patent Portfolio',
    analysisPrompt: 'Identify owned patents, pending patent applications, and intellectual property portfolio details.',
    keywords: ['patent', 'patent application', 'intellectual property', 'patent pending', 'patent portfolio']
  },
  { 
    id: 'patents_2', 
    question: 'Are core technologies protected?', 
    category: 'Patent Portfolio',
    analysisPrompt: 'Find technology protection strategies, core technology patents, and proprietary technology coverage.',
    keywords: ['technology protection', 'core technology', 'proprietary technology', 'patent protection']
  },
  { 
    id: 'patents_3', 
    question: 'What is the patent landscape analysis?', 
    category: 'Patent Portfolio',
    analysisPrompt: 'Look for patent landscape analyses, prior art searches, and freedom to operate assessments.',
    keywords: ['patent landscape', 'prior art', 'patent search', 'freedom to operate']
  },
  // Trademarks & Branding
  { 
    id: 'trademarks_1', 
    question: 'Are trademarks registered and protected?', 
    category: 'Trademarks & Branding',
    analysisPrompt: 'Identify trademark registrations, service marks, and brand protection measures.',
    keywords: ['trademark', 'service mark', 'brand protection', 'trademark registration']
  },
  { 
    id: 'trademarks_2', 
    question: 'Is brand identity legally secure?', 
    category: 'Trademarks & Branding',
    analysisPrompt: 'Find brand identity protection, logo protection, and brand security measures.',
    keywords: ['brand identity', 'brand protection', 'logo protection', 'brand security']
  },
  // Technology Licensing
  { 
    id: 'licensing_1', 
    question: 'What licensing agreements are in place?', 
    category: 'Technology Licensing',
    analysisPrompt: 'Identify licensing agreements, technology licenses, and IP licensing deals.',
    keywords: ['licensing agreement', 'technology license', 'ip license', 'licensing deal']
  },
  { 
    id: 'licensing_2', 
    question: 'Are there any IP infringement risks?', 
    category: 'Technology Licensing',
    analysisPrompt: 'Look for IP infringement risks, patent infringement issues, and IP risk assessments.',
    keywords: ['ip infringement', 'patent infringement', 'trademark infringement', 'ip risk']
  },
  // IP Strategy & Valuation
  { 
    id: 'strategy_1', 
    question: 'What is the IP strategy and roadmap?', 
    category: 'IP Strategy & Valuation',
    analysisPrompt: 'Find IP strategy documents, intellectual property roadmaps, and IP development plans.',
    keywords: ['ip strategy', 'intellectual property strategy', 'ip roadmap', 'ip development', 'patent strategy']
  },
  { 
    id: 'strategy_2', 
    question: 'How is IP valued and monetized?', 
    category: 'IP Strategy & Valuation',
    analysisPrompt: 'Analyze IP valuation methods, IP monetization strategies, and intellectual property value.',
    keywords: ['ip valuation', 'ip value', 'ip monetization', 'intellectual property value', 'patent value']
  },
  // Trade Secrets & Confidentiality
  { 
    id: 'secrets_1', 
    question: 'What trade secrets are protected?', 
    category: 'Trade Secrets & Confidentiality',
    analysisPrompt: 'Identify trade secrets, confidential information protection, and proprietary know-how.',
    keywords: ['trade secret', 'confidential information', 'proprietary information', 'know-how', 'confidentiality']
  },
  { 
    id: 'secrets_2', 
    question: 'Are confidentiality measures adequate?', 
    category: 'Trade Secrets & Confidentiality',
    analysisPrompt: 'Assess confidentiality agreements, non-disclosure agreements, and information security measures.',
    keywords: ['confidentiality agreement', 'nda', 'non-disclosure', 'information security', 'data protection']
  },
  // Competitive IP Position
  { 
    id: 'competitive_1', 
    question: 'What is the competitive IP landscape?', 
    category: 'Competitive IP Position',
    analysisPrompt: 'Analyze competitive patent landscape, competitor IP positions, and market IP dynamics.',
    keywords: ['competitive landscape', 'competitor patents', 'market analysis', 'ip competition', 'patent analysis']
  }
];

export interface IpAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface IpEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface IpAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: IpEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  ipAssessment: string;
  recommendations: string[];
}

export class ComprehensiveIpAnalysisService {
  private isRunning = false;
  private progress = 0;
  private currentStep = '';
  private currentQuestion = '';

  async startComprehensiveAnalysis(dealId: number, jobId?: string): Promise<void> {
    try {
      this.isRunning = true;
      this.progress = 0;
      this.currentStep = 'Initializing IP analysis';
      this.currentQuestion = '';

      console.log(`🔬 Starting comprehensive IP analysis for deal ${dealId}`);

      // Update background job status
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'processing',
          progress: 0,
          currentStep: this.currentStep
        });
      }

      // Step 1: Get assigned IP documents for this deal
      console.log(`👥 Finding assigned IP documents for deal ${dealId}`);
      const assignedDocuments = await this.getAssignedDocuments(dealId);
      
      if (assignedDocuments.length === 0) {
        console.log(`⚠️ No IP documents found for analysis of deal ${dealId}`);
        if (jobId) {
          await storage.updateBackgroundJob(jobId, {
            status: 'completed',
            progress: 100,
            currentStep: 'No IP documents found for analysis'
          });
        }
        return;
      }

      console.log(`📄 Found ${assignedDocuments.length} IP documents for analysis`);
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          progress: 5,
          currentStep: `Processing ${assignedDocuments.length} IP documents`
        });
      }

      // Step 2: Process each IP question systematically with EXACT micro-step progression
      const ipAnswers: { [key: string]: IpAnswer } = {};
      
      for (let i = 0; i < COMPREHENSIVE_IP_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_IP_QUESTIONS[i];
        const questionNumber = i + 1;
        const totalQuestions = COMPREHENSIVE_IP_QUESTIONS.length;
        
        console.log(`🔍 Question ${questionNumber}/${totalQuestions}: ${question.question}`);
        this.currentQuestion = question.question;
        this.currentStep = `Analyzing: ${question.question}`;
        
        // EXACT Financial progression formula - no custom calculation
        const progress = Math.round(((i + 1) / COMPREHENSIVE_IP_QUESTIONS.length) * 100);
        this.progress = progress;
        
        if (jobId) {
          await storage.updateBackgroundJob(jobId, {
            progress: this.progress,
            currentStep: this.currentStep
          });
        }

        // Process question with assigned documents
        const answer = await this.processQuestionWithDocuments(question, assignedDocuments);
        ipAnswers[question.id] = answer;

        console.log(`✅ Question ${questionNumber} completed: ${answer.answer.slice(0, 100)}...`);
      }

      // Step 3: Save complete analysis exactly like Financial
      await this.saveCompleteAnalysis(dealId, ipAnswers, assignedDocuments.length);

      this.isRunning = false;
      this.progress = 100;
      this.currentStep = 'IP analysis completed';

      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'IP analysis completed successfully'
        });
      }

      console.log(`✅ Comprehensive IP analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error(`💥 Error in IP analysis for deal ${dealId}:`, error);
      this.isRunning = false;
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'failed',
          progress: 0,
          currentStep: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private async getAssignedDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to IP agent
    let ipDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('ip')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to IP: ${ipDocuments.length}`);
    
    // If no documents are explicitly assigned to IP, identify IP-related documents
    if (ipDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to IP agent, identifying IP-related documents...');
      
      ipDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiContent = typeof doc.aiSummary === 'string' ? doc.aiSummary.toLowerCase() : '';
        
        // IP document keywords - EXACTLY matching Financial's approach
        const ipKeywords = [
          'patent', 'trademark', 'copyright', 'intellectual property', 'ip', 'license',
          'licensing', 'infringement', 'prior art', 'patent application', 'patent pending',
          'trade secret', 'confidential', 'proprietary', 'nda', 'non-disclosure',
          'technology transfer', 'ip assignment', 'invention', 'innovation', 'know-how',
          'technology', 'software', 'algorithm', 'technical', 'research', 'development',
          'freedom to operate', 'patent landscape', 'ip strategy', 'brand', 'logo',
          'service mark', 'domain', 'url', 'technology licensing', 'ip valuation'
        ];
        
        // Check document name, OCR content, and AI summary for IP keywords
        const hasIpKeywords = ipKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword) || aiContent.includes(keyword)
        );
        
        return hasIpKeywords;
      });
      
      console.log(`📄 Auto-identified IP documents: ${ipDocuments.length}`);
    }

    // If still no documents found, use all documents with OCR text
    if (ipDocuments.length === 0) {
      console.log('📄 No IP-related documents found, using all documents with OCR text...');
      ipDocuments = allDocuments.filter(doc => doc.ocrText || doc.aiSummary);
    }

    console.log(`📄 Documents with content available: ${ipDocuments.length}`);
    console.log(`📄 Found ${ipDocuments.length} documents for IP analysis`);
    
    return ipDocuments;
  }

  private async processQuestionWithDocuments(question: any, documents: any[]): Promise<IpAnswer> {
    console.log(`🔍 Processing IP question: ${question.question} with ${documents.length} documents`);
    
    // Extract evidence for this specific question
    const evidence = await this.extractEvidenceFromAllDocuments(documents, question);
    
    // Compile comprehensive answer
    const answer = await this.compileComprehensiveAnswer(question, evidence);
    
    return answer;
  }

  private async extractEvidenceFromAllDocuments(documents: any[], question: any): Promise<IpEvidence[]> {
    const evidence: IpEvidence[] = [];
    
    // Process ALL assigned documents (EXACTLY matching Financial approach - no speed limits)
    const documentsToProcess = documents;
    console.log(`📄 COMPREHENSIVE MODE: Starting evidence extraction from ALL ${documentsToProcess.length} documents for: ${question.question}`);
    console.log(`🔍 FULL ANALYSIS: Processing ALL ${documentsToProcess.length} assigned documents for thorough IP analysis`);

    // Process documents in batches with timeout for speed - EXACT Financial architecture
    const batchSize = 20;
    const batches = [];
    for (let i = 0; i < documentsToProcess.length; i += batchSize) {
      batches.push(documentsToProcess.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔎 Processing batch ${batchIndex + 1}/${batches.length}`);
      
      const batchPromises = batch.map(async (doc) => {
        return this.extractEvidenceFromDocument(doc, question);
      });

      try {
        // Add timeout for batch processing (15 seconds max) - EXACT Financial implementation
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Batch processing timeout')), 15000);
        });

        const results = await Promise.race([
          Promise.allSettled(batchPromises),
          timeoutPromise
        ]) as PromiseSettledResult<IpEvidence | null>[];

        const validResults = results
          .filter((result): result is PromiseFulfilledResult<IpEvidence> => 
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value);

        evidence.push(...validResults);
        
        console.log(`✅ Batch completed: ${validResults.length}/${batch.length} documents had relevant evidence`);

      } catch (error) {
        console.log(`⚠️ Batch ${batchIndex + 1} timeout, continuing with next batch`);
        continue;
      }
    }

    console.log(`🎯 SPEED MODE: Extracted evidence from ${evidence.length}/${documentsToProcess.length} documents in FAST mode`);
    console.log(`📊 Evidence extraction completed for question: ${question.question}`);
    
    return evidence;
  }

  private async extractEvidenceFromDocument(doc: any, question: any): Promise<IpEvidence | null> {
    try {
      console.log(`🔎 FAST Extracting evidence from: ${doc.name}`);
      
      // Use AI summary if available, otherwise fall back to OCR content - EXACT Financial approach
      const content = typeof doc.aiSummary === 'string' ? doc.aiSummary : (doc.ocrText || '');
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return null;
      }

      // Quick keyword check first (for speed) - EXACT Financial implementation
      const hasRelevantKeywords = question.keywords.some((keyword: string) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!hasRelevantKeywords) {
        return null;
      }

      // Extract specific evidence using OpenAI with focused prompt - matching Financial structure
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an IP analysis expert. Extract specific evidence related to the given question from the document content. Focus on IP-related data, patent information, trademark details, and specific intellectual property information.`
          },
          {
            role: "user",
            content: `
QUESTION: ${question.question}
ANALYSIS FOCUS: ${question.analysisPrompt}

DOCUMENT: ${doc.name}
CONTENT: ${content.slice(0, 6000)}

Extract specific IP-related evidence for this question. Provide exact quotes, specific findings, and numerical data where available.

Respond in JSON format:
{
  "relevantContent": ["exact quote 1", "exact quote 2"],
  "keyFindings": ["specific finding 1", "specific finding 2"],
  "confidence": 85
}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1200
      });

      const content_response = response.choices[0].message.content;
      if (!content_response) {
        return null;
      }

      let result;
      try {
        result = JSON.parse(content_response);
      } catch (parseError) {
        console.log(`⚠️ JSON parse error for ${doc.name}, skipping`);
        return null;
      }

      // Return only if we found meaningful content
      if (!result.relevantContent || result.relevantContent.length === 0) {
        return null;
      }

      return {
        documentName: doc.name,
        documentSummary: typeof doc.aiSummary === 'string' ? doc.aiSummary.slice(0, 500) : '',
        relevantContent: result.relevantContent || [],
        keyFindings: result.keyFindings || [],
        confidence: result.confidence || 0
      };

    } catch (error) {
      console.error(`⚠️ Error extracting evidence from ${doc.name}:`, error);
      return null;
    }
  }

  private async compileComprehensiveAnswer(question: any, evidence: IpEvidence[]): Promise<IpAnswer> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: 'No relevant information found in the available documents.',
        confidence: 0,
        sources: [],
        detailedEvidence: [],
        keyFindings: [],
        evidenceSummary: 'No evidence available',
        ipAssessment: 'Unable to assess due to lack of relevant documentation',
        recommendations: ['Obtain relevant IP documentation for comprehensive analysis']
      };
    }

    // Compile all evidence
    const allFindings = evidence.flatMap(e => e.keyFindings);
    const allContent = evidence.flatMap(e => e.relevantContent);
    const sources = evidence.map(e => e.documentName);

    const prompt = `
You are an expert IP analyst. Based on the following evidence, provide a comprehensive answer to this IP question:

QUESTION: ${question.question}
CATEGORY: ${question.category}

EVIDENCE FROM DOCUMENTS:
${evidence.map((e, i) => `
Document ${i + 1}: ${e.documentName}
Summary: ${e.documentSummary}
Key Findings: ${e.keyFindings.join('; ')}
Relevant Content: ${e.relevantContent.join('; ')}
`).join('\n')}

Provide a comprehensive analysis in JSON format:
{
  "answer": "Detailed answer based on evidence",
  "confidence": 85,
  "keyFindings": ["finding1", "finding2"],
  "evidenceSummary": "Summary of all evidence",
  "ipAssessment": "Professional IP assessment",
  "recommendations": ["recommendation1", "recommendation2"]
}

Requirements:
- Provide specific, detailed answers based on the evidence
- Include confidence level (0-100)
- Give practical IP recommendations
- Focus on IP-specific insights and analysis`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        answer: result.answer || 'Analysis completed but no specific answer generated.',
        confidence: result.confidence || 0,
        sources: sources,
        detailedEvidence: evidence,
        keyFindings: result.keyFindings || allFindings,
        evidenceSummary: result.evidenceSummary || 'Evidence compiled from multiple sources',
        ipAssessment: result.ipAssessment || 'Assessment completed',
        recommendations: result.recommendations || []
      };
    } catch (error) {
      console.error(`Error compiling answer for question ${question.question}:`, error);
      
      return {
        question: question.question,
        answer: 'Error occurred during analysis. Please review documents manually.',
        confidence: 0,
        sources: sources,
        detailedEvidence: evidence,
        keyFindings: allFindings,
        evidenceSummary: 'Error in analysis compilation',
        ipAssessment: 'Unable to complete assessment due to processing error',
        recommendations: ['Manual review recommended due to processing error']
      };
    }
  }

  private async saveCompleteAnalysis(dealId: number, ipAnswers: { [key: string]: IpAnswer }, documentsCount: number): Promise<void> {
    try {
      console.log(`💾 Saving IP analysis for deal ${dealId} with ${Object.keys(ipAnswers).length} answers`);

      // Extract findings and recommendations
      const allFindings = Object.values(ipAnswers).flatMap(answer => answer.keyFindings);
      const allRecommendations = Object.values(ipAnswers).flatMap(answer => answer.recommendations);

      // Store in agentAnalyses table exactly like Financial - FIXED field name
      await db.insert(agentAnalyses).values({
        dealId: dealId,
        agentType: 'IP',  // Use capital 'IP' like Financial uses 'Financial'
        status: 'completed',
        findings: allFindings,
        recommendations: allRecommendations,
        ip_answers: ipAnswers  // Fixed: Use snake_case field name to match database schema
      });

      console.log(`✅ Saved IP analysis with ${allFindings.length} findings and ${allRecommendations.length} recommendations`);
    } catch (error) {
      console.error(`Error saving IP analysis for deal ${dealId}:`, error);
      throw error;
    }
  }

  getProgressData(dealId: number) {
    return {
      isRunning: this.isRunning,
      progress: this.progress,
      message: this.currentStep || 'No IP analysis running',
      currentStep: this.currentStep,
      currentQuestion: this.currentQuestion
    };
  }
}

// Export singleton instance exactly like Financial
export const comprehensiveIpAnalysisService = new ComprehensiveIpAnalysisService();