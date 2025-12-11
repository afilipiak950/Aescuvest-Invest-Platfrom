/**
 * Agent Data Fusion Layer
 * 
 * Transforms raw agent Q&A outputs into structured, citation-ready facts
 * for high-quality investment memo generation.
 * 
 * This service extracts concrete data from all 7 specialized agents:
 * - Legal: Corporate structure, contracts, IP, regulatory compliance
 * - Clinical: Regulatory pathway, clinical data, approval status
 * - Commercial: Market analysis, competition, go-to-market strategy
 * - HR: Team backgrounds, organizational structure, key personnel
 * - Financial: Funding, valuation, revenue projections, burn rate
 * - IP: Patents, trademarks, trade secrets, IP strategy
 * - Research: Technology differentiation, R&D pipeline, publications
 */

export interface AgentFact {
  id: string;
  agentType: 'legal' | 'clinical' | 'commercial' | 'hr' | 'financial' | 'ip' | 'research';
  category: string;
  questionId: string;
  fact: string;
  confidence: 'high' | 'medium' | 'low';
  sourceDocuments: string[];
  quantitativeData?: QuantitativeMetric[];
  citation: string;
}

export interface QuantitativeMetric {
  type: 'currency' | 'percentage' | 'count' | 'date' | 'duration' | 'ratio';
  value: string;
  context: string;
  unit?: string;
}

export interface AgentFactMatrix {
  dealId: number;
  companyName: string;
  generatedAt: string;
  totalFacts: number;
  factsByAgent: Record<string, AgentFact[]>;
  factsByCategory: Record<string, AgentFact[]>;
  quantitativeMetrics: QuantitativeMetric[];
  keyFindings: KeyFinding[];
  recommendations: AgentRecommendation[];
}

export interface KeyFinding {
  agentType: string;
  severity: 'critical' | 'important' | 'informational';
  finding: string;
  implications: string;
  citation: string;
}

export interface AgentRecommendation {
  agentType: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  rationale: string;
  citation: string;
}

export class AgentDataFusionService {
  private static instance: AgentDataFusionService;

  static getInstance(): AgentDataFusionService {
    if (!AgentDataFusionService.instance) {
      AgentDataFusionService.instance = new AgentDataFusionService();
    }
    return AgentDataFusionService.instance;
  }

  /**
   * Build a comprehensive fact matrix from all agent analyses
   */
  async buildAgentFactMatrix(
    dealId: number,
    companyName: string,
    agentAnalyses: any[]
  ): Promise<AgentFactMatrix> {
    console.log(`🔬 Building agent fact matrix for deal ${dealId} from ${agentAnalyses.length} analyses`);
    console.log(`📊 COMPREHENSIVE DATA EXTRACTION: Analyzing ALL 7 agent types for maximum coverage`);

    const factMatrix: AgentFactMatrix = {
      dealId,
      companyName,
      generatedAt: new Date().toISOString(),
      totalFacts: 0,
      factsByAgent: {},
      factsByCategory: {},
      quantitativeMetrics: [],
      keyFindings: [],
      recommendations: []
    };

    // 🚀 ENHANCED: Track which agents we're processing for debugging
    const processedAgents: string[] = [];
    const agentFactCounts: Record<string, number> = {};

    for (const analysis of agentAnalyses) {
      const agentType = analysis.agentType?.toLowerCase() || 'unknown';
      processedAgents.push(agentType);
      
      // 🚀 DEBUG: Log available fields in each analysis
      const availableFields = Object.keys(analysis).filter(k => analysis[k] && String(analysis[k]).length > 0);
      console.log(`📋 ${agentType.toUpperCase()} Agent fields: [${availableFields.join(', ')}]`);
      
      // Extract facts from each agent type's answers
      const agentFacts = this.extractFactsFromAgentAnalysis(analysis, agentType);
      agentFactCounts[agentType] = (agentFactCounts[agentType] || 0) + agentFacts.length;
      
      // Store by agent type
      if (!factMatrix.factsByAgent[agentType]) {
        factMatrix.factsByAgent[agentType] = [];
      }
      factMatrix.factsByAgent[agentType].push(...agentFacts);
      
      // Categorize facts
      for (const fact of agentFacts) {
        if (!factMatrix.factsByCategory[fact.category]) {
          factMatrix.factsByCategory[fact.category] = [];
        }
        factMatrix.factsByCategory[fact.category].push(fact);
        
        // Collect quantitative metrics
        if (fact.quantitativeData) {
          factMatrix.quantitativeMetrics.push(...fact.quantitativeData);
        }
      }
      
      // Extract key findings from analysis findings
      if (analysis.findings && Array.isArray(analysis.findings)) {
        const keyFindings = this.extractKeyFindings(analysis.findings, agentType);
        factMatrix.keyFindings.push(...keyFindings);
        console.log(`   → ${agentType} findings: ${keyFindings.length}`);
      }
      
      // Extract recommendations
      if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
        const recommendations = this.extractRecommendations(analysis.recommendations, agentType);
        factMatrix.recommendations.push(...recommendations);
        console.log(`   → ${agentType} recommendations: ${recommendations.length}`);
      }
      
      factMatrix.totalFacts += agentFacts.length;
    }

    // 🚀 COMPREHENSIVE DEBUG OUTPUT
    console.log(`\n========== FACT MATRIX BUILD COMPLETE ==========`);
    console.log(`📊 Deal: ${dealId} (${companyName})`);
    console.log(`📊 Agents Processed: [${processedAgents.join(', ')}]`);
    console.log(`📊 Facts per Agent:`);
    Object.entries(agentFactCounts).forEach(([agent, count]) => {
      console.log(`   → ${agent}: ${count} facts`);
    });
    console.log(`📊 Total Facts: ${factMatrix.totalFacts}`);
    console.log(`📊 Total Quantitative Metrics: ${factMatrix.quantitativeMetrics.length}`);
    console.log(`📊 Total Key Findings: ${factMatrix.keyFindings.length}`);
    console.log(`📊 Total Recommendations: ${factMatrix.recommendations.length}`);
    console.log(`📊 Categories: [${Object.keys(factMatrix.factsByCategory).join(', ')}]`);
    console.log(`==================================================\n`);
    
    return factMatrix;
  }

  /**
   * Extract structured facts from a single agent's analysis
   * 🎯 ENHANCED: Extract ALL available content including summaries, findings, recommendations
   */
  private extractFactsFromAgentAnalysis(analysis: any, agentType: string): AgentFact[] {
    const facts: AgentFact[] = [];
    
    // Map of answer field names to agent types
    const answerFields: Record<string, string> = {
      legalAnswers: 'legal',
      clinicalAnswers: 'clinical',
      commercialAnswers: 'commercial',
      hrAnswers: 'hr',
      financialAnswers: 'financial',
      ipAnswers: 'ip',
      researchAnswers: 'research'
    };

    // 1. PRIMARY: Process Q&A answer fields (highest quality structured data)
    for (const [field, type] of Object.entries(answerFields)) {
      if (analysis[field] && type === agentType) {
        const parsedFacts = this.parseAgentAnswers(analysis[field], type);
        facts.push(...parsedFacts);
      }
    }
    
    // 2. SECONDARY: Include ALL summaries with substantial content (lowered bar from 3 to 1 metric)
    // This ensures we capture qualitative insights even without quantitative metrics
    if (analysis.summary && typeof analysis.summary === 'string' && analysis.summary.length > 100) {
      const summaryMetrics = this.extractQuantitativeMetrics(analysis.summary);
      // RELAXED: Include summary if it has any metric OR is substantial (500+ chars)
      if (summaryMetrics.length >= 1 || analysis.summary.length > 500) {
        facts.push({
          id: `${agentType}_summary`,
          agentType: agentType as AgentFact['agentType'],
          category: 'summary',
          questionId: 'analysis_summary',
          fact: analysis.summary.substring(0, 5000), // Increased limit for more detail
          confidence: summaryMetrics.length >= 3 ? 'high' : 'medium',
          sourceDocuments: this.extractSourceDocuments(analysis.summary),
          quantitativeData: summaryMetrics.length > 0 ? summaryMetrics : undefined,
          citation: `[${agentType.toUpperCase()} Agent - Summary]`
        });
      }
    }
    
    // 3. NEW: Extract findings as individual facts
    if (analysis.findings && Array.isArray(analysis.findings)) {
      analysis.findings.forEach((finding: any, index: number) => {
        const findingText = typeof finding === 'string' ? finding : (finding.content || finding.description || JSON.stringify(finding));
        if (findingText && findingText.length > 30) {
          facts.push({
            id: `${agentType}_finding_${index}`,
            agentType: agentType as AgentFact['agentType'],
            category: 'findings',
            questionId: `finding_${index}`,
            fact: findingText.substring(0, 2000),
            confidence: 'high',
            sourceDocuments: [],
            quantitativeData: this.extractQuantitativeMetrics(findingText),
            citation: `[${agentType.toUpperCase()} Agent - Finding]`
          });
        }
      });
    }
    
    // 4. NEW: Extract recommendations as individual facts
    if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
      analysis.recommendations.forEach((rec: any, index: number) => {
        const recText = typeof rec === 'string' ? rec : (rec.content || rec.description || rec.recommendation || JSON.stringify(rec));
        if (recText && recText.length > 30) {
          facts.push({
            id: `${agentType}_recommendation_${index}`,
            agentType: agentType as AgentFact['agentType'],
            category: 'recommendations',
            questionId: `recommendation_${index}`,
            fact: recText.substring(0, 2000),
            confidence: 'high',
            sourceDocuments: [],
            quantitativeData: this.extractQuantitativeMetrics(recText),
            citation: `[${agentType.toUpperCase()} Agent - Recommendation]`
          });
        }
      });
    }
    
    // 5. NEW: Extract score and status information
    if (analysis.score !== undefined && analysis.score !== null) {
      facts.push({
        id: `${agentType}_score`,
        agentType: agentType as AgentFact['agentType'],
        category: 'assessment',
        questionId: 'overall_score',
        fact: `Overall ${agentType} assessment score: ${analysis.score}/100`,
        confidence: 'high',
        sourceDocuments: [],
        quantitativeData: [{ type: 'percentage', value: `${analysis.score}%`, context: 'assessment score' }],
        citation: `[${agentType.toUpperCase()} Agent - Assessment]`
      });
    }

    console.log(`📊 extractFactsFromAgentAnalysis(${agentType}): Extracted ${facts.length} facts`);
    return facts;
  }

  /**
   * Parse agent answers into structured facts
   */
  private parseAgentAnswers(answers: any, agentType: string): AgentFact[] {
    const facts: AgentFact[] = [];
    
    try {
      const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;
      
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [questionId, answer] of Object.entries(parsed)) {
          if (!answer || (typeof answer === 'string' && answer.trim().length < 20)) {
            continue; // Skip empty or very short answers
          }

          const answerText = typeof answer === 'string' ? answer : JSON.stringify(answer);
          const category = this.categorizeQuestion(questionId, agentType);
          const quantitativeData = this.extractQuantitativeMetrics(answerText);
          const confidence = this.assessConfidence(answerText, quantitativeData);

          facts.push({
            id: `${agentType}_${questionId}`,
            agentType: agentType as AgentFact['agentType'],
            category,
            questionId,
            fact: answerText,
            confidence,
            sourceDocuments: this.extractSourceDocuments(answerText),
            quantitativeData: quantitativeData.length > 0 ? quantitativeData : undefined,
            citation: `[${agentType.toUpperCase()} Agent - ${this.formatQuestionId(questionId)}]`
          });
        }
      }
    } catch (e) {
      console.warn(`Error parsing ${agentType} answers:`, e);
      // Try to extract as raw text
      if (typeof answers === 'string' && answers.length > 50) {
        facts.push({
          id: `${agentType}_raw`,
          agentType: agentType as AgentFact['agentType'],
          category: 'general',
          questionId: 'raw_content',
          fact: answers,
          confidence: 'medium',
          sourceDocuments: [],
          citation: `[${agentType.toUpperCase()} Agent - Analysis]`
        });
      }
    }

    return facts;
  }

  /**
   * Extract quantitative metrics from text
   */
  extractQuantitativeMetrics(text: string): QuantitativeMetric[] {
    const metrics: QuantitativeMetric[] = [];
    
    // Currency patterns (USD, EUR, etc.)
    const currencyPatterns = [
      /\$[\d,]+(?:\.\d{1,2})?(?:\s*(?:million|billion|M|B|K|thousand))?/gi,
      /(?:USD|EUR|GBP)\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:million|billion|M|B|K|thousand))?/gi,
      /[\d,]+(?:\.\d{1,2})?\s*(?:million|billion)\s*(?:dollars?|USD|EUR)?/gi
    ];

    for (const pattern of currencyPatterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        const context = this.extractContext(text, match);
        metrics.push({
          type: 'currency',
          value: match.trim(),
          context,
          unit: this.extractCurrencyUnit(match)
        });
      }
    }

    // Percentage patterns
    const percentagePattern = /\d+(?:\.\d+)?%/g;
    const percentMatches = text.match(percentagePattern) || [];
    for (const match of percentMatches) {
      metrics.push({
        type: 'percentage',
        value: match,
        context: this.extractContext(text, match)
      });
    }

    // Date patterns
    const datePatterns = [
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g,
      /\b(?:Q[1-4]|H[12])\s*\d{4}\b/gi,
      /\b20\d{2}\b/g
    ];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern) || [];
      for (const match of matches) {
        metrics.push({
          type: 'date',
          value: match,
          context: this.extractContext(text, match)
        });
      }
    }

    // Count/number patterns with context
    const countPattern = /\b(\d{1,3}(?:,\d{3})*)\s+(?:employees?|patents?|customers?|users?|clients?|sites?|locations?|countries?)\b/gi;
    let countMatch;
    while ((countMatch = countPattern.exec(text)) !== null) {
      metrics.push({
        type: 'count',
        value: countMatch[1],
        context: countMatch[0],
        unit: countMatch[0].replace(countMatch[1], '').trim()
      });
    }

    return metrics;
  }

  /**
   * Categorize a question ID into a semantic category
   */
  private categorizeQuestion(questionId: string, agentType: string): string {
    const lowerQuestionId = questionId.toLowerCase();
    
    // Legal categories
    if (agentType === 'legal') {
      if (lowerQuestionId.includes('corporate') || lowerQuestionId.includes('structure')) return 'corporate_structure';
      if (lowerQuestionId.includes('contract') || lowerQuestionId.includes('agreement')) return 'contracts';
      if (lowerQuestionId.includes('ip') || lowerQuestionId.includes('patent') || lowerQuestionId.includes('trademark')) return 'intellectual_property';
      if (lowerQuestionId.includes('regulatory') || lowerQuestionId.includes('compliance')) return 'regulatory_compliance';
      if (lowerQuestionId.includes('litigation') || lowerQuestionId.includes('dispute')) return 'litigation';
      if (lowerQuestionId.includes('governance') || lowerQuestionId.includes('board')) return 'governance';
    }
    
    // Clinical categories
    if (agentType === 'clinical') {
      if (lowerQuestionId.includes('trial') || lowerQuestionId.includes('clinical')) return 'clinical_trials';
      if (lowerQuestionId.includes('fda') || lowerQuestionId.includes('regulatory') || lowerQuestionId.includes('approval')) return 'regulatory_pathway';
      if (lowerQuestionId.includes('safety') || lowerQuestionId.includes('adverse')) return 'safety_profile';
      if (lowerQuestionId.includes('efficacy') || lowerQuestionId.includes('outcome')) return 'efficacy_data';
    }
    
    // Commercial categories
    if (agentType === 'commercial') {
      if (lowerQuestionId.includes('market') || lowerQuestionId.includes('tam') || lowerQuestionId.includes('sam')) return 'market_analysis';
      if (lowerQuestionId.includes('competition') || lowerQuestionId.includes('competitor')) return 'competitive_landscape';
      if (lowerQuestionId.includes('customer') || lowerQuestionId.includes('segment')) return 'customer_segments';
      if (lowerQuestionId.includes('pricing') || lowerQuestionId.includes('revenue')) return 'business_model';
      if (lowerQuestionId.includes('gtm') || lowerQuestionId.includes('go-to-market') || lowerQuestionId.includes('sales')) return 'go_to_market';
    }
    
    // HR categories
    if (agentType === 'hr') {
      if (lowerQuestionId.includes('ceo') || lowerQuestionId.includes('founder') || lowerQuestionId.includes('executive')) return 'executive_team';
      if (lowerQuestionId.includes('team') || lowerQuestionId.includes('employee')) return 'team_composition';
      if (lowerQuestionId.includes('advisor') || lowerQuestionId.includes('board')) return 'advisors_board';
      if (lowerQuestionId.includes('culture') || lowerQuestionId.includes('organization')) return 'organizational_culture';
    }
    
    // Financial categories
    if (agentType === 'financial') {
      if (lowerQuestionId.includes('funding') || lowerQuestionId.includes('investment') || lowerQuestionId.includes('round')) return 'funding_history';
      if (lowerQuestionId.includes('valuation')) return 'valuation';
      if (lowerQuestionId.includes('revenue') || lowerQuestionId.includes('projection')) return 'financial_projections';
      if (lowerQuestionId.includes('burn') || lowerQuestionId.includes('runway')) return 'burn_rate';
      if (lowerQuestionId.includes('cap') || lowerQuestionId.includes('table') || lowerQuestionId.includes('ownership')) return 'cap_table';
    }
    
    // IP categories
    if (agentType === 'ip') {
      if (lowerQuestionId.includes('patent')) return 'patents';
      if (lowerQuestionId.includes('trademark')) return 'trademarks';
      if (lowerQuestionId.includes('trade secret') || lowerQuestionId.includes('proprietary')) return 'trade_secrets';
      if (lowerQuestionId.includes('license') || lowerQuestionId.includes('licensing')) return 'licensing';
    }
    
    // Research categories
    if (agentType === 'research') {
      if (lowerQuestionId.includes('technology') || lowerQuestionId.includes('tech')) return 'technology';
      if (lowerQuestionId.includes('r&d') || lowerQuestionId.includes('research') || lowerQuestionId.includes('development')) return 'rd_pipeline';
      if (lowerQuestionId.includes('publication') || lowerQuestionId.includes('paper')) return 'publications';
      if (lowerQuestionId.includes('differentiation') || lowerQuestionId.includes('advantage')) return 'differentiation';
    }
    
    return 'general';
  }

  /**
   * Assess confidence level based on content quality
   */
  private assessConfidence(text: string, metrics: QuantitativeMetric[]): 'high' | 'medium' | 'low' {
    const hasQuantitativeData = metrics.length > 0;
    const hasSpecificNames = /(?:Dr\.|Mr\.|Ms\.|Prof\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g.test(text);
    const hasSpecificDates = /\b(?:20\d{2}|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi.test(text);
    const hasCompanyNames = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|LLC|Ltd|Corp|GmbH|AG|SA|BV|PLC)\b/g.test(text);
    const textLength = text.length;
    
    const score = 
      (hasQuantitativeData ? 2 : 0) +
      (hasSpecificNames ? 1 : 0) +
      (hasSpecificDates ? 1 : 0) +
      (hasCompanyNames ? 1 : 0) +
      (textLength > 500 ? 1 : 0) +
      (textLength > 1000 ? 1 : 0);
    
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  /**
   * Extract source document references from text
   */
  private extractSourceDocuments(text: string): string[] {
    const sources: string[] = [];
    
    // Common document patterns
    const patterns = [
      /(?:from|in|per|according to)\s+["']?([^"'\n,]+\.(?:pdf|docx?|xlsx?|pptx?))["']?/gi,
      /\[([^\]]+\.(?:pdf|docx?|xlsx?|pptx?))\]/gi,
      /document[:\s]+["']?([^"'\n,]+)["']?/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && !sources.includes(match[1])) {
          sources.push(match[1]);
        }
      }
    }
    
    return sources;
  }

  /**
   * Extract context around a matched value
   */
  private extractContext(text: string, match: string): string {
    const index = text.indexOf(match);
    if (index === -1) return match;
    
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + match.length + 50);
    let context = text.substring(start, end);
    
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract currency unit from a currency string
   */
  private extractCurrencyUnit(value: string): string {
    if (value.includes('$') || value.toLowerCase().includes('usd')) return 'USD';
    if (value.toLowerCase().includes('eur') || value.includes('€')) return 'EUR';
    if (value.toLowerCase().includes('gbp') || value.includes('£')) return 'GBP';
    return 'USD';
  }

  /**
   * Format question ID for citation
   */
  private formatQuestionId(questionId: string): string {
    return questionId
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Extract key findings from analysis findings array
   */
  private extractKeyFindings(findings: any[], agentType: string): KeyFinding[] {
    const keyFindings: KeyFinding[] = [];
    
    for (const finding of findings) {
      const content = typeof finding === 'string' ? finding : (finding.content || finding.description || JSON.stringify(finding));
      
      if (!content || content.length < 20) continue;
      
      const severity = this.assessFindingSeverity(content);
      
      keyFindings.push({
        agentType,
        severity,
        finding: content,
        implications: this.extractImplications(content),
        citation: `[${agentType.toUpperCase()} Agent - Finding]`
      });
    }
    
    return keyFindings;
  }

  /**
   * Extract recommendations from analysis recommendations array
   */
  private extractRecommendations(recommendations: any[], agentType: string): AgentRecommendation[] {
    const result: AgentRecommendation[] = [];
    
    for (const rec of recommendations) {
      const content = typeof rec === 'string' ? rec : (rec.content || rec.description || rec.recommendation || JSON.stringify(rec));
      
      if (!content || content.length < 20) continue;
      
      result.push({
        agentType,
        priority: this.assessRecommendationPriority(content),
        recommendation: content,
        rationale: rec.rationale || this.extractRationale(content),
        citation: `[${agentType.toUpperCase()} Agent - Recommendation]`
      });
    }
    
    return result;
  }

  /**
   * Assess severity of a finding
   */
  private assessFindingSeverity(content: string): 'critical' | 'important' | 'informational' {
    const lowerContent = content.toLowerCase();
    
    const criticalKeywords = ['critical', 'urgent', 'immediate', 'severe', 'major risk', 'significant concern', 'breach', 'violation', 'failure'];
    const importantKeywords = ['important', 'notable', 'significant', 'material', 'key', 'essential', 'recommend'];
    
    for (const keyword of criticalKeywords) {
      if (lowerContent.includes(keyword)) return 'critical';
    }
    
    for (const keyword of importantKeywords) {
      if (lowerContent.includes(keyword)) return 'important';
    }
    
    return 'informational';
  }

  /**
   * Assess priority of a recommendation
   */
  private assessRecommendationPriority(content: string): 'high' | 'medium' | 'low' {
    const lowerContent = content.toLowerCase();
    
    const highPriorityKeywords = ['immediately', 'urgent', 'critical', 'essential', 'must', 'required', 'priority'];
    const mediumPriorityKeywords = ['should', 'recommend', 'important', 'consider', 'advisable'];
    
    for (const keyword of highPriorityKeywords) {
      if (lowerContent.includes(keyword)) return 'high';
    }
    
    for (const keyword of mediumPriorityKeywords) {
      if (lowerContent.includes(keyword)) return 'medium';
    }
    
    return 'low';
  }

  /**
   * Extract implications from finding text
   */
  private extractImplications(content: string): string {
    const implicationPatterns = [
      /(?:this|which|that)\s+(?:means?|implies?|indicates?|suggests?|could|may|might)\s+([^.]+\.)/gi,
      /(?:implication|consequence|impact|effect)[:\s]+([^.]+\.)/gi
    ];
    
    for (const pattern of implicationPatterns) {
      const match = pattern.exec(content);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return 'Requires further analysis to determine full implications.';
  }

  /**
   * Extract rationale from recommendation text
   */
  private extractRationale(content: string): string {
    const rationalePatterns = [
      /(?:because|since|as|due to|given that)\s+([^.]+\.)/gi,
      /(?:reason|rationale|basis)[:\s]+([^.]+\.)/gi
    ];
    
    for (const pattern of rationalePatterns) {
      const match = pattern.exec(content);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return 'Based on comprehensive analysis of available documentation.';
  }

  /**
   * Get facts for a specific memo section
   * Maps both camelCase (new) and snake_case (legacy) section names to relevant agents
   */
  getFactsForSection(factMatrix: AgentFactMatrix, sectionType: string): AgentFact[] {
    // 🎯 TARGETED DATA STRATEGY: Use primary agents + cross-functional agents where valuable
    // Primary agents are fully included; secondary agents are filtered by high-confidence only
    const ALL_AGENTS = ['legal', 'clinical', 'commercial', 'hr', 'financial', 'ip', 'research'];
    
    // Section-specific mappings with PRIMARY and SECONDARY agents
    // PRIMARY: All facts included (core domain experts)
    // SECONDARY: Only high-confidence facts included (cross-functional value)
    const sectionConfig: Record<string, { primary: string[], secondary: string[] }> = {
      // CamelCase section names (matches InvestmentMemoSections interface)
      'coverPage': { primary: ['financial', 'commercial', 'legal'], secondary: [] },
      'executiveSummary': { primary: ALL_AGENTS, secondary: [] },
      'financialAnalysis': { primary: ['financial'], secondary: ['commercial', 'legal'] },
      'teamAssessment': { primary: ['hr'], secondary: ['research', 'financial'] },
      'marketAnalysis': { primary: ['commercial', 'research'], secondary: ['clinical'] },
      'riskAnalysis': { primary: ALL_AGENTS, secondary: [] },
      'regulatoryPathway': { primary: ['clinical', 'legal'], secondary: ['research'] },
      'clinicalEvidence': { primary: ['clinical', 'research'], secondary: [] },
      'intellectualProperty': { primary: ['ip', 'legal'], secondary: ['research'] },
      'investmentTerms': { primary: ['legal', 'financial'], secondary: ['commercial'] },
      'competitiveAnalysis': { primary: ['commercial', 'research'], secondary: ['ip'] },
      'technologyAssessment': { primary: ['research', 'ip'], secondary: ['clinical'] },
      // Legacy snake_case mappings for backwards compatibility
      'executive_summary': { primary: ALL_AGENTS, secondary: [] },
      'cover_page': { primary: ['financial', 'commercial', 'legal'], secondary: [] },
      'swot_analysis': { primary: ALL_AGENTS, secondary: [] },
      'market_analysis': { primary: ['commercial', 'research'], secondary: ['clinical', 'financial'] },
      'competitive_analysis': { primary: ['commercial', 'research'], secondary: ['ip'] },
      'technology_assessment': { primary: ['research', 'ip'], secondary: ['clinical'] },
      'product_analysis': { primary: ['clinical', 'commercial', 'research'], secondary: [] },
      'business_model': { primary: ['commercial', 'financial'], secondary: ['research'] },
      'commercial_strategy': { primary: ['commercial'], secondary: ['research', 'financial'] },
      'team_assessment': { primary: ['hr'], secondary: ['research', 'financial'] },
      'management_analysis': { primary: ['hr'], secondary: ['research', 'legal'] },
      'financial_analysis': { primary: ['financial'], secondary: ['commercial', 'legal'] },
      'financial_projections': { primary: ['financial'], secondary: ['commercial'] },
      'valuation_analysis': { primary: ['financial'], secondary: ['commercial'] },
      'legal_assessment': { primary: ['legal', 'ip'], secondary: ['clinical'] },
      'regulatory_analysis': { primary: ['legal', 'clinical'], secondary: ['research'] },
      'clinical_assessment': { primary: ['clinical', 'research'], secondary: [] },
      'ip_analysis': { primary: ['ip', 'legal'], secondary: ['research'] },
      'research_insights': { primary: ['research'], secondary: ['clinical', 'ip'] },
      'risk_assessment': { primary: ALL_AGENTS, secondary: [] },
      'mitigation_strategies': { primary: ['legal', 'clinical', 'commercial', 'financial'], secondary: ['ip', 'research'] },
      'investment_terms': { primary: ['legal', 'financial'], secondary: ['commercial'] },
      'exit_strategy': { primary: ['financial', 'commercial'], secondary: ['research'] },
      'recommendation': { primary: ALL_AGENTS, secondary: [] }
    };
    
    // Get config for this section (or try snake_case)
    let config = sectionConfig[sectionType];
    if (!config) {
      const snakeCase = sectionType.replace(/([A-Z])/g, '_$1').toLowerCase();
      config = sectionConfig[snakeCase];
    }
    
    // Default to all primary agents if no config found
    if (!config) {
      console.log(`⚠️ No config for section "${sectionType}", using all agents as primary`);
      config = { primary: ALL_AGENTS, secondary: [] };
    }
    
    const facts: AgentFact[] = [];
    
    // Collect ALL facts from PRIMARY agents
    for (const agentType of config.primary) {
      const agentFacts = factMatrix.factsByAgent[agentType] || [];
      facts.push(...agentFacts);
    }
    
    // Collect only HIGH-CONFIDENCE facts with quantitative data from SECONDARY agents
    for (const agentType of config.secondary) {
      const agentFacts = factMatrix.factsByAgent[agentType] || [];
      // STRICT: Secondary agents must have high confidence AND quantitative data
      const qualifiedFacts = agentFacts.filter(f => 
        f.confidence === 'high' && 
        f.quantitativeData && 
        f.quantitativeData.length >= 1 &&
        f.category !== 'summary' // Exclude summary blocks from secondary agents
      );
      facts.push(...qualifiedFacts);
    }
    
    // 🎯 DEDUPLICATION: Remove overlapping facts based on content similarity
    const deduplicatedFacts = this.deduplicateFacts(facts);
    
    // 🎯 SECTION-SPECIFIC RELEVANCE SCORING with category alignment
    const sectionKeywords = this.getSectionKeywords(sectionType);
    const scoredFacts = deduplicatedFacts.map(fact => ({
      fact,
      score: this.calculateFactRelevanceScore(fact, sectionKeywords)
    }));
    
    // Sort by relevance score (highest first)
    scoredFacts.sort((a, b) => b.score - a.score);
    
    // 🎯 EVIDENCE BUDGET: Increased to 120 facts per section for maximum detail
    const MAX_FACTS_PER_SECTION = 120;
    const budgetedFacts = scoredFacts.slice(0, MAX_FACTS_PER_SECTION).map(sf => sf.fact);
    
    console.log(`📊 getFactsForSection("${sectionType}"): ${budgetedFacts.length}/${facts.length} facts after dedup+ranking (primary: ${config.primary.join(',')}, secondary: ${config.secondary.join(',')})`);
    
    return budgetedFacts;
  }
  
  /**
   * Deduplicate facts based on content similarity
   */
  private deduplicateFacts(facts: AgentFact[]): AgentFact[] {
    const seen = new Map<string, AgentFact>();
    
    for (const fact of facts) {
      // Create a simple signature from first 200 chars of content
      const signature = fact.fact.substring(0, 200).toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Keep the fact with higher confidence or more metrics
      if (!seen.has(signature)) {
        seen.set(signature, fact);
      } else {
        const existing = seen.get(signature)!;
        const existingScore = (existing.confidence === 'high' ? 2 : 1) + (existing.quantitativeData?.length || 0);
        const newScore = (fact.confidence === 'high' ? 2 : 1) + (fact.quantitativeData?.length || 0);
        if (newScore > existingScore) {
          seen.set(signature, fact);
        }
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Get section-specific keywords for relevance scoring
   */
  private getSectionKeywords(sectionType: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'financialAnalysis': ['revenue', 'funding', 'valuation', 'burn', 'margin', 'profit', 'loss', 'cap table', 'runway'],
      'financial_analysis': ['revenue', 'funding', 'valuation', 'burn', 'margin', 'profit', 'loss', 'cap table', 'runway'],
      'teamAssessment': ['ceo', 'cto', 'founder', 'team', 'experience', 'background', 'advisor', 'board'],
      'team_assessment': ['ceo', 'cto', 'founder', 'team', 'experience', 'background', 'advisor', 'board'],
      'marketAnalysis': ['market', 'tam', 'sam', 'som', 'growth', 'customer', 'segment', 'addressable'],
      'market_analysis': ['market', 'tam', 'sam', 'som', 'growth', 'customer', 'segment', 'addressable'],
      'clinicalEvidence': ['clinical', 'trial', 'fda', 'study', 'patient', 'outcome', 'efficacy', 'safety'],
      'clinical_assessment': ['clinical', 'trial', 'fda', 'study', 'patient', 'outcome', 'efficacy', 'safety'],
      'intellectualProperty': ['patent', 'trademark', 'ip', 'license', 'intellectual', 'proprietary'],
      'ip_analysis': ['patent', 'trademark', 'ip', 'license', 'intellectual', 'proprietary'],
      'regulatoryPathway': ['fda', 'regulatory', 'approval', 'clearance', 'submission', 'pathway'],
      'regulatory_analysis': ['fda', 'regulatory', 'approval', 'clearance', 'submission', 'pathway'],
      'riskAnalysis': ['risk', 'threat', 'concern', 'challenge', 'weakness', 'vulnerability'],
      'risk_assessment': ['risk', 'threat', 'concern', 'challenge', 'weakness', 'vulnerability'],
      'competitiveAnalysis': ['competitor', 'competitive', 'market share', 'differentiation', 'advantage'],
      'competitive_analysis': ['competitor', 'competitive', 'market share', 'differentiation', 'advantage']
    };
    return keywordMap[sectionType] || [];
  }
  
  /**
   * Calculate relevance score for a fact based on section keywords and quality
   */
  private calculateFactRelevanceScore(fact: AgentFact, keywords: string[]): number {
    let score = 0;
    
    // Base score from confidence
    const confidenceScore = { high: 30, medium: 15, low: 5 };
    score += confidenceScore[fact.confidence] || 0;
    
    // Bonus for quantitative data (critical for memo quality)
    const metricCount = fact.quantitativeData?.length || 0;
    score += metricCount * 10; // Each metric adds 10 points
    
    // Keyword alignment bonus
    const factLower = fact.fact.toLowerCase();
    let keywordMatches = 0;
    for (const keyword of keywords) {
      if (factLower.includes(keyword)) {
        keywordMatches++;
      }
    }
    score += keywordMatches * 5; // Each keyword match adds 5 points
    
    // Penalize very long facts (likely noise) and very short facts (likely useless)
    if (fact.fact.length > 10000) score -= 20;
    if (fact.fact.length < 50) score -= 15;
    
    // Penalize summary category (prefer structured Q&A answers)
    if (fact.category === 'summary') score -= 10;
    
    return score;
  }

  /**
   * Format facts for prompt injection
   * 🚀 ENHANCED: Increased default limit and comprehensive logging
   */
  formatFactsForPrompt(facts: AgentFact[], maxLength: number = 120000): string {
    if (facts.length === 0) {
      console.log(`⚠️ formatFactsForPrompt: No facts to format!`);
      return 'No agent analysis facts available.';
    }

    // 🚀 DEBUG: Log input statistics
    const agentBreakdown: Record<string, number> = {};
    facts.forEach(f => {
      agentBreakdown[f.agentType] = (agentBreakdown[f.agentType] || 0) + 1;
    });
    console.log(`📊 formatFactsForPrompt: Formatting ${facts.length} facts (max ${maxLength} chars)`);
    console.log(`   Agent breakdown: ${Object.entries(agentBreakdown).map(([k, v]) => `${k}:${v}`).join(', ')}`);

    // Sort by confidence (high first) and length (longer = more detailed)
    const sortedFacts = [...facts].sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
        return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
      }
      return b.fact.length - a.fact.length;
    });

    let output = '=== STRUCTURED AGENT ANALYSIS FACTS FROM ALL 7 AGENTS ===\n\n';
    let currentLength = output.length;
    let includedFacts = 0;
    let truncatedFacts = 0;

    for (const fact of sortedFacts) {
      const factBlock = `
${fact.citation}
Category: ${fact.category}
Confidence: ${fact.confidence.toUpperCase()}
${fact.quantitativeData ? `Quantitative Data: ${fact.quantitativeData.map(m => `${m.value} (${m.context})`).join(', ')}` : ''}

${fact.fact}

---
`;
      
      if (currentLength + factBlock.length > maxLength) {
        truncatedFacts++;
        continue; // 🚀 CHANGED: Continue counting truncated facts
      }
      
      output += factBlock;
      currentLength += factBlock.length;
      includedFacts++;
    }

    // 🚀 ENHANCED: Log output statistics
    console.log(`   Output: ${includedFacts} facts included (${currentLength.toLocaleString()} chars), ${truncatedFacts} truncated due to limit`);
    if (truncatedFacts > 0) {
      console.log(`   ⚠️ ${truncatedFacts} facts were truncated - consider increasing maxLength for more comprehensive data`);
    }

    return output;
  }

  /**
   * Get key metrics summary for quick reference
   */
  getKeyMetricsSummary(factMatrix: AgentFactMatrix): string {
    const metrics = factMatrix.quantitativeMetrics;
    
    if (metrics.length === 0) {
      return 'No quantitative metrics extracted from agent analyses.';
    }

    const summary: string[] = ['=== KEY QUANTITATIVE METRICS ===\n'];

    // Group by type
    const byType: Record<string, QuantitativeMetric[]> = {};
    for (const metric of metrics) {
      if (!byType[metric.type]) byType[metric.type] = [];
      byType[metric.type].push(metric);
    }

    for (const [type, typeMetrics] of Object.entries(byType)) {
      summary.push(`\n${type.toUpperCase()} METRICS:`);
      for (const metric of typeMetrics.slice(0, 10)) { // Limit to top 10 per type
        summary.push(`- ${metric.value}: ${metric.context}`);
      }
    }

    return summary.join('\n');
  }

  /**
   * Get findings and recommendations summary
   */
  getFindingsAndRecommendationsSummary(factMatrix: AgentFactMatrix): string {
    const output: string[] = ['=== KEY FINDINGS & RECOMMENDATIONS ===\n'];

    // Critical findings first
    const criticalFindings = factMatrix.keyFindings.filter(f => f.severity === 'critical');
    if (criticalFindings.length > 0) {
      output.push('\nCRITICAL FINDINGS:');
      for (const finding of criticalFindings) {
        output.push(`- ${finding.citation}: ${finding.finding}`);
      }
    }

    // Important findings
    const importantFindings = factMatrix.keyFindings.filter(f => f.severity === 'important');
    if (importantFindings.length > 0) {
      output.push('\nIMPORTANT FINDINGS:');
      for (const finding of importantFindings.slice(0, 10)) {
        output.push(`- ${finding.citation}: ${finding.finding}`);
      }
    }

    // High priority recommendations
    const highPriorityRecs = factMatrix.recommendations.filter(r => r.priority === 'high');
    if (highPriorityRecs.length > 0) {
      output.push('\nHIGH PRIORITY RECOMMENDATIONS:');
      for (const rec of highPriorityRecs) {
        output.push(`- ${rec.citation}: ${rec.recommendation}`);
      }
    }

    return output.join('\n');
  }

  /**
   * Format evidence for memo synthesis with structured data ready for Claude
   */
  formatEvidenceForMemoSection(
    evidence: any[],
    sectionName: string
  ): string {
    if (!evidence || evidence.length === 0) {
      return `[NO QUANTITATIVE DATA AVAILABLE FOR ${sectionName.toUpperCase()}]`;
    }

    const output: string[] = [`=== VERIFIED DATA FOR ${sectionName.toUpperCase()} ===\n`];

    // Group by type
    const byType: Record<string, any[]> = {};
    for (const item of evidence) {
      const type = item.metricType || 'other';
      if (!byType[type]) byType[type] = [];
      byType[type].push(item);
    }

    // Currency metrics first (most important for investors)
    if (byType['currency']?.length) {
      output.push('\n💰 FINANCIAL FIGURES:');
      for (const m of byType['currency']) {
        output.push(`- ${m.metricValue}${m.period ? ` (${m.period})` : ''}: "${m.context}" ${m.citation}`);
      }
    }

    // Percentages
    if (byType['percentage']?.length) {
      output.push('\n📊 PERCENTAGES:');
      for (const m of byType['percentage']) {
        output.push(`- ${m.metricValue}${m.period ? ` (${m.period})` : ''}: "${m.context}" ${m.citation}`);
      }
    }

    // Counts
    if (byType['count']?.length) {
      output.push('\n📈 QUANTITIES:');
      for (const m of byType['count']) {
        output.push(`- ${m.metricValue}: "${m.context}" ${m.citation}`);
      }
    }

    // Dates
    if (byType['date']?.length) {
      output.push('\n📅 KEY DATES:');
      for (const m of byType['date']) {
        output.push(`- ${m.metricValue}: "${m.context}" ${m.citation}`);
      }
    }

    // Durations
    if (byType['duration']?.length) {
      output.push('\n⏱️ TIMEFRAMES:');
      for (const m of byType['duration']) {
        output.push(`- ${m.metricValue}: "${m.context}" ${m.citation}`);
      }
    }

    // Ratios
    if (byType['ratio']?.length) {
      output.push('\n🔢 RATIOS/MULTIPLES:');
      for (const m of byType['ratio']) {
        output.push(`- ${m.metricValue}: "${m.context}" ${m.citation}`);
      }
    }

    output.push(`\n[Total: ${evidence.length} verified data points for ${sectionName}]`);
    return output.join('\n');
  }

  /**
   * Check if enough evidence exists for a quality memo section
   */
  assessEvidenceReadiness(
    evidence: any[],
    requiredMetricCount: number = 5,
    requiredHighConfidenceCount: number = 2
  ): {
    isReady: boolean;
    totalMetrics: number;
    highConfidenceMetrics: number;
    missingTypes: string[];
    recommendation: string;
  } {
    const highConfidence = evidence.filter(e => e.confidence === 'high');
    const types = new Set(evidence.map(e => e.metricType));
    
    const essentialTypes = ['currency', 'percentage', 'count'];
    const missingTypes = essentialTypes.filter(t => !types.has(t));

    const isReady = evidence.length >= requiredMetricCount && 
                    highConfidence.length >= requiredHighConfidenceCount;

    let recommendation = '';
    if (!isReady) {
      if (evidence.length < requiredMetricCount) {
        recommendation = `Need ${requiredMetricCount - evidence.length} more data points. `;
      }
      if (highConfidence.length < requiredHighConfidenceCount) {
        recommendation += `Need ${requiredHighConfidenceCount - highConfidence.length} more high-confidence metrics.`;
      }
      if (missingTypes.length > 0) {
        recommendation += ` Missing metric types: ${missingTypes.join(', ')}.`;
      }
    } else {
      recommendation = 'Evidence is sufficient for quality memo generation.';
    }

    return {
      isReady,
      totalMetrics: evidence.length,
      highConfidenceMetrics: highConfidence.length,
      missingTypes,
      recommendation
    };
  }
}

export const agentDataFusionService = AgentDataFusionService.getInstance();
