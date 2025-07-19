/**
 * Comprehensive IP Analysis Service
 * Provides comprehensive intellectual property analysis for all assigned IP documents
 */

import { storage } from './storage';
import { db } from './db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Comprehensive IP questions covering all intellectual property areas
const IP_QUESTIONS = [
  {
    id: 'patents_1',
    category: 'Patent Portfolio',
    question: 'What patents are owned or pending?',
    analysisPrompt: 'Find patent applications, granted patents, patent numbers, filing dates, and patent families.'
  },
  {
    id: 'patents_2',
    category: 'Patent Portfolio',
    question: 'What is the patent landscape and freedom to operate?',
    analysisPrompt: 'Analyze patent strength, enforceability, freedom to operate, and competitive patent landscape.'
  },
  {
    id: 'trademarks_1',
    category: 'Trademarks & Brands',
    question: 'What trademarks and brand assets exist?',
    analysisPrompt: 'Identify registered trademarks, brand names, logos, and trademark applications.'
  },
  {
    id: 'trademarks_2',
    category: 'Trademarks & Brands',
    question: 'Are there any trademark conflicts or risks?',
    analysisPrompt: 'Look for trademark disputes, infringement risks, and brand protection issues.'
  },
  {
    id: 'trade_secrets_1',
    category: 'Trade Secrets & Know-how',
    question: 'What trade secrets and proprietary knowledge exist?',
    analysisPrompt: 'Identify proprietary processes, formulas, algorithms, and confidential information.'
  },
  {
    id: 'trade_secrets_2',
    category: 'Trade Secrets & Know-how',
    question: 'Are trade secrets properly protected?',
    analysisPrompt: 'Assess trade secret protection measures, NDAs, and employee confidentiality agreements.'
  },
  {
    id: 'licenses_1',
    category: 'IP Licenses & Agreements',
    question: 'What IP licenses are in place?',
    analysisPrompt: 'Find inbound and outbound IP licenses, licensing agreements, and royalty obligations.'
  },
  {
    id: 'licenses_2',
    category: 'IP Licenses & Agreements',
    question: 'Are there any IP licensing risks or dependencies?',
    analysisPrompt: 'Analyze licensing terms, restrictions, dependencies, and termination risks.'
  },
  {
    id: 'ownership_1',
    category: 'IP Ownership & Assignment',
    question: 'Is IP ownership clear and properly assigned?',
    analysisPrompt: 'Review IP assignment agreements, inventor assignments, and ownership disputes.'
  },
  {
    id: 'ownership_2',
    category: 'IP Ownership & Assignment',
    question: 'Are there any IP ownership issues or disputes?',
    analysisPrompt: 'Identify joint ownership, disputed ownership, or incomplete assignments.'
  },
  {
    id: 'infringement_1',
    category: 'IP Infringement & Enforcement',
    question: 'Are there any IP infringement issues?',
    analysisPrompt: 'Look for patent infringement, trademark infringement, or copyright violations.'
  },
  {
    id: 'infringement_2',
    category: 'IP Infringement & Enforcement',
    question: 'What is the IP enforcement strategy and history?',
    analysisPrompt: 'Analyze IP enforcement actions, litigation history, and defensive strategies.'
  },
  {
    id: 'regulatory_1',
    category: 'Regulatory & Compliance',
    question: 'What regulatory approvals affect IP?',
    analysisPrompt: 'Find FDA approvals, data exclusivity, market exclusivity, and regulatory protections.'
  },
  {
    id: 'regulatory_2',
    category: 'Regulatory & Compliance',
    question: 'Are there any IP-related compliance issues?',
    analysisPrompt: 'Review patent term extensions, regulatory filing requirements, and compliance obligations.'
  }
];

export class ComprehensiveIpAnalysisService {
  private progressData = new Map<number, any>();

  getProgress(dealId: number) {
    return this.progressData.get(dealId) || {
      isRunning: false,
      progress: 0,
      message: 'No comprehensive IP analysis running'
    };
  }

  private setProgress(dealId: number, progress: any) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
  }

  async startComprehensiveAnalysis(dealId: number): Promise<void> {
    console.log(`⚖️ Starting comprehensive IP analysis for deal ${dealId}`);
    
    // Create background job for progress tracking (same as Legal)
    const jobId = `ip_analysis_${dealId}_${Date.now()}`;
    
    try {
      await storage.createBackgroundJob({
        jobId,
        jobType: 'comprehensive_ip_analysis',
        dealId,
        agentType: 'IP',
        status: 'processing',
        progress: 0,
        totalDocuments: 0,
        processedDocuments: 0,
        startedAt: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to create background job for deal ${dealId}:`, error);
      throw new Error(`Failed to initialize comprehensive IP analysis: ${error.message}`);
    }
    
    this.setProgress(dealId, {
      isRunning: true,
      progress: 5,
      message: 'Initializing comprehensive IP analysis...',
      currentStep: 'Finding IP documents',
      totalSteps: IP_QUESTIONS.length
    });

    try {
      // Get all documents suitable for IP analysis
      const ipDocs = await this.getAssignedIpDocuments(dealId);
      console.log(`⚖️ Found ${ipDocs.length} IP documents for analysis`);

      if (ipDocs.length === 0) {
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          error: 'No IP documents available for analysis'
        });
        this.setProgress(dealId, {
          isRunning: false,
          progress: 100,
          message: 'No IP documents found for analysis'
        });
        throw new Error('No documents available for IP analysis');
      }
      
      // Update job with total questions to process
      await storage.updateBackgroundJob(jobId, {
        totalDocuments: IP_QUESTIONS.length,
        currentStep: 'Analyzing IP documents across 14 question categories'
      });

      // Process each question comprehensively
      const ipAnswers: Record<string, any> = {};
      
      for (let i = 0; i < IP_QUESTIONS.length; i++) {
        const question = IP_QUESTIONS[i];
        console.log(`⚖️ Processing question ${i + 1}/${IP_QUESTIONS.length}: ${question.question}`);
        
        try {
          // Update progress with error handling (both internal and background job)
          const progress = Math.round((i / IP_QUESTIONS.length) * 100);
          await storage.updateBackgroundJob(jobId, {
            progress,
            processedDocuments: i,
            currentDocumentName: question.question,
            currentStep: `Analyzing: ${question.category}`
          });
          
          this.setProgress(dealId, {
            progress,
            currentStep: `Analyzing: ${question.category}`,
            currentQuestion: question.question
          });

          // Extract evidence from ALL assigned documents for this question
          console.log(`⚖️ Processing ${ipDocs.length} documents for question: ${question.question}`);
          const documentEvidence = await this.extractEvidenceFromAllDocuments(ipDocs, question);

          // Generate comprehensive answer using AI
          const answer = await this.generateComprehensiveAnswer(question, documentEvidence);
          ipAnswers[question.id] = answer;

          console.log(`✅ Completed question ${i + 1}/${IP_QUESTIONS.length}: ${question.question}`);

        } catch (questionError) {
          console.error(`⚖️ Error processing question ${question.question}:`, questionError);
          // Continue with other questions even if one fails
          ipAnswers[question.id] = {
            question: question.question,
            answer: "Error processing this question. Please review manually.",
            confidence: 0,
            sources: [],
            evidenceCount: 0,
            documentsCovered: 0
          };
        }
      }

      // Store results in database (same format as legal analysis)
      await storage.updateBackgroundJob(jobId, {
        progress: 95,
        currentStep: 'Storing IP analysis results...'
      });
      
      this.setProgress(dealId, {
        progress: 95,
        currentStep: 'Storing IP analysis results...'
      });

      // Generate findings and recommendations from IP answers
      const findings = [];
      const recommendations = [];
      
      for (const [questionId, answer] of Object.entries(ipAnswers)) {
        if (answer.keyFindings && answer.keyFindings.length > 0) {
          findings.push(...answer.keyFindings.map(finding => ({
            id: findings.length + 1,
            type: 'positive',
            content: finding,
            source: answer.sources?.[0] || 'IP Analysis',
            confidence: answer.confidence || 85,
            category: questionId,
            evidenceCount: answer.evidenceCount || 0
          })));
        }
        
        if (answer.recommendations && answer.recommendations.length > 0) {
          recommendations.push(...answer.recommendations.map(rec => ({
            id: recommendations.length + 1,
            type: 'ip',
            content: rec,
            source: 'IP Analysis',
            confidence: answer.confidence || 85,
            category: questionId
          })));
        }
      }

      const existingAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'ip');
      
      if (existingAnalysis) {
        await storage.updateAnalysis(existingAnalysis.id, {
          ...existingAnalysis,
          ipAnswers: JSON.stringify(ipAnswers),
          findings: JSON.stringify(findings),
          recommendations: JSON.stringify(recommendations),
          status: 'completed',
          progress: 100,
          questionsAnswered: Object.keys(ipAnswers).length,
          totalQuestions: IP_QUESTIONS.length,
          completionRate: Math.round((Object.keys(ipAnswers).length / IP_QUESTIONS.length) * 100)
        });
      } else {
        await storage.createAnalysis({
          dealId,
          agentType: 'ip',
          status: 'completed',
          progress: 100,
          ipAnswers: JSON.stringify(ipAnswers),
          findings: JSON.stringify(findings),
          recommendations: JSON.stringify(recommendations),
          questionsAnswered: Object.keys(ipAnswers).length,
          totalQuestions: IP_QUESTIONS.length,
          completionRate: Math.round((Object.keys(ipAnswers).length / IP_QUESTIONS.length) * 100),
          createdAt: new Date()
        });
      }

      // Complete the job
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: `IP analysis completed - ${Object.keys(ipAnswers).length} questions analyzed`,
        completedAt: new Date()
      });
      
      this.setProgress(dealId, {
        isRunning: false,
        progress: 100,
        message: `Comprehensive IP analysis completed - ${Object.keys(ipAnswers).length} questions answered`
      });

      console.log(`⚖️ Comprehensive IP analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`⚖️ Error in comprehensive IP analysis:`, error);
      
      // Update background job status to failed
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        currentStep: `Error: ${error.message}`,
        error: error.message
      });
      
      this.setProgress(dealId, {
        isRunning: false,
        progress: 0,
        message: 'IP analysis failed: ' + (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Extract evidence from ALL documents for a specific question
   */
  private async extractEvidenceFromAllDocuments(documents: any[], question: any): Promise<any[]> {
    console.log(`⚖️ Starting evidence extraction from ${documents.length} documents for question: ${question.question}`);
    
    const evidence: any[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documents.length / batchSize);
      
      console.log(`⚖️ Processing batch ${batchNumber}/${totalBatches} (${batch.length} documents)`);
      
      const batchPromises = batch.map(async (doc) => {
        try {
          return await this.extractEvidenceFromDocument(doc, question);
        } catch (error) {
          console.error(`⚖️ Error processing document ${doc.name}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${batchNumber} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }
    
    console.log(`📋 Extracted evidence from ${evidence.length}/${documents.length} documents`);
    return evidence;
  }

  /**
   * Extract specific evidence from a single document
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `You are an intellectual property attorney. Analyze this document for specific IP information.

Question: ${question.question}
Analysis Focus: ${question.analysisPrompt}

Document: ${document.name}
Content: ${content.substring(0, 2000)}

Extract relevant IP information, patent numbers, trademark details, or legal provisions that directly address this question.
Return ONLY specific quotes, facts, or legal references - no interpretation.
If no relevant information exists, return "No relevant content found."

Format your response as specific evidence quotes.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.1
    });

    const relevantContent = response.choices[0].message.content?.trim() || '';
    
    if (relevantContent === "No relevant content found." || relevantContent.length < 10) {
      return null;
    }

    return {
      documentName: document.name,
      relevantContent: [relevantContent],
      confidence: 0.85
    };
  }

  /**
   * Generate comprehensive answer using AI analysis
   */
  private async generateComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: "No relevant information found in the assigned IP documents for this question.",
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        documentsCovered: 0
      };
    }

    const evidenceText = evidence.map(e => 
      `${e.documentName}: ${e.relevantContent.join('; ')}`
    ).join('\n\n');

    const prompt = `You are an intellectual property attorney conducting IP due diligence. Based on the evidence extracted from documents, provide a comprehensive answer to this IP question.

Question: ${question.question}
Category: ${question.category}
Analysis Focus: ${question.analysisPrompt}

Evidence from Documents:
${evidenceText}

Provide a comprehensive IP analysis including:
1. Direct answer to the question based on evidence
2. Key IP findings and legal insights
3. Specific recommendations for IP strategy
4. Assessment of IP risks and opportunities

Format as JSON:
{
  "question": "${question.question}",
  "answer": "comprehensive answer based on evidence",
  "confidence": confidence_score_0_to_100,
  "sources": ["document names"],
  "keyFindings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "evidenceCount": ${evidence.length},
  "documentsCovered": ${evidence.length}
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.2
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
      console.error(`⚖️ Error parsing AI response for question ${question.question}:`, parseError);
      return {
        question: question.question,
        answer: response.choices[0].message.content,
        confidence: 75,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        recommendations: [],
        evidenceCount: evidence.length,
        documentsCovered: evidence.length
      };
    }
  }

  /**
   * Get documents assigned to IP analysis
   */
  private async getAssignedIpDocuments(dealId: number): Promise<any[]> {
    console.log(`⚖️ Getting IP documents for deal ${dealId}`);
    
    // IP keywords for document identification
    const ipKeywords = [
      'patent', 'trademark', 'copyright', 'intellectual', 'property', 'ip',
      'license', 'licensing', 'royalty', 'invention', 'inventor', 'application',
      'granted', 'pending', 'filing', 'prosecution', 'infringement', 'validity',
      'enforcement', 'assignment', 'transfer', 'ownership', 'prior art', 'novelty',
      'obviousness', 'claims', 'specification', 'disclosure', 'trade secret',
      'confidential', 'proprietary', 'know-how', 'technology', 'algorithm'
    ];
    
    const allDocuments = await db.select()
      .from(documents)
      .where(eq(documents.dealId, dealId));

    // Filter documents that contain IP-related content
    const ipDocs = allDocuments.filter(doc => {
      const docName = doc.name.toLowerCase();
      const aiSummary = typeof doc.aiSummary === 'string' 
        ? doc.aiSummary 
        : doc.aiSummary?.executiveSummary || '';
      const content = (docName + ' ' + aiSummary).toLowerCase();
      
      return ipKeywords.some(keyword => content.includes(keyword));
    });

    // If no specific IP documents found, use all documents
    if (ipDocs.length === 0) {
      console.log(`⚖️ No specific IP documents found, using all ${allDocuments.length} documents`);
      return allDocuments;
    }

    console.log(`⚖️ Found ${ipDocs.length} IP documents out of ${allDocuments.length} total`);
    return ipDocs;
  }
}

export const comprehensiveIpAnalysisService = new ComprehensiveIpAnalysisService();

/**
 * Get comprehensive IP analysis results
 */
export async function getComprehensiveIpAnalysisResults(dealId: number) {
  try {
    const analysis = await storage.getAgentAnalysis(dealId, 'ip');
    
    if (!analysis) {
      return {
        success: false,
        error: 'No IP analysis found for this deal'
      };
    }

    return {
      success: true,
      ipAnswers: analysis.ipAnswers ? JSON.parse(analysis.ipAnswers) : {},
      findings: analysis.findings ? JSON.parse(analysis.findings) : [],
      recommendations: analysis.recommendations ? JSON.parse(analysis.recommendations) : [],
      questionsAnswered: analysis.questionsAnswered || 0,
      totalQuestions: analysis.totalQuestions || IP_QUESTIONS.length,
      completionRate: analysis.completionRate || 0
    };
  } catch (error) {
    console.error(`⚖️ Error getting IP analysis results:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}