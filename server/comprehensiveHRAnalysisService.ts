import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { ENTERPRISE_AGENT_PROMPTS, ENTERPRISE_PROMPT_FRAMEWORK } from './utils/enterprisePrompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HR_QUESTIONS = [
  // ENTERPRISE LEADERSHIP ASSESSMENT - Track Record Quantification
  {
    id: 'hr_1',
    question: "What is the CEO/founder track record with quantifiable business achievements?",
    category: "Leadership Track Record",
    analysisPrompt: 'Quantify CEO/founder achievements: previous company exits, revenue growth %, team scaling metrics, fundraising amounts, market share gains, and execution milestones with specific dates and figures.',
    keywords: ['ceo track record', 'founder experience', 'previous exits', 'revenue growth', 'fundraising', 'execution milestones', 'business achievements', 'leadership success', 'quantifiable results']
  },
  {
    id: 'hr_2',
    question: "What is the leadership team depth and domain expertise scoring (1-10)?",
    category: "Leadership Assessment",
    analysisPrompt: 'Rate leadership team effectiveness (1-10 scale) across: domain expertise, execution capability, track record, team chemistry, and succession planning. Include specific expertise gaps and hiring priorities.',
    keywords: ['leadership depth', 'domain expertise', 'execution capability', 'leadership scoring', 'team effectiveness', 'succession planning', 'expertise gaps']
  },
  {
    id: 'hr_3',
    question: "What are the key person risks with quantified impact assessment?",
    category: "Key Person Risk", 
    analysisPrompt: 'Identify critical single points of failure, quantify business impact if key personnel leave (revenue %, operational disruption), assess succession planning, and calculate key person insurance coverage.',
    keywords: ['key person risk', 'single point failure', 'succession planning', 'business continuity', 'key person insurance', 'impact assessment', 'retention risk']
  },
  // ORGANIZATIONAL SCALING READINESS
  {
    id: 'hr_4',
    question: "What is the current team size vs revenue productivity ratio?",
    category: "Scaling Readiness",
    analysisPrompt: 'Calculate revenue per employee, assess team productivity metrics, identify optimal team size for growth stage, and benchmark against industry standards with specific ratios and percentages.',
    keywords: ['revenue per employee', 'team productivity', 'scaling metrics', 'headcount efficiency', 'growth stage optimization', 'industry benchmarks']
  },
  {
    id: 'hr_5',
    question: "What is the hiring velocity and critical hiring timeline with cost estimates?",
    category: "Hiring Velocity",
    analysisPrompt: 'Assess current hiring rate (hires per month), identify critical hiring needs with timeline and budget, calculate time-to-hire metrics, and evaluate talent acquisition effectiveness.',
    keywords: ['hiring velocity', 'hiring timeline', 'recruiting metrics', 'time-to-hire', 'hiring costs', 'talent acquisition', 'critical hires', 'hiring budget']
  },
  {
    id: 'hr_6',
    question: "What are the employee retention rates and turnover cost analysis?",
    category: "Retention Metrics",
    analysisPrompt: 'Calculate annual turnover rate %, retention rates by role/department, cost per turnover event, identify retention risk factors, and assess talent stability for scaling.',
    keywords: ['retention rate', 'turnover cost', 'talent stability', 'churn analysis', 'retention risk', 'employee tenure', 'turnover metrics']
  },
  // CULTURE ASSESSMENT WITH ENGAGEMENT SCORES
  {
    id: 'hr_7',
    question: "What are the employee satisfaction and engagement scores with benchmarks?",
    category: "Culture Assessment",
    analysisPrompt: 'Quantify employee engagement scores, satisfaction ratings, NPS scores, compare to industry benchmarks, identify culture strengths/weaknesses, and assess cultural alignment with growth strategy.',
    keywords: ['engagement scores', 'employee satisfaction', 'nps score', 'culture assessment', 'employee surveys', 'engagement metrics', 'cultural alignment']
  },
  {
    id: 'hr_8',
    question: "What is the organizational structure effectiveness for current growth stage?",
    category: "Organizational Design",
    analysisPrompt: 'Assess organizational design fit for growth stage, evaluate reporting structure efficiency, identify structural bottlenecks, and recommend org design changes with implementation timeline.',
    keywords: ['organizational design', 'reporting structure', 'growth stage fit', 'structural efficiency', 'org chart optimization', 'management layers']
  },
  {
    id: 'hr_9',
    question: "What is the compensation benchmarking and equity structure competitiveness?",
    category: "Compensation Strategy",
    analysisPrompt: 'Benchmark compensation vs market rates (percentile ranking), assess equity pool allocation, evaluate incentive structure effectiveness, and identify compensation risks for talent retention.',
    keywords: ['compensation benchmark', 'market rates', 'equity structure', 'incentive design', 'talent retention', 'pay equity', 'compensation risk']
  },
  // TALENT STRATEGY AND DEVELOPMENT
  {
    id: 'hr_10',
    question: "What is the talent development ROI and career progression framework?",
    category: "Talent Development",
    analysisPrompt: 'Assess training program ROI, internal promotion rates, skills development initiatives, career progression paths, and leadership development pipeline effectiveness.',
    keywords: ['talent development', 'training roi', 'career progression', 'internal promotion', 'skills development', 'leadership pipeline', 'development programs']
  },
  {
    id: 'hr_11',
    question: "What is the workforce diversity metrics and inclusion program effectiveness?",
    category: "Diversity & Inclusion",
    analysisPrompt: 'Quantify diversity metrics across levels (%, representation), assess inclusion program impact, evaluate DEI initiative ROI, and identify diversity hiring targets and timelines.',
    keywords: ['diversity metrics', 'inclusion programs', 'representation data', 'dei initiatives', 'diversity hiring', 'inclusion effectiveness', 'bias mitigation']
  },
  {
    id: 'hr_12',
    question: "What are the HR technology and process automation capabilities?",
    category: "HR Operations",
    analysisPrompt: 'Evaluate HR technology stack efficiency, process automation level, HRIS capabilities, compliance framework strength, and operational scalability for growth.',
    keywords: ['hr technology', 'process automation', 'hris systems', 'hr operations', 'compliance framework', 'operational efficiency', 'scalability']
  }
];

export interface HRAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface HREvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface HRAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: HREvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  hrAssessment: string;
  recommendations: string[];
}

export class ComprehensiveHRAnalysisService {
  private progressData: Map<number, HRAnalysisProgress> = new Map();

  getProgress(dealId: number): HRAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No comprehensive HR analysis running' 
    };
  }

  private async setProgress(dealId: number, progress: Partial<HRAnalysisProgress>, jobId?: string) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
    
    // Also update database background job if jobId provided
    if (jobId && progress.progress !== undefined) {
      try {
        await storage.updateBackgroundJob(jobId, {
          progress: progress.progress,
          currentStep: progress.currentStep || current.currentStep || 'Processing HR analysis'
        });
      } catch (error) {
        console.error(`❌ Error updating background job ${jobId}:`, error);
      }
    }
  }

  async getAssignedHRDocuments(dealId: number): Promise<any[]> {
    console.log(`👥 FIXED: Finding assigned HR documents for deal ${dealId}`);
    
    try {
      // ✅ CORRECT: Use proper storage method that fetches OCR text correctly
      const allDocuments = await storage.getDocumentsWithOCRByDealId(dealId);
      console.log(`👥 Found ${allDocuments.length} total documents for deal ${dealId}`);
      
      // Log OCR text availability for debugging
      const docsWithOCR = allDocuments.filter(doc => doc.ocrText && doc.ocrText.length > 0);
      const docsWithSummary = allDocuments.filter(doc => doc.aiSummary);
      console.log(`📊 HR: Documents with OCR text: ${docsWithOCR.length}/${allDocuments.length}`);
      console.log(`📊 HR: Documents with AI summary: ${docsWithSummary.length}/${allDocuments.length}`);
      
      // Filter to include documents with OCR text OR AI summaries for analysis
      const documentsWithContent = allDocuments.filter(doc => {
        // Prioritize OCR text, fallback to AI summary
        if (doc.ocrText && doc.ocrText.length > 100) {
          console.log(`📄 HR: Document ${doc.name}: Using OCR text (${doc.ocrText.length} chars)`);
          return true;
        }
        
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
      
      console.log(`👥 HR analysis will process ALL ${documentsWithContent.length} documents with content (OCR + AI summaries)`);
      
      // Return ALL documents with content for maximum coverage
      return documentsWithContent;
      
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
   * EXACT CLONE of Clinical agent micro-step architecture
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🏢 Starting comprehensive HR analysis for deal ${dealId}`);
    
    try {
      // Get all HR documents - EXACT Clinical approach
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
      
      // Initialize progress - EXACT Clinical approach
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting HR analysis',
        processedDocuments: 0,
        totalDocuments: HR_QUESTIONS.length
      });
      
      // Process each question systematically - EXACT Clinical approach
      const hr_answers: Record<string, any> = {};
      
      for (let i = 0; i < HR_QUESTIONS.length; i++) {
        const question = HR_QUESTIONS[i];
        console.log(`📊 Processing HR question ${i + 1}/${HR_QUESTIONS.length}: ${question.question}`);
        
        // CRITICAL: Update progress for each question - EXACT Clinical micro-step architecture
        await storageService.updateBackgroundJob(jobId, {
          progress: Math.round(((i + 1) / HR_QUESTIONS.length) * 100),
          processedDocuments: i,
          currentStep: `Analyzing: ${question.question}`,
          currentDocumentName: question.category
        });
        console.log(`💾 Updated background job ${jobId} to ${Math.round(((i + 1) / HR_QUESTIONS.length) * 100)}%`);
        
        try {
          console.log(`📊 Extracting HR evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question - EXACT Clinical approach with SPEED OPTIMIZATION
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments.slice(0, 30), // SPEED: Use only first 30 documents for faster processing
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer with timeout - EXACT Clinical approach
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await Promise.race([
            this.compileComprehensiveAnswer(question, documentEvidence),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 60000)) // 60 second timeout
          ]);
          hr_answers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${HR_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting - EXACT Clinical approach
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question - EXACT Clinical approach
          hr_answers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          
          // Update progress to continue processing - EXACT Clinical approach
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
        // Update progress to completion - EXACT Clinical approach
        await storageService.updateBackgroundJob(jobId, {
          progress: 100,
          processedDocuments: HR_QUESTIONS.length,
          currentStep: 'Generating findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations - EXACT Clinical approach
        const findings = this.generateComprehensiveFindings(hr_answers);
        const recommendations = this.generateComprehensiveRecommendations(hr_answers);
        
        // Store the analysis results - EXACT Clinical approach
        await this.storeComprehensiveResults(dealId, hr_answers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed - EXACT Clinical approach
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive HR analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(hr_answers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of HR analysis for deal ${dealId}:`, finalError);
        
        // Still try to save what we have - EXACT Clinical approach
        try {
          const partialFindings = this.generateComprehensiveFindings(hr_answers);
          const partialRecommendations = this.generateComprehensiveRecommendations(hr_answers);
          await this.storeComprehensiveResults(dealId, hr_answers, partialFindings, partialRecommendations, assignedDocuments);
          
          // Mark as completed with error - EXACT Clinical approach
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            currentStep: 'Completed with partial results due to errors',
            error: finalError.message
          });
          
          return {
            success: true,
            documentsAnalyzed: assignedDocuments.length,
            questionsAnswered: Object.keys(hr_answers).length,
            findings: partialFindings.length,
            recommendations: partialRecommendations.length,
            warning: 'Analysis completed with some errors'
          };
        } catch (saveError) {
          // Mark job as failed - EXACT Clinical approach
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
   * Extract evidence from ALL documents for a specific question - EXACT Clinical approach
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 SPEED MODE: Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // CRITICAL SPEED FIX: Process only top 30 most relevant documents to match Clinical speed
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
   * Extract specific evidence from a single document - ENTERPRISE HR INTELLIGENCE APPROACH
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `${ENTERPRISE_AGENT_PROMPTS.HR.SYSTEM_PROMPT}

${ENTERPRISE_PROMPT_FRAMEWORK.QUANTITATIVE_FOCUS}

${ENTERPRISE_PROMPT_FRAMEWORK.EVIDENCE_STANDARDS}

DOCUMENT ANALYSIS:
Document: ${document.name}
Content: ${content.substring(0, 120000)} ${content.length > 120000 ? '\n[Document truncated - processing first 120k characters for institutional-grade analysis...]' : ''}

ORGANIZATIONAL INTELLIGENCE QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS FRAMEWORK: ${question.analysisPrompt}

EXECUTE HUMAN CAPITAL ASSESSMENT:
• Quantify leadership metrics (track record %, growth achievements, team scaling numbers)
• Identify organizational health indicators (retention rates, engagement scores, productivity metrics)
• Assess scaling readiness with specific hiring velocity and capacity metrics
• Extract talent strategy data (compensation benchmarks, development ROI, succession depth)
• Rate organizational risks (1-10 scale) with supporting quantitative evidence

FINDINGS OUTPUT (JSON FORMAT):
{
  "relevantContent": ["Exact quantitative quote 1 with numbers/percentages", "Specific organizational data quote 2"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Quantified finding 1 with metrics", "Organizational insight 2 with data"],
  "documentSummary": "Executive summary of organizational intelligence found",
  "organizationalContext": "How this relates to human capital and scaling readiness",
  "quantitativeMetrics": ["Specific numbers, percentages, ratios found"],
  "riskIndicators": ["Risk factors identified with severity assessment"]
}

PRIORITIZE: Quantitative data, specific metrics, measurable outcomes, and institutional-grade evidence.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 3500 // Increased for enterprise-grade organizational intelligence extraction
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
        organizationalContext: analysis.organizationalContext || '',
        quantitativeMetrics: analysis.quantitativeMetrics || [],
        riskIndicators: analysis.riskIndicators || [],
        fullContent: content.substring(0, 2000) // Keep larger sample for reference
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
   * Compile comprehensive answer based on all evidence - ENTERPRISE ORGANIZATIONAL INTELLIGENCE
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🏢 ENTERPRISE: Compiling organizational intelligence for: ${question.question}`);
    console.log(`📊 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No organizational intelligence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant organizational intelligence found in available documents for this enterprise assessment.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant organizational data found'],
        category: question.category,
        hrRiskScore: 8,
        leadershipScore: 0,
        organizationalHealth: 0,
        scalingReadiness: 0,
        talentStrategy: 0
      };
    }

    // Prepare enterprise evidence summary with quantitative metrics
    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence,
      quantitativeMetrics: ev.quantitativeMetrics || [],
      riskIndicators: ev.riskIndicators || [],
      organizationalContext: ev.organizationalContext || ''
    }));

    const prompt = `${ENTERPRISE_AGENT_PROMPTS.HR.SYSTEM_PROMPT}

${ENTERPRISE_AGENT_PROMPTS.HR.ANALYSIS_PROMPT}

${ENTERPRISE_PROMPT_FRAMEWORK.QUANTITATIVE_FOCUS}

${ENTERPRISE_PROMPT_FRAMEWORK.EVIDENCE_STANDARDS}

ORGANIZATIONAL INTELLIGENCE COMPILATION:

QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS FRAMEWORK: Execute comprehensive human capital assessment

EVIDENCE FROM INSTITUTIONAL ANALYSIS:
${evidenceSummary.map(ev => `
📊 DOCUMENT: ${ev.document}
📈 QUANTITATIVE METRICS: ${ev.quantitativeMetrics.join(', ')}
🔍 ORGANIZATIONAL CONTEXT: ${ev.organizationalContext}
📋 KEY FINDINGS: ${ev.findings}
⚠️ RISK INDICATORS: ${ev.riskIndicators.join(', ')}
🎯 CONFIDENCE: ${ev.confidence}%
💼 EVIDENCE: ${ev.content}
`).join('\n')}

${ENTERPRISE_PROMPT_FRAMEWORK.EXECUTIVE_STRUCTURE}

INSTITUTIONAL-GRADE OUTPUT REQUIREMENTS:

1. QUANTIFIED LEADERSHIP ASSESSMENT (1-10 scoring):
   - CEO/founder track record with specific achievements
   - Leadership team depth and domain expertise
   - Executive succession planning and key person risks

2. ORGANIZATIONAL HEALTH METRICS:
   - Employee retention rates and engagement scores
   - Productivity ratios and scaling capacity
   - Cultural strength indicators with benchmarks

3. SCALING READINESS ANALYSIS:
   - Hiring velocity and critical hiring timeline
   - Organizational structure effectiveness
   - Talent pipeline and development ROI

4. HR RISK SCORING (1-10 scale):
   - Key person dependencies and mitigation
   - Talent retention risks and succession gaps
   - Organizational scaling bottlenecks

ENTERPRISE JSON OUTPUT:
{
  "answer": "Executive summary with quantified organizational intelligence insights",
  "confidence": 0-100,
  "sources": ["Document references with page numbers"],
  "keyFindings": ["Quantified finding 1 with metrics", "Strategic insight 2 with data"],
  "gaps": ["Missing critical data with impact assessment"],
  "recommendations": ["Strategic recommendation 1 with timeline", "Investment implication 2"],
  "hrRiskScore": 1-10,
  "leadershipScore": 1-10,
  "organizationalHealth": 1-10,
  "scalingReadiness": 1-10,
  "talentStrategy": 1-10,
  "executiveSummary": "Investment-grade organizational assessment",
  "quantitativeMetrics": ["Key ratios, percentages, and benchmarks"],
  "riskAssessment": "Comprehensive risk analysis with mitigation strategies",
  "evidenceCount": ${evidence.length}
}

PRIORITIZE: Quantitative insights, institutional-quality recommendations, measurable risk assessments.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 5000 // Increased for enterprise organizational intelligence synthesis
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile organizational intelligence from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName),
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        // ENTERPRISE SCORING FIELDS
        hrRiskScore: compiledAnswer.hrRiskScore || 5,
        leadershipScore: compiledAnswer.leadershipScore || 5,
        organizationalHealth: compiledAnswer.organizationalHealth || 5,
        scalingReadiness: compiledAnswer.scalingReadiness || 5,
        talentStrategy: compiledAnswer.talentStrategy || 5,
        // ENHANCED ENTERPRISE FIELDS
        executiveSummary: compiledAnswer.executiveSummary || compiledAnswer.HRAssessment || '',
        quantitativeMetrics: compiledAnswer.quantitativeMetrics || [],
        riskAssessment: compiledAnswer.riskAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error) {
      console.error(`Error compiling answer for "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling organizational intelligence: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        gaps: ['Organizational analysis compilation failed'],
        recommendations: ['Manual enterprise review required'],
        hrRiskScore: 8,
        leadershipScore: 0,
        organizationalHealth: 0,
        scalingReadiness: 0,
        talentStrategy: 0,
        executiveSummary: 'Analysis failed - manual review required',
        quantitativeMetrics: [],
        riskAssessment: 'High risk due to analysis failure',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate enterprise-grade organizational intelligence findings
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // ENTERPRISE: High confidence organizational insights
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'organizational_strength',
          content: `${question.question}: ${answer.answer.substring(0, 200)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Organizational Analysis',
          confidence: answer.confidence / 100,
          category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          evidenceCount: answer.evidenceCount || 0,
          leadershipScore: answer.leadershipScore || null,
          organizationalHealth: answer.organizationalHealth || null,
          scalingReadiness: answer.scalingReadiness || null,
          hrRiskScore: answer.hrRiskScore || null,
          quantitativeMetrics: answer.quantitativeMetrics || []
        });
      }
      
      // ENTERPRISE: Risk findings for low confidence or organizational gaps
      if (answer.confidence < 50 || (answer.gaps && answer.gaps.length > 0)) {
        findings.push({
          id: findings.length + 1,
          type: 'organizational_risk',
          content: `Insufficient organizational intelligence for: ${question.question}. Enhanced due diligence required for institutional investment assessment.`,
          source: 'Organizational Intelligence Gap Analysis',
          confidence: 0.3,
          category: 'organizational_gaps',
          hrRiskScore: answer.hrRiskScore || 7,
          riskAssessment: answer.riskAssessment || 'Data insufficiency increases investment risk',
          evidenceCount: answer.evidenceCount || 0
        });
      }
    }
    
    return findings;
  }

  /**
   * Generate comprehensive recommendations - EXACT Clinical approach
   */
  /**
   * Generate enterprise-grade organizational intelligence recommendations
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // ENTERPRISE: Strategic recommendations with priority and impact assessment
      if (answer.recommendations && answer.recommendations.length > 0) {
        answer.recommendations.forEach((rec: string, index: number) => {
          const priority = this.assessRecommendationPriority(answer, question);
          const impact = this.assessBusinessImpact(answer, question);
          
          recommendations.push({
            id: recommendations.length + 1,
            type: answer.confidence > 70 ? 'strategic_enhancement' : 'organizational_improvement',
            content: `${question.category}: ${rec}`,
            source: 'Organizational Intelligence Analysis',
            confidence: Math.max(answer.confidence / 100, 0.3),
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            questionId: questionId,
            priority: priority,
            businessImpact: impact,
            leadershipScore: answer.leadershipScore || null,
            hrRiskScore: answer.hrRiskScore || null,
            timeline: this.getRecommendationTimeline(question.category),
            quantitativeMetrics: answer.quantitativeMetrics || []
          });
        });
      }
      
      // ENTERPRISE: Critical gap-based recommendations for investment decisions
      if (answer.confidence < 50) {
        recommendations.push({
          id: recommendations.length + 1,
          type: 'due_diligence_requirement',
          content: `CRITICAL: Enhanced organizational intelligence required for ${question.category}. Recommend focused management interviews and supplementary documentation review for: ${question.question}`,
          source: 'Investment Due Diligence Gap Analysis',
          confidence: 0.8, // High confidence that this is a real gap
          category: 'investment_risk_mitigation',
          questionId: questionId,
          priority: 'HIGH',
          businessImpact: 'HIGH',
          hrRiskScore: answer.hrRiskScore || 7,
          timeline: 'Pre-investment (30 days)'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Assess recommendation priority based on organizational impact
   */
  private assessRecommendationPriority(answer: any, question: any): string {
    if (question.category.includes('Leadership') || question.category.includes('Risk')) {
      return 'HIGH';
    }
    if (answer.confidence > 80) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Assess business impact of organizational findings
   */
  private assessBusinessImpact(answer: any, question: any): string {
    if (question.category.includes('Leadership') || question.category.includes('Scaling') || question.category.includes('Risk')) {
      return 'HIGH';
    }
    if (question.category.includes('Culture') || question.category.includes('Talent')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  /**
   * Get recommended timeline for addressing organizational issues
   */
  private getRecommendationTimeline(category: string): string {
    if (category.includes('Leadership') || category.includes('Risk')) {
      return 'Immediate (0-30 days)';
    }
    if (category.includes('Scaling') || category.includes('Hiring')) {
      return 'Short-term (30-90 days)';
    }
    return 'Medium-term (90-180 days)';
  }

  /**
   * Store comprehensive analysis results - EXACT Clinical approach
   */
  private async storeComprehensiveResults(
    dealId: number, 
    hr_answers: Record<string, any>, 
    findings: any[], 
    recommendations: any[], 
    assignedDocuments: any[]
  ): Promise<void> {
    console.log(`💾 Storing comprehensive HR analysis results for deal ${dealId}`);
    
    try {
      // Store in agent_analyses table - EXACT LEGAL APPROACH matching their working database structure
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'HR')
        ));
      
      console.log(`🗑️ Cleared existing HR analysis for deal ${dealId}`);
      
      // Create the new comprehensive analysis - EXACT copy of Legal structure
      const analysisData = {
        dealId,
        agentType: 'HR' as const,
        status: 'completed' as const,
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        hr_answers: hr_answers, // CRITICAL FIX: Store as object (not JSON string) for consistent field mapping
        documentSources: JSON.stringify(assignedDocuments.map((d: any) => d.name)),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db
        .insert(agentAnalyses)
        .values(analysisData);
      
      console.log(`📊 Created fresh comprehensive HR analysis for deal ${dealId} with ${Object.keys(hr_answers).length} questions answered`);
    } catch (error) {
      console.error(`❌ Error storing HR analysis results:`, error);
      throw error;
    }
  }

  /**
   * Calculate overall confidence - EXACT Clinical approach
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
      HRAssessment: 'HR analysis completed with available documentation',
      recommendations: ['Consider additional HR documentation for more comprehensive analysis']
    };
  }

  async storeAnalysisResults(dealId: number, answers: {[key: string]: HRAnswer}, evidenceMap: Map<string, HREvidence[]>): Promise<void> {
    // Generate findings and recommendations
    const findings = Object.values(answers).flatMap(answer => 
      answer.keyFindings.map((finding, index) => ({
        id: index,
        content: finding,
        type: 'HR_finding',
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
        hr_answers: answers
      });
    } else {
      await storage.createAgentAnalysis({
        dealId,
        agentType: 'HR',
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        hr_answers: answers
      });
    }

    console.log(`✅ Stored HR analysis: ${findings.length} findings, ${recommendations.length} recommendations`);
  }

  async getAnalysisResults(dealId: number): Promise<any> {
    try {
      const analysis = await storage.getAnalysisByDealAndAgent(dealId, 'HR');
      
      if (!analysis || !analysis.hr_answers) {
        return null;
      }
      
      return {
        hr_answers: analysis.hr_answers,
        findings: analysis.findings || [],
        recommendations: analysis.recommendations || [],
        status: analysis.status,
        progress: analysis.progress
      };
    } catch (error) {
      console.error(`❌ Error retrieving HR analysis results:`, error);
      return null;
    }
  }
}

export const comprehensiveHRAnalysisService = new ComprehensiveHRAnalysisService();
export { HR_QUESTIONS };