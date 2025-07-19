import { storage } from './storage';
import { db } from './db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CLINICAL_QUESTIONS = [
  // Clinical Trial Protocols
  { 
    id: 'trial_1', 
    question: 'Are trial phases and designs clearly defined?', 
    category: 'Clinical Trial Protocols',
    keywords: ['phase i', 'phase ii', 'phase iii', 'randomized', 'controlled', 'blinded', 'double-blind', 'placebo', 'trial design', 'protocol', 'enrollment', 'study design']
  },
  { 
    id: 'trial_2', 
    question: 'What are primary and secondary endpoints?', 
    category: 'Clinical Trial Protocols',
    keywords: ['primary endpoint', 'secondary endpoint', 'efficacy endpoint', 'primary outcome', 'secondary outcome', 'clinical endpoint', 'surrogate endpoint']
  },
  { 
    id: 'trial_3', 
    question: 'How is efficacy/safety assessed?', 
    category: 'Clinical Trial Protocols',
    keywords: ['safety', 'efficacy', 'adverse events', 'side effects', 'toxicity', 'dose limiting', 'safety monitoring', 'dsmb', 'safety committee']
  },
  // Regulatory Filings
  { 
    id: 'regulatory_1', 
    question: 'What is current approval status?', 
    category: 'Regulatory Filings (FDA, EMA)',
    keywords: ['fda', 'ema', 'regulatory', 'approval', 'clearance', '510k', 'pma', 'ide', 'ind', 'regulatory submission', 'marketing authorization']
  },
  { 
    id: 'regulatory_2', 
    question: 'Are fast-track or orphan designations received?', 
    category: 'Regulatory Filings (FDA, EMA)',
    keywords: ['fast track', 'fast-track', 'orphan drug', 'breakthrough therapy', 'priority review', 'accelerated approval', 'rare disease', 'orphan designation']
  },
  { 
    id: 'regulatory_3', 
    question: 'Are adverse events disclosed?', 
    category: 'Regulatory Filings (FDA, EMA)',
    keywords: ['adverse events', 'adverse event', 'sae', 'serious adverse event', 'aesi', 'medwatch', 'safety report', 'susar']
  },
  // Investigator Brochures & Study Reports
  { 
    id: 'study_1', 
    question: 'Are inclusion/exclusion criteria consistent?', 
    category: 'Investigator Brochures & Study Reports',
    keywords: ['inclusion criteria', 'exclusion criteria', 'patient selection', 'eligibility', 'enrollment criteria', 'screening']
  },
  { 
    id: 'study_2', 
    question: 'What patient population is used?', 
    category: 'Investigator Brochures & Study Reports',
    keywords: ['patient population', 'demographics', 'disease stage', 'severity', 'baseline characteristics', 'target population']
  },
  { 
    id: 'study_3', 
    question: 'Are SAE (Serious Adverse Events) tracked?', 
    category: 'Investigator Brochures & Study Reports',
    keywords: ['serious adverse event', 'sae', 'adverse event reporting', 'safety signal', 'causality', 'safety profile']
  },
  // Scientific Advisory Board Notes
  { 
    id: 'advisory_1', 
    question: 'Are trial results debated by experts?', 
    category: 'Scientific Advisory Board Notes',
    keywords: ['advisory board', 'expert opinion', 'scientific advisory', 'kol', 'key opinion leader', 'expert review', 'scientific review']
  },
  { 
    id: 'advisory_2', 
    question: 'Are post-trial steps (e.g. Phase 3 readiness) described?', 
    category: 'Scientific Advisory Board Notes',
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

class ComprehensiveClinicalAnalysisService {
  private progressData: Map<number, ClinicalAnalysisProgress> = new Map();

  getProgress(dealId: number): ClinicalAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No comprehensive clinical analysis running' 
    };
  }

  private setProgress(dealId: number, progress: Partial<ClinicalAnalysisProgress>) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
  }

  async startComprehensiveAnalysis(dealId: number): Promise<void> {
    console.log(`🧬 Starting comprehensive clinical analysis for deal ${dealId}`);
    
    this.setProgress(dealId, {
      isRunning: true,
      progress: 5,
      message: 'Initializing comprehensive clinical analysis...',
      currentStep: 'Finding clinical documents',
      totalSteps: CLINICAL_QUESTIONS.length
    });

    try {
      // Get all documents suitable for clinical analysis (same approach as Legal)
      const clinicalDocs = await this.getAssignedClinicalDocuments(dealId);
      console.log(`🧬 Found ${clinicalDocs.length} clinical documents for analysis`);

      if (clinicalDocs.length === 0) {
        this.setProgress(dealId, {
          isRunning: false,
          progress: 100,
          message: 'No clinical documents found for analysis'
        });
        throw new Error('No documents available for clinical analysis');
      }

      // Process each question comprehensively with enhanced error handling (same as Legal)
      const clinicalAnswers: Record<string, any> = {};
      
      for (let i = 0; i < CLINICAL_QUESTIONS.length; i++) {
        const question = CLINICAL_QUESTIONS[i];
        console.log(`🧬 Processing question ${i + 1}/${CLINICAL_QUESTIONS.length}: ${question.question}`);
        
        try {
          // Update progress with error handling
          const progress = Math.round((i / CLINICAL_QUESTIONS.length) * 100);
          this.setProgress(dealId, {
            progress,
            currentStep: `Analyzing: ${question.category}`,
            currentQuestion: question.question
          });
          
          // Extract evidence from ALL clinical documents for this question (same as Legal)
          console.log(`🧬 Processing ${clinicalDocs.length} documents for question: ${question.question}`);
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            clinicalDocs, 
            question
          );
          console.log(`🧬 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer based on all evidence
          const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
          clinicalAnswers[question.id] = answer;
          
          console.log(`✅ Completed question ${i + 1}/${CLINICAL_QUESTIONS.length}: ${question.question}`);
          
        } catch (error) {
          console.error(`❌ Error processing question ${question.id}:`, error);
          
          // Create fallback answer for failed question (same as Legal)
          clinicalAnswers[question.id] = {
            question: question.question,
            answer: `Analysis failed for this question due to processing error: ${error.message}`,
            confidence: 0,
            sources: [],
            evidenceCount: 0,
            documentsCovered: 0,
            error: error.message
          };
        }
      }

      // Store results in database (same format as legal analysis)
      this.setProgress(dealId, {
        progress: 95,
        currentStep: 'Storing clinical analysis results...'
      });

      // Generate findings and recommendations from clinical answers (same as legal)
      const findings = [];
      const recommendations = [];
      
      for (const [questionId, answer] of Object.entries(clinicalAnswers)) {
        if (answer.keyFindings && answer.keyFindings.length > 0) {
          findings.push(...answer.keyFindings.map(finding => ({
            id: findings.length + 1,
            type: 'positive',
            content: finding,
            source: answer.sources?.[0] || 'Clinical Analysis',
            confidence: answer.confidence || 85,
            category: questionId,
            evidenceCount: answer.evidenceCount || 0
          })));
        }
        
        if (answer.recommendations && answer.recommendations.length > 0) {
          recommendations.push(...answer.recommendations.map(rec => ({
            id: recommendations.length + 1,
            type: 'clinical',
            content: rec,
            source: 'Clinical Analysis',
            confidence: answer.confidence || 85,
            category: questionId
          })));
        }
      }

      const existingAnalysis = await storage.getAnalysisByDealAndAgent(dealId, 'clinical');
      
      if (existingAnalysis) {
        await storage.updateAnalysis(existingAnalysis.id, {
          ...existingAnalysis,
          clinicalAnswers: JSON.stringify(clinicalAnswers),
          findings: JSON.stringify(findings),
          recommendations: JSON.stringify(recommendations),
          status: 'completed',
          progress: 100,
          questionsAnswered: Object.keys(clinicalAnswers).length,
          totalQuestions: CLINICAL_QUESTIONS.length,
          completionRate: Math.round((Object.keys(clinicalAnswers).length / CLINICAL_QUESTIONS.length) * 100)
        });
      } else {
        await storage.createAnalysis({
          dealId,
          agentType: 'clinical',
          status: 'completed',
          progress: 100,
          clinicalAnswers: JSON.stringify(clinicalAnswers),
          findings: JSON.stringify(findings),
          recommendations: JSON.stringify(recommendations),
          questionsAnswered: Object.keys(clinicalAnswers).length,
          totalQuestions: CLINICAL_QUESTIONS.length,
          completionRate: Math.round((Object.keys(clinicalAnswers).length / CLINICAL_QUESTIONS.length) * 100),
          createdAt: new Date()
        });
      }

      this.setProgress(dealId, {
        isRunning: false,
        progress: 100,
        message: `Comprehensive clinical analysis completed - ${Object.keys(clinicalAnswers).length} questions answered`
      });

      console.log(`🧬 Comprehensive clinical analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`🧬 Error in comprehensive clinical analysis:`, error);
      this.setProgress(dealId, {
        isRunning: false,
        progress: 0,
        message: 'Clinical analysis failed: ' + (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Extract evidence from ALL documents for a specific question (same as Legal)
   */
  private async extractEvidenceFromAllDocuments(documents: any[], question: any): Promise<any[]> {
    console.log(`🧬 Starting evidence extraction from ${documents.length} documents for question: ${question.question}`);
    
    const evidence: any[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming the API
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documents.length / batchSize);
      
      console.log(`🧬 Processing batch ${batchNumber}/${totalBatches} (${batch.length} documents)`);
      
      // Process batch in parallel for efficiency
      const batchPromises = batch.map(async (doc) => {
        try {
          return await this.extractEvidenceFromDocument(doc, question);
        } catch (error) {
          console.error(`🧬 Error processing document ${doc.name}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out null results and add to evidence
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
   * Extract specific evidence from a single document (same as Legal)
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `You are a clinical research analyst. Analyze this document for specific clinical information.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

ANALYSIS TASK: ${question.analysisPrompt || question.question}

Extract specific evidence that answers the question: "${question.question}"

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question"
}

Only extract actual content from the document. If no relevant information is found, set hasRelevantInfo to false.`;

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
   * Compile comprehensive answer based on all evidence (same as Legal)
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No evidence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant information found in the assigned clinical documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        documentsCovered: 0
      };
    }
    
    // Filter evidence with relevant information
    const relevantEvidence = evidence.filter(e => e.hasRelevantInfo);
    console.log(`📋 Relevant evidence count: ${relevantEvidence.length}`);
    
    // Prepare evidence summary for AI analysis
    const evidenceSummary = relevantEvidence.map((e, index) => 
      `Document ${index + 1}: ${e.documentName}
      Key Findings: ${e.keyFindings.join(', ')}
      Content Excerpts: ${e.relevantContent.join(' | ')}
      Summary: ${e.documentSummary}
      Confidence: ${e.confidence}%`
    ).join('\n\n');
    
    const prompt = `You are a senior clinical research expert conducting comprehensive due diligence analysis.

QUESTION: ${question.question}
CATEGORY: ${question.category}

CLINICAL EVIDENCE from ${relevantEvidence.length} documents:
${evidenceSummary}

Provide a comprehensive clinical analysis including:
1. Direct answer to the question based on the evidence
2. Clinical assessment and risk evaluation  
3. Key recommendations for investors
4. Summary of evidence quality and completeness

Respond in JSON format:
{
  "answer": "Comprehensive answer based on evidence",
  "confidence": 85,
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "riskAssessment": "Clinical risk evaluation",
  "evidenceSummary": "Summary of evidence quality"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        answer: analysis.answer || 'Analysis completed but no specific answer generated.',
        confidence: analysis.confidence || 70,
        keyFindings: analysis.keyFindings || [],
        recommendations: analysis.recommendations || [],
        riskAssessment: analysis.riskAssessment || '',
        evidenceSummary: analysis.evidenceSummary || '',
        sources: relevantEvidence.map(e => ({
          documentName: e.documentName,
          documentId: e.documentId,
          relevantContent: e.relevantContent,
          keyFindings: e.keyFindings
        })),
        evidenceCount: evidence.length,
        documentsCovered: relevantEvidence.length
      };
      
    } catch (error) {
      console.error(`Error compiling comprehensive answer:`, error);
      
      return {
        question: question.question,
        answer: `Analysis completed with ${relevantEvidence.length} relevant documents found, but final synthesis failed due to processing error.`,
        confidence: 50,
        sources: relevantEvidence.map(e => ({
          documentName: e.documentName,
          relevantContent: e.relevantContent,
          keyFindings: e.keyFindings
        })),
        evidenceCount: evidence.length,
        documentsCovered: relevantEvidence.length,
        error: error.message
      };
    }
  }

  /**
   * Get all documents suitable for clinical analysis (IDENTICAL approach to Legal - uses DB directly)
   */
  private async getAssignedClinicalDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`🧬 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to clinical agent
    let clinicalDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('clinical')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`🧬 Documents explicitly assigned to clinical: ${clinicalDocuments.length}`);
    
    // If no documents are explicitly assigned to clinical, identify clinical-related documents
    if (clinicalDocuments.length === 0) {
      console.log('🧬 No documents explicitly assigned to clinical agent, identifying clinical-related documents...');
      
      clinicalDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Clinical document keywords
        const clinicalKeywords = [
          'trial', 'phase', 'clinical', 'regulatory', 'fda', 'ema', 'endpoint', 
          'efficacy', 'safety', 'adverse', 'patient', 'study', 'protocol',
          'approval', 'designation', 'orphan', 'breakthrough', 'inclusion',
          'exclusion', 'population', 'advisory', 'sae', 'serious adverse',
          'medical', 'therapy', 'treatment', 'drug', 'device', 'biologics',
          'investigator', 'brochure', 'report', 'clinical trial', 'clinical study'
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
      
      console.log(`🧬 Auto-identified clinical documents: ${clinicalDocuments.length}`);
    }
    
    // If still no clinical documents, take documents with meaningful content for analysis
    if (clinicalDocuments.length === 0) {
      console.log('🧬 No clinical-related documents found, using all documents with OCR text...');
      clinicalDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`🧬 Documents with content available: ${clinicalDocuments.length}`);
    }
    
    return clinicalDocuments;
  }




}

export const comprehensiveClinicalAnalysisService = new ComprehensiveClinicalAnalysisService();