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

      // Extract specific evidence using OpenAI with focused prompt - matching Financial structure
      const response = await openai.chat.completions.create({
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
        max_tokens: 1200
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

      const rawContent = response.choices[0].message.content || '{}';
      console.log(`🔍 Raw OpenAI response for "${question.question}":`, rawContent.substring(0, 200) + '...');
      
      let result;
      try {
        result = JSON.parse(rawContent);
      } catch (parseError) {
        console.log(`❌ JSON parse failed, attempting to extract JSON from response...`);
        
        // Try to extract JSON from markdown code blocks or fix common issues
        let cleanedContent = rawContent.trim();
        
        // Remove markdown code blocks
        if (cleanedContent.includes('```json')) {
          cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
        } else if (cleanedContent.includes('```')) {
          cleanedContent = cleanedContent.replace(/```\s*/g, '').replace(/```\s*$/g, '');
        }
        
        // Try parsing again
        try {
          result = JSON.parse(cleanedContent);
          console.log(`✅ Successfully parsed cleaned JSON`);
        } catch (secondParseError) {
          console.log(`❌ Second JSON parse failed, using fallback answer`);
          // Create a fallback result based on available evidence
          result = {
            answer: allFindings.length > 0 ? allFindings.join('. ') : 'Analysis completed with available evidence.',
            confidence: evidence.length > 0 ? 75 : 50,
            keyFindings: allFindings.slice(0, 5),
            evidenceSummary: `Analysis based on ${evidence.length} documents with ${allFindings.length} findings.`,
            ipAssessment: `IP assessment completed for: ${question.question}`,
            recommendations: evidence.length > 0 ? ['Review additional documentation for completeness', 'Consider IP protection measures'] : ['Gather more documentation for comprehensive analysis']
          };
        }
      }
      
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
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        ip_answers: JSON.stringify(ipAnswers), // CRITICAL: Use snake_case field name like other agents
        documentSources: JSON.stringify(assignedDocuments.map((d: any) => d.name)),
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
}

// Export singleton instance exactly like Financial
export const comprehensiveIpAnalysisService = new ComprehensiveIpAnalysisService();