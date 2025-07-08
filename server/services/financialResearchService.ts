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
  private rateLimiter = {
    lastRequestTime: 0,
    minInterval: 2000, // 2 seconds between requests
    
    async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest));
      }
      
      this.lastRequestTime = Date.now();
      return await fn();
    }
  };

  async conductFinancialResearch(companyName: string, website: string): Promise<FinancialData> {
    console.log(`💰 Starting financial research for ${companyName} (${website})`);
    
    // Research revenue and business metrics
    const revenueData = await this.researchRevenue(companyName, website);
    
    // Research valuation and funding
    const fundingData = await this.researchFunding(companyName, website);
    
    // Research employee count and growth metrics
    const growthData = await this.researchGrowthMetrics(companyName, website);
    
    return {
      revenue: revenueData.revenue,
      valuation: fundingData.valuation,
      employeeCount: growthData.employeeCount,
      fundingHistory: fundingData.fundingHistory,
      financialMetrics: {
        growthRate: growthData.growthRate,
        burnRate: fundingData.burnRate,
        runway: fundingData.runway
      },
      lastUpdated: new Date().toISOString()
    };
  }

  private async researchRevenue(companyName: string, website: string) {
    return this.rateLimiter.executeWithLimit(async () => {
      console.log(`📊 Researching revenue for ${companyName}`);
      
      const prompt = `Research the revenue and financial performance of ${companyName} (website: ${website}).

Please provide detailed financial information including:
- Annual revenue (current and historical if available)
- Revenue growth rate
- Business model and revenue streams
- Financial performance indicators

Focus on finding authentic, recent financial data from reliable sources such as:
- Company annual reports
- Financial filings
- Industry reports
- News articles about funding or financial performance
- Crunchbase or similar platforms

If specific revenue figures are not publicly available, provide:
- Revenue range estimates based on company size, industry, and market position
- Qualitative assessment of financial health
- Any available financial metrics or KPIs

Respond in plain text format, not JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      });

      const revenueInfo = response.choices[0].message.content || "";
      
      // Extract structured data from the response
      const revenue = this.extractRevenue(revenueInfo);
      
      return { revenue };
    });
  }

  private async researchFunding(companyName: string, website: string) {
    return this.rateLimiter.executeWithLimit(async () => {
      console.log(`💸 Researching funding for ${companyName}`);
      
      const prompt = `Research the funding history and valuation of ${companyName} (website: ${website}).

Please provide detailed funding information including:
- Company valuation (current and historical)
- Funding rounds (seed, Series A, B, C, etc.)
- Investment amounts and dates
- Investor names and types
- Use of funds and growth plans

Search for information from:
- Crunchbase, PitchBook, or similar databases
- Press releases about funding announcements
- Investor websites and portfolios
- Financial news and industry publications
- Company announcements

If specific funding data is not available, provide:
- Estimated valuation range based on company stage and industry
- Information about bootstrap vs. funded status
- Any available investment or partnership announcements

For each funding round, include:
- Round type (Pre-seed, Seed, Series A, etc.)
- Amount raised
- Date of funding
- Lead investors and participants
- Valuation (if disclosed)

Respond in plain text format, not JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.3
      });

      const fundingInfo = response.choices[0].message.content || "";
      
      // Extract structured data from the response
      const valuation = this.extractValuation(fundingInfo);
      const fundingHistory = this.extractFundingHistory(fundingInfo);
      const { burnRate, runway } = this.extractFinancialMetrics(fundingInfo);
      
      return { valuation, fundingHistory, burnRate, runway };
    });
  }

  private async researchGrowthMetrics(companyName: string, website: string) {
    return this.rateLimiter.executeWithLimit(async () => {
      console.log(`📈 Researching growth metrics for ${companyName}`);
      
      const prompt = `Research the growth metrics and team size of ${companyName} (website: ${website}).

Please provide information about:
- Current employee count
- Team growth rate
- Hiring plans and expansion
- Revenue growth rate
- Customer growth metrics
- Market expansion indicators

Search for data from:
- LinkedIn company page
- Company careers page
- Industry reports
- News articles about expansion
- Employee profiles and announcements

If specific numbers are not available, provide:
- Estimated team size based on company stage and industry
- Growth indicators from recent activities
- Qualitative assessment of expansion trajectory

Respond in plain text format, not JSON.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
        temperature: 0.3
      });

      const growthInfo = response.choices[0].message.content || "";
      
      // Extract structured data from the response
      const employeeCount = this.extractEmployeeCount(growthInfo);
      const growthRate = this.extractGrowthRate(growthInfo);
      
      return { employeeCount, growthRate };
    });
  }

  private extractRevenue(text: string): string {
    // Look for revenue patterns in the text
    const revenuePatterns = [
      /revenue[:\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi,
      /annual revenue[:\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi,
      /turnover[:\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi,
      /sales[:\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi
    ];

    for (const pattern of revenuePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    // If no specific revenue found, look for qualitative indicators
    if (text.toLowerCase().includes('not publicly available') || 
        text.toLowerCase().includes('private company') ||
        text.toLowerCase().includes('no revenue data')) {
      return 'Revenue information not publicly available';
    }

    if (text.toLowerCase().includes('bootstrap') || 
        text.toLowerCase().includes('self-funded')) {
      return 'Self-funded startup, revenue not disclosed';
    }

    return 'Revenue data not found in available sources';
  }

  private extractValuation(text: string): string {
    // Look for valuation patterns
    const valuationPatterns = [
      /valuation[:\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi,
      /valued at[:\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi,
      /worth[:\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi
    ];

    for (const pattern of valuationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    if (text.toLowerCase().includes('early stage') || 
        text.toLowerCase().includes('pre-revenue')) {
      return 'Early-stage startup, valuation not disclosed';
    }

    return 'Valuation information not available';
  }

  private extractFundingHistory(text: string): Array<{
    round: string;
    amount: string;
    date: string;
    investors: string[];
  }> {
    const fundingHistory: Array<{
      round: string;
      amount: string;
      date: string;
      investors: string[];
    }> = [];

    // Look for funding round patterns
    const roundPatterns = [
      /(seed|series [a-z]|pre-seed|angel|bridge)[\s\w]*:?[\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi,
      /(raised|funding|investment)[\s\w]*:?[\s]*([€$£]?[\d,.]+ ?(million|billion|k|thousand)?)/gi
    ];

    const lines = text.split('\n');
    for (const line of lines) {
      for (const pattern of roundPatterns) {
        const match = line.match(pattern);
        if (match) {
          const round = match[1] || 'Funding Round';
          const amount = match[2] || 'Amount not disclosed';
          
          // Try to extract date from the same line
          const dateMatch = line.match(/\b(20\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2}, \d{4})\b/);
          const date = dateMatch ? dateMatch[0] : 'Date not specified';
          
          // Try to extract investors from the same line or context
          const investorMatch = line.match(/investors?:?\s*([^.]+)/gi);
          const investors = investorMatch ? 
            investorMatch[0].replace(/investors?:?\s*/gi, '').split(',').map(s => s.trim()) : 
            ['Investors not disclosed'];
          
          fundingHistory.push({
            round: round.charAt(0).toUpperCase() + round.slice(1),
            amount,
            date,
            investors
          });
        }
      }
    }

    return fundingHistory;
  }

  private extractFinancialMetrics(text: string): { burnRate?: string; runway?: string } {
    const burnRateMatch = text.match(/burn rate[:\s]*([€$£]?[\d,.]+ ?(per month|monthly|\/month)?)/gi);
    const runwayMatch = text.match(/runway[:\s]*(\d+ ?(months|years))/gi);
    
    return {
      burnRate: burnRateMatch ? burnRateMatch[0] : undefined,
      runway: runwayMatch ? runwayMatch[0] : undefined
    };
  }

  private extractEmployeeCount(text: string): string {
    // Look for employee count patterns
    const employeePatterns = [
      /(\d+)[\s\-]*employees?/gi,
      /team size[:\s]*(\d+)/gi,
      /staff[:\s]*(\d+)/gi,
      /(\d+)[\s\-]*people/gi
    ];

    for (const pattern of employeePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] + ' employees';
      }
    }

    // Look for qualitative indicators
    if (text.toLowerCase().includes('small team') || 
        text.toLowerCase().includes('startup team')) {
      return 'Small team (5-15 employees)';
    }

    if (text.toLowerCase().includes('growing team') || 
        text.toLowerCase().includes('expanding')) {
      return 'Growing team, size not disclosed';
    }

    return 'Team size not available';
  }

  private extractGrowthRate(text: string): string {
    // Look for growth rate patterns
    const growthPatterns = [
      /growth rate[:\s]*(\d+%)/gi,
      /growing[:\s]*(\d+%)/gi,
      /(\d+%)[\s\w]*growth/gi
    ];

    for (const pattern of growthPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    if (text.toLowerCase().includes('rapid growth') || 
        text.toLowerCase().includes('fast growing')) {
      return 'Rapid growth phase';
    }

    if (text.toLowerCase().includes('stable growth') || 
        text.toLowerCase().includes('steady growth')) {
      return 'Stable growth';
    }

    return 'Growth rate not disclosed';
  }

  // Store financial data in the database
  async storeFinancialData(dealId: number, financialData: FinancialData): Promise<void> {
    try {
      const existingResearch = await storage.getCompanyResearchRawByDealId(dealId);
      
      if (existingResearch) {
        // Update existing research with financial data
        await storage.updateCompanyResearch(dealId, {
          financialData: JSON.stringify(financialData),
          researchCompletedAt: new Date()
        });
      } else {
        console.log(`⚠️ No existing research found for deal ${dealId}, financial data not stored`);
      }
    } catch (error) {
      console.error('Error storing financial data:', error);
      throw error;
    }
  }

  // Get stored financial data
  async getStoredFinancialData(dealId: number): Promise<FinancialData | null> {
    try {
      const research = await storage.getCompanyResearchRawByDealId(dealId);
      
      if (!research || !research.financialData) {
        return null;
      }

      // Parse financial data (handle both string and object formats)
      let financialData = research.financialData;
      if (typeof financialData === 'string') {
        try {
          financialData = JSON.parse(financialData);
        } catch {
          return null;
        }
      }

      return financialData as FinancialData;
    } catch (error) {
      console.error('Error retrieving financial data:', error);
      return null;
    }
  }
}

export const financialResearchService = new FinancialResearchService();