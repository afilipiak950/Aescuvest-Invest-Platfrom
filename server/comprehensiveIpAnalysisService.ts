/**
 * Comprehensive IP Analysis Service
 * Analyzes ALL assigned IP documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 * EXACT COPY of Financial micro-step architecture for perfect parity
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';
import { resilientOpenAI } from './utils/resilientOpenAI';

// Enhanced IP questions for comprehensive analysis - 12 questions exactly like Financial
export const COMPREHENSIVE_IP_QUESTIONS = [
  // Patent Portfolio
  { 
    id: 'patents_1', 
    question: 'What patents are owned or pending?', 
    category: 'Patent Portfolio',
    analysisPrompt: 'Identify owned patents, pending patent applications, and intellectual property portfolio details.',
    keywords: ['patent', 'application', 'intellectual', 'property', 'pending', 'portfolio', 'invention', 'innovation', 'technology', 'system', 'method', 'device', 'process', 'design', 'product', 'solution', 'development', 'research']
  },
  { 
    id: 'patents_2', 
    question: 'Are core technologies protected?', 
    category: 'Patent Portfolio',
    analysisPrompt: 'Find technology protection strategies, core technology patents, and proprietary technology coverage.',
    keywords: ['technology', 'protection', 'core', 'proprietary', 'patent', 'system', 'method', 'process', 'device', 'innovation', 'product', 'solution', 'development', 'design', 'technical', 'engineering']
  },
  { 
    id: 'patents_3', 
    question: 'What is the patent landscape analysis?', 
    category: 'Patent Portfolio',
    analysisPrompt: 'Look for patent landscape analyses, prior art searches, and freedom to operate assessments.',
    keywords: ['patent', 'landscape', 'prior', 'art', 'search', 'freedom', 'operate', 'analysis', 'competitive', 'market', 'technology', 'review', 'assessment', 'study', 'evaluation']
  },
  // Trademarks & Branding
  { 
    id: 'trademarks_1', 
    question: 'Are trademarks registered and protected?', 
    category: 'Trademarks & Branding',
    analysisPrompt: 'Identify trademark registrations, service marks, and brand protection measures.',
    keywords: ['trademark', 'service', 'mark', 'brand', 'protection', 'registration', 'logo', 'name', 'identity', 'commercial', 'business', 'product', 'marketing', 'legal']
  },
  { 
    id: 'trademarks_2', 
    question: 'Is brand identity legally secure?', 
    category: 'Trademarks & Branding',
    analysisPrompt: 'Find brand identity protection, logo protection, and brand security measures.',
    keywords: ['brand', 'identity', 'protection', 'logo', 'security', 'trademark', 'name', 'commercial', 'business', 'marketing', 'product', 'legal', 'registration']
  },
  // Technology Licensing
  { 
    id: 'licensing_1', 
    question: 'What licensing agreements are in place?', 
    category: 'Technology Licensing',
    analysisPrompt: 'Identify licensing agreements, technology licenses, and IP licensing deals.',
    keywords: ['licensing', 'agreement', 'technology', 'license', 'deal', 'contract', 'legal', 'business', 'commercial', 'terms', 'conditions', 'transfer', 'intellectual', 'property']
  },
  { 
    id: 'licensing_2', 
    question: 'Are there any IP infringement risks?', 
    category: 'Technology Licensing',
    analysisPrompt: 'Look for IP infringement risks, patent infringement issues, and IP risk assessments.',
    keywords: ['infringement', 'risk', 'patent', 'trademark', 'intellectual', 'property', 'legal', 'litigation', 'compliance', 'analysis', 'assessment', 'evaluation', 'review']
  },
  // IP Strategy & Valuation
  { 
    id: 'strategy_1', 
    question: 'What is the IP strategy and roadmap?', 
    category: 'IP Strategy & Valuation',
    analysisPrompt: 'Find IP strategy documents, intellectual property roadmaps, and IP development plans.',
    keywords: ['strategy', 'intellectual', 'property', 'roadmap', 'development', 'patent', 'plan', 'innovation', 'technology', 'business', 'commercial', 'research', 'product']
  },
  { 
    id: 'strategy_2', 
    question: 'How is IP valued and monetized?', 
    category: 'IP Strategy & Valuation',
    analysisPrompt: 'Analyze IP valuation methods, IP monetization strategies, and intellectual property value.',
    keywords: ['valuation', 'value', 'monetization', 'intellectual', 'property', 'patent', 'financial', 'revenue', 'commercial', 'business', 'assessment', 'analysis', 'evaluation']
  },
  // Trade Secrets & Confidentiality
  { 
    id: 'secrets_1', 
    question: 'What trade secrets are protected?', 
    category: 'Trade Secrets & Confidentiality',
    analysisPrompt: 'Identify trade secrets, confidential information protection, and proprietary know-how.',
    keywords: ['trade', 'secret', 'confidential', 'information', 'proprietary', 'know-how', 'confidentiality', 'technology', 'process', 'method', 'business', 'commercial', 'data']
  },
  { 
    id: 'secrets_2', 
    question: 'Are confidentiality measures adequate?', 
    category: 'Trade Secrets & Confidentiality',
    analysisPrompt: 'Assess confidentiality agreements, non-disclosure agreements, and information security measures.',
    keywords: ['confidentiality', 'agreement', 'nda', 'non-disclosure', 'information', 'security', 'data', 'protection', 'legal', 'contract', 'terms', 'business', 'commercial']
  },
  // Competitive IP Position
  { 
    id: 'competitive_1', 
    question: 'What is the competitive IP landscape?', 
    category: 'Competitive IP Position',
    analysisPrompt: 'Analyze competitive patent landscape, competitor IP positions, and market IP dynamics.',
    keywords: ['competitive', 'landscape', 'competitor', 'market', 'analysis', 'patent', 'technology', 'business', 'commercial', 'industry', 'product', 'innovation', 'research', 'development']
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

      // CRITICAL FIX: Delete existing analysis IMMEDIATELY at start like Financial agent
      console.log(`🗑️ IMMEDIATELY clearing existing IP analysis for deal ${dealId} to ensure fresh start...`);
      await db.delete(agentAnalyses).where(
        and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'IP')
        )
      );
      console.log(`✅ IMMEDIATELY cleared existing IP analysis for deal ${dealId}`);

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

        // Extract evidence for this specific question
        console.log(`📊 Extracting IP evidence for: ${question.question}`);
        const evidence = await this.extractEvidenceFromAllDocuments(assignedDocuments, question);
        
        // Compile comprehensive answer
        console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${evidence.length} pieces of evidence`);
        const answer = await this.compileComprehensiveAnswer(question, evidence);
        
        ipAnswers[question.id] = answer;
        console.log(`✅ Completed question ${questionNumber}/${totalQuestions}: ${question.question}`);
      }

      // Step 3: Store results with EXACT same pattern as Financial
      console.log(`💾 Storing comprehensive IP analysis results for deal ${dealId}`);
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          progress: 95,
          currentStep: 'Finalizing IP analysis'
        });
      }

      await this.storeComprehensiveResultsWithoutDeletion(dealId, ipAnswers, assignedDocuments);

      // Final completion
      this.progress = 100;
      this.currentStep = 'IP analysis completed';
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: this.currentStep
        });
      }

      console.log(`✅ Comprehensive IP analysis completed for deal ${dealId}`);

    } catch (error) {
      console.error('Error in comprehensive IP analysis:', error);
      this.isRunning = false;
      
      if (jobId) {
        await storage.updateBackgroundJob(jobId, {
          status: 'failed',
          currentStep: `IP analysis failed: ${(error as any)?.message || error}`
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
    
    // First try documents explicitly assigned to IP agent (AI SUMMARY ONLY like Legal/Clinical)
    let ipDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('ip')) && 
      doc.aiSummary
    );
    
    console.log(`📄 Documents explicitly assigned to IP: ${ipDocuments.length}`);
    
    // If no documents are explicitly assigned to IP, identify IP-related documents
    if (ipDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to IP agent, identifying IP-related documents...');
      
      ipDocuments = allDocuments.filter(doc => {
        if (!doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const aiContent = typeof doc.aiSummary === 'string' ? doc.aiSummary.toLowerCase() : 
          (doc.aiSummary.executiveSummary ? doc.aiSummary.executiveSummary.toLowerCase() : '');
        
        // IP document keywords - EXPANDED to match Financial's broad coverage approach
        const ipKeywords = [
          // Core IP terms
          'patent', 'trademark', 'copyright', 'intellectual property', 'ip', 'license',
          'licensing', 'infringement', 'prior art', 'patent application', 'patent pending',
          'trade secret', 'confidential', 'proprietary', 'nda', 'non-disclosure',
          'technology transfer', 'ip assignment', 'invention', 'innovation', 'know-how',
          'technology', 'software', 'algorithm', 'technical', 'research', 'development',
          'freedom to operate', 'patent landscape', 'ip strategy', 'brand', 'logo',
          'service mark', 'domain', 'url', 'technology licensing', 'ip valuation',
          
          // Expanded technology and legal terms (like Financial uses broad terms)
          'design', 'system', 'method', 'process', 'device', 'apparatus', 'product',
          'solution', 'platform', 'framework', 'architecture', 'implementation',
          'feature', 'functionality', 'capability', 'specification', 'standard',
          'protocol', 'interface', 'module', 'component', 'equipment', 'instrument',
          'machine', 'tool', 'application', 'software', 'hardware', 'firmware',
          'data', 'database', 'information', 'content', 'document', 'file',
          'code', 'program', 'script', 'library', 'api', 'sdk', 'framework',
          'analysis', 'evaluation', 'assessment', 'review', 'study', 'report',
          'legal', 'agreement', 'contract', 'terms', 'conditions', 'compliance',
          'regulatory', 'regulation', 'requirement', 'standard', 'guideline',
          'medical', 'device', 'clinical', 'health', 'safety', 'quality',
          'manufacturing', 'production', 'distribution', 'commercial', 'business'
        ];
        
        // Check document name and AI summary for IP keywords (NO OCR)
        const hasIpKeywords = ipKeywords.some(keyword => 
          docName.includes(keyword) || aiContent.includes(keyword)
        );
        
        return hasIpKeywords;
      });
      
      console.log(`📄 Auto-identified IP documents: ${ipDocuments.length}`);
    }

    // If still no documents found, use all documents with AI summaries (EXACTLY like Legal/Clinical)
    if (ipDocuments.length === 0) {
      console.log('📄 No IP-related documents found, using all documents with AI summaries...');
      ipDocuments = allDocuments.filter(doc => doc.aiSummary);
      console.log(`📄 Documents with AI summaries available: ${ipDocuments.length}`);
    }
    
    console.log(`📄 Found ${ipDocuments.length} documents for IP analysis`);
    
    if (ipDocuments.length === 0) {
      console.log('⚠️ No documents found for IP analysis');
      return [];
    }
    
    return ipDocuments;
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

      // Process batch with error resilience (no batch timeout to prevent conflicts)
      const results = await Promise.allSettled(batchPromises);

      const validResults = results
        .filter((result): result is PromiseFulfilledResult<IpEvidence> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

      evidence.push(...validResults);
      
      console.log(`✅ Batch completed: ${validResults.length}/${batch.length} documents had relevant evidence`);
    }

    console.log(`🎯 SPEED MODE: Extracted evidence from ${evidence.length}/${documentsToProcess.length} documents in FAST mode`);
    console.log(`📊 Evidence extraction completed for question: ${question.question}`);
    
    return evidence;
  }

  private async extractEvidenceFromDocument(doc: any, question: any): Promise<IpEvidence | null> {
    try {
      console.log(`🔎 FAST Extracting evidence from: ${doc.name}`);
      
      // Use ONLY AI summary - handle BOTH string and object formats (like Legal/Clinical)
      const aiSummary = doc.aiSummary;
      if (!aiSummary) return null;
      
      let content: string;
      
      // Handle STRING summaries (most common in production)
      if (typeof aiSummary === 'string') {
        content = aiSummary;
      } 
      // Handle OBJECT summaries (structured format)
      else if (typeof aiSummary === 'object') {
        content = [
          aiSummary.executiveSummary || '',
          aiSummary.documentType ? `Document Type: ${aiSummary.documentType}` : '',
          aiSummary.criticalFindings?.length ? `Critical Findings: ${aiSummary.criticalFindings.join('; ')}` : '',
          aiSummary.keyFinancialData?.length ? `Financial Data: ${aiSummary.keyFinancialData.join('; ')}` : '',
          aiSummary.riskAssessment?.length ? `Risk Assessment: ${aiSummary.riskAssessment.join('; ')}` : '',
          aiSummary.neutralFindings?.length ? `Neutral Findings: ${aiSummary.neutralFindings.join('; ')}` : '',
          aiSummary.strategicImplications || ''
        ].filter(s => s).join('\n\n');
        
        // Fallback: if all fields are empty, stringify the entire object
        if (!content || content.trim().length === 0) {
          content = JSON.stringify(aiSummary);
        }
      }
      // Fallback: stringify anything else
      else {
        content = String(aiSummary);
      }
      
      if (!content || content.trim().length === 0) {
        console.log(`❌ No AI summary content available for ${doc.name}`);
        return null;
      }

      // DEBUG: Log content sample and keywords for debugging
      console.log(`🔍 DEBUG - Doc: ${doc.name.substring(0, 30)}, Content length: ${content.length}, First few keywords: ${question.keywords.slice(0, 3).join(', ')}`);
      console.log(`📝 Content preview: ${content.substring(0, 200)}...`);

      // Quick keyword check first (for speed) - EXACT Financial implementation
      const matchedKeywords = question.keywords.filter((keyword: string) =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );
      
      const hasRelevantKeywords = matchedKeywords.length > 0;

      console.log(`🎯 Keyword match for ${doc.name.substring(0, 30)}: ${hasRelevantKeywords ? 'YES' : 'NO'} (matched: ${matchedKeywords.slice(0, 2).join(', ')})`);

      if (!hasRelevantKeywords) {
        return null;
      }

      // Extract specific evidence using resilientOpenAI with focused prompt - EXACT Legal/Clinical pattern
      const response = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an IP analysis expert. Extract specific evidence related to the given question from the document content. Focus on IP-related data, patent information, trademark details, and specific intellectual property information. Always respond with valid JSON only.`
          },
          {
            role: "user",
            content: `
QUESTION: ${question.question}
ANALYSIS FOCUS: ${question.analysisPrompt}

DOCUMENT: ${doc.name}
CONTENT: ${content.slice(0, 6000)}

Extract specific IP-related evidence for this question. Provide exact quotes, specific findings, and numerical data where available.

CRITICAL: Respond with ONLY valid JSON in this exact format (no additional text):
{
  "relevantContent": ["exact quote 1", "exact quote 2"],
  "keyFindings": ["specific finding 1", "specific finding 2"],
  "confidence": 85
}

If no relevant content is found, respond with:
{
  "relevantContent": [],
  "keyFindings": [],
  "confidence": 0
}`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000
      }, {
        maxRetries: 3,
        timeout: 90000
      });

      const content_response = response.choices[0].message.content;
      if (!content_response) {
        return null;
      }

      let result;
      try {
        // Clean the response to ensure it's valid JSON
        const cleanedResponse = content_response.trim();
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
        
        if (jsonStart === -1 || jsonEnd === 0) {
          console.log(`⚠️ No JSON found in response for ${doc.name}, skipping`);
          return null;
        }
        
        const jsonOnly = cleanedResponse.slice(jsonStart, jsonEnd);
        result = JSON.parse(jsonOnly);
      } catch (parseError) {
        console.log(`⚠️ JSON parse error for ${doc.name}: ${(parseError as Error).message}, skipping`);
        console.log(`📄 Raw response: ${content_response?.substring(0, 200)}...`);
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
    console.log(`🔄 BATCHED COMPILATION: Starting IP analysis for "${question.question}" with ${evidence.length} documents`);
    
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

    // 🚀 SMART BATCHING: Create batches based on token count, not fixed size
    const MAX_BATCH_TOKENS = 6000; // Conservative limit (leaves room for prompt + response)
    const batches = [];
    let currentBatch: any[] = [];
    let currentBatchTokens = 0;
    
    for (const ev of evidence) {
      const evTokens = resilientOpenAI.countBatchTokens([ev]);
      
      // If adding this evidence would exceed limit, start new batch
      if (currentBatchTokens + evTokens > MAX_BATCH_TOKENS && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [ev];
        currentBatchTokens = evTokens;
      } else {
        currentBatch.push(ev);
        currentBatchTokens += evTokens;
      }
    }
    
    // Add final batch if not empty
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    console.log(`📦 Processing ${evidence.length} documents in ${batches.length} token-optimized batches`);
    
    // Step 1: Get partial answers from each batch
    const partialAnswers = [];
    const partialResultsKey = `ip-partial-${question.id}`;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing IP batch ${i + 1}/${batches.length} (${batch.length} documents)`);
      
      const batchPrompt = `You are a senior IP analyst. Analyze evidence from ${batch.length} documents to answer: "${question.question}"

Evidence:
${batch.map(ev => {
  // CRITICAL FIX: Use fullContent (AI summary) as fallback when relevantContent is empty
  const content = Array.isArray(ev.relevantContent) && ev.relevantContent.length > 0
    ? ev.relevantContent.join('; ')
    : ev.fullContent || ev.documentSummary || 'No content available';
  
  const findings = Array.isArray(ev.keyFindings) && ev.keyFindings.length > 0
    ? ev.keyFindings.join('; ')
    : 'See content above';
  
  return `
DOCUMENT: ${ev.documentName}
AI SUMMARY CONTENT: ${content}
KEY FINDINGS: ${findings}`;
}).join('\n')}

CRITICAL: Extract ALL specific IP details from the AI SUMMARY CONTENT above (patents, trademarks, filing dates, claims). Respond in JSON:
{
  "answer": "Detailed extraction with specific IP data and details from the AI summaries",
  "confidence": 0-100,
  "keyFindings": ["Specific finding 1", "Specific finding 2"],
  "sources": ["doc1", "doc2"]
}`;

      try {
        // Use resilient client with retry and timeout
        const response = await resilientOpenAI.createChatCompletion({
          model: "gpt-4o",
          messages: [{ role: "user", content: batchPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 8000
        }, {
          maxRetries: 4,
          timeout: 120000, // 2 minutes per batch
          onRetry: (attempt, error) => {
            console.warn(`🔄 Retrying IP batch ${i + 1}/${batches.length} (attempt ${attempt}): ${error.message}`);
          }
        });
        
        const batchAnswer = JSON.parse(response.choices[0].message.content || '{}');
        partialAnswers.push(batchAnswer);
        
        // 💾 PERSISTENCE: Save partial results after each batch
        if (!global[partialResultsKey]) {
          global[partialResultsKey] = [];
        }
        global[partialResultsKey].push(batchAnswer);
        
        console.log(`✅ IP Batch ${i + 1}/${batches.length} completed and saved`);
      } catch (error: any) {
        console.error(`❌ Error in IP batch ${i + 1}:`, error);
        const errorAnswer = {
          answer: `Error processing batch ${i + 1}: ${error.message}`,
          confidence: 0,
          keyFindings: [],
          sources: batch.map(e => e.documentName)
        };
        partialAnswers.push(errorAnswer);
        
        // Save error results too
        if (!global[partialResultsKey]) {
          global[partialResultsKey] = [];
        }
        global[partialResultsKey].push(errorAnswer);
      }
    }
    
    // Step 2: Synthesize all partial answers into final comprehensive answer
    console.log(`🔄 Synthesizing ${partialAnswers.length} IP partial answers into final answer`);
    
    const synthesisPrompt = `You are a senior IP analyst. Synthesize these partial analyses into ONE comprehensive answer for: "${question.question}"

Partial Analyses:
${partialAnswers.map((pa, i) => `
BATCH ${i + 1}:
${pa.answer}
KEY FINDINGS: ${pa.keyFindings?.join('; ') || 'None'}
`).join('\n')}

CRITICAL: Create ONE comprehensive answer that:
1. Extracts ALL specific details (patents, trademarks, filing dates, claims) from all batches
2. Lists ALL IP assets with complete details
3. Provides exhaustive breakdown of IP portfolio, protection status, and risks
4. Cites specific document sections and IP data points

FORMAT REQUIREMENTS FOR "answer" FIELD:
- Use markdown bullets (•) for lists of evidence/findings
- Use **bold** for key terms, patent numbers, filing dates, and inventor names
- Structure with clear sections if multiple topics
- Example: "• **Patent US123456**: Filed **Jan 2023** by **John Smith**, covers **AI-based diagnostic method** with **15 claims**"

Respond in JSON:
{
  "answer": "Comprehensive synthesis with ALL specific IP details formatted with markdown bullets and bold for key terms",
  "confidence": 0-100,
  "keyFindings": ["All key findings combined"],
  "evidenceSummary": "Summary of all evidence",
  "ipAssessment": "Overall IP assessment",
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    try {
      // Use resilient client for final synthesis with extended timeout
      const response = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: synthesisPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 16000
      }, {
        maxRetries: 5,
        timeout: 300000, // 5 minutes for synthesis (increased for large document sets)
        onRetry: (attempt, error) => {
          console.warn(`🔄 Retrying IP final synthesis for "${question.question}" (attempt ${attempt}): ${error.message}`);
        }
      });

      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log(`✅ IP Final synthesis completed for "${question.question}"`);
      
      // 🧹 CLEANUP: Remove partial results cache after successful synthesis
      if (global[partialResultsKey]) {
        delete global[partialResultsKey];
        console.log(`🧹 Cleaned up IP partial results cache for ${question.id}`);
      }
      
      return {
        question: question.question,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: compiledAnswer.keyFindings || [],
        evidenceSummary: compiledAnswer.evidenceSummary || 'Evidence compiled from multiple sources',
        ipAssessment: compiledAnswer.ipAssessment || 'Assessment completed',
        recommendations: compiledAnswer.recommendations || []
      };
      
    } catch (synthesisError: any) {
      console.error(`❌ IP Synthesis failed for "${question.question}":`, synthesisError);
      
      // 🔄 FALLBACK: Try to recover from partial results cache
      const cachedPartials = global[partialResultsKey];
      if (cachedPartials && cachedPartials.length > 0) {
        console.log(`📦 IP Synthesis failed, recovering from ${cachedPartials.length} cached partial results`);
        
        // Combine partial answers manually
        const combinedAnswer = cachedPartials
          .map((pa: any, i: number) => `${pa.answer || ''}`)
          .filter((a: string) => a.trim().length > 0)
          .join('\n\n');
        
        const combinedFindings = cachedPartials
          .flatMap((pa: any) => pa.keyFindings || [])
          .filter((f: string) => f && f.trim().length > 0);
        
        return {
          question: question.question,
          answer: combinedAnswer || 'Partial IP analysis recovered from cached results',
          confidence: 60,
          sources: evidence.map(e => e.documentName),
          detailedEvidence: evidence,
          keyFindings: combinedFindings,
          evidenceSummary: `Recovery from ${cachedPartials.length} partial analyses`,
          ipAssessment: 'Partial assessment from cached results',
          recommendations: ['Complete re-analysis recommended for full IP assessment']
        };
      }
      
      // Final fallback if no cache available
      return {
        question: question.question,
        answer: 'Error occurred during IP analysis synthesis',
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: [],
        evidenceSummary: 'Error in analysis compilation',
        ipAssessment: 'Unable to complete assessment due to processing error',
        recommendations: ['Manual IP review recommended due to processing error']
      };
    }
  }

  private async storeComprehensiveResultsWithoutDeletion(dealId: number, ipAnswers: { [key: string]: IpAnswer }, assignedDocuments: any[]): Promise<void> {
    try {
      // Generate findings and recommendations from all answers
      const findings = Object.values(ipAnswers).flatMap(answer => 
        answer.keyFindings.map((finding, index) => ({
          id: Object.keys(ipAnswers).indexOf(Object.keys(ipAnswers).find(key => ipAnswers[key] === answer)!) * 100 + index,
          content: finding,
          type: 'IP Finding'
        }))
      );

      const recommendations = Object.values(ipAnswers).flatMap(answer =>
        answer.recommendations.map((rec, index) => ({
          title: `IP Recommendation ${index + 1}`,
          description: rec,
          priority: 'Medium',
          category: 'IP',
          impact: 'Medium'
        }))
      );

      // Create the new comprehensive analysis - EXACT copy of Financial structure (deletion already done in runComprehensiveAnalysis)
      const analysisData = {
        dealId,
        agentType: 'IP' as const,
        status: 'completed' as const,
        progress: 100,
        findings: findings,
        recommendations: recommendations,
        ip_answers: ipAnswers, // CRITICAL: Use snake_case field name for legacy IP agent - Drizzle handles JSON serialization automatically
        documentSources: assignedDocuments.map((d: any) => d.name),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.insert(agentAnalyses).values([analysisData]);
      
      console.log(`📊 Created fresh comprehensive IP analysis for deal ${dealId} with ${Object.keys(ipAnswers).length} questions answered`);

    } catch (error) {
      console.error('Error storing comprehensive IP results:', error);
      throw error;
    }
  }

  getProgress(): IpAnalysisProgress {
    return {
      isRunning: this.isRunning,
      progress: this.progress,
      message: this.currentStep,
      currentStep: this.currentStep,
      currentQuestion: this.currentQuestion,
      totalSteps: COMPREHENSIVE_IP_QUESTIONS.length
    };
  }

  /**
   * CRITICAL: Delete existing analysis data - EXACT copy of Financial's method
   */
  async deleteExistingAnalysis(dealId: number): Promise<void> {
    try {
      console.log(`🗑️ DELETING existing IP analysis data for deal ${dealId} to ensure fresh start...`);
      await db.delete(agentAnalyses).where(
        and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'IP')
        )
      );
      console.log(`✅ DELETED existing IP analysis data for deal ${dealId}`);
    } catch (error) {
      console.error('Error deleting existing IP analysis:', error);
      throw error;
    }
  }

  /**
   * CRITICAL: runComprehensiveAnalysis method to match Financial architecture exactly
   * This is the method that persistent services expect to call
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string, progressCallback?: Function): Promise<any> {
    console.log(`🔬 runComprehensiveAnalysis called for deal ${dealId}, job ${jobId}`);
    
    try {
      // CRITICAL FIX: Delete existing analysis IMMEDIATELY at start, not at end
      console.log(`🗑️ IMMEDIATELY clearing existing IP analysis for deal ${dealId} to ensure fresh start...`);
      await db.delete(agentAnalyses).where(
        and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'IP')
        )
      );
      console.log(`✅ IMMEDIATELY cleared existing IP analysis for deal ${dealId}`);

      // Set up progress callback if provided
      if (progressCallback) {
        // Mock the existing startComprehensiveAnalysis method behavior but with callbacks
        this.isRunning = true;
        this.progress = 0;
        this.currentStep = 'Initializing IP analysis';
        
        // Start processing
        await progressCallback(8, 'Loading IP documents...');
        
        const assignedDocuments = await this.getAssignedDocuments(dealId);
        console.log(`📄 Found ${assignedDocuments.length} IP documents for analysis`);
        
        await progressCallback(17, 'Processing document batch 1...');
        
        const ipAnswers: { [key: string]: IpAnswer } = {};
        
        // Process each question with micro-step progression
        for (let i = 0; i < COMPREHENSIVE_IP_QUESTIONS.length; i++) {
          const question = COMPREHENSIVE_IP_QUESTIONS[i];
          const questionNumber = i + 1;
          const totalQuestions = COMPREHENSIVE_IP_QUESTIONS.length;
          
          // Calculate progress with exact micro-step formula
          const baseProgress = 17; // Starting progress after document loading
          const questionProgress = Math.floor(((i + 1) / totalQuestions) * 75); // 75% for questions (17% to 92%)
          const currentProgress = baseProgress + questionProgress;
          
          await progressCallback(currentProgress, `Analyzing IP question ${questionNumber}/${totalQuestions}: ${question.question}`);
          
          console.log(`🔍 Question ${questionNumber}/${totalQuestions}: ${question.question}`);
          this.currentQuestion = question.question;
          this.currentStep = `Analyzing: ${question.question}`;
          this.progress = currentProgress;

          // Extract evidence for this specific question
          console.log(`📊 Extracting IP evidence for: ${question.question}`);
          const evidence = await this.extractEvidenceFromAllDocuments(assignedDocuments, question);
          
          // Compile comprehensive answer
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${evidence.length} pieces of evidence`);
          const answer = await this.compileComprehensiveAnswer(question, evidence);
          
          ipAnswers[question.id] = answer;
          console.log(`✅ Completed question ${questionNumber}/${totalQuestions}: ${question.question}`);
        }

        // Store results
        await progressCallback(95, 'Finalizing IP analysis...');
        await this.storeComprehensiveResultsWithoutDeletion(dealId, ipAnswers, assignedDocuments);

        // Final completion
        this.progress = 100;
        this.currentStep = 'IP analysis completed';
        await progressCallback(100, 'IP analysis completed successfully');
        
        console.log(`✅ Comprehensive IP analysis completed for deal ${dealId}`);
        return ipAnswers;
      } else {
        // Fall back to original method if no callback provided
        await this.startComprehensiveAnalysis(dealId, jobId);
      }

    } catch (error) {
      console.error('Error in comprehensive IP analysis:', error);
      this.isRunning = false;
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Question rerun progress tracking (in-memory)
  private questionRerunProgress: Map<string, number> = new Map();

  async isQuestionRunning(dealId: number, questionId: string): Promise<boolean> {
    const key = `${dealId}-${questionId}`;
    return this.questionRerunProgress.has(key) && this.questionRerunProgress.get(key)! < 100;
  }

  async updateQuestionRerunProgress(dealId: number, questionId: string, progress: number): Promise<void> {
    const key = `${dealId}-${questionId}`;
    this.questionRerunProgress.set(key, progress);
    
    const jobId = `ip-question-rerun-${dealId}-${questionId}`;
    
    if (progress === 0) {
      await storage.createBackgroundJob({
        jobId, 
        jobType: 'ip_question_rerun', 
        dealId, 
        agentType: 'IP', 
        status: 'processing', 
        progress, 
        currentStep: 'Starting question rerun...'
      });
    } else if (progress >= 100) {
      await storage.updateBackgroundJob(jobId, { progress, currentStep: 'Completed' });
      setTimeout(() => this.questionRerunProgress.delete(key), 5000);
    } else {
      await storage.updateBackgroundJob(jobId, { progress, currentStep: 'Processing' });
    }
  }

  getAllQuestionProgress(dealId: number): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, progress] of Array.from(this.questionRerunProgress.entries())) {
      if (key.startsWith(`${dealId}-`)) {
        const questionId = key.substring(`${dealId}-`.length);
        result[questionId] = progress;
      }
    }
    return result;
  }

  async getQuestionRerunProgress(dealId: number, questionId: string): Promise<number> {
    const key = `${dealId}-${questionId}`;
    return this.questionRerunProgress.get(key) || 0;
  }

  async rerunSingleQuestion(dealId: number, questionId: string): Promise<void> {
    try {
      const analysis = await storage.getAgentAnalysis(dealId, 'IP');
      
      if (!analysis) throw new Error('No IP analysis found');
      
      const documents = await storage.getDocumentsByDealId(dealId);
      const ipDocs = documents.filter(doc => 
        doc.assignedAgents?.some(a => a.toLowerCase() === 'ip')
      );
      
      const question = COMPREHENSIVE_IP_QUESTIONS.find(q => q.id === questionId);
      if (!question) throw new Error(`Question ${questionId} not found`);
      
      await this.updateQuestionRerunProgress(dealId, questionId, 10);
      
      // Extract evidence for this question
      const evidence = await this.extractEvidenceFromAllDocuments(ipDocs, question);
      
      await this.updateQuestionRerunProgress(dealId, questionId, 50);
      
      // Compile answer
      const answer = await this.compileComprehensiveAnswer(question, evidence);
      
      await this.updateQuestionRerunProgress(dealId, questionId, 80);
      
      // Update analysis
      const updatedAnswers = {
        ...(analysis.ip_answers || {}),
        [questionId]: answer
      };
      
      await storage.updateAnalysis(analysis.id, {
        ip_answers: updatedAnswers
      });
      
      await this.updateQuestionRerunProgress(dealId, questionId, 100);
    } catch (error) {
      console.error('Error in IP question rerun:', error);
      throw error;
    }
  }
}

// Export singleton instance exactly like Financial
export const comprehensiveIpAnalysisService = new ComprehensiveIpAnalysisService();