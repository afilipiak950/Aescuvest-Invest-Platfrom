import { storage } from './storage';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// IP Questions based on user requirements
const IP_QUESTIONS = [
  {
    id: 'patents_1',
    category: 'Patent Applications / Grants',
    question: 'What jurisdictions are covered?',
    analysisPrompt: 'Find patent applications and grants, identify the jurisdictions (countries/regions) where patents are filed or granted. Look for PCT applications, national phase entries, and specific country filings.'
  },
  {
    id: 'patents_2', 
    category: 'Patent Applications / Grants',
    question: 'What is the legal status (granted, pending, expired)?',
    analysisPrompt: 'Identify the current legal status of patents - whether they are granted, pending application, expired, abandoned, or under examination. Look for patent office communications and status updates.'
  },
  {
    id: 'patents_3',
    category: 'Patent Applications / Grants', 
    question: 'What is the remaining protection duration?',
    analysisPrompt: 'Calculate or find information about remaining patent protection duration, patent expiry dates, maintenance fee status, and term extensions.'
  },
  {
    id: 'patents_4',
    category: 'Patent Applications / Grants',
    question: 'Is freedom-to-operate (FTO) mentioned?',
    analysisPrompt: 'Look for freedom-to-operate analysis, FTO studies, patent landscape analysis, or clearance opinions that assess risk of patent infringement.'
  },
  {
    id: 'trademarks_1',
    category: 'Trademark Registrations',
    question: 'Which classes are covered?',
    analysisPrompt: 'Identify trademark classes (Nice Classification) covered by trademark registrations, including goods and services classifications.'
  },
  {
    id: 'trademarks_2',
    category: 'Trademark Registrations',
    question: 'Are oppositions pending?',
    analysisPrompt: 'Find any pending trademark oppositions, cancellation proceedings, or disputes related to trademark registrations.'
  },
  {
    id: 'trademarks_3',
    category: 'Trademark Registrations',
    question: 'Are brand extensions protected?',
    analysisPrompt: 'Look for trademark protection of brand extensions, product variants, or related brand elements beyond the core trademark.'
  },
  {
    id: 'licenses_1',
    category: 'License Agreements (Inbound / Outbound)',
    question: 'Are licenses exclusive / non-exclusive?',
    analysisPrompt: 'Identify whether intellectual property licenses are exclusive or non-exclusive, including territorial and field of use restrictions.'
  },
  {
    id: 'licenses_2',
    category: 'License Agreements (Inbound / Outbound)', 
    question: 'Are royalties, sublicensing, revocation rights defined?',
    analysisPrompt: 'Find details about royalty rates, payment terms, sublicensing rights, termination conditions, and revocation clauses in license agreements.'
  },
  {
    id: 'source_1',
    category: 'Source Code Ownership Declarations',
    question: 'Is third-party code used? Which licenses?',
    analysisPrompt: 'Identify use of third-party code, open source components, libraries, and their respective licenses (GPL, MIT, Apache, etc.).'
  },
  {
    id: 'source_2',
    category: 'Source Code Ownership Declarations',
    question: 'Are open-source usage policies in place?',
    analysisPrompt: 'Look for open source usage policies, compliance procedures, and governance frameworks for managing open source components.'
  },
  {
    id: 'source_3',
    category: 'Source Code Ownership Declarations',
    question: 'Is core IP clean and internally developed?',
    analysisPrompt: 'Verify that core intellectual property is cleanly owned and internally developed, without conflicts or third-party claims.'
  }
];

interface IpEvidence {
  documentName: string;
  relevantText: string;
  confidence: number;
  jurisdiction?: string;
  patentStatus?: string;
  trademarkClass?: string;
  licenseType?: string;
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

class ComprehensiveIpAnalysisService {
  private progressCallbacks = new Map<number, (progress: any) => void>();
  private jobId: string = '';
  private storage: any = null;

  setProgressCallback(dealId: number, callback: (progress: any) => void) {
    this.progressCallbacks.set(dealId, callback);
  }

  private async setProgress(dealId: number, progress: any) {
    const callback = this.progressCallbacks.get(dealId);
    if (callback) {
      callback(progress);
    }
    
    // Also update database background job if we have storage and jobId
    if (this.storage && this.jobId) {
      try {
        await this.storage.updateBackgroundJob(this.jobId, {
          progress: progress.progress,
          currentStep: progress.currentStep,
          currentDocument: progress.currentDocument || null
        });
      } catch (error) {
        console.error('Error updating background job progress:', error);
      }
    }
  }

  async runComprehensiveAnalysis(dealId: number, storageService?: any, jobId?: string): Promise<any> {
    console.log(`🔐 Starting comprehensive IP analysis for deal ${dealId}`);
    
    // Store storage service and jobId for progress updates
    if (storageService && jobId) {
      this.storage = storageService;
      this.jobId = jobId;
      console.log(`📝 IP Analysis: Storage service and jobId set - jobId: ${jobId}`);
    } else {
      console.warn(`⚠️ IP Analysis: Missing storage service or jobId - storage: ${!!storageService}, jobId: ${jobId}`);
    }
    
    try {
      // Set initial progress
      await this.setProgress(dealId, {
        progress: 5,
        currentStep: 'Initializing IP analysis...'
      });

      // Get all documents for this deal that might contain IP information
      const documents = await this.getAssignedIpDocuments(dealId);
      console.log(`🔐 Found ${documents.length} documents for IP analysis`);

      if (documents.length === 0) {
        throw new Error('No documents found for IP analysis');
      }

      await this.setProgress(dealId, {
        progress: 10,
        currentStep: `Found ${documents.length} documents for analysis`
      });

      // Extract IP evidence from documents
      const evidenceMap = await this.extractIpEvidence(documents, dealId);
      
      await this.setProgress(dealId, {
        progress: 70,
        currentStep: 'Generating comprehensive IP answers...'
      });

      // Generate comprehensive answers for all questions
      const answers = await this.generateComprehensiveAnswers(evidenceMap, dealId);
      
      await this.setProgress(dealId, {
        progress: 85,
        currentStep: 'Compiling final analysis...'
      });

      // Compile results
      const findings = this.compileFindingsFromAnswers(answers);
      const recommendations = this.compileRecommendationsFromAnswers(answers);
      
      await this.setProgress(dealId, {
        progress: 95,
        currentStep: 'Storing results...'
      });

      // Store results in database
      const analysisResult = await this.storeAnalysisResults(dealId, answers, findings, recommendations);
      
      await this.setProgress(dealId, {
        progress: 100,
        currentStep: 'IP analysis completed'
      });

      // Clean up the background job by marking it as completed
      console.log(`🔍 Checking job completion cleanup: storage=${!!this.storage}, jobId=${this.jobId}`);
      if (this.storage && this.jobId) {
        try {
          console.log(`📝 Updating background job ${this.jobId} to completed status`);
          await this.storage.updateBackgroundJob(this.jobId, {
            status: 'completed',
            progress: 100,
            currentStep: 'Analysis completed',
            completedAt: new Date()
          });
          console.log(`✅ Background job ${this.jobId} marked as completed successfully`);
        } catch (error) {
          console.error(`❌ Error marking background job ${this.jobId} as completed:`, error);
        }
      } else {
        console.warn(`⚠️ Cannot mark job as completed - storage: ${!!this.storage}, jobId: ${this.jobId}`);
        // Fallback: try to update using the provided parameters directly
        if (storageService && jobId) {
          try {
            console.log(`🔄 Fallback: Updating job ${jobId} using provided storage service`);
            await storageService.updateBackgroundJob(jobId, {
              status: 'completed',
              progress: 100,
              currentStep: 'Analysis completed',
              completedAt: new Date()
            });
            console.log(`✅ Background job ${jobId} marked as completed via fallback`);
          } catch (fallbackError) {
            console.error(`❌ Fallback job completion failed for ${jobId}:`, fallbackError);
          }
        }
      }

      console.log(`✅ Comprehensive IP analysis completed for deal ${dealId}`);
      console.log(`🔐 Generated ${findings.length} findings and ${recommendations.length} recommendations`);
      
      return analysisResult;
      
    } catch (error) {
      console.error(`❌ IP analysis failed for deal ${dealId}:`, error);
      
      // Clean up the background job by marking it as failed
      if (this.storage && this.jobId) {
        try {
          await this.storage.updateBackgroundJob(this.jobId, {
            status: 'failed',
            progress: 0,
            currentStep: 'Analysis failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date()
          });
          console.log(`❌ Background job ${this.jobId} marked as failed`);
        } catch (jobError) {
          console.error('Error marking background job as failed:', jobError);
        }
      }
      
      await this.setProgress(dealId, {
        progress: 0,
        currentStep: 'Analysis failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getAssignedIpDocuments(dealId: number): Promise<any[]> {
    try {
      // Get all documents for this deal
      const allDocuments = await storage.getDocumentsByDealId(dealId);
      
      // Filter for documents that might contain IP information
      const ipKeywords = [
        'patent', 'trademark', 'copyright', 'license', 'intellectual property', 'ip',
        'invention', 'patent application', 'trademark registration', 'license agreement',
        'confidentiality', 'non-disclosure', 'nda', 'trade secret', 'proprietary',
        'source code', 'software license', 'open source', 'gpl', 'mit license',
        'apache license', 'bsd license', 'creative commons', 'royalty', 'licensing',
        'patent portfolio', 'patent family', 'prior art', 'novelty', 'inventorship',
        'assignment', 'transfer', 'ownership', 'inventor', 'applicant', 'assignee',
        'fto', 'freedom to operate', 'clearance', 'infringement', 'validity',
        'prosecution', 'examination', 'office action', 'response', 'claims',
        'specification', 'drawings', 'abstract', 'priority', 'continuation',
        'divisional', 'provisional', 'pct', 'national phase', 'foreign filing'
      ];
      
      const assignedDocuments = allDocuments.filter((doc: any) => {
        if (!doc.aiSummary) return false;
        
        // Handle aiSummary as both object and string
        let summaryText = '';
        if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
          summaryText = doc.aiSummary.executiveSummary.toLowerCase();
        } else if (typeof doc.aiSummary === 'string') {
          summaryText = doc.aiSummary.toLowerCase();
        }
        
        const docName = doc.name.toLowerCase();
        
        return ipKeywords.some(keyword => 
          summaryText.includes(keyword) || docName.includes(keyword)
        );
      });

      console.log(`🔐 Found ${assignedDocuments.length} documents with potential IP content`);
      return assignedDocuments;
      
    } catch (error) {
      console.error('Error getting assigned IP documents:', error);
      throw error;
    }
  }

  async extractIpEvidence(documents: any[], dealId: number): Promise<{[key: string]: IpEvidence[]}> {
    const evidenceMap: {[key: string]: IpEvidence[]} = {};
    const batchSize = 10;
    const totalBatches = Math.ceil(documents.length / batchSize);
    
    console.log(`🔍 Processing ${documents.length} documents in ${totalBatches} batches for IP evidence extraction`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * batchSize;
      const batch = documents.slice(startIdx, startIdx + batchSize);
      
      const batchProgress = 20 + Math.round((batchIndex / totalBatches) * 40);
      await this.setProgress(dealId, {
        progress: batchProgress,
        currentStep: `Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} documents)`
      });
      
      // Process documents in parallel within batch
      const batchPromises = batch.map(async (doc: any) => {
        console.log(`🔐 Extracting IP evidence from: ${doc.name}`);
        
        let docText = '';
        if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
          docText = doc.aiSummary.executiveSummary;
        } else if (typeof doc.aiSummary === 'string') {
          docText = doc.aiSummary;
        }
        
        if (!docText) return;

        // Extract evidence for each IP question
        for (const question of IP_QUESTIONS) {
          try {
            const evidence = await this.extractEvidenceForQuestion(doc, docText, question);
            if (evidence && evidence.relevantText) {
              if (!evidenceMap[question.id]) {
                evidenceMap[question.id] = [];
              }
              evidenceMap[question.id].push(evidence);
            }
          } catch (error) {
            console.error(`Error extracting evidence for question ${question.id} from ${doc.name}:`, error);
          }
        }
      });
      
      await Promise.all(batchPromises);
      console.log(`✅ Batch ${batchIndex + 1} completed: ${batch.length}/${batch.length} documents processed successfully`);
    }
    
    return evidenceMap;
  }

  async extractEvidenceForQuestion(doc: any, docText: string, question: any): Promise<IpEvidence | null> {
    try {
      const prompt = `
        You are an expert IP analyst conducting due diligence for investment purposes.
        
        Document: ${doc.name}
        Question: ${question.question}
        Analysis Focus: ${question.analysisPrompt}
        
        Document Content: ${docText}
        
        Extract specific evidence related to this IP question. Look for:
        - Patent numbers, application numbers, filing dates
        - Trademark registrations and classes
        - License terms and conditions
        - IP ownership and assignment details
        - Open source usage and compliance
        
        Return ONLY a JSON object with this exact structure:
        {
          "relevantText": "Direct quote or summary of relevant information (empty string if none found)",
          "confidence": 0.0-1.0,
          "jurisdiction": "Country/region if applicable",
          "patentStatus": "Status if patent-related", 
          "trademarkClass": "Class if trademark-related",
          "licenseType": "Type if license-related"
        }
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (!result.relevantText || result.relevantText.trim() === '') {
        return null;
      }

      return {
        documentName: doc.name,
        relevantText: result.relevantText,
        confidence: Math.max(0, Math.min(1, result.confidence || 0)),
        jurisdiction: result.jurisdiction || undefined,
        patentStatus: result.patentStatus || undefined,
        trademarkClass: result.trademarkClass || undefined,
        licenseType: result.licenseType || undefined
      };
      
    } catch (error) {
      console.error(`Error extracting IP evidence from ${doc.name}:`, error);
      return null;
    }
  }

  async generateComprehensiveAnswers(evidenceMap: {[key: string]: IpEvidence[]}, dealId: number): Promise<{[key: string]: IpAnswer}> {
    const answers: {[key: string]: IpAnswer} = {};
    const questionCount = IP_QUESTIONS.length;
    
    for (let i = 0; i < IP_QUESTIONS.length; i++) {
      const question = IP_QUESTIONS[i];
      const questionProgress = 70 + Math.round((i / questionCount) * 15);
      
      await this.setProgress(dealId, {
        progress: questionProgress,
        currentStep: `Analyzing: ${question.category}`,
        currentQuestion: question.question
      });
      
      const evidence = evidenceMap[question.id] || [];
      
      try {
        const answer = await this.generateAnswerForQuestion(question, evidence);
        answers[question.id] = answer;
        
      } catch (error) {
        console.error(`Error generating answer for question ${question.id}:`, error);
        // Create fallback answer
        answers[question.id] = {
          question: question.question,
          answer: 'Unable to analyze due to processing error',
          confidence: 0,
          sources: [],
          detailedEvidence: evidence,
          keyFindings: [],
          evidenceSummary: 'Analysis could not be completed',
          ipAssessment: 'Unable to assess',
          recommendations: ['Review this area manually due to analysis error']
        };
      }
    }
    
    return answers;
  }

  async generateAnswerForQuestion(question: any, evidence: IpEvidence[]): Promise<IpAnswer> {
    if (evidence.length === 0) {
      return {
        question: question.question,
        answer: 'No relevant information found in the provided documents.',
        confidence: 0,
        sources: [],
        detailedEvidence: [],
        keyFindings: [],
        evidenceSummary: 'No evidence available',
        ipAssessment: 'Cannot assess - insufficient information',
        recommendations: ['Obtain additional IP documentation for proper analysis']
      };
    }

    const evidenceText = evidence.map(e => `${e.documentName}: ${e.relevantText}`).join('\n\n');
    
    const prompt = `
      You are an expert IP analyst conducting due diligence for venture capital investment.
      
      Question: ${question.question}
      Category: ${question.category}
      Analysis Focus: ${question.analysisPrompt}
      
      Evidence from documents:
      ${evidenceText}
      
      Provide a comprehensive analysis in JSON format:
      {
        "answer": "Direct answer to the question with specific details",
        "confidence": 0.0-1.0,
        "keyFindings": ["Key finding 1", "Key finding 2", ...],
        "evidenceSummary": "Summary of evidence quality and coverage",
        "ipAssessment": "Investment risk assessment for this IP aspect",
        "recommendations": ["Recommendation 1", "Recommendation 2", ...]
      }
      
      Focus on investment due diligence perspective. Be specific about IP risks and opportunities.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      question: question.question,
      answer: result.answer,
      confidence: Math.max(0, Math.min(1, result.confidence || 0)),
      sources: evidence.map(e => e.documentName),
      detailedEvidence: evidence,
      keyFindings: result.keyFindings || [],
      evidenceSummary: result.evidenceSummary,
      ipAssessment: result.ipAssessment,
      recommendations: result.recommendations || []
    };
  }

  compileFindingsFromAnswers(answers: {[key: string]: IpAnswer}): any[] {
    const findings: any[] = [];
    
    Object.values(answers).forEach(answer => {
      answer.keyFindings.forEach((finding, index) => {
        findings.push({
          id: `${answer.question.replace(/\s+/g, '_').toLowerCase()}_finding_${index + 1}`,
          category: 'IP Analysis',
          finding: finding,
          severity: answer.confidence > 0.7 ? 'high' : answer.confidence > 0.4 ? 'medium' : 'low',
          sources: answer.sources,
          confidence: answer.confidence
        });
      });
    });
    
    return findings;
  }

  compileRecommendationsFromAnswers(answers: {[key: string]: IpAnswer}): any[] {
    const recommendations: any[] = [];
    
    Object.values(answers).forEach(answer => {
      answer.recommendations.forEach((rec, index) => {
        recommendations.push({
          id: `${answer.question.replace(/\s+/g, '_').toLowerCase()}_rec_${index + 1}`,
          category: 'IP',
          recommendation: rec,
          priority: answer.confidence > 0.7 ? 'high' : answer.confidence > 0.4 ? 'medium' : 'low'
        });
      });
    });
    
    return recommendations;
  }

  async storeAnalysisResults(dealId: number, answers: {[key: string]: IpAnswer}, findings: any[], recommendations: any[]): Promise<any> {
    try {
      const analysisData = {
        dealId,
        agentType: 'IP',
        status: 'Completed',
        progress: 100,
        findings,
        recommendations,
        ip_answers: JSON.stringify(answers),
        completedAt: new Date().toISOString()
      };

      // Store in agent_analyses table
      const result = await storage.saveAgentAnalysis(analysisData.dealId, analysisData.agentType, analysisData);
      console.log(`✅ IP analysis results stored for deal ${dealId}`);
      
      return result;
    } catch (error) {
      console.error('Error storing IP analysis results:', error);
      throw error;
    }
  }
}

export const comprehensiveIpAnalysisService = new ComprehensiveIpAnalysisService();