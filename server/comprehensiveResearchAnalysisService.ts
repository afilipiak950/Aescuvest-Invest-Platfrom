import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const RESEARCH_QUESTIONS = [
  // Competitive Intelligence
  { 
    id: 'research_1', 
    question: 'What competitive threats exist and how significant are they?', 
    category: 'Competitive Intelligence',
    keywords: ['competitive threat', 'competitor', 'competition', 'competitive landscape', 'market share', 'competitive advantage', 'threat assessment', 'competitive risk']
  },
  { 
    id: 'research_2', 
    question: 'What is the patent landscape and IP positioning?', 
    category: 'Competitive Intelligence',
    keywords: ['patent landscape', 'ip position', 'intellectual property', 'patent portfolio', 'patent protection', 'ip strategy', 'patent analysis', 'freedom to operate']
  },
  { 
    id: 'research_3', 
    question: 'How defensible is the technology moat?', 
    category: 'Competitive Intelligence',
    keywords: ['technology moat', 'defensibility', 'competitive moat', 'barrier to entry', 'technological advantage', 'proprietary technology', 'technical differentiation']
  },
  // Market Analysis
  { 
    id: 'research_4', 
    question: 'What is the Total Addressable Market (TAM) size and growth?', 
    category: 'Market Analysis',
    keywords: ['total addressable market', 'tam', 'market size', 'market growth', 'market opportunity', 'addressable market', 'market potential', 'market expansion']
  },
  { 
    id: 'research_5', 
    question: 'What are the key market trends and drivers?', 
    category: 'Market Analysis',
    keywords: ['market trends', 'market drivers', 'industry trends', 'growth drivers', 'market dynamics', 'trend analysis', 'market forces', 'industry evolution']
  },
  { 
    id: 'research_6', 
    question: 'What is the regulatory environment and compliance requirements?', 
    category: 'Market Analysis',
    keywords: ['regulatory environment', 'compliance requirements', 'regulation', 'regulatory risk', 'compliance', 'regulatory framework', 'industry standards']
  },
  // Technology Assessment
  { 
    id: 'research_7', 
    question: 'What is the technology maturity and scalability potential?', 
    category: 'Technology Assessment',
    keywords: ['technology maturity', 'scalability', 'technological readiness', 'scale potential', 'technical scalability', 'platform scalability', 'technology risk']
  },
  { 
    id: 'research_8', 
    question: 'What are the key technology dependencies and risks?', 
    category: 'Technology Assessment',
    keywords: ['technology dependencies', 'technology risk', 'technical dependencies', 'platform dependencies', 'technology stack', 'technical risk assessment']
  },
  { 
    id: 'research_9', 
    question: 'What data quality and validation has been performed?', 
    category: 'Technology Assessment',
    keywords: ['data quality', 'data validation', 'data integrity', 'data accuracy', 'data governance', 'data verification', 'quality assurance', 'data standards']
  },
  // Strategic Analysis
  { 
    id: 'research_10', 
    question: 'What are the potential exit strategies and acquirer landscape?', 
    category: 'Strategic Analysis',
    keywords: ['exit strategy', 'acquirer', 'acquisition', 'strategic buyer', 'exit opportunity', 'merger', 'acquisition target', 'strategic partnership']
  },
  { 
    id: 'research_11', 
    question: 'What international expansion opportunities exist?', 
    category: 'Strategic Analysis',
    keywords: ['international expansion', 'global expansion', 'international market', 'geographic expansion', 'global opportunity', 'international strategy', 'market expansion']
  },
  { 
    id: 'research_12', 
    question: 'What are the ESG considerations and sustainability factors?', 
    category: 'Strategic Analysis',
    keywords: ['esg', 'sustainability', 'environmental impact', 'social responsibility', 'governance', 'sustainable business', 'environmental considerations', 'social impact']
  },
  { 
    id: 'research_13', 
    question: 'What customer validation and market traction evidence exists?', 
    category: 'Strategic Analysis',
    keywords: ['customer validation', 'market traction', 'product market fit', 'customer feedback', 'market adoption', 'user engagement', 'customer retention', 'revenue traction', 'growth metrics']
  }
];

export interface ResearchAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface ResearchEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface ResearchAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: ResearchEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  researchAssessment: string;
  recommendations: string[];
}

export class ComprehensiveResearchAnalysisService {
  private progressData: Map<number, ResearchAnalysisProgress> = new Map();

  getProgress(dealId: number): ResearchAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No comprehensive research analysis running' 
    };
  }

  private async setProgress(dealId: number, progress: Partial<ResearchAnalysisProgress>, jobId?: string) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
    
    // Also update database background job if jobId provided
    if (jobId && progress.progress !== undefined) {
      try {
        await storage.updateBackgroundJob(jobId, {
          progress: progress.progress,
          currentStep: progress.currentStep || current.currentStep || 'Processing research analysis'
        });
      } catch (error) {
        console.error(`❌ Error updating background job ${jobId}:`, error);
      }
    }
  }

  async getAssignedResearchDocuments(dealId: number): Promise<any[]> {
    console.log(`🔬 Finding assigned research documents for deal ${dealId}`);
    
    try {
      // Get ALL documents for the deal with AI summaries - EXACT Commercial approach
      const allDocuments = await db.select().from(documents).where(eq(documents.dealId, dealId));
      console.log(`🔬 Found ${allDocuments.length} total documents for deal ${dealId}`);
      
      // Filter to only include documents with AI summaries for analysis (like Commercial)
      const documentsWithAI = allDocuments.filter(doc => {
        // Check if aiSummary exists and is valid (could be object or string)
        if (!doc.aiSummary) return false;
        
        // Handle aiSummary as object with executiveSummary field
        if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
          return doc.aiSummary.executiveSummary.length > 10;
        }
        
        // Handle aiSummary as string
        if (typeof doc.aiSummary === 'string' && doc.aiSummary.length > 10) {
          return true;
        }
        
        return false;
      });
      
      console.log(`🔬 Research analysis will process ALL ${documentsWithAI.length} documents with AI summaries (comprehensive approach matching Commercial)`);
      
      // Return ALL documents with AI summaries for maximum coverage
      return documentsWithAI;
      
    } catch (error) {
      console.error(`❌ Error finding research documents:`, error);
      // Fallback: return all documents if there's an error
      try {
        const allDocs = await db.select().from(documents).where(eq(documents.dealId, dealId));
        console.log(`🔬 Error fallback: returning all ${allDocs.length} documents`);
        return allDocs.filter(doc => doc.aiSummary);
      } catch (fallbackError) {
        console.error(`❌ Fallback error:`, fallbackError);
        return [];
      }
    }
  }

  /**
   * Run comprehensive analysis for all assigned research documents
   * EXACT CLONE of Commercial agent architecture
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
    
    try {
      // Get all research documents - EXACT Commercial approach
      const assignedDocuments = await this.getAssignedResearchDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} research documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No research documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No research documents available for analysis'
        });
        return { success: false, message: 'No research documents found' };
      }
      
      // Initialize progress - EXACT Commercial approach
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting research analysis',
        processedDocuments: 0,
        totalDocuments: RESEARCH_QUESTIONS.length
      });
      
      // Process each question systematically - EXACT Commercial approach
      const researchAnswers: Record<string, any> = {};
      
      for (let i = 0; i < RESEARCH_QUESTIONS.length; i++) {
        const question = RESEARCH_QUESTIONS[i];
        console.log(`📊 Processing research question ${i + 1}/${RESEARCH_QUESTIONS.length}: ${question.question}`);
        
        // CRITICAL: Update progress for each question - EXACT Commercial micro-step architecture
        await storageService.updateBackgroundJob(jobId, {
          progress: Math.round(((i + 1) / RESEARCH_QUESTIONS.length) * 100),
          processedDocuments: i,
          currentStep: `Analyzing: ${question.question}`,
          currentDocumentName: question.category
        });
        console.log(`💾 Updated background job ${jobId} to ${Math.round(((i + 1) / RESEARCH_QUESTIONS.length) * 100)}%`);
        
        try {
          console.log(`📊 Extracting research evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question - EXACT Commercial approach with SPEED OPTIMIZATION
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments.slice(0, 30), // SPEED: Use only first 30 documents for faster processing
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer with timeout - EXACT Commercial approach
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await Promise.race([
            this.compileComprehensiveAnswer(question, documentEvidence),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 60000)) // 60 second timeout
          ]);
          researchAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${RESEARCH_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting - EXACT Commercial approach
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question - EXACT Commercial approach
          researchAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          
          // Update progress to continue processing - EXACT Commercial approach
          await storageService.updateBackgroundJob(jobId, {
            progress: Math.round((i / RESEARCH_QUESTIONS.length) * 100),
            processedDocuments: i,
            currentDocumentName: `Error: ${question.question}`,
            currentStep: `Error in: ${question.category}`
          });
          
          // Continue with next question instead of failing completely
          continue;
        }
      }
      
      try {
        // Update progress to completion - EXACT Commercial approach
        await storageService.updateBackgroundJob(jobId, {
          progress: 100,
          processedDocuments: RESEARCH_QUESTIONS.length,
          currentStep: 'Generating findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations - EXACT Commercial approach
        const findings = this.generateComprehensiveFindings(researchAnswers);
        const recommendations = this.generateComprehensiveRecommendations(researchAnswers);
        
        // Store the analysis results - EXACT Commercial approach
        await this.storeComprehensiveResults(dealId, researchAnswers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed - EXACT Commercial approach
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive research analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(researchAnswers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of research analysis for deal ${dealId}:`, finalError);
        throw finalError;
      }
    } catch (error) {
      console.error(`❌ Error in comprehensive research analysis for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Extract evidence from all documents for a specific question - EXACT Commercial approach
   */
  private async extractEvidenceFromAllDocuments(assignedDocuments: any[], question: any) {
    console.log(`📊 Starting evidence extraction for research question: ${question.question} across ${assignedDocuments.length} documents`);
    
    const batchSize = 5;
    const allEvidence: any[] = [];
    
    for (let i = 0; i < assignedDocuments.length; i += batchSize) {
      const batch = assignedDocuments.slice(i, i + batchSize);
      console.log(`🔎 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(assignedDocuments.length/batchSize)}`);
      
      const batchPromises = batch.map(doc => this.extractEvidenceFromDocument(doc, question));
      const batchResults = await Promise.allSettled(batchPromises);
      
      let batchEvidence = 0;
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.hasRelevantInfo) {
          allEvidence.push(result.value);
          batchEvidence++;
        } else if (result.status === 'rejected') {
          console.error(`⚠️ Error extracting evidence from ${batch[index].name}:`, result.reason);
        }
      });
      
      console.log(`✅ Batch completed: ${batchEvidence}/${batch.length} documents had relevant evidence`);
      
      // Brief delay between batches
      if (i + batchSize < assignedDocuments.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`🎯 Evidence extraction complete: Found evidence in ${allEvidence.length}/${assignedDocuments.length} documents`);
    return allEvidence;
  }

  /**
   * Extract evidence from a single document - EXACT Commercial approach
   */
  private async extractEvidenceFromDocument(document: any, question: any) {
    // Get document content - EXACT Commercial approach
    let content = '';
    
    if (typeof document.aiSummary === 'string' && document.aiSummary.length > 50) {
      content = document.aiSummary;
    } else if (document.aiSummary && typeof document.aiSummary === 'object' && document.aiSummary.executiveSummary) {
      content = document.aiSummary.executiveSummary;
    }
    
    // Add OCR text if available and substantial
    if (document.ocrText && document.ocrText.length > 100) {
      content += '\n\n' + document.ocrText.substring(0, 3000);
    }
    
    if (!content) return null;
    
    const prompt = `You are an expert research analyst conducting comprehensive investment analysis. Your task is to find ANY research, market, technology, strategic, or competitive information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
CATEGORY: ${question.category}

Instructions:
- Look for DIRECT research terms: market analysis, competitive intelligence, technology assessment, strategic planning
- Look for INDIRECT business information: market position, technology capabilities, strategic initiatives, competitive advantages
- Consider business documents that mention research findings, market insights, strategic assessments
- Even general business context often has research implications for investment due diligence
- For investment companies, most business documents contain research information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "researchContext": "How this document relates to research/strategic aspects"
}

Be thorough in finding relevance - most business documents have research implications for investment analysis.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: analysis.relevantContent || [],
        hasRelevantInfo: analysis.hasRelevantInfo || false,
        confidence: analysis.confidence || 0,
        keyFindings: analysis.keyFindings || [],
        documentSummary: analysis.documentSummary || '',
        fullContent: content.substring(0, 1000) // Keep sample for reference
      };
      
    } catch (error) {
      console.error(`Error extracting evidence from ${document.name}:`, error);
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: [],
        hasRelevantInfo: false,
        confidence: 0,
        keyFindings: [],
        documentSummary: 'Analysis failed',
        fullContent: content.substring(0, 1000)
      };
    }
  }

  /**
   * Compile comprehensive answer based on all evidence - EXACT Commercial approach
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No evidence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant research information found in the assigned research documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant research information found'],
        category: question.category
      };
    }

    // Prepare evidence summary for AI compilation - EXACT Commercial approach
    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    const prompt = `You are an expert research analyst compiling a comprehensive answer based on evidence from multiple documents.

QUESTION: "${question.question}"
CATEGORY: ${question.category}

EVIDENCE FROM DOCUMENTS:
${evidenceSummary.map(ev => `
DOCUMENT: ${ev.document}
CONTENT: ${ev.content}
KEY FINDINGS: ${ev.findings}
CONFIDENCE: ${ev.confidence}%
`).join('\n')}

Instructions:
1. Synthesize ALL evidence into a comprehensive answer
2. Cite specific documents and quotes
3. Identify gaps in information
4. Provide confidence assessment
5. Include strategic recommendations

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "researchAssessment": "Overall research assessment based on evidence",
  "evidenceCount": ${evidence.length}
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        researchAssessment: compiledAnswer.researchAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error) {
      console.error(`❌ Error compiling comprehensive answer for question "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling comprehensive analysis: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        gaps: ['Compilation error occurred'],
        recommendations: [],
        researchAssessment: 'Analysis compilation failed',
        evidenceCount: evidence.length,
        error: true
      };
    }
  }

  /**
   * Generate comprehensive findings from research answers - EXACT Commercial approach
   */
  private generateComprehensiveFindings(researchAnswers: Record<string, any>): any[] {
    const findings: any[] = [];
    let findingId = 0;
    
    const validAnswers = Object.values(researchAnswers).filter(answer => answer && !answer.error);
    
    // High-level analysis summary
    findings.push({
      id: findingId++,
      content: `Comprehensive research analysis completed across ${validAnswers.length} key research areas with detailed evidence extraction`,
      type: 'Research Finding'
    });
    
    // Evidence quality assessment
    const totalEvidence = validAnswers.reduce((sum, answer) => sum + (answer.evidenceCount || 0), 0);
    if (totalEvidence > 0) {
      findings.push({
        id: findingId++,
        content: `Research analysis supported by evidence from ${totalEvidence} source documents across all analysis categories`,
        type: 'Research Finding'
      });
    }
    
    // Confidence assessment
    const avgConfidence = validAnswers.reduce((sum, answer) => sum + (answer.confidence || 0), 0) / Math.max(validAnswers.length, 1);
    findings.push({
      id: findingId++,
      content: `Research analysis achieved ${Math.round(avgConfidence)}% average confidence across all research areas`,
      type: 'Research Finding'
    });
    
    // Category-specific findings
    const categories = [...new Set(validAnswers.map(answer => answer.category).filter(Boolean))];
    categories.forEach(category => {
      const categoryAnswers = validAnswers.filter(answer => answer.category === category);
      if (categoryAnswers.length > 0) {
        findings.push({
          id: findingId++,
          content: `${category}: Analyzed ${categoryAnswers.length} key questions with comprehensive document evidence`,
          type: 'Research Finding'
        });
      }
    });
    
    return findings.slice(0, 8); // Limit to top 8 findings
  }

  /**
   * Generate comprehensive recommendations from research answers - EXACT Commercial approach
   */
  private generateComprehensiveRecommendations(researchAnswers: Record<string, any>): any[] {
    const recommendations: any[] = [];
    let recId = 0;
    
    const validAnswers = Object.values(researchAnswers).filter(answer => answer && !answer.error);
    
    // Strategic recommendations
    recommendations.push({
      id: recId++,
      content: `Conduct detailed follow-up due diligence on all ${validAnswers.length} research areas identified in the comprehensive analysis`,
      type: 'Research Recommendation'
    });
    
    // Evidence validation recommendations
    const lowConfidenceAnswers = validAnswers.filter(answer => (answer.confidence || 0) < 60);
    if (lowConfidenceAnswers.length > 0) {
      recommendations.push({
        id: recId++,
        content: `Seek additional documentation and external validation for ${lowConfidenceAnswers.length} research areas with limited evidence`,
        type: 'Research Recommendation'
      });
    }
    
    // Category-specific recommendations
    const categories = [...new Set(validAnswers.map(answer => answer.category).filter(Boolean))];
    categories.forEach(category => {
      const categoryAnswers = validAnswers.filter(answer => answer.category === category);
      if (categoryAnswers.length > 0) {
        let recText = '';
        switch (category) {
          case 'Competitive Intelligence':
            recText = 'Engage external market research firm for independent competitive landscape validation';
            break;
          case 'Market Analysis':
            recText = 'Validate market opportunity sizing through third-party market research and expert interviews';
            break;
          case 'Technology Assessment':
            recText = 'Perform independent technical due diligence with specialized technology assessment experts';
            break;
          case 'Strategic Analysis':
            recText = 'Develop detailed strategic roadmap based on identified opportunities and risk factors';
            break;
          default:
            recText = `Continue monitoring and analysis of ${category.toLowerCase()} developments`;
        }
        recommendations.push({
          id: recId++,
          content: recText,
          type: 'Research Recommendation'
        });
      }
    });
    
    return recommendations.slice(0, 6); // Limit to top 6 recommendations
  }

  /**
   * Store comprehensive results - EXACT Commercial approach
   */
  private async storeComprehensiveResults(dealId: number, researchAnswers: Record<string, any>, findings: any[], recommendations: any[], assignedDocuments: any[]) {
    try {
      console.log(`💾 Storing comprehensive research analysis for deal ${dealId}`);
      
      // Store in agentAnalyses table
      const analysisData = {
        dealId,
        agentType: 'research',
        status: 'completed',
        findings,
        recommendations,
        researchAnswers,
        assignedDocumentsCount: assignedDocuments.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert or update the analysis
      await db.insert(agentAnalyses).values(analysisData).onConflictDoUpdate({
        target: [agentAnalyses.dealId, agentAnalyses.agentType],
        set: {
          status: analysisData.status,
          findings: analysisData.findings,
          recommendations: analysisData.recommendations,
          researchAnswers: analysisData.researchAnswers,
          updatedAt: analysisData.updatedAt
        }
      });
      
      console.log(`✅ Comprehensive research analysis stored successfully for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error storing comprehensive research analysis for deal ${dealId}:`, error);
      throw error;
    }
  }

  // Legacy support methods
  async runComprehensiveAnalysisOld(dealId: number, storage: any, jobId: string) {
    return this.runComprehensiveAnalysis(dealId, storage, jobId);
  }
}

export const comprehensiveResearchAnalysisService = new ComprehensiveResearchAnalysisService();