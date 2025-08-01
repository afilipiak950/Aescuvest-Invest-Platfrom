import OpenAI from 'openai';
import { storage } from '../storage';
import { InsertInvestmentMemo } from '../../shared/schema';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ProfessionalMemoData {
  dealId: number;
  companyName: string;
  documents: any[];
  agentAnalyses: any[];
  deal: any;
}

export interface ProfessionalMemoSections {
  coverPage: string;
  executiveSummary: string;
  investmentHighlights: string[];
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  marketAnalysis: string;
  productAnalysis: string;
  businessModel: string;
  teamAssessment: string;
  financialAnalysis: string;
  commercialStrategy: string;
  clinicalAssessment: string;
  ipAnalysis: string;
  riskAssessment: string;
  legalAssessment: string;
  investmentTerms: string;
  exitStrategy: string;
  recommendation: string;
  appendices: string;
}

class ProfessionalMemoService {

  async generateProfessionalMemo(dealId: number): Promise<ProfessionalMemoSections> {
    console.log(`🏢 Generating PROFESSIONAL investment memo matching BAIBYS quality for deal ${dealId}`);
    
    try {
      // 1. Gather all comprehensive data
      const memoData = await this.gatherProfessionalData(dealId);
      
      // 2. Create comprehensive analysis context
      const analysisContext = await this.createComprehensiveContext(memoData);
      
      // 3. Generate professional memo sections
      const memo = await this.generateProfessionalSections(memoData, analysisContext);
      
      // 4. Store the professional memo
      await this.storeProfessionalMemo(dealId, memo);
      
      console.log(`✅ Professional investment memo completed for deal ${dealId}`);
      return memo;
      
    } catch (error) {
      console.error(`❌ Error generating professional memo for deal ${dealId}:`, error);
      throw new Error(`Failed to generate professional memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async gatherProfessionalData(dealId: number): Promise<ProfessionalMemoData> {
    console.log(`📊 Gathering professional data for deal ${dealId}`);
    
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const documents = await storage.getDocumentsWithOCRForMemo(dealId);
    const agentAnalyses = await storage.getAnalysesByDealId(dealId);
    
    console.log(`📄 Professional data: ${documents.length} documents, ${agentAnalyses.length} analyses`);

    return {
      dealId,
      companyName: deal.companyName,
      documents,
      agentAnalyses,
      deal
    };
  }

  private async createComprehensiveContext(data: ProfessionalMemoData): Promise<string> {
    console.log(`🔍 Creating comprehensive analysis context from all available data`);
    
    let context = `COMPANY: ${data.companyName}\n\n`;
    
    // Add deal information
    if (data.deal) {
      context += `DEAL INFORMATION:\n`;
      context += `- Stage: ${data.deal.stage || 'Unknown'}\n`;
      context += `- Industry: ${data.deal.description || 'Technology'}\n`;
      context += `- Location: ${data.deal.location || 'Not specified'}\n\n`;
    }

    // Extract OCR content from documents
    context += `DOCUMENT ANALYSIS:\n`;
    let totalDocumentContent = '';
    
    for (const doc of data.documents) {
      const ocrText = doc.ocrText || doc.ocr_text || doc['ocr_text'];
      const aiSummary = doc.aiSummary || doc.ai_summary || doc['ai_summary'];
      
      if (ocrText && typeof ocrText === 'string' && ocrText.trim().length > 100) {
        totalDocumentContent += `\n--- ${doc.name} ---\n${ocrText}\n`;
      }
      
      if (aiSummary && typeof aiSummary === 'string' && aiSummary.trim().length > 50) {
        context += `Document: ${doc.name}\nSummary: ${aiSummary}\n\n`;
      }
    }
    
    // Add agent analyses
    context += `AGENT ANALYSES:\n`;
    for (const analysis of data.agentAnalyses) {
      if (analysis.analysisResult && typeof analysis.analysisResult === 'object') {
        context += `\n--- ${analysis.agentType?.toUpperCase()} ANALYSIS ---\n`;
        context += JSON.stringify(analysis.analysisResult, null, 2) + '\n';
      }
    }
    
    // Add raw document content (truncated for context limits)
    if (totalDocumentContent.length > 0) {
      context += `\nRAW DOCUMENT CONTENT:\n${totalDocumentContent.slice(0, 50000)}\n`;
    }
    
    console.log(`📊 Context created: ${context.length.toLocaleString()} characters`);
    return context;
  }

  private async generateProfessionalSections(data: ProfessionalMemoData, context: string): Promise<ProfessionalMemoSections> {
    console.log(`🎯 Generating professional memo sections using GPT-4o`);
    
    // Generate cover page with BAIBYS-style professional layout
    const coverPage = await this.generateProfessionalCoverPage(data, context);
    
    // Generate executive summary with rich detail
    const executiveSummary = await this.generateProfessionalExecutiveSummary(data, context);
    
    // Generate investment highlights as bullet points
    const investmentHighlights = await this.generateProfessionalInvestmentHighlights(data, context);
    
    // Generate SWOT analysis in table format matching BAIBYS
    const swotAnalysis = await this.generateProfessionalSWOT(data, context);
    
    // Generate comprehensive market analysis
    const marketAnalysis = await this.generateProfessionalMarketAnalysis(data, context);
    
    // Generate other professional sections
    const [
      productAnalysis,
      businessModel,
      teamAssessment,
      financialAnalysis,
      commercialStrategy,
      clinicalAssessment,
      ipAnalysis,
      riskAssessment,
      legalAssessment,
      investmentTerms,
      exitStrategy,
      recommendation,
      appendices
    ] = await Promise.all([
      this.generateProductAnalysis(data, context),
      this.generateBusinessModel(data, context),
      this.generateTeamAssessment(data, context),
      this.generateFinancialAnalysis(data, context),
      this.generateCommercialStrategy(data, context),
      this.generateClinicalAssessment(data, context),
      this.generateIPAnalysis(data, context),
      this.generateRiskAssessment(data, context),
      this.generateLegalAssessment(data, context),
      this.generateInvestmentTerms(data, context),
      this.generateExitStrategy(data, context),
      this.generateRecommendation(data, context),
      this.generateAppendices(data, context)
    ]);

    return {
      coverPage,
      executiveSummary,
      investmentHighlights,
      swotAnalysis,
      marketAnalysis,
      productAnalysis,
      businessModel,
      teamAssessment,
      financialAnalysis,
      commercialStrategy,
      clinicalAssessment,
      ipAnalysis,
      riskAssessment,
      legalAssessment,
      investmentTerms,
      exitStrategy,
      recommendation,
      appendices
    };
  }

  private async generateProfessionalCoverPage(data: ProfessionalMemoData, context: string): Promise<string> {
    const prompt = `Create a professional investment memorandum cover page matching the BAIBYS format style.

COMPANY: ${data.companyName}

REFERENCE BAIBYS FORMAT:
- Investment Memorandum title
- Company name prominently displayed  
- Date (as of [Month Year])
- Two-column layout:
  - Left: Company details (headquarters, management team, incorporation, shareholding)
  - Right: Investment highlights with bullet points
- Professional proposal section with funding amounts and terms
- Key investment terms section

CONTEXT:
${context.slice(0, 10000)}

Generate a professional cover page with:
1. Professional header with memo title and company name
2. Company information section (extract from documents)
3. Management team (extract names and titles from documents)
4. Investment highlights (3-5 key points)
5. Proposal details (extract funding information if available)
6. Key terms (extract from documents if available)

Use professional formatting with clear sections and bullet points. Extract REAL data from the provided context - do not use placeholders.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    });

    return response.choices[0].message.content || "Cover page generation failed";
  }

  private async generateProfessionalExecutiveSummary(data: ProfessionalMemoData, context: string): Promise<string> {
    const prompt = `Create a comprehensive 2-3 page executive summary for ${data.companyName} matching professional VC memo quality.

REFERENCE QUALITY: BAIBYS executive summary shows:
- Company founding story and leadership expertise
- Detailed technology description and competitive advantage
- Market size and opportunity with specific statistics
- Strategic partnerships and validation
- Financial outlook and growth potential
- Professional, detailed writing with industry terminology

CONTEXT:
${context.slice(0, 15000)}

Write a detailed executive summary (800-1200 words) covering:
1. Company founding, mission, and leadership background
2. Technology/product innovation and competitive differentiation  
3. Market opportunity with specific market data and growth rates
4. Strategic partnerships, customer validation, regulatory status
5. Financial performance, projections, and funding history
6. Investment thesis and expected returns

Use professional VC language, specific data points, and industry expertise. Extract all real information from the provided context.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.3
    });

    return response.choices[0].message.content || "Executive summary generation failed";
  }

  private async generateProfessionalInvestmentHighlights(data: ProfessionalMemoData, context: string): Promise<string[]> {
    const prompt = `Extract 4-6 compelling investment highlights for ${data.companyName} in the style of professional VC memos.

REFERENCE BAIBYS HIGHLIGHTS:
• Innovative Technology: End-to-end automated sperm selection platform combining robotics with advanced algorithms to improve quality and increase throughput by ten times
• Market Potential: Growing demand for IVF services with double digit growth rates, fueled by rising infertility rates
• KOL support & Strong Strategic Partnerships: 11 fertility experts/clinics owners invested, Rohto Pharmaceuticals strategic partnership
• Competitive Edge: No current competitor combines full automation of the process
• Regulatory Approvals: CE marked as class I medical device, FDA approval expected late 2026

CONTEXT:
${context.slice(0, 10000)}

Create 4-6 investment highlights as bullet points. Each should:
- Start with a clear category (e.g., "Innovative Technology:", "Market Potential:", "Strategic Partnerships:")
- Include specific metrics, partnerships, or competitive advantages from the context
- Be 1-2 sentences long with concrete details
- Sound professional and compelling to investors

Return as JSON array of strings.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.highlights || [];
    } catch {
      return ["Technology Innovation", "Market Opportunity", "Strategic Partnerships", "Competitive Advantage"];
    }
  }

  private async generateProfessionalSWOT(data: ProfessionalMemoData, context: string): Promise<{ strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }> {
    const prompt = `Create a professional SWOT analysis for ${data.companyName} matching the BAIBYS table format.

REFERENCE BAIBYS SWOT FORMAT:
STRENGTHS: "Strong IP Position: Proprietary AI trained on over 17,000 labeled images; robotic micromanipulation patent granted (US). Efficiency: Significantly reduces procedure time, selecting/isolating ideal sperm cells within minutes."

WEAKNESSES: "Lack of commercial profile: While the team has a strong R&D setup, they will need to add commercial competencies. Nascent Commercial Infrastructure: Limited internal go-to-market resources."

CONTEXT:
${context.slice(0, 12000)}

Generate 3-4 points for each SWOT category with specific details from the context:
- STRENGTHS: Technology advantages, IP protection, partnerships, team expertise, product differentiation
- WEAKNESSES: Commercial gaps, resource limitations, market risks, execution challenges  
- OPPORTUNITIES: Market growth, expansion potential, strategic partnerships, regulatory approvals
- THREATS: Competition, market risks, regulatory challenges, technology risks

Return as JSON with arrays for each category.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        opportunities: result.opportunities || [],
        threats: result.threats || []
      };
    } catch {
      return {
        strengths: ["Technology Innovation", "Strategic Partnerships"],
        weaknesses: ["Commercial Infrastructure", "Market Execution"],
        opportunities: ["Market Growth", "Strategic Expansion"],
        threats: ["Competition", "Regulatory Risk"]
      };
    }
  }

  // Generate comprehensive market analysis
  private async generateProfessionalMarketAnalysis(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Market Analysis",
      `Comprehensive market analysis for ${data.companyName} including market size (TAM/SAM/SOM), growth rates, competitive landscape, market drivers, and timing. Include specific market data, growth projections, and competitive positioning.`,
      context
    );
  }

  // Helper method for generating detailed sections
  private async generateDetailedSection(sectionName: string, description: string, context: string): Promise<string> {
    const prompt = `Generate a detailed ${sectionName} section for a professional investment memorandum.

REQUIREMENTS:
${description}

Extract all relevant information from the provided context and create a comprehensive analysis with:
- Specific data points and metrics where available
- Professional investment terminology
- Clear structure with subsections
- Evidence-based insights from the context

CONTEXT:
${context.slice(0, 15000)}

Write 500-800 words with professional formatting and specific details extracted from the context.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    });

    return response.choices[0].message.content || `${sectionName} generation failed`;
  }

  // Generate other sections using the helper method
  private async generateProductAnalysis(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Product Analysis",
      `Product/technology analysis covering product overview, technical specifications, development stage, competitive advantages, and differentiation factors.`,
      context
    );
  }

  private async generateBusinessModel(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Business Model",
      `Business model analysis including revenue streams, pricing strategy, sales channels, customer acquisition, and scalability.`,
      context
    );
  }

  private async generateTeamAssessment(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Team Assessment",
      `Management team evaluation including leadership backgrounds, key personnel, advisors, board composition, and execution capability.`,
      context
    );
  }

  private async generateFinancialAnalysis(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Financial Analysis",
      `Financial analysis including current financials, revenue projections, funding history, use of funds, and financial performance metrics.`,
      context
    );
  }

  private async generateCommercialStrategy(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Commercial Strategy",
      `Go-to-market strategy including sales approach, distribution channels, partnership strategy, and commercial execution plan.`,
      context
    );
  }

  private async generateClinicalAssessment(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Clinical Assessment",
      `Clinical development plan including trial design, regulatory pathway, clinical risks, and development timeline.`,
      context
    );
  }

  private async generateIPAnalysis(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "IP Analysis",
      `Intellectual property analysis including patent portfolio, IP protection strategy, licensing agreements, and competitive IP landscape.`,
      context
    );
  }

  private async generateRiskAssessment(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Risk Assessment",
      `Comprehensive risk analysis including technical, market, competitive, regulatory, and management risks with mitigation strategies.`,
      context
    );
  }

  private async generateLegalAssessment(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Legal Assessment",
      `Legal analysis including corporate structure, regulatory compliance, contractual obligations, and legal risks.`,
      context
    );
  }

  private async generateInvestmentTerms(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Investment Terms",
      `Investment terms including valuation, funding amount, securities structure, board rights, and liquidation preferences.`,
      context
    );
  }

  private async generateExitStrategy(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Exit Strategy",
      `Exit strategy analysis including IPO readiness, strategic acquisition targets, exit timing, and value realization opportunities.`,
      context
    );
  }

  private async generateRecommendation(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Investment Recommendation",
      `Investment recommendation including rationale, key milestones, expected returns, and investment decision framework.`,
      context
    );
  }

  private async generateAppendices(data: ProfessionalMemoData, context: string): Promise<string> {
    return this.generateDetailedSection(
      "Appendices",
      `Supporting appendices including detailed financial models, market research data, technical specifications, and additional documentation.`,
      context
    );
  }

  private async storeProfessionalMemo(dealId: number, memo: ProfessionalMemoSections): Promise<void> {
    console.log(`💾 Storing professional investment memo for deal ${dealId}`);
    
    const memoData: InsertInvestmentMemo = {
      dealId,
      memo: memo as any,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await storage.createMemo(memoData);
    console.log(`✅ Professional memo stored successfully for deal ${dealId}`);
  }
}

export const professionalMemoService = new ProfessionalMemoService();