import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { resilientOpenAI } from './utils/resilientOpenAI';

export const RESEARCH_QUESTIONS = [
  // Competitive Intelligence
  { 
    id: 'research_1', 
    question: 'What competitive threats exist and how significant are they?', 
    category: 'Competitive Intelligence',
    keywords: ['competitive threat', 'competitor', 'competition', 'competitive landscape', 'market share', 'competitive advantage', 'threat assessment', 'competitive risk']
  },
  { 
    id: 'research_2', 
    question: 'What is the patent landscape and IP positioning?', 
    category: 'Competitive Intelligence',
    keywords: ['patent landscape', 'ip position', 'intellectual property', 'patent portfolio', 'patent protection', 'ip strategy', 'patent analysis', 'freedom to operate']
  },
  { 
    id: 'research_3', 
    question: 'How defensible is the technology moat?', 
    category: 'Competitive Intelligence',
    keywords: ['technology moat', 'defensibility', 'competitive moat', 'barrier to entry', 'technological advantage', 'proprietary technology', 'technical differentiation']
  },
  // Market Analysis
  { 
    id: 'research_4', 
    question: 'What is the Total Addressable Market (TAM) size and growth?', 
    category: 'Market Analysis',
    keywords: ['total addressable market', 'tam', 'market size', 'market growth', 'market opportunity', 'addressable market', 'market potential', 'market expansion']
  },
  { 
    id: 'research_5', 
    question: 'What are the key market trends and drivers?', 
    category: 'Market Analysis',
    keywords: ['market trends', 'market drivers', 'industry trends', 'growth drivers', 'market dynamics', 'trend analysis', 'market forces', 'industry evolution']
  },
  { 
    id: 'research_6', 
    question: 'What is the regulatory environment and compliance requirements?', 
    category: 'Market Analysis',
    keywords: ['regulatory environment', 'compliance requirements', 'regulation', 'regulatory risk', 'compliance', 'regulatory framework', 'industry standards']
  },
  // Technology Assessment
  { 
    id: 'research_7', 
    question: 'What is the technology maturity and scalability potential?', 
    category: 'Technology Assessment',
    keywords: ['technology maturity', 'scalability', 'technological readiness', 'scale potential', 'technical scalability', 'platform scalability', 'technology risk']
  },
  { 
    id: 'research_8', 
    question: 'What are the key technology dependencies and risks?', 
    category: 'Technology Assessment',
    keywords: ['technology dependencies', 'technology risk', 'technical dependencies', 'platform dependencies', 'technology stack', 'technical risk assessment']
  },
  { 
    id: 'research_9', 
    question: 'What data quality and validation has been performed?', 
    category: 'Technology Assessment',
    keywords: ['data quality', 'data validation', 'data integrity', 'data accuracy', 'data governance', 'data verification', 'quality assurance', 'data standards']
  },
  // Strategic Analysis
  { 
    id: 'research_10', 
    question: 'What are the potential exit strategies and acquirer landscape?', 
    category: 'Strategic Analysis',
    keywords: ['exit strategy', 'acquirer', 'acquisition', 'strategic buyer', 'exit opportunity', 'merger', 'acquisition target', 'strategic partnership']
  },
  { 
    id: 'research_11', 
    question: 'What international expansion opportunities exist?', 
    category: 'Strategic Analysis',
    keywords: ['international expansion', 'global expansion', 'international market', 'geographic expansion', 'global opportunity', 'international strategy', 'market expansion']
  },
  { 
    id: 'research_12', 
    question: 'What are the ESG considerations and sustainability factors?', 
    category: 'Strategic Analysis',
    keywords: ['esg', 'sustainability', 'environmental impact', 'social responsibility', 'governance', 'sustainable business', 'environmental considerations', 'social impact']
  },
  { 
    id: 'research_13', 
    question: 'What customer validation and market traction evidence exists?', 
    category: 'Strategic Analysis',
    keywords: ['customer validation', 'market traction', 'product market fit', 'customer feedback', 'market adoption', 'user engagement', 'customer retention', 'revenue traction', 'growth metrics']
  }
];

export class ComprehensiveResearchAnalysisService {
  private storage: any;
  private jobId: string;

  constructor() {
    this.storage = null;
    this.jobId = '';
  }

  async runComprehensiveAnalysis(dealId: number, storage: any, jobId: string) {
    this.storage = storage;
    this.jobId = jobId;
    
    console.log(`🔬 Starting comprehensive research analysis for deal ${dealId}`);
    
    try {
      // Update job status
      await this.updateJobProgress(10, 'Fetching documents');
      
      // Get all documents for this deal assigned to research
      const docs = await db.select().from(documents)
        .where(and(
          eq(documents.dealId, dealId),
          eq(documents.agentType, 'research')
        ));
      
      console.log(`📊 Found ${docs.length} documents assigned to research for deal ${dealId}`);
      
      if (docs.length === 0) {
        console.log(`⚠️ No documents assigned to research for deal ${dealId}`);
        await this.completeAnalysis(dealId, {}, [], [], 0);
        return;
      }
      
      await this.updateJobProgress(20, 'Processing documents');
      
      // Process each research question - LEGAL PATTERN: Structured answers
      const researchAnswers: Record<string, any> = {};
      const findings: string[] = [];
      const recommendations: string[] = [];
      
      for (let i = 0; i < RESEARCH_QUESTIONS.length; i++) {
        const question = RESEARCH_QUESTIONS[i];
        const progress = 20 + (i / RESEARCH_QUESTIONS.length) * 60;
        
        await this.updateJobProgress(progress, `Analyzing: ${question.question}`);
        
        try {
          // LEGAL PATTERN: Pass job context for per-batch progress updates
          const answer = await this.analyzeQuestion(question, docs, this.jobId, this.storage, i, RESEARCH_QUESTIONS.length);
          researchAnswers[question.id] = answer;
          console.log(`✅ Research question ${question.id} answered successfully`);
        } catch (questionError: any) {
          console.error(`❌ Error processing research question ${i + 1}: ${question.question}`, questionError);
          
          // Store partial answer for failed question - LEGAL PATTERN
          researchAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            detailedEvidence: [],
            keyFindings: [],
            evidenceSummary: 'Error in analysis',
            researchAssessment: 'Analysis failed',
            recommendations: ['Retry analysis', 'Manual review required']
          };
        }
        
        // Rate limiting between questions - LEGAL PATTERN (1500ms, not 500ms)
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      await this.updateJobProgress(90, 'Generating findings and recommendations');
      
      // Generate findings and recommendations based on answers
      if (Object.keys(researchAnswers).length > 0) {
        const analysisResult = await this.generateFindingsAndRecommendations(researchAnswers);
        findings.push(...analysisResult.findings);
        recommendations.push(...analysisResult.recommendations);
      }
      
      await this.updateJobProgress(95, 'Saving results');
      
      // Save the comprehensive analysis
      await this.completeAnalysis(dealId, researchAnswers, findings, recommendations, docs.length);
      
      await this.updateJobProgress(100, 'Analysis completed');
      
      console.log(`✅ Comprehensive research analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error in comprehensive research analysis:`, error);
      throw error;
    }
  }

  private async analyzeQuestion(
    question: any, 
    docs: any[],
    jobId?: string,
    storageService?: any,
    questionIndex?: number,
    totalQuestions?: number
  ): Promise<any> {
    try {
      console.log(`🔄 COMPREHENSIVE RESEARCH: Starting for "${question.question}" with ${docs.length} documents`);
      
      // LEGAL PATTERN: Process ALL documents, not just keyword-filtered ones
      // Step 1: Extract evidence from ALL documents (like Legal's extractEvidenceFromAllDocuments)
      const documentEvidence = await this.extractEvidenceFromAllDocuments(docs, question);
      console.log(`📊 Evidence extraction completed: ${documentEvidence.length} pieces of evidence from ${docs.length} documents`);
      
      if (documentEvidence.length === 0) {
        // Return structured object for no evidence case - LEGAL PATTERN
        return {
          question: question.question,
          category: question.category,
          answer: `No relevant documents found for research analysis of: ${question.question}`,
          confidence: 0,
          sources: [],
          keyFindings: [],
          gaps: ['No research documentation available'],
          recommendations: ['Obtain relevant research documents for analysis'],
          evidenceCount: 0,
          detailedEvidence: []
        };
      }
      
      // Step 2: Compile comprehensive answer (like Legal's compileComprehensiveAnswer)
      // Pass job context for per-batch progress updates - LEGAL PATTERN
      const answer = await this.compileComprehensiveAnswer(
        question, 
        documentEvidence,
        jobId,
        storageService,
        questionIndex,
        totalQuestions
      );
      
      console.log(`✅ Research analysis completed for "${question.question}"`);
      return answer;
      
    } catch (error: any) {
      console.error(`Error analyzing research question ${question.id}:`, error);
      // Return structured error object - LEGAL PATTERN
      return {
        question: question.question,
        category: question.category,
        answer: `Error analyzing: ${question.question} - ${error.message}`,
        confidence: 0,
        sources: [],
        keyFindings: [],
        gaps: ['Analysis failed'],
        recommendations: ['Retry analysis'],
        evidenceCount: 0,
        detailedEvidence: []
      };
    }
  }

  /**
   * Extract evidence from ALL documents - LEGAL PATTERN
   * Processes documents in batches with parallel OpenAI calls per document
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // Process documents in batches to match Legal speed (batch size 40)
    const batchSize = 40;
    const evidence = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing document batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (doc) => {
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      // Filter out null results and add to evidence with proper type guards
      const validEvidence = batchResults
        .filter((result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)
        .filter(docEvidence => 
          docEvidence && docEvidence.relevantContent && docEvidence.relevantContent.length > 0
        );
      evidence.push(...validEvidence);
      
      console.log(`✅ Document batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }
    
    console.log(`📋 Extracted evidence from ${evidence.length}/${documents.length} documents`);
    return evidence;
  }

  /**
   * Extract specific evidence from a single document - AI SUMMARY ONLY VERSION (LEGAL PATTERN)
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    // Use ONLY AI summary - handle BOTH string and object formats
    const aiSummary = document.aiSummary;
    if (!aiSummary) return null;
    
    let content: string;
    
    // Handle STRING summaries (most common in production)
    if (typeof aiSummary === 'string') {
      content = aiSummary;
    } 
    // Handle OBJECT summaries (structured format)
    else if (typeof aiSummary === 'object') {
      content = [
        aiSummary.executiveSummary || '',
        aiSummary.documentType ? `Document Type: ${aiSummary.documentType}` : '',
        aiSummary.criticalFindings?.length ? `Critical Findings: ${aiSummary.criticalFindings.join('; ')}` : '',
        aiSummary.keyFinancialData?.length ? `Financial Data: ${aiSummary.keyFinancialData.join('; ')}` : '',
        aiSummary.riskAssessment?.length ? `Risk Assessment: ${aiSummary.riskAssessment.join('; ')}` : '',
        aiSummary.neutralFindings?.length ? `Neutral Findings: ${aiSummary.neutralFindings.join('; ')}` : '',
        aiSummary.strategicImplications || ''
      ].filter(s => s).join('\n\n');
      
      // Fallback: if all fields are empty, stringify the entire object
      if (!content) {
        content = JSON.stringify(aiSummary, null, 2);
      }
    } else {
      // Fallback: convert to string
      content = String(aiSummary);
    }
    
    if (!content || content.trim().length === 0) return null;
    
    // Return document evidence with AI summary content (no per-document OpenAI call - batch it instead)
    return {
      documentName: document.filename || document.name,
      relevantContent: content,
      fullContent: content,
      keyFindings: [],
      confidence: 50
    };
  }

  /**
   * Compile comprehensive answer from all document evidence - EXACT LEGAL PATTERN
   * Uses token-based batching → partial answers → synthesis with caching and recovery
   */
  private async compileComprehensiveAnswer(
    question: any, 
    evidence: any[],
    jobId?: string,
    storageService?: any,
    questionIndex?: number,
    totalQuestions?: number
  ): Promise<any> {
    console.log(`🔄 BATCHED COMPILATION: Starting for "${question.question}" with ${evidence.length} documents`);
    
    if (evidence.length === 0) {
      return {
        question: question.question,
        category: question.category,
        answer: 'No relevant documents found for research analysis',
        confidence: 0,
        sources: [],
        keyFindings: [],
        gaps: ['No research documentation available'],
        recommendations: ['Obtain relevant research documents for analysis'],
        evidenceCount: 0,
        detailedEvidence: []
      };
    }

    // 🚀 SMART BATCHING: Create batches based on token count, not fixed size (LEGAL PATTERN)
    const MAX_BATCH_TOKENS = 6000;
    const batches: any[][] = [];
    let currentBatch: any[] = [];
    let currentBatchTokens = 0;
    
    for (const ev of evidence) {
      const evTokens = resilientOpenAI.countBatchTokens([ev]);
      
      if (currentBatchTokens + evTokens > MAX_BATCH_TOKENS && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [ev];
        currentBatchTokens = evTokens;
      } else {
        currentBatch.push(ev);
        currentBatchTokens += evTokens;
      }
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    console.log(`📦 Processing ${evidence.length} documents in ${batches.length} token-optimized batches`);
    
    // Step 1: Get partial answers from each batch (LEGAL PATTERN)
    const partialAnswers: any[] = [];
    const partialResultsKey = `research-partial-${question.id}`;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Processing research batch ${i + 1}/${batches.length} (${batch.length} documents)`);
      
      const batchPrompt = `You are a senior research analyst. Analyze evidence from ${batch.length} documents to answer: "${question.question}"

Evidence:
${batch.map(ev => {
  const content = ev.relevantContent || ev.fullContent || 'No content available';
  return `
DOCUMENT: ${ev.documentName}
AI SUMMARY CONTENT: ${content}`;
}).join('\n')}

CRITICAL INSTRUCTIONS:
1. Extract ALL specific details from the AI SUMMARY CONTENT above (metrics, data points, market sizes, growth rates, technology details, competitive info, IP data)
2. DO NOT add "Insufficient information" disclaimers
3. Focus on what IS documented with specific details
4. Use gaps field ONLY for missing information

Respond in JSON:
{
  "answer": "Detailed extraction with specific research data, metrics, and insights (NO disclaimers)",
  "confidence": 0-100,
  "keyFindings": ["Specific finding 1", "Specific finding 2"],
  "sources": ["doc1", "doc2"]
}`;

      try {
        const response = await resilientOpenAI.createChatCompletion({
          model: "gpt-4o",
          messages: [{ role: "user", content: batchPrompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 8000
        }, {
          maxRetries: 4,
          timeout: 120000, // 2 minutes per batch
          onRetry: (attempt, error) => {
            console.warn(`🔄 Retrying research batch ${i + 1}/${batches.length} (attempt ${attempt}): ${error.message}`);
          }
        });
        
        const batchAnswer = JSON.parse(response.choices[0].message.content || '{}');
        partialAnswers.push(batchAnswer);
        
        // 💾 PERSISTENCE: Save partial results after each batch (LEGAL PATTERN)
        if (!(global as any)[partialResultsKey]) {
          (global as any)[partialResultsKey] = [];
        }
        (global as any)[partialResultsKey].push(batchAnswer);
        
        console.log(`✅ Research Batch ${i + 1}/${batches.length} completed and saved`);
        
        // 🔄 HEARTBEAT: Update job progress after each batch - LEGAL PATTERN
        if (jobId && storageService && questionIndex !== undefined && totalQuestions !== undefined) {
          const questionProgress = questionIndex / totalQuestions;
          const batchProgress = (i + 1) / batches.length / totalQuestions;
          const totalProgress = Math.min(Math.round((questionProgress + batchProgress) * 100), 100);
          
          await storageService.updateBackgroundJob(jobId, {
            progress: totalProgress,
            currentStep: `Analyzing: ${question.category} (Batch ${i + 1}/${batches.length})`,
            processedDocuments: questionIndex
          });
        }
        
      } catch (error: any) {
        console.error(`❌ Error in research batch ${i + 1}:`, error);
        const errorAnswer = {
          answer: `Error processing batch ${i + 1}: ${error.message}`,
          confidence: 0,
          keyFindings: [],
          sources: batch.map((e: any) => e.documentName)
        };
        partialAnswers.push(errorAnswer);
        
        if (!(global as any)[partialResultsKey]) {
          (global as any)[partialResultsKey] = [];
        }
        (global as any)[partialResultsKey].push(errorAnswer);
      }
    }
    
    // Step 2: Synthesize all partial answers into final comprehensive answer (LEGAL PATTERN)
    console.log(`🔄 Synthesizing ${partialAnswers.length} research partial answers into final answer`);
    
    const synthesisPrompt = `You are a senior research analyst. Synthesize these partial analyses into ONE comprehensive answer.

QUESTION YOU ARE ANSWERING (DO NOT REPEAT THIS IN YOUR ANSWER):
"${question.question}"

QUESTION ID: ${question.id}
CATEGORY: ${question.category || 'Research'}

Partial Analyses to Synthesize:
${partialAnswers.map((pa, i) => `
BATCH ${i + 1}:
${pa.answer}
KEY FINDINGS: ${pa.keyFindings?.join('; ') || 'None'}
`).join('\n')}

CRITICAL SYNTHESIS RULES:
1. Extract ALL specific details (metrics, data points, insights) from all batches above
2. List ALL key findings with complete details
3. Provide exhaustive breakdown of research data
4. Cite specific documents and data points
5. DO NOT add "Insufficient information" disclaimers in the answer field
6. Focus on what IS documented
7. Write professional analysis (no vague disclaimers)

CRITICAL: DO NOT PREFIX YOUR ANSWER WITH THE QUESTION TEXT
❌ WRONG: "${question.question}: The analysis reveals..."
✅ CORRECT: "The analysis reveals..."

Your answer should START IMMEDIATELY with the analysis. Do NOT include the question as a prefix or header.

FORMAT REQUIREMENTS FOR "answer" FIELD:
- Start IMMEDIATELY with analysis (e.g., "The analysis reveals the following:")
- Use markdown bullets (•) for lists of evidence/findings
- Use **bold** for key terms, metrics, and important data points
- Structure with clear sections if multiple topics
- NO question prefix, NO disclaimers, NO "insufficient information" statements
- Example CORRECT format:
  "The analysis reveals the following:
  
  • **Market Size**: **$2.5B TAM** growing at **15% CAGR**
  • **Key Technology**: **Proprietary AI platform** with **3 granted patents**
  
  Key strategic insights include..."

Respond in JSON:
{
  "answer": "START IMMEDIATELY WITH ANALYSIS - NO QUESTION PREFIX (Comprehensive synthesis with ALL specific details formatted with markdown bullets and bold)",
  "confidence": 0-100,
  "keyFindings": ["All key findings combined"],
  "gaps": ["Missing information ONLY - separate from answer"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "researchAssessment": "Overall research assessment"
}`;

    try {
      // Use resilient client for final synthesis with extended timeout - LEGAL PATTERN
      const finalResponse = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: synthesisPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 16000
      }, {
        maxRetries: 5,
        timeout: 180000, // 3 minutes for synthesis
        onRetry: (attempt, error) => {
          console.warn(`🔄 Retrying research synthesis for "${question.question}" (attempt ${attempt}): ${error.message}`);
        }
      });
      
      const compiledAnswer = JSON.parse(finalResponse.choices[0].message.content || '{}');
      
      console.log(`✅ Research synthesis completed for "${question.question}"`);
      
      // 🧹 CLEANUP: Remove partial results cache after successful synthesis - LEGAL PATTERN
      if ((global as any)[partialResultsKey]) {
        delete (global as any)[partialResultsKey];
        console.log(`🧹 Cleaned up research partial results cache for ${question.id}`);
      }
      
      // Return structured object - LEGAL PATTERN
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName),
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        researchAssessment: compiledAnswer.researchAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (synthesisError: any) {
      const isTimeout = synthesisError.message?.includes('timeout');
      console.error(`❌ Research synthesis failed for "${question.question}":`, synthesisError);
      
      // 💾 RECOVERY: Try to use persisted partial results first - LEGAL PATTERN
      const persistedResults = (global as any)[partialResultsKey] || partialAnswers;
      console.warn(`📦 Using ${persistedResults.length} persisted batch results as fallback`);
      
      // Fallback: Combine partial answers directly (from cache or current session)
      const combinedAnswer = persistedResults
        .map((pa: any, i: number) => `Batch ${i + 1}: ${pa.answer}`)
        .join('\n\n');
      
      // Calculate average confidence from partial results
      const avgConfidence = persistedResults.length > 0
        ? Math.round(persistedResults.reduce((sum: number, pa: any) => sum + (pa.confidence || 0), 0) / persistedResults.length)
        : 30;
      
      // Return structured fallback object - LEGAL PATTERN
      return {
        question: question.question,
        category: question.category,
        answer: `Synthesis ${isTimeout ? 'timeout' : 'error'} - Combined ${persistedResults.length} batch results from ${evidence.length} documents:\n\n${combinedAnswer}`,
        confidence: avgConfidence,
        sources: evidence.map(e => e.documentName),
        keyFindings: persistedResults.flatMap((pa: any) => pa.keyFindings || []),
        gaps: ['Synthesis incomplete - using partial batch results'],
        recommendations: ['Review batch evidence provided', isTimeout ? 'Retry with longer timeout' : 'Manual review recommended'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  private async generateFindingsAndRecommendations(researchAnswers: Record<string, any>) {
    try {
      // Handle both structured objects and plain strings - LEGAL PATTERN
      const answersText = Object.entries(researchAnswers)
        .map(([questionId, answer]) => {
          const question = RESEARCH_QUESTIONS.find(q => q.id === questionId);
          // Handle structured answer objects
          const answerText = typeof answer === 'object' && answer.answer 
            ? answer.answer 
            : String(answer);
          return `${question?.question}: ${answerText}`;
        })
        .join('\n\n');

      const prompt = `Based on the following comprehensive research analysis, generate key findings and recommendations:

RESEARCH ANALYSIS:
${answersText}

Please provide:

FINDINGS (3-5 key insights):
- Strategic market position and competitive standing
- Technology and IP assessment
- Market opportunity and growth potential
- Key risks and challenges identified
- Data quality and validation status

RECOMMENDATIONS (3-5 actionable items):
- Strategic priorities for investment consideration
- Risk mitigation strategies
- Due diligence focus areas
- Technology development priorities
- Market positioning recommendations

Format each finding and recommendation as a clear, concise statement (1-2 sentences each).`;

      const response = await resilientOpenAI.createChatCompletion({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 8000
      }, {
        maxRetries: 3,
        timeout: 90000 // 90 seconds timeout
      });

      const content = response.choices[0]?.message?.content || '';
      
      // Parse findings and recommendations
      const findingsMatch = content.match(/FINDINGS[:\s]*([\s\S]*?)(?=RECOMMENDATIONS|$)/i);
      const recommendationsMatch = content.match(/RECOMMENDATIONS[:\s]*([\s\S]*?)$/i);
      
      const findings = findingsMatch?.[1]
        ?.split(/[-•]\s*/)
        .filter(f => f.trim().length > 10)
        .map(f => f.trim()) || [];
        
      const recommendations = recommendationsMatch?.[1]
        ?.split(/[-•]\s*/)
        .filter(r => r.trim().length > 10)
        .map(r => r.trim()) || [];

      return { findings, recommendations };
      
    } catch (error) {
      console.error('Error generating findings and recommendations:', error);
      return { 
        findings: ['Comprehensive research analysis completed with multiple insights identified'],
        recommendations: ['Review detailed research analysis for investment decision making']
      };
    }
  }

  private async completeAnalysis(dealId: number, researchAnswers: Record<string, string>, findings: string[], recommendations: string[], docsProcessed: number) {
    try {
      // Convert findings and recommendations to proper schema format
      const formattedFindings = findings.map((content, index) => ({
        id: index + 1,
        content,
        type: 'finding'
      }));

      const formattedRecommendations = recommendations.map((rec, index) => ({
        title: `Recommendation ${index + 1}`,
        description: rec,
        priority: 'medium',
        category: 'research',
        impact: 'medium'
      }));

      // Check if analysis exists - update if yes, create if no (same pattern as commercial service)
      const existingAnalysis = await this.storage.getAnalysisByDealAndAgent(dealId, 'research');
      
      if (existingAnalysis) {
        await this.storage.updateAgentAnalysis(existingAnalysis.id, {
          status: 'completed',
          progress: 100,
          findings: formattedFindings,
          recommendations: formattedRecommendations,
          research_answers: researchAnswers
        });
      } else {
        await this.storage.createAgentAnalysis({
          dealId,
          agentType: 'research',
          status: 'completed',
          progress: 100,
          findings: formattedFindings,
          recommendations: formattedRecommendations,
          research_answers: researchAnswers
        });
      }

      // Update job as completed
      await this.storage.updateBackgroundJob(this.jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Analysis completed',
        processedDocuments: docsProcessed,
        totalDocuments: docsProcessed
      });

      console.log(`✅ Research analysis saved for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error saving research analysis:`, error);
      throw error;
    }
  }

  private async updateJobProgress(progress: number, step: string) {
    try {
      await this.storage.updateBackgroundJob(this.jobId, {
        progress: Math.round(progress),
        currentStep: step
      });
      console.log(`🔬 Research Analysis Progress: ${Math.round(progress)}% - ${step}`);
    } catch (error) {
      console.error('Error updating job progress:', error);
    }
  }

  // Question rerun progress tracking (in-memory)
  private questionRerunProgress: Map<string, number> = new Map();

  async isQuestionRunning(dealId: number, questionId: string): Promise<boolean> {
    const key = `${dealId}-${questionId}`;
    return this.questionRerunProgress.has(key) && this.questionRerunProgress.get(key)! < 100;
  }

  async updateQuestionRerunProgress(dealId: number, questionId: string, progress: number): Promise<void> {
    const key = `${dealId}-${questionId}`;
    this.questionRerunProgress.set(key, progress);
    
    const jobId = `research-question-rerun-${dealId}-${questionId}`;
    
    if (progress === 0) {
      await storage.createBackgroundJob({
        jobId, 
        jobType: 'research_question_rerun', 
        dealId, 
        agentType: 'Research', 
        status: 'processing', 
        progress, 
        currentStep: 'Starting question rerun...'
      });
    } else if (progress >= 100) {
      await storage.updateBackgroundJob(jobId, { progress, currentStep: 'Completed' });
      setTimeout(() => this.questionRerunProgress.delete(key), 5000);
    } else {
      await storage.updateBackgroundJob(jobId, { progress, currentStep: 'Processing' });
    }
  }

  async getAllQuestionProgress(dealId: number): Promise<Record<string, number>> {
    const { backgroundJobs } = await import('../shared/schema');
    const { and, eq } = await import('drizzle-orm');
    
    const result: Record<string, number> = {};
    
    // CRITICAL FIX: Check Force Rerun All master job to get CURRENT question ID
    const masterJobId = `force-rerun-all-research-${dealId}`;
    const masterJob = await storage.getBackgroundJobById(masterJobId);
    
    let currentQuestionFromMaster: string | null = null;
    
    if (masterJob && masterJob.status === 'processing' && masterJob.progress !== null && masterJob.progress < 100) {
      // Extract current question ID from currentStep: "Processing question X/Y: question_id"
      if (masterJob.currentStep) {
        const match = masterJob.currentStep.match(/:\s*([\w_]+)$/);
        if (match) {
          currentQuestionFromMaster = match[1];
        }
      }
    }
    
    // Check individual question rerun jobs
    const jobs = await db.query.backgroundJobs.findMany({
      where: and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.jobType, 'research_question_rerun')
      )
    });
    
    for (const job of jobs) {
      // Only include jobs that are actively processing (not failed or completed)
      if (job.runId && job.status === 'processing' && job.progress !== null && job.progress < 100) {
        result[job.runId] = Math.max(10, job.progress); // Minimum 10% to show activity
        console.log(`📊 [Research Progress] Individual job ${job.runId} at ${job.progress}%`);
      }
    }
    
    // CRITICAL: If Force Rerun All is active but no individual job found for current question,
    // add it with a minimum progress to show activity
    if (currentQuestionFromMaster && !result[currentQuestionFromMaster]) {
      // Check if individual job exists but with pending status
      const questionJobId = `research-question-rerun-${dealId}-${currentQuestionFromMaster}`;
      const questionJob = await storage.getBackgroundJobById(questionJobId);
      
      if (questionJob && questionJob.progress !== null) {
        result[currentQuestionFromMaster] = Math.max(10, questionJob.progress);
        console.log(`📊 [Research Progress] Force Rerun All active: ${currentQuestionFromMaster} at ${result[currentQuestionFromMaster]}% (from individual job)`);
      } else {
        // No individual job yet, show minimum progress
        result[currentQuestionFromMaster] = 10;
        console.log(`📊 [Research Progress] Force Rerun All active: ${currentQuestionFromMaster} at 10% (starting)`);
      }
    }
    
    return result;
  }

  async getQuestionRerunProgress(dealId: number, questionId: string): Promise<number> {
    const key = `${dealId}-${questionId}`;
    return this.questionRerunProgress.get(key) || 0;
  }

  async rerunSingleQuestion(dealId: number, questionId: string): Promise<void> {
    const jobId = `research-question-rerun-${dealId}-${questionId}`;
    console.log(`🔄 [Research Rerun] Starting question ${questionId} for deal ${dealId}`);
    
    try {
      // Check if job already initialized by route (atomic registration pattern) - LEGAL PATTERN
      const existingJob = await storage.getBackgroundJobById(jobId);
      const alreadyInitialized = existingJob != null;
      
      // Only check for duplicates if not already initialized by the route
      if (!alreadyInitialized && await this.isQuestionRunning(dealId, questionId)) {
        throw new Error(`Question ${questionId} is already being rerun`);
      }
      
      // Initialize progress only if not already set by route - LEGAL PATTERN
      if (!alreadyInitialized) {
        await storage.createBackgroundJob({
          jobId,
          jobType: 'research_question_rerun',
          dealId,
          status: 'pending',
          progress: 0,
          runId: questionId,
          currentStep: `Initializing question rerun: ${questionId}`
        });
        console.log(`✅ [Research Rerun] Registered new job for question ${questionId}`);
      }
      
      // 🔥 CRITICAL FIX: Use getAgentAnalysis which has proper case normalization - LEGAL PATTERN
      const analysis = await storage.getAgentAnalysis(dealId, 'Research');
      if (!analysis) throw new Error('No research analysis found');
      console.log(`📊 [Research Rerun] Found existing analysis ID ${analysis.id} for deal ${dealId}`);
      
      const documents = await storage.getDocumentsByDealId(dealId);
      const researchDocs = documents.filter(doc => 
        doc.assignedAgents?.some(a => a.toLowerCase() === 'research')
      );
      console.log(`📄 [Research Rerun] Found ${researchDocs.length} documents for question ${questionId}`);
      
      if (researchDocs.length === 0) {
        throw new Error('No documents available for research analysis');
      }
      
      const question = RESEARCH_QUESTIONS.find(q => q.id === questionId);
      if (!question) throw new Error(`Question ${questionId} not found`);
      
      await this.updateQuestionRerunProgress(dealId, questionId, 10);
      
      // 🔥 CRITICAL FIX: Pass all parameters to analyzeQuestion for per-batch progress tracking - LEGAL PATTERN
      const questionIndex = RESEARCH_QUESTIONS.findIndex(q => q.id === questionId);
      const answer = await this.analyzeQuestion(
        question, 
        researchDocs,
        jobId,           // Pass jobId for progress tracking
        storage,         // Pass storage service for job updates
        questionIndex,   // Current question index
        RESEARCH_QUESTIONS.length  // Total questions count
      );
      
      await this.updateQuestionRerunProgress(dealId, questionId, 90);
      
      // 🔥 CRITICAL FIX: Update analysis with structured answer using proper field name - LEGAL PATTERN
      // Get existing research_answers and merge with new answer
      const existingAnswers = analysis.research_answers || analysis.researchAnswers || {};
      const updatedAnswers = {
        ...existingAnswers,
        [questionId]: answer
      };
      
      console.log(`💾 [Research Rerun] Saving answer for ${questionId}, total answers: ${Object.keys(updatedAnswers).length}`);
      
      // Update using both possible field names for compatibility
      await storage.updateAgentAnalysis(analysis.id, {
        research_answers: updatedAnswers,
        status: 'completed',
        progress: 100
      });
      
      await this.updateQuestionRerunProgress(dealId, questionId, 100);
      
      // Mark job as completed - LEGAL PATTERN
      await storage.updateBackgroundJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: `Completed: ${question.question}`
      });
      
      console.log(`✅ [Research Rerun] Completed question ${questionId} for deal ${dealId}. Answer saved to database.`);
      
      return answer;
      
    } catch (error: any) {
      console.error(`❌ [Research Rerun] Error for question ${questionId}:`, error);
      
      // Mark job as failed in database - LEGAL PATTERN
      await storage.updateBackgroundJob(jobId, {
        status: 'failed',
        progress: 0,
        currentStep: `Failed: ${error.message}`
      });

      console.log(`❌ [Research Rerun] Marked job ${jobId} as failed`);
      throw error;
    }
  }
}