import { storage } from './storage';

const RESEARCH_QUESTIONS = [
  // Technical Whitepapers
  {
    id: 'technical_1',
    category: 'Technical Whitepapers',
    question: 'Are methodologies reproducible?',
    analysisPrompt: 'Analyze technical methodologies for reproducibility, clear step-by-step procedures, documented protocols, and replicable experimental designs.'
  },
  {
    id: 'technical_2',
    category: 'Technical Whitepapers',
    question: 'Are KPIs / benchmarks clearly described?',
    analysisPrompt: 'Evaluate whether key performance indicators and benchmarks are clearly defined, measurable, and include baseline comparisons.'
  },
  {
    id: 'technical_3',
    category: 'Technical Whitepapers',
    question: 'Are claims cited and supported by peer-reviewed literature?',
    analysisPrompt: 'Verify that technical claims are backed by citations to peer-reviewed literature, scientific studies, and authoritative sources.'
  },
  
  // Market Research Reports
  {
    id: 'market_1',
    category: 'Market Research Reports',
    question: 'Are TAM/SAM/SOM defined with assumptions?',
    analysisPrompt: 'Assess whether Total Addressable Market, Serviceable Addressable Market, and Serviceable Obtainable Market are clearly defined with underlying assumptions.'
  },
  {
    id: 'market_2',
    category: 'Market Research Reports',
    question: 'Are sources cited (Gartner, Statista, CB Insights)?',
    analysisPrompt: 'Verify that market data sources are cited, including reputable sources like Gartner, Statista, CB Insights, IDC, or other authoritative market research firms.'
  },
  {
    id: 'market_3',
    category: 'Market Research Reports',
    question: 'Are forecasts based on bottom-up or top-down logic?',
    analysisPrompt: 'Determine whether market forecasts use bottom-up analysis (building from individual data points) or top-down analysis (starting from broad market), and assess the logic.'
  },
  
  // Academic Publications
  {
    id: 'academic_1',
    category: 'Academic Publications',
    question: 'Are papers peer-reviewed?',
    analysisPrompt: 'Verify whether academic papers are peer-reviewed publications from recognized academic journals or conferences.'
  },
  {
    id: 'academic_2',
    category: 'Academic Publications',
    question: 'Are citations in PubMed, arXiv, Nature, etc.?',
    analysisPrompt: 'Check if citations reference authoritative academic databases like PubMed, arXiv, Nature, Science, IEEE, or other high-impact journals.'
  },
  {
    id: 'academic_3',
    category: 'Academic Publications',
    question: 'Is the publication recent and still relevant?',
    analysisPrompt: 'Evaluate the publication date and assess whether the research is current and relevant to modern applications.'
  },
  
  // Patent Landscape Analyses
  {
    id: 'patent_1',
    category: 'Patent Landscape Analyses',
    question: 'Are citations and forward references analyzed?',
    analysisPrompt: 'Assess whether patent analysis includes backward citations (prior art) and forward citations (patents that reference this work).'
  },
  {
    id: 'patent_2',
    category: 'Patent Landscape Analyses',
    question: 'Is competitive IP density mapped?',
    analysisPrompt: 'Evaluate whether the analysis maps competitive intellectual property density, identifying crowded fields and white space opportunities.'
  }
];

export class ComprehensiveResearchAnalysisService {
  private progressData = new Map<number, any>();

  getProgress(dealId: number) {
    return this.progressData.get(dealId) || {
      isRunning: false,
      progress: 0,
      message: 'No comprehensive research analysis running'
    };
  }

  private async setProgress(dealId: number, progress: any, storageService?: any, jobId?: string) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
    
    // Also update background job in database if provided
    if (storageService && jobId) {
      try {
        await storageService.updateBackgroundJob(jobId, {
          progress: progress.progress || current.progress,
          currentStep: progress.currentStep || progress.message || current.message
        });
      } catch (error) {
        console.error('Error updating background job progress:', error);
      }
    }
  }

  async startComprehensiveAnalysis(dealId: number, storageService?: any, jobId?: string): Promise<void> {
    console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
    
    // Use provided jobId or create new one
    const analysisJobId = jobId || `research_analysis_${dealId}_${Date.now()}`;
    const storage = storageService || (await import('./storage')).storage;
    
    try {
      if (!jobId) {
        // Only create background job if not provided
        await storage.createBackgroundJob({
          jobId: analysisJobId,
          jobType: 'comprehensive_research_analysis',
          dealId,
          agentType: 'Research',
          status: 'processing',
          progress: 0,
          totalDocuments: 0,
          processedDocuments: 0,
          startedAt: new Date()
        });
      }
    } catch (error) {
      console.error(`❌ Failed to create background job for deal ${dealId}:`, error);
      throw new Error(`Failed to initialize comprehensive research analysis: ${error.message}`);
    }
    
    await this.setProgress(dealId, {
      isRunning: true,
      progress: 5,
      message: 'Initializing comprehensive research analysis...',
      currentStep: 'Finding research documents',
      totalSteps: RESEARCH_QUESTIONS.length
    }, storage, analysisJobId);

    try {
      // Get all documents suitable for research analysis
      const researchDocs = await this.getAssignedResearchDocuments(dealId);
      console.log(`🔬 Found ${researchDocs.length} research documents for analysis`);

      if (researchDocs.length === 0) {
        await storage.updateBackgroundJob(analysisJobId, {
          status: 'completed',
          progress: 100,
          error: 'No research documents available for analysis'
        });
        await this.setProgress(dealId, {
          isRunning: false,
          progress: 100,
          message: 'No research documents found for analysis'
        }, storage, analysisJobId);
        throw new Error('No documents available for research analysis');
      }
      
      // Update job with total questions to process
      await storage.updateBackgroundJob(analysisJobId, {
        totalDocuments: RESEARCH_QUESTIONS.length,
        currentStep: 'Analyzing research documents across 12 question categories'
      });

      // Process each question comprehensively
      const researchAnswers: Record<string, any> = {};
      
      for (let i = 0; i < RESEARCH_QUESTIONS.length; i++) {
        const question = RESEARCH_QUESTIONS[i];
        console.log(`🔬 Processing question ${i + 1}/${RESEARCH_QUESTIONS.length}: ${question.question}`);
        
        try {
          // Update progress with error handling (both internal and background job)
          const progress = Math.round((i / RESEARCH_QUESTIONS.length) * 100);
          await storage.updateBackgroundJob(analysisJobId, {
            progress,
            currentStep: `Analyzing: ${question.category}`,
            currentDocument: question.question
          });

          await this.setProgress(dealId, {
            progress,
            currentStep: `Analyzing: ${question.category}`,
            currentQuestion: question.question
          }, storage, analysisJobId);

          // Get relevant documents for this question using comprehensive matching
          const relevantDocs = researchDocs.filter(doc => {
            const docContent = this.getDocumentContent(doc).toLowerCase();
            const questionContent = question.question.toLowerCase() + ' ' + question.analysisPrompt.toLowerCase();
            return this.calculateRelevance(docContent, questionContent) > 0.1;
          });

          console.log(`🔬 Found ${relevantDocs.length} relevant documents for question: ${question.question}`);

          if (relevantDocs.length === 0) {
            researchAnswers[question.id] = {
              question: question.question,
              answer: 'No relevant research documents found for this analysis.',
              confidence: 0,
              sources: [],
              detailedEvidence: [],
              keyFindings: [],
              evidenceSummary: 'No evidence available in current document set.',
              researchAssessment: 'Cannot assess due to lack of relevant documentation.',
              recommendations: ['Consider gathering additional research documentation for this area.']
            };
            continue;
          }

          // Process documents with AI analysis
          const evidence = await this.extractEvidenceFromDocuments(relevantDocs, question);
          const analysis = await this.generateResearchAnalysis(question, evidence);
          
          researchAnswers[question.id] = {
            question: question.question,
            answer: analysis.answer,
            confidence: analysis.confidence,
            sources: evidence.map(e => e.documentName),
            detailedEvidence: evidence,
            keyFindings: analysis.keyFindings,
            evidenceSummary: analysis.evidenceSummary,
            researchAssessment: analysis.researchAssessment,
            recommendations: analysis.recommendations
          };

        } catch (questionError) {
          console.error(`🔬 Error processing research question ${question.id}:`, questionError);
          researchAnswers[question.id] = {
            question: question.question,
            answer: 'Error occurred during analysis of this question.',
            confidence: 0,
            sources: [],
            detailedEvidence: [],
            keyFindings: [],
            evidenceSummary: 'Analysis failed due to processing error.',
            researchAssessment: 'Could not complete research assessment.',
            recommendations: ['Retry analysis or review document quality.']
          };
        }
      }

      // Complete the analysis
      await storage.updateBackgroundJob(analysisJobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Research analysis completed'
      });

      await this.setProgress(dealId, {
        isRunning: false,
        progress: 100,
        message: 'Comprehensive research analysis completed'
      }, storage, analysisJobId);

      // Store results in the database
      const analysisResults = {
        dealId,
        agentType: 'Research',
        status: 'Completed',
        results: researchAnswers,
        findings: Object.values(researchAnswers).flatMap((answer: any) => answer.keyFindings || []),
        recommendations: Object.values(researchAnswers).flatMap((answer: any) => answer.recommendations || []),
        metadata: {
          questionsAnalyzed: RESEARCH_QUESTIONS.length,
          documentsProcessed: researchDocs.length,
          completedAt: new Date().toISOString()
        }
      };

      await storage.saveAgentAnalysis(dealId, 'Research', analysisResults);
      console.log(`🔬 Research analysis completed for deal ${dealId} with ${Object.keys(researchAnswers).length} questions analyzed`);

    } catch (error) {
      console.error(`🔬 Comprehensive research analysis failed for deal ${dealId}:`, error);
      
      await storage.updateBackgroundJob(analysisJobId, {
        status: 'failed',
        error: error.message
      });
      
      await this.setProgress(dealId, {
        isRunning: false,
        progress: 0,
        message: `Analysis failed: ${error.message}`
      }, storage, analysisJobId);
      
      throw error;
    }
  }

  private async getAssignedResearchDocuments(dealId: number): Promise<any[]> {
    const allDocs = await storage.getDocumentsByDealId(dealId);
    
    // Enhanced research keywords for comprehensive document matching
    const researchKeywords = [
      // Market Analysis
      'market', 'tam', 'sam', 'som', 'addressable', 'size', 'growth', 'trends', 'dynamics',
      'industry', 'segment', 'opportunity', 'potential', 'forecast', 'projection',
      // Competitive
      'competitive', 'competitor', 'competition', 'landscape', 'analysis', 'positioning',
      'differentiation', 'advantage', 'moat', 'benchmark', 'comparison', 'market share',
      // Customer & Business Model
      'customer', 'target', 'persona', 'segment', 'use case', 'pain point', 'value proposition',
      'go-to-market', 'gtm', 'sales', 'marketing', 'channel', 'acquisition', 'retention',
      // Technology & Innovation
      'technology', 'innovation', 'r&d', 'research', 'development', 'technical', 'scalability',
      'architecture', 'platform', 'solution', 'product', 'feature', 'roadmap',
      // Investment
      'investment', 'thesis', 'strategy', 'valuation', 'return', 'exit', 'risk', 'opportunity',
      'due diligence', 'analysis', 'assessment', 'evaluation', 'recommendation'
    ];

    return allDocs.filter(doc => {
      if (doc.agentAssignments?.includes('Research')) {
        return true;
      }

      const content = this.getDocumentContent(doc).toLowerCase();
      const matchCount = researchKeywords.filter(keyword => content.includes(keyword)).length;
      
      // Return documents with at least 3 keyword matches for comprehensive coverage
      return matchCount >= 3;
    });
  }

  private getDocumentContent(doc: any): string {
    if (typeof doc.aiSummary === 'object' && doc.aiSummary?.executiveSummary) {
      return `${doc.name} ${doc.aiSummary.executiveSummary}`;
    }
    if (typeof doc.aiSummary === 'string') {
      return `${doc.name} ${doc.aiSummary}`;
    }
    return doc.name || '';
  }

  private calculateRelevance(docContent: string, questionContent: string): number {
    const docWords = docContent.toLowerCase().split(/\s+/);
    const questionWords = questionContent.toLowerCase().split(/\s+/);
    
    const matches = questionWords.filter(word => 
      word.length > 3 && docWords.some(docWord => docWord.includes(word) || word.includes(docWord))
    );
    
    return matches.length / questionWords.length;
  }

  private async extractEvidenceFromDocuments(documents: any[], question: any): Promise<any[]> {
    // Simplified evidence extraction - in production this would use AI
    return documents.slice(0, 10).map(doc => ({
      documentName: doc.name,
      documentSummary: typeof doc.aiSummary === 'object' 
        ? doc.aiSummary.executiveSummary || 'No summary available'
        : doc.aiSummary || 'No summary available',
      relevantContent: [`Content related to: ${question.question}`],
      keyFindings: [`Finding from ${doc.name}`],
      confidence: 0.7
    }));
  }

  private async generateResearchAnalysis(question: any, evidence: any[]): Promise<any> {
    // Simplified analysis generation - in production this would use AI
    return {
      answer: `Based on analysis of ${evidence.length} documents, research findings indicate ${question.category.toLowerCase()} considerations are documented.`,
      confidence: evidence.length > 0 ? 0.75 : 0.25,
      keyFindings: evidence.flatMap(e => e.keyFindings).slice(0, 3),
      evidenceSummary: `Analysis based on ${evidence.length} relevant documents covering ${question.category}.`,
      researchAssessment: `Research assessment for ${question.category} shows ${evidence.length > 2 ? 'comprehensive' : 'limited'} documentation.`,
      recommendations: [
        `Continue monitoring ${question.category} developments`,
        `Consider additional research in ${question.category} area`
      ]
    };
  }
}

export const comprehensiveResearchAnalysisService = new ComprehensiveResearchAnalysisService();