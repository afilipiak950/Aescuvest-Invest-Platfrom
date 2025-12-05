/**
 * Claude Opus Memo Synthesis Service
 * 
 * Uses Claude 4 Opus for high-quality investment memo section generation
 * with deep agent integration, structured fact injection, and quality validation.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentFactMatrix, AgentFact, agentDataFusionService } from './agentDataFusion';

const anthropic = new Anthropic();

export interface SectionGenerationRequest {
  sectionType: string;
  sectionTitle: string;
  companyName: string;
  factMatrix: AgentFactMatrix;
  ocrContext: string;
  companyResearch?: any;
  aiEvaluation?: any;
  maxTokens?: number;
}

export interface SectionGenerationResult {
  content: string;
  qualityScore: number;
  citationsUsed: string[];
  quantitativeDataPoints: number;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export interface MemoQualityMetrics {
  overallScore: number;
  sectionScores: Record<string, number>;
  totalCitations: number;
  totalQuantitativeDataPoints: number;
  placeholderCount: number;
  weakSections: string[];
  recommendations: string[];
}

export class ClaudeOpusMemoSynthesis {
  private static instance: ClaudeOpusMemoSynthesis;

  static getInstance(): ClaudeOpusMemoSynthesis {
    if (!ClaudeOpusMemoSynthesis.instance) {
      ClaudeOpusMemoSynthesis.instance = new ClaudeOpusMemoSynthesis();
    }
    return ClaudeOpusMemoSynthesis.instance;
  }

  /**
   * Generate a memo section using Claude Opus with full agent integration
   * Now with PREMIUM GENERATION: aggressive prompting + mandatory quality pass
   */
  async generateSection(request: SectionGenerationRequest): Promise<SectionGenerationResult> {
    console.log(`🧠 Generating ${request.sectionTitle} with Claude Opus 4 (PREMIUM MODE)...`);
    
    // Get relevant facts for this section
    const relevantFacts = agentDataFusionService.getFactsForSection(
      request.factMatrix, 
      request.sectionType
    );
    
    // ENHANCED: Increase fact context limit for richer content
    const formattedFacts = agentDataFusionService.formatFactsForPrompt(relevantFacts, 60000);
    
    // Get key metrics summary
    const metricsSummary = agentDataFusionService.getKeyMetricsSummary(request.factMatrix);
    
    // Get findings and recommendations
    const findingsSummary = agentDataFusionService.getFindingsAndRecommendationsSummary(request.factMatrix);
    
    // ENHANCED: Build premium system prompt with excellence requirements
    const systemPrompt = this.buildPremiumSystemPrompt(request.sectionType);
    const userPrompt = this.buildPremiumUserPrompt(request, formattedFacts, metricsSummary, findingsSummary);
    
    try {
      // FIRST PASS: Generate with high expectations
      const response = await anthropic.messages.create({
        model: "claude-opus-4-20250514",
        max_tokens: request.maxTokens || 6000, // Increased from 4000
        temperature: 0.3, // Slightly higher for richer content
        messages: [{
          role: "user",
          content: userPrompt
        }],
        system: systemPrompt
      });

      const content = response.content[0];
      let generatedContent = content.type === 'text' ? content.text : '';
      
      // Analyze the generated content quality
      let qualityAnalysis = this.analyzeContentQuality(generatedContent, relevantFacts);
      
      console.log(`📊 First pass: ${request.sectionTitle} - Quality: ${qualityAnalysis.qualityScore}/100`);
      
      // MANDATORY QUALITY ENHANCEMENT: If score < 75, automatically enhance
      if (qualityAnalysis.qualityScore < 75) {
        console.log(`🔄 Auto-enhancing ${request.sectionTitle} (score below 75)...`);
        
        const enhancementResult = await this.enhanceSection(
          request, 
          generatedContent, 
          qualityAnalysis,
          formattedFacts,
          metricsSummary
        );
        
        generatedContent = enhancementResult.content;
        qualityAnalysis = this.analyzeContentQuality(generatedContent, relevantFacts);
        console.log(`✅ Enhanced: ${request.sectionTitle} - Quality: ${qualityAnalysis.qualityScore}/100`);
      }
      
      console.log(`✅ ${request.sectionTitle} COMPLETE - Quality: ${qualityAnalysis.qualityScore}/100, Citations: ${qualityAnalysis.citationsUsed.length}, Data Points: ${qualityAnalysis.quantitativeDataPoints}`);
      
      return {
        content: generatedContent,
        ...qualityAnalysis
      };
      
    } catch (error) {
      console.error(`❌ Error generating ${request.sectionTitle}:`, error);
      throw error;
    }
  }

  /**
   * Automatically enhance a section that didn't meet quality threshold
   */
  private async enhanceSection(
    request: SectionGenerationRequest,
    previousContent: string,
    previousAnalysis: { qualityScore: number; warnings: string[]; citationsUsed: string[]; quantitativeDataPoints: number },
    formattedFacts: string,
    metricsSummary: string
  ): Promise<{ content: string }> {
    
    const enhancementPrompt = `You are enhancing an investment memo section that needs improvement.

PREVIOUS CONTENT (Score: ${previousAnalysis.qualityScore}/100):
${previousContent.substring(0, 3000)}

ISSUES IDENTIFIED:
${previousAnalysis.warnings.join('\n')}
- Citations found: ${previousAnalysis.citationsUsed.length} (need 8+)
- Quantitative data points: ${previousAnalysis.quantitativeDataPoints} (need 10+)

=== ALL AVAILABLE SOURCE DATA ===
${formattedFacts}

${metricsSummary}

=== ENHANCEMENT REQUIREMENTS ===
You MUST significantly improve this section by:

1. **ADD SPECIFIC DATA**: Extract every number, percentage, date, and amount from the source data
   - Financial figures: revenue, funding, valuation, burn rate, margins
   - Timeline dates: founding, funding rounds, regulatory submissions
   - Metrics: customer counts, employee numbers, market sizes
   
2. **ADD CITATIONS**: Use [AGENT Agent - Category] format after EVERY claim
   - Example: "The company raised $15M in Series A [Financial Agent - Funding]"
   - Every paragraph needs 2-3 citations minimum
   
3. **NAME SPECIFIC ENTITIES**: 
   - People: CEO name, CTO name, board members, advisors
   - Companies: investors, partners, customers, competitors
   - Products: product names, patent numbers, trademark names

4. **REMOVE GENERIC STATEMENTS**: Replace vague claims with specific evidence
   - BAD: "The company has strong traction"
   - GOOD: "The company achieved $2.5M ARR with 47 enterprise customers as of Q3 2024 [Commercial Agent - Traction]"

5. **STRUCTURE PROFESSIONALLY**: 
   - Use tables for financial data and comparisons
   - Use bullet points for key findings
   - Bold the most important metrics

Generate the ENHANCED version now. It must score 80+ on quality:`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 8000,
      temperature: 0.25,
      messages: [{
        role: "user",
        content: enhancementPrompt
      }],
      system: `You are a senior investment analyst at a top-tier VC firm. Your job is to enhance investment memo sections to institutional quality. Every sentence must have specific data and proper citations. No generic statements allowed.`
    });

    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : previousContent
    };
  }

  /**
   * Build PREMIUM system prompt with excellence requirements
   */
  private buildPremiumSystemPrompt(sectionType: string): string {
    const excellenceRequirements = `You are a SENIOR PARTNER at a top-tier venture capital firm (Sequoia, a16z, Benchmark tier). You are writing THE MOST CRITICAL investment memo section that will determine a multi-million dollar investment decision.

EXCELLENCE STANDARDS - YOUR CONTENT MUST:
1. READ LIKE A GOLDMAN SACHS OR MORGAN STANLEY RESEARCH REPORT
2. CONTAIN ZERO GENERIC STATEMENTS - Every sentence has specific data
3. CITE EVERY CLAIM using [AGENT Agent - Category] format
4. INCLUDE 15+ QUANTITATIVE DATA POINTS minimum per section
5. NAME SPECIFIC PEOPLE, COMPANIES, AND PRODUCTS - no "the company" or "management"
6. USE PROFESSIONAL TABLES for any comparative or financial data
7. STRUCTURE WITH CLEAR HEADERS and executive-friendly formatting

FORBIDDEN - NEVER DO THESE:
- "The company has experienced growth" → MUST specify: "$X to $Y (Z% growth)"
- "Strong management team" → MUST name: "CEO John Smith (ex-Google VP, 15yr experience)"
- "Large market opportunity" → MUST quantify: "$45B TAM growing 23% CAGR"
- Generic risk statements → MUST be specific with probability assessments
- Missing citations → EVERY paragraph needs [Agent - Category] citations

QUALITY THRESHOLD: Your content must score 85+ on quality metrics or it will be rejected.

FORMAT REQUIREMENTS:
- Use markdown with ## headers for subsections
- **Bold** all key metrics and names
- Use tables for: funding history, financial projections, competitive comparison
- Use bullet points for: key findings, risks, recommendations
- Each major claim needs inline citation`;

    // Get base section-specific instructions
    const basePrompt = this.buildSystemPrompt(sectionType);
    
    return excellenceRequirements + '\n\n' + basePrompt;
  }

  /**
   * Build PREMIUM user prompt with comprehensive data extraction
   */
  private buildPremiumUserPrompt(
    request: SectionGenerationRequest,
    formattedFacts: string,
    metricsSummary: string,
    findingsSummary: string
  ): string {
    let prompt = `GENERATE INSTITUTIONAL-QUALITY ${request.sectionTitle.toUpperCase()} FOR: ${request.companyName}

=== COMPLETE AGENT ANALYSIS DATA (EXTRACT ALL SPECIFIC DETAILS) ===
${formattedFacts}

=== KEY METRICS SUMMARY (USE ALL OF THESE) ===
${metricsSummary}

=== FINDINGS & RECOMMENDATIONS (INCORPORATE ALL) ===
${findingsSummary}
`;

    // Add company research with emphasis
    if (request.companyResearch) {
      const researchStr = JSON.stringify(request.companyResearch, null, 2);
      prompt += `
=== VERIFIED COMPANY RESEARCH (HIGH PRIORITY DATA) ===
${researchStr.substring(0, 25000)}
`;
    }

    // Add AI evaluation
    if (request.aiEvaluation) {
      const evalStr = JSON.stringify(request.aiEvaluation, null, 2);
      prompt += `
=== AI EVALUATION RESULTS ===
${evalStr.substring(0, 15000)}
`;
    }

    // Add OCR context with higher limit
    if (request.ocrContext && request.ocrContext.length > 100) {
      prompt += `
=== DOCUMENT CONTENT (SOURCE FOR SPECIFIC DATA) ===
${request.ocrContext.substring(0, 80000)}
`;
    }

    prompt += `
=== GENERATION REQUIREMENTS ===

You MUST extract and include from the data above:

📊 QUANTITATIVE DATA (minimum 15 data points):
- All dollar amounts (funding, revenue, valuation, burn rate)
- All percentages (growth rates, margins, market share)
- All dates (founding, funding rounds, milestones, regulatory dates)
- All counts (employees, customers, patents, products)

👤 SPECIFIC NAMES (minimum 5):
- Executive names with titles and backgrounds
- Investor names and firms
- Customer/partner company names
- Competitor names
- Product/technology names

📝 CITATIONS (minimum 8):
- Every major claim needs [AGENT Agent - Category] citation
- Financial data: [Financial Agent - ...]
- Team info: [HR Agent - ...]
- Legal/IP: [Legal Agent - ...] or [IP Agent - ...]
- Market data: [Commercial Agent - ...] or [Research Agent - ...]
- Clinical/regulatory: [Clinical Agent - ...]

📋 PROFESSIONAL FORMATTING:
- Use tables for financial data, funding history, comparisons
- Use bullet points for key findings
- Bold critical numbers and names
- Clear ## section headers

NOW GENERATE THE COMPLETE ${request.sectionTitle.toUpperCase()} SECTION:`;

    return prompt;
  }

  /**
   * Build section-specific system prompt
   */
  private buildSystemPrompt(sectionType: string): string {
    const baseInstructions = `You are a senior investment analyst at a top-tier venture capital firm. You are writing a comprehensive investment memorandum section that will be reviewed by partners and investment committee members.

CRITICAL REQUIREMENTS:
1. USE ONLY AUTHENTIC DATA from the provided agent analyses, documents, and research
2. CITE YOUR SOURCES using the provided citation format [AGENT Agent - Category]
3. INCLUDE SPECIFIC QUANTITATIVE DATA: exact numbers, percentages, dates, amounts
4. NEVER fabricate names, numbers, or facts - if data is not available, state "Not found in available documentation"
5. Write in professional investment memo language with clear structure
6. Each paragraph should contain at least one specific data point with citation
7. Avoid generic statements - every claim must be supported by evidence

FORMAT REQUIREMENTS:
- Use markdown formatting with clear headers
- Include bullet points for key findings
- Present financial data in tabular format when appropriate
- Use bold for critical metrics and findings
- Include specific citations after each major claim`;

    const sectionSpecificInstructions: Record<string, string> = {
      'executive_summary': `
SECTION: EXECUTIVE SUMMARY (2-3 pages)

Generate a comprehensive executive summary that covers:
1. **Company Overview**: Founding date, headquarters, incorporation, key executives (with names)
2. **Investment Thesis**: Why this is a compelling opportunity with specific evidence
3. **Technology/Product**: Core differentiation with technical specifications
4. **Market Opportunity**: TAM/SAM/SOM with specific numbers from documents
5. **Traction**: Customers, revenue, partnerships with names and metrics
6. **Team**: Key executives with backgrounds and prior experience
7. **Financials**: Current stage, funding history, valuation, use of proceeds
8. **Investment Terms**: Deal structure, board rights, liquidation preferences
9. **Risks & Mitigants**: Top 3-5 risks with mitigation strategies

PRIORITY DATA SOURCES:
- HR Agent: Executive team names and backgrounds
- Financial Agent: Funding, valuation, projections
- Commercial Agent: Market sizing, customer traction
- Legal Agent: Corporate structure, deal terms
- Clinical Agent: Regulatory status (if applicable)`,

      'financial_analysis': `
SECTION: FINANCIAL ANALYSIS (4-5 pages)

Generate detailed financial analysis covering:
1. **Current Financial Position**: Revenue, expenses, cash position
2. **Historical Performance**: Revenue growth, margin trends, burn rate
3. **Funding History**: All funding rounds with amounts, investors, valuations
4. **Cap Table Analysis**: Ownership structure, option pool, dilution
5. **Financial Projections**: 3-5 year forecasts with assumptions
6. **Unit Economics**: CAC, LTV, payback period, gross margins
7. **Use of Proceeds**: Detailed breakdown of how funds will be deployed
8. **Path to Profitability**: Timeline and key milestones

PRIORITY DATA SOURCES:
- Financial Agent: All financial Q&A answers
- Document OCR: Financial statements, cap tables, projections
- Company Research: Verified financial data

REQUIRED TABLES:
- Funding history table (Round, Date, Amount, Lead Investor, Valuation)
- Financial projections table (Year, Revenue, Expenses, Net Income)
- Use of proceeds table (Category, Amount, Percentage)`,

      'team_assessment': `
SECTION: TEAM ASSESSMENT (2-3 pages)

Generate comprehensive team assessment covering:
1. **Executive Team**: Full profiles of CEO, CTO, CFO, COO with:
   - Name and title
   - Educational background
   - Prior company experience (with specific companies)
   - Relevant domain expertise
   - Years of experience
2. **Key Technical Staff**: Lead scientists, engineers, developers
3. **Advisory Board**: Names, affiliations, areas of expertise
4. **Board of Directors**: Composition and governance
5. **Organizational Structure**: Headcount, departments, hiring plans
6. **Team Gaps**: Areas needing additional talent

PRIORITY DATA SOURCES:
- HR Agent: All team-related Q&A answers
- Legal Agent: Governance, board composition
- Document OCR: LinkedIn profiles, bios, organizational charts`,

      'legal_assessment': `
SECTION: LEGAL ASSESSMENT (2-3 pages)

Generate comprehensive legal analysis covering:
1. **Corporate Structure**: Entity type, jurisdiction, subsidiaries
2. **Intellectual Property**: Patents (numbers, status), trademarks, trade secrets
3. **Regulatory Compliance**: Approvals, certifications, pending applications
4. **Material Contracts**: Key customer, supplier, partnership agreements
5. **Employment Matters**: Key employee agreements, equity plans, non-competes
6. **Litigation**: Current or threatened legal matters
7. **Governance**: Board structure, voting rights, protective provisions

PRIORITY DATA SOURCES:
- Legal Agent: All legal Q&A answers
- IP Agent: Patent and trademark details
- Document OCR: Articles, contracts, regulatory filings`,

      'market_analysis': `
SECTION: MARKET ANALYSIS (3-4 pages)

Generate comprehensive market analysis covering:
1. **Market Overview**: Industry dynamics, growth drivers, trends
2. **TAM/SAM/SOM Analysis**: 
   - Total Addressable Market with methodology and sources
   - Serviceable Addressable Market segmentation
   - Serviceable Obtainable Market with realistic capture assumptions
3. **Market Timing**: Why now? Regulatory, technology, demand factors
4. **Customer Segments**: Target customers with specific characteristics
5. **Competitive Landscape**: Key competitors, market positioning, differentiation
6. **Barriers to Entry**: Moats, switching costs, network effects
7. **Market Risks**: Regulatory, competitive, technology disruption

PRIORITY DATA SOURCES:
- Commercial Agent: All market-related Q&A answers
- Research Agent: Technology trends, market research
- Document OCR: Market studies, industry reports`,

      'risk_assessment': `
SECTION: RISK ASSESSMENT (2-3 pages)

Generate comprehensive risk assessment covering:
1. **Technology Risks**: Development challenges, technical debt, scalability
2. **Market Risks**: Competition, adoption, pricing pressure
3. **Regulatory Risks**: Approval timelines, compliance requirements, changes
4. **Financial Risks**: Funding requirements, burn rate, revenue uncertainty
5. **Team Risks**: Key person dependencies, hiring challenges
6. **Legal/IP Risks**: Patent challenges, litigation exposure
7. **Operational Risks**: Supply chain, infrastructure, execution

For each risk category:
- Specific risk identification with evidence
- Probability assessment (High/Medium/Low)
- Impact assessment (High/Medium/Low)
- Mitigation strategies

PRIORITY DATA SOURCES:
- All 7 agents: Extract risk-related findings
- Key findings marked as "critical" or "important"
- Recommendations from all agents`,

      'recommendation': `
SECTION: INVESTMENT RECOMMENDATION (2-3 pages)

Generate the final investment recommendation covering:
1. **Investment Decision**: Clear INVEST/PASS/INVESTIGATE recommendation
2. **Investment Rationale**: Key factors supporting the decision (5-7 points)
3. **Key Milestones**: Critical value inflection points (with timeline)
4. **Deal Terms Assessment**: Valuation reasonableness, investor protections
5. **Exit Analysis**: Potential acquirers, IPO path, expected returns
6. **Conditions to Close**: Required due diligence, documentation needs
7. **Post-Investment Monitoring**: KPIs to track, board involvement

PRIORITY DATA SOURCES:
- All 7 agents: Synthesize findings and recommendations
- AI Evaluation: Scoring and assessment results
- Financial Agent: Returns analysis, exit multiples`
    };

    return baseInstructions + (sectionSpecificInstructions[sectionType] || '');
  }

  /**
   * Build user prompt with all context
   */
  private buildUserPrompt(
    request: SectionGenerationRequest,
    formattedFacts: string,
    metricsSummary: string,
    findingsSummary: string
  ): string {
    let prompt = `Generate the ${request.sectionTitle} section for the ${request.companyName} investment memorandum.

=== STRUCTURED AGENT ANALYSIS DATA ===
${formattedFacts}

${metricsSummary}

${findingsSummary}
`;

    // Add company research if available
    if (request.companyResearch) {
      prompt += `
=== COMPANY RESEARCH DATA ===
${JSON.stringify(request.companyResearch, null, 2).substring(0, 20000)}
`;
    }

    // Add AI evaluation if available
    if (request.aiEvaluation) {
      prompt += `
=== AI EVALUATION RESULTS ===
${JSON.stringify(request.aiEvaluation, null, 2).substring(0, 10000)}
`;
    }

    // Add relevant OCR context
    if (request.ocrContext && request.ocrContext.length > 100) {
      prompt += `
=== RELEVANT DOCUMENT CONTENT (OCR) ===
${request.ocrContext.substring(0, 50000)}
`;
    }

    prompt += `
IMPORTANT INSTRUCTIONS:
1. Extract and cite SPECIFIC data from the sources provided above
2. Include at least 5-10 quantitative data points (numbers, percentages, dates)
3. Name specific people, companies, and products mentioned in the documents
4. Use the citation format [AGENT Agent - Category] after each major claim
5. If key information is not found, state "Not found in available documentation" rather than fabricating
6. Structure your response with clear headers and bullet points
7. Write in professional VC investment memo style

Generate the complete ${request.sectionTitle} section now:`;

    return prompt;
  }

  /**
   * Analyze the quality of generated content
   */
  private analyzeContentQuality(content: string, facts: AgentFact[]): Omit<SectionGenerationResult, 'content'> {
    const warnings: string[] = [];
    
    // Count citations used
    const citationPattern = /\[[\w\s]+ Agent[^\]]*\]/g;
    const citationsFound = content.match(citationPattern) || [];
    const citationsUsed = Array.from(new Set(citationsFound));
    
    // Count quantitative data points
    const quantPatterns = [
      /\$[\d,]+(?:\.\d{1,2})?(?:\s*(?:million|billion|M|B|K))?/g,
      /\d+(?:\.\d+)?%/g,
      /\b\d{1,3}(?:,\d{3})+\b/g,
      /\b20\d{2}\b/g
    ];
    
    let quantitativeDataPoints = 0;
    for (const pattern of quantPatterns) {
      const matches = content.match(pattern) || [];
      quantitativeDataPoints += matches.length;
    }
    
    // Check for placeholder/generic content
    const placeholderPatterns = [
      /information not available/gi,
      /data not found/gi,
      /to be determined/gi,
      /placeholder/gi,
      /\[TBD\]/gi,
      /\[insert\]/gi,
      /analysis pending/gi,
      /not available in provided documents/gi
    ];
    
    let placeholderCount = 0;
    for (const pattern of placeholderPatterns) {
      const matches = content.match(pattern) || [];
      placeholderCount += matches.length;
    }
    
    // Check for specific names (people, companies)
    const namePattern = /(?:Dr\.|Mr\.|Ms\.|Prof\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|LLC|Ltd|Corp|GmbH)/g;
    const namesFound = content.match(namePattern) || [];
    
    // Calculate quality score
    let qualityScore = 50; // Base score
    
    // Citations boost (up to +20)
    qualityScore += Math.min(citationsUsed.length * 4, 20);
    
    // Quantitative data boost (up to +20)
    qualityScore += Math.min(quantitativeDataPoints * 2, 20);
    
    // Specific names boost (up to +10)
    qualityScore += Math.min(namesFound.length * 2, 10);
    
    // Content length factor
    if (content.length > 2000) qualityScore += 5;
    if (content.length > 4000) qualityScore += 5;
    
    // Placeholder penalty
    qualityScore -= placeholderCount * 5;
    
    // Ensure score is within bounds
    qualityScore = Math.max(0, Math.min(100, qualityScore));
    
    // Add warnings (stricter thresholds for premium quality)
    if (citationsUsed.length < 5) {
      warnings.push('Low citation count - need 5+ citations for institutional quality');
    }
    if (quantitativeDataPoints < 8) {
      warnings.push('Low quantitative data - need 8+ specific metrics');
    }
    if (placeholderCount > 1) {
      warnings.push('Contains placeholder text - all data should be specific');
    }
    if (content.length < 1500) {
      warnings.push('Section is shorter than expected for comprehensive analysis');
    }
    if (namesFound.length < 3) {
      warnings.push('Low specific entity count - need more named people/companies');
    }
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low';
    if (qualityScore >= 80) {
      confidence = 'high';
    } else if (qualityScore >= 60) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    return {
      qualityScore,
      citationsUsed,
      quantitativeDataPoints,
      confidence,
      warnings
    };
  }

  /**
   * Validate entire memo quality and identify weak sections
   */
  async validateMemoQuality(
    sections: Record<string, SectionGenerationResult>
  ): Promise<MemoQualityMetrics> {
    const sectionScores: Record<string, number> = {};
    let totalCitations = 0;
    let totalQuantitativeDataPoints = 0;
    let placeholderCount = 0;
    const weakSections: string[] = [];
    const recommendations: string[] = [];
    
    for (const [sectionName, result] of Object.entries(sections)) {
      sectionScores[sectionName] = result.qualityScore;
      totalCitations += result.citationsUsed.length;
      totalQuantitativeDataPoints += result.quantitativeDataPoints;
      
      if (result.qualityScore < 75) { // Raised from 60 for higher quality
        weakSections.push(sectionName);
        recommendations.push(`Re-generate ${sectionName} section with more specific data extraction`);
      }
      
      // Count placeholders in content
      const placeholderMatches = result.content.match(/information not available|data not found|to be determined|placeholder|\[TBD\]/gi) || [];
      placeholderCount += placeholderMatches.length;
    }
    
    // Calculate overall score
    const scores = Object.values(sectionScores);
    const overallScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    
    // Add general recommendations
    if (overallScore < 70) {
      recommendations.push('Consider running additional agent analyses before regenerating memo');
    }
    if (placeholderCount > 10) {
      recommendations.push('High placeholder count indicates missing source documents - review uploaded documentation');
    }
    if (totalCitations < 20) {
      recommendations.push('Low citation count - ensure agent analyses completed before memo generation');
    }
    
    return {
      overallScore,
      sectionScores,
      totalCitations,
      totalQuantitativeDataPoints,
      placeholderCount,
      weakSections,
      recommendations
    };
  }

  /**
   * Refine a weak section with targeted re-prompting
   */
  async refineWeakSection(
    request: SectionGenerationRequest,
    previousResult: SectionGenerationResult,
    attemptNumber: number = 1
  ): Promise<SectionGenerationResult> {
    console.log(`🔄 Refining ${request.sectionTitle} (attempt ${attemptNumber}) - Previous score: ${previousResult.qualityScore}`);
    
    // Build refinement prompt
    const refinementPrompt = `The previous generation of this section scored ${previousResult.qualityScore}/100 with these issues:
${previousResult.warnings.join('\n')}

REFINEMENT REQUIREMENTS:
1. Add MORE SPECIFIC quantitative data (numbers, percentages, dates)
2. Include MORE CITATIONS using the [AGENT Agent - Category] format
3. Name specific people, companies, and products from the documents
4. Remove or replace any placeholder/generic text
5. Expand sections that lack detail

Previous content summary:
${previousResult.content.substring(0, 500)}...

Now generate an IMPROVED version of the ${request.sectionTitle} section with higher quality and more specific data:`;
    
    // Update the request with refinement context
    const refinedRequest = {
      ...request,
      ocrContext: refinementPrompt + '\n\n' + request.ocrContext
    };
    
    return this.generateSection(refinedRequest);
  }
}

export const claudeOpusMemoSynthesis = ClaudeOpusMemoSynthesis.getInstance();
