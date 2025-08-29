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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced clinical questions for comprehensive analysis
export const COMPREHENSIVE_CLINICAL_QUESTIONS = [
  // Clinical Trial Protocols
  { 
    id: 'trial_1', 
    question: 'Are trial phases and designs clearly defined?', 
    category: 'Clinical Trial Protocols',
    analysisPrompt: 'Identify clinical trial phases, study designs, randomization methods, blinding procedures, and protocol structure.',
    keywords: ['phase i', 'phase ii', 'phase iii', 'randomized', 'controlled', 'blinded', 'double-blind', 'placebo', 'trial design', 'protocol', 'enrollment', 'study design']
  },
  { 
    id: 'trial_2', 
    question: 'What are primary and secondary endpoints?', 
    category: 'Clinical Trial Protocols',
    analysisPrompt: 'Identify primary and secondary endpoints, efficacy measures, clinical outcomes, and endpoint definitions.',
    keywords: ['primary endpoint', 'secondary endpoint', 'efficacy endpoint', 'primary outcome', 'secondary outcome', 'clinical endpoint', 'surrogate endpoint']
  },
  { 
    id: 'trial_3', 
    question: 'How is efficacy/safety assessed?', 
    category: 'Clinical Trial Protocols',
    analysisPrompt: 'Find safety and efficacy assessment methods, adverse event reporting, toxicity monitoring, and safety committees.',
    keywords: ['safety', 'efficacy', 'adverse events', 'side effects', 'toxicity', 'dose limiting', 'safety monitoring', 'dsmb', 'safety committee']
  },
  // Regulatory Filings
  { 
    id: 'regulatory_1', 
    question: 'What is current approval status?', 
    category: 'Regulatory Filings (FDA, EMA)',
    analysisPrompt: 'Identify regulatory approval status, FDA/EMA submissions, clearances, and marketing authorizations.',
    keywords: ['fda', 'ema', 'regulatory', 'approval', 'clearance', '510k', 'pma', 'ide', 'ind', 'regulatory submission', 'marketing authorization']
  },
  { 
    id: 'regulatory_2', 
    question: 'Are fast-track or orphan designations received?', 
    category: 'Regulatory Filings (FDA, EMA)',
    analysisPrompt: 'Look for special regulatory designations like fast-track, orphan drug, breakthrough therapy, or priority review status.',
    keywords: ['fast track', 'fast-track', 'orphan drug', 'breakthrough therapy', 'priority review', 'accelerated approval', 'rare disease', 'orphan designation']
  },
  { 
    id: 'regulatory_3', 
    question: 'Are adverse events disclosed?', 
    category: 'Regulatory Filings (FDA, EMA)',
    analysisPrompt: 'Find adverse event reporting, safety disclosures, serious adverse events, and safety monitoring reports.',
    keywords: ['adverse events', 'adverse event', 'sae', 'serious adverse event', 'aesi', 'medwatch', 'safety report', 'susar']
  },
  // Investigator Brochures & Study Reports
  { 
    id: 'study_1', 
    question: 'Are inclusion/exclusion criteria consistent?', 
    category: 'Investigator Brochures & Study Reports',
    analysisPrompt: 'Analyze inclusion and exclusion criteria for patient selection, eligibility requirements, and enrollment consistency.',
    keywords: ['inclusion criteria', 'exclusion criteria', 'patient selection', 'eligibility', 'enrollment criteria', 'screening']
  },
  { 
    id: 'study_2', 
    question: 'What patient population is used?', 
    category: 'Investigator Brochures & Study Reports',
    analysisPrompt: 'Identify patient demographics, disease characteristics, severity levels, and target population definitions.',
    keywords: ['patient population', 'demographics', 'disease stage', 'severity', 'baseline characteristics', 'target population']
  },
  { 
    id: 'study_3', 
    question: 'Are SAE (Serious Adverse Events) tracked?', 
    category: 'Investigator Brochures & Study Reports',
    analysisPrompt: 'Find serious adverse event tracking, safety monitoring procedures, and causality assessment methods.',
    keywords: ['serious adverse event', 'sae', 'adverse event reporting', 'safety signal', 'causality', 'safety profile']
  },
  // Scientific Advisory Board Notes
  { 
    id: 'advisory_1', 
    question: 'Are trial results debated by experts?', 
    category: 'Scientific Advisory Board Notes',
    analysisPrompt: 'Look for expert opinions, advisory board reviews, KOL feedback, and scientific discussions about trial results.',
    keywords: ['advisory board', 'expert opinion', 'scientific advisory', 'kol', 'key opinion leader', 'expert review', 'scientific review']
  },
  { 
    id: 'advisory_2', 
    question: 'Are post-trial steps (e.g. Phase 3 readiness) described?', 
    category: 'Scientific Advisory Board Notes',
    analysisPrompt: 'Look for development plans, phase 3 readiness, regulatory strategies, and next steps in clinical development.',
    keywords: ['phase 3', 'phase iii', 'next steps', 'development plan', 'regulatory strategy', 'go/no-go', 'pivotal trial']
  }
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
   * Get all documents suitable for clinical analysis
   */
  private async getAssignedClinicalDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
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
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
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
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Look for DIRECT clinical terms, trial data, regulatory submissions, safety reports
- Look for INDIRECT references to medical devices, therapeutics, patient outcomes, regulatory milestones
- Consider business documents that mention clinical milestones, regulatory matters, safety data
- Even general business context often has clinical implications for investment due diligence
- For healthcare companies, most business documents contain clinical information relevant to investors

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
        category: question.category
      };
    }

    // Prepare evidence summary for AI compilation
    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    const prompt = `You are an expert clinical research analyst compiling a comprehensive answer based on evidence from multiple documents.

QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS TASK: ${question.analysisPrompt}

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
5. Include clinical recommendations

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "clinicalAssessment": "Overall clinical assessment based on evidence",
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
        clinicalAssessment: compiledAnswer.clinicalAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
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
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_CLINICAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Clinical Documents',
          confidence: answer.confidence / 100,
          category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          evidenceCount: answer.evidenceCount || 0
        });
      }
      
      // Risk findings for low confidence or gaps
      if (answer.confidence < 50 || (answer.gaps && answer.gaps.length > 0)) {
        findings.push({
          id: findings.length + 1,
          type: 'risk',
          content: `Insufficient clinical information for: ${question.question}. Additional documentation may be required.`,
          source: 'Clinical Analysis',
          confidence: 0.3,
          category: 'gaps',
          evidenceCount: answer.evidenceCount || 0
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Generate comprehensive recommendations
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer.recommendations && answer.recommendations.length > 0) {
        for (const rec of answer.recommendations) {
          recommendations.push({
            title: `Clinical Due Diligence: ${answer.question}`,
            description: rec,
            priority: answer.confidence < 60 ? 'high' : 'medium',
            category: 'clinical',
            impact: answer.confidence < 40 ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Documentation Gap: ${answer.question}`,
          description: `Missing clinical information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'clinical',
          impact: 'critical'
        });
      }
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
      clinicalAnswers: JSON.stringify(clinicalAnswers),
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive clinical analysis for deal ${dealId} with ${Object.keys(clinicalAnswers).length} questions answered`);
  }
}

// Export the service instance
export const comprehensiveClinicalAnalysisService = new ComprehensiveClinicalAnalysisService();
