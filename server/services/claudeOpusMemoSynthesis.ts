/**
 * Claude Opus Memo Synthesis Service
 * 
 * Uses Claude 4 Opus for high-quality investment memo section generation
 * with deep agent integration, structured fact injection, and quality validation.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AgentFactMatrix, AgentFact, agentDataFusionService } from './agentDataFusion';
import { cleanMemoSectionContent, calculateNarrativeDensity, calculateTablePercentage } from '../utils/textFormatting';

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
  narrativeDensity: number; // NEW: % of content that is prose vs bullets/tables
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
    
    // Get relevant facts for this section (primary agents + high-conf secondary)
    const relevantFacts = agentDataFusionService.getFactsForSection(
      request.factMatrix, 
      request.sectionType
    );
    
    // 🎯 EXPANDED fact context for maximum detail - 120k chars
    const formattedFacts = agentDataFusionService.formatFactsForPrompt(relevantFacts, 120000);
    
    // Get key metrics summary
    const metricsSummary = agentDataFusionService.getKeyMetricsSummary(request.factMatrix);
    
    // Get findings and recommendations
    const findingsSummary = agentDataFusionService.getFindingsAndRecommendationsSummary(request.factMatrix);
    
    // ENHANCED: Build premium system prompt with excellence requirements
    const systemPrompt = this.buildPremiumSystemPrompt(request.sectionType);
    const userPrompt = this.buildPremiumUserPrompt(request, formattedFacts, metricsSummary, findingsSummary);
    
    try {
      // FIRST PASS: Generate with high expectations - MAXIMUM DETAIL
      const response = await anthropic.messages.create({
        model: "claude-opus-4-20250514",
        max_tokens: request.maxTokens || 10000, // Increased to 10k for maximum detail
        temperature: 0.4, // Higher for richer, more creative content
        messages: [{
          role: "user",
          content: userPrompt
        }],
        system: systemPrompt
      });

      const content = response.content[0];
      let generatedContent = content.type === 'text' ? content.text : '';
      
      // Analyze the generated content quality
      let qualityAnalysis = this.analyzeContentQuality(generatedContent, relevantFacts, request.sectionType);
      
      // Calculate narrative density for enhancement decisions
      let currentNarrativeDensity = calculateNarrativeDensity(generatedContent);
      
      // Get section-specific quality requirements for adaptive thresholds
      const sectionReqs = this.getSectionQualityRequirements(request.sectionType);
      console.log(`📊 First pass: ${request.sectionTitle} - Quality: ${qualityAnalysis.qualityScore}/${sectionReqs.qualityThreshold} required, Prose: ${currentNarrativeDensity}/${sectionReqs.minProseDensity}% required`);
      
      // MULTI-PASS QUALITY IMPROVEMENT SYSTEM with SECTION-SPECIFIC THRESHOLDS
      // Pass 1: Basic enhancement if below section minimums
      // Pass 2: Critique and rewrite for institutional quality
      
      // Use section-specific thresholds instead of hard-coded values
      const pass1Threshold = Math.max(sectionReqs.qualityThreshold - 15, 70); // 10-15 below target
      const needsEnhancement = qualityAnalysis.qualityScore < pass1Threshold || currentNarrativeDensity < (sectionReqs.minProseDensity - 10);
      if (needsEnhancement) {
        const reason = currentNarrativeDensity < (sectionReqs.minProseDensity - 10)
          ? `prose too low (${currentNarrativeDensity}% < ${sectionReqs.minProseDensity}%)`
          : `score below ${pass1Threshold} (section needs ${sectionReqs.qualityThreshold})`;
        console.log(`🔄 PASS 1: Auto-enhancing ${request.sectionTitle} (${reason})...`);
        
        try {
          const enhancementResult = await this.enhanceSection(
            request, 
            generatedContent, 
            qualityAnalysis,
            formattedFacts,
            metricsSummary
          );
          
          // Only accept enhanced content if it actually improves prose density
          const enhancedDensity = calculateNarrativeDensity(enhancementResult.content);
          if (enhancedDensity >= currentNarrativeDensity) {
            generatedContent = enhancementResult.content;
            currentNarrativeDensity = enhancedDensity;
            qualityAnalysis = this.analyzeContentQuality(generatedContent, relevantFacts, request.sectionType);
            console.log(`✅ PASS 1 Complete: ${request.sectionTitle} - Quality: ${qualityAnalysis.qualityScore}/100, Prose: ${enhancedDensity}%`);
          } else {
            console.log(`⚠️ Enhancement did not improve prose density (${enhancedDensity}% vs ${currentNarrativeDensity}%), keeping original`);
          }
        } catch (enhanceError) {
          console.error(`⚠️ Enhancement failed for ${request.sectionTitle}, keeping original content:`, enhanceError);
        }
      }
      
      // PASS 2: CRITIQUE AND REWRITE for institutional quality (using section-specific threshold)
      if (qualityAnalysis.qualityScore < sectionReqs.qualityThreshold) {
        console.log(`📝 PASS 2: Critique & Rewrite for ${request.sectionTitle} (current: ${qualityAnalysis.qualityScore}/${sectionReqs.qualityThreshold} required)...`);
        
        try {
          // Get critique with specific improvement instructions
          const critique = await this.critiqueSection(request.sectionType, generatedContent, request.factMatrix);
          
          // If critique score is low enough to warrant a rewrite
          if (critique.score < 80 && critique.improvements.length > 0) {
            console.log(`🔄 Rewriting ${request.sectionTitle} based on ${critique.improvements.length} improvements...`);
            
            const rewrittenContent = await this.rewriteWithCritique(
              request,
              generatedContent,
              critique,
              formattedFacts
            );
            
            // Analyze the rewritten content
            const rewriteAnalysis = this.analyzeContentQuality(rewrittenContent, relevantFacts, request.sectionType);
            
            // Accept if quality improved
            if (rewriteAnalysis.qualityScore > qualityAnalysis.qualityScore) {
              generatedContent = rewrittenContent;
              qualityAnalysis = rewriteAnalysis;
              console.log(`✅ PASS 2 Complete: ${request.sectionTitle} - Quality: ${qualityAnalysis.qualityScore}/100`);
            } else {
              console.log(`⚠️ Rewrite did not improve quality, keeping previous version`);
            }
          } else {
            console.log(`✅ Critique passed (${critique.score}/100), skipping rewrite`);
          }
        } catch (critiqueError) {
          console.error(`⚠️ Critique/rewrite failed for ${request.sectionTitle}:`, critiqueError);
        }
      }
      
      // Clean up and normalize the content before returning
      const cleanedContent = cleanMemoSectionContent(generatedContent);
      
      // Re-analyze after cleanup to get final quality metrics including narrativeDensity
      const finalAnalysis = this.analyzeContentQuality(cleanedContent, relevantFacts, request.sectionType);
      
      console.log(`✅ ${request.sectionTitle} COMPLETE - Quality: ${finalAnalysis.qualityScore}/100, Citations: ${finalAnalysis.citationsUsed.length}, Data Points: ${finalAnalysis.quantitativeDataPoints}, Prose: ${finalAnalysis.narrativeDensity}%`);
      
      return {
        content: cleanedContent,
        ...finalAnalysis
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

=== ENHANCEMENT REQUIREMENTS - NARRATIVE FIRST ===

🚨 CRITICAL: The enhanced section must be NARRATIVE-FIRST with readable prose paragraphs.

1. **WRITE FLOWING PARAGRAPHS**: Start each subsection with 1-2 narrative paragraphs that explain and analyze the data
   - Weave data INTO sentences, don't just list it
   - Explain WHY the data matters, not just WHAT it is
   
2. **ADD SPECIFIC DATA INTO PROSE**: 
   - BAD: "Revenue: $2.5M ARR"  
   - GOOD: "The company achieved $2.5M ARR with 47 enterprise customers as of Q3 2024, representing 150% YoY growth [Commercial Agent - Traction]"
   
3. **ADD CITATIONS**: Use [AGENT Agent - Category] format after sentences
   - Every paragraph needs 2-3 citations minimum
   
4. **NAME PEOPLE & COMPANIES IN PROSE**: 
   - BAD: "Strong management team"
   - GOOD: "CEO Maria Chen, formerly VP Product at Stripe where she led the expansion into healthcare payments, has assembled a team of 35 engineers..."

5. **LIMIT TABLES & BULLETS**:
   - Tables ONLY for: funding history, financial projections, competitive matrices
   - Bullets ONLY for: final "Key Takeaways" sections
   - Minimum 60% of content must be flowing prose paragraphs

Generate the ENHANCED version now with narrative-first structure. It must score 80+ on quality:`;

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
    const enhancedText = content.type === 'text' ? content.text : previousContent;
    
    // Apply cleanup to enhanced content as well
    return {
      content: cleanMemoSectionContent(enhancedText)
    };
  }

  /**
   * MULTI-PASS CRITIQUE SYSTEM
   * Critiques generated content and provides specific improvement instructions
   */
  private async critiqueSection(
    sectionType: string,
    content: string,
    factMatrix: any
  ): Promise<{ score: number; issues: string[]; improvements: string[] }> {
    
    const critiquePrompt = `You are a senior investment committee reviewer at a top-tier VC firm.
Critique this memo section for institutional quality. Be BRUTALLY HONEST.

SECTION TYPE: ${sectionType}

CONTENT TO REVIEW:
${content.substring(0, 8000)}

=== EVALUATION RUBRIC ===

1. **SPECIFICITY (0-25 pts)**
   - Are specific people named with backgrounds?
   - Are specific companies named as customers/partners/competitors?
   - Are specific dollar amounts, percentages, dates included?
   - Deduct 5 pts for each "the company" that should name the actual company

2. **DATA DENSITY (0-25 pts)**
   - Count quantitative data points ($ amounts, %, numbers, dates)
   - 20+ data points = 25 pts
   - 15-19 = 20 pts
   - 10-14 = 15 pts
   - 5-9 = 10 pts
   - <5 = 5 pts

3. **NARRATIVE FLOW (0-25 pts)**
   - Does it read like prose, not bullet lists?
   - Are paragraphs connected with logical transitions?
   - Does it tell a compelling story?
   - Deduct 10 pts if >40% is bullets/tables

4. **CITATION QUALITY (0-25 pts)**
   - Are claims backed by [Agent - Category] citations?
   - 10+ citations = 25 pts
   - 7-9 = 20 pts
   - 4-6 = 15 pts
   - <4 = 5 pts

RESPOND IN THIS EXACT FORMAT:
SCORE: [0-100]
ISSUES:
- [issue 1]
- [issue 2]
...
IMPROVEMENTS:
- [specific improvement instruction 1]
- [specific improvement instruction 2]
...`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-20250514",
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{ role: "user", content: critiquePrompt }]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      // Parse the response
      const scoreMatch = responseText.match(/SCORE:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
      
      const issuesMatch = responseText.match(/ISSUES:\s*([\s\S]*?)(?=IMPROVEMENTS:|$)/);
      const issues = issuesMatch 
        ? issuesMatch[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
        : [];
      
      const improvementsMatch = responseText.match(/IMPROVEMENTS:\s*([\s\S]*?)$/);
      const improvements = improvementsMatch
        ? improvementsMatch[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '').trim())
        : [];

      console.log(`📝 Critique for ${sectionType}: Score ${score}/100, ${issues.length} issues, ${improvements.length} improvements`);
      
      return { score, issues, improvements };
    } catch (error) {
      console.error('Critique failed:', error);
      return { score: 70, issues: ['Critique failed'], improvements: [] };
    }
  }

  /**
   * REWRITE based on critique feedback
   */
  private async rewriteWithCritique(
    request: SectionGenerationRequest,
    originalContent: string,
    critique: { score: number; issues: string[]; improvements: string[] },
    formattedFacts: string
  ): Promise<string> {
    
    const rewritePrompt = `You are rewriting an investment memo section based on critical feedback.

ORIGINAL CONTENT (Score: ${critique.score}/100):
${originalContent.substring(0, 4000)}

=== CRITICAL ISSUES IDENTIFIED ===
${critique.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

=== REQUIRED IMPROVEMENTS ===
${critique.improvements.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

=== SOURCE DATA FOR IMPROVEMENTS ===
${formattedFacts.substring(0, 50000)}

=== REWRITE INSTRUCTIONS ===
1. Fix EVERY issue listed above
2. Implement EVERY improvement suggestion
3. Add MORE specific data points from the source data
4. Name MORE specific people, companies, products
5. Add MORE quantitative metrics with proper citations
6. Ensure narrative flow with smooth paragraph transitions
7. Target 85+ quality score

Generate the IMPROVED version now:`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 10000,
      temperature: 0.35,
      messages: [{ role: "user", content: rewritePrompt }],
      system: `You are a senior investment analyst. Rewrite sections to fix all identified issues while maintaining narrative flow. Every claim needs specific data and citations.`
    });

    const content = response.content[0];
    return content.type === 'text' ? cleanMemoSectionContent(content.text) : originalContent;
  }

  /**
   * Build PREMIUM system prompt with excellence requirements
   * NARRATIVE-FIRST: Prioritizes readable prose over tables/bullets
   */
  private buildPremiumSystemPrompt(sectionType: string): string {
    const excellenceRequirements = `You are a SENIOR PARTNER at a top-tier venture capital firm (Sequoia, a16z, Benchmark tier). You are writing THE MOST CRITICAL investment memo section that will determine a multi-million dollar investment decision.

=== WRITING STYLE: NARRATIVE-FIRST APPROACH ===

Write like a McKinsey or Goldman Sachs research report. The content must be:
- **READABLE**: Flowing narrative paragraphs that tell a compelling story
- **ANALYTICAL**: Each paragraph explains the significance of the data, not just lists it
- **PERSUASIVE**: Builds a clear investment thesis through logical argumentation

STRUCTURE EACH SECTION AS:
1. **Opening paragraph**: Set context and state the key conclusion upfront (2-3 sentences)
2. **Analysis paragraphs**: Deep-dive into the evidence with specific data woven into flowing prose
3. **Tables**: ONLY for actual tabular data (funding rounds, financial projections, comparisons)
4. **Key takeaways**: End with 3-5 bullet points summarizing critical findings

=== PROSE REQUIREMENTS ===
- Each subsection must start with 1-2 narrative paragraphs BEFORE any bullets or tables
- Write complete sentences that flow naturally - not fragmented bullet spam
- Explain WHY data matters, not just WHAT the data is
- Use transitions between paragraphs: "This positions the company...", "Building on this foundation..."
- Minimum 60% of content must be narrative prose, not bullets or tables

=== DATA INTEGRATION ===
- Weave specific numbers into sentences: "The company grew revenue from $2.1M to $8.5M (304% YoY) during 2024 [Financial Agent - Revenue]"
- Name people inline: "CEO Maria Chen, who previously led product at Stripe for 8 years, has assembled..."
- Citations go at end of sentences: [AGENT Agent - Category]
- Include 15+ quantitative data points per section

=== TABLES: USE SPARINGLY ===
Tables are ONLY appropriate for:
- Funding history (dates, amounts, investors)
- Financial projections (multi-year numbers)
- Competitive comparison matrices
- Cap table breakdowns
DO NOT use tables for: company snapshots, team bios, or information that reads better as prose

=== BULLETS: USE AT END ===
- Use bullet points ONLY for final "Key Takeaways" or "Critical Risks" summaries
- Limit to 3-7 bullets maximum per subsection
- Each bullet should be a complete thought, not a sentence fragment

FORBIDDEN PATTERNS:
- Starting with a table (always start with narrative context)
- Bullet-only sections with no prose
- Pipe table syntax for simple facts that should be in prose
- Generic statements without specific data
- "The company has..." statements - use specific names instead

QUALITY THRESHOLD: 85+ score required. Sections that are bullet-heavy with insufficient prose will be rejected.`;

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

    // 🚀 ENHANCED: Increased limits for maximum data coverage
    // Add company research with emphasis
    if (request.companyResearch) {
      const researchStr = JSON.stringify(request.companyResearch, null, 2);
      prompt += `
=== VERIFIED COMPANY RESEARCH (HIGH PRIORITY DATA) ===
${researchStr.substring(0, 40000)}
`;
    }

    // Add AI evaluation
    if (request.aiEvaluation) {
      const evalStr = JSON.stringify(request.aiEvaluation, null, 2);
      prompt += `
=== AI EVALUATION RESULTS ===
${evalStr.substring(0, 25000)}
`;
    }

    // 🎯 OCR context with balanced limit for quality vs quantity
    if (request.ocrContext && request.ocrContext.length > 100) {
      prompt += `
=== DOCUMENT CONTENT (SOURCE FOR SPECIFIC DATA) ===
${request.ocrContext.substring(0, 100000)}
`;
      console.log(`📄 OCR context included: ${Math.min(request.ocrContext.length, 100000).toLocaleString()} of ${request.ocrContext.length.toLocaleString()} characters`);
    }

    prompt += `
=== GENERATION REQUIREMENTS ===

📖 NARRATIVE-FIRST FORMAT (CRITICAL):
Write this section as a professional investment memo that tells a compelling story:
1. Start each subsection with 1-2 PARAGRAPHS of analytical prose that explain the data's significance
2. Weave quantitative data INTO sentences, don't just list it
3. Use tables ONLY for: funding history, financial projections, competitive matrices
4. End with bullet point "Key Takeaways" (3-5 bullets max)
5. Minimum 60% of content must be flowing narrative paragraphs

📊 QUANTITATIVE DATA (minimum 15 data points woven into prose):
- Dollar amounts, percentages, dates, counts - all integrated into sentences
- Example: "BAIBYS has secured $5M in Series A funding led by Rohto Pharmaceutical at a $20M pre-money valuation [Financial Agent - Funding]"

👤 SPECIFIC NAMES (integrated into narrative):
- Name executives with context: "CEO Dr. Yaron Silberman, who brings 15 years of MedTech experience from his tenure at..."
- Name investors, partners, customers within paragraphs

📝 CITATIONS:
- Place [AGENT Agent - Category] at end of sentences
- Every paragraph needs 2+ citations

🚫 AVOID THESE PATTERNS:
- Starting with a table (always narrative first)
- Bullet-only content without prose
- Tables for simple information (use prose instead)
- Sentence fragments in bullets

NOW GENERATE THE COMPLETE ${request.sectionTitle.toUpperCase()} SECTION WITH NARRATIVE-FIRST STRUCTURE:`;

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
      // CamelCase section names (new standard) - NARRATIVE-FIRST APPROACH
      'executiveSummary': `
SECTION: EXECUTIVE SUMMARY (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as an engaging NARRATIVE that tells the company's story. Start with the investment opportunity, build through evidence, and conclude with key takeaways.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Opening Investment Thesis (2 paragraphs)**
Start with a compelling narrative paragraph that captures why this is an exciting opportunity. Weave in the company name, what they do, the market size, and why now is the right time. Second paragraph should summarize the key evidence supporting the thesis.

Example opening: "BAIBYS Fertility Ltd. represents a compelling Series A opportunity in the $22B global fertility market. Founded in 2020 and headquartered in Tel Aviv, the company has developed an AI-powered sperm selection system that addresses male infertility—a factor in 30-50% of all IVF cases [Clinical Agent - Market]. With ISO 13485 certification secured and FDA De Novo submission planned for Q3 2025, BAIBYS is positioned to capture significant market share in the rapidly growing ICSI segment [Clinical Agent - Regulatory]."

**2. Company Overview (2-3 paragraphs)**
Write flowing prose about the company's history, product, and technology. Avoid tables here - use narrative.

**3. Traction & Evidence (2-3 paragraphs)**
Describe commercial progress, partnerships, and milestones in narrative form. Include specific numbers woven into sentences.

**4. Leadership (1-2 paragraphs)**
Introduce key executives by name with their backgrounds in prose form.

**5. Financial Summary (1 paragraph + 1 table)**
Brief narrative context, then ONE funding history table if available.

**6. Key Takeaways (5-7 bullets)**
END with bullet points summarizing the investment highlights.

**7. Critical Risks (3-5 bullets)**
Brief risk summary bullets at the very end.

FORBIDDEN: Starting with a table. Starting with bullets. More than 2 tables total.
REQUIRED: Minimum 60% narrative prose, 2+ citations per paragraph, 20+ data points.`,

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

      'financialAnalysis': `
SECTION: FINANCIAL ANALYSIS (4-5 pages) - NARRATIVE-FIRST, 90+ QUALITY THRESHOLD

=== WRITING APPROACH ===
Write this as an ANALYTICAL NARRATIVE that explains the company's financial position, trajectory, and investment opportunity. Lead with prose that interprets the numbers, not just lists them.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Financial Overview (2-3 paragraphs)**
Open with a narrative summary of the company's financial position. Explain the revenue trajectory, burn rate implications, and funding status in prose form. Interpret what the numbers mean for the investment.

Example: "BAIBYS Fertility demonstrates an early-stage financial profile typical of pre-commercial MedTech ventures. The company has raised $X to date and maintains a monthly burn rate of $X, providing runway through Q3 2026 [Financial Agent - Funding]. Revenue generation remains nascent as the company prioritizes regulatory clearance, though management projects $1.5M in 2025 revenue from early commercial partnerships [Financial Agent - Projections]."

**2. Funding History (1 paragraph + 1 table)**
Brief context paragraph explaining the funding strategy, THEN a funding history table.

**3. Revenue & Traction Analysis (2-3 paragraphs)**
Narrative explanation of revenue sources, customer traction, and growth trajectory. Weave specific metrics into flowing prose.

**4. Unit Economics (1-2 paragraphs + 1 optional table)**
Explain CAC, LTV, margins, and payback in narrative context. Table only if there are multiple comparable metrics.

**5. Use of Proceeds (1-2 paragraphs)**
Explain how the company plans to deploy raised capital. Narrative format preferred.

**6. Financial Projections (1 paragraph + 1 table)**
Brief context on assumptions, then a projections table for multi-year forecasts.

**7. Key Financial Takeaways (4-6 bullets)**
END with bullet summary of critical financial insights.

FORBIDDEN: Starting with tables. More than 3 tables total. Bullet-only subsections.
REQUIRED: 50%+ narrative prose, 15+ citations, 30+ data points. Every number needs a source.`,

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

      'teamAssessment': `
SECTION: TEAM ASSESSMENT (2-3 pages) - NARRATIVE-FIRST

=== CRITICAL: PROSE-FIRST REQUIREMENT ===
You MUST write 3+ narrative paragraphs BEFORE any table or bullet list. Tables are ONLY allowed as an appendix at the very end. Failing to lead with narrative prose will cause this section to be rejected.

=== WRITING APPROACH ===
Write this as a NARRATIVE PROFILE of the leadership team. Tell the story of who is running this company and why they're the right team. Lead with prose that brings executives to life, not tables.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Team Overview (2 paragraphs) - MANDATORY NARRATIVE**
Open with a narrative that introduces the leadership team and explains why they're well-suited for this opportunity. Highlight key executives by name with their most relevant credentials woven into prose.

Example: "BAIBYS is led by a complementary founding team with deep expertise in both fertility medicine and AI technology. Co-CEO Dr. Yaron Silberman brings 15 years of MedTech experience, including roles at [Company X] and an MBA from [University], providing the commercial acumen needed to navigate FDA pathways and scale the business [HR Agent - Leadership]. Co-CEO Gal Golov contributes operational expertise, having previously [background] [HR Agent - Leadership]."

**2. Executive Profiles (2-3 paragraphs) - MANDATORY NARRATIVE**
Detailed narrative profiles of key executives. Write about each leader in flowing prose - their background, why they joined, what they contribute. DO NOT use a table here.

**3. Technical Team (1-2 paragraphs) - MANDATORY NARRATIVE**
Describe the engineering/scientific team composition, key technical leaders, and relevant expertise in narrative form.

**4. Advisory Board & Governance (1-2 paragraphs)**
Introduce advisors and board members by name with their value-add explained in prose.

**5. Organizational Structure (1 paragraph)**
Brief description of headcount, departments, and growth plans.

**6. Team Assessment Summary (5-7 bullets)**
END with bullet points on team strengths, gaps, and overall assessment.

**7. Optional: Team Summary Table (ONLY at the very end)**
If you include a table, it MUST come AFTER all narrative sections as an appendix.

=== WRONG OUTPUT (WILL BE REJECTED) ===
| Name | Title | Background |
|------|-------|------------|
| John Smith | CEO | 10 years experience |

=== CORRECT OUTPUT ===
The company is led by a highly qualified founding team with complementary expertise spanning technology and business development. CEO John Smith brings over 10 years of experience in the industry, having previously served as VP of Engineering at TechCorp where he led a team of 50 engineers and oversaw the launch of three successful products [HR Agent - Leadership].

FORBIDDEN: Starting with a table. Tables before paragraph 6. More than 1 optional table.
REQUIRED: 70%+ narrative prose, 10+ citations, 8+ named individuals with backgrounds, 3+ narrative paragraphs before any structured content.`,

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

      'marketAnalysis': `
SECTION: MARKET ANALYSIS (3-4 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as an ANALYTICAL NARRATIVE that explains the market opportunity and competitive dynamics. Don't just list numbers - explain what they mean for the investment.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Market Overview (2-3 paragraphs)**
Open with a narrative that sets the market context. Explain the industry dynamics, why this market is attractive, and the key trends creating opportunity. Weave TAM/SAM numbers into the prose naturally.

Example: "The global fertility services market represents a $22 billion opportunity growing at 8% CAGR, driven by rising maternal age, increasing awareness of male infertility, and expanding insurance coverage [Commercial Agent - Market Size]. Within this market, the ICSI (Intracytoplasmic Sperm Injection) segment—where BAIBYS technology competes—accounts for 50-80% of all IVF procedures and represents a particularly attractive subsegment [Commercial Agent - Market Segment]."

**2. Market Sizing (1-2 paragraphs + 1 optional table)**
Explain TAM/SAM/SOM with methodology in prose. A table is optional only if you have clear multi-row sizing data.

**3. Market Dynamics & Growth Drivers (2-3 paragraphs)**
Narrative analysis of what's driving market growth. Regulatory trends, technology shifts, demographic changes - all in flowing prose.

**4. Competitive Landscape (2-3 paragraphs)**
Analyze competitors in narrative form. Name specific competitors, describe their positioning, and explain differentiation. A comparison table is acceptable AFTER the narrative context.

**5. Customer Analysis (1-2 paragraphs)**
Describe target customer profiles and buying behavior in prose.

**6. Market Takeaways (4-6 bullets)**
END with bullet summary of key market insights.

FORBIDDEN: Starting with tables. More than 2 tables total. Bullet-only subsections.
REQUIRED: 60%+ narrative prose, 12+ citations, 20+ data points.`,

      'riskAnalysis': `
SECTION: RISK ANALYSIS (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as an ANALYTICAL NARRATIVE that explains the key risks and how they can be mitigated. Don't just list risks - explain their significance and the company's response.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Risk Overview (1-2 paragraphs)**
Open with a narrative summary of the overall risk profile. Identify the 2-3 most critical risks and why they matter for the investment decision.

Example: "The primary investment risks for BAIBYS center on regulatory execution and financial sustainability. While the company has secured ISO 13485 certification, FDA De Novo clearance remains the critical gating milestone, with approval timelines potentially extending into 2026 [Clinical Agent - Regulatory]. Additionally, with 18 months of runway at current burn rate, successful Series A completion is essential for continued operations [Financial Agent - Funding]."

**2. Regulatory & Clinical Risks (2-3 paragraphs)**
Narrative analysis of regulatory pathway risks, FDA timeline uncertainties, and clinical requirements. Explain each risk and its mitigation in prose.

**3. Financial & Funding Risks (2-3 paragraphs)**
Narrative analysis of burn rate, runway, funding dependencies, and revenue risks. Explain implications for the investment.

**4. Competitive & Market Risks (1-2 paragraphs)**
Narrative analysis of competitive threats and market adoption risks. Name specific competitors as threats.

**5. Operational & Team Risks (1-2 paragraphs)**
Key person dependencies, hiring challenges, and operational risks in prose.

**6. Risk Summary (1 optional table + 4-6 bullets)**
If a summary table adds value, include one at the END (not the beginning). Conclude with bullet point key takeaways.

FORBIDDEN: Starting with a risk table. Bullet-only risk lists without prose analysis. More than 1 table.
REQUIRED: 60%+ narrative prose, 10+ citations, 8+ specific risks with mitigations.`,

      'clinicalEvidence': `
SECTION: CLINICAL EVIDENCE (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as a NARRATIVE that tells the clinical development story. Explain the significance of clinical data, not just list trial results.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Clinical Overview (2 paragraphs)**
Open with narrative context about the clinical development strategy and current status. Explain why the chosen approach makes sense.

**2. Completed Studies (2-3 paragraphs)**
Describe completed trials in narrative form. Explain endpoints, results, and their significance. Weave patient counts and efficacy data into prose.

**3. Ongoing Development (1-2 paragraphs)**
Narrative on current and planned trials. Timeline, enrollment status, expected readouts.

**4. Safety & Efficacy Summary (1-2 paragraphs)**
Narrative interpretation of the overall clinical profile.

**5. Clinical Takeaways (4-6 bullets)**
END with bullet summary of key clinical insights.

FORBIDDEN: Starting with tables. More than 1 optional table.
REQUIRED: 60%+ narrative prose, 8+ citations, 15+ data points.`,

      'regulatoryPathway': `
SECTION: REGULATORY PATHWAY (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as a NARRATIVE that explains the regulatory strategy and timeline. Help readers understand the pathway, its rationale, and key milestones.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Regulatory Strategy Overview (2 paragraphs)**
Open with narrative explaining the chosen regulatory pathway (510(k), De Novo, PMA, etc.) and why it's appropriate. Explain FDA classification and timeline.

**2. FDA Status & Timeline (2-3 paragraphs)**
Narrative on current FDA status, pre-submission meetings, submission timeline. Weave specific dates and milestones into prose.

**3. International Markets (1-2 paragraphs)**
CE Mark status, international certifications, global expansion strategy in prose.

**4. Quality & Compliance (1-2 paragraphs)**
ISO certifications, QMS infrastructure, compliance posture.

**5. Regulatory Takeaways (4-6 bullets)**
END with bullet summary of key regulatory insights and milestones.

FORBIDDEN: Starting with tables or checklists. More than 1 optional table.
REQUIRED: 60%+ narrative prose, 8+ citations, 12+ data points.`,

      'intellectualProperty': `
SECTION: INTELLECTUAL PROPERTY (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as a NARRATIVE that explains the IP strategy and its value. Don't just list patents - explain their significance and competitive implications.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. IP Overview (2 paragraphs)**
Open with narrative explaining the overall IP strategy and portfolio strength. How does the IP create competitive moat?

**2. Patent Portfolio (2-3 paragraphs + 1 optional table)**
Narrative analysis of key patents, their claims, and coverage. Explain the significance of each major patent. A summary table is acceptable AFTER the narrative.

**3. Freedom to Operate (1-2 paragraphs)**
Narrative analysis of FTO position and potential IP conflicts with competitors.

**4. Trade Secrets & Know-How (1 paragraph)**
Narrative on proprietary knowledge beyond patents.

**5. IP Takeaways (4-6 bullets)**
END with bullet summary of IP strengths and risks.

FORBIDDEN: Starting with patent tables. More than 1 table.
REQUIRED: 60%+ narrative prose, 10+ citations, 5+ patent references.`,

      'competitiveAnalysis': `
SECTION: COMPETITIVE ANALYSIS (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as a NARRATIVE that explains the competitive landscape and positioning. Tell the story of who the company competes with and why it wins.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Competitive Landscape Overview (2-3 paragraphs)**
Open with narrative explaining the competitive environment. Who are the key players? How is the market structured? What defines competitive success?

**2. Key Competitors Analysis (3-4 paragraphs)**
Analyze major competitors in narrative form. For each competitor, explain their positioning, strengths, and weaknesses IN PROSE. Name specific companies with details.

**3. Competitive Comparison (1 optional table AFTER prose)**
If a comparison table adds value, include one after the narrative analysis.

**4. Differentiation & Moats (2 paragraphs)**
Narrative explanation of how the company differentiates and defends its position.

**5. Competitive Takeaways (4-6 bullets)**
END with bullet summary of competitive insights.

FORBIDDEN: Starting with competitor tables. More than 1 comparison table.
REQUIRED: 60%+ narrative prose, 10+ citations, 5+ named competitors analyzed in prose.`,

      'technologyAssessment': `
SECTION: TECHNOLOGY ASSESSMENT (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as a NARRATIVE that explains the technology and its significance. Help readers understand the innovation and why it matters.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Technology Overview (2-3 paragraphs)**
Open with narrative explaining the core technology, how it works, and why it's innovative. Weave technical specifications into prose.

**2. Technical Differentiation (2 paragraphs)**
Narrative explaining what makes the technology unique compared to alternatives. How does it work better/differently?

**3. Development Status & Roadmap (2 paragraphs)**
Narrative on current development stage and future plans. Include milestones in prose.

**4. Scalability & Risks (1-2 paragraphs)**
Narrative on path to scale and technical challenges.

**5. Technology Takeaways (4-6 bullets)**
END with bullet summary of key technical insights.

FORBIDDEN: Starting with feature lists. Technology comparison tables before prose.
REQUIRED: 60%+ narrative prose, 10+ citations, 12+ technical data points.`,

      'investmentTerms': `
SECTION: INVESTMENT TERMS (2-3 pages) - NARRATIVE-FIRST

=== WRITING APPROACH ===
Write this as a NARRATIVE that explains the deal structure and its implications. Help readers understand the terms and their significance.

=== REQUIRED STRUCTURE (IN THIS ORDER) ===

**1. Deal Overview (2 paragraphs)**
Open with narrative summarizing the transaction - valuation, round size, lead investor, and key terms in prose form.

**2. Deal Terms (1 paragraph + 1 table)**
Brief context, then ONE summary table of key deal terms. This is an appropriate place for a table.

**3. Valuation Analysis (1-2 paragraphs)**
Narrative analysis of whether the valuation is reasonable. Compare to similar companies if data available.

**4. Investor Rights & Governance (1-2 paragraphs)**
Narrative explanation of board seats, protective provisions, and investor rights.

**5. Deal Takeaways (4-6 bullets)**
END with bullet summary of key deal considerations.

FORBIDDEN: Starting with the terms table before narrative context.
REQUIRED: 50%+ narrative prose, 8+ citations, 10+ deal terms documented.`,

      'coverPage': `
SECTION: COVER PAGE (1 page)

=== MANDATORY DATA EXTRACTION CHECKLIST ===
□ Company Legal Name: [Full legal entity name]
□ Tagline: [One-line description]
□ Sector: [Industry/market segment]
□ Stage: [Seed, Series A, B, etc.]
□ Round Size: [$X being raised]
□ Valuation: [$X pre-money]
□ Lead Investor: [Name if known]
□ Contact: [CEO name and email]

=== FORMAT ===
Professional cover page with:
- Company logo placeholder
- Investment memorandum title
- Confidential notice
- Date of preparation
- Key metrics summary box

REQUIRED DATA POINTS: Minimum 8`,

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
   * Get section-specific quality requirements
   * Each section type has different minimum thresholds for institutional quality
   */
  private getSectionQualityRequirements(sectionType: string): {
    minCitations: number;
    minDataPoints: number;
    minNamedEntities: number;
    minContentLength: number;
    minProseDensity: number;
    qualityThreshold: number;
  } {
    const requirements: Record<string, any> = {
      'financialAnalysis': { 
        minCitations: 12, minDataPoints: 25, minNamedEntities: 5, 
        minContentLength: 4000, minProseDensity: 50, qualityThreshold: 90
      },
      'executiveSummary': { 
        minCitations: 15, minDataPoints: 20, minNamedEntities: 8, 
        minContentLength: 3500, minProseDensity: 60, qualityThreshold: 85
      },
      'teamAssessment': { 
        minCitations: 8, minDataPoints: 10, minNamedEntities: 8, 
        minContentLength: 2500, minProseDensity: 70, qualityThreshold: 80
      },
      'marketAnalysis': { 
        minCitations: 10, minDataPoints: 18, minNamedEntities: 6, 
        minContentLength: 3000, minProseDensity: 60, qualityThreshold: 85
      },
      'riskAnalysis': { 
        minCitations: 8, minDataPoints: 12, minNamedEntities: 4, 
        minContentLength: 2500, minProseDensity: 60, qualityThreshold: 85
      },
      'clinicalEvidence': { 
        minCitations: 8, minDataPoints: 15, minNamedEntities: 3, 
        minContentLength: 2500, minProseDensity: 60, qualityThreshold: 85
      },
      'regulatoryPathway': { 
        minCitations: 8, minDataPoints: 12, minNamedEntities: 3, 
        minContentLength: 2000, minProseDensity: 60, qualityThreshold: 85
      },
      'intellectualProperty': { 
        minCitations: 8, minDataPoints: 10, minNamedEntities: 4, 
        minContentLength: 2000, minProseDensity: 60, qualityThreshold: 85
      },
      'competitiveAnalysis': { 
        minCitations: 10, minDataPoints: 12, minNamedEntities: 8, 
        minContentLength: 2500, minProseDensity: 60, qualityThreshold: 85
      },
      'technologyAssessment': { 
        minCitations: 8, minDataPoints: 12, minNamedEntities: 4, 
        minContentLength: 2500, minProseDensity: 60, qualityThreshold: 85
      },
      'investmentTerms': { 
        minCitations: 6, minDataPoints: 10, minNamedEntities: 3, 
        minContentLength: 2000, minProseDensity: 50, qualityThreshold: 85
      },
      'coverPage': { 
        minCitations: 2, minDataPoints: 8, minNamedEntities: 2, 
        minContentLength: 500, minProseDensity: 40, qualityThreshold: 75
      }
    };
    
    return requirements[sectionType] || {
      minCitations: 8, minDataPoints: 15, minNamedEntities: 5,
      minContentLength: 2500, minProseDensity: 55, qualityThreshold: 85
    };
  }

  /**
   * Analyze the quality of generated content
   * Now includes NARRATIVE DENSITY check and SECTION-SPECIFIC thresholds
   */
  private analyzeContentQuality(content: string, facts: AgentFact[], sectionType?: string): Omit<SectionGenerationResult, 'content'> {
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
    
    // NEW: Calculate narrative density (prose vs bullets/tables)
    const narrativeDensity = calculateNarrativeDensity(content);
    
    // NEW: Calculate table percentage for table-heavy penalty
    const tablePercentage = calculateTablePercentage(content);
    
    // Get section-specific requirements for score calibration
    const reqs = sectionType ? this.getSectionQualityRequirements(sectionType) : null;
    
    // Calculate quality score with ENHANCED CEILING for data-rich sections
    let qualityScore = 40; // Lowered base score to allow more headroom
    
    // Citations boost (up to +25 - increased ceiling)
    const citationTarget = reqs?.minCitations || 8;
    const citationRatio = Math.min(citationsUsed.length / citationTarget, 2); // Allow 2x boost
    qualityScore += Math.round(citationRatio * 12.5); // Up to +25 for meeting 2x target
    
    // Quantitative data boost (up to +25 - increased ceiling)
    const dataTarget = reqs?.minDataPoints || 15;
    const dataRatio = Math.min(quantitativeDataPoints / dataTarget, 2); // Allow 2x boost
    qualityScore += Math.round(dataRatio * 12.5); // Up to +25 for meeting 2x target
    
    // Specific names boost (up to +15 - increased ceiling)
    const entityTarget = reqs?.minNamedEntities || 5;
    const entityRatio = Math.min(namesFound.length / entityTarget, 2);
    qualityScore += Math.round(entityRatio * 7.5); // Up to +15 for meeting 2x target
    
    // Content length factor - more granular
    const lengthTarget = reqs?.minContentLength || 2500;
    if (content.length >= lengthTarget * 1.5) qualityScore += 10;
    else if (content.length >= lengthTarget) qualityScore += 5;
    else if (content.length >= lengthTarget * 0.7) qualityScore += 2;
    
    // Narrative density factor with section-specific thresholds
    const proseTarget = reqs?.minProseDensity || 55;
    if (narrativeDensity >= proseTarget) {
      qualityScore += 5; // Meets narrative-first requirement
    } else if (narrativeDensity >= proseTarget - 15) {
      qualityScore += 0; // Neutral - close but not there
    } else {
      qualityScore -= 10; // Penalty for bullet/table heavy content
    }
    
    // TABLE-HEAVY PENALTY: Reduce score if >30% of content is tables
    // This prevents table-only output from passing quality checks
    if (tablePercentage > 50) {
      qualityScore -= 20; // Heavy penalty for mostly-table content
    } else if (tablePercentage > 30) {
      qualityScore -= 10; // Moderate penalty for table-heavy content
    }
    
    // Placeholder penalty
    qualityScore -= placeholderCount * 5;
    
    // Ensure score is within bounds (now with realistic 100 ceiling for excellent content)
    qualityScore = Math.max(0, Math.min(100, qualityScore));
    
    // Use existing reqs for warnings (already defined above), or use default
    const reqsForWarnings = reqs || {
      minCitations: 8, minDataPoints: 15, minNamedEntities: 5,
      minContentLength: 2500, minProseDensity: 55, qualityThreshold: 85
    };
    
    // Add warnings based on section-specific thresholds
    if (citationsUsed.length < reqsForWarnings.minCitations) {
      warnings.push(`Low citation count (${citationsUsed.length}/${reqsForWarnings.minCitations} required) - need more citations for institutional quality`);
    }
    if (quantitativeDataPoints < reqsForWarnings.minDataPoints) {
      warnings.push(`Low quantitative data (${quantitativeDataPoints}/${reqsForWarnings.minDataPoints} required) - need more specific metrics`);
    }
    if (placeholderCount > 1) {
      warnings.push('Contains placeholder text - all data should be specific');
    }
    if (content.length < reqsForWarnings.minContentLength) {
      warnings.push(`Section too short (${content.length}/${reqsForWarnings.minContentLength} chars) - needs more comprehensive analysis`);
    }
    if (namesFound.length < reqsForWarnings.minNamedEntities) {
      warnings.push(`Low entity count (${namesFound.length}/${reqsForWarnings.minNamedEntities} required) - need more named people/companies`);
    }
    
    // Narrative density warning based on section-specific threshold
    if (narrativeDensity < reqsForWarnings.minProseDensity - 20) {
      warnings.push(`CRITICAL: Too many bullets/tables (${narrativeDensity}% prose) - need ${reqsForWarnings.minProseDensity}%+ narrative paragraphs`);
    } else if (narrativeDensity < reqsForWarnings.minProseDensity) {
      warnings.push(`Low prose density (${narrativeDensity}%) - aim for ${reqsForWarnings.minProseDensity}%+ narrative paragraphs`);
    }
    
    // Table-heavy warning
    if (tablePercentage > 50) {
      warnings.push(`CRITICAL: Table-heavy output (${tablePercentage}% tables) - need more narrative prose before tables`);
    } else if (tablePercentage > 30) {
      warnings.push(`High table content (${tablePercentage}%) - add more narrative context around tables`);
    }
    
    // Determine confidence based on meeting section-specific thresholds
    let confidence: 'high' | 'medium' | 'low';
    const meetsAllReqs = citationsUsed.length >= reqsForWarnings.minCitations && 
                         quantitativeDataPoints >= reqsForWarnings.minDataPoints &&
                         narrativeDensity >= reqsForWarnings.minProseDensity - 10;
    
    if (qualityScore >= reqsForWarnings.qualityThreshold && meetsAllReqs) {
      confidence = 'high';
    } else if (qualityScore >= reqsForWarnings.qualityThreshold - 15) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    return {
      qualityScore,
      citationsUsed,
      quantitativeDataPoints,
      narrativeDensity,
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
