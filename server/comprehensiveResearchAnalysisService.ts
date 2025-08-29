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

export interface ResearchAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface ResearchEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface ResearchAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: ResearchEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  researchAssessment: string;
  recommendations: string[];
}

class ComprehensiveResearchAnalysisService {
  public isRunning = false;
  public progress = 0;
  public currentStep = '';
  public currentQuestion = '';
  private analysisId: string | null = null;
  
  async getAssignedDocuments(dealId: number) {
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

  async extractEvidenceFromAllDocuments(documents: any[], question: any): Promise<ResearchEvidence[]> {
    const documentEvidence: ResearchEvidence[] = [];
    
    console.log(`🔍 Research micro-step: Processing ${documents.length} documents for question: ${question.question}`);
    
    for (const doc of documents) {
      try {
        const content = typeof doc.aiSummary === 'string' ? doc.aiSummary : 
                       doc.aiSummary?.executiveSummary || doc.aiSummary?.content || '';
        
        if (!content || content.length < 50) continue;
        
        // Enhanced keyword matching with partial matches
        const hasRelevantContent = question.keywords.some((keyword: string) =>
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasRelevantContent) {
          console.log(`📄 Research micro-step: Found relevant content in ${doc.name}`);
          // Extract specific evidence using OpenAI with enhanced JSON robustness
          const prompt = `Analyze this document for research evidence about: "${question.question}"

Document: ${doc.name}
Content: ${content.substring(0, 3000)}

Focus: ${question.analysisPrompt}
Keywords to look for: ${question.keywords.join(', ')}

CRITICAL: You must respond with valid JSON only. No explanations, no markdown, just pure JSON.

Extract research evidence and format as JSON:
{
  "hasEvidence": boolean,
  "relevantContent": ["exact quote 1", "exact quote 2"],
  "keyFindings": ["finding 1", "finding 2"],
  "confidence": number (0-10),
  "documentSummary": "brief summary of document relevance"
}

If no relevant evidence found, respond with:
{
  "hasEvidence": false,
  "relevantContent": [],
  "keyFindings": [],
  "confidence": 0,
  "documentSummary": "No relevant research evidence found"
}`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 1000
          });

          let evidenceData;
          try {
            const responseText = response.choices[0]?.message?.content?.trim() || '';
            
            // Enhanced JSON parsing with multiple fallback strategies
            let cleanedResponse = responseText;
            if (cleanedResponse.includes('```json')) {
              cleanedResponse = cleanedResponse.replace(/```json\s*|\s*```/g, '');
            }
            if (cleanedResponse.includes('```')) {
              cleanedResponse = cleanedResponse.replace(/```[^`]*```/g, '');
              cleanedResponse = cleanedResponse.replace(/```/g, '');
            }
            
            cleanedResponse = cleanedResponse.trim();
            
            // Find the JSON object boundaries
            const jsonStart = cleanedResponse.indexOf('{');
            const jsonEnd = cleanedResponse.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
            }
            
            evidenceData = JSON.parse(cleanedResponse);
            console.log(`✅ Research micro-step: JSON parsed successfully for ${doc.name}`);
          } catch (parseError) {
            console.error(`❌ Research micro-step: JSON parse failed for ${doc.name}:`, parseError);
            console.log('Raw response:', response.choices[0]?.message?.content);
            
            evidenceData = {
              hasEvidence: false,
              relevantContent: [],
              keyFindings: [],
              confidence: 0,
              documentSummary: "JSON parsing error occurred"
            };
          }
          
          if (evidenceData.hasEvidence && evidenceData.confidence > 0) {
            documentEvidence.push({
              documentName: doc.name,
              documentSummary: evidenceData.documentSummary || '',
              relevantContent: Array.isArray(evidenceData.relevantContent) ? evidenceData.relevantContent : [],
              keyFindings: Array.isArray(evidenceData.keyFindings) ? evidenceData.keyFindings : [],
              confidence: typeof evidenceData.confidence === 'number' ? evidenceData.confidence : 0
            });
            console.log(`📊 Research micro-step: Added evidence from ${doc.name} (confidence: ${evidenceData.confidence})`);
          }
        }
      } catch (error) {
        console.error(`❌ Research micro-step: Error extracting evidence from ${doc.name}:`, error);
      }
    }
    
    console.log(`📊 Research micro-step: Extracted evidence from ${documentEvidence.length} documents`);
    return documentEvidence;
  }

  async compileComprehensiveAnswer(question: any, documentEvidence: ResearchEvidence[]): Promise<ResearchAnswer> {
    console.log(`🔍 Research micro-step: Compiling answer for "${question.question}" with ${documentEvidence.length} evidence sources`);
    
    if (documentEvidence.length === 0) {
      return {
        question: question.question,
        answer: 'No specific evidence found in the available documents for this research question.',
        confidence: 0,
        sources: [],
        detailedEvidence: [],
        keyFindings: [],
        evidenceSummary: 'No evidence available',
        researchAssessment: 'Insufficient data for research analysis',
        recommendations: ['Obtain additional research documents', 'Conduct primary market research']
      };
    }

    try {
      const evidenceText = documentEvidence.map(ev => 
        `Document: ${ev.documentName}
Summary: ${ev.documentSummary}
Key Findings: ${ev.keyFindings.join('; ')}
Content: ${ev.relevantContent.join('; ')}
Confidence: ${ev.confidence}/10`
      ).join('\n\n---\n\n');

      const prompt = `Based on evidence from ${documentEvidence.length} documents, provide a comprehensive research analysis for: "${question.question}"

Evidence from documents:
${evidenceText}

CRITICAL: You must respond with valid JSON only. No explanations, no markdown, just pure JSON.

Provide comprehensive research analysis as JSON:
{
  "answer": "detailed research analysis addressing the question",
  "confidence": number (1-10),
  "keyFindings": ["key finding 1", "key finding 2", "key finding 3"],
  "evidenceSummary": "summary of evidence quality and sources",
  "researchAssessment": "overall assessment of research findings",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500
      });

      // Enhanced JSON parsing for research analysis
      let analysisData;
      try {
        const responseText = response.choices[0]?.message?.content?.trim() || '';
        
        // Enhanced JSON parsing with multiple fallback strategies (same as evidence extraction)
        let cleanedResponse = responseText;
        if (cleanedResponse.includes('```json')) {
          cleanedResponse = cleanedResponse.replace(/```json\s*|\s*```/g, '');
        }
        if (cleanedResponse.includes('```')) {
          cleanedResponse = cleanedResponse.replace(/```[^`]*```/g, '');
          cleanedResponse = cleanedResponse.replace(/```/g, '');
        }
        
        cleanedResponse = cleanedResponse.trim();
        
        // Find the JSON object boundaries
        const jsonStart = cleanedResponse.indexOf('{');
        const jsonEnd = cleanedResponse.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1);
        }
        
        analysisData = JSON.parse(cleanedResponse);
        console.log(`✅ Research micro-step: Analysis JSON parsed successfully`);
      } catch (parseError) {
        console.error(`❌ Research micro-step: Analysis JSON parse failed:`, parseError);
        console.log('Raw response:', response.choices[0]?.message?.content);
        
        // Fallback to raw text analysis
        analysisData = {
          answer: response.choices[0]?.message?.content || 'Unable to parse analysis',
          confidence: Math.min(documentEvidence.length * 2, 8),
          keyFindings: ['Analysis parsing error occurred'],
          evidenceSummary: `Based on ${documentEvidence.length} evidence sources`,
          researchAssessment: 'JSON parsing error - raw analysis available',
          recommendations: ['Review document sources', 'Retry analysis if needed']
        };
      }

      return {
        question: question.question,
        answer: analysisData.answer || 'Analysis not available',
        confidence: typeof analysisData.confidence === 'number' ? analysisData.confidence : Math.min(documentEvidence.length * 2, 8),
        sources: documentEvidence.map(ev => ev.documentName),
        detailedEvidence: documentEvidence,
        keyFindings: Array.isArray(analysisData.keyFindings) ? analysisData.keyFindings : [],
        evidenceSummary: analysisData.evidenceSummary || `Based on ${documentEvidence.length} evidence sources`,
        researchAssessment: analysisData.researchAssessment || 'Research assessment not available',
        recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : []
      };
    } catch (error) {
      console.error('❌ Research micro-step: Error compiling comprehensive answer:', error);
      return {
        question: question.question,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: documentEvidence.map(ev => ev.documentName),
        detailedEvidence: documentEvidence,
        keyFindings: [`Error: ${error.message}`],
        evidenceSummary: 'Error occurred during analysis',
        researchAssessment: 'Analysis failed due to processing error',
        recommendations: ['Retry analysis', 'Check document availability', 'Review error logs']
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
    const assignedDocuments = await this.getAssignedDocuments(dealId);
    console.log(`📄 Found ${assignedDocuments.length} documents suitable for research analysis`);
    
    if (assignedDocuments.length === 0) {
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        error: 'No documents available for research analysis'
      });
      throw new Error('No documents available for research analysis');
    }
    
    // Update job with total documents to process (same as Clinical)
    await storageService.updateBackgroundJob(jobId, {
      totalDocuments: assignedDocuments.length,
      currentStep: 'Analyzing research documents across 8 question categories'
    });
    
    // Process each question comprehensively with enhanced error handling
    const researchAnswers: Record<string, any> = {};
    
    for (let i = 0; i < COMPREHENSIVE_RESEARCH_QUESTIONS.length; i++) {
      const question = COMPREHENSIVE_RESEARCH_QUESTIONS[i];
      console.log(`🔍 Processing question ${i + 1}/${COMPREHENSIVE_RESEARCH_QUESTIONS.length}: ${question.question}`);
      
      try {
        // Update progress with error handling (same as Clinical)
        const progress = Math.round((i / COMPREHENSIVE_RESEARCH_QUESTIONS.length) * 100);
        await storageService.updateBackgroundJob(jobId, {
          progress,
          processedDocuments: i,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.question}`
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
      
      // CRITICAL FIX: Store directly to database like Clinical service (identical pattern)
      // First, delete any existing research analysis to ensure clean replacement
      await db
        .delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'research')
        ));
      
      console.log(`🗑️ Cleared existing research analysis for deal ${dealId}`);
      
      // Create the new comprehensive analysis using EXACT same pattern as Clinical
      const analysisData = {
        dealId,
        agentType: 'research' as const,
        status: 'completed' as const, // CRITICAL: Must match Clinical exactly
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        research_answers: JSON.stringify(researchAnswers), // Store in research_answers column
        documentSources: JSON.stringify(assignedDocuments.map(d => d.name)),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db
        .insert(agentAnalyses)
        .values(analysisData);
      
      console.log(`📊 Created fresh comprehensive research analysis for deal ${dealId} with ${Object.keys(researchAnswers).length} questions answered`);
      
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

  getProgress(): ResearchAnalysisProgress {
    return {
      isRunning: this.isRunning,
      progress: this.progress,
      message: this.currentStep,
      currentStep: this.currentStep,
      currentQuestion: this.currentQuestion,
      totalSteps: COMPREHENSIVE_RESEARCH_QUESTIONS.length
    };
  }

  async getStoredAnalysis(dealId: number): Promise<any> {
    try {
      const analysis = await db.select()
        .from(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'Research'),
          eq(agentAnalyses.status, 'completed')
        ))
        .orderBy(agentAnalyses.id)
        .limit(1);

      if (analysis.length === 0) {
        return null;
      }

      const result = analysis[0];
      const researchData = result.research_answers || {};
      
      console.log(`✅ Found Research analysis for deal ${dealId}: ${Object.keys(researchData).length} questions analyzed`);
      
      return {
        id: result.id,
        researchAnswers: researchData,
        research_answers: researchData,
        findings: result.findings || [],
        recommendations: result.recommendations || [],
        createdAt: result.createdAt,
        status: result.status
      };
    } catch (error) {
      console.error(`❌ Error retrieving Research analysis for deal ${dealId}:`, error);
      return null;
    }
  }
}

export const comprehensiveResearchAnalysisService = new ComprehensiveResearchAnalysisService();