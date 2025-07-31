import { Request, Response } from 'express';
import OpenAI from 'openai';
import { storage } from '../storage';
import { safeGetDocumentContent } from '../utils/documentUtils';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ComprehensiveMemoData {
  dealId: number;
  companyName: string;
  documents: any[];
  agentAnalyses: any[];
  companyResearch?: any;
  aiEvaluation?: any;
}

export interface InvestmentMemoSections {
  // COMPREHENSIVE 30-50 PAGE MEMO STRUCTURE MATCHING BAIBYS PDF
  coverPage: string;                    // Professional cover page with company info, investment highlights
  executiveSummary: string;             // Comprehensive executive summary (2-3 pages)
  investmentHighlights: string[];       // Key investment highlights and value propositions
  swotAnalysis: {                       // SWOT analysis in table format matching BAIBYS
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  marketAnalysis: {                     // Market analysis (5-8 pages)
    marketContext: string;
    marketSize: {
      tam: string;
      sam: string;
      som: string;
    };
    competitiveLandscape: string;
    marketTiming: string;
  };
  tamSamSomAnalysis: string;           // Detailed TAM/SAM/SOM tables and analysis
  competitiveAnalysis: string;          // Comprehensive competitive landscape (3-4 pages)
  technologyAssessment: string;         // Technology assessment and differentiation (4-5 pages)  
  productAnalysis: {                    // Product/solution analysis
    productOverview: string;
    technologyAdvantage: string;
    competitiveEdge: string;
    developmentStage: string;
  };
  businessModel: {                      // Business model and commercial strategy
    revenueModel: string;
    pricingStrategy: string;
    salesChannels: string;
    customerAcquisition: string;
  };
  commercialStrategy: string;           // Go-to-market and commercial strategy (3-4 pages)
  teamAssessment: {                     // Management team assessment
    management: string;
    keyPersonnel: string[];
    advisors: string;
    boardComposition: string;
  };
  managementAnalysis: string;           // Detailed management analysis and backgrounds (2-3 pages)
  financialAnalysis: {                  // Financial analysis overview
    currentFinancials: string;
    projections: string;
    fundingHistory: string;
    useOfFunds: string;
  };
  financialProjections: string;         // Detailed financial projections and models (4-5 pages)
  valuationAnalysis: string;            // Valuation analysis and methodologies (2-3 pages)
  legalAssessment: {                    // Legal assessment overview
    corporateStructure: string;
    ipProtection: string;
    regulatoryCompliance: string;
    contractualObligations: string;
  };
  regulatoryAnalysis: string;           // Regulatory landscape and compliance (2-3 pages)
  clinicalAssessment: string;           // Clinical development and regulatory pathway (3-4 pages)
  ipAnalysis: string;                   // Intellectual property analysis (2-3 pages)
  researchInsights: string;             // Research insights and technical differentiation (2-3 pages)
  riskAssessment: {                     // Risk assessment overview
    technicalRisks: string[];
    marketRisks: string[];
    competitiveRisks: string[];
    regulatoryRisks: string[];
    managementRisks: string[];
  };
  mitigationStrategies: string;         // Risk mitigation strategies (2-3 pages)
  investmentTerms: {                    // Investment terms and structure
    valuation: string;
    fundingAmount: string;
    securities: string;
    boardRights: string;
    liquidationPreference: string;
  };
  exitStrategy: string;                 // Exit strategy analysis (2-3 pages)
  recommendation: {                     // Investment recommendation and rationale (2-3 pages)
    investment_recommendation: string;
    rationale: string;
    keyMilestones: string[];
    exitStrategy: string;
  };
  appendices: string;                   // Comprehensive appendices with supporting data (5-10 pages)
}

class InvestmentMemoService {

  async generateComprehensiveMemo(dealId: number): Promise<InvestmentMemoSections> {
    console.log(`🔍 Starting comprehensive investment memo generation for deal ${dealId}`);
    
    try {
      // 1. Gather all data for the deal
      const memoData = await this.gatherComprehensiveData(dealId);
      
      // 2. Generate each section using AI
      const memo = await this.generateMemoSections(memoData);
      
      // 3. Store the generated memo
      await this.storeMemo(dealId, memo);
      
      console.log(`✅ Investment memo generation completed for deal ${dealId}`);
      return memo;
      
    } catch (error) {
      console.error(`❌ Error generating investment memo for deal ${dealId}:`, error);
      throw new Error(`Failed to generate investment memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async gatherComprehensiveData(dealId: number): Promise<ComprehensiveMemoData> {
    console.log(`📊 Gathering comprehensive data for deal ${dealId}`);
    
    // Get deal information
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Get all documents with AI summaries
    const documents = await storage.getDocumentsByDealId(dealId);
    console.log(`📄 Found ${documents.length} documents for deal ${dealId}`);

    // Get all agent analyses 
    const agentAnalyses = await storage.getAnalysesByDealId(dealId);
    console.log(`🤖 Found ${agentAnalyses.length} agent analyses for deal ${dealId}`);

    // Get company research (TODO: implement this method)
    const companyResearch = null; // await storage.getCompanyResearchByDealId(dealId);
    
    // Get AI evaluation (TODO: implement this method) 
    const aiEvaluation = null; // await storage.getAIEvaluationByDealId(dealId);

    return {
      dealId,
      companyName: deal.companyName,
      documents,
      agentAnalyses,
      companyResearch,
      aiEvaluation
    };
  }

  private async generateMemoSections(data: ComprehensiveMemoData): Promise<InvestmentMemoSections> {
    console.log(`🧠 Generating AI-powered memo sections for ${data.companyName}`);

    // Prepare comprehensive context for AI
    const context = this.prepareAnalysisContext(data);
    
    // Generate ALL comprehensive sections matching BAIBYS PDF structure for 30-50 page memo
    const [
      coverPage,
      executiveSummary,
      investmentHighlights,
      swotAnalysis,
      marketAnalysis,
      tamSamSomAnalysis,
      competitiveAnalysis,
      technologyAssessment,
      productAnalysis,
      businessModel,
      commercialStrategy,
      teamAssessment,
      managementAnalysis,
      financialAnalysis,
      financialProjections,
      valuationAnalysis,
      legalAssessment,
      regulatoryAnalysis,
      clinicalAssessment,
      ipAnalysis,
      researchInsights,
      riskAssessment,
      mitigationStrategies,
      investmentTerms,
      exitStrategy,
      recommendation,
      appendices
    ] = await Promise.all([
      this.generateCoverPage(data),
      this.generateExecutiveSummary(context),
      this.generateInvestmentHighlights(context),
      this.generateSWOTAnalysis(context),
      this.generateMarketAnalysis(context),
      this.generateTAMSAMSOMAnalysis(context),
      this.generateCompetitiveAnalysis(context),
      this.generateTechnologyAssessment(context),
      this.generateProductAnalysis(context),
      this.generateBusinessModel(context),
      this.generateCommercialStrategy(context),
      this.generateTeamAssessment(context),
      this.generateManagementAnalysis(context),
      this.generateFinancialAnalysis(context),
      this.generateFinancialProjections(context),
      this.generateValuationAnalysis(context),
      this.generateLegalAssessment(context),
      this.generateRegulatoryAnalysis(context),
      this.generateClinicalAssessment(context),
      this.generateIPAnalysis(context),
      this.generateResearchInsights(context),
      this.generateRiskAssessment(context),
      this.generateMitigationStrategies(context),
      this.generateInvestmentTerms(context),
      this.generateExitStrategy(context),
      this.generateRecommendation(context),
      this.generateAppendices(data)
    ]);

    return {
      coverPage,
      executiveSummary,
      investmentHighlights,
      swotAnalysis,
      marketAnalysis,
      tamSamSomAnalysis,
      competitiveAnalysis,
      technologyAssessment,
      productAnalysis,
      businessModel,
      commercialStrategy,
      teamAssessment,
      managementAnalysis,
      financialAnalysis,
      financialProjections,
      valuationAnalysis,
      legalAssessment,
      regulatoryAnalysis,
      clinicalAssessment,
      ipAnalysis,
      researchInsights,
      riskAssessment,
      mitigationStrategies,
      investmentTerms,
      exitStrategy,
      recommendation,
      appendices
    };
  }

  private prepareAnalysisContext(data: ComprehensiveMemoData): string {
    let context = `
COMPREHENSIVE INVESTMENT ANALYSIS FOR ${data.companyName}

=== DEAL INFORMATION ===
Company: ${data.companyName}
Deal ID: ${data.dealId}

=== COMPREHENSIVE DOCUMENT ANALYSIS ===
Total Documents: ${data.documents.length}

DETAILED DOCUMENT CONTENT FOR COMPANY INFORMATION EXTRACTION:
`;

    // Add comprehensive document content for better analysis
    data.documents.forEach((doc, index) => {
      const content = safeGetDocumentContent(doc);
      const summary = content.summary || doc.summary;
      const extractedText = content.extractedText || doc.extractedText || '';
      
      if (summary || extractedText) {
        context += `

========== DOCUMENT ${index + 1}: ${doc.name} ==========
FILE TYPE: ${doc.contentType || 'Unknown'}
AI SUMMARY: ${summary || 'No summary available'}

EXTRACTED TEXT CONTENT (for specific details extraction):
${extractedText.substring(0, 2000)}${extractedText.length > 2000 ? '... [TRUNCATED]' : ''}
========================================
`;
      }
    });

    // Add agent analyses
    context += `
=== AGENT ANALYSES ===
`;
    data.agentAnalyses.forEach(analysis => {
      context += `
${analysis.agentType.toUpperCase()} ANALYSIS:
Status: ${analysis.status}
Findings: ${analysis.findings?.length || 0}
Recommendations: ${analysis.recommendations?.length || 0}
`;

      // Add specific analysis content based on agent type (safely parse JSON or objects)
      if (analysis.legalAnswers) {
        try {
          const legalData = typeof analysis.legalAnswers === 'string' 
            ? JSON.parse(analysis.legalAnswers) 
            : analysis.legalAnswers;
          context += `Legal Questions Analyzed: ${Object.keys(legalData || {}).length}\n`;
        } catch (e) {
          context += `Legal Questions Analyzed: Available but unparseable\n`;
        }
      }
      if (analysis.clinicalAnswers) {
        try {
          const clinicalData = typeof analysis.clinicalAnswers === 'string' 
            ? JSON.parse(analysis.clinicalAnswers) 
            : analysis.clinicalAnswers;
          context += `Clinical Questions Analyzed: ${Object.keys(clinicalData || {}).length}\n`;
        } catch (e) {
          context += `Clinical Questions Analyzed: Available but unparseable\n`;
        }
      }
      if (analysis.commercialAnswers) {
        try {
          const commercialData = typeof analysis.commercialAnswers === 'string' 
            ? JSON.parse(analysis.commercialAnswers) 
            : analysis.commercialAnswers;
          context += `Commercial Questions Analyzed: ${Object.keys(commercialData || {}).length}\n`;
        } catch (e) {
          context += `Commercial Questions Analyzed: Available but unparseable\n`;
        }
      }
      if (analysis.research_answers) {
        try {
          const researchData = typeof analysis.research_answers === 'string' 
            ? JSON.parse(analysis.research_answers) 
            : analysis.research_answers;
          context += `Research Questions Analyzed: ${Object.keys(researchData || {}).length}\n`;
        } catch (e) {
          context += `Research Questions Analyzed: Available but unparseable\n`;
        }
      }
    });

    // Add company research
    if (data.companyResearch) {
      context += `
=== COMPANY RESEARCH ===
CEO: ${data.companyResearch.ceoName || 'Unknown'}
Financial Data: ${data.companyResearch.financialData ? 'Available' : 'Not available'}
AI Analysis: ${data.companyResearch.aiAnalysis ? 'Available' : 'Not available'}
`;
    }

    // Add AI evaluation
    if (data.aiEvaluation) {
      context += `
=== AI EVALUATION ===
Overall Score: ${data.aiEvaluation.overallScore || 'Not scored'}
Recommendation: ${data.aiEvaluation.recommendation || 'No recommendation'}
`;
    }

    return context;
  }

  private async generateExecutiveSummary(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system", 
        content: `You are an expert investment analyst creating executive summaries for venture capital investment memos. Generate a comprehensive 3-4 paragraph executive summary that captures:

1. Company overview and value proposition
2. Market opportunity and timing
3. Competitive advantages and key differentiators  
4. Investment thesis and potential returns

Use professional VC language and be specific about business metrics, market size, and growth potential. The summary should be compelling yet balanced.`
      }, {
        role: "user",
        content: `Based on the following comprehensive analysis, create an executive summary for this investment opportunity:\n\n${context}`
      }],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content || '';
  }

  private async generateInvestmentHighlights(context: string): Promise<string[]> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate 5-7 key investment highlights as bullet points. Each highlight should be a compelling reason to invest, backed by specific data or competitive advantages. Format as JSON array of strings.`
      }, {
        role: "user", 
        content: `Based on this analysis, identify the key investment highlights:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.6
    });

    const result = JSON.parse(response.choices[0].message.content || '{"highlights": []}');
    return result.highlights || [];
  }

  private async generateMarketAnalysis(context: string): Promise<InvestmentMemoSections['marketAnalysis']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate a comprehensive market analysis with specific sections for market context, market size (TAM/SAM/SOM), competitive landscape, and market timing. Provide realistic market size estimates and cite sources when possible. Format as JSON with the required structure.`
      }, {
        role: "user",
        content: `Analyze the market opportunity based on this data:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      marketContext: result.marketContext || '',
      marketSize: {
        tam: result.marketSize?.tam || '',
        sam: result.marketSize?.sam || '',
        som: result.marketSize?.som || ''
      },
      competitiveLandscape: result.competitiveLandscape || '',
      marketTiming: result.marketTiming || ''
    };
  }

  private async generateProductAnalysis(context: string): Promise<InvestmentMemoSections['productAnalysis']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze the product/technology including overview, technology advantages, competitive edge, and development stage. Focus on technical differentiation and IP protection. Format as JSON.`
      }, {
        role: "user",
        content: `Analyze the product based on this information:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      productOverview: result.productOverview || '',
      technologyAdvantage: result.technologyAdvantage || '',
      competitiveEdge: result.competitiveEdge || '',
      developmentStage: result.developmentStage || ''
    };
  }

  private async generateBusinessModel(context: string): Promise<InvestmentMemoSections['businessModel']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze the business model including revenue model, pricing strategy, sales channels, and customer acquisition. Focus on scalability and unit economics. Format as JSON.`
      }, {
        role: "user",
        content: `Analyze the business model:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      revenueModel: result.revenueModel || '',
      pricingStrategy: result.pricingStrategy || '',
      salesChannels: result.salesChannels || '',
      customerAcquisition: result.customerAcquisition || ''
    };
  }

  private async generateTeamAssessment(context: string): Promise<InvestmentMemoSections['teamAssessment']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Extract SPECIFIC management team details from the provided documents. Focus on finding exact names, titles, and backgrounds:

REQUIRED EXTRACTIONS:
- CEO: Full name, background, previous companies
- CTO: Name, technical expertise, previous roles  
- CFO: Name, financial background, experience
- Founders: Names, roles, equity stakes
- Key Personnel: Department heads, senior managers with names and roles
- Advisory Board: Specific advisor names and their expertise
- Board of Directors: Member names and their backgrounds

Return as JSON with these fields:
{
  "management": "Detailed description with specific names and roles",
  "keyPersonnel": ["Person 1: Role - Background", "Person 2: Role - Background"],
  "advisors": "Specific advisor names and their expertise",
  "boardComposition": "Board member names and their backgrounds"
}

Use ONLY information found in documents. If names/details not found, state "Not found in available documents".`
      }, {
        role: "user",
        content: `Extract specific team information from documents:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      management: result.management || '',
      keyPersonnel: result.keyPersonnel || [],
      advisors: result.advisors || '',
      boardComposition: result.boardComposition || ''
    };
  }

  private async generateFinancialAnalysis(context: string): Promise<InvestmentMemoSections['financialAnalysis']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze the financials including current financial status, projections, funding history, and use of funds. Focus on burn rate, runway, and path to profitability. Format as JSON.`
      }, {
        role: "user",
        content: `Analyze the financials:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      currentFinancials: result.currentFinancials || '',
      projections: result.projections || '',
      fundingHistory: result.fundingHistory || '',
      useOfFunds: result.useOfFunds || ''
    };
  }

  private async generateRiskAssessment(context: string): Promise<InvestmentMemoSections['riskAssessment']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Identify and categorize key risks across technical, market, competitive, regulatory, and management dimensions. Be specific and quantify risks where possible. Format as JSON with arrays for each risk category.`
      }, {
        role: "user",
        content: `Identify key risks:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      technicalRisks: result.technicalRisks || [],
      marketRisks: result.marketRisks || [],
      competitiveRisks: result.competitiveRisks || [],
      regulatoryRisks: result.regulatoryRisks || [],
      managementRisks: result.managementRisks || []
    };
  }

  private async generateLegalAssessment(context: string): Promise<InvestmentMemoSections['legalAssessment']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Assess legal aspects including corporate structure, IP protection, regulatory compliance, and contractual obligations. Focus on legal risks and protections. Format as JSON.`
      }, {
        role: "user",
        content: `Assess legal aspects:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      corporateStructure: result.corporateStructure || '',
      ipProtection: result.ipProtection || '',
      regulatoryCompliance: result.regulatoryCompliance || '',
      contractualObligations: result.contractualObligations || ''
    };
  }

  private async generateSWOTAnalysis(context: string): Promise<InvestmentMemoSections['swotAnalysis']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate a comprehensive SWOT analysis with 4-6 items in each category. Be specific and actionable. Format as JSON with arrays for each SWOT category.`
      }, {
        role: "user",
        content: `Generate SWOT analysis:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      opportunities: result.opportunities || [],
      threats: result.threats || []
    };
  }

  private async generateInvestmentTerms(context: string): Promise<InvestmentMemoSections['investmentTerms']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze and propose investment terms including valuation, funding amount, securities type, board rights, and liquidation preferences. Be specific about terms and justifications. Format as JSON.`
      }, {
        role: "user",
        content: `Propose investment terms:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      valuation: result.valuation || '',
      fundingAmount: result.fundingAmount || '',
      securities: result.securities || '',
      boardRights: result.boardRights || '',
      liquidationPreference: result.liquidationPreference || ''
    };
  }

  private async generateRecommendation(context: string): Promise<InvestmentMemoSections['recommendation']> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Provide a clear investment recommendation (INVEST/PASS/INVESTIGATE) with detailed rationale, key milestones to track, and potential exit strategies. Be decisive and specific. Format as JSON.`
      }, {
        role: "user",
        content: `Provide investment recommendation:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.6
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      investment_recommendation: result.investment_recommendation || '',
      rationale: result.rationale || '',
      keyMilestones: result.keyMilestones || [],
      exitStrategy: result.exitStrategy || ''
    };
  }

  // ==================== COMPREHENSIVE 30-50 PAGE MEMO METHODS ====================

  private async generateCoverPage(data: ComprehensiveMemoData): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    
    // Extract comprehensive company information from all documents
    const companyInfo = await this.extractCompanyInformation(data);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate a professional investment memo cover page matching the BAIBYS format. Extract and include SPECIFIC company information from the provided documents:

REQUIRED COMPANY DETAILS TO EXTRACT:
- CEO full name and background
- CTO, CFO, and key executive names and roles  
- Exact headquarters address (city, country)
- Incorporation date and jurisdiction
- Detailed shareholding structure and ownership percentages
- Board composition with specific names
- Employee count and key departments
- Office locations
- Company registration details

Format as clean markdown with proper headers, bullet points, and professional structure. DO NOT use HTML - only markdown formatting. Use ONLY information found in the actual documents - do not generate placeholder or generic information.`
      }, {
        role: "user",
        content: `Generate detailed cover page for ${data.companyName}. Extract specific company information from these ${data.documents.length} documents:

${companyInfo}

Focus on extracting actual names, dates, addresses, and specific details mentioned in the documents.`
      }],
      temperature: 0.3
    });

    return response.choices[0].message.content || '';
  }

  private async extractCompanyInformation(data: ComprehensiveMemoData): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    
    let comprehensiveAnalysis = '';
    
    // First, extract from agent analyses (these contain detailed extracted information)
    comprehensiveAnalysis += `\n=== DETAILED AGENT ANALYSES FOR COMPANY INFORMATION EXTRACTION ===\n`;
    
    data.agentAnalyses.forEach(analysis => {
      comprehensiveAnalysis += `\n--- ${analysis.agentType.toUpperCase()} AGENT ANALYSIS ---\n`;
      comprehensiveAnalysis += `Status: ${analysis.status}\n`;
      
      // Extract specific analysis content based on agent type
      if (analysis.legalAnswers) {
        try {
          const legalData = typeof analysis.legalAnswers === 'string' 
            ? JSON.parse(analysis.legalAnswers) 
            : analysis.legalAnswers;
          comprehensiveAnalysis += `LEGAL ANALYSIS:\n${JSON.stringify(legalData, null, 2).substring(0, 3000)}\n`;
        } catch (e) {
          comprehensiveAnalysis += `LEGAL ANALYSIS: ${analysis.legalAnswers.toString().substring(0, 2000)}\n`;
        }
      }
      
      if (analysis.commercialAnswers) {
        try {
          const commercialData = typeof analysis.commercialAnswers === 'string' 
            ? JSON.parse(analysis.commercialAnswers) 
            : analysis.commercialAnswers;
          comprehensiveAnalysis += `COMMERCIAL ANALYSIS:\n${JSON.stringify(commercialData, null, 2).substring(0, 3000)}\n`;
        } catch (e) {
          comprehensiveAnalysis += `COMMERCIAL ANALYSIS: ${analysis.commercialAnswers.toString().substring(0, 2000)}\n`;
        }
      }
      
      if (analysis.research_answers) {
        try {
          const researchData = typeof analysis.research_answers === 'string' 
            ? JSON.parse(analysis.research_answers) 
            : analysis.research_answers;
          comprehensiveAnalysis += `RESEARCH ANALYSIS:\n${JSON.stringify(researchData, null, 2).substring(0, 3000)}\n`;
        } catch (e) {
          comprehensiveAnalysis += `RESEARCH ANALYSIS: ${analysis.research_answers.toString().substring(0, 2000)}\n`;
        }
      }
      
      if (analysis.hr_answers) {
        try {
          const hrData = typeof analysis.hr_answers === 'string' 
            ? JSON.parse(analysis.hr_answers) 
            : analysis.hr_answers;
          comprehensiveAnalysis += `HR ANALYSIS:\n${JSON.stringify(hrData, null, 2).substring(0, 3000)}\n`;
        } catch (e) {
          comprehensiveAnalysis += `HR ANALYSIS: ${analysis.hr_answers.toString().substring(0, 2000)}\n`;
        }
      }
      
      // Add findings and recommendations
      if (analysis.findings && analysis.findings.length > 0) {
        comprehensiveAnalysis += `FINDINGS:\n`;
        analysis.findings.forEach((finding, idx) => {
          comprehensiveAnalysis += `${idx + 1}. ${finding.content || finding}\n`;
        });
      }
      
      if (analysis.recommendations && analysis.recommendations.length > 0) {
        comprehensiveAnalysis += `RECOMMENDATIONS:\n`;
        analysis.recommendations.forEach((rec, idx) => {
          comprehensiveAnalysis += `${idx + 1}. ${rec.content || rec.description || rec}\n`;
        });
      }
      
      comprehensiveAnalysis += `\n`;
    });

    // Add document summaries
    comprehensiveAnalysis += `\n=== DOCUMENT SUMMARIES ===\n`;
    data.documents.forEach((doc, index) => {
      const content = safeGetDocumentContent(doc);
      const summary = content.summary || doc.summary || '';
      const aiSummary = content.executiveSummary || (content.aiSummary && content.aiSummary.executiveSummary) || '';
      
      if (summary || aiSummary) {
        comprehensiveAnalysis += `
DOCUMENT ${index + 1}: ${doc.name}
TYPE: ${doc.type || doc.documentType || 'Unknown'}
SUMMARY: ${summary}
AI SUMMARY: ${aiSummary}
---
`;
      }
    });

    // Use AI to extract specific company information from comprehensive analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `You are a corporate information extraction expert. Extract SPECIFIC company details from the provided agent analyses and document summaries. Focus on finding:

1. Executive Team: CEO, CTO, CFO, founders (exact names and titles from HR/Legal analysis)
2. Corporate Details: headquarters address, incorporation date, registration number (from Legal analysis)
3. Shareholding: ownership percentages, investor names, share classes (from Legal/Commercial analysis)
4. Governance: board members, advisory board members with names (from Legal/HR analysis)
5. Company Structure: subsidiaries, office locations, employee count (from Commercial/HR analysis)
6. Financial Details: funding rounds, valuation, revenue figures (from Commercial analysis)
7. Key Partnerships: major agreements, distribution deals (from Commercial analysis)

Extract exact names, dates, addresses, and percentages where mentioned. If specific information is not found in the analyses, state "Not found in available analyses" for that category. Format as structured text with clear sections.`
      }, {
        role: "user",
        content: `Extract detailed company information for ${data.companyName} from these comprehensive analyses:

${comprehensiveAnalysis.substring(0, 15000)}...`
      }],
      temperature: 0.1
    });

    return response.choices[0].message.content || 'No company information could be extracted from the available analyses and documents.';
  }

  private async generateTAMSAMSOMAnalysis(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive TAM/SAM/SOM analysis with detailed market sizing tables, metrics, estimates, sources, and assumptions. Include specific numbers, growth rates, and market penetration calculations. Format as clean markdown with tables, headers, and detailed explanations. DO NOT use HTML - only markdown formatting.`
      }, {
        role: "user",
        content: `Generate TAM/SAM/SOM analysis:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateCompetitiveAnalysis(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive competitive analysis including direct competitors, indirect competitors, competitive advantages, barriers to entry, market positioning, and competitive threats. Provide detailed analysis with specific companies and their positioning. Format as clean markdown with headers, bullet points, and tables. DO NOT use HTML - only markdown formatting.`
      }, {
        role: "user",
        content: `Analyze competition:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateTechnologyAssessment(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive technology assessment including technology overview, innovation advantages, technical differentiators, development roadmap, scalability analysis, and technical risks. Focus on deep technical analysis based on all available technical documentation.`
      }, {
        role: "user",
        content: `Assess technology:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateCommercialStrategy(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive commercial strategy analysis including go-to-market strategy, sales channels, customer acquisition, pricing strategy, market entry plans, partnership strategy, and commercialization timeline.`
      }, {
        role: "user",
        content: `Analyze commercial strategy:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateManagementAnalysis(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive management team analysis including detailed leadership profiles with SPECIFIC names, exact experience backgrounds, track records, key achievements, team strengths, organizational structure, advisory board members, and management gaps. 

EXTRACT SPECIFIC DETAILS FROM DOCUMENTS:
- CEO: Full name, educational background, previous companies, years of experience
- CTO: Technical background, patents, previous roles, expertise areas
- CFO: Financial experience, previous companies, qualifications
- Founders: Names, roles, founding story, equity distribution
- Board Members: Names, backgrounds, board roles, expertise
- Key Employees: Department heads, senior management, technical leads
- Advisory Board: Specific advisors, their backgrounds, and value-add

Use ONLY information found in the actual documents. If specific details are not found, clearly state what information is missing. Format as clean markdown with detailed profiles. DO NOT use HTML - only markdown formatting.`
      }, {
        role: "user",
        content: `Extract and analyze detailed management team information:\n\n${context}`
      }],
      temperature: 0.3
    });

    return response.choices[0].message.content || '';
  }

  private async generateFinancialProjections(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive financial projections including revenue forecasts, cost structure analysis, profitability projections, cash flow analysis, funding requirements, burn rate analysis, and financial milestones. Include detailed 5-year projections with assumptions.`
      }, {
        role: "user",
        content: `Generate financial projections:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateValuationAnalysis(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive valuation analysis including multiple valuation methodologies (DCF, comparable companies, precedent transactions), valuation ranges, key valuation drivers, valuation sensitivity analysis, and investment returns analysis.`
      }, {
        role: "user",
        content: `Analyze valuation:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateRegulatoryAnalysis(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive regulatory analysis including regulatory landscape, approval requirements, regulatory pathways, compliance status, regulatory risks, regulatory timeline, and regulatory strategy. Be specific about regulatory bodies and requirements.`
      }, {
        role: "user",
        content: `Analyze regulatory environment:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateClinicalAssessment(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive clinical assessment including clinical trial strategy, clinical endpoints, trial design, regulatory pathway, clinical risks, clinical timeline, and evidence requirements. Focus on clinical development plan and regulatory approval strategy.`
      }, {
        role: "user",
        content: `Assess clinical strategy:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateIPAnalysis(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive intellectual property analysis including patent portfolio assessment, IP strategy, freedom to operate, IP risks, competitive IP landscape, IP valuation, and IP protection strategy. Include specific patent analysis from available documents.`
      }, {
        role: "user",
        content: `Analyze IP portfolio:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateResearchInsights(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive research insights including scientific background, research methodology, research findings, publications, research partnerships, research roadmap, and competitive research landscape. Focus on technical and scientific differentiation.`
      }, {
        role: "user",
        content: `Analyze research insights:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateMitigationStrategies(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive risk mitigation strategies for each identified risk category. Include specific mitigation plans, contingency strategies, monitoring mechanisms, and success metrics. Be detailed and actionable.`
      }, {
        role: "user",
        content: `Generate risk mitigation strategies:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateExitStrategy(context: string): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive exit strategy analysis including potential acquirers, IPO potential, strategic alternatives, exit timing, valuation expectations, and exit value creation strategies. Include specific strategic buyers and rationale.`
      }, {
        role: "user",
        content: `Analyze exit strategies:\n\n${context}`
      }],
      temperature: 0.7
    });

    return response.choices[0].message.content || '';
  }

  private async generateAppendices(data: ComprehensiveMemoData): Promise<string> {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system", 
        content: `Generate comprehensive appendices including detailed financial models, market research citations, technical specifications, regulatory documentation references, patent listings, management bios, and supporting analysis. Format as clean markdown with headers, bullet points, and organized sections. DO NOT use HTML - only markdown formatting.`
      }, {
        role: "user",
        content: `Generate appendices for ${data.companyName} with ${data.documents.length} documents and ${data.agentAnalyses.length} analyses`
      }],
      temperature: 0.6
    });

    return response.choices[0].message.content || '';
  }

  private async storeMemo(dealId: number, memo: InvestmentMemoSections): Promise<void> {
    try {
      // Store the complete memo in the database (TODO: implement storage method)
      console.log(`💾 Investment memo ready for deal ${dealId} (storage not yet implemented)`);
      // await storage.storeInvestmentMemo(dealId, memo);
    } catch (error) {
      console.error(`❌ Error storing investment memo for deal ${dealId}:`, error);
      throw error;
    }
  }

}

export const investmentMemoService = new InvestmentMemoService();