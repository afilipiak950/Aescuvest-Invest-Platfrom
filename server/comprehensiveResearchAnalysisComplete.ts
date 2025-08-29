/**
 * Comprehensive Research Analysis Service
 * Analyzes ALL assigned research documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced research questions for comprehensive analysis
export const COMPREHENSIVE_RESEARCH_QUESTIONS = [
  // Technical Whitepapers
  {
    id: 'technical_1',
    category: 'Technical Whitepapers',
    question: 'Are methodologies reproducible?',
    analysisPrompt: 'Analyze technical methodologies for reproducibility, clear step-by-step procedures, documented protocols, and replicable experimental designs.',
    keywords: ['methodology', 'reproducible', 'protocol', 'procedure', 'experimental design', 'replication', 'validation']
  },
  {
    id: 'technical_2',
    category: 'Technical Whitepapers',
    question: 'Are KPIs / benchmarks clearly described?',
    analysisPrompt: 'Evaluate whether key performance indicators and benchmarks are clearly defined, measurable, and include baseline comparisons.',
    keywords: ['kpi', 'benchmark', 'performance indicator', 'metrics', 'baseline', 'measurement', 'evaluation']
  },
  {
    id: 'technical_3',
    category: 'Technical Whitepapers',
    question: 'Are claims cited and supported by peer-reviewed literature?',
    analysisPrompt: 'Verify that technical claims are backed by citations to peer-reviewed literature, scientific studies, and authoritative sources.',
    keywords: ['citation', 'peer-reviewed', 'literature', 'references', 'scientific study', 'journal', 'research']
  },
  
  // Market Research Reports
  {
    id: 'market_1',
    category: 'Market Research Reports',
    question: 'Are TAM/SAM/SOM defined with assumptions?',
    analysisPrompt: 'Assess whether Total Addressable Market, Serviceable Addressable Market, and Serviceable Obtainable Market are clearly defined with underlying assumptions.',
    keywords: ['tam', 'sam', 'som', 'total addressable market', 'serviceable addressable market', 'market size', 'market assumptions']
  },
  {
    id: 'market_2',
    category: 'Market Research Reports',
    question: 'Are sources cited (Gartner, Statista, CB Insights)?',
    analysisPrompt: 'Verify that market data sources are cited, including reputable sources like Gartner, Statista, CB Insights, IDC, or other authoritative market research firms.',
    keywords: ['gartner', 'statista', 'cb insights', 'idc', 'market research', 'data source', 'analyst report']
  },
  {
    id: 'market_3',
    category: 'Market Research Reports',
    question: 'Are forecasts based on bottom-up or top-down logic?',
    analysisPrompt: 'Determine whether market forecasts use bottom-up analysis (building from individual data points) or top-down analysis (starting from broad market), and assess the logic.',
    keywords: ['bottom-up', 'top-down', 'forecast', 'market projection', 'analysis method', 'forecasting logic']
  },
  
  // Academic Publications
  {
    id: 'academic_1',
    category: 'Academic Publications',
    question: 'Are papers peer-reviewed?',
    analysisPrompt: 'Verify whether academic papers are peer-reviewed publications from recognized academic journals or conferences.',
    keywords: ['peer-reviewed', 'academic journal', 'conference', 'publication', 'peer review', 'scholarly']
  },
  {
    id: 'academic_2',
    category: 'Academic Publications',
    question: 'Are citations in PubMed, arXiv, Nature, etc.?',
    analysisPrompt: 'Check if citations reference authoritative academic databases like PubMed, arXiv, Nature, Science, IEEE, or other high-impact journals.',
    keywords: ['pubmed', 'arxiv', 'nature', 'science', 'ieee', 'high-impact', 'journal', 'database']
  },
  {
    id: 'academic_3',
    category: 'Academic Publications',
    question: 'Is the publication recent and still relevant?',
    analysisPrompt: 'Evaluate the publication date and assess whether the research is current and relevant to modern applications.',
    keywords: ['publication date', 'recent', 'current', 'relevance', 'modern', 'up-to-date']
  },
  
  // Patent Landscape Analyses
  {
    id: 'patent_1',
    category: 'Patent Landscape Analyses',
    question: 'Are competitive patents mapped?',
    analysisPrompt: 'Identify competitive patent mapping, patent landscape analysis, and competitor IP positioning.',
    keywords: ['patent landscape', 'competitive patents', 'patent mapping', 'competitor ip', 'patent analysis']
  },
  {
    id: 'patent_2',
    category: 'Patent Landscape Analyses',
    question: 'Are patent gaps or white spaces identified?',
    analysisPrompt: 'Look for identification of patent gaps, white spaces, and opportunities for future patent filings.',
    keywords: ['patent gaps', 'white spaces', 'patent opportunities', 'unprotected areas', 'patent strategy']
  },
  
  // Competitive Intelligence Reports
  {
    id: 'competitive_1',
    category: 'Competitive Intelligence Reports',
    question: 'Are competitor strengths/weaknesses objectively assessed?',
    analysisPrompt: 'Evaluate whether competitor analysis includes objective assessment of strengths and weaknesses with supporting evidence.',
    keywords: ['competitor analysis', 'strengths', 'weaknesses', 'competitive assessment', 'swot', 'competitive intelligence']
  },
  {
    id: 'competitive_2',
    category: 'Competitive Intelligence Reports',
    question: 'Are market positioning strategies compared?',
    analysisPrompt: 'Analyze market positioning strategies, competitive differentiation, and strategic positioning comparisons.',
    keywords: ['market positioning', 'competitive strategy', 'differentiation', 'strategic positioning', 'competitive advantage']
  },
  
  // Research Collaboration Agreements
  {
    id: 'collaboration_1',
    category: 'Research Collaboration Agreements',
    question: 'Are research outcomes and IP ownership defined?',
    analysisPrompt: 'Review research collaboration terms, outcome ownership, IP rights allocation, and publication rights.',
    keywords: ['research collaboration', 'ip ownership', 'research outcomes', 'publication rights', 'joint research']
  },
  {
    id: 'collaboration_2',
    category: 'Research Collaboration Agreements',
    question: 'Are milestone deliverables and timelines clear?',
    analysisPrompt: 'Identify research milestones, deliverable specifications, timeline commitments, and progress tracking mechanisms.',
    keywords: ['research milestones', 'deliverables', 'timeline', 'research progress', 'project management']
  },
  
  // Industry Analysis Reports
  {
    id: 'industry_1',
    category: 'Industry Analysis Reports',
    question: 'Are industry trends supported by data?',
    analysisPrompt: 'Verify that industry trend analysis is supported by quantitative data, statistics, and credible sources.',
    keywords: ['industry trends', 'market trends', 'data support', 'statistics', 'trend analysis', 'market dynamics']
  },
  {
    id: 'industry_2',
    category: 'Industry Analysis Reports',
    question: 'Are regulatory/policy impacts considered?',
    analysisPrompt: 'Assess whether regulatory changes, policy impacts, and compliance requirements are factored into industry analysis.',
    keywords: ['regulatory impact', 'policy changes', 'compliance', 'regulation', 'government policy', 'regulatory environment']
  }
];

export class ComprehensiveResearchAnalysisService {
  
  /**
   * Run comprehensive analysis for all assigned research documents
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
    
    try {
      // Get all research documents
      const assignedDocuments = await this.getAssignedResearchDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} research documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No research documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No research documents available for analysis'
        });
        return { success: false, message: 'No research documents found' };
      }
      
      // Initialize progress
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting research analysis',
        processedDocuments: 0,
        totalDocuments: COMPREHENSIVE_RESEARCH_QUESTIONS.length
      });
      
      // Process each question systematically
      const researchAnswers: Record<string, any> = {};
      
      for (let i = 0; i < COMPREHENSIVE_RESEARCH_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_RESEARCH_QUESTIONS[i];
        console.log(`🔍 Processing research question ${i + 1}/${COMPREHENSIVE_RESEARCH_QUESTIONS.length}: ${question.question}`);
        
        // Update progress
        const progress = Math.round(((i + 1) / COMPREHENSIVE_RESEARCH_QUESTIONS.length) * 90) + 5;
        await storageService.updateBackgroundJob(jobId, {
          progress,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`,
          processedDocuments: i
        });
        
        try {
          console.log(`📊 Extracting research evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, 
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer based on all evidence
          const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
          researchAnswers[question.id] = answer;
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_RESEARCH_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question
          researchAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          continue;
        }
      }
      
      // Update progress to completion
      await storageService.updateBackgroundJob(jobId, {
        progress: 100,
        processedDocuments: COMPREHENSIVE_RESEARCH_QUESTIONS.length,
        currentStep: 'Generating findings and recommendations',
        status: 'completing'
      });
      
      // Generate comprehensive findings and recommendations
      const findings = this.generateComprehensiveFindings(researchAnswers);
      const recommendations = this.generateComprehensiveRecommendations(researchAnswers);
      
      // Store the analysis results
      await this.storeComprehensiveResults(dealId, researchAnswers, findings, recommendations, assignedDocuments);
      
      // Mark job as completed
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        currentStep: 'Analysis completed'
      });
      
      console.log(`✅ Comprehensive research analysis completed for deal ${dealId}`);
      
      return {
        success: true,
        documentsAnalyzed: assignedDocuments.length,
        questionsAnswered: Object.keys(researchAnswers).length,
        findings: findings.length,
        recommendations: recommendations.length
      };
      
    } catch (error) {
      console.error(`❌ Critical error in research analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all documents suitable for research analysis
   */
  private async getAssignedResearchDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to research agent
    let researchDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('research')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to research: ${researchDocuments.length}`);
    
    // If no documents are explicitly assigned, identify research-related documents
    if (researchDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to research agent, identifying research-related documents...');
      
      researchDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Research document keywords
        const researchKeywords = [
          'research', 'study', 'analysis', 'report', 'whitepaper', 'paper',
          'publication', 'journal', 'academic', 'scientific', 'technical',
          'methodology', 'benchmark', 'market research', 'competitive analysis',
          'industry analysis', 'patent landscape', 'literature review',
          'data', 'findings', 'results', 'conclusion', 'hypothesis',
          'experiment', 'survey', 'investigation', 'evaluation'
        ];
        
        // Check document name and content for research keywords
        const hasResearchKeywords = researchKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for research document type
        const isResearchDocument = aiSummary?.documentType?.toLowerCase().includes('research') ||
                                 aiSummary?.documentType?.toLowerCase().includes('analysis') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('research') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('study');
        
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
  
  /**
   * Extract evidence from ALL documents for a specific question
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
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
    
    const prompt = `You are an expert research analyst conducting comprehensive investment analysis. Your task is to find ANY research, technical, academic, or analytical information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Look for DIRECT research terms, studies, analyses, technical data, methodologies
- Look for INDIRECT references to market research, competitive intelligence, technical validation, academic backing
- Consider business documents that mention research findings, market analysis, technical studies, validation data
- Even general business context often has research implications for investment due diligence
- For technology companies, most business documents contain research information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "researchContext": "How this document relates to research/technical validation aspects of the business"
}

Be thorough in finding relevance - most business documents have research implications for investment analysis.`;

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
        fullContent: content.substring(0, 1000)
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
        answer: `No relevant research information found in the assigned research documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant research information found'],
        category: question.category
      };
    }

    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    const prompt = `You are an expert research analyst compiling a comprehensive answer based on evidence from multiple documents.

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
5. Include research recommendations

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "researchAssessment": "Overall research assessment based on evidence",
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
        sources: compiledAnswer.sources || evidence.map(e => e.documentName),
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        researchAssessment: compiledAnswer.researchAssessment || '',
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
        sources: evidence.map(e => e.documentName),
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
      const question = COMPREHENSIVE_RESEARCH_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Research Documents',
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
          content: `Insufficient research information for: ${question.question}. Additional documentation may be required.`,
          source: 'Research Analysis',
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
            title: `Research Due Diligence: ${answer.question}`,
            description: rec,
            priority: answer.confidence < 60 ? 'high' : 'medium',
            category: 'research',
            impact: answer.confidence < 40 ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Documentation Gap: ${answer.question}`,
          description: `Missing research information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'research',
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
    researchAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documentsAnalyzed: any[]
  ): Promise<void> {
    // First, delete any existing research analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'research')
      ));
    
    console.log(`🗑️ Cleared existing research analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'research' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      research_answers: JSON.stringify(researchAnswers),
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive research analysis for deal ${dealId} with ${Object.keys(researchAnswers).length} questions answered`);
  }
}

// Export the service instance
export const comprehensiveResearchAnalysisService = new ComprehensiveResearchAnalysisService();