/**
 * Comprehensive Clinical Analysis Service
 * Analyzes ALL assigned clinical documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';
import { ENTERPRISE_AGENT_PROMPTS } from './utils/enterprisePrompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enterprise-Grade Clinical Intelligence Questions
// Aligned with ENTERPRISE_AGENT_PROMPTS.CLINICAL framework
export const COMPREHENSIVE_CLINICAL_QUESTIONS = [
  // Efficacy Assessment with Statistical Rigor
  { 
    id: 'efficacy_1', 
    question: 'What is the quantified clinical efficacy with statistical significance?', 
    category: 'Efficacy Assessment',
    analysisPrompt: 'Quantify primary endpoint achievement rates, statistical significance (p-values), confidence intervals, number needed to treat (NNT), and clinical improvement percentages vs standard of care.',
    keywords: ['efficacy', 'primary endpoint', 'p-value', 'statistical significance', 'confidence interval', 'nnt', 'number needed to treat', 'clinical improvement', 'response rate', 'treatment effect']
  },
  { 
    id: 'efficacy_2', 
    question: 'How do clinical outcomes compare to standard of care with quantified improvement?', 
    category: 'Efficacy Assessment',
    analysisPrompt: 'Compare clinical outcomes to standard of care with specific percentage improvements, hazard ratios, and clinical significance thresholds.',
    keywords: ['standard of care', 'hazard ratio', 'odds ratio', 'clinical significance', 'comparative effectiveness', 'superiority', 'non-inferiority', 'improvement percentage']
  },
  // Safety Profile with Quantified Risk Assessment
  { 
    id: 'safety_1', 
    question: 'What are the quantified adverse event rates and severity classifications?', 
    category: 'Safety Profile',
    analysisPrompt: 'Quantify adverse event rates by severity (mild/moderate/severe), serious adverse event rates, treatment-emergent adverse events, and discontinuation rates due to adverse events.',
    keywords: ['adverse event rate', 'serious adverse events', 'sae', 'treatment emergent', 'discontinuation rate', 'toxicity grade', 'ctcae', 'safety profile']
  },
  { 
    id: 'safety_2', 
    question: 'What is the therapeutic safety margin and contraindication profile?', 
    category: 'Safety Profile',
    analysisPrompt: 'Assess therapeutic window, safety margin, contraindications count, drug interactions, and population restrictions with risk quantification.',
    keywords: ['therapeutic window', 'safety margin', 'contraindications', 'drug interactions', 'population restrictions', 'risk benefit', 'tolerance']
  },
  // Regulatory Pathway with Timeline Assessment
  { 
    id: 'regulatory_1', 
    question: 'What is the regulatory approval probability and timeline estimate?', 
    category: 'Regulatory Assessment',
    analysisPrompt: 'Assess regulatory approval probability (0-100%), timeline estimates in months/years, regulatory pathway (510k/PMA/BLA/NDA), and precedent analysis.',
    keywords: ['approval probability', 'regulatory timeline', '510k', 'pma', 'bla', 'nda', 'fda guidance', 'regulatory precedent', 'submission strategy']
  },
  { 
    id: 'regulatory_2', 
    question: 'What regulatory risk factors and compliance gaps exist with remediation costs?', 
    category: 'Regulatory Assessment',
    analysisPrompt: 'Identify regulatory compliance gaps, potential FDA holds or objections, required additional studies, and estimated costs for regulatory compliance.',
    keywords: ['regulatory risk', 'compliance gaps', 'fda hold', 'complete response letter', 'additional studies', 'regulatory costs', 'post-market requirements']
  },
  // Clinical Risk Scoring and Investment Viability
  { 
    id: 'risk_1', 
    question: 'What is the overall clinical risk score (1-10) with quantified rationale?', 
    category: 'Clinical Risk Assessment',
    analysisPrompt: 'Calculate clinical risk score (1-10) considering efficacy probability, safety concerns, regulatory hurdles, and commercial viability with specific risk quantification.',
    keywords: ['clinical risk', 'development risk', 'efficacy risk', 'safety risk', 'regulatory risk', 'commercial risk', 'investment risk']
  },
  { 
    id: 'commercial_1', 
    question: 'What is the commercial viability with market adoption potential?', 
    category: 'Commercial Assessment',
    analysisPrompt: 'Assess market size, competitive positioning, reimbursement likelihood, adoption barriers, and revenue potential with quantified projections.',
    keywords: ['market size', 'competitive advantage', 'reimbursement', 'adoption barriers', 'revenue potential', 'market penetration', 'pricing power']
  },
  // Clinical Development Strategy
  { 
    id: 'development_1', 
    question: 'What are the clinical development milestones and success probability?', 
    category: 'Development Strategy',
    analysisPrompt: 'Identify next clinical milestones, development timeline, success probability at each phase, and investment requirements with risk-adjusted projections.',
    keywords: ['development milestones', 'phase progression', 'success probability', 'development timeline', 'investment requirements', 'go/no-go criteria']
  },
  { 
    id: 'development_2', 
    question: 'What competitive threats and differentiation factors exist?', 
    category: 'Development Strategy',
    analysisPrompt: 'Analyze competitive landscape, differentiation factors, competitive timing risks, and patent protection with strategic implications.',
    keywords: ['competitive landscape', 'differentiation', 'competitive timing', 'patent protection', 'competitive advantage', 'market positioning']
  },
];

export interface ClinicalAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface ClinicalEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface ClinicalAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: ClinicalEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  clinicalAssessment: string;
  recommendations: string[];
  clinicalRiskScore: number;
  efficacyMetrics: {
    primaryEndpointAchievement?: number;
    statisticalSignificance?: string;
    numberNeededToTreat?: number;
    clinicalImprovement?: string;
    confidenceInterval?: string;
  };
  safetyProfile: {
    adverseEventRate?: number;
    severityClassification?: string;
    seriousAdverseEvents?: number;
    contraindicationsCount?: number;
    safetyMargin?: string;
  };
  regulatoryAssessment: {
    approvalProbability?: number;
    timelineEstimate?: string;
    regulatoryPathway?: string;
    precedentAnalysis?: string;
    complianceStatus?: string;
  };
}

export class ComprehensiveClinicalAnalysisService {
  
  /**
   * Run comprehensive analysis for all assigned clinical documents
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🧬 Starting comprehensive clinical analysis for deal ${dealId}`);
    
    try {
      // Get all clinical documents
      const assignedDocuments = await this.getAssignedClinicalDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} clinical documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No clinical documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No clinical documents available for analysis'
        });
        return { success: false, message: 'No clinical documents found' };
      }
      
      // Initialize progress
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting clinical analysis',
        processedDocuments: 0,
        totalDocuments: COMPREHENSIVE_CLINICAL_QUESTIONS.length
      });
      
      // Process each question systematically
      const clinicalAnswers: Record<string, any> = {};
      
      for (let i = 0; i < COMPREHENSIVE_CLINICAL_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_CLINICAL_QUESTIONS[i];
        console.log(`🔍 Processing clinical question ${i + 1}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}: ${question.question}`);
        
        // Update progress - Start at 0% like Legal (removed +5 offset)
        const progress = Math.round(((i + 1) / COMPREHENSIVE_CLINICAL_QUESTIONS.length) * 100);
        await storageService.updateBackgroundJob(jobId, {
          progress,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`,
          processedDocuments: i
        });
        
        try {
          console.log(`📊 Extracting clinical evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, 
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer with timeout - EXACT Legal approach
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await Promise.race([
            this.compileComprehensiveAnswer(question, documentEvidence),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 60000)) // 60 second timeout
          ]);
          clinicalAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question
          clinicalAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          
          // Update progress to continue processing
          await storageService.updateBackgroundJob(jobId, {
            progress: Math.round((i / COMPREHENSIVE_CLINICAL_QUESTIONS.length) * 100),
            processedDocuments: i,
            currentDocumentName: `Error: ${question.question}`,
            currentStep: `Error in: ${question.category}`
          });
          
          // Continue with next question instead of failing completely
          continue;
        }
      }
      
      try {
        // Update progress to completion
        await storageService.updateBackgroundJob(jobId, {
          progress: 100,
          processedDocuments: COMPREHENSIVE_CLINICAL_QUESTIONS.length,
          currentStep: 'Generating findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations
        const findings = this.generateComprehensiveFindings(clinicalAnswers);
        const recommendations = this.generateComprehensiveRecommendations(clinicalAnswers);
        
        // Store the analysis results
        await this.storeComprehensiveResults(dealId, clinicalAnswers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive clinical analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(clinicalAnswers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of clinical analysis for deal ${dealId}:`, finalError);
        
        // Still try to save what we have
        try {
          const partialFindings = this.generateComprehensiveFindings(clinicalAnswers);
          const partialRecommendations = this.generateComprehensiveRecommendations(clinicalAnswers);
          await this.storeComprehensiveResults(dealId, clinicalAnswers, partialFindings, partialRecommendations, assignedDocuments);
          
          // Mark as completed with error
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            currentStep: 'Completed with partial results due to errors',
            error: finalError.message
          });
          
          return {
            success: true,
            documentsAnalyzed: assignedDocuments.length,
            questionsAnswered: Object.keys(clinicalAnswers).length,
            findings: partialFindings.length,
            recommendations: partialRecommendations.length,
            warning: 'Analysis completed with some errors'
          };
        } catch (saveError) {
          // Mark job as failed
          await storageService.updateBackgroundJob(jobId, {
            status: 'failed',
            error: `Final error: ${finalError.message}, Save error: ${saveError.message}`
          });
          throw finalError;
        }
      }
    } catch (error) {
      console.error(`❌ Critical error in clinical analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all documents suitable for clinical analysis - FIXED to use proper storage method
   */
  private async getAssignedClinicalDocuments(dealId: number): Promise<any[]> {
    console.log(`🔧 FIXED: Using storage.getDocumentsWithOCRByDealId for deal ${dealId}`);
    
    // ✅ CORRECT: Use proper storage method that fetches OCR text correctly
    const allDocuments = await storage.getDocumentsWithOCRByDealId(dealId);
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // Log OCR text availability for debugging
    const docsWithOCR = allDocuments.filter(doc => doc.ocrText && doc.ocrText.length > 0);
    const docsWithSummary = allDocuments.filter(doc => doc.aiSummary);
    console.log(`📊 Documents with OCR text: ${docsWithOCR.length}/${allDocuments.length}`);
    console.log(`📊 Documents with AI summary: ${docsWithSummary.length}/${allDocuments.length}`);
    
    // First try documents explicitly assigned to clinical agent
    let clinicalDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('clinical')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to clinical: ${clinicalDocuments.length}`);
    
    // If no documents are explicitly assigned to clinical, identify clinical-related documents
    if (clinicalDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to clinical agent, identifying clinical-related documents...');
      
      clinicalDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) {
          console.log(`⚠️ Document ${doc.name} has no OCR text or AI summary - skipping`);
          return false;
        }
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Log OCR text length for debugging
        if (doc.ocrText) {
          console.log(`📄 Document ${doc.name}: OCR text length = ${doc.ocrText.length}`);
        }
        
        // Clinical document keywords
        const clinicalKeywords = [
          'clinical', 'trial', 'study', 'protocol', 'patient', 'fda', 'ema', 
          'regulatory', 'phase', 'efficacy', 'safety', 'adverse', 'endpoint',
          'enrollment', 'randomized', 'blinded', 'placebo', 'investigator',
          'brochure', 'medical', 'therapeutic', 'treatment', 'drug',
          'device', 'approval', 'submission', 'ide', 'ind', '510k',
          'orphan', 'fast-track', 'breakthrough', 'serious adverse event'
        ];
        
        // Check document name and content for clinical keywords
        const hasClinicalKeywords = clinicalKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for clinical document type
        const isClinicalDocument = aiSummary?.documentType?.toLowerCase().includes('clinical') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('clinical') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('trial') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('study');
        
        return hasClinicalKeywords || isClinicalDocument;
      });
      
      console.log(`📄 Auto-identified clinical documents: ${clinicalDocuments.length}`);
    }
    
    // If still no clinical documents, take documents with meaningful content for analysis
    if (clinicalDocuments.length === 0) {
      console.log('📄 No clinical-related documents found, using all documents with OCR text...');
      clinicalDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`📄 Documents with content available: ${clinicalDocuments.length}`);
    }
    
    // Apply EXACT same document limits as Legal for efficiency
    if (clinicalDocuments.length > 50) {
      console.log(`📄 Limiting to first 50 documents for clinical analysis efficiency (found ${clinicalDocuments.length})`);
      clinicalDocuments = clinicalDocuments.slice(0, 50);
    }
    
    return clinicalDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // Process documents in batches to avoid overwhelming the system
    const batchSize = 10;
    const evidence = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.all(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting evidence from: ${doc.name}`);
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      // Filter out null results and add to evidence
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
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
    
    const prompt = `You are an expert clinical research analyst conducting comprehensive investment analysis. Your task is to find ANY clinical, regulatory, safety, or efficacy information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 100000)} ${content.length > 100000 ? '\n[Document truncated - processing first 100k characters for comprehensive analysis...]' : ''}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Extract ALL clinical trial data: endpoints, patient populations, efficacy results, safety profiles
- Find ALL regulatory information: FDA approvals, CE marks, submission timelines, compliance status
- Capture ALL safety data: adverse events, contraindications, risk assessments, monitoring requirements
- Extract ALL efficacy data: clinical outcomes, statistical significance, comparative effectiveness
- Include ALL market access: reimbursement, pricing, formulary coverage, payer negotiations
- Find ALL research data: publications, studies, investigator relationships, academic partnerships
- Be exhaustive - read the ENTIRE document content provided and extract every clinical detail

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "clinicalContext": "How this document relates to clinical/regulatory aspects of the business"
}

Be thorough in finding relevance - most healthcare business documents have clinical implications for investment analysis.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2500 // Increased for full document comprehensive extraction
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
        fullContent: content.substring(0, 2000) // Keep larger sample for reference
      };
    }
  }
  
  /**
   * Compile comprehensive answer based on all evidence
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No evidence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant clinical information found in the assigned clinical documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant clinical information found'],
        category: question.category,
        clinicalAssessment: 'Insufficient data for clinical assessment',
        recommendations: ['Request comprehensive clinical documentation'],
        clinicalRiskScore: 7, // High risk due to lack of clinical data
        efficacyMetrics: {
          primaryEndpointAchievement: null,
          statisticalSignificance: null,
          numberNeededToTreat: null,
          clinicalImprovement: null,
          confidenceInterval: null
        },
        safetyProfile: {
          adverseEventRate: null,
          severityClassification: null,
          seriousAdverseEvents: null,
          contraindicationsCount: null,
          safetyMargin: null
        },
        regulatoryAssessment: {
          approvalProbability: null,
          timelineEstimate: null,
          regulatoryPathway: null,
          precedentAnalysis: null,
          complianceStatus: null
        }
      };
    }

    // Prepare evidence summary for AI compilation
    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    // Apply Enterprise Clinical Framework
    const systemPrompt = ENTERPRISE_AGENT_PROMPTS.CLINICAL.SYSTEM_PROMPT;
    const analysisPrompt = ENTERPRISE_AGENT_PROMPTS.CLINICAL.ANALYSIS_PROMPT;
    
    const prompt = `${systemPrompt}

${analysisPrompt}

CLINICAL ANALYSIS QUESTION: "${question.question}"
CATEGORY: ${question.category}
FOCUS AREA: ${question.analysisPrompt}

CLINICAL EVIDENCE FROM DOCUMENTS:
${evidenceSummary.map(ev => `
═══ DOCUMENT: ${ev.document} ═══
CLINICAL CONTENT: ${ev.content}
KEY CLINICAL FINDINGS: ${ev.findings}
EVIDENCE CONFIDENCE: ${ev.confidence}%
`).join('\n')}

CRITICAL INSTRUCTIONS:
• Apply statistical rigor and quantitative analysis
• Calculate clinical risk score (1-10) with specific rationale
• Quantify efficacy metrics with statistical significance
• Assess safety profile with adverse event rates
• Evaluate regulatory pathway with approval probability
• Quote exact text from documents with document names
• Provide confidence intervals where applicable
• Compare to industry benchmarks with specific data

Respond in JSON format with enhanced clinical intelligence:
{
  "answer": "Comprehensive clinical analysis with quantitative evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1 with specific metrics", "Finding 2 with statistical data"],
  "gaps": ["Missing clinical data 1", "Missing regulatory info 2"],
  "recommendations": ["Evidence-based recommendation 1", "Risk mitigation 2"],
  "clinicalAssessment": "Executive summary of clinical viability with risk assessment",
  "clinicalRiskScore": 1-10,
  "efficacyMetrics": {
    "primaryEndpointAchievement": "percentage or null",
    "statisticalSignificance": "p-value and confidence interval or null",
    "numberNeededToTreat": "NNT value or null",
    "clinicalImprovement": "percentage improvement vs standard of care or null",
    "confidenceInterval": "95% CI range or null"
  },
  "safetyProfile": {
    "adverseEventRate": "percentage or null",
    "severityClassification": "mild/moderate/severe distribution or null",
    "seriousAdverseEvents": "SAE rate or null",
    "contraindicationsCount": "number of contraindications or null",
    "safetyMargin": "therapeutic window description or null"
  },
  "regulatoryAssessment": {
    "approvalProbability": "0-100 percentage or null",
    "timelineEstimate": "months/years with rationale or null",
    "regulatoryPathway": "FDA/EMA pathway description or null",
    "precedentAnalysis": "similar product precedents or null",
    "complianceStatus": "current regulatory standing or null"
  },
  "evidenceCount": ${evidence.length}
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000 // Increased for comprehensive analysis synthesis
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
        clinicalAssessment: compiledAnswer.clinicalAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence,
        clinicalRiskScore: compiledAnswer.clinicalRiskScore || 5,
        efficacyMetrics: {
          primaryEndpointAchievement: compiledAnswer.efficacyMetrics?.primaryEndpointAchievement || null,
          statisticalSignificance: compiledAnswer.efficacyMetrics?.statisticalSignificance || null,
          numberNeededToTreat: compiledAnswer.efficacyMetrics?.numberNeededToTreat || null,
          clinicalImprovement: compiledAnswer.efficacyMetrics?.clinicalImprovement || null,
          confidenceInterval: compiledAnswer.efficacyMetrics?.confidenceInterval || null
        },
        safetyProfile: {
          adverseEventRate: compiledAnswer.safetyProfile?.adverseEventRate || null,
          severityClassification: compiledAnswer.safetyProfile?.severityClassification || null,
          seriousAdverseEvents: compiledAnswer.safetyProfile?.seriousAdverseEvents || null,
          contraindicationsCount: compiledAnswer.safetyProfile?.contraindicationsCount || null,
          safetyMargin: compiledAnswer.safetyProfile?.safetyMargin || null
        },
        regulatoryAssessment: {
          approvalProbability: compiledAnswer.regulatoryAssessment?.approvalProbability || null,
          timelineEstimate: compiledAnswer.regulatoryAssessment?.timelineEstimate || null,
          regulatoryPathway: compiledAnswer.regulatoryAssessment?.regulatoryPathway || null,
          precedentAnalysis: compiledAnswer.regulatoryAssessment?.precedentAnalysis || null,
          complianceStatus: compiledAnswer.regulatoryAssessment?.complianceStatus || null
        }
      };
      
    } catch (error) {
      console.error(`Error compiling answer for "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
        recommendations: ['Manual review required'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence,
        clinicalRiskScore: 8, // High risk due to analysis failure
        efficacyMetrics: {
          primaryEndpointAchievement: null,
          statisticalSignificance: null,
          numberNeededToTreat: null,
          clinicalImprovement: null,
          confidenceInterval: null
        },
        safetyProfile: {
          adverseEventRate: null,
          severityClassification: null,
          seriousAdverseEvents: null,
          contraindicationsCount: null,
          safetyMargin: null
        },
        regulatoryAssessment: {
          approvalProbability: null,
          timelineEstimate: null,
          regulatoryPathway: null,
          precedentAnalysis: null,
          complianceStatus: null
        }
      };
    }
  }

  /**
   * Generate enterprise-grade clinical findings with quantitative metrics
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_CLINICAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // Enterprise Clinical Intelligence Findings
      if (answer.confidence > 70) {
        // Efficacy findings with quantified metrics
        if (answer.efficacyMetrics && (answer.efficacyMetrics.primaryEndpointAchievement || answer.efficacyMetrics.statisticalSignificance)) {
          findings.push({
            id: findings.length + 1,
            type: 'positive',
            content: `Clinical Efficacy Confirmed: ${answer.efficacyMetrics.primaryEndpointAchievement ? `${answer.efficacyMetrics.primaryEndpointAchievement}% primary endpoint achievement` : ''} ${answer.efficacyMetrics.statisticalSignificance || ''}`,
            source: answer.sources.length > 0 ? answer.sources[0] : 'Clinical Documents',
            confidence: answer.confidence / 100,
            category: 'efficacy_metrics',
            evidenceCount: answer.evidenceCount || 0,
            clinicalRiskScore: answer.clinicalRiskScore,
            quantitativeData: answer.efficacyMetrics
          });
        }
        
        // Safety profile findings
        if (answer.safetyProfile && (answer.safetyProfile.adverseEventRate || answer.safetyProfile.seriousAdverseEvents)) {
          findings.push({
            id: findings.length + 1,
            type: answer.safetyProfile.adverseEventRate > 30 ? 'risk' : 'positive',
            content: `Safety Profile: ${answer.safetyProfile.adverseEventRate ? `${answer.safetyProfile.adverseEventRate}% adverse event rate` : ''} ${answer.safetyProfile.seriousAdverseEvents ? `, ${answer.safetyProfile.seriousAdverseEvents}% serious adverse events` : ''}`,
            source: answer.sources.length > 0 ? answer.sources[0] : 'Clinical Documents',
            confidence: answer.confidence / 100,
            category: 'safety_profile',
            evidenceCount: answer.evidenceCount || 0,
            clinicalRiskScore: answer.clinicalRiskScore,
            quantitativeData: answer.safetyProfile
          });
        }
        
        // Regulatory assessment findings
        if (answer.regulatoryAssessment && (answer.regulatoryAssessment.approvalProbability || answer.regulatoryAssessment.timelineEstimate)) {
          findings.push({
            id: findings.length + 1,
            type: answer.regulatoryAssessment.approvalProbability > 70 ? 'positive' : 'neutral',
            content: `Regulatory Assessment: ${answer.regulatoryAssessment.approvalProbability ? `${answer.regulatoryAssessment.approvalProbability}% approval probability` : ''} ${answer.regulatoryAssessment.timelineEstimate ? `, ${answer.regulatoryAssessment.timelineEstimate} timeline` : ''}`,
            source: answer.sources.length > 0 ? answer.sources[0] : 'Clinical Documents',
            confidence: answer.confidence / 100,
            category: 'regulatory_assessment',
            evidenceCount: answer.evidenceCount || 0,
            clinicalRiskScore: answer.clinicalRiskScore,
            quantitativeData: answer.regulatoryAssessment
          });
        }
        
        // General high-confidence clinical findings
        if (!answer.efficacyMetrics?.primaryEndpointAchievement && !answer.safetyProfile?.adverseEventRate && !answer.regulatoryAssessment?.approvalProbability) {
          findings.push({
            id: findings.length + 1,
            type: 'positive',
            content: `Clinical Finding: ${answer.answer.substring(0, 150)}... (Risk Score: ${answer.clinicalRiskScore}/10)`,
            source: answer.sources.length > 0 ? answer.sources[0] : 'Clinical Documents',
            confidence: answer.confidence / 100,
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            evidenceCount: answer.evidenceCount || 0,
            clinicalRiskScore: answer.clinicalRiskScore
          });
        }
      }
      
      // High-risk findings (Clinical Risk Score >= 7 or low confidence)
      if (answer.clinicalRiskScore >= 7 || answer.confidence < 50 || (answer.gaps && answer.gaps.length > 0)) {
        findings.push({
          id: findings.length + 1,
          type: 'risk',
          content: `Clinical Risk Alert: ${answer.clinicalRiskScore >= 7 ? `High risk score (${answer.clinicalRiskScore}/10)` : ''} ${answer.gaps?.length > 0 ? `Missing: ${answer.gaps.join(', ')}` : 'Insufficient clinical data'}`,
          source: 'Clinical Risk Assessment',
          confidence: 0.3,
          category: 'clinical_risk',
          evidenceCount: answer.evidenceCount || 0,
          clinicalRiskScore: answer.clinicalRiskScore,
          riskFactors: answer.gaps || ['Insufficient clinical data']
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Generate enterprise-grade clinical recommendations with risk-based prioritization
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    // Calculate overall clinical risk assessment
    const riskScores = Object.values(answers).map(a => a.clinicalRiskScore || 5);
    const avgRiskScore = riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length;
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_CLINICAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // Enterprise clinical recommendations based on risk scoring
      if (answer.recommendations && answer.recommendations.length > 0) {
        for (const rec of answer.recommendations) {
          recommendations.push({
            title: `Clinical Intelligence: ${question.category}`,
            description: `${rec} (Clinical Risk Score: ${answer.clinicalRiskScore}/10)`,
            priority: answer.clinicalRiskScore >= 7 ? 'critical' : answer.clinicalRiskScore >= 4 ? 'high' : 'medium',
            category: 'clinical_intelligence',
            impact: answer.clinicalRiskScore >= 7 ? 'deal-breaker' : answer.clinicalRiskScore >= 4 ? 'material' : 'moderate',
            clinicalRiskScore: answer.clinicalRiskScore,
            confidence: answer.confidence,
            quantitativeData: {
              efficacyMetrics: answer.efficacyMetrics,
              safetyProfile: answer.safetyProfile,
              regulatoryAssessment: answer.regulatoryAssessment
            }
          });
        }
      }
      
      // Risk-based documentation gap recommendations
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Critical Data Gap: ${question.category}`,
          description: `Missing clinical intelligence: ${answer.gaps.join(', ')}. Immediate action required for investment decision. Risk Score: ${answer.clinicalRiskScore}/10`,
          priority: answer.clinicalRiskScore >= 7 ? 'critical' : 'high',
          category: 'clinical_data_gaps',
          impact: 'deal-breaker',
          clinicalRiskScore: answer.clinicalRiskScore,
          actionRequired: 'Request comprehensive clinical documentation and expert review',
          timeframe: answer.clinicalRiskScore >= 7 ? 'immediate' : 'within 48 hours'
        });
      }
      
      // Efficacy-specific recommendations
      if (answer.efficacyMetrics && answer.efficacyMetrics.primaryEndpointAchievement) {
        const efficacyRate = parseFloat(answer.efficacyMetrics.primaryEndpointAchievement);
        if (efficacyRate < 50) {
          recommendations.push({
            title: 'Efficacy Concern: Low Primary Endpoint Achievement',
            description: `Primary endpoint achievement of ${efficacyRate}% is below investor threshold. Consider efficacy risk mitigation strategies.`,
            priority: 'critical',
            category: 'efficacy_risk',
            impact: 'deal-breaker',
            clinicalRiskScore: answer.clinicalRiskScore,
            actionRequired: 'Detailed efficacy analysis and competitive benchmarking'
          });
        }
      }
      
      // Safety-specific recommendations
      if (answer.safetyProfile && answer.safetyProfile.adverseEventRate) {
        const aeRate = parseFloat(answer.safetyProfile.adverseEventRate);
        if (aeRate > 30) {
          recommendations.push({
            title: 'Safety Risk: High Adverse Event Rate',
            description: `Adverse event rate of ${aeRate}% exceeds acceptable safety threshold. Safety risk assessment required.`,
            priority: 'critical',
            category: 'safety_risk',
            impact: 'material',
            clinicalRiskScore: answer.clinicalRiskScore,
            actionRequired: 'Independent safety review and risk-benefit analysis'
          });
        }
      }
      
      // Regulatory-specific recommendations
      if (answer.regulatoryAssessment && answer.regulatoryAssessment.approvalProbability) {
        const approvalProb = parseFloat(answer.regulatoryAssessment.approvalProbability);
        if (approvalProb < 60) {
          recommendations.push({
            title: 'Regulatory Risk: Low Approval Probability',
            description: `Regulatory approval probability of ${approvalProb}% indicates significant regulatory risk. Enhanced regulatory strategy required.`,
            priority: 'high',
            category: 'regulatory_risk',
            impact: 'material',
            clinicalRiskScore: answer.clinicalRiskScore,
            actionRequired: 'Regulatory consultant engagement and pathway optimization'
          });
        }
      }
    }
    
    // Overall portfolio-level recommendations based on aggregate risk
    if (avgRiskScore >= 7) {
      recommendations.push({
        title: 'Portfolio Risk Alert: High Clinical Risk Profile',
        description: `Average clinical risk score of ${avgRiskScore.toFixed(1)}/10 indicates significant investment risk. Comprehensive risk mitigation strategy required.`,
        priority: 'critical',
        category: 'portfolio_risk',
        impact: 'deal-breaker',
        clinicalRiskScore: avgRiskScore,
        actionRequired: 'Executive review and enhanced due diligence',
        timeframe: 'immediate'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Store comprehensive analysis results
   */
  private async storeComprehensiveResults(
    dealId: number, 
    clinicalAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documentsAnalyzed: any[]
  ): Promise<void> {
    // First, delete any existing clinical analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'clinical')
      ));
    
    console.log(`🗑️ Cleared existing clinical analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'clinical' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      clinical_answers: clinicalAnswers, // FIXED: Store as object like Research agent (not JSON string)
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // DIAGNOSTIC: Log what we're actually saving
    console.log(`🔍 DIAGNOSTIC: Clinical answers being saved:`);
    for (const [questionId, answer] of Object.entries(clinicalAnswers)) {
      console.log(`  ${questionId}: "${answer.answer?.substring(0, 60)}..."`);
    }
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive clinical analysis for deal ${dealId} with ${Object.keys(clinicalAnswers).length} questions answered`);
  }
}

// Export the service instance
export const comprehensiveClinicalAnalysisService = new ComprehensiveClinicalAnalysisService();
