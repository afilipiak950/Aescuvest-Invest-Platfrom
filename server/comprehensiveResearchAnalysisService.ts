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
  // Market Research
  { 
    id: 'market_1', 
    question: 'What is the total addressable market size?', 
    category: 'Market Research',
    analysisPrompt: 'Identify market size data, TAM calculations, market opportunity assessments, and addressable market analysis.',
    keywords: ['market size', 'tam', 'total addressable market', 'market opportunity', 'addressable market', 'market potential']
  },
  { 
    id: 'market_2', 
    question: 'What are the key market trends and growth drivers?', 
    category: 'Market Research',
    analysisPrompt: 'Find market trends, growth projections, industry drivers, and market dynamics.',
    keywords: ['market trends', 'growth drivers', 'industry trends', 'market dynamics', 'market growth', 'growth projections']
  },
  { 
    id: 'market_3', 
    question: 'Who are the target customer segments?', 
    category: 'Market Research',
    analysisPrompt: 'Identify target customers, customer segments, buyer personas, and market segments.',
    keywords: ['target customers', 'customer segments', 'buyer personas', 'market segments', 'customer base', 'target market']
  },
  // Competitive Analysis
  { 
    id: 'competitive_1', 
    question: 'Who are the main competitors?', 
    category: 'Competitive Analysis',
    analysisPrompt: 'Identify direct and indirect competitors, competitive landscape, and market players.',
    keywords: ['competitors', 'competition', 'competitive landscape', 'market players', 'competitive analysis']
  },
  { 
    id: 'competitive_2', 
    question: 'What is the competitive advantage?', 
    category: 'Competitive Analysis',
    analysisPrompt: 'Find competitive advantages, differentiation factors, unique value propositions, and competitive positioning.',
    keywords: ['competitive advantage', 'differentiation', 'unique value', 'competitive positioning', 'competitive edge']
  },
  { 
    id: 'competitive_3', 
    question: 'How does pricing compare to competitors?', 
    category: 'Competitive Analysis',
    analysisPrompt: 'Identify pricing comparisons, competitive pricing analysis, and market pricing strategies.',
    keywords: ['pricing comparison', 'competitive pricing', 'price analysis', 'pricing strategy', 'market pricing']
  },
  // Industry Analysis
  { 
    id: 'industry_1', 
    question: 'What are the industry growth projections?', 
    category: 'Industry Analysis',
    analysisPrompt: 'Find industry forecasts, growth projections, market predictions, and industry outlook.',
    keywords: ['industry growth', 'growth projections', 'industry forecast', 'market predictions', 'industry outlook']
  },
  { 
    id: 'industry_2', 
    question: 'What regulatory factors affect the industry?', 
    category: 'Industry Analysis',
    analysisPrompt: 'Identify regulatory requirements, compliance issues, industry regulations, and regulatory changes.',
    keywords: ['regulatory', 'compliance', 'regulations', 'regulatory requirements', 'industry regulations']
  }
];

class ComprehensiveResearchAnalysisService {
  
  async getAssignedResearchDocuments(dealId: number) {
    try {
      const allDocuments = await db.select().from(documents).where(eq(documents.dealId, dealId));
      
      // Filter documents relevant to research analysis
      const researchDocuments = allDocuments.filter(doc => {
        const name = doc.name.toLowerCase();
        const summary = typeof doc.aiSummary === 'string' ? doc.aiSummary.toLowerCase() : 
                       (doc.aiSummary?.executiveSummary || '').toLowerCase();
        
        // Research keywords for document filtering
        const researchKeywords = [
          'market', 'research', 'competitive', 'industry', 'analysis', 'segment', 'customer',
          'trends', 'growth', 'opportunity', 'demand', 'supply', 'pricing', 'competitors'
        ];
        
        return researchKeywords.some((keyword: string) => 
          name.includes(keyword) || summary.includes(keyword)
        );
      });
      
      console.log(`🔬 Research document filtering: ${researchDocuments.length}/${allDocuments.length} documents selected for research analysis`);
      return researchDocuments;
    } catch (error) {
      console.error('Error getting research documents:', error);
      return [];
    }
  }

  async extractEvidenceFromAllDocuments(documents: any[], question: any) {
    const documentEvidence = [];
    
    for (const doc of documents) {
      try {
        const content = typeof doc.aiSummary === 'string' ? doc.aiSummary : 
                       doc.aiSummary?.executiveSummary || doc.aiSummary?.content || '';
        
        if (!content || content.length < 50) continue;
        
        // Check if document contains relevant keywords
        const hasRelevantContent = question.keywords.some((keyword: string) =>
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasRelevantContent) {
          // Extract specific evidence using OpenAI
          const prompt = `
Analyze this document for research question: "${question.question}"

Document: ${doc.name}
Content: ${content}

${question.analysisPrompt}

Extract specific evidence that answers the question. If no relevant information is found, respond with "No specific evidence found for this question."

Format your response as:
- Evidence: [specific quotes or data points]
- Source: [document name]
- Relevance: [how this relates to the question]
`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1500
          });

          const evidence = response.choices[0]?.message?.content || 'No evidence extracted';
          
          if (!evidence.toLowerCase().includes('no specific evidence found')) {
            documentEvidence.push({
              document: doc.name,
              evidence,
              content: content.substring(0, 500)
            });
          }
        }
      } catch (error) {
        console.error(`Error extracting evidence from ${doc.name}:`, error);
      }
    }
    
    return documentEvidence;
  }

  async compileComprehensiveAnswer(question: any, documentEvidence: any[]) {
    if (documentEvidence.length === 0) {
      return {
        question: question.question,
        category: question.category,
        answer: 'No specific evidence found in the available documents for this research question.',
        confidence: 0,
        sources: [],
        evidence: [],
        documentCount: 0
      };
    }

    try {
      const evidenceText = documentEvidence.map(ev => 
        `Document: ${ev.document}\nEvidence: ${ev.evidence}`
      ).join('\n\n');

      const prompt = `
Based on the following evidence from multiple documents, provide a comprehensive answer to: "${question.question}"

Evidence from documents:
${evidenceText}

Provide a detailed, well-structured answer that:
1. Synthesizes information from all sources
2. Identifies key findings and insights
3. Notes any patterns or trends
4. Highlights important data points or metrics
5. Maintains objectivity and accuracy

Answer:`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      return {
        question: question.question,
        category: question.category,
        answer: response.choices[0]?.message?.content || 'Unable to compile comprehensive answer',
        confidence: Math.min(documentEvidence.length * 20, 100),
        sources: documentEvidence.map(ev => ev.document),
        evidence: documentEvidence,
        documentCount: documentEvidence.length
      };
    } catch (error) {
      console.error('Error compiling comprehensive answer:', error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: documentEvidence.map(ev => ev.document),
        evidence: documentEvidence,
        documentCount: documentEvidence.length,
        error: true
      };
    }
  }

  async runComprehensiveAnalysis(
    dealId: number, 
    storageService: any, 
    jobId: string, 
    progressCallback: Function
  ) {
    console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
    
    try {
      // Update job status
      await storageService.updateBackgroundJob(jobId, {
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing research analysis'
      });
    } catch (error) {
      console.error('Error updating background job status:', error);
    }
    
    // Get all documents suitable for research analysis
    const assignedDocuments = await this.getAssignedResearchDocuments(dealId);
    console.log(`📄 Found ${assignedDocuments.length} documents suitable for research analysis`);
    
    if (assignedDocuments.length === 0) {
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        error: 'No documents available for research analysis'
      });
      throw new Error('No documents available for research analysis');
    }
    
    // Update job with total questions to process
    await storageService.updateBackgroundJob(jobId, {
      totalDocuments: COMPREHENSIVE_RESEARCH_QUESTIONS.length,
      currentStep: 'Analyzing research documents across 8 question categories'
    });
    
    // Process each question comprehensively with enhanced error handling
    const researchAnswers: Record<string, any> = {};
    
    for (let i = 0; i < COMPREHENSIVE_RESEARCH_QUESTIONS.length; i++) {
      const question = COMPREHENSIVE_RESEARCH_QUESTIONS[i];
      console.log(`🔍 Processing question ${i + 1}/${COMPREHENSIVE_RESEARCH_QUESTIONS.length}: ${question.question}`);
      
      try {
        // Update progress with error handling
        const progress = Math.round((i / COMPREHENSIVE_RESEARCH_QUESTIONS.length) * 100);
        await storageService.updateBackgroundJob(jobId, {
          progress,
          processedDocuments: i,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`
        });
        
        // Extract evidence from ALL assigned documents for this question
        console.log(`📄 Processing ${assignedDocuments.length} documents for question: ${question.question}`);
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
          answer: `Error processing this question: ${(questionError as Error).message}`,
          confidence: 0,
          sources: [],
          evidence: [],
          error: true
        };
        
        // Continue with next question instead of failing completely
        continue;
      }
    }
    
    try {
      // Update progress to completion
      await storageService.updateBackgroundJob(jobId, {
        progress: 100,
        processedDocuments: COMPREHENSIVE_RESEARCH_QUESTIONS.length,
        currentStep: 'Generating findings and recommendations',
        status: 'completing'
      });
      
      // Generate comprehensive findings and recommendations
      const findings = [];
      const recommendations = [];
      
      // Extract findings from answers
      Object.values(researchAnswers).forEach((answer: any) => {
        if (answer.confidence > 0 && !answer.error) {
          findings.push(`${answer.category}: ${answer.answer.substring(0, 200)}...`);
          
          if (answer.category === 'Market Research') {
            recommendations.push('Validate market size assumptions with additional research');
          } else if (answer.category === 'Competitive Analysis') {
            recommendations.push('Monitor competitive developments and positioning');
          } else if (answer.category === 'Industry Analysis') {
            recommendations.push('Track industry trends and regulatory changes');
          }
        }
      });
      
      // Store the comprehensive analysis in agent_analyses table
      const analysisData = {
        findings,
        recommendations,
        research_answers: researchAnswers,
        researchAnswers: researchAnswers, // Also store in the expected format
        documentCount: assignedDocuments.length,
        questionsAnalyzed: COMPREHENSIVE_RESEARCH_QUESTIONS.length,
        completionRate: Math.round((Object.values(researchAnswers).filter((a: any) => !a.error).length / COMPREHENSIVE_RESEARCH_QUESTIONS.length) * 100)
      };
      
      await storageService.saveAgentAnalysis(dealId, 'Research', analysisData);
      console.log(`💾 Saved research analysis to database for deal ${dealId}`);
      
      // Final completion
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Research analysis completed',
        completedAt: new Date()
      });
      
      console.log(`✅ Research analysis completed for deal ${dealId}`);
      return analysisData;
      
    } catch (error) {
      console.error(`❌ Error completing research analysis for deal ${dealId}:`, error);
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        progress: 100,
        error: error.message,
        currentStep: 'Analysis failed'
      });
      throw error;
    }
  }

  async getAnalysisResults(dealId: number) {
    try {
      const analysis = await db.select()
        .from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Research')
        ))
        .orderBy(agentAnalyses.createdAt)
        .limit(1);

      if (analysis.length === 0) {
        return null;
      }

      const result = analysis[0];
      return {
        findings: result.findings || [],
        recommendations: result.recommendations || [],
        status: result.status,
        progress: 100,
        createdAt: result.createdAt,
        documentSources: [],
        research_answers: result.research_answers || null,
        researchAnswers: result.researchAnswers || null
      };
    } catch (error) {
      console.error(`❌ Error retrieving research analysis results:`, error);
      return null;
    }
  }
}

export const comprehensiveResearchAnalysisService = new ComprehensiveResearchAnalysisService();