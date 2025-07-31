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

    // Get all documents with AI summaries and OCR content
    const documents = await storage.getDocumentsByDealId(dealId);
    console.log(`📄 Found ${documents.length} documents for deal ${dealId}`);

    // Get all agent analyses 
    const agentAnalyses = await storage.getAnalysesByDealId(dealId);
    console.log(`🤖 Found ${agentAnalyses.length} agent analyses for deal ${dealId}`);

    // Get company research and AI evaluation (if available)
    const companyResearch = null; // TODO: implement
    const aiEvaluation = null; // TODO: implement

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

    // Prepare comprehensive context for AI using ALL documents and analyses
    const context = await this.prepareComprehensiveAnalysisContext(data);
    
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

  /**
   * COMPREHENSIVE DATA EXTRACTION - Uses ALL documents, OCR text, and agent analyses
   * This is the core method that extracts maximum information for quality memo generation
   */
  private async prepareComprehensiveAnalysisContext(data: ComprehensiveMemoData): Promise<string> {
    console.log(`🔍 Extracting comprehensive data from ${data.documents.length} documents and ${data.agentAnalyses.length} analyses`);
    
    let context = `
COMPREHENSIVE INVESTMENT ANALYSIS FOR ${data.companyName}
=========================================================

=== DEAL INFORMATION ===
Company: ${data.companyName}
Deal ID: ${data.dealId}
Total Documents: ${data.documents.length}
Total Agent Analyses: ${data.agentAnalyses.length}

`;

    // ========== EXTRACT FROM ALL DOCUMENT OCR CONTENT ==========
    context += `=== COMPREHENSIVE DOCUMENT OCR CONTENT (${data.documents.length} documents) ===\n\n`;
    
    data.documents.forEach((doc, index) => {
      let documentContent = '';
      
      // Extract COMPLETE OCR text (highest priority for specific details)
      if (doc.ocrText && typeof doc.ocrText === 'string' && doc.ocrText.trim().length > 100) {
        // Use FULL OCR text - no truncation for comprehensive data extraction
        documentContent += `OCR CONTENT:\n${doc.ocrText}\n`;
        console.log(`📄 Document ${index + 1} (${doc.name}): Using ${doc.ocrText.length} characters of OCR text`);
      }
      
      // Extract AI summary content
      if (doc.aiSummary) {
        try {
          let summaryText = '';
          if (typeof doc.aiSummary === 'string') {
            summaryText = doc.aiSummary;
          } else if (typeof doc.aiSummary === 'object') {
            if (doc.aiSummary.executiveSummary) summaryText += doc.aiSummary.executiveSummary + '\n';
            if (doc.aiSummary.criticalFindings) summaryText += (Array.isArray(doc.aiSummary.criticalFindings) ? doc.aiSummary.criticalFindings.join('\n') : doc.aiSummary.criticalFindings) + '\n';
            if (doc.aiSummary.keyFinancialData) summaryText += (Array.isArray(doc.aiSummary.keyFinancialData) ? doc.aiSummary.keyFinancialData.join('\n') : doc.aiSummary.keyFinancialData) + '\n';
            if (doc.aiSummary.strategicImplications) summaryText += doc.aiSummary.strategicImplications;
          }
          if (summaryText.trim().length > 50) {
            documentContent += `\nAI SUMMARY:\n${summaryText}\n`;
          }
        } catch (e) {
          console.warn('Error extracting AI summary:', e);
        }
      }
      
      if (documentContent.trim().length > 0) {
        context += `
========== DOCUMENT ${index + 1}: ${doc.name} ==========
File Type: ${doc.contentType || 'Unknown'}
Size: ${doc.size || 'Unknown'} bytes

${documentContent}
=============================================

`;
      }
    });

    // ========== EXTRACT FROM ALL AGENT ANALYSES ==========
    context += `\n=== COMPREHENSIVE AGENT ANALYSES (${data.agentAnalyses.length} analyses) ===\n\n`;
    
    data.agentAnalyses.forEach(analysis => {
      context += `
========== ${analysis.agentType.toUpperCase()} AGENT ANALYSIS ==========
Status: ${analysis.status}
Findings: ${analysis.findings?.length || 0}
Recommendations: ${analysis.recommendations?.length || 0}

`;

      // Extract ALL analysis content based on agent type
      const extractAnalysisContent = (answers: any, label: string) => {
        if (!answers) return;
        
        try {
          const data = typeof answers === 'string' ? JSON.parse(answers) : answers;
          context += `${label} ANALYSIS CONTENT:\n`;
          
          if (typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
              const content = typeof value === 'string' ? value : JSON.stringify(value);
              context += `${key}: ${content.substring(0, 1000)}\n`;
            });
          }
        } catch (e) {
          context += `${label} ANALYSIS: ${answers.toString().substring(0, 1500)}\n`;
        }
      };

      // Extract from all agent types
      extractAnalysisContent(analysis.legalAnswers, 'LEGAL');
      extractAnalysisContent(analysis.clinicalAnswers, 'CLINICAL');
      extractAnalysisContent(analysis.commercialAnswers, 'COMMERCIAL');
      extractAnalysisContent(analysis.hrAnswers, 'HR');
      extractAnalysisContent(analysis.financialAnswers, 'FINANCIAL');
      extractAnalysisContent(analysis.ipAnswers, 'IP');
      extractAnalysisContent(analysis.researchAnswers, 'RESEARCH');

      // Add findings and recommendations
      if (analysis.findings && Array.isArray(analysis.findings)) {
        context += `\nFINDINGS:\n`;
        analysis.findings.forEach((finding, index) => {
          const content = typeof finding === 'string' ? finding : (finding.content || JSON.stringify(finding));
          context += `${index + 1}. ${content.substring(0, 500)}\n`;
        });
      }
      
      if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
        context += `\nRECOMMENDATIONS:\n`;
        analysis.recommendations.forEach((rec, index) => {
          const content = typeof rec === 'string' ? rec : (rec.content || rec.description || JSON.stringify(rec));
          context += `${index + 1}. ${content.substring(0, 500)}\n`;
        });
      }
      
      context += `=============================================\n\n`;
    });

    return context;
  }

  // ==================== COVER PAGE WITH COMPREHENSIVE COMPANY DETAILS ====================

  private async generateCoverPage(data: ComprehensiveMemoData): Promise<string> {
    console.log(`📋 Generating comprehensive cover page with detailed company information`);
    
    // Extract comprehensive company information from ALL sources
    const companyInfo = await this.extractComprehensiveCompanyInformation(data);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "system",
        content: `Generate a professional investment memo cover page matching the BAIBYS format. Extract and include SPECIFIC company information from the provided comprehensive analysis:

REQUIRED COMPANY DETAILS TO EXTRACT:
- CEO full name, background, and experience
- CTO, CFO, founders, and key executive names with roles  
- Exact headquarters address (street, city, country)
- Incorporation date, jurisdiction, and registration details
- Detailed shareholding structure with owner names and percentages
- Board composition with specific member names and backgrounds
- Employee count, department structure, and office locations
- Company registration number and corporate structure
- Major partnerships, investors, and funding history

FORMAT REQUIREMENTS:
- Use clean markdown formatting ONLY (no HTML)
- Include professional headers and structure
- Use bullet points and tables for clarity
- Extract ONLY information found in actual documents
- If information is not found, state "Not available in documents"
- Focus on specific names, dates, addresses, and percentages`
      }, {
        role: "user",
        content: `Generate comprehensive cover page for ${data.companyName} investment memo.

Use this extracted company information:

${companyInfo}`
      }],
      temperature: 0.2,
      max_tokens: 2500
    });

    return response.choices[0].message.content || '';
  }

  private async extractComprehensiveCompanyInformation(data: ComprehensiveMemoData): Promise<string> {
    console.log(`🔍 Extracting specific company details from ${data.documents.length} documents and ${data.agentAnalyses.length} analyses`);
    
    // Prepare comprehensive context with focus on company-specific details
    const comprehensiveContent = await this.prepareComprehensiveAnalysisContext(data);
    
    // Use AI to extract specific company information
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "system",
        content: `You are an expert data extraction specialist. Extract SPECIFIC company information from comprehensive document analysis and agent reports.

EXTRACT THESE SPECIFIC DETAILS (only if found):
1. EXECUTIVE TEAM:
   - CEO: Full name, educational background, previous experience, years with company
   - CTO: Technical background, patents, previous companies, expertise areas
   - CFO: Financial experience, qualifications, previous roles
   - Founders: Names, founding roles, equity distribution, backgrounds
   - Other Executives: Department heads, senior management with specific names

2. CORPORATE DETAILS:
   - Exact headquarters address (street, city, state/country)
   - Incorporation date and jurisdiction
   - Company registration number
   - Corporate structure (LLC, Corporation, etc.)
   - Office locations with addresses

3. SHAREHOLDING & GOVERNANCE:
   - Ownership percentages with specific shareholder names
   - Share classes and voting rights
   - Board members with full names and backgrounds
   - Advisory board members and their expertise
   - Major investors with investment amounts and dates

4. COMPANY STRUCTURE:
   - Total employee count
   - Department structure and key department heads
   - Subsidiary companies
   - Key partnerships and strategic alliances

5. FINANCIAL INFORMATION:
   - Funding rounds with dates, amounts, and investor names
   - Current valuation
   - Revenue figures (if disclosed)
   - Major contracts or agreements

CRITICAL: Extract only factual information explicitly mentioned in the documents. If specific information is not found, clearly state "Not found in available documents" for that category. Provide exact names, dates, addresses, and percentages where available.`
      }, {
        role: "user",
        content: `Extract detailed company information for ${data.companyName} from this comprehensive analysis:

${comprehensiveContent.substring(0, 80000)}...

Focus on finding specific executive names, corporate details, addresses, shareholding information, and governance structures mentioned in the documents and agent analyses. Look through ALL the OCR content for any mention of CEO names, addresses, incorporation details, shareholding percentages, board members, etc.`
      }],
      temperature: 0.1,
      max_tokens: 3000
    });

    return response.choices[0].message.content || 'No specific company information could be extracted from the available documents and analyses.';
  }

  // ==================== MEMO SECTION GENERATORS ====================

  private async generateExecutiveSummary(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "system", 
        content: `Generate a comprehensive 3-4 paragraph executive summary for a venture capital investment memo. Include:
        
1. Company overview and core value proposition
2. Market opportunity size and growth potential
3. Competitive advantages and key differentiators  
4. Investment thesis and expected returns
5. Management team strength and execution capability

Use professional VC language with specific metrics, market data, and growth projections from the analysis.`
      }, {
        role: "user",
        content: `Generate executive summary based on this comprehensive analysis:\n\n${context.substring(0, 50000)}`
      }],
      temperature: 0.7,
      max_tokens: 1500
    });

    return response.choices[0].message.content || '';
  }

  private async generateInvestmentHighlights(context: string): Promise<string[]> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "system",
        content: `Generate 5-7 compelling investment highlights as bullet points. Each highlight should be a specific, data-backed reason to invest. Format as JSON array of strings.`
      }, {
        role: "user", 
        content: `Identify key investment highlights:\n\n${context.substring(0, 30000)}`
      }],
      response_format: { type: "json_object" },
      temperature: 0.6
    });

    const result = JSON.parse(response.choices[0].message.content || '{"highlights": []}');
    return result.highlights || [];
  }

  private async generateSWOTAnalysis(context: string): Promise<InvestmentMemoSections['swotAnalysis']> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "system",
        content: `Generate comprehensive SWOT analysis with specific, actionable points for each category. Format as JSON with arrays for strengths, weaknesses, opportunities, and threats.`
      }, {
        role: "user",
        content: `Generate SWOT analysis:\n\n${context.substring(0, 30000)}`
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

  private async generateMarketAnalysis(context: string): Promise<InvestmentMemoSections['marketAnalysis']> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "system",
        content: `Generate comprehensive market analysis including market context, TAM/SAM/SOM sizing, competitive landscape, and market timing. Use specific market data and growth projections. Format as JSON.`
      }, {
        role: "user",
        content: `Analyze market opportunity:\n\n${context.substring(0, 30000)}`
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

  // Additional section generators follow the same pattern...
  // (Continuing with abbreviated versions for space)

  private async generateProductAnalysis(context: string): Promise<InvestmentMemoSections['productAnalysis']> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze product/technology including overview, advantages, competitive edge, and development stage. Format as JSON.`
      }, {
        role: "user",
        content: `Analyze product:\n\n${context.substring(0, 8000)}`
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze business model including revenue model, pricing, sales channels, and customer acquisition. Format as JSON.`
      }, {
        role: "user",
        content: `Analyze business model:\n\n${context.substring(0, 8000)}`
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Assess management team, key personnel, advisors, and board composition with specific names and backgrounds. Format as JSON.`
      }, {
        role: "user",
        content: `Assess team:\n\n${context.substring(0, 8000)}`
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze current financials, projections, funding history, and use of funds. Format as JSON.`
      }, {
        role: "user",
        content: `Analyze financials:\n\n${context.substring(0, 8000)}`
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

  private async generateLegalAssessment(context: string): Promise<InvestmentMemoSections['legalAssessment']> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Assess corporate structure, IP protection, regulatory compliance, and contractual obligations. Format as JSON.`
      }, {
        role: "user",
        content: `Assess legal aspects:\n\n${context.substring(0, 8000)}`
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

  private async generateRiskAssessment(context: string): Promise<InvestmentMemoSections['riskAssessment']> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Identify and categorize risks across technical, market, competitive, regulatory, and management areas. Format as JSON with arrays for each risk category.`
      }, {
        role: "user",
        content: `Assess risks:\n\n${context.substring(0, 8000)}`
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

  private async generateInvestmentTerms(context: string): Promise<InvestmentMemoSections['investmentTerms']> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Propose investment terms including valuation, funding amount, securities, board rights, and liquidation preferences. Format as JSON.`
      }, {
        role: "user",
        content: `Propose investment terms:\n\n${context.substring(0, 8000)}`
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
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Provide clear investment recommendation (INVEST/PASS/INVESTIGATE) with detailed rationale, key milestones, and exit strategy. Format as JSON.`
      }, {
        role: "user",
        content: `Provide investment recommendation:\n\n${context.substring(0, 8000)}`
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

  // String-based section generators for remaining sections
  private async generateTAMSAMSOMAnalysis(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate detailed TAM/SAM/SOM analysis with market sizing, methodology, and supporting data.`
      }, {
        role: "user",
        content: `Generate TAM/SAM/SOM analysis:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateCompetitiveAnalysis(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze competitive landscape including competitors, advantages, market positioning, and differentiation.`
      }, {
        role: "user",
        content: `Generate competitive analysis:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateTechnologyAssessment(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Assess technology stack, innovation, IP protection, technical risks, and development roadmap.`
      }, {
        role: "user",
        content: `Generate technology assessment:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateCommercialStrategy(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze go-to-market strategy, sales approach, customer acquisition, and partnerships.`
      }, {
        role: "user",
        content: `Generate commercial strategy:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateManagementAnalysis(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze management team backgrounds, experience, track record, and organizational capabilities with specific names.`
      }, {
        role: "user",
        content: `Generate management analysis:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.3
    });
    return response.choices[0].message.content || '';
  }

  private async generateFinancialProjections(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate detailed financial projections including revenue models, cost structure, and growth assumptions.`
      }, {
        role: "user",
        content: `Generate financial projections:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateValuationAnalysis(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze valuation using multiple methodologies including DCF, comparable companies, and precedent transactions.`
      }, {
        role: "user",
        content: `Generate valuation analysis:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateRegulatoryAnalysis(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze regulatory environment, compliance requirements, and pathway to market approval.`
      }, {
        role: "user",
        content: `Generate regulatory analysis:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateClinicalAssessment(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Assess clinical development plan, trial design, regulatory pathway, and clinical risks.`
      }, {
        role: "user",
        content: `Generate clinical assessment:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateIPAnalysis(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze intellectual property portfolio, patent landscape, and IP protection strategy.`
      }, {
        role: "user",
        content: `Generate IP analysis:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateResearchInsights(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Provide research insights including scientific foundation, technical innovation, and research differentiation.`
      }, {
        role: "user",
        content: `Generate research insights:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateMitigationStrategies(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Develop comprehensive risk mitigation strategies with specific action plans and contingencies.`
      }, {
        role: "user",
        content: `Generate risk mitigation strategies:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateExitStrategy(context: string): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Analyze potential exit strategies including IPO readiness, strategic acquisition targets, and exit timing.`
      }, {
        role: "user",
        content: `Generate exit strategy:\n\n${context.substring(0, 10000)}`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async generateAppendices(data: ComprehensiveMemoData): Promise<string> {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "system",
        content: `Generate comprehensive appendices including supporting data, financial models, market research, and technical specifications.`
      }, {
        role: "user",
        content: `Generate appendices for comprehensive investment memo with ${data.documents.length} documents and ${data.agentAnalyses.length} analyses.`
      }],
      temperature: 0.7
    });
    return response.choices[0].message.content || '';
  }

  private async storeMemo(dealId: number, memo: InvestmentMemoSections): Promise<void> {
    console.log(`💾 Investment memo ready for deal ${dealId} - comprehensive 30-50 page memo generated`);
    // TODO: Implement memo storage in database
  }
}

export const investmentMemoService = new InvestmentMemoService();