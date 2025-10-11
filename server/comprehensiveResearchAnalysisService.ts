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
      
      // Process each research question
      const researchAnswers: Record<string, string> = {};
      const findings: string[] = [];
      const recommendations: string[] = [];
      
      for (let i = 0; i < RESEARCH_QUESTIONS.length; i++) {
        const question = RESEARCH_QUESTIONS[i];
        const progress = 20 + (i / RESEARCH_QUESTIONS.length) * 60;
        
        await this.updateJobProgress(progress, `Analyzing: ${question.question}`);
        
        try {
          const answer = await this.analyzeQuestion(question, docs);
          if (answer && answer.trim()) {
            researchAnswers[question.id] = answer;
            console.log(`✅ Research question ${question.id} answered successfully`);
          }
        } catch (error) {
          console.error(`❌ Error analyzing research question ${question.id}:`, error);
        }
        
        // Small delay to prevent API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
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

  private async analyzeQuestion(question: any, docs: any[]) {
    try {
      console.log(`🔄 BATCHED RESEARCH: Starting for "${question.question}"`);
      
      // Find relevant documents based on keywords (AI SUMMARY ONLY like Legal/Clinical)
      const relevantDocs = docs.filter(doc => {
        // Use ONLY AI summary - handle BOTH string and object formats
        if (!doc.aiSummary) return false;
        
        let summaryText = '';
        if (typeof doc.aiSummary === 'string') {
          summaryText = doc.aiSummary.toLowerCase();
        } else if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
          summaryText = doc.aiSummary.executiveSummary.toLowerCase();
        }
        
        return question.keywords.some((keyword: string) => 
          summaryText.includes(keyword.toLowerCase())
        );
      });
      
      if (relevantDocs.length === 0) {
        return `No relevant documents found for analysis of: ${question.question}`;
      }
      
      // Prepare evidence from ALL relevant documents (AI SUMMARY ONLY, no top 5 limit)
      const evidence = relevantDocs.map(doc => {
        // Use ONLY AI summary - handle BOTH string and object formats
        let summaryText = 'No summary available';
        let fullContent = '';
        
        if (typeof doc.aiSummary === 'string') {
          summaryText = doc.aiSummary;
          fullContent = doc.aiSummary;
        } else if (doc.aiSummary && typeof doc.aiSummary === 'object') {
          summaryText = doc.aiSummary.executiveSummary || 'No summary available';
          // Extract comprehensive content from structured AI summary
          fullContent = [
            doc.aiSummary.executiveSummary || '',
            doc.aiSummary.documentType ? `Document Type: ${doc.aiSummary.documentType}` : '',
            doc.aiSummary.criticalFindings?.length ? `Critical Findings: ${doc.aiSummary.criticalFindings.join('; ')}` : '',
            doc.aiSummary.keyFinancialData?.length ? `Financial Data: ${doc.aiSummary.keyFinancialData.join('; ')}` : '',
            doc.aiSummary.riskAssessment?.length ? `Risk Assessment: ${doc.aiSummary.riskAssessment.join('; ')}` : ''
          ].filter(s => s).join('\n\n');
        }
        
        return {
          documentName: doc.filename,
          relevantContent: fullContent || summaryText,
          keyFindings: [summaryText]
        };
      }); // NO LIMIT - process ALL documents
      
      console.log(`📦 Processing ${evidence.length} documents for research question`);
      
      // 🚀 SMART BATCHING: Create batches based on token count
      const MAX_BATCH_TOKENS = 6000;
      const batches = [];
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
      
      // Step 1: Get partial answers from each batch
      const partialAnswers = [];
      const partialResultsKey = `research-partial-${question.id}`;
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📦 Processing research batch ${i + 1}/${batches.length} (${batch.length} documents)`);
        
        const batchPrompt = `You are a research analyst. Analyze evidence from ${batch.length} documents to answer: "${question.question}"

Evidence:
${batch.map(ev => `
DOCUMENT: ${ev.documentName}
CONTENT: ${ev.relevantContent}
`).join('\n')}

Extract ALL specific research data (metrics, findings, insights). Respond in JSON:
{
  "answer": "Detailed extraction with specific research findings and data",
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
          
          // 💾 PERSISTENCE: Save partial results
          if (!global[partialResultsKey]) {
            global[partialResultsKey] = [];
          }
          global[partialResultsKey].push(batchAnswer);
          
          console.log(`✅ Research Batch ${i + 1}/${batches.length} completed and saved`);
        } catch (error: any) {
          console.error(`❌ Error in research batch ${i + 1}:`, error);
          const errorAnswer = {
            answer: `Error processing batch ${i + 1}: ${error.message}`,
            confidence: 0,
            keyFindings: [],
            sources: batch.map(e => e.documentName)
          };
          partialAnswers.push(errorAnswer);
          
          if (!global[partialResultsKey]) {
            global[partialResultsKey] = [];
          }
          global[partialResultsKey].push(errorAnswer);
        }
      }
      
      // Step 2: Synthesize into final answer
      console.log(`🔄 Synthesizing ${partialAnswers.length} research partial answers`);
      
      const synthesisPrompt = `You are a research analyst. Synthesize these partial analyses into ONE comprehensive answer for: "${question.question}"

Partial Analyses:
${partialAnswers.map((pa, i) => `
BATCH ${i + 1}:
${pa.answer}
KEY FINDINGS: ${pa.keyFindings?.join('; ') || 'None'}
`).join('\n')}

CRITICAL: Create ONE comprehensive answer that:
1. Extracts ALL specific details (metrics, insights, data points) from all batches
2. Provides exhaustive research findings and analysis
3. Cites specific documents and data points

FORMAT REQUIREMENTS:
- Use markdown bullets (•) for lists of evidence/findings
- Use **bold** for key terms, metrics, and important data points
- Structure with clear sections if multiple topics
- Example: "• **Market Size**: **$2.5B TAM** growing at **15% CAGR**, with **key competitor XYZ** holding **25% market share**"

Respond with a comprehensive analysis (200-400 words) with markdown bullets and bold for key metrics.`;

      try {
        const response = await resilientOpenAI.createChatCompletion({
          model: "gpt-4o",
          messages: [{ role: "user", content: synthesisPrompt }],
          temperature: 0.3,
          max_tokens: 16000
        }, {
          maxRetries: 5,
          timeout: 180000, // 3 minutes for synthesis
          onRetry: (attempt, error) => {
            console.warn(`🔄 Retrying research synthesis for "${question.question}" (attempt ${attempt}): ${error.message}`);
          }
        });

        const finalAnswer = response.choices[0]?.message?.content || 'Analysis could not be completed';
        
        console.log(`✅ Research synthesis completed for "${question.question}"`);
        
        // 🧹 CLEANUP: Remove partial results cache
        if (global[partialResultsKey]) {
          delete global[partialResultsKey];
          console.log(`🧹 Cleaned up research partial results cache for ${question.id}`);
        }
        
        return finalAnswer;
        
      } catch (synthesisError: any) {
        console.error(`❌ Research synthesis failed for "${question.question}":`, synthesisError);
        
        // 🔄 FALLBACK: Recover from partial results cache
        const cachedPartials = global[partialResultsKey];
        if (cachedPartials && cachedPartials.length > 0) {
          console.log(`📦 Research synthesis failed, recovering from ${cachedPartials.length} cached results`);
          
          const combinedAnswer = cachedPartials
            .map((pa: any) => pa.answer || '')
            .filter((a: string) => a.trim().length > 0)
            .join('\n\n');
          
          return combinedAnswer || 'Partial research analysis recovered from cached results';
        }
        
        return `Error analyzing: ${question.question}`;
      }
      
    } catch (error) {
      console.error(`Error analyzing research question ${question.id}:`, error);
      return `Error analyzing: ${question.question}`;
    }
  }

  private async generateFindingsAndRecommendations(researchAnswers: Record<string, string>) {
    try {
      const answersText = Object.entries(researchAnswers)
        .map(([questionId, answer]) => {
          const question = RESEARCH_QUESTIONS.find(q => q.id === questionId);
          return `${question?.question}: ${answer}`;
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
      // Delete any existing research analysis for this deal
      await db.delete(agentAnalyses)
        .where(and(
          eq(agentAnalyses.dealId, dealId),
          eq(agentAnalyses.agentType, 'research')
        ));

      // Save the new analysis - ONLY VALID SCHEMA FIELDS
      await db.insert(agentAnalyses).values({
        dealId,
        agentType: 'research',
        status: 'completed',
        progress: 100,
        findings: JSON.stringify(findings),
        recommendations: JSON.stringify(recommendations),
        research_answers: researchAnswers
      });

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
}