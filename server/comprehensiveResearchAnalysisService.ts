import { storage } from './storage';
import { db } from './db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    } catch (error: any) {
      console.error(`❌ Failed to create background job for deal ${dealId}:`, error);
      throw new Error(`Failed to initialize comprehensive research analysis: ${error?.message || 'Unknown error'}`);
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
          const progressPercent = Math.round(((i + 1) / RESEARCH_QUESTIONS.length) * 100);
          
          await this.setProgress(dealId, {
            progress: progressPercent,
            currentStep: `checking ${i}/${researchDocs.length} - question ${i + 1}/${RESEARCH_QUESTIONS.length} - ${question.question}`,
            message: `Analyzing question ${i + 1}/${RESEARCH_QUESTIONS.length}`,
            processedDocuments: i + 1
          }, storage, analysisJobId);
          
          // Update background job with current question being processed
          await storage.updateBackgroundJob(analysisJobId, {
            progress: progressPercent,
            processedDocuments: i + 1,
            currentDocument: question.question,
            currentStep: `checking ${i}/${researchDocs.length} - question ${i + 1}/${RESEARCH_QUESTIONS.length} - ${question.question}`
          });
          
          // Extract evidence from ALL research documents for this specific question using comprehensive batch processing
          const questionEvidence = await this.extractEvidenceFromDocuments(researchDocs, question);
          
          if (questionEvidence.length > 0) {
            // Generate AI-powered answer for this question using the evidence
            const analysis = await this.generateResearchAnalysis(question, questionEvidence);
            researchAnswers[question.id] = {
              question: question.question,
              answer: analysis.answer,
              confidence: analysis.confidence,
              sources: questionEvidence.map(e => e.documentName),
              quotes: [],
              keyFindings: analysis.keyFindings,
              evidenceSummary: analysis.evidenceSummary,
              recommendations: analysis.recommendations,
              detailedEvidence: questionEvidence.slice(0, 5)
            };
            
            console.log(`✅ Completed question ${i + 1}/${RESEARCH_QUESTIONS.length}: ${question.question}`);
          } else {
            // No evidence found for this question
            researchAnswers[question.id] = {
              question: question.question,
              answer: `No relevant evidence found in the research documents for: ${question.question}`,
              confidence: 0,
              sources: [],
              quotes: [],
              keyFindings: [],
              evidenceSummary: 'No evidence found',
              recommendations: [],
              detailedEvidence: []
            };
            
            console.log(`⚠️ No evidence found for question ${i + 1}/${RESEARCH_QUESTIONS.length}: ${question.question}`);
          }

        } catch (questionError) {
          console.error(`🔬 Error processing research question ${question.id}:`, questionError);
          researchAnswers[question.id] = {
            question: question.question,
            answer: 'Error occurred during analysis of this question.',
            confidence: 0,
            sources: [],
            quotes: [],
            keyFindings: [],
            evidenceSummary: 'Analysis failed due to processing error.',
            recommendations: ['Retry analysis or review document quality.'],
            detailedEvidence: []
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
        findings: Object.values(researchAnswers).flatMap((answer: any) => answer.keyFindings || []).slice(0, 100),
        recommendations: Object.values(researchAnswers).flatMap((answer: any) => answer.recommendations || []).slice(0, 50),
        research_answers: researchAnswers, // Store directly as JSON object
        completedAt: new Date(),
        metadata: {
          questionsAnalyzed: RESEARCH_QUESTIONS.length,
          documentsProcessed: researchDocs.length,
          completedAt: new Date().toISOString()
        }
      };

      console.log(`🔬 DEBUG: About to save analysis with ${Object.keys(researchAnswers).length} answers:`, Object.keys(researchAnswers));
      console.log(`🔬 DEBUG: Sample answer:`, researchAnswers[Object.keys(researchAnswers)[0]]);
      console.log(`🔬 DEBUG: researchAnswers JSON length:`, JSON.stringify(researchAnswers).length);
      
      // Check if analysis already exists
      const existingAnalysis = await storage.getAgentAnalysisByDealAndType(dealId, 'Research');
      
      if (existingAnalysis) {
        // Update existing analysis
        await storage.updateAgentAnalysis(existingAnalysis.id, {
          status: 'Completed',
          findings: analysisResults.findings,
          recommendations: analysisResults.recommendations,
          research_answers: analysisResults.research_answers,
          completedAt: analysisResults.completedAt,
          metadata: analysisResults.metadata
        });
        console.log(`🔬 Updated existing research analysis for deal ${dealId}`);
      } else {
        // Create new analysis
        await storage.saveAgentAnalysis(dealId, 'Research', analysisResults);
        console.log(`🔬 Created new research analysis for deal ${dealId}`);
      }
      console.log(`🔬 Research analysis completed for deal ${dealId} with ${Object.keys(researchAnswers).length} questions analyzed`);

    } catch (error: any) {
      console.error(`🔬 Comprehensive research analysis failed for deal ${dealId}:`, error);
      console.error(`🔬 Error details:`, error?.message || error);
      console.error(`🔬 Error stack:`, error?.stack);
      
      await storage.updateBackgroundJob(analysisJobId, {
        status: 'failed',
        error: error?.message || 'Unknown error'
      });
      
      await this.setProgress(dealId, {
        isRunning: false,
        progress: 0,
        message: `Analysis failed: ${error?.message || 'Unknown error'}`
      }, storage, analysisJobId);
      
      throw error;
    }
  }

  private async getAssignedResearchDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to research agent
    let researchDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('Research')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to research: ${researchDocuments.length}`);
    
    // If no documents are explicitly assigned to research, identify research-related documents
    if (researchDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to research agent, identifying research-related documents...');
      
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

      researchDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Check document name and content for research keywords
        const hasResearchKeywords = researchKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for research document type
        const isResearchDocument = aiSummary?.documentType?.toLowerCase().includes('research') ||
                                  aiSummary?.executiveSummary?.toLowerCase().includes('market') ||
                                  aiSummary?.executiveSummary?.toLowerCase().includes('competitive') ||
                                  aiSummary?.executiveSummary?.toLowerCase().includes('analysis');
        
        return hasResearchKeywords || isResearchDocument;
      });
      
      console.log(`📄 Auto-identified research documents: ${researchDocuments.length}`);
    }
    
    // If still no research documents, take documents with meaningful content for analysis
    if (researchDocuments.length === 0) {
      console.log('📄 No research-related documents found, using all documents with OCR text...');
      researchDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`📄 Documents with content available: ${researchDocuments.length}`);
    }
    
    return researchDocuments;
  }



  private getDocumentContent(doc: any): string {
    if (typeof doc.aiSummary === 'object' && doc.aiSummary?.executiveSummary) {
      return `${doc.name} ${doc.aiSummary.executiveSummary}`;
    }
    if (typeof doc.aiSummary === 'string') {
      return `${doc.name} ${doc.aiSummary}`;
    }
    if (doc.ocrText && doc.ocrText.length > 0) {
      return `${doc.name} ${doc.ocrText}`;
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

  // Extract evidence from ALL documents using comprehensive batch processing like Clinical/Legal agents
  private async extractEvidenceFromDocuments(documents: any[], question: any): Promise<any[]> {
    console.log(`🔬 Extracting evidence from ${documents.length} documents for: ${question.question}`);
    
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < documents.length; i += batchSize) {
      batches.push(documents.slice(i, i + batchSize));
    }
    
    console.log(`🔬 Processing ${batches.length} batches of ${batchSize} documents each`);
    
    const allEvidence: any[] = [];
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`🔬 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} documents)`);
      
      const batchEvidence = await Promise.all(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting evidence from: ${doc.name}`);
          return await this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      // Filter out null results and add to all evidence
      const validEvidence = batchEvidence.filter(evidence => evidence !== null);
      allEvidence.push(...validEvidence);
      
      console.log(`✅ Batch ${batchIndex + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
      
      // Add small delay between batches to prevent API rate limiting
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`📋 Extracted evidence from ${allEvidence.length}/${documents.length} documents`);
    return allEvidence.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Extract evidence from a single document for a specific research question
  private async extractEvidenceFromDocument(doc: any, question: any): Promise<any | null> {
    try {
      const content = this.getDocumentContent(doc);
      if (!content || content.trim().length < 50) {
        return null;
      }
      
      // Get research-specific keywords for this question category
      const keywords = this.getResearchKeywords(question.category);
      
      // Calculate relevance score based on keyword matching and content analysis
      const relevanceScore = this.calculateResearchRelevanceScore(doc.name, content, question, keywords);
      
      // Only include documents that have minimum relevance (same threshold as other agents)
      if (relevanceScore < 0.1) {
        return null;
      }
      
      return {
        documentId: doc.id,
        documentName: doc.name,
        extractedText: content ? content.substring(0, 2000) : '', // More comprehensive text extraction
        relevanceScore,
        documentSummary: doc.aiSummary?.executiveSummary || (content ? content.substring(0, 500) : ''),
        matchingKeywords: keywords.filter(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        )
      };
    } catch (error) {
      console.error(`Error extracting evidence from ${doc.name}:`, error);
      return null;
    }
  }

  // Calculate research relevance score using comprehensive approach
  private calculateResearchRelevanceScore(docName: string, content: string, question: any, keywords: string[]): number {
    const lowerContent = content.toLowerCase();
    const lowerDocName = docName.toLowerCase();
    let score = 0;
    
    // Base score for keyword matches in content
    const keywordMatches = keywords.filter(keyword => 
      lowerContent.includes(keyword.toLowerCase())
    ).length;
    score += (keywordMatches / keywords.length) * 0.4;
    
    // Bonus for keyword matches in document name
    const nameMatches = keywords.filter(keyword => 
      lowerDocName.includes(keyword.toLowerCase())
    ).length;
    score += (nameMatches / keywords.length) * 0.2;
    
    // Category-specific scoring
    switch (question.category) {
      case 'Technical Whitepapers':
        if (lowerContent.includes('methodology') || lowerContent.includes('protocol') || 
            lowerContent.includes('procedure') || lowerContent.includes('analysis')) {
          score += 0.3;
        }
        break;
      case 'Market Research Reports':
        if (lowerContent.includes('market') || lowerContent.includes('forecast') || 
            lowerContent.includes('tam') || lowerContent.includes('sam')) {
          score += 0.3;
        }
        break;
      case 'Academic Publications':
        if (lowerContent.includes('peer-review') || lowerContent.includes('journal') || 
            lowerContent.includes('publication') || lowerContent.includes('citation')) {
          score += 0.3;
        }
        break;
      case 'Patent Landscape Analyses':
        if (lowerContent.includes('patent') || lowerContent.includes('citation') || 
            lowerContent.includes('prior art') || lowerContent.includes('intellectual property')) {
          score += 0.3;
        }
        break;
    }
    
    // Content length bonus (longer documents more likely to have research content)
    if (content && content.length > 1000) score += 0.1;
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

  // Get research-specific keywords for each category
  private getResearchKeywords(category: string): string[] {
    switch (category) {
      case 'Technical Whitepapers':
        return ['methodology', 'protocol', 'procedure', 'analysis', 'technical', 'system', 'design', 'implementation', 'validation', 'testing'];
      case 'Market Research Reports':
        return ['market', 'tam', 'sam', 'som', 'forecast', 'growth', 'opportunity', 'competitive', 'industry', 'segment'];
      case 'Academic Publications':
        return ['peer-review', 'journal', 'publication', 'citation', 'research', 'study', 'academic', 'scientific', 'paper', 'conference'];
      case 'Patent Landscape Analyses':
        return ['patent', 'intellectual property', 'ip', 'citation', 'prior art', 'invention', 'claim', 'uspto', 'filing', 'prosecution'];
      default:
        return ['research', 'analysis', 'study', 'evaluation', 'assessment', 'investigation'];
    }
  }

  private async generateResearchAnalysis(question: any, evidence: any[]): Promise<any> {
    if (evidence.length === 0) {
      return {
        answer: `No relevant evidence found for: ${question.question}`,
        confidence: 0,
        keyFindings: [],
        evidenceSummary: 'No evidence available in current document set',
        researchAssessment: 'Cannot assess due to lack of evidence',
        recommendations: ['Consider gathering additional research documentation for this area']
      };
    }

    // Try OpenAI analysis first, but fallback to structured analysis if quota exceeded
    try {
      const evidenceText = evidence.map(e => 
        `Document: ${e.documentName}\nSummary: ${e.documentSummary}\nRelevant content: ${e.extractedText}`
      ).join('\n\n');
      
      const prompt = `
As a venture capital research analyst, analyze this evidence for the research question:

Research Question: ${question.question}
Category: ${question.category}
Analysis Focus: ${question.analysisPrompt}

Evidence from ${evidence.length} documents:
${evidenceText}

Provide a comprehensive research analysis in JSON format:
{
  "answer": "Direct answer to the research question based on evidence (2-3 sentences)",
  "confidence": "Confidence score 0-100 based on evidence quality and completeness",
  "keyFindings": ["Key finding 1", "Key finding 2", "Key finding 3"],
  "evidenceSummary": "Summary of what the evidence shows (1-2 sentences)",
  "researchAssessment": "Assessment of research quality and methodology (1-2 sentences)",
  "recommendations": ["Recommendation 1 for investors", "Recommendation 2 for investors"]
}

Focus on investment due diligence. Be thorough and critical in your analysis.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        answer: analysis.answer || `Analysis completed for: ${question.question}`,
        confidence: Math.min(100, Math.max(0, analysis.confidence || 60)),
        keyFindings: Array.isArray(analysis.keyFindings) ? analysis.keyFindings.slice(0, 3) : [],
        evidenceSummary: analysis.evidenceSummary || 'Evidence analyzed successfully',
        researchAssessment: analysis.researchAssessment || 'Research assessment completed',
        recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations.slice(0, 2) : []
      };
      
    } catch (error) {
      console.error('🔬 Error generating research analysis (quota exceeded):', error);
      
      // Fallback to structured analysis without OpenAI when quota exceeded
      return this.generateStructuredFallbackAnalysis(question, evidence);
    }
  }

  // Improved fallback analysis that provides meaningful answers based on actual document content
  private generateStructuredFallbackAnalysis(question: any, evidence: any[]): any {
    const documentNames = evidence.map(e => e.documentName).slice(0, 5); // Limit to top 5 most relevant
    const allContent = evidence.map(e => e.extractedText || e.documentSummary || '').join(' ').toLowerCase();
    
    // Calculate realistic confidence based on content quality and question specificity
    let confidence = 30; // Base confidence
    if (evidence.length > 5) confidence += 20;
    if (evidence.length > 10) confidence += 15;
    if (allContent.length > 2000) confidence += 15;
    confidence = Math.min(85, confidence);
    
    // Analyze content to provide specific answers based on the question
    let answer, keyFindings, researchAssessment, recommendations;
    
    // Question-specific analysis instead of generic templates
    switch (question.question) {
      case 'Are technical whitepapers available?':
        const technicalDocs = evidence.filter(e => 
          (e.documentName && (e.documentName.toLowerCase().includes('technical') || 
           e.documentName.toLowerCase().includes('whitepaper') ||
           e.documentName.toLowerCase().includes('methodology'))) ||
          (e.extractedText && (e.extractedText.toLowerCase().includes('methodology') ||
           e.extractedText.toLowerCase().includes('protocol') ||
           e.extractedText.toLowerCase().includes('technical specification')))
        );
        
        if (technicalDocs.length > 0) {
          answer = `Yes, technical documentation is available. Found ${technicalDocs.length} documents containing technical methodologies, protocols, and specifications.`;
          keyFindings = [
            `${technicalDocs.length} technical documents identified`,
            `Documents include methodologies, protocols, and technical specifications`,
            `Technical foundation appears well-documented for due diligence`
          ];
          confidence = Math.min(80, 50 + technicalDocs.length * 5);
        } else {
          answer = `Limited technical whitepaper documentation found. Only ${evidence.length} documents analyzed, but specific technical whitepapers not clearly identified.`;
          keyFindings = [
            `${evidence.length} documents reviewed for technical content`,
            `No clear technical whitepapers or methodologies identified`,
            `May require additional technical documentation for thorough analysis`
          ];
          confidence = Math.max(20, 40 - (10 - evidence.length) * 3);
        }
        break;
        
      case 'Are methodologies reproducible?':
        const methodologyContent = allContent.includes('methodology') || allContent.includes('protocol') || 
                                 allContent.includes('procedure') || allContent.includes('reproducible') ||
                                 allContent.includes('step-by-step') || allContent.includes('standardized');
        
        if (methodologyContent) {
          answer = `Methodology documentation is present. Found references to protocols, procedures, and systematic approaches in ${evidence.length} documents, suggesting reproducible methodologies.`;
          keyFindings = [
            `Methodology references found in multiple documents`,
            `Protocol and procedure documentation present`,
            `Systematic approach to research methods indicated`
          ];
          confidence = Math.min(75, 45 + evidence.length * 3);
        } else {
          answer = `Methodology reproducibility unclear. While ${evidence.length} documents were analyzed, specific protocol documentation and reproducibility measures not clearly evident.`;
          keyFindings = [
            `${evidence.length} documents reviewed for methodology content`,
            `Specific reproducibility protocols not clearly documented`,
            `Additional methodology documentation may be needed`
          ];
          confidence = Math.max(25, 35);
        }
        break;
        
      case 'Are competitive analyses included?':
        const competitiveContent = allContent.includes('competitor') || allContent.includes('competitive') || 
                                 allContent.includes('market share') || allContent.includes('landscape') ||
                                 allContent.includes('vs ') || allContent.includes('comparison');
        
        if (competitiveContent) {
          answer = `Yes, competitive analysis is included. Found competitive intelligence and market positioning information across ${evidence.length} documents.`;
          keyFindings = [
            `Competitive analysis content identified`,
            `Market positioning and competitor information present`,
            `Competitive landscape appears documented`
          ];
          confidence = Math.min(80, 50 + evidence.length * 4);
        } else {
          answer = `Limited competitive analysis found. Reviewed ${evidence.length} documents but comprehensive competitive intelligence not clearly evident.`;
          keyFindings = [
            `${evidence.length} documents reviewed for competitive content`,
            `Comprehensive competitive analysis not clearly documented`,
            `May benefit from additional competitive intelligence`
          ];
          confidence = Math.max(30, 45);
        }
        break;
        
      default:
        // Generic but more intelligent fallback for other questions
        const hasRelevantContent = evidence.length > 3 && allContent.length > 1000;
        if (hasRelevantContent) {
          answer = `Analysis found ${evidence.length} relevant documents addressing this research area. Content suggests some coverage of the topic.`;
          keyFindings = [
            `${evidence.length} documents contain related information`,
            `Content analysis suggests partial coverage of the research question`,
            `Further detailed review recommended for complete assessment`
          ];
          confidence = Math.min(65, 40 + evidence.length * 2);
        } else {
          answer = `Limited documentation found for this research question. Only ${evidence.length} potentially relevant documents identified.`;
          keyFindings = [
            `${evidence.length} documents reviewed`,
            `Limited specific content for this research area`,
            `Additional documentation needed for thorough analysis`
          ];
          confidence = Math.max(20, 30);
        }
    }
    
    // Set default values for missing variables
    researchAssessment = researchAssessment || 'Research assessment completed based on available documentation';
    const defaultRecommendations = ['Validate findings with domain experts', 'Consider additional supporting evidence'];
    
    return {
      answer,
      confidence,
      keyFindings: keyFindings.slice(0, 3),
      evidenceSummary: `Analysis completed using ${evidence.length} documents with relevant research indicators`,
      researchAssessment,
      recommendations: defaultRecommendations.slice(0, 2),
      sources: documentNames,
      quotes: [],
      detailedEvidence: []
    };
  }

  async getAnalysisResults(dealId: number) {
    const analysis = await storage.getAgentAnalysisByDealAndType(dealId, 'Research');
    
    if (!analysis) {
      return null;
    }

    const results: any = {
      status: analysis.status,
      findings: analysis.findings || [],
      recommendations: analysis.recommendations || [],
      completedAt: analysis.completedAt
    };

    // Parse research answers if they exist (handle both camelCase and snake_case)
    const researchAnswersData = analysis.research_answers || analysis.researchAnswers;
    if (researchAnswersData) {
      try {
        const researchAnswers = typeof researchAnswersData === 'string' 
          ? JSON.parse(researchAnswersData) 
          : researchAnswersData;
        results.researchAnswers = researchAnswers;
      } catch (error: any) {
        console.error('Error parsing research answers:', error?.message || error);
        results.researchAnswers = {};
      }
    }

    return results;
  }
}

export const comprehensiveResearchAnalysisService = new ComprehensiveResearchAnalysisService();