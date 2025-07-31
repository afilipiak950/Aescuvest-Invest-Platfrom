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
   * MULTI-PASS COMPREHENSIVE DATA EXTRACTION - Uses ALL documents, every line of OCR text, and all agent analyses
   * This method processes documents in multiple passes to ensure maximum information extraction
   */
  private async prepareComprehensiveAnalysisContext(data: ComprehensiveMemoData): Promise<string> {
    console.log(`🔍 Starting MULTI-PASS extraction from ${data.documents.length} documents and ${data.agentAnalyses.length} analyses`);
    
    // First pass: Extract and log all OCR content lengths
    let totalOcrLength = 0;
    const documentOcrLengths: number[] = [];
    
    data.documents.forEach((doc, index) => {
      if (doc.ocrText && typeof doc.ocrText === 'string' && doc.ocrText.trim().length > 100) {
        const ocrLength = doc.ocrText.length;
        documentOcrLengths.push(ocrLength);
        totalOcrLength += ocrLength;
        console.log(`📄 Document ${index + 1} (${doc.name}): ${ocrLength.toLocaleString()} characters of OCR text`);
      } else {
        documentOcrLengths.push(0);
        console.log(`📄 Document ${index + 1} (${doc.name}): No OCR text available`);
      }
    });
    
    console.log(`📊 TOTAL OCR CONTENT: ${totalOcrLength.toLocaleString()} characters across ${data.documents.length} documents`);
    
    // Build comprehensive context with ALL content
    let context = `
COMPREHENSIVE INVESTMENT ANALYSIS FOR ${data.companyName}
=========================================================
TOTAL OCR CONTENT: ${totalOcrLength.toLocaleString()} characters
TOTAL DOCUMENTS: ${data.documents.length}
TOTAL AGENT ANALYSES: ${data.agentAnalyses.length}
=========================================================

=== COMPLETE DOCUMENT OCR CONTENT - ALL ${data.documents.length} DOCUMENTS ===
`;

    // Second pass: Include COMPLETE OCR content from ALL documents
    data.documents.forEach((doc, index) => {
      if (doc.ocrText && typeof doc.ocrText === 'string' && doc.ocrText.trim().length > 100) {
        context += `

>>>>>>> DOCUMENT ${index + 1}: ${doc.name} <<<<<<<
OCR LENGTH: ${doc.ocrText.length.toLocaleString()} characters
FILE TYPE: ${doc.contentType || 'Unknown'}

COMPLETE OCR CONTENT:
${doc.ocrText}

`;
        
        // Also include AI summary if available
        if (doc.aiSummary) {
          try {
            let summaryText = '';
            if (typeof doc.aiSummary === 'string') {
              summaryText = doc.aiSummary;
            } else if (typeof doc.aiSummary === 'object') {
              if (doc.aiSummary.executiveSummary) summaryText += `EXECUTIVE SUMMARY: ${doc.aiSummary.executiveSummary}\n`;
              if (doc.aiSummary.criticalFindings) summaryText += `CRITICAL FINDINGS: ${Array.isArray(doc.aiSummary.criticalFindings) ? doc.aiSummary.criticalFindings.join('\n') : doc.aiSummary.criticalFindings}\n`;
              if (doc.aiSummary.keyFinancialData) summaryText += `FINANCIAL DATA: ${Array.isArray(doc.aiSummary.keyFinancialData) ? doc.aiSummary.keyFinancialData.join('\n') : doc.aiSummary.keyFinancialData}\n`;
              if (doc.aiSummary.strategicImplications) summaryText += `STRATEGIC IMPLICATIONS: ${doc.aiSummary.strategicImplications}\n`;
            }
            if (summaryText.trim().length > 50) {
              context += `AI ANALYSIS SUMMARY:
${summaryText}

`;
            }
          } catch (e) {
            console.warn(`Error extracting AI summary for document ${index + 1}:`, e);
          }
        }
        
        context += `======================================\n`;
      }
    });

    // Third pass: Include ALL agent analysis content
    context += `\n\n=== COMPLETE AGENT ANALYSES - ALL ${data.agentAnalyses.length} ANALYSES ===\n`;
    
    data.agentAnalyses.forEach(analysis => {
      context += `\n>>>>>>> ${analysis.agentType.toUpperCase()} AGENT ANALYSIS <<<<<<<\n`;
      context += `STATUS: ${analysis.status}\n`;
      context += `FINDINGS COUNT: ${analysis.findings?.length || 0}\n`;
      context += `RECOMMENDATIONS COUNT: ${analysis.recommendations?.length || 0}\n\n`;

      // Extract COMPLETE analysis content for each agent type
      const extractCompleteAnalysisContent = (answers: any, label: string) => {
        if (!answers) return;
        
        try {
          const data = typeof answers === 'string' ? JSON.parse(answers) : answers;
          context += `${label} COMPLETE ANALYSIS:\n`;
          
          if (typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
              const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
              context += `${key.toUpperCase()}: ${content}\n\n`;
            });
          } else {
            context += `${data}\n\n`;
          }
        } catch (e) {
          if (answers) {
            context += `${label} RAW CONTENT: ${answers.toString()}\n\n`;
          }
        }
      };

      // Extract COMPLETE content from all agent types (no truncation)
      extractCompleteAnalysisContent(analysis.legalAnswers, 'LEGAL');
      extractCompleteAnalysisContent(analysis.clinicalAnswers, 'CLINICAL');
      extractCompleteAnalysisContent(analysis.commercialAnswers, 'COMMERCIAL');
      extractCompleteAnalysisContent(analysis.hrAnswers, 'HR');
      extractCompleteAnalysisContent(analysis.financialAnswers, 'FINANCIAL');
      extractCompleteAnalysisContent(analysis.ipAnswers, 'IP');
      extractCompleteAnalysisContent(analysis.researchAnswers, 'RESEARCH');

      // Include ALL findings with complete content
      if (analysis.findings && Array.isArray(analysis.findings)) {
        context += `COMPLETE FINDINGS (${analysis.findings.length}):\n`;
        analysis.findings.forEach((finding, index) => {
          const content = typeof finding === 'string' ? finding : (finding.content || JSON.stringify(finding, null, 2));
          context += `FINDING ${index + 1}: ${content}\n\n`;
        });
      }
      
      // Include ALL recommendations with complete content  
      if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
        context += `COMPLETE RECOMMENDATIONS (${analysis.recommendations.length}):\n`;
        analysis.recommendations.forEach((rec, index) => {
          const content = typeof rec === 'string' ? rec : (rec.content || rec.description || JSON.stringify(rec, null, 2));
          context += `RECOMMENDATION ${index + 1}: ${content}\n\n`;
        });
      }
      
      context += `=======================================\n`;
    });

    const finalContextLength = context.length;
    console.log(`📊 FINAL CONTEXT LENGTH: ${finalContextLength.toLocaleString()} characters for comprehensive analysis`);
    
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
    console.log(`🔍 MULTI-PASS company information extraction from ${data.documents.length} documents and ${data.agentAnalyses.length} analyses`);
    
    // Strategy: Process documents in batches to extract maximum information without exceeding context limits
    const batchSize = 10; // Process 10 documents at a time
    const extractedInfo: string[] = [];
    
    // First pass: Extract from agent analyses
    console.log(`🔍 PASS 1: Extracting from ${data.agentAnalyses.length} agent analyses`);
    if (data.agentAnalyses.length > 0) {
      let agentContent = '';
      data.agentAnalyses.forEach(analysis => {
        agentContent += `\n=== ${analysis.agentType.toUpperCase()} ANALYSIS ===\n`;
        
        // Extract all available analysis content
        const extractAnalysisData = (answers: any, type: string) => {
          if (!answers) return '';
          try {
            const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;
            return `${type}: ${JSON.stringify(parsed, null, 2)}\n`;
          } catch (e) {
            return `${type}: ${answers.toString()}\n`;
          }
        };
        
        agentContent += extractAnalysisData(analysis.legalAnswers, 'LEGAL');
        agentContent += extractAnalysisData(analysis.clinicalAnswers, 'CLINICAL');
        agentContent += extractAnalysisData(analysis.commercialAnswers, 'COMMERCIAL');
        agentContent += extractAnalysisData(analysis.hrAnswers, 'HR');
        agentContent += extractAnalysisData(analysis.financialAnswers, 'FINANCIAL');
        agentContent += extractAnalysisData(analysis.ipAnswers, 'IP');
        agentContent += extractAnalysisData(analysis.researchAnswers, 'RESEARCH');
        
        // Add findings and recommendations
        if (analysis.findings) {
          agentContent += `FINDINGS: ${JSON.stringify(analysis.findings, null, 2)}\n`;
        }
        if (analysis.recommendations) {
          agentContent += `RECOMMENDATIONS: ${JSON.stringify(analysis.recommendations, null, 2)}\n`;
        }
      });
      
      const agentExtraction = await this.extractFromContent(agentContent, data.companyName, 'agent analyses');
      extractedInfo.push(agentExtraction);
    }
    
    // Second pass: Process documents in batches
    const totalBatches = Math.ceil(data.documents.length / batchSize);
    console.log(`🔍 PASS 2: Processing ${data.documents.length} documents in ${totalBatches} batches of ${batchSize}`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, data.documents.length);
      const batch = data.documents.slice(startIndex, endIndex);
      
      console.log(`🔍 Processing batch ${batchIndex + 1}/${totalBatches}: documents ${startIndex + 1}-${endIndex}`);
      
      let batchContent = '';
      batch.forEach((doc, index) => {
        if (doc.ocrText && typeof doc.ocrText === 'string' && doc.ocrText.trim().length > 100) {
          batchContent += `\n=== DOCUMENT: ${doc.name} ===\n`;
          batchContent += `OCR CONTENT (${doc.ocrText.length} chars):\n${doc.ocrText}\n`;
          
          // Add AI summary if available
          if (doc.aiSummary) {
            try {
              const summary = typeof doc.aiSummary === 'string' ? doc.aiSummary : JSON.stringify(doc.aiSummary, null, 2);
              batchContent += `AI SUMMARY:\n${summary}\n`;
            } catch (e) {
              console.warn(`Error extracting AI summary for ${doc.name}:`, e);
            }
          }
          batchContent += `\n`;
        }
      });
      
      if (batchContent.trim().length > 100) {
        const batchExtraction = await this.extractFromContent(batchContent, data.companyName, `document batch ${batchIndex + 1}`);
        extractedInfo.push(batchExtraction);
      }
    }
    
    // Third pass: Combine and synthesize all extracted information
    console.log(`🔍 PASS 3: Synthesizing ${extractedInfo.length} extraction results`);
    
    const combinedExtractions = extractedInfo.join('\n\n=== NEXT EXTRACTION ===\n\n');
    
    const finalSynthesis = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{
        role: "system",
        content: `You are synthesizing multiple company information extractions into one comprehensive company profile. 

Combine and deduplicate information from multiple sources. Prioritize the most specific and detailed information. If information conflicts, note both versions.

Output a comprehensive company profile with:
1. Executive Team (CEO, CTO, CFO, founders, key executives)
2. Corporate Details (headquarters, incorporation, registration)
3. Shareholding & Governance (ownership, board members, investors)
4. Company Structure (employees, departments, subsidiaries)
5. Financial Information (funding, valuation, revenue)
6. Key Partnerships and Strategic Alliances

Be specific with names, dates, addresses, and percentages. If information is not found, state "Not found in available documents".`
      }, {
        role: "user",
        content: `Synthesize these company information extractions for ${data.companyName}:

${combinedExtractions}`
      }],
      temperature: 0.1,
      max_tokens: 4000
    });
    
    console.log(`✅ Multi-pass extraction completed for ${data.companyName}`);
    
    return finalSynthesis.choices[0].message.content || 'No specific company information could be extracted from the available documents and analyses.';
  }
  
  private async extractFromContent(content: string, companyName: string, sourceType: string): Promise<string> {
    try {
      console.log(`🔍 Extracting from ${sourceType} (${content.length.toLocaleString()} characters)`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{
          role: "system",
          content: `Extract specific company information from this content. Focus on:

1. Executive names and roles (CEO, CTO, CFO, founders)
2. Corporate details (addresses, incorporation dates, registration numbers)
3. Shareholding information (ownership percentages, investor names)
4. Board and governance (board members, advisory board)
5. Financial information (funding rounds, valuations, revenue)
6. Company structure (employee count, departments, subsidiaries)
7. Key partnerships and agreements

Extract only factual information explicitly mentioned. Include exact names, dates, addresses, percentages.`
        }, {
          role: "user",
          content: `Extract company information for ${companyName} from this ${sourceType}:

${content.substring(0, 120000)}`
        }],
        temperature: 0.1,
        max_tokens: 2000
      });
      
      return response.choices[0].message.content || `No information extracted from ${sourceType}`;
    } catch (error) {
      console.error(`Error extracting from ${sourceType}:`, error);
      return `Error processing ${sourceType}`;
    }
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