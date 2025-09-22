import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const RESEARCH_QUESTIONS = [
  // Competitive Intelligence
  { 
    id: 'research_1', 
    question: 'What competitive threats exist and how significant are they?', 
    category: 'Competitive Intelligence',
    analysisPrompt: 'Identify competitive threats, competitor analysis, market positioning, and competitive risk assessment.',
    keywords: ['competitive threat', 'competitor', 'competition', 'competitive landscape', 'market share', 'competitive advantage', 'threat assessment', 'competitive risk']
  },
  { 
    id: 'research_2', 
    question: 'What is the patent landscape and IP positioning?', 
    category: 'Competitive Intelligence',
    analysisPrompt: 'Analyze patent landscape, IP positioning, intellectual property strategy, and freedom to operate assessments.',
    keywords: ['patent landscape', 'ip position', 'intellectual property', 'patent portfolio', 'patent protection', 'ip strategy', 'patent analysis', 'freedom to operate']
  },
  { 
    id: 'research_3', 
    question: 'How defensible is the technology moat?', 
    category: 'Competitive Intelligence',
    analysisPrompt: 'Assess technology moat defensibility, competitive barriers, technological advantages, and proprietary differentiation.',
    keywords: ['technology moat', 'defensibility', 'competitive moat', 'barrier to entry', 'technological advantage', 'proprietary technology', 'technical differentiation']
  },
  // Market Analysis
  { 
    id: 'research_4', 
    question: 'What is the Total Addressable Market (TAM) size and growth?', 
    category: 'Market Analysis',
    analysisPrompt: 'Identify Total Addressable Market size, growth projections, market opportunity, and expansion potential.',
    keywords: ['total addressable market', 'tam', 'market size', 'market growth', 'market opportunity', 'addressable market', 'market potential', 'market expansion']
  },
  { 
    id: 'research_5', 
    question: 'What are the key market trends and drivers?', 
    category: 'Market Analysis',
    analysisPrompt: 'Analyze market trends, growth drivers, industry dynamics, and market evolution factors.',
    keywords: ['market trends', 'market drivers', 'industry trends', 'growth drivers', 'market dynamics', 'trend analysis', 'market forces', 'industry evolution']
  },
  { 
    id: 'research_6', 
    question: 'What is the regulatory environment and compliance requirements?', 
    category: 'Market Analysis',
    analysisPrompt: 'Examine regulatory environment, compliance requirements, regulatory frameworks, and industry standards.',
    keywords: ['regulatory environment', 'compliance requirements', 'regulation', 'regulatory risk', 'compliance', 'regulatory framework', 'industry standards']
  },
  // Technology Assessment
  { 
    id: 'research_7', 
    question: 'What is the technology maturity and scalability potential?', 
    category: 'Technology Assessment',
    analysisPrompt: 'Assess technology maturity, scalability potential, technological readiness, and technical risk factors.',
    keywords: ['technology maturity', 'scalability', 'technological readiness', 'scale potential', 'technical scalability', 'platform scalability', 'technology risk']
  },
  { 
    id: 'research_8', 
    question: 'What are the key technology dependencies and risks?', 
    category: 'Technology Assessment',
    analysisPrompt: 'Identify technology dependencies, technical risks, platform dependencies, and technology stack vulnerabilities.',
    keywords: ['technology dependencies', 'technology risk', 'technical dependencies', 'platform dependencies', 'technology stack', 'technical risk assessment']
  },
  { 
    id: 'research_9', 
    question: 'What data quality and validation has been performed?', 
    category: 'Technology Assessment',
    analysisPrompt: 'Review data quality processes, validation procedures, data integrity measures, and governance frameworks.',
    keywords: ['data quality', 'data validation', 'data integrity', 'data accuracy', 'data governance', 'data verification', 'quality assurance', 'data standards']
  },
  // Strategic Analysis
  { 
    id: 'research_10', 
    question: 'What are the potential exit strategies and acquirer landscape?', 
    category: 'Strategic Analysis',
    analysisPrompt: 'Analyze potential exit strategies, acquirer landscape, strategic buyers, and M&A opportunities.',
    keywords: ['exit strategy', 'acquirer', 'acquisition', 'strategic buyer', 'exit opportunity', 'merger', 'acquisition target', 'strategic partnership']
  },
  { 
    id: 'research_11', 
    question: 'What international expansion opportunities exist?', 
    category: 'Strategic Analysis',
    analysisPrompt: 'Evaluate international expansion opportunities, global market potential, geographic strategies, and market entry approaches.',
    keywords: ['international expansion', 'global expansion', 'international market', 'geographic expansion', 'global opportunity', 'international strategy', 'market expansion']
  },
  { 
    id: 'research_12', 
    question: 'What are the ESG considerations and sustainability factors?', 
    category: 'Strategic Analysis',
    analysisPrompt: 'Assess ESG factors, sustainability initiatives, environmental impact, social responsibility, and governance practices.',
    keywords: ['esg', 'sustainability', 'environmental impact', 'social responsibility', 'governance', 'sustainable business', 'environmental considerations', 'social impact']
  },
  { 
    id: 'research_13', 
    question: 'What customer validation and market traction evidence exists?', 
    category: 'Strategic Analysis',
    analysisPrompt: 'Review customer validation evidence, market traction metrics, product-market fit indicators, and adoption signals.',
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
      
      // Process each research question - EXACT CLINICAL APPROACH
      const researchAnswers: Record<string, any> = {};
      const findings: string[] = [];
      const recommendations: string[] = [];
      
      for (let i = 0; i < RESEARCH_QUESTIONS.length; i++) {
        const question = RESEARCH_QUESTIONS[i];
        const progress = 20 + (i / RESEARCH_QUESTIONS.length) * 60;
        
        await this.updateJobProgress(progress, `Analyzing: ${question.question}`);
        
        try {
          // Extract evidence from documents - EXACT CLINICAL APPROACH
          const evidence = await this.extractEvidence(docs, question);
          
          if (evidence.length > 0) {
            // Compile comprehensive answer - EXACT CLINICAL APPROACH  
            const answer = await this.compileComprehensiveAnswer(question, evidence);
            researchAnswers[question.id] = answer;
            console.log(`✅ Research question ${question.id} answered with evidence from ${evidence.length} documents`);
          } else {
            console.log(`⚠️ No evidence found for research question: ${question.question}`);
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

  /**
   * Extract evidence from multiple documents for a question - EXACT CLINICAL APPROACH
   */
  private async extractEvidence(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // Process documents in batches to avoid overwhelming the system - EXACT Clinical approach
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
      
      // Filter out null results and add to evidence - EXACT Clinical approach
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
   * Extract specific evidence from a single document - EXACT CLINICAL APPROACH
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `You are an expert research analyst conducting comprehensive investment analysis. Your task is to find ANY research, market, competitive, strategic, or technological information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 100000)} ${content.length > 100000 ? '\n[Document truncated - processing first 100k characters for comprehensive analysis...]' : ''}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Look for DIRECT research terms: market analysis, competitive intelligence, technology assessment, strategic planning
- Look for INDIRECT research information: business intelligence, market data, industry reports, strategic documents
- Consider business documents that mention research findings, market insights, competitive analysis
- Even general business context often has research implications for investment due diligence
- For investment companies, most business documents contain research information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "researchContext": "How this document relates to research/strategic aspects of the business"
}

Be thorough in finding relevance - most business documents have research implications for investment analysis.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2500 // Increased for full document comprehensive extraction
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
        fullContent: content.substring(0, 2000) // Keep larger sample for reference
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
   * Compile comprehensive answer based on all evidence - EXACT CLINICAL APPROACH
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📊 Using evidence from ${evidence.length} documents`);
    
    // Prepare evidence summary for AI analysis
    const evidenceSummary = evidence.map(doc => {
      return `Document: ${doc.documentName}
Key Findings: ${doc.keyFindings.join('; ')}
Content: ${doc.relevantContent.join(' | ')}
Summary: ${doc.documentSummary}`;
    }).join('\n\n');
    
    const prompt = `You are an expert research analyst providing comprehensive investment analysis. Based on the evidence extracted from documents, provide a detailed answer to the research question.

QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS TASK: ${question.analysisPrompt}

EVIDENCE FROM DOCUMENTS:
${evidenceSummary}

Please provide a comprehensive analysis including:
1. Direct answer to the question based on evidence
2. Key insights and findings from the documents
3. Data points, metrics, or specific evidence found
4. Risk factors or concerns identified
5. Confidence level in your analysis (0-100)
6. Specific recommendations for investment consideration

Format your response to be detailed yet concise, focusing on actionable insights for investment decision-making.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000 // Increased for comprehensive research analysis synthesis
      });
      
      const answer = response.choices[0]?.message?.content || 'Unable to compile comprehensive answer';
      
      return {
        question: question.question,
        answer: answer,
        confidence: this.calculateConfidence(evidence),
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: evidence.flatMap(e => e.keyFindings).slice(0, 10),
        evidenceSummary: `Analysis based on ${evidence.length} documents with ${evidence.reduce((acc, e) => acc + e.relevantContent.length, 0)} pieces of evidence`,
        researchAssessment: this.generateResearchAssessment(evidence, answer),
        recommendations: this.extractRecommendations(answer)
      };
      
    } catch (error) {
      console.error(`Error compiling comprehensive answer:`, error);
      return {
        question: question.question,
        answer: 'Error occurred during analysis compilation',
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        keyFindings: [],
        evidenceSummary: 'Analysis compilation failed',
        researchAssessment: 'Unable to generate research assessment',
        recommendations: []
      };
    }
  }

  private calculateConfidence(evidence: any[]): number {
    if (evidence.length === 0) return 0;
    const avgConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    const documentBonus = Math.min(evidence.length * 5, 20); // Up to 20% bonus for multiple documents
    return Math.min(Math.round(avgConfidence + documentBonus), 100);
  }

  private generateResearchAssessment(evidence: any[], answer: string): string {
    const docCount = evidence.length;
    const totalFindings = evidence.reduce((acc, e) => acc + e.keyFindings.length, 0);
    
    return `Research analysis based on ${docCount} documents with ${totalFindings} key findings. ${
      docCount >= 3 ? 'Strong' : docCount >= 2 ? 'Moderate' : 'Limited'
    } evidence base supports research conclusions.`;
  }

  private extractRecommendations(answer: string): string[] {
    // Simple extraction of recommendation-like content
    const recommendations = [];
    const lines = answer.split(/[.\n]/).filter(line => 
      line.toLowerCase().includes('recommend') || 
      line.toLowerCase().includes('should') ||
      line.toLowerCase().includes('consider') ||
      line.toLowerCase().includes('suggest')
    );
    
    recommendations.push(...lines.slice(0, 3).map(line => line.trim()));
    
    if (recommendations.length === 0) {
      recommendations.push('Review detailed research analysis for investment decision making');
    }
    
    return recommendations;
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

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000 // Increased for comprehensive research analysis
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
      const insertData = {
        dealId,
        agentType: 'research',
        status: 'completed' as const,
        progress: 100,
        findings: findings.length > 0 ? findings.map((f, i) => ({ id: i, content: f, type: 'positive' })) : undefined,
        recommendations: recommendations.length > 0 ? recommendations.map((r, i) => ({ 
          title: `Recommendation ${i + 1}`, 
          description: r, 
          priority: 'medium', 
          category: 'research', 
          impact: 'medium' 
        })) : undefined,
        research_answers: Object.keys(researchAnswers).length > 0 ? researchAnswers : undefined
      };

      await db.insert(agentAnalyses).values(insertData);

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