import OpenAI from 'openai';
import { storage } from '../storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// BAIBYS-style memo structure matching the reference PDF exactly
export interface BAIBYSMemoSections {
  // Cover Page - Professional layout matching BAIBYS PDF
  coverPage: {
    company: string;
    headquarters: string;
    management: string[];
    incorporation: string;
    shareholding: string[];
    proposal: string;
    keyInvestmentTerms: string[];
    investmentHighlights: string[];
  };
  
  // Executive Summary - 2-3 page comprehensive overview
  executiveSummary: string;
  
  // SWOT Analysis - Professional 4-quadrant format
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  
  // Market Analysis - Complete market landscape 
  marketAnalysis: {
    marketContext: string;
    biggerPicture: string;
    icsiDominance: string;
    reimbursementLandscape: string;
    tamSamSom: {
      tam: string;
      sam: string;
      som: string;
      tableData: {
        metric: string;
        estimate: string;
        source: string;
      }[];
    };
  };
  
  // Competitive Analysis - Detailed competitive positioning
  competitiveAnalysis: {
    currentLandscape: string;
    competitiveAdvantages: string[];
    keyCompetitors: string;
    differentiationFactors: string;
    strategicPosition: string;
  };
  
  // Technology & Product - Technical deep dive
  technologyAssessment: {
    coreInnovation: string;
    technicalSpecifications: string;
    intellectualProperty: string;
    developmentStatus: string;
    regulatoryApprovals: string;
  };
  
  // Business Model & Commercial Strategy
  businessModel: {
    revenueModel: string;
    pricingStrategy: string;
    salesChannels: string;
    customerAcquisition: string;
    scalabilityFactors: string;
  };
  
  // Financial Analysis - Comprehensive financial assessment
  financialAnalysis: {
    financialPosition: string;
    fundingHistory: string;
    useOfFunds: string;
    keyMetrics: string;
    burnAnalysis: string;
    projections: string;
  };
  
  // Management & Team Assessment
  teamAssessment: {
    leadershipTeam: string;
    advisoryBoard: string;
    organizationalStructure: string;
    keyPersonRisks: string;
    teamScaling: string;
  };
  
  // Risk Analysis - Comprehensive risk assessment  
  riskAnalysis: {
    technicalRisks: string;
    marketRisks: string;
    regulatoryRisks: string;
    competitiveRisks: string;
    operationalRisks: string;
    mitigationStrategies: string;
  };
  
  // Investment Terms & Structure
  investmentTerms: {
    dealStructure: string;
    liquidationPreference: string;
    boardRights: string;
    protectiveProvisions: string;
    antiDilution: string;
  };
  
  // Investment Recommendation - Final analysis
  recommendation: {
    investmentRationale: string;
    keySuccessFactors: string;
    monitoringMetrics: string;
    exitStrategy: string;
    finalRecommendation: string;
  };
  
  // Appendices - Supporting documentation
  appendices: {
    financialModels: string;
    marketResearch: string;
    technicalDocuments: string;
    legalDocuments: string;
  };
}

class BAIBYSStyleMemoService {

  async generateBAIBYSStyleMemo(dealId: number): Promise<BAIBYSMemoSections> {
    console.log(`🎯 Generating BAIBYS-quality investment memo for deal ${dealId}`);
    
    try {
      // 1. Gather comprehensive data
      const data = await this.gatherComprehensiveData(dealId);
      
      // 2. Create analysis context with all available information
      const context = await this.createDetailedContext(data);
      
      // 3. Generate memo sections matching BAIBYS structure
      const memo = await this.generateBAIBYSStructuredSections(data, context);
      
      // 4. Store the professional memo
      await this.storeMemo(dealId, memo);
      
      console.log(`✅ BAIBYS-quality investment memo completed for deal ${dealId}`);
      return memo;
      
    } catch (error) {
      console.error(`❌ Error generating BAIBYS-style memo for deal ${dealId}:`, error);
      throw new Error(`Failed to generate professional memo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async gatherComprehensiveData(dealId: number) {
    console.log(`📊 Gathering comprehensive data for BAIBYS-quality memo`);
    
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const documents = await storage.getDocumentsWithOCRForMemo(dealId);
    const agentAnalyses = await storage.getAnalysesByDealId(dealId);
    
    console.log(`📄 Data collected: ${documents.length} documents, ${agentAnalyses.length} analyses`);

    return {
      dealId,
      companyName: deal.companyName,
      documents,
      agentAnalyses,
      deal
    };
  }

  private async createDetailedContext(data: any): Promise<string> {
    console.log(`🔍 Creating detailed analysis context for BAIBYS-quality content`);
    
    let context = `INVESTMENT MEMO CONTEXT FOR: ${data.companyName}\n\n`;
    
    // Deal information
    context += `COMPANY INFORMATION:\n`;
    context += `- Company: ${data.companyName}\n`;
    context += `- Stage: ${data.deal.stage || 'Growth'}\n`;
    context += `- Sector: ${data.deal.description || 'Technology'}\n`;
    context += `- Location: ${data.deal.location || 'Not specified'}\n\n`;

    // Extract comprehensive OCR content
    context += `DOCUMENT INSIGHTS:\n`;
    let totalChars = 0;
    
    for (const doc of data.documents.slice(0, 50)) { // Use top 50 most relevant docs
      const ocrText = doc.ocrText || doc.ocr_text || doc['ocr_text'];
      const aiSummary = doc.aiSummary || doc.ai_summary || doc['ai_summary'];
      
      if (ocrText && typeof ocrText === 'string' && ocrText.trim().length > 200) {
        context += `Document: ${doc.name}\nContent Extract: ${ocrText.substring(0, 2000)}...\n\n`;
        totalChars += ocrText.length;
      }
      
      if (aiSummary && typeof aiSummary === 'string' && aiSummary.trim().length > 100) {
        context += `AI Summary: ${aiSummary}\n\n`;
      }
    }
    
    // Add agent analyses with full depth
    context += `COMPREHENSIVE AGENT ANALYSES:\n`;
    for (const analysis of data.agentAnalyses) {
      if (analysis.analysisResult && typeof analysis.analysisResult === 'object') {
        context += `\n--- ${analysis.agentType?.toUpperCase()} AGENT ANALYSIS ---\n`;
        context += JSON.stringify(analysis.analysisResult, null, 2) + '\n';
      }
    }
    
    console.log(`📊 Context created: ${context.length} characters from ${data.documents.length} docs and ${data.agentAnalyses.length} analyses`);
    return context;
  }

  private async generateBAIBYSStructuredSections(data: any, context: string): Promise<BAIBYSMemoSections> {
    console.log(`🎯 Generating comprehensive BAIBYS-structured memo with all sections`);

    // Generate all sections matching BAIBYS PDF structure exactly
    const [
      coverPage,
      executiveSummary, 
      swotAnalysis,
      marketAnalysis,
      competitiveAnalysis,
      technologyAssessment,
      businessModel,
      financialAnalysis,
      teamAssessment,
      riskAnalysis,
      investmentTerms,
      recommendation,
      appendices
    ] = await Promise.all([
      this.generateNewCoverPage(data, context),
      this.generateNewExecutiveSummary(data, context),
      this.generateNewSWOTAnalysis(data, context),
      this.generateNewMarketAnalysis(data, context),
      this.generateNewCompetitiveAnalysis(data, context),
      this.generateNewTechnologyAssessment(data, context),
      this.generateNewBusinessModel(data, context),
      this.generateNewFinancialAnalysis(data, context),
      this.generateNewTeamAssessment(data, context),
      this.generateNewRiskAnalysis(data, context),
      this.generateNewInvestmentTerms(data, context),
      this.generateNewRecommendation(data, context),
      this.generateNewAppendices(data, context)
    ]);

    return {
      coverPage,
      executiveSummary,
      swotAnalysis,
      marketAnalysis,
      competitiveAnalysis,
      technologyAssessment,
      businessModel,
      financialAnalysis,
      teamAssessment,
      riskAnalysis,
      investmentTerms,
      recommendation,
      appendices
    };
  }

  private async generateNewCoverPage(data: any, context: string) {
    const prompt = `Create professional cover page for ${data.companyName} investment memo matching BAIBYS PDF format exactly.

CONTEXT: ${context.substring(0, 10000)}

Generate complete cover page with:
- Company details and headquarters location
- Management team from documents  
- Incorporation details
- Shareholding structure from financial documents
- Investment proposal with specific amounts
- Key investment terms (liquidation preference, board seats, etc.)
- Investment highlights (4-5 compelling bullet points)

Return JSON with coverPage structure using AUTHENTIC data from context only. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').coverPage;
  }

  private async generateNewExecutiveSummary(data: any, context: string) {
    const prompt = `Create comprehensive 2-3 page executive summary for ${data.companyName} matching BAIBYS professional format.

CONTEXT: ${context.substring(0, 15000)}

Generate executive summary covering:
- Company founding story and mission  
- Technology innovation and differentiation
- Market opportunity and addressable market
- Business model and revenue streams
- Key achievements and milestones
- Team expertise and leadership
- Financial position and funding
- Investment opportunity and use of funds

Use authentic data from documents and analyses. Professional VC language with specific details.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 3000
    });

    return response.choices[0].message.content || '';
  }

  private async generateNewSWOTAnalysis(data: any, context: string) {
    const prompt = `Create detailed SWOT analysis for ${data.companyName} using BAIBYS 4-quadrant professional format.

CONTEXT: ${context.substring(0, 12000)}

Generate comprehensive SWOT with specific arrays:
- STRENGTHS: IP position, efficiency gains, first mover advantages, strategic partnerships
- WEAKNESSES: Commercial profile gaps, infrastructure limitations, margin pressures, team gaps  
- OPPORTUNITIES: Growing market, regulatory support, strategic leverage, geographic expansion
- THREATS: Regulatory hurdles, market adoption risks, competitive threats, technology risks

Return JSON with swotAnalysis structure - arrays of specific detailed points from authentic data. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2500
    });

    return JSON.parse(response.choices[0].message.content || '{}').swotAnalysis;
  }

  private async generateNewMarketAnalysis(data: any, context: string) {
    const prompt = `Create comprehensive market analysis for ${data.companyName} matching BAIBYS professional market section.

CONTEXT: ${context.substring(0, 12000)}

Generate detailed market analysis with:
- Market context and current landscape
- The bigger picture (global market trends)
- ICSI dominance and automation opportunity
- Reimbursement landscape by region  
- TAM/SAM/SOM analysis with specific numbers, metrics, estimates, and sources in table format

Include professional market data with authentic numbers from documents where available. Return as JSON with marketAnalysis structure.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2500
    });

    return JSON.parse(response.choices[0].message.content || '{}').marketAnalysis;
  }

  private async generateNewCompetitiveAnalysis(data: any, context: string) {
    const prompt = `Create detailed competitive analysis for ${data.companyName} based on market research.

CONTEXT: ${context.substring(0, 10000)}

Generate competitive analysis covering:
- Current competitive landscape
- Key competitive advantages
- Major competitors and positioning
- Differentiation factors  
- Strategic competitive position

Return JSON with competitiveAnalysis structure using specific competitor data. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').competitiveAnalysis;
  }

  private async generateNewTechnologyAssessment(data: any, context: string) {
    const prompt = `Create comprehensive technology assessment for ${data.companyName} based on technical documents.

CONTEXT: ${context.substring(0, 12000)}

Generate technology assessment covering:
- Core innovation and technical breakthrough
- Technical specifications and capabilities
- Intellectual property portfolio  
- Development status and roadmap
- Regulatory approvals and pathway

Return JSON with technologyAssessment structure using authentic technical data. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').technologyAssessment;
  }

  private async generateNewBusinessModel(data: any, context: string) {
    const prompt = `Create detailed business model analysis for ${data.companyName} based on commercial documents.

CONTEXT: ${context.substring(0, 10000)}

Generate business model covering:
- Revenue model and pricing strategy
- Sales channels and distribution
- Customer acquisition strategy
- Scalability factors
- Commercial execution plan

Return JSON with businessModel structure using authentic business data. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').businessModel;
  }

  private async generateNewFinancialAnalysis(data: any, context: string) {
    const prompt = `Create comprehensive financial analysis for ${data.companyName} based on financial documents.

CONTEXT: ${context.substring(0, 12000)}

Generate financial analysis covering:
- Current financial position
- Funding history and investors
- Use of funds and capital allocation
- Key financial metrics and KPIs
- Burn analysis and runway
- Financial projections and growth

Return JSON with financialAnalysis structure using authentic financial data. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').financialAnalysis;
  }

  private async generateNewTeamAssessment(data: any, context: string) {
    const prompt = `Create detailed team assessment for ${data.companyName} based on HR documents and team information.

CONTEXT: ${context.substring(0, 10000)}

Generate team assessment covering:
- Leadership team backgrounds and expertise
- Advisory board and strategic advisors  
- Organizational structure and capabilities
- Key person risks and dependencies
- Team scaling and hiring plans

Return JSON with teamAssessment structure using authentic team data. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').teamAssessment;
  }

  private async generateNewRiskAnalysis(data: any, context: string) {
    const prompt = `Create comprehensive risk analysis for ${data.companyName} based on all documents and analyses.

CONTEXT: ${context.substring(0, 12000)}

Generate risk analysis covering:
- Technical and development risks
- Market and competitive risks
- Regulatory and compliance risks
- Operational and execution risks
- Risk mitigation strategies

Return JSON with riskAnalysis structure using specific risks identified. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').riskAnalysis;
  }

  private async generateNewInvestmentTerms(data: any, context: string) {
    const prompt = `Create detailed investment terms for ${data.companyName} based on legal and investment documents.

CONTEXT: ${context.substring(0, 8000)}

Generate investment terms covering:
- Deal structure and valuation
- Liquidation preferences
- Board rights and governance
- Protective provisions
- Anti-dilution protection

Return JSON with investmentTerms structure using authentic deal terms. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500
    });

    return JSON.parse(response.choices[0].message.content || '{}').investmentTerms;
  }

  private async generateNewRecommendation(data: any, context: string) {
    const prompt = `Create comprehensive investment recommendation for ${data.companyName} based on complete analysis.

CONTEXT: ${context.substring(0, 10000)}

Generate investment recommendation covering:
- Investment rationale and thesis
- Key success factors
- Monitoring metrics and milestones
- Exit strategy and potential
- Final recommendation (PASS/INVESTIGATE/REJECT)

Return JSON with recommendation structure with final investment decision. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}').recommendation;
  }

  private async generateNewAppendices(data: any, context: string) {
    const prompt = `Create comprehensive appendices for ${data.companyName} investment memo.

CONTEXT: ${context.substring(0, 8000)}

Generate appendices covering:
- Financial models and projections
- Market research and analysis  
- Technical documentation
- Legal documents and contracts

Return JSON with appendices structure organizing supporting documentation. Format response as JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500
    });

    return JSON.parse(response.choices[0].message.content || '{}').appendices;
  }



  private async storeMemo(dealId: number, memo: BAIBYSMemoSections): Promise<void> {
    console.log(`💾 Storing BAIBYS-quality investment memo for deal ${dealId}`);
    
    try {
      const existingMemo = await storage.getMemoByDealId(dealId);
      
      // Store in proper schema format for compatibility
      const memoData = {
        dealId,
        executiveSummary: memo.executiveSummary,
        memo: memo, // Store full BAIBYS structure in memo JSON field
        swot: memo.swotAnalysis,
        status: 'Complete',
        updatedAt: new Date()
      };
      
      if (existingMemo) {
        await storage.updateMemo(existingMemo.id, memoData);
        console.log(`✅ Updated existing investment memo for deal ${dealId}`);
      } else {
        const insertData = {
          ...memoData,
          createdAt: new Date()
        };
        await storage.createMemo(insertData);
        console.log(`💾 Created new investment memo for deal ${dealId}`);
      }
      
      console.log(`✅ BAIBYS-quality memo stored successfully for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Error storing memo for deal ${dealId}:`, error);
      throw error;
    }
  }
}

export const baibysStyleMemoService = new BAIBYSStyleMemoService();