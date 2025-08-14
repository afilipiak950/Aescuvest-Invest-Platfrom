import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HR_QUESTIONS = [
  // Team Structure
  { 
    id: 'team_1', 
    question: 'What is the current team size and organizational structure?', 
    category: 'Team Structure',
    keywords: ['team size', 'organizational structure', 'headcount', 'employees', 'staff', 'organization chart', 'reporting structure', 'departments', 'divisions']
  },
  { 
    id: 'team_2', 
    question: 'Are there key person dependencies or single points of failure?', 
    category: 'Team Structure',
    keywords: ['key person', 'dependency', 'single point of failure', 'critical employee', 'succession planning', 'backup', 'knowledge transfer', 'risk management']
  },
  // Leadership Assessment
  { 
    id: 'leadership_1', 
    question: 'What is the leadership experience and track record?', 
    category: 'Leadership Assessment',
    keywords: ['leadership', 'management experience', 'track record', 'previous roles', 'accomplishments', 'executive team', 'founders', 'ceo', 'management team']
  },
  { 
    id: 'leadership_2', 
    question: 'Are there gaps in the leadership team?', 
    category: 'Leadership Assessment',
    keywords: ['leadership gaps', 'missing roles', 'executive search', 'vacant positions', 'organizational needs', 'hiring plans', 'talent gaps']
  },
  // Talent Acquisition
  { 
    id: 'talent_1', 
    question: 'What is the hiring strategy and talent pipeline?', 
    category: 'Talent Acquisition',
    keywords: ['hiring strategy', 'recruitment', 'talent pipeline', 'hiring plans', 'job postings', 'recruiting', 'talent acquisition', 'workforce planning']
  },
  { 
    id: 'talent_2', 
    question: 'How competitive is compensation and benefits?', 
    category: 'Talent Acquisition',
    keywords: ['compensation', 'benefits', 'salary', 'equity', 'stock options', 'competitive pay', 'market rates', 'employee benefits', 'retention']
  },
  // Culture & Retention
  { 
    id: 'culture_1', 
    question: 'What is employee turnover and retention like?', 
    category: 'Culture & Retention',
    keywords: ['employee turnover', 'retention', 'churn', 'attrition', 'employee satisfaction', 'stay interviews', 'exit interviews', 'retention rates']
  },
  { 
    id: 'culture_2', 
    question: 'How strong is company culture and employee engagement?', 
    category: 'Culture & Retention',
    keywords: ['company culture', 'employee engagement', 'culture fit', 'values', 'mission', 'employee survey', 'satisfaction', 'workplace culture', 'team dynamics']
  }
];

interface HRAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: any[];
  keyFindings: string[];
  evidenceSummary: string;
  hrAssessment: string;
  recommendations: string[];
}

interface HREvidence {
  documentName: string;
  documentId: number;
  relevantContent: string[];
  hasRelevantInfo: boolean;
  confidence: number;
  keyFindings: string[];
  documentSummary: string;
  fullContent: string;
}

/**
 * Comprehensive HR Analysis Service - EXACT COPY of Commercial Agent Architecture
 * Every method, pattern, and approach copied exactly from comprehensiveCommercialAnalysisService.ts
 */
class ComprehensiveHRAnalysisService {
  private runningAnalyses = new Map<number, boolean>();

  /**
   * Check if analysis is currently running - EXACT Commercial approach
   */
  isAnalysisRunning(dealId: number): boolean {
    return this.runningAnalyses.get(dealId) || false;
  }

  /**
   * Set analysis running status - EXACT Commercial approach
   */
  setAnalysisRunning(dealId: number, isRunning: boolean): void {
    this.runningAnalyses.set(dealId, isRunning);
  }

  /**
   * Get assigned HR documents for analysis - EXACT Commercial approach
   */
  private async getAssignedHRDocuments(dealId: number): Promise<any[]> {
    try {
      console.log(`📄 Starting HR document assignment for deal ${dealId}`);
      
      const allDocuments = await db
        .select()
        .from(documents)
        .where(eq(documents.dealId, dealId));
      
      console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
      
      // First try documents explicitly assigned to HR agent
      let hrDocuments = allDocuments.filter(doc => 
        (doc.assignedAgents && doc.assignedAgents.includes('HR')) && 
        (doc.ocrText || doc.aiSummary)
      );
      
      console.log(`📄 Documents explicitly assigned to HR: ${hrDocuments.length}`);
      
      // If no documents are explicitly assigned to HR, identify HR-related documents
      if (hrDocuments.length === 0) {
        console.log('📄 No documents explicitly assigned to HR agent, identifying HR-related documents...');
        
        hrDocuments = allDocuments.filter(doc => {
          if (!doc.ocrText && !doc.aiSummary) return false;
          
          const docName = doc.name.toLowerCase();
          const docContent = (doc.ocrText || '').toLowerCase();
          const aiSummary = doc.aiSummary;
          
          // HR document keywords - EXACT Commercial approach
          const hrKeywords = [
            'hr', 'human resources', 'employee', 'staff', 'team', 'personnel',
            'hiring', 'recruitment', 'talent', 'organizational', 'organization',
            'leadership', 'management', 'compensation', 'benefits', 'salary',
            'culture', 'engagement', 'turnover', 'retention', 'headcount',
            'job description', 'org chart', 'reporting structure', 'succession'
          ];
          
          // Check document name and content for HR keywords
          const hasHRKeywords = hrKeywords.some(keyword => 
            docName.includes(keyword) || docContent.includes(keyword)
          );
          
          // Check AI summary for HR document type
          const isHRDocument = aiSummary?.documentType?.toLowerCase().includes('hr') ||
                               aiSummary?.executiveSummary?.toLowerCase().includes('employee') ||
                               aiSummary?.executiveSummary?.toLowerCase().includes('team') ||
                               aiSummary?.executiveSummary?.toLowerCase().includes('organization');
          
          return hasHRKeywords || isHRDocument;
        });
        
        console.log(`📄 Auto-identified HR documents: ${hrDocuments.length}`);
      }
      
      // If still no HR documents, take documents with meaningful content for analysis
      if (hrDocuments.length === 0) {
        console.log('📄 No HR-related documents found, using all documents with OCR text...');
        hrDocuments = allDocuments.filter(doc => 
          (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
        );
        console.log(`📄 Documents with content available: ${hrDocuments.length}`);
      }
      
      // Apply EXACT same document limits as Commercial
      if (hrDocuments.length > 50) {
        console.log(`📄 Limiting to first 50 documents for HR analysis efficiency (found ${hrDocuments.length})`);
        hrDocuments = hrDocuments.slice(0, 50);
      }
      
      return hrDocuments;
      
    } catch (error) {
      console.error(`❌ Error finding HR documents:`, error);
      // Fallback: return all documents if there's an error
      try {
        const allDocs = await db.select().from(documents).where(eq(documents.dealId, dealId));
        console.log(`🏢 Error fallback: returning all ${allDocs.length} documents`);
        return allDocs.filter(doc => doc.aiSummary);
      } catch (fallbackError) {
        console.error(`❌ Fallback error:`, fallbackError);
        return [];
      }
    }
  }

  /**
   * Run comprehensive analysis for all assigned HR documents
   * EXACT CLONE of Commercial agent micro-step architecture
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`👥 Starting comprehensive HR analysis for deal ${dealId}`);
    
    try {
      // Get all HR documents - EXACT Commercial approach
      const assignedDocuments = await this.getAssignedHRDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} HR documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No HR documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No HR documents available for analysis'
        });
        return { success: false, message: 'No HR documents found' };
      }
      
      // Initialize progress - EXACT Commercial approach
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting HR analysis',
        processedDocuments: 0,
        totalDocuments: HR_QUESTIONS.length
      });
      
      // Process each question systematically - EXACT Commercial approach
      const hrAnswers: Record<string, any> = {};
      
      for (let i = 0; i < HR_QUESTIONS.length; i++) {
        const question = HR_QUESTIONS[i];
        console.log(`📊 Processing HR question ${i + 1}/${HR_QUESTIONS.length}: ${question.question}`);
        
        // CRITICAL: Update progress for each question - EXACT Commercial micro-step architecture
        await storageService.updateBackgroundJob(jobId, {
          progress: Math.round(((i + 1) / HR_QUESTIONS.length) * 100),
          processedDocuments: i,
          currentStep: `Analyzing: ${question.question}`,
          currentDocumentName: question.category
        });
        console.log(`💾 Updated background job ${jobId} to ${Math.round(((i + 1) / HR_QUESTIONS.length) * 100)}%`);
        
        try {
          console.log(`📊 Extracting HR evidence for: ${question.question}`);
          
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
          hrAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${HR_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting - EXACT Commercial approach
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question - EXACT Commercial approach
          hrAnswers[question.id] = {
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
            progress: Math.round((i / HR_QUESTIONS.length) * 100),
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
          processedDocuments: HR_QUESTIONS.length,
          currentStep: 'Generating findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations - EXACT Commercial approach
        const findings = this.generateComprehensiveFindings(hrAnswers);
        const recommendations = this.generateComprehensiveRecommendations(hrAnswers);
        
        // Store the analysis results - EXACT Commercial approach
        await this.storeComprehensiveResults(dealId, hrAnswers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed - EXACT Commercial approach
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive HR analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(hrAnswers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of HR analysis for deal ${dealId}:`, finalError);
        
        // Still try to save what we have - EXACT Commercial approach
        try {
          const partialFindings = this.generateComprehensiveFindings(hrAnswers);
          const partialRecommendations = this.generateComprehensiveRecommendations(hrAnswers);
          await this.storeComprehensiveResults(dealId, hrAnswers, partialFindings, partialRecommendations, assignedDocuments);
          
          // Mark as completed with error - EXACT Commercial approach
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            currentStep: 'Completed with partial results due to errors',
            error: finalError.message
          });
          
          return {
            success: true,
            documentsAnalyzed: assignedDocuments.length,
            questionsAnswered: Object.keys(hrAnswers).length,
            findings: partialFindings.length,
            recommendations: partialRecommendations.length,
            warning: 'Analysis completed with some errors'
          };
        } catch (saveError) {
          // Mark job as failed - EXACT Commercial approach
          await storageService.updateBackgroundJob(jobId, {
            status: 'failed',
            error: `Final error: ${finalError.message}, Save error: ${saveError.message}`
          });
          throw finalError;
        }
      }
    } catch (error) {
      console.error(`❌ Critical error in HR analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Extract evidence from ALL documents for a specific question - EXACT Commercial approach
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 SPEED MODE: Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // CRITICAL SPEED FIX: Process only top 30 most relevant documents to match Commercial speed
    const topDocuments = documents.slice(0, 30);
    console.log(`🚀 SPEED OPTIMIZATION: Processing top ${topDocuments.length} documents (reduced from ${documents.length} for speed)`);
    
    const evidence = [];
    const batchSize = 20; // Larger batches for speed
    
    for (let i = 0; i < topDocuments.length; i += batchSize) {
      const batch = topDocuments.slice(i, i + batchSize);
      console.log(`📦 FAST Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(topDocuments.length / batchSize)} (${batch.length} documents)`);
      
      // Parallel processing with reduced timeout for speed
      const batchPromises = batch.map(async (doc) => {
        console.log(`🔎 FAST Extracting evidence from: ${doc.name}`);
        try {
          return await Promise.race([
            this.extractEvidenceFromDocument(doc, question),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Document timeout')), 10000)) // 10 second timeout per document
          ]);
        } catch (error) {
          console.log(`⚠️ Skipping ${doc.name} due to timeout/error`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ FAST Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }
    
    console.log(`🎯 SPEED MODE: Extracted evidence from ${evidence.length}/${topDocuments.length} documents in FAST mode`);
    return evidence;
  }

  /**
   * Extract specific evidence from a single document - EXACT Commercial approach
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `You are an expert HR due diligence analyst conducting comprehensive investment analysis. Your task is to find ANY human resources, organizational, team, or personnel information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
CATEGORY: ${question.category}

Instructions:
- Look for DIRECT HR terms: team size, organizational structure, leadership, compensation, hiring, retention, culture
- Look for INDIRECT personnel information: employee mentions, management structure, workforce planning, talent strategy
- Consider business documents that mention organizational milestones, team growth, leadership changes
- Even general business context often has HR implications for investment due diligence
- For investment companies, most business documents contain organizational information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "hrContext": "How this document relates to HR/organizational aspects"
}

Be thorough in finding relevance - most business documents have HR implications for investment analysis.`;

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
   * Compile comprehensive answer from evidence - EXACT Commercial approach
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<HRAnswer> {
    if (evidence.length === 0) {
      return this.generateFallbackAnswer(question, evidence);
    }

    const relevantEvidence = evidence.filter(e => e.hasRelevantInfo && e.confidence > 20);
    
    if (relevantEvidence.length === 0) {
      return this.generateFallbackAnswer(question, evidence);
    }

    const evidenceSummary = relevantEvidence.map(e => ({
      document: e.documentName,
      content: e.relevantContent.slice(0, 3),
      findings: e.keyFindings.slice(0, 2),
      confidence: e.confidence
    }));

    const prompt = `You are an expert HR due diligence analyst providing comprehensive analysis for venture capital investment evaluation.

QUESTION: "${question.question}"
CATEGORY: ${question.category}

EVIDENCE FROM DOCUMENTS:
${evidenceSummary.map((e, i) => `
Document ${i + 1}: ${e.document}
Content: ${e.content.join(' | ')}
Key Findings: ${e.findings.join(' | ')}
Confidence: ${e.confidence}%
`).join('\n')}

Provide a comprehensive HR analysis in JSON format:
{
  "answer": "Detailed analytical answer addressing the question with specific evidence",
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "sources": ["Document names that provided key evidence"],
  "hrAssessment": "Professional assessment of HR/organizational implications",
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"],
  "evidenceSummary": "Brief summary of evidence quality and coverage"
}

Focus on providing specific, actionable insights for investment decision-making.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        question: question.question,
        answer: analysis.answer || 'Analysis completed',
        confidence: analysis.confidence || Math.round(relevantEvidence.reduce((sum, e) => sum + e.confidence, 0) / relevantEvidence.length),
        sources: analysis.sources || relevantEvidence.map(e => e.documentName),
        detailedEvidence: relevantEvidence,
        keyFindings: analysis.keyFindings || [],
        evidenceSummary: analysis.evidenceSummary || `Analyzed ${relevantEvidence.length} documents`,
        hrAssessment: analysis.hrAssessment || 'HR analysis completed',
        recommendations: analysis.recommendations || []
      };

    } catch (error) {
      console.error('Error in OpenAI analysis:', error);
      return this.generateFallbackAnswer(question, evidence);
    }
  }

  /**
   * Generate comprehensive findings - EXACT Commercial approach
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // Add findings from the answer
      if (answer.keyFindings && answer.keyFindings.length > 0) {
        answer.keyFindings.forEach((finding: string, index: number) => {
          findings.push({
            id: findings.length + 1,
            type: answer.confidence > 70 ? 'positive' : 'neutral',
            content: finding,
            source: 'HR Analysis',
            confidence: Math.max(answer.confidence / 100, 0.3),
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            questionId: questionId
          });
        });
      }
      
      // Add general finding for this question category
      findings.push({
        id: findings.length + 1,
        type: 'summary',
        content: `${question.category}: ${answer.answer.substring(0, 200)}${answer.answer.length > 200 ? '...' : ''}`,
        source: 'HR Analysis',
        confidence: Math.max(answer.confidence / 100, 0.2),
        category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        questionId: questionId
      });
    }
    
    return findings;
  }

  /**
   * Generate comprehensive recommendations - EXACT Commercial approach
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // Add specific recommendations from the answer
      if (answer.recommendations && answer.recommendations.length > 0) {
        answer.recommendations.forEach((rec: string, index: number) => {
          recommendations.push({
            id: recommendations.length + 1,
            type: answer.confidence > 70 ? 'positive' : 'neutral',
            content: `${question.category}: ${rec}`,
            source: 'HR Analysis',
            confidence: Math.max(answer.confidence / 100, 0.3),
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            questionId: questionId
          });
        });
      }
      
      // Add gap-based recommendations for low confidence answers
      if (answer.confidence < 50) {
        recommendations.push({
          id: recommendations.length + 1,
          type: 'improvement',
          content: `Improve documentation for ${question.category} to enable thorough analysis of: ${question.question}`,
          source: 'Gap Analysis',
          confidence: 0.4,
          category: 'documentation_gap',
          questionId: questionId
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Store comprehensive analysis results - EXACT Commercial approach
   */
  private async storeComprehensiveResults(
    dealId: number, 
    hrAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[], 
    assignedDocuments: any[]
  ): Promise<void> {
    console.log(`💾 Storing comprehensive HR analysis results for deal ${dealId}`);
    
    try {
      // Store in agent_analyses table - EXACT Commercial APPROACH matching their working database structure
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'hr')
        ));
      
      console.log(`🗑️ Cleared existing HR analysis for deal ${dealId}`);
      
      // Create the new comprehensive analysis - EXACT copy of Commercial structure
      const analysisData = {
        dealId,
        agentType: 'hr' as const,
        status: 'completed' as const,
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        hrAnswers: JSON.stringify(hrAnswers),
        documentSources: JSON.stringify(assignedDocuments.map((d: any) => d.name)),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db
        .insert(agentAnalyses)
        .values(analysisData);
      
      console.log(`📊 Created fresh comprehensive HR analysis for deal ${dealId} with ${Object.keys(hrAnswers).length} questions answered`);
    } catch (error) {
      console.error(`❌ Error storing HR analysis results:`, error);
      throw error;
    }
  }

  /**
   * Calculate overall confidence - EXACT Commercial approach
   */
  private calculateOverallConfidence(answers: Record<string, any>): number {
    const confidences = Object.values(answers)
      .map(answer => answer.confidence || 0)
      .filter(conf => conf > 0);
    
    if (confidences.length === 0) return 20;
    
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    return Math.round(avgConfidence);
  }

  generateFallbackAnswer(question: any, evidence: any[]): any {
    return {
      question: question.question,
      answer: `Analysis completed for ${question.question}. ${evidence.length} documents were reviewed for relevant HR information.`,
      confidence: evidence.length > 0 ? 0.6 : 0.1,
      sources: evidence.map(e => e.documentName),
      detailedEvidence: evidence,
      keyFindings: evidence.flatMap(e => e.keyFindings).slice(0, 3),
      evidenceSummary: `Analyzed ${evidence.length} HR documents`,
      hrAssessment: 'HR analysis completed with available documentation',
      recommendations: ['Consider additional HR documentation for more comprehensive analysis']
    };
  }

  async storeAnalysisResults(dealId: number, answers: {[key: string]: HRAnswer}, evidenceMap: Map<string, HREvidence[]>): Promise<void> {
    // Generate findings and recommendations
    const findings = Object.values(answers).flatMap(answer => 
      answer.keyFindings.map((finding, index) => ({
        id: index,
        content: finding,
        type: 'hr_finding',
        confidence: answer.confidence,
        source: answer.sources[0] || 'HR analysis'
      }))
    );

    const recommendations = Object.values(answers).flatMap(answer => 
      answer.recommendations.map(rec => ({
        title: `HR: ${rec.substring(0, 50)}...`,
        description: rec,
        priority: 'Medium',
        category: 'HR',
        impact: 'Medium'
      }))
    );

    // Store in agent_analyses table
    const existingAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'HR');
    
    if (existingAnalysis) {
      await storage.updateAgentAnalysis(existingAnalysis.id, {
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        hrAnswers: answers
      });
    } else {
      await storage.createAgentAnalysis({
        dealId,
        agentType: 'HR',
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        hrAnswers: answers
      });
    }

    console.log(`✅ Stored HR analysis: ${findings.length} findings, ${recommendations.length} recommendations`);
  }

  async getAnalysisResults(dealId: number): Promise<any> {
    try {
      const analysis = await storage.getAnalysisByDealAndAgent(dealId, 'HR');
      
      if (!analysis || !analysis.hrAnswers) {
        return null;
      }
      
      return {
        hrAnswers: analysis.hrAnswers,
        findings: analysis.findings || [],
        recommendations: analysis.recommendations || [],
        progress: analysis.progress || 0,
        status: analysis.status || 'completed'
      };
    } catch (error) {
      console.error('Error getting HR analysis results:', error);
      return null;
    }
  }
}

// Export the service instance
export const comprehensiveHRAnalysisService = new ComprehensiveHRAnalysisService();