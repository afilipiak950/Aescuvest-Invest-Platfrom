import OpenAI from 'openai';
import { storage } from '../storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// BAIBYS-style memo structure matching the reference document exactly
export interface BAIBYSMemoSections {
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
  executiveSummary: string;
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  marketAnalysis: {
    marketContext: string;
    tamSamSom: {
      tam: string;
      sam: string;
      som: string;
    };
    whyNow: string;
    painPoints: string;
    marketOpportunity: string;
  };
  productAnalysis: {
    productOverview: string;
    technicalSpecs: string;
    uniqueSellingPoints: string[];
    competitiveAdvantages: string;
  };
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
    console.log(`🎯 Generating BAIBYS-structured memo sections with GPT-4o`);

    // Generate cover page first
    const coverPage = await this.generateCoverPage(data, context);
    
    // Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(data, context);
    
    // Generate SWOT analysis 
    const swotAnalysis = await this.generateSWOTAnalysis(data, context);
    
    // Generate market analysis with TAM/SAM/SOM structure
    const marketAnalysis = await this.generateMarketAnalysis(data, context);
    
    // Generate product analysis
    const productAnalysis = await this.generateProductAnalysis(data, context);
    
    // Generate remaining sections
    const remainingSections = await this.generateRemainingSections(data, context);

    return {
      coverPage,
      executiveSummary,
      swotAnalysis,
      marketAnalysis,
      productAnalysis,
      ...remainingSections
    };
  }

  private async generateCoverPage(data: any, context: string) {
    const prompt = `Create a professional investment memo cover page for ${data.companyName} in the exact style of the BAIBYS reference document.

CONTEXT: ${context.substring(0, 4000)}

Generate a structured cover page with:
1. Company headquarters location
2. Management team (extract real names from documents if available)
3. Incorporation date (estimate based on available data)
4. Shareholding structure (create realistic structure based on stage)
5. Investment proposal (Series A/B based on company stage)
6. Key investment terms (realistic terms for this sector)
7. Investment highlights (4-5 compelling points)

Return as structured JSON with these exact keys: company, headquarters, management, incorporation, shareholding, proposal, keyInvestmentTerms, investmentHighlights`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async generateExecutiveSummary(data: any, context: string): Promise<string> {
    const prompt = `Create a comprehensive executive summary for ${data.companyName} in the exact style of the BAIBYS reference document.

CONTEXT: ${context.substring(0, 6000)}

Write a professional 2-3 paragraph executive summary covering:
1. Company founding, mission, and leadership background
2. Technology/product innovation and competitive differentiation  
3. Market opportunity with specific market data and growth rates
4. Strategic partnerships, customer validation, regulatory status
5. Financial performance, projections, and funding history
6. Investment thesis and expected returns

Use specific data from the context. Write in professional, confident tone matching BAIBYS quality.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    return response.choices[0].message.content || '';
  }

  private async generateSWOTAnalysis(data: any, context: string) {
    const prompt = `Create a detailed SWOT analysis for ${data.companyName} in the exact format of the BAIBYS reference document.

CONTEXT: ${context.substring(0, 5000)}

Generate a comprehensive SWOT analysis with:
- Strengths: 4-6 key competitive advantages
- Weaknesses: 3-4 areas needing improvement
- Opportunities: 3-4 market opportunities
- Threats: 2-3 key risks

Each point should be specific, data-driven, and professionally written. Use authentic details from the context.

Return as JSON with arrays for: strengths, weaknesses, opportunities, threats`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async generateMarketAnalysis(data: any, context: string) {
    const prompt = `Create a comprehensive market analysis for ${data.companyName} in the exact structure of the BAIBYS reference document.

CONTEXT: ${context.substring(0, 6000)}

Generate detailed market analysis with:
1. Market Context and Opportunity (current market situation)
2. TAM/SAM/SOM breakdown with specific numbers and sources
3. "Why Now?" section explaining market timing
4. Pain Points in current market/workflow
5. Market opportunity with growth rates and drivers

Include realistic market sizing with specific dollar amounts, growth rates (CAGR), and data sources. Write in professional, analytical tone.

Return as JSON with keys: marketContext, tamSamSom (with tam/sam/som subkeys), whyNow, painPoints, marketOpportunity`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async generateProductAnalysis(data: any, context: string) {
    const prompt = `Create a detailed product analysis for ${data.companyName} in the exact style of the BAIBYS reference document.

CONTEXT: ${context.substring(0, 5000)}

Generate comprehensive product analysis with:
1. Product Overview (what the product does)
2. Technical Specifications (detailed technical details)
3. Unique Selling Points (4-6 bullet points)
4. Competitive Advantages (detailed analysis)

Use specific technical details from the context. Write with technical depth matching BAIBYS quality.

Return as JSON with keys: productOverview, technicalSpecs, uniqueSellingPoints (array), competitiveAdvantages`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async generateRemainingSections(data: any, context: string) {
    const prompt = `Generate the remaining investment memo sections for ${data.companyName} matching BAIBYS professional quality.

CONTEXT: ${context.substring(0, 8000)}

Generate detailed analysis for:
1. Business Model (revenue streams, pricing, scalability)
2. Team Assessment (management evaluation, key personnel)
3. Financial Analysis (current financials, projections, funding history)
4. Commercial Strategy (go-to-market, sales, partnerships)
5. Clinical Assessment (regulatory status, trials, approvals)
6. IP Analysis (patents, intellectual property)
7. Risk Assessment (key risks and mitigation)
8. Legal Assessment (legal structure, compliance)
9. Investment Terms (proposed terms and structure)
10. Exit Strategy (exit opportunities and timeline)
11. Recommendation (investment recommendation and rationale)
12. Appendices (supporting documents and data)

Each section should be comprehensive and professional. Use authentic data from context.

Return as JSON with these exact keys: businessModel, teamAssessment, financialAnalysis, commercialStrategy, clinicalAssessment, ipAnalysis, riskAssessment, legalAssessment, investmentTerms, exitStrategy, recommendation, appendices`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  private async storeMemo(dealId: number, memo: BAIBYSMemoSections): Promise<void> {
    console.log(`💾 Storing BAIBYS-quality investment memo for deal ${dealId}`);
    
    try {
      const existingMemo = await storage.getMemoByDealId(dealId);
      
      if (existingMemo) {
        await storage.updateMemo(existingMemo.id, {
          ...memo,
          updatedAt: new Date()
        });
        console.log(`✅ Updated existing investment memo for deal ${dealId}`);
      } else {
        const insertData = {
          dealId,
          ...memo,
          createdAt: new Date(),
          updatedAt: new Date()
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