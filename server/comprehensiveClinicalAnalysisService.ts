import { storage } from './storage';
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
      // Get all documents assigned to clinical agents
      const documents = await storage.getDocumentsByDealId(dealId);
      const clinicalDocs = documents.filter(doc => 
        doc.assignedAgent && doc.assignedAgent.toLowerCase().includes('clinical')
      );

      console.log(`🧬 Found ${clinicalDocs.length} clinical documents for analysis`);

      if (clinicalDocs.length === 0) {
        this.setProgress(dealId, {
          isRunning: false,
          progress: 100,
          message: 'No clinical documents found for analysis'
        });
        return;
      }

      const clinicalAnswers: Record<string, ClinicalAnswer> = {};
      
      // Process each question with all relevant documents
      for (let i = 0; i < CLINICAL_QUESTIONS.length; i++) {
        const question = CLINICAL_QUESTIONS[i];
        const progressPercent = Math.round(((i + 1) / CLINICAL_QUESTIONS.length) * 100);
        
        this.setProgress(dealId, {
          progress: progressPercent,
          currentStep: `Analyzing: ${question.category}`,
          currentQuestion: question.question
        });

        console.log(`🧬 Processing question ${i + 1}/${CLINICAL_QUESTIONS.length}: ${question.question}`);
        
        try {
          // Find documents relevant to this question
          const relevantDocs = this.findRelevantDocuments(clinicalDocs, question.keywords);
          console.log(`🧬 Found ${relevantDocs.length} relevant documents for question: ${question.question}`);
          
          if (relevantDocs.length > 0) {
            const answer = await this.analyzeQuestionWithDocuments(question, relevantDocs);
            if (answer) {
              clinicalAnswers[question.id] = answer;
              console.log(`🧬 Generated answer for ${question.id}`);
            }
          }
        } catch (error) {
          console.error(`🧬 Error processing question ${question.id}:`, error);
          // Continue with other questions even if one fails
        }
      }

      // Store results in database
      this.setProgress(dealId, {
        progress: 95,
        currentStep: 'Storing clinical analysis results...'
      });

      const existingAnalysis = await storage.getAnalysisByDealIdAndType(dealId, 'clinical');
      
      if (existingAnalysis) {
        await storage.updateAnalysis(existingAnalysis.id, {
          ...existingAnalysis,
          results: JSON.stringify({
            clinicalAnswers,
            completedAt: new Date().toISOString(),
            questionsProcessed: Object.keys(clinicalAnswers).length,
            documentsAnalyzed: clinicalDocs.length
          })
        });
      } else {
        await storage.createAnalysis({
          dealId,
          agentType: 'clinical',
          status: 'completed',
          results: JSON.stringify({
            clinicalAnswers,
            completedAt: new Date().toISOString(),
            questionsProcessed: Object.keys(clinicalAnswers).length,
            documentsAnalyzed: clinicalDocs.length
          }),
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

  private findRelevantDocuments(documents: any[], keywords: string[]): any[] {
    return documents.filter(doc => {
      const searchText = `${doc.name} ${doc.aiSummary || ''}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
  }

  private async analyzeQuestionWithDocuments(question: any, documents: any[]): Promise<ClinicalAnswer | null> {
    try {
      console.log(`🧬 Analyzing question with ${documents.length} documents`);
      
      const detailedEvidence: ClinicalEvidence[] = [];
      
      // Process documents in batches to avoid token limits
      const batchSize = 10;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        for (const doc of batch) {
          if (!doc.aiSummary) continue;
          
          try {
            const evidence = await this.extractEvidenceFromDocument(doc, question);
            if (evidence) {
              detailedEvidence.push(evidence);
            }
          } catch (error) {
            console.error(`🧬 Error extracting evidence from ${doc.name}:`, error);
            // Continue processing other documents
          }
        }
      }

      if (detailedEvidence.length === 0) {
        console.log(`🧬 No evidence found for question: ${question.question}`);
        return null;
      }

      // Generate comprehensive answer using all evidence
      const comprehensiveAnswer = await this.generateComprehensiveAnswer(question, detailedEvidence);
      return comprehensiveAnswer;
      
    } catch (error) {
      console.error(`🧬 Error analyzing question:`, error);
      return null;
    }
  }

  private async extractEvidenceFromDocument(document: any, question: any): Promise<ClinicalEvidence | null> {
    try {
      const prompt = `You are a clinical research expert analyzing a document for specific clinical information.

Document: ${document.name}
Content: ${document.aiSummary}

Question: ${question.question}
Category: ${question.category}

Extract relevant clinical evidence for this question. Focus on:
- Specific clinical details, protocols, or findings
- Regulatory information and compliance
- Safety and efficacy data
- Patient population characteristics
- Trial design and methodology

Respond with JSON in this format:
{
  "relevantContent": ["specific relevant sentences or findings"],
  "keyFindings": ["key clinical insights"],
  "documentSummary": "brief summary of how this document relates to the question",
  "confidence": 0.8
}

If the document contains no relevant information, return: {"relevantContent": [], "keyFindings": [], "documentSummary": "", "confidence": 0}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (!result.relevantContent || result.relevantContent.length === 0) {
        return null;
      }

      return {
        documentName: document.name,
        documentSummary: result.documentSummary || '',
        relevantContent: result.relevantContent || [],
        keyFindings: result.keyFindings || [],
        confidence: result.confidence || 0.7
      };
      
    } catch (error) {
      console.error(`🧬 Error extracting evidence:`, error);
      return null;
    }
  }

  private async generateComprehensiveAnswer(question: any, evidence: ClinicalEvidence[]): Promise<ClinicalAnswer> {
    try {
      const evidenceText = evidence.map(e => 
        `Document: ${e.documentName}\nFindings: ${e.keyFindings.join(', ')}\nContent: ${e.relevantContent.join(' ')}`
      ).join('\n\n');

      const prompt = `You are a senior clinical research expert conducting comprehensive due diligence analysis.

Question: ${question.question}
Category: ${question.category}

Clinical Evidence from ${evidence.length} documents:
${evidenceText}

Provide a comprehensive clinical analysis with:
1. Direct answer to the question based on evidence
2. Clinical assessment of findings
3. Key recommendations for investors
4. Evidence summary

Respond with JSON:
{
  "answer": "direct answer to the question",
  "clinicalAssessment": "expert clinical assessment of findings",
  "keyFindings": ["key clinical findings from evidence"],
  "recommendations": ["specific recommendations for investors"],
  "evidenceSummary": "summary of evidence quality and completeness",
  "confidence": 85
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        question: question.question,
        answer: result.answer || 'No comprehensive answer available',
        confidence: result.confidence || 70,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: result.keyFindings || [],
        evidenceSummary: result.evidenceSummary || '',
        clinicalAssessment: result.clinicalAssessment || '',
        recommendations: result.recommendations || []
      };
      
    } catch (error) {
      console.error(`🧬 Error generating comprehensive answer:`, error);
      
      // Fallback answer
      return {
        question: question.question,
        answer: 'Unable to generate comprehensive answer due to processing error',
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: [],
        evidenceSummary: 'Processing error occurred',
        clinicalAssessment: 'Unable to assess',
        recommendations: []
      };
    }
  }
}

export const comprehensiveClinicalAnalysisService = new ComprehensiveClinicalAnalysisService();