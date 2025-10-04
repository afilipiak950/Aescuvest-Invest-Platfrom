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
   * BUILD COMPREHENSIVE CONTENT FROM AI SUMMARY
   * Extracts ALL sections of AI summary for maximum context
   */
  private buildComprehensiveContent(document: any): string {
    const parts = [];
    
    // PRIORITY 1: AI Summary (FULL STRUCTURE - all sections)
    if (document.aiSummary) {
      console.log(`📝 Using AI Summary for ${document.name} - Full structure extraction`);
      
      if (document.aiSummary.executiveSummary) {
        parts.push(`=== EXECUTIVE SUMMARY ===\n${document.aiSummary.executiveSummary}`);
      }
      
      if (document.aiSummary.criticalInformation) {
        const criticalInfo = typeof document.aiSummary.criticalInformation === 'string' 
          ? document.aiSummary.criticalInformation 
          : JSON.stringify(document.aiSummary.criticalInformation, null, 2);
        parts.push(`=== CRITICAL INFORMATION ===\n${criticalInfo}`);
      }
      
      if (document.aiSummary.keyFinancialData) {
        const financialData = typeof document.aiSummary.keyFinancialData === 'string'
          ? document.aiSummary.keyFinancialData
          : JSON.stringify(document.aiSummary.keyFinancialData, null, 2);
        parts.push(`=== KEY FINANCIAL DATA ===\n${financialData}`);
      }
      
      if (document.aiSummary.riskAssessment) {
        const riskData = typeof document.aiSummary.riskAssessment === 'string'
          ? document.aiSummary.riskAssessment
          : JSON.stringify(document.aiSummary.riskAssessment, null, 2);
        parts.push(`=== RISK ASSESSMENT ===\n${riskData}`);
      }
      
      if (document.aiSummary.backgroundInformation) {
        parts.push(`=== BACKGROUND INFORMATION ===\n${document.aiSummary.backgroundInformation}`);
      }
      
      if (document.aiSummary.documentType) {
        parts.push(`=== DOCUMENT TYPE ===\n${document.aiSummary.documentType}`);
      }
    }
    
    // PRIORITY 2: OCR Text (FALLBACK ONLY - increased to 8000 chars)
    if (parts.length === 0 && document.ocrText) {
      console.log(`📝 Falling back to OCR text for ${document.name} (AI summary not available)`);
      parts.push(`=== DOCUMENT TEXT ===\n${document.ocrText.substring(0, 8000)}`);
    }
    
    const content = parts.join('\n\n');
    console.log(`📊 Content built for ${document.name}: ${content.length} characters from ${parts.length} sections`);
    return content;
  }
  
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
    
    // 🚀 IMPROVEMENT: Remove 50-document cap - analyze ALL assigned documents
    // AI summaries are much shorter than OCR, enabling analysis of all documents
    console.log(`📊 QA CHECKPOINT: Will analyze ALL ${clinicalDocuments.length} clinical documents (no artificial limit)`);
    
    // Log AI summary vs OCR distribution for quality assurance
    const withAiSummary = clinicalDocuments.filter(doc => doc.aiSummary).length;
    const withOcrOnly = clinicalDocuments.filter(doc => !doc.aiSummary && doc.ocrText).length;
    const empty = clinicalDocuments.filter(doc => !doc.aiSummary && !doc.ocrText).length;
    
    console.log(`📊 QA CHECKPOINT - Document Quality Distribution:`);
    console.log(`  ✅ ${withAiSummary} documents with AI Summary (${Math.round(withAiSummary/clinicalDocuments.length*100)}%)`);
    console.log(`  📄 ${withOcrOnly} documents with OCR only (${Math.round(withOcrOnly/clinicalDocuments.length*100)}%)`);
    console.log(`  ⚠️  ${empty} empty documents (${Math.round(empty/clinicalDocuments.length*100)}%)`);
    
    return clinicalDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question
   * 🚀 IMPROVEMENT: Increased batch size, added error resilience
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // 🚀 IMPROVEMENT: Increased batch size from 10 to 20 (AI summaries are shorter)
    const BATCH_SIZE = 20;
    const evidence = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(documents.length / BATCH_SIZE);
      
      console.log(`📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} documents`);
      
      // 🚀 IMPROVEMENT: Use Promise.allSettled for error resilience
      const batchResults = await Promise.allSettled(
        batch.map(async (doc) => {
          try {
            return await this.extractEvidenceFromDocument(doc, question);
          } catch (error) {
            console.error(`❌ Failed to extract from ${doc.name}:`, error);
            return null;
          }
        })
      );
      
      // Filter successful results with relevant content
      const validEvidence = batchResults
        .filter(result => result.status === 'fulfilled' && result.value?.relevantContent?.length > 0)
        .map(result => result.value);
      
      const batchSuccesses = batchResults.filter(r => r.status === 'fulfilled').length;
      const batchFailures = batchResults.filter(r => r.status === 'rejected').length;
      
      successCount += batchSuccesses;
      failureCount += batchFailures;
      
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${batchNum} completed: ${validEvidence.length}/${batch.length} had relevant evidence (${batchFailures} failures)`);
      
      // 🚀 IMPROVEMENT: Rate limiting between batches (1 second)
      if (i + BATCH_SIZE < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`📊 QA CHECKPOINT - Extraction Results: ${evidence.length}/${documents.length} documents with evidence (${successCount} success, ${failureCount} failures)`);
    
    // Alert if >20% failure rate
    if (failureCount / documents.length > 0.2) {
      console.warn(`⚠️  HIGH FAILURE RATE: ${Math.round(failureCount/documents.length*100)}% of documents failed extraction`);
    }
    
    return evidence;
  }
  
  /**
   * Extract specific evidence from a single document
   * 🚀 IMPROVEMENT: Uses full AI summary structure + enhanced prompt
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    // 🚀 IMPROVEMENT: Use comprehensive content builder (AI summary priority)
    const content = this.buildComprehensiveContent(document);
    
    if (!content || content.length < 50) {
      console.log(`⚠️ Skipping ${document.name} - insufficient content`);
      return null;
    }
    
    // 🚀 IMPROVEMENT: Enhanced prompt with clinical metrics extraction
    const prompt = `You are a senior clinical development analyst conducting FDA/EMA-level due diligence. This document has been pre-analyzed with AI summary extraction.

DOCUMENT: ${document.name}

=== PRE-EXTRACTED AI SUMMARY ===
${content}

=== CLINICAL QUESTION ===
"${question.question}"

ANALYSIS TASK: ${question.analysisPrompt}

KEYWORDS TO PRIORITIZE: ${question.keywords.join(', ')}

INSTRUCTIONS:
1. **Prioritize AI Summary Sections:**
   - Critical Information section contains pre-extracted key data
   - Risk Assessment section contains pre-identified risks
   - Financial Data section contains quantified metrics
   
2. **Extract with Clinical Precision:**
   - Trial phases (Phase I/II/III/IV)
   - Patient numbers (N=X enrolled, Y completed)
   - Efficacy metrics (p-values, confidence intervals, effect sizes)
   - Safety signals (SAE rates, discontinuation rates)
   - Regulatory milestones (FDA submissions, EMA approvals)
   
3. **Confidence Scoring:**
   - 90-100: Direct clinical data with statistics
   - 70-89: Clear clinical findings without full statistics
   - 50-69: Indirect clinical relevance
   - Below 50: Minimal clinical relevance

Return JSON:
{
  "relevantContent": ["Exact quote 1 with context", "Exact quote 2 with context"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1 with specificity", "Finding 2 with numbers"],
  "documentSummary": "Clinical relevance summary",
  "clinicalMetrics": {
    "trialPhase": "Phase I/II/III/IV or null",
    "patientNumbers": "N=X or null",
    "efficacyData": "Primary endpoint result or null",
    "safetyData": "SAE rate or key safety finding or null"
  },
  "dataQuality": "high/medium/low",
  "missingCriticalInfo": ["What's missing for complete clinical assessment"]
}

Be thorough and extract specific numbers, percentages, and clinical metrics.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // 🚀 IMPROVEMENT: Return enhanced evidence with clinical metrics
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: analysis.relevantContent || [],
        hasRelevantInfo: analysis.hasRelevantInfo || false,
        confidence: analysis.confidence || 0,
        keyFindings: analysis.keyFindings || [],
        documentSummary: analysis.documentSummary || '',
        clinicalMetrics: analysis.clinicalMetrics || {},
        dataQuality: analysis.dataQuality || 'unknown',
        missingCriticalInfo: analysis.missingCriticalInfo || [],
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
        clinicalMetrics: {},
        dataQuality: 'low',
        missingCriticalInfo: ['Extraction failed'],
        fullContent: ''
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

    // 🚀 IMPROVEMENT: Enhanced evidence summary with clinical metrics
    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' | '),
      findings: ev.keyFindings.join(' | '),
      confidence: ev.confidence,
      clinicalMetrics: ev.clinicalMetrics || {},
      dataQuality: ev.dataQuality || 'unknown',
      missingInfo: ev.missingCriticalInfo || []
    }));

    // 🚀 IMPROVEMENT: Enhanced compilation prompt with clinical metrics aggregation
    const prompt = `You are a senior clinical analyst preparing FDA-level due diligence.

QUESTION: "${question.question}"
CATEGORY: ${question.category}

EVIDENCE FROM ${evidence.length} DOCUMENTS:
${evidenceSummary.map((ev, idx) => `
[DOCUMENT ${idx + 1}]: ${ev.document}
- Relevant Content: ${ev.content}
- Key Findings: ${ev.findings}
- Clinical Metrics: ${JSON.stringify(ev.clinicalMetrics)}
- Data Quality: ${ev.dataQuality}
- Confidence: ${ev.confidence}%
- Missing Info: ${ev.missingInfo.join(', ')}
`).join('\n')}

SYNTHESIS INSTRUCTIONS:
1. **Aggregate All Evidence** - Don't miss any document or finding
2. **Quantify Clinical Data:**
   - Count: How many trials/patients/endpoints mentioned across all documents?
   - Metrics: What are the efficacy/safety numbers?
   - Timeline: What phases/milestones completed?
   
3. **Risk Assessment:**
   - Red flags: Safety signals, regulatory issues, data quality concerns
   - Yellow flags: Incomplete data, small sample sizes, missing critical info
   - Green signals: Strong efficacy, regulatory progress, high data quality
   
4. **Data Completeness:**
   - What's present across documents?
   - What's missing but should be there?
   - What additional documents are needed?

Return JSON:
{
  "answer": "Comprehensive clinical answer with specific data points and document citations",
  "confidence": 0-100,
  "sources": ["All document names"],
  "keyFindings": ["Finding 1 with numbers", "Finding 2 with specifics"],
  "clinicalSummary": {
    "trialsIdentified": 0,
    "patientsEnrolled": "N=X total across studies",
    "regulatoryStatus": "FDA/EMA status summary",
    "safetyProfile": "SAE summary with rates",
    "efficacyOutcomes": "Primary endpoint results"
  },
  "riskFactors": ["Risk 1 with severity", "Risk 2"],
  "positiveSignals": ["Positive 1", "Positive 2"],
  "gaps": ["Missing info 1", "Missing info 2"],
  "recommendations": ["Actionable recommendation 1", "Recommendation 2"],
  "evidenceStrength": "strong/moderate/weak",
  "dataQualityAssessment": "Assessment of overall data quality across documents"
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
      
      // 🚀 IMPROVEMENT: Return enhanced answer with clinical summary
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        clinicalSummary: compiledAnswer.clinicalSummary || {},
        riskFactors: compiledAnswer.riskFactors || [],
        positiveSignals: compiledAnswer.positiveSignals || [],
        evidenceStrength: compiledAnswer.evidenceStrength || 'unknown',
        dataQualityAssessment: compiledAnswer.dataQualityAssessment || '',
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
        clinicalSummary: {},
        riskFactors: ['Compilation error'],
        positiveSignals: [],
        evidenceStrength: 'unknown',
        dataQualityAssessment: 'Unable to assess due to compilation error',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings
   * 🚀 IMPROVEMENT: Enhanced to include clinical data, risk factors, and severity
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_CLINICAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // 🚀 IMPROVEMENT: High confidence findings with clinical data (>80%)
      if (answer.confidence > 80 && answer.evidenceStrength === 'strong') {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          severity: 'high',
          content: answer.answer,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Clinical Documents',
          confidence: answer.confidence / 100,
          category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          evidenceCount: answer.evidenceCount || 0,
          clinicalData: answer.clinicalSummary || {},
          dataQuality: answer.dataQualityAssessment || 'unknown'
        });
      }
      
      // 🚀 IMPROVEMENT: Positive signals findings
      if (answer.positiveSignals && answer.positiveSignals.length > 0) {
        answer.positiveSignals.forEach(signal => {
          findings.push({
            id: findings.length + 1,
            type: 'positive',
            severity: 'medium',
            content: signal,
            source: answer.sources.join(', '),
            confidence: answer.confidence / 100,
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            evidenceCount: answer.evidenceCount || 0
          });
        });
      }
      
      // 🚀 IMPROVEMENT: Risk factors findings
      if (answer.riskFactors && answer.riskFactors.length > 0) {
        answer.riskFactors.forEach(risk => {
          findings.push({
            id: findings.length + 1,
            type: 'risk',
            severity: answer.confidence > 70 ? 'high' : 'medium',
            content: risk,
            source: answer.sources.join(', '),
            confidence: answer.confidence / 100,
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            evidenceCount: answer.evidenceCount || 0
          });
        });
      }
      
      // 🚀 IMPROVEMENT: Data gap findings
      if (answer.gaps && answer.gaps.length > 0) {
        findings.push({
          id: findings.length + 1,
          type: 'gap',
          severity: 'medium',
          content: `Missing ${question.category} data: ${answer.gaps.join(', ')}`,
          source: 'Clinical Analysis',
          confidence: 0.3,
          category: 'data_gaps',
          evidenceCount: answer.evidenceCount || 0,
          recommendations: answer.recommendations || []
        });
      }
    }
    
    console.log(`📊 Generated ${findings.length} comprehensive clinical findings`);
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
