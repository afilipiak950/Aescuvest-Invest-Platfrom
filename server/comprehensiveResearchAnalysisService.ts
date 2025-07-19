import { storage } from './storage';

const RESEARCH_QUESTIONS = [
  {
    id: 'market_1',
    category: 'Market Analysis',
    question: 'What is the total addressable market (TAM) size?',
    analysisPrompt: 'Find market size estimates, TAM calculations, SAM, SOM, and market growth projections.'
  },
  {
    id: 'market_2',
    category: 'Market Analysis',
    question: 'What are the key market trends and drivers?',
    analysisPrompt: 'Identify market trends, growth drivers, technology adoption, and market dynamics.'
  },
  {
    id: 'competitive_1',
    category: 'Competitive Landscape',
    question: 'Who are the main competitors and their positioning?',
    analysisPrompt: 'Identify direct and indirect competitors, their market share, positioning, and competitive advantages.'
  },
  {
    id: 'competitive_2',
    category: 'Competitive Landscape',
    question: 'What is the competitive differentiation strategy?',
    analysisPrompt: 'Analyze unique value propositions, competitive moats, and differentiation factors.'
  },
  {
    id: 'customer_1',
    category: 'Customer & Business Model',
    question: 'What is the target customer profile and segments?',
    analysisPrompt: 'Define customer segments, buyer personas, customer pain points, and use cases.'
  },
  {
    id: 'customer_2',
    category: 'Customer & Business Model',
    question: 'What is the go-to-market strategy and sales approach?',
    analysisPrompt: 'Analyze sales channels, customer acquisition, marketing strategy, and partnership approach.'
  },
  {
    id: 'technology_1',
    category: 'Technology & Innovation',
    question: 'What is the core technology and innovation?',
    analysisPrompt: 'Assess technology stack, innovation factors, R&D capabilities, and technical advantages.'
  },
  {
    id: 'technology_2',
    category: 'Technology & Innovation',
    question: 'What are the technology risks and dependencies?',
    analysisPrompt: 'Identify technical risks, scalability challenges, technology dependencies, and obsolescence risks.'
  },
  {
    id: 'regulatory_1',
    category: 'Regulatory & Industry Analysis',
    question: 'What are the key regulatory requirements and compliance?',
    analysisPrompt: 'Identify regulatory frameworks, compliance requirements, industry standards, and regulatory risks.'
  },
  {
    id: 'regulatory_2',
    category: 'Regulatory & Industry Analysis',
    question: 'How do industry dynamics affect the business?',
    analysisPrompt: 'Analyze industry cycles, regulatory changes, policy impacts, and industry consolidation trends.'
  },
  {
    id: 'investment_1',
    category: 'Investment Thesis & Strategy',
    question: 'What is the investment thesis and value creation plan?',
    analysisPrompt: 'Define investment rationale, value creation opportunities, exit strategies, and return projections.'
  },
  {
    id: 'investment_2',
    category: 'Investment Thesis & Strategy',
    question: 'What are the key investment risks and mitigation strategies?',
    analysisPrompt: 'Identify investment risks, risk factors, mitigation plans, and sensitivity analysis.'
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

  private setProgress(dealId: number, progress: any) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
  }

  async startComprehensiveAnalysis(dealId: number): Promise<void> {
    console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
    
    // Create background job for progress tracking (same as Legal)
    const jobId = `research_analysis_${dealId}_${Date.now()}`;
    
    try {
      await storage.createBackgroundJob({
        jobId,
        jobType: 'comprehensive_research_analysis',
        dealId,
        agentType: 'Research',
        status: 'processing',
        progress: 0,
        totalDocuments: 0,
        processedDocuments: 0,
        startedAt: new Date()
      });
    } catch (error) {
      console.error(`❌ Failed to create background job for deal ${dealId}:`, error);
      throw new Error(`Failed to initialize comprehensive research analysis: ${error.message}`);
    }
    
    this.setProgress(dealId, {
      isRunning: true,
      progress: 5,
      message: 'Initializing comprehensive research analysis...',
      currentStep: 'Finding research documents',
      totalSteps: RESEARCH_QUESTIONS.length
    });

    try {
      // Get all documents suitable for research analysis
      const researchDocs = await this.getAssignedResearchDocuments(dealId);
      console.log(`🔬 Found ${researchDocs.length} research documents for analysis`);

      if (researchDocs.length === 0) {
        await storage.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          error: 'No research documents available for analysis'
        });
        this.setProgress(dealId, {
          isRunning: false,
          progress: 100,
          message: 'No research documents found for analysis'
        });
        throw new Error('No documents available for research analysis');
      }
      
      // Update job with total questions to process
      await storage.updateBackgroundJob(jobId, {
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
          await storage.updateBackgroundJob(jobId, {
            progress,
            currentStep: `Analyzing: ${question.category}`,
            currentDocument: question.question
          });

          this.setProgress(dealId, {
            progress,
            currentStep: `Analyzing: ${question.category}`,
            currentQuestion: question.question
          });

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
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Research analysis completed'
      });

      this.setProgress(dealId, {
        isRunning: false,
        progress: 100,
        message: 'Comprehensive research analysis completed'
      });

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
      
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      this.setProgress(dealId, {
        isRunning: false,
        progress: 0,
        message: `Analysis failed: ${error.message}`
      });
      
      throw error;
    }
  }

  private async getAssignedResearchDocuments(dealId: number): Promise<any[]> {
    const allDocs = await storage.getDocuments(dealId);
    
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