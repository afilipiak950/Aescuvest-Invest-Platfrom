/**
 * Enhanced AI Analysis Service
 * Provides fine-tuned analysis for each agent type with specialized prompts
 */

import OpenAI from 'openai';
import { getAgentPrompt, isDocumentRelevantToAgent } from './agentPrompts';
import { storage } from '../storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

export interface EnhancedAnalysisResult {
  agentType: string;
  confidence: number;
  relevanceScore: number;
  findings: any[];
  recommendations: string[];
  structuredAnalysis: any;
  processingTime: number;
  documentSources: string[];
}

export class EnhancedAIAnalysisService {
  private rateLimiter: Map<string, number> = new Map();
  private readonly minInterval = 2000; // 2 seconds between requests
  private readonly maxRetries = 3;

  /**
   * Analyze documents for a specific agent with enhanced prompts
   */
  async analyzeWithEnhancedPrompts(
    dealId: number,
    agentType: string,
    documents: any[],
    deal: any,
    forceRefresh = false
  ): Promise<EnhancedAnalysisResult> {
    const startTime = Date.now();
    const agentPrompt = getAgentPrompt(agentType);
    
    console.log(`🎯 Starting enhanced ${agentType} analysis for deal ${dealId} with ${documents.length} documents`);
    
    // Filter documents relevant to this agent
    const relevantDocuments = documents.filter(doc => {
      const content = doc.ocrText || doc.aiSummary || doc.analysisText || '';
      return isDocumentRelevantToAgent(doc.name, content, agentType);
    });

    console.log(`📋 Found ${relevantDocuments.length}/${documents.length} relevant documents for ${agentType} agent`);

    if (relevantDocuments.length === 0) {
      return {
        agentType,
        confidence: 0,
        relevanceScore: 0,
        findings: [],
        recommendations: [`No relevant documents found for ${agentType} analysis`],
        structuredAnalysis: {},
        processingTime: Date.now() - startTime,
        documentSources: []
      };
    }

    // Process documents with enhanced analysis
    const documentAnalyses = await this.processDocumentsWithEnhancedPrompts(
      relevantDocuments,
      agentPrompt,
      deal
    );

    // Aggregate analysis results
    const aggregatedAnalysis = this.aggregateAnalysisResults(
      documentAnalyses,
      agentType,
      agentPrompt
    );

    // Store enhanced analysis in database
    await this.storeEnhancedAnalysis(dealId, agentType, aggregatedAnalysis);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Enhanced ${agentType} analysis completed in ${processingTime}ms`);

    return {
      agentType,
      confidence: aggregatedAnalysis.confidence,
      relevanceScore: aggregatedAnalysis.relevanceScore,
      findings: aggregatedAnalysis.findings,
      recommendations: aggregatedAnalysis.recommendations,
      structuredAnalysis: aggregatedAnalysis.structuredAnalysis,
      processingTime,
      documentSources: relevantDocuments.map(doc => doc.name)
    };
  }

  /**
   * Process documents with enhanced prompts
   */
  private async processDocumentsWithEnhancedPrompts(
    documents: any[],
    agentPrompt: any,
    deal: any
  ): Promise<any[]> {
    const analyses = [];

    for (const document of documents) {
      try {
        // Apply rate limiting
        await this.applyRateLimit(agentPrompt.name);

        const analysis = await this.analyzeDocumentWithEnhancedPrompt(
          document,
          agentPrompt,
          deal
        );

        analyses.push({
          document: document.name,
          analysis,
          relevanceScore: this.calculateRelevanceScore(document, agentPrompt)
        });

        console.log(`📄 Processed ${document.name} for ${agentPrompt.name} agent`);
      } catch (error) {
        console.error(`❌ Error processing document ${document.name}:`, error);
        analyses.push({
          document: document.name,
          analysis: this.generateFallbackAnalysis(document, agentPrompt),
          relevanceScore: 0.3
        });
      }
    }

    return analyses;
  }

  /**
   * Analyze single document with enhanced prompt
   */
  private async analyzeDocumentWithEnhancedPrompt(
    document: any,
    agentPrompt: any,
    deal: any
  ): Promise<any> {
    const documentContent = document.ocrText || document.aiSummary || document.analysisText || '';
    
    // Prepare enhanced prompt with document context
    const enhancedPrompt = agentPrompt.analysisPrompt
      .replace('{companyName}', deal.companyName || 'Unknown Company')
      .replace('{documentName}', document.name)
      .replace('{documentContent}', documentContent.substring(0, 4000)); // Limit content length

    const messages = [
      {
        role: 'system',
        content: agentPrompt.systemPrompt
      },
      {
        role: 'user',
        content: enhancedPrompt
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: agentPrompt.temperature,
      max_tokens: agentPrompt.maxTokens,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error(`JSON parse error for ${agentPrompt.name}:`, parseError);
      return this.generateFallbackAnalysis(document, agentPrompt);
    }
  }

  /**
   * Aggregate analysis results from multiple documents
   */
  private aggregateAnalysisResults(
    documentAnalyses: any[],
    agentType: string,
    agentPrompt: any
  ): any {
    const findings = [];
    const recommendations = [];
    const structuredAnalysis = {};
    
    let totalRelevanceScore = 0;
    let totalConfidence = 0;
    let validAnalyses = 0;

    for (const docAnalysis of documentAnalyses) {
      const analysis = docAnalysis.analysis;
      const relevanceScore = docAnalysis.relevanceScore;
      
      if (analysis && typeof analysis === 'object') {
        // Extract findings
        if (analysis.findings) {
          findings.push(...(Array.isArray(analysis.findings) ? analysis.findings : [analysis.findings]));
        }
        
        // Extract recommendations
        if (analysis.recommendations) {
          recommendations.push(...(Array.isArray(analysis.recommendations) ? analysis.recommendations : [analysis.recommendations]));
        }
        
        // Merge structured analysis
        Object.keys(analysis).forEach(key => {
          if (key !== 'findings' && key !== 'recommendations') {
            if (!structuredAnalysis[key]) {
              structuredAnalysis[key] = [];
            }
            structuredAnalysis[key].push({
              document: docAnalysis.document,
              data: analysis[key]
            });
          }
        });

        // Calculate confidence and relevance
        if (analysis.overall_assessment) {
          totalConfidence += analysis.overall_assessment.confidence || 0;
          validAnalyses++;
        }
      }
      
      totalRelevanceScore += relevanceScore;
    }

    // Calculate average scores
    const averageRelevanceScore = documentAnalyses.length > 0 ? totalRelevanceScore / documentAnalyses.length : 0;
    const averageConfidence = validAnalyses > 0 ? totalConfidence / validAnalyses : 0;

    return {
      findings: this.deduplicateFindings(findings),
      recommendations: this.deduplicateRecommendations(recommendations),
      structuredAnalysis,
      confidence: Math.round(averageConfidence),
      relevanceScore: Math.round(averageRelevanceScore * 100)
    };
  }

  /**
   * Calculate relevance score for document-agent pair
   */
  private calculateRelevanceScore(document: any, agentPrompt: any): number {
    const documentText = (document.name + ' ' + (document.ocrText || document.aiSummary || '')).toLowerCase();
    const keywords = agentPrompt.keywordFilters;
    
    let matchCount = 0;
    for (const keyword of keywords) {
      if (documentText.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    
    return Math.min(matchCount / keywords.length, 1.0);
  }

  /**
   * Remove duplicate findings
   */
  private deduplicateFindings(findings: any[]): any[] {
    const seen = new Set();
    return findings.filter(finding => {
      const key = `${finding.title || finding.content || finding.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Remove duplicate recommendations
   */
  private deduplicateRecommendations(recommendations: string[]): string[] {
    return [...new Set(recommendations)];
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(agentType: string): Promise<void> {
    const lastRequest = this.rateLimiter.get(agentType) || 0;
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.rateLimiter.set(agentType, Date.now());
  }

  /**
   * Generate fallback analysis for errors
   */
  private generateFallbackAnalysis(document: any, agentPrompt: any): any {
    return {
      findings: [{
        title: `${agentPrompt.name} Analysis Required`,
        description: `Document "${document.name}" requires manual review by ${agentPrompt.name} specialist.`,
        confidence: 0.5,
        type: 'warning'
      }],
      recommendations: [`Conduct manual ${agentPrompt.name} review of ${document.name}`],
      overall_assessment: {
        score: 50,
        confidence: 50,
        recommendation: 'Manual review required'
      }
    };
  }

  /**
   * Store enhanced analysis in database
   */
  private async storeEnhancedAnalysis(dealId: number, agentType: string, analysis: any): Promise<void> {
    try {
      // Clear existing analysis for this agent
      await storage.clearAgentAnalysis(dealId, agentType);

      // Store new enhanced analysis
      await storage.createAgentAnalysis({
        dealId,
        agentType,
        status: 'Completed',
        progress: 100,
        findings: analysis.findings,
        recommendations: analysis.recommendations,
        confidence: analysis.confidence,
        structuredData: analysis.structuredAnalysis
      });

      console.log(`💾 Stored enhanced ${agentType} analysis for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Error storing enhanced analysis:`, error);
    }
  }
}

export const enhancedAIAnalysisService = new EnhancedAIAnalysisService();