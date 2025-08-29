import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface FinancialData {
  revenue: string;
  valuation: string;
  fundingHistory: Array<{
    round: string;
    amount: string;
    date: string;
    investors: string[];
  }>;
  runway: string;
  lastUpdated: string;
}

export class FinancialSearchService {
  async searchFinancialData(companyWebsite: string, companyName: string): Promise<FinancialData> {
    try {
      console.log(`💰 Starting financial search for ${companyName} (${companyWebsite})`);
      
      const prompt = `Try to find out revenue, valuation and funding history for website: ${companyWebsite}

Company Name: ${companyName}
Website: ${companyWebsite}

Please search for and provide the following financial information:
1. Current revenue (annual revenue, ARR, or latest reported revenue)
2. Current valuation (latest funding round valuation or market cap)
3. Funding history (all funding rounds with dates, amounts, and investors)
4. Financial runway (if available)

Format the response as JSON with this structure:
{
  "revenue": "specific revenue amount or 'Not publicly available'",
  "valuation": "specific valuation amount or 'Not publicly available'", 
  "fundingHistory": [
    {
      "round": "Series A/B/C/Seed/etc",
      "amount": "funding amount",
      "date": "date of funding",
      "investors": ["investor1", "investor2"]
    }
  ],
  "runway": "estimated runway or 'Not available'",
  "lastUpdated": "current date"
}

If specific financial data is not available, indicate "Not publicly available" rather than guessing.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a financial research expert. Provide accurate, factual financial information about companies. Only use publicly available information and clearly indicate when data is not available. Return responses in valid JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Ensure proper formatting
      const formattedData: FinancialData = {
        revenue: result.revenue || 'Not publicly available',
        valuation: result.valuation || 'Not publicly available',
        fundingHistory: Array.isArray(result.fundingHistory) ? result.fundingHistory : [],
        runway: result.runway || 'Not available',
        lastUpdated: new Date().toISOString()
      };

      console.log(`💰 Financial search completed for ${companyName}`);
      console.log(`📊 Revenue: ${formattedData.revenue}`);
      console.log(`💎 Valuation: ${formattedData.valuation}`);
      console.log(`📈 Funding rounds: ${formattedData.fundingHistory.length}`);

      return formattedData;

    } catch (error) {
      console.error(`❌ Financial search failed for ${companyName}:`, error);
      
      // Return fallback structure
      return {
        revenue: 'Financial data search failed',
        valuation: 'Financial data search failed',
        fundingHistory: [],
        runway: 'Not available',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async enhanceFinancialData(existingData: any, companyWebsite: string, companyName: string): Promise<any> {
    try {
      const financialData = await this.searchFinancialData(companyWebsite, companyName);
      
      return {
        ...existingData,
        financialData: {
          ...existingData.financialData,
          ...financialData
        }
      };
    } catch (error) {
      console.error('Error enhancing financial data:', error);
      return existingData;
    }
  }
}

export const financialSearchService = new FinancialSearchService();