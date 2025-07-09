import OpenAI from 'openai';

interface FinancialMetrics {
  revenue?: string;
  valuation?: string;
  fundingHistory?: Array<{
    round: string;
    amount: string;
    date: string;
    investors: string[] | string;
  }>;
  employeeCount?: string;
  growthRate?: string;
  burnRate?: string;
  runway?: string;
}

interface FinancialResearchData {
  revenue?: string;
  valuation?: string;
  fundingHistory?: Array<{
    round: string;
    amount: string;
    date: string;
    investors: string[] | string;
  }>;
  employeeCount?: string;
  financialMetrics?: {
    growthRate?: string;
    burnRate?: string;
    runway?: string;
  };
  lastUpdated?: string;
}

class FinancialResearchService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required');
    }
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async conductFinancialResearch(companyName: string, websiteContent: string): Promise<FinancialResearchData> {
    try {
      console.log(`💰 Starting financial research for ${companyName}`);
      
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a financial research expert specializing in startup and venture capital analysis. Your task is to find comprehensive financial information about companies. Focus on providing factual, up-to-date financial data including revenue, valuation, funding history, and key financial metrics. Use your knowledge of publicly available financial information to provide detailed insights.`
          },
          {
            role: "user",
            content: `Research comprehensive financial information for "${companyName}". Please provide detailed financial data including:

1. REVENUE INFORMATION:
   - Annual revenue (most recent available)
   - Revenue growth rate
   - Revenue model and sources

2. VALUATION DATA:
   - Current valuation
   - Previous valuations
   - Market cap if public

3. FUNDING HISTORY:
   - All funding rounds (seed, Series A, B, C, etc.)
   - Amount raised in each round
   - Dates of funding rounds
   - Lead investors and participants

4. FINANCIAL METRICS:
   - Employee count
   - Burn rate (if available)
   - Runway (if available)
   - Growth metrics

5. FINANCIAL PERFORMANCE:
   - Profitability status
   - Cash flow information
   - Key financial ratios

Please provide specific numbers, dates, and sources where possible. Focus on the most recent and reliable financial information available. Format your response as JSON with the following structure:

{
  "revenue": "specific revenue figure with timeframe",
  "valuation": "current valuation with date",
  "fundingHistory": [
    {
      "round": "Series A",
      "amount": "$10M",
      "date": "2024-01-15",
      "investors": ["Investor 1", "Investor 2"]
    }
  ],
  "employeeCount": "number of employees",
  "financialMetrics": {
    "growthRate": "percentage growth",
    "burnRate": "monthly burn rate",
    "runway": "months of runway"
  }
}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000
      });

      const rawData = response.choices[0].message.content;
      if (!rawData) {
        throw new Error('No response from OpenAI');
      }

      const financialData = JSON.parse(rawData);
      
      // Add timestamp
      const enrichedData: FinancialResearchData = {
        ...financialData,
        lastUpdated: new Date().toISOString()
      };

      console.log(`✅ Financial research completed for ${companyName}:`, {
        hasRevenue: !!enrichedData.revenue,
        hasValuation: !!enrichedData.valuation,
        fundingRounds: enrichedData.fundingHistory?.length || 0,
        hasEmployeeCount: !!enrichedData.employeeCount
      });

      return enrichedData;
    } catch (error) {
      console.error(`Error conducting financial research for ${companyName}:`, error);
      throw new Error(`Failed to conduct financial research: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const financialResearchService = new FinancialResearchService();