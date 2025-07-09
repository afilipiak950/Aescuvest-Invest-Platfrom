import OpenAI from "openai";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface FinancialData {
  revenue: string;
  valuation: string;
  employeeCount: string;
  fundingHistory: Array<{
    round: string;
    amount: string;
    date: string;
    investors: string[];
  }>;
  financialMetrics: {
    growthRate?: string;
    burnRate?: string;
    runway?: string;
  };
  lastUpdated: string;
}

class FinancialResearchService {
  async conductFinancialResearch(companyName: string, website: string): Promise<FinancialData> {
    console.log(`💰 Starting comprehensive financial research for ${companyName} (${website})`);
    
    try {
      // Use OpenAI to search for comprehensive financial data - similar to ChatGPT approach
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are a financial research expert. Provide comprehensive financial analysis of companies based on publicly available information. Focus on revenue estimates, valuation, funding history, and financial metrics."
          },
          {
            role: "user",
            content: `Please research and provide comprehensive financial information for ${companyName} (website: ${website}).

I need detailed financial data including:

1. **Revenue Analysis**: 
   - Annual revenue estimates or ranges
   - Revenue growth trends
   - Business model and revenue streams

2. **Valuation & Funding**:
   - Current company valuation or estimated range
   - Funding history with specific rounds (Seed, Series A, B, C, etc.)
   - Investment amounts and dates
   - Investor names and lead investors

3. **Financial Metrics**:
   - Employee count and growth
   - Burn rate estimates
   - Runway calculations
   - Growth rate indicators

4. **Market Position**:
   - Industry benchmarks
   - Competitive positioning
   - Market size and opportunity

Please provide specific numbers where available, or educated estimates based on:
- Company size and industry standards
- Public filings and reports
- News articles and press releases
- Crunchbase, PitchBook, or similar databases
- Industry analyst reports

If specific data is not publicly available, provide reasonable estimates based on similar companies in the space and explain your reasoning.

Format your response as a comprehensive financial analysis with clear sections and specific data points.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const financialAnalysis = response.choices[0].message.content || "";
      console.log(`✅ OpenAI financial analysis completed for ${companyName}`);

      // Extract structured data from the comprehensive analysis
      const structuredData = this.extractFinancialData(financialAnalysis, companyName);
      
      return structuredData;

    } catch (error) {
      console.error(`❌ Financial research failed for ${companyName}:`, error);
      // Return fallback data structure
      return {
        revenue: "Not disclosed",
        valuation: "Not disclosed",
        employeeCount: "Not disclosed",
        fundingHistory: [],
        financialMetrics: {
          growthRate: "Not available",
          burnRate: "Not available",
          runway: "Not available"
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  private extractFinancialData(analysis: string, companyName: string): FinancialData {
    console.log(`🔍 Extracting structured financial data for ${companyName}`);
    
    // Extract revenue information
    const revenueMatch = analysis.match(/revenue.*?(?:\$|€|£)?\s*([0-9.,]+(?:\s*(?:million|billion|M|B|k|K))?)/i);
    const revenue = revenueMatch ? this.normalizeAmount(revenueMatch[1]) : "Not disclosed";
    
    // Extract valuation information
    const valuationMatch = analysis.match(/valuation.*?(?:\$|€|£)?\s*([0-9.,]+(?:\s*(?:million|billion|M|B|k|K))?)/i);
    const valuation = valuationMatch ? this.normalizeAmount(valuationMatch[1]) : "Not disclosed";
    
    // Extract employee count
    const employeeMatch = analysis.match(/employee.*?([0-9,]+)/i) || analysis.match(/team.*?([0-9,]+)/i);
    const employeeCount = employeeMatch ? employeeMatch[1] : "Not disclosed";
    
    // Extract funding history
    const fundingHistory = this.extractFundingRounds(analysis);
    
    // Extract financial metrics
    const growthRateMatch = analysis.match(/growth.*?([0-9]+%)/i);
    const burnRateMatch = analysis.match(/burn.*?(?:\$|€|£)?\s*([0-9.,]+(?:\s*(?:million|billion|M|B|k|K))?)/i);
    const runwayMatch = analysis.match(/runway.*?([0-9]+(?:\s*(?:months|years|month|year))?)/i);
    
    return {
      revenue,
      valuation,
      employeeCount,
      fundingHistory,
      financialMetrics: {
        growthRate: growthRateMatch ? growthRateMatch[1] : "Not available",
        burnRate: burnRateMatch ? this.normalizeAmount(burnRateMatch[1]) : "Not available",
        runway: runwayMatch ? runwayMatch[1] : "Not available"
      },
      lastUpdated: new Date().toISOString()
    };
  }

  private extractFundingRounds(analysis: string): Array<{round: string; amount: string; date: string; investors: string[]}> {
    const fundingRounds: Array<{round: string; amount: string; date: string; investors: string[]}> = [];
    
    // Look for funding round patterns
    const roundPatterns = [
      /seed.*?(?:\$|€|£)?\s*([0-9.,]+(?:\s*(?:million|billion|M|B|k|K))?)/i,
      /series\s*a.*?(?:\$|€|£)?\s*([0-9.,]+(?:\s*(?:million|billion|M|B|k|K))?)/i,
      /series\s*b.*?(?:\$|€|£)?\s*([0-9.,]+(?:\s*(?:million|billion|M|B|k|K))?)/i,
      /series\s*c.*?(?:\$|€|£)?\s*([0-9.,]+(?:\s*(?:million|billion|M|B|k|K))?)/i
    ];
    
    roundPatterns.forEach((pattern, index) => {
      const match = analysis.match(pattern);
      if (match) {
        const roundNames = ['Seed', 'Series A', 'Series B', 'Series C'];
        fundingRounds.push({
          round: roundNames[index],
          amount: this.normalizeAmount(match[1]),
          date: "Not specified",
          investors: []
        });
      }
    });
    
    return fundingRounds;
  }

  private normalizeAmount(amount: string): string {
    // Normalize financial amounts to consistent format
    const cleanAmount = amount.replace(/[,\s]/g, '');
    if (cleanAmount.toLowerCase().includes('million') || cleanAmount.toLowerCase().includes('m')) {
      return cleanAmount.replace(/million|m/i, 'M');
    }
    if (cleanAmount.toLowerCase().includes('billion') || cleanAmount.toLowerCase().includes('b')) {
      return cleanAmount.replace(/billion|b/i, 'B');
    }
    if (cleanAmount.toLowerCase().includes('thousand') || cleanAmount.toLowerCase().includes('k')) {
      return cleanAmount.replace(/thousand|k/i, 'K');
    }
    return cleanAmount;
  }

  // Store financial data in database
  async storeFinancialData(dealId: number, financialData: FinancialData): Promise<void> {
    try {
      console.log(`💾 Storing financial data for deal ${dealId}`);
      
      // Update the company research with financial data
      await storage.updateCompanyResearch(dealId, {
        financialData: financialData
      });
      
      console.log(`✅ Financial data stored successfully for deal ${dealId}`);
    } catch (error) {
      console.error(`❌ Failed to store financial data for deal ${dealId}:`, error);
      throw error;
    }
  }
}

export const financialResearchService = new FinancialResearchService();