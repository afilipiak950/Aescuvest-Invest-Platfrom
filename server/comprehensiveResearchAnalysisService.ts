import { storage } from './storage';
import { db } from './db';
import { documents, agentAnalyses } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { ENTERPRISE_AGENT_PROMPTS, ENTERPRISE_PROMPT_FRAMEWORK } from './utils/enterprisePrompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const STRATEGIC_INTELLIGENCE_QUESTIONS = [
  // Technology Readiness Assessment (TRL Framework)
  { 
    id: 'research_1_trl', 
    question: 'What is the Technology Readiness Level (TRL) and development timeline?', 
    category: 'Technology Assessment',
    analysisPrompt: 'Rate technology readiness level (TRL 1-9) with milestone timeline, assess technical risk and development probability, quantify competitive technical advantages with sustainability, calculate time-to-market with scenario analysis.',
    keywords: ['technology readiness', 'trl level', 'development timeline', 'technical milestones', 'technology maturity', 'development risk', 'time to market', 'technical feasibility', 'prototype', 'proof of concept', 'scale up', 'demonstration'],
    trlMapping: true
  },
  { 
    id: 'research_2_trl', 
    question: 'What are the key technology dependencies and scalability risks?', 
    category: 'Technology Assessment',
    analysisPrompt: 'Identify technology dependencies, technical risks, platform dependencies, and technology stack vulnerabilities with quantified impact assessment.',
    keywords: ['technology dependencies', 'technical risk', 'scalability', 'platform dependencies', 'technology stack', 'technical debt', 'infrastructure requirements', 'scaling bottlenecks'],
    trlMapping: true
  },
  
  // Market Timing Analysis (Adoption Curves)
  { 
    id: 'research_3_timing', 
    question: 'What is the market adoption stage and timing opportunity?', 
    category: 'Market Timing',
    analysisPrompt: 'Analyze market adoption patterns and timing, assess competitive response probability and timeline, identify market disruption risks and opportunities with adoption curve analysis.',
    keywords: ['market adoption', 'adoption curve', 'market timing', 'early adopters', 'mainstream market', 'market maturity', 'adoption rate', 'diffusion', 'market readiness', 'timing window'],
    adoptionCurveAnalysis: true
  },
  { 
    id: 'research_4_timing', 
    question: 'How does competitive landscape timing affect market opportunity?', 
    category: 'Market Timing',
    analysisPrompt: 'Assess competitive timing, first-mover advantages, market entry windows, and competitive response scenarios with quantified probability assessment.',
    keywords: ['competitive timing', 'first mover advantage', 'competitive response', 'market entry', 'competitive window', 'market disruption', 'timing advantage'],
    adoptionCurveAnalysis: true
  },

  // Innovation Pipeline Evaluation (R&D Productivity)
  { 
    id: 'research_5_innovation', 
    question: 'What is the R&D productivity and innovation pipeline strength?', 
    category: 'Innovation Pipeline',
    analysisPrompt: 'Evaluate R&D productivity with spend-to-output ratios, assess innovation pipeline depth and commercial potential, calculate patent filing velocity and quality metrics.',
    keywords: ['r&d productivity', 'innovation pipeline', 'research efficiency', 'development spend', 'innovation output', 'research metrics', 'patent velocity', 'innovation roi', 'research pipeline'],
    innovationMetrics: true
  },
  { 
    id: 'research_6_innovation', 
    question: 'What breakthrough potential and innovation edge exists?', 
    category: 'Innovation Pipeline',
    analysisPrompt: 'Assess breakthrough innovation potential, competitive innovation advantages, and sustained innovation capability with quantified metrics.',
    keywords: ['breakthrough potential', 'innovation edge', 'disruptive innovation', 'innovation advantage', 'research breakthrough', 'innovation leadership', 'technology breakthrough'],
    innovationMetrics: true
  },

  // Strategic Intelligence Scoring
  { 
    id: 'research_7_strategic', 
    question: 'What is the strategic partnership value and ecosystem leverage?', 
    category: 'Strategic Position',
    analysisPrompt: 'Quantify strategic partnership value and synergies, assess ecosystem leverage and platform effects, evaluate strategic positioning strength.',
    keywords: ['strategic partnerships', 'ecosystem leverage', 'platform effects', 'partnership value', 'strategic alliances', 'ecosystem position', 'network effects', 'strategic synergies'],
    strategicScoring: true
  },
  { 
    id: 'research_8_strategic', 
    question: 'What competitive intelligence and market disruption risks exist?', 
    category: 'Strategic Position', 
    analysisPrompt: 'Conduct competitive intelligence analysis, assess market disruption threats, evaluate defensive positioning and strategic moat sustainability.',
    keywords: ['competitive intelligence', 'market disruption', 'competitive threats', 'strategic moat', 'competitive positioning', 'market defense', 'disruption risk', 'competitive dynamics'],
    strategicScoring: true
  },

  // Comprehensive Strategic Analysis
  { 
    id: 'research_9_comprehensive', 
    question: 'What is the Total Addressable Market (TAM) and market opportunity timing?', 
    category: 'Market Intelligence',
    analysisPrompt: 'Calculate TAM/SAM/SOM with market timing analysis, assess market opportunity windows, and quantify market capture potential with timeline projections.',
    keywords: ['total addressable market', 'tam', 'sam', 'som', 'market size', 'market opportunity', 'market capture', 'market potential', 'addressable market'],
    comprehensiveAnalysis: true
  },
  { 
    id: 'research_10_comprehensive', 
    question: 'What customer validation and market traction evidence supports strategic positioning?', 
    category: 'Market Intelligence',
    analysisPrompt: 'Review customer validation evidence, market traction metrics, product-market fit indicators, and strategic positioning validation with quantified metrics.',
    keywords: ['customer validation', 'market traction', 'product market fit', 'market adoption', 'customer feedback', 'user engagement', 'revenue traction', 'growth metrics', 'validation metrics'],
    comprehensiveAnalysis: true
  },

  // Risk and Regulatory Intelligence
  { 
    id: 'research_11_risk', 
    question: 'What regulatory environment and compliance timeline affects market entry?', 
    category: 'Risk Assessment',
    analysisPrompt: 'Examine regulatory environment, compliance timeline, regulatory frameworks, and strategic risk factors with quantified impact assessment.',
    keywords: ['regulatory environment', 'compliance timeline', 'regulatory risk', 'regulatory framework', 'compliance requirements', 'regulatory approval', 'market access'],
    riskAssessment: true
  },
  { 
    id: 'research_12_risk', 
    question: 'What ESG and sustainability factors impact strategic positioning?', 
    category: 'Risk Assessment',
    analysisPrompt: 'Assess ESG strategic impact, sustainability market drivers, environmental compliance risks, and stakeholder expectations with strategic implications.',
    keywords: ['esg impact', 'sustainability strategy', 'environmental compliance', 'social responsibility', 'governance risk', 'stakeholder expectations', 'sustainability market'],
    riskAssessment: true
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
        const emptyScores = {
          technologyReadiness: { trlLevel: 0, developmentRisk: 0, timeToMarket: 0, overallScore: 0 },
          marketTiming: { adoptionStage: '', competitiveWindow: 0, marketReadiness: 0, overallScore: 0 },
          innovationValue: { rdProductivity: 0, pipelineStrength: 0, breakthroughPotential: 0, overallScore: 0 },
          strategicPosition: { partnershipValue: 0, ecosystemLeverage: 0, competitiveIntelligence: 0, overallScore: 0 }
        };
        await this.completeStrategicAnalysis(dealId, {}, [], [], 0, emptyScores);
        return;
      }
      
      await this.updateJobProgress(20, 'Processing documents');
      
      // Process each strategic intelligence question with enterprise framework
      const strategicIntelligence: Record<string, any> = {};
      const findings: string[] = [];
      const recommendations: string[] = [];
      
      // Initialize strategic scoring components
      const technologyReadiness = { trlLevel: 0, developmentRisk: 0, timeToMarket: 0 };
      const marketTiming = { adoptionStage: '', competitiveWindow: 0, marketReadiness: 0 };
      const innovationValue = { rdProductivity: 0, pipelineStrength: 0, breakthroughPotential: 0 };
      const strategicPosition = { partnershipValue: 0, ecosystemLeverage: 0, competitiveIntelligence: 0 };
      
      for (let i = 0; i < STRATEGIC_INTELLIGENCE_QUESTIONS.length; i++) {
        const question = STRATEGIC_INTELLIGENCE_QUESTIONS[i];
        const progress = 20 + (i / STRATEGIC_INTELLIGENCE_QUESTIONS.length) * 60;
        
        await this.updateJobProgress(progress, `Analyzing: ${question.question}`);
        
        try {
          // Extract evidence from documents using enterprise framework
          const evidence = await this.extractStrategicEvidence(docs, question);
          
          if (evidence.length > 0) {
            // Compile strategic intelligence answer with enterprise analysis
            const answer = await this.compileStrategicIntelligenceAnswer(question, evidence);
            strategicIntelligence[question.id] = answer;
            
            // Update strategic scoring components based on question type
            this.updateStrategicScoring(question, answer, technologyReadiness, marketTiming, innovationValue, strategicPosition);
            
            console.log(`✅ Strategic intelligence question ${question.id} analyzed with evidence from ${evidence.length} documents`);
          } else {
            console.log(`⚠️ No strategic evidence found for question: ${question.question}`);
          }
        } catch (error) {
          console.error(`❌ Error analyzing strategic intelligence question ${question.id}:`, error);
        }
        
        // Small delay to prevent API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await this.updateJobProgress(90, 'Generating strategic intelligence findings');
      
      // Generate strategic intelligence findings and recommendations
      if (Object.keys(strategicIntelligence).length > 0) {
        const analysisResult = await this.generateStrategicIntelligenceFindings(strategicIntelligence);
        findings.push(...analysisResult.findings);
        recommendations.push(...analysisResult.recommendations);
      }
      
      await this.updateJobProgress(95, 'Saving strategic intelligence results');
      
      // Calculate final strategic intelligence scores
      const finalScores = this.calculateStrategicIntelligenceScores(technologyReadiness, marketTiming, innovationValue, strategicPosition);
      
      // Save the comprehensive strategic intelligence analysis
      await this.completeStrategicAnalysis(dealId, strategicIntelligence, findings, recommendations, docs.length, finalScores);
      
      await this.updateJobProgress(100, 'Analysis completed');
      
      console.log(`✅ Comprehensive research analysis completed for deal ${dealId}`);
      
    } catch (error) {
      console.error(`❌ Error in comprehensive research analysis:`, error);
      throw error;
    }
  }

  /**
   * Extract strategic intelligence evidence using enterprise framework
   */
  private async extractStrategicEvidence(
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
          console.log(`🔎 Extracting strategic evidence from: ${doc.name}`);
          return this.extractStrategicEvidenceFromDocument(doc, question);
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
   * Extract strategic intelligence evidence from a single document using enterprise framework
   */
  private async extractStrategicEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `${ENTERPRISE_AGENT_PROMPTS.RESEARCH.SYSTEM_PROMPT}

${ENTERPRISE_AGENT_PROMPTS.RESEARCH.ANALYSIS_PROMPT}

DOCUMENT ANALYSIS:
Document: ${document.name}
Content: ${content.substring(0, 100000)} ${content.length > 100000 ? '\n[Document truncated - processing first 100k characters for strategic intelligence analysis...]' : ''}

STRATEGIC INTELLIGENCE QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS FOCUS: ${question.analysisPrompt}

SPECIAL ANALYSIS REQUIREMENTS:
${question.trlMapping ? '• TRL ASSESSMENT: Rate technology readiness level (1-9) with development milestones and technical risk quantification' : ''}
${question.adoptionCurveAnalysis ? '• ADOPTION CURVE: Identify market adoption stage (Innovators/Early Adopters/Early Majority/Late Majority/Laggards) with timing analysis' : ''}
${question.innovationMetrics ? '• R&D PRODUCTIVITY: Calculate innovation efficiency ratios and pipeline depth metrics with commercial potential assessment' : ''}
${question.strategicScoring ? '• STRATEGIC POSITIONING: Quantify partnership value, ecosystem leverage, and competitive intelligence with market impact scores' : ''}

${ENTERPRISE_PROMPT_FRAMEWORK.QUANTITATIVE_FOCUS}

Respond in enhanced JSON format:
{
  "relevantContent": ["Exact quote 1", "Exact quote 2"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Strategic finding 1", "Strategic finding 2"],
  "documentSummary": "Strategic intelligence summary",
  "strategicContext": "How this relates to strategic intelligence and investment implications",
  "quantitativeMetrics": {
    "trlLevel": 0-9 or null,
    "adoptionStage": "stage name or null",
    "rdProductivityScore": 0-100 or null,
    "strategicPositionScore": 0-100 or null,
    "riskLevel": "HIGH/MEDIUM/LOW",
    "confidenceInterval": "percentage range"
  },
  "investmentImplications": ["Direct impact on investment decision"],
  "redFlags": ["Critical risks identified"]
}

Apply institutional-grade analysis with quantitative emphasis and strategic intelligence focus.`;

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
        strategicContext: analysis.strategicContext || '',
        quantitativeMetrics: analysis.quantitativeMetrics || {},
        investmentImplications: analysis.investmentImplications || [],
        redFlags: analysis.redFlags || [],
        fullContent: content.substring(0, 2000)
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
        documentSummary: 'Strategic analysis failed',
        strategicContext: '',
        quantitativeMetrics: {},
        investmentImplications: [],
        redFlags: ['Analysis error - manual review required'],
        fullContent: content.substring(0, 1000)
      };
    }
  }

  /**
   * Compile strategic intelligence answer using enterprise framework
   */
  private async compileStrategicIntelligenceAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📊 Using evidence from ${evidence.length} documents`);
    
    // Prepare evidence summary for AI analysis
    const evidenceSummary = evidence.map(doc => {
      return `Document: ${doc.documentName}
Key Findings: ${doc.keyFindings.join('; ')}
Content: ${doc.relevantContent.join(' | ')}
Summary: ${doc.documentSummary}`;
    }).join('\n\n');
    
    const prompt = `${ENTERPRISE_AGENT_PROMPTS.RESEARCH.SYSTEM_PROMPT}

${ENTERPRISE_AGENT_PROMPTS.RESEARCH.ANALYSIS_PROMPT}

STRATEGIC INTELLIGENCE SYNTHESIS:

QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS FOCUS: ${question.analysisPrompt}

EVIDENCE FROM DOCUMENTS:
${evidenceSummary}

SPECIAL REQUIREMENTS:
${question.trlMapping ? '• Provide TRL assessment (1-9) with development timeline and technical risk quantification' : ''}
${question.adoptionCurveAnalysis ? '• Identify adoption stage and market timing with competitive window analysis' : ''}
${question.innovationMetrics ? '• Calculate R&D productivity metrics and innovation pipeline strength scores' : ''}
${question.strategicScoring ? '• Quantify strategic positioning value with ecosystem leverage assessment' : ''}

${ENTERPRISE_PROMPT_FRAMEWORK.QUANTITATIVE_FOCUS}
${ENTERPRISE_PROMPT_FRAMEWORK.EVIDENCE_STANDARDS}

Respond in JSON format with enhanced strategic intelligence structure:
{
  "executiveSummary": {
    "keyFinding": "Most critical strategic insight",
    "quantitativeImpact": "Specific metrics and percentages",
    "riskLevel": "HIGH/MEDIUM/LOW with rationale",
    "investmentImplication": "Direct impact on investment decision",
    "actionRequired": "Specific next steps"
  },
  "strategicAnalysis": {
    "directAnswer": "Evidence-based response to question",
    "keyInsights": ["Insight 1", "Insight 2"],
    "quantitativeMetrics": {
      "trlLevel": 1-9 or null,
      "adoptionStage": "stage" or null,
      "rdProductivityScore": 1-100 or null,
      "strategicPositionScore": 1-100 or null,
      "confidenceInterval": "percentage range"
    },
    "riskFactors": ["Risk 1", "Risk 2"],
    "competitiveIntelligence": ["Competitive insight 1", "Competitive insight 2"]
  },
  "investmentRecommendations": ["Recommendation 1", "Recommendation 2"],
  "dueDiligenceGaps": ["Information gap 1", "Information gap 2"],
  "confidence": 1-100,
  "evidenceStrength": "HIGH/MEDIUM/LOW"
}

Provide institutional-grade analysis with quantitative emphasis and strategic intelligence focus.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 4000 // Increased for comprehensive research analysis synthesis
      });
      
      const answer = response.choices[0]?.message?.content || 'Unable to compile comprehensive answer';
      
      const analysisResult = JSON.parse(answer);
      
      return {
        question: question.question,
        category: question.category,
        executiveSummary: analysisResult.executiveSummary || {},
        strategicAnalysis: analysisResult.strategicAnalysis || {},
        investmentRecommendations: analysisResult.investmentRecommendations || [],
        dueDiligenceGaps: analysisResult.dueDiligenceGaps || [],
        confidence: analysisResult.confidence || this.calculateConfidence(evidence),
        evidenceStrength: analysisResult.evidenceStrength || 'MEDIUM',
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        quantitativeMetrics: this.aggregateQuantitativeMetrics(evidence),
        strategicIntelligence: this.generateStrategicIntelligenceScore(evidence, analysisResult),
        redFlags: evidence.flatMap(e => e.redFlags).filter(flag => flag),
        evidenceSummary: `Strategic analysis based on ${evidence.length} documents with ${evidence.reduce((acc, e) => acc + e.relevantContent.length, 0)} pieces of evidence`
      };
      
    } catch (error) {
      console.error(`Error compiling comprehensive answer:`, error);
      return {
        question: question.question,
        category: question.category,
        executiveSummary: { 
          keyFinding: 'Analysis error - manual review required',
          riskLevel: 'HIGH',
          investmentImplication: 'Unable to assess due to technical error'
        },
        strategicAnalysis: { directAnswer: 'Error occurred during strategic analysis compilation' },
        confidence: 0,
        evidenceStrength: 'LOW',
        sources: evidence.map(e => e.documentName),
        detailedEvidence: evidence,
        quantitativeMetrics: {},
        strategicIntelligence: { overallScore: 0 },
        redFlags: ['Strategic analysis compilation failed - manual review required'],
        evidenceSummary: 'Strategic intelligence compilation failed'
      };
    }
  }

  private calculateConfidence(evidence: any[]): number {
    if (evidence.length === 0) return 0;
    const avgConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length;
    const documentBonus = Math.min(evidence.length * 5, 20); // Up to 20% bonus for multiple documents
    return Math.min(Math.round(avgConfidence + documentBonus), 100);
  }

  /**
   * Aggregate quantitative metrics from evidence
   */
  private aggregateQuantitativeMetrics(evidence: any[]): any {
    const metrics = evidence.map(e => e.quantitativeMetrics).filter(m => m && Object.keys(m).length > 0);
    
    if (metrics.length === 0) return {};
    
    return {
      avgTrlLevel: this.calculateAverage(metrics.map(m => m.trlLevel).filter(t => t)),
      predominantAdoptionStage: this.findMostCommon(metrics.map(m => m.adoptionStage).filter(s => s)),
      avgRdProductivityScore: this.calculateAverage(metrics.map(m => m.rdProductivityScore).filter(s => s)),
      avgStrategicPositionScore: this.calculateAverage(metrics.map(m => m.strategicPositionScore).filter(s => s)),
      overallRiskLevel: this.determineOverallRisk(metrics.map(m => m.riskLevel).filter(r => r))
    };
  }

  /**
   * Generate strategic intelligence score
   */
  private generateStrategicIntelligenceScore(evidence: any[], analysisResult: any): any {
    const metrics = this.aggregateQuantitativeMetrics(evidence);
    
    return {
      overallScore: this.calculateOverallStrategicScore(metrics),
      technologyReadiness: metrics.avgTrlLevel || 0,
      marketTiming: this.mapAdoptionStageToScore(metrics.predominantAdoptionStage),
      innovationValue: metrics.avgRdProductivityScore || 0,
      strategicPosition: metrics.avgStrategicPositionScore || 0,
      confidenceLevel: analysisResult.confidence || 0,
      evidenceQuality: evidence.length >= 3 ? 'HIGH' : evidence.length >= 2 ? 'MEDIUM' : 'LOW'
    };
  }

  /**
   * Update strategic scoring components based on question analysis
   */
  private updateStrategicScoring(
    question: any, 
    answer: any, 
    technologyReadiness: any, 
    marketTiming: any, 
    innovationValue: any, 
    strategicPosition: any
  ): void {
    const metrics = answer.quantitativeMetrics || {};
    
    if (question.trlMapping && metrics.avgTrlLevel) {
      technologyReadiness.trlLevel = Math.max(technologyReadiness.trlLevel, metrics.avgTrlLevel);
      technologyReadiness.developmentRisk = this.calculateDevelopmentRisk(metrics.avgTrlLevel);
      technologyReadiness.timeToMarket = this.estimateTimeToMarket(metrics.avgTrlLevel);
    }
    
    if (question.adoptionCurveAnalysis && metrics.predominantAdoptionStage) {
      marketTiming.adoptionStage = metrics.predominantAdoptionStage;
      marketTiming.competitiveWindow = this.calculateCompetitiveWindow(metrics.predominantAdoptionStage);
      marketTiming.marketReadiness = this.assessMarketReadiness(metrics.predominantAdoptionStage);
    }
    
    if (question.innovationMetrics && metrics.avgRdProductivityScore) {
      innovationValue.rdProductivity = Math.max(innovationValue.rdProductivity, metrics.avgRdProductivityScore);
      innovationValue.pipelineStrength = this.assessPipelineStrength(answer);
      innovationValue.breakthroughPotential = this.assessBreakthroughPotential(answer);
    }
    
    if (question.strategicScoring && metrics.avgStrategicPositionScore) {
      strategicPosition.partnershipValue = this.assessPartnershipValue(answer);
      strategicPosition.ecosystemLeverage = this.assessEcosystemLeverage(answer);
      strategicPosition.competitiveIntelligence = Math.max(strategicPosition.competitiveIntelligence, metrics.avgStrategicPositionScore);
    }
  }

  /**
   * Generate strategic intelligence findings using enterprise framework
   */
  private async generateStrategicIntelligenceFindings(strategicIntelligence: Record<string, any>) {
    try {
      const analysisText = Object.entries(strategicIntelligence)
        .map(([questionId, answer]) => {
          const question = STRATEGIC_INTELLIGENCE_QUESTIONS.find(q => q.id === questionId);
          return `${question?.question}:\nExecutive Summary: ${JSON.stringify(answer.executiveSummary)}\nStrategic Analysis: ${JSON.stringify(answer.strategicAnalysis)}\nRecommendations: ${answer.investmentRecommendations?.join('; ')}`;
        })
        .join('\n\n');

      const prompt = `Based on the following comprehensive strategic intelligence analysis, generate key findings and recommendations:

STRATEGIC INTELLIGENCE ANALYSIS:
${analysisText}

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

      const result = JSON.parse(content);
      
      return {
        findings: result.findings || findings,
        recommendations: result.recommendations || recommendations,
        redFlags: result.redFlags || [],
        strategicIntelligence: result.strategicIntelligence || {}
      };
      
    } catch (error) {
      console.error('Error generating findings and recommendations:', error);
      return { 
        findings: ['Comprehensive research analysis completed with multiple insights identified'],
        recommendations: ['Review detailed research analysis for investment decision making']
      };
    }
  }

  /**
   * Complete strategic analysis with enhanced JSON format
   */
  private async completeStrategicAnalysis(
    dealId: number, 
    strategicIntelligence: Record<string, any>, 
    findings: string[], 
    recommendations: string[], 
    docsProcessed: number,
    finalScores: any
  ) {
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
        research_answers: Object.keys(strategicIntelligence).length > 0 ? strategicIntelligence : undefined,
        technologyReadiness: finalScores.technologyReadiness,
        marketTiming: finalScores.marketTiming,
        innovationValue: finalScores.innovationValue,
        strategicPosition: finalScores.strategicPosition
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

  /**
   * Calculate strategic intelligence scores
   */
  private calculateStrategicIntelligenceScores(
    technologyReadiness: any,
    marketTiming: any,
    innovationValue: any,
    strategicPosition: any
  ): any {
    return {
      technologyReadiness: {
        trlLevel: technologyReadiness.trlLevel,
        developmentRisk: technologyReadiness.developmentRisk,
        timeToMarket: technologyReadiness.timeToMarket,
        overallScore: this.calculateTRLScore(technologyReadiness.trlLevel)
      },
      marketTiming: {
        adoptionStage: marketTiming.adoptionStage,
        competitiveWindow: marketTiming.competitiveWindow,
        marketReadiness: marketTiming.marketReadiness,
        overallScore: this.calculateTimingScore(marketTiming.adoptionStage)
      },
      innovationValue: {
        rdProductivity: innovationValue.rdProductivity,
        pipelineStrength: innovationValue.pipelineStrength,
        breakthroughPotential: innovationValue.breakthroughPotential,
        overallScore: (innovationValue.rdProductivity + innovationValue.pipelineStrength + innovationValue.breakthroughPotential) / 3
      },
      strategicPosition: {
        partnershipValue: strategicPosition.partnershipValue,
        ecosystemLeverage: strategicPosition.ecosystemLeverage,
        competitiveIntelligence: strategicPosition.competitiveIntelligence,
        overallScore: (strategicPosition.partnershipValue + strategicPosition.ecosystemLeverage + strategicPosition.competitiveIntelligence) / 3
      }
    };
  }

  // Helper methods for strategic intelligence scoring
  private calculateAverage(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  private findMostCommon(items: string[]): string {
    if (items.length === 0) return '';
    const frequency = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
  }

  private determineOverallRisk(riskLevels: string[]): string {
    if (riskLevels.includes('HIGH')) return 'HIGH';
    if (riskLevels.includes('MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  private calculateOverallStrategicScore(metrics: any): number {
    const scores = [
      metrics.avgTrlLevel ? (metrics.avgTrlLevel / 9) * 100 : 0,
      this.mapAdoptionStageToScore(metrics.predominantAdoptionStage),
      metrics.avgRdProductivityScore || 0,
      metrics.avgStrategicPositionScore || 0
    ];
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private mapAdoptionStageToScore(stage: string): number {
    const stageScores: Record<string, number> = {
      'Innovators': 90,
      'Early Adopters': 75,
      'Early Majority': 60,
      'Late Majority': 40,
      'Laggards': 20
    };
    return stageScores[stage] || 50;
  }

  private calculateDevelopmentRisk(trlLevel: number): number {
    return Math.max(0, (9 - trlLevel) * 10); // Higher TRL = lower risk
  }

  private estimateTimeToMarket(trlLevel: number): number {
    const timeEstimates = [60, 48, 36, 24, 18, 12, 9, 6, 3]; // months
    return timeEstimates[Math.max(0, Math.min(8, Math.round(trlLevel) - 1))] || 12;
  }

  private calculateCompetitiveWindow(adoptionStage: string): number {
    const windowScores: Record<string, number> = {
      'Innovators': 95,
      'Early Adopters': 80,
      'Early Majority': 60,
      'Late Majority': 30,
      'Laggards': 10
    };
    return windowScores[adoptionStage] || 50;
  }

  private assessMarketReadiness(adoptionStage: string): number {
    const readinessScores: Record<string, number> = {
      'Innovators': 20,
      'Early Adopters': 40,
      'Early Majority': 70,
      'Late Majority': 90,
      'Laggards': 95
    };
    return readinessScores[adoptionStage] || 50;
  }

  private assessPipelineStrength(answer: any): number {
    // Extract pipeline strength indicators from analysis
    const indicators = answer.strategicAnalysis?.keyInsights?.filter((insight: string) => 
      insight.toLowerCase().includes('pipeline') || 
      insight.toLowerCase().includes('innovation') ||
      insight.toLowerCase().includes('r&d')
    ).length || 0;
    return Math.min(100, indicators * 25);
  }

  private assessBreakthroughPotential(answer: any): number {
    // Extract breakthrough potential from analysis
    const breakthroughIndicators = answer.strategicAnalysis?.keyInsights?.filter((insight: string) => 
      insight.toLowerCase().includes('breakthrough') || 
      insight.toLowerCase().includes('disruptive') ||
      insight.toLowerCase().includes('revolutionary')
    ).length || 0;
    return Math.min(100, breakthroughIndicators * 30);
  }

  private assessPartnershipValue(answer: any): number {
    // Extract partnership value from analysis
    const partnershipIndicators = answer.strategicAnalysis?.keyInsights?.filter((insight: string) => 
      insight.toLowerCase().includes('partnership') || 
      insight.toLowerCase().includes('alliance') ||
      insight.toLowerCase().includes('collaboration')
    ).length || 0;
    return Math.min(100, partnershipIndicators * 25);
  }

  private assessEcosystemLeverage(answer: any): number {
    // Extract ecosystem leverage from analysis
    const ecosystemIndicators = answer.strategicAnalysis?.keyInsights?.filter((insight: string) => 
      insight.toLowerCase().includes('ecosystem') || 
      insight.toLowerCase().includes('platform') ||
      insight.toLowerCase().includes('network')
    ).length || 0;
    return Math.min(100, ecosystemIndicators * 30);
  }

  private calculateTRLScore(trlLevel: number): number {
    return Math.round((trlLevel / 9) * 100);
  }

  private calculateTimingScore(adoptionStage: string): number {
    return this.mapAdoptionStageToScore(adoptionStage);
  }

  private async updateJobProgress(progress: number, step: string) {
    try {
      await this.storage.updateBackgroundJob(this.jobId, {
        progress: Math.round(progress),
        currentStep: step
      });
      console.log(`🎯 Strategic Intelligence Analysis Progress: ${Math.round(progress)}% - ${step}`);
    } catch (error) {
      console.error('Error updating job progress:', error);
    }
  }
}