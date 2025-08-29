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

1. REVENUE INFORMATION (PROVIDE RANGES):
   - Annual revenue with range estimates (e.g., "$5M-$10M annually")
   - Revenue growth rate with range
   - Revenue model and sources

2. VALUATION DATA (PROVIDE RANGES):
   - Current valuation with range estimates (e.g., "$50M-$100M")
   - Previous valuations with ranges
   - Market cap if public

3. FUNDING HISTORY:
   - All funding rounds (seed, Series A, B, C, etc.)
   - Amount raised in each round
   - Dates of funding rounds
   - Lead investors and participants
   - If NO funding history is available, return null for this field

4. FINANCIAL METRICS:
   - Employee count with range estimates
   - Burn rate (if available)
   - Runway (if available)
   - Growth metrics

5. FINANCIAL PERFORMANCE:
   - Profitability status
   - Cash flow information
   - Key financial ratios

IMPORTANT INSTRUCTIONS:
- ALWAYS provide range estimates for revenue and valuation (e.g., "$5M-$15M", "$20M-$50M")
- If funding history is not available or unknown, set "fundingHistory" to null
- Focus on realistic range estimates rather than single point values
- Use your knowledge of typical company financials in similar industries/stages

Format your response as JSON with the following structure:

{
  "revenue": "revenue range with timeframe (e.g., '$5M-$10M annually')",
  "valuation": "valuation range with date (e.g., '$50M-$100M (2024)')",
  "fundingHistory": [
    {
      "round": "Series A",
      "amount": "$10M",
      "date": "2024-01-15",
      "investors": ["Investor 1", "Investor 2"]
    }
  ],
  "employeeCount": "employee count range (e.g., '50-100 employees')",
  "financialMetrics": {
    "growthRate": "growth percentage range",
    "burnRate": "monthly burn rate range",
    "runway": "months of runway range"
  }
}

If funding history is not available, use: "fundingHistory": null`
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