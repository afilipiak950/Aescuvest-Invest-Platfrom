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
  executiveSummary: string;
  investmentHighlights: string[];
  marketAnalysis: {
    marketContext: string;
    marketSize: {
      tam: string;
      sam: string;
      som: string;
    };
    competitiveLandscape: string;
    marketTiming: string;
  };
  productAnalysis: {
    productOverview: string;
    technologyAdvantage: string;
    competitiveEdge: string;
    developmentStage: string;
  };
  businessModel: {
    revenueModel: string;
    pricingStrategy: string;
    salesChannels: string;
    customerAcquisition: string;
  };
  teamAssessment: {
    management: string;
    keyPersonnel: string[];
    advisors: string;
    boardComposition: string;
  };
  financialAnalysis: {
    currentFinancials: string;
    projections: string;
    fundingHistory: string;
    useOfFunds: string;
  };
  riskAssessment: {
    technicalRisks: string[];
    marketRisks: string[];
    competitiveRisks: string[];
    regulatoryRisks: string[];
    managementRisks: string[];
  };
  legalAssessment: {
    corporateStructure: string;
    ipProtection: string;
    regulatoryCompliance: string;
    contractualObligations: string;
  };
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  investmentTerms: {
    valuation: string;
    fundingAmount: string;
    securities: string;
    boardRights: string;
    liquidationPreference: string;
  };
  recommendation: {
    investment_recommendation: string;
    rationale: string;
    keyMilestones: string[];
    exitStrategy: string;
  };
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
    
    // Generate all sections with comprehensive AI analysis
    const [
      executiveSummary,
      investmentHighlights,
      marketAnalysis,
      productAnalysis,
      businessModel,
      teamAssessment,
      financialAnalysis,
      riskAssessment,
      legalAssessment,
      swotAnalysis,
      investmentTerms,
      recommendation
    ] = await Promise.all([
      this.generateExecutiveSummary(context),
      this.generateInvestmentHighlights(context),
      this.generateMarketAnalysis(context),
      this.generateProductAnalysis(context),
      this.generateBusinessModel(context),
      this.generateTeamAssessment(context),
      this.generateFinancialAnalysis(context),
      this.generateRiskAssessment(context),
      this.generateLegalAssessment(context),
      this.generateSWOTAnalysis(context),
      this.generateInvestmentTerms(context),
      this.generateRecommendation(context)
    ]);

    return {
      executiveSummary,
      investmentHighlights,
      marketAnalysis,
      productAnalysis,
      businessModel,
      teamAssessment,
      financialAnalysis,
      riskAssessment,
      legalAssessment,
      swotAnalysis,
      investmentTerms,
      recommendation
    };
  }

  private prepareAnalysisContext(data: ComprehensiveMemoData): string {
    let context = `
COMPREHENSIVE INVESTMENT ANALYSIS FOR ${data.companyName}

=== DEAL INFORMATION ===
Company: ${data.companyName}
Deal ID: ${data.dealId}

=== DOCUMENT ANALYSIS ===
Total Documents: ${data.documents.length}
`;

    // Add document summaries
    data.documents.forEach((doc, index) => {
      const content = safeGetDocumentContent(doc);
      if (content.aiSummary?.executiveSummary || doc.summary) {
        context += `
Document ${index + 1}: ${doc.name}
Summary: ${content.aiSummary?.executiveSummary || doc.summary || 'No summary available'}
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
        content: `Assess the management team, key personnel, advisors, and board composition. Focus on relevant experience, track record, and team completeness. Format as JSON.`
      }, {
        role: "user",
        content: `Assess the team:\n\n${context}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.7
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