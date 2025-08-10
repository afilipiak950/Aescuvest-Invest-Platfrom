import OpenAI from "openai";

// GPT-5 is the newest OpenAI model (August 2025) with advanced reasoning capabilities
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CompanyResearchData {
  // Executive Information
  ceoProfile?: {
    name: string;
    background: string;
    experience: string;
    education: string;
    previousCompanies: string[];
    linkedinUrl?: string;
  };
  
  // Key Team Members
  keyTeamMembers?: Array<{
    name: string;
    role: string;
    background: string;
    linkedinUrl?: string;
  }>;
  
  // Financial Information
  financialData?: {
    revenue?: string;
    fundingHistory?: Array<{
      round: string;
      amount: string;
      date: string;
      investors: string[];
    }>;
    valuation?: string;
    employeeCount?: string;
  };
  
  // Market & Competition
  marketAnalysis?: {
    marketSize?: string;
    competitors?: string[];
    marketPosition?: string;
    uniqueValueProposition?: string;
  };
  
  // External Data Sources
  externalLinks?: {
    pitchbookUrl?: string;
    crunchbaseUrl?: string;
    northdataUrl?: string;
    linkedinCompanyUrl?: string;
    angellistUrl?: string;
  };
  
  // Business Intelligence
  businessIntelligence?: {
    recentNews?: Array<{
      title: string;
      source: string;
      date: string;
      url?: string;
    }>;
    patents?: number;
    partnerships?: string[];
    customerBase?: string;
  };
  
  // Risk Assessment
  riskFactors?: {
    regulatory?: string[];
    competitive?: string[];
    financial?: string[];
    operational?: string[];
  };
  
  // Investment Highlights
  investmentHighlights?: {
    traction?: string[];
    growthMetrics?: string[];
    differentiation?: string[];
    teamStrength?: string[];
  };
}

export class AICompanyResearchService {
  
  async conductComprehensiveResearch(
    companyName: string, 
    companyWebsite?: string,
    sector?: string
  ): Promise<CompanyResearchData> {
    try {
      console.log(`🔍 Starting comprehensive AI research for: ${companyName}`);
      
      // Generate search queries for different aspects
      const searchQueries = this.generateResearchQueries(companyName, sector);
      
      // Conduct AI-powered research
      const researchData = await this.performAIResearch(companyName, searchQueries, companyWebsite);
      
      // Analyze and structure the findings
      const structuredData = await this.structureResearchFindings(researchData, companyName);
      
      console.log(`✅ Research completed for: ${companyName}`);
      return structuredData;
      
    } catch (error) {
      console.error(`❌ Research failed for ${companyName}:`, error);
      throw new Error(`Failed to conduct research for ${companyName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private generateResearchQueries(companyName: string, sector?: string): string[] {
    return [
      `${companyName} CEO founder leadership team`,
      `${companyName} funding investment valuation crunchbase`,
      `${companyName} revenue financial performance metrics`,
      `${companyName} pitchbook profile startup database`,
      `${companyName} northdata company information germany`,
      `${companyName} competitors market analysis ${sector || ''}`,
      `${companyName} news recent developments partnerships`,
      `${companyName} linkedin company profile employees`,
      `${companyName} patents intellectual property technology`,
      `${companyName} customers clients case studies traction`
    ];
  }
  
  private async performAIResearch(
    companyName: string, 
    queries: string[],
    website?: string
  ): Promise<string> {
    const researchPrompt = `
    As an expert venture capital analyst, conduct comprehensive research on "${companyName}" ${website ? `(website: ${website})` : ''}.
    
    Research the following critical areas that investors need to know:
    
    1. EXECUTIVE TEAM & LEADERSHIP:
       - CEO/Founder profile, background, experience, education
       - Key team members and their roles
       - Leadership track record and previous companies
       - LinkedIn profiles if available
    
    2. FINANCIAL INFORMATION:
       - Current and historical revenue (if publicly available)
       - Funding history: rounds, amounts, dates, investors
       - Current valuation estimates
       - Employee count and growth
    
    3. EXTERNAL DATA SOURCES:
       - Pitchbook profile URL (search for pitchbook.com links)
       - Crunchbase profile URL
       - Northdata information (especially for German companies)
       - LinkedIn company page
       - AngelList profile
    
    4. MARKET POSITION:
       - Market size and opportunity
       - Direct competitors and competitive landscape
       - Unique value proposition and differentiation
       - Market positioning
    
    5. BUSINESS INTELLIGENCE:
       - Recent news and press releases
       - Patent portfolio
       - Strategic partnerships
       - Customer base and traction metrics
    
    6. INVESTMENT ASSESSMENT:
       - Growth metrics and KPIs
       - Traction indicators
       - Team strengths
       - Technology/product differentiation
    
    7. RISK FACTORS:
       - Regulatory risks
       - Competitive threats
       - Financial risks
       - Operational challenges
    
    Please provide comprehensive, factual information with specific details, numbers, and sources where possible.
    Focus on information that would be critical for an investor's due diligence process.
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a senior venture capital analyst with access to comprehensive business intelligence. Provide detailed, factual research based on publicly available information."
        },
        {
          role: "user",
          content: researchPrompt
        }
      ],
      max_tokens: 4000,
      temperature: 0.3
    });
    
    return response.choices[0].message.content || '';
  }
  
  private async structureResearchFindings(
    researchText: string, 
    companyName: string
  ): Promise<CompanyResearchData> {
    const structuringPrompt = `
    Analyze the following research about "${companyName}" and structure it into a JSON format.
    Extract specific, factual information and organize it properly.
    
    Research Data:
    ${researchText}
    
    Please structure this information into the following JSON format:
    {
      "ceoProfile": {
        "name": "CEO name if found",
        "background": "Brief background",
        "experience": "Professional experience",
        "education": "Educational background",
        "previousCompanies": ["Company1", "Company2"],
        "linkedinUrl": "LinkedIn URL if found"
      },
      "keyTeamMembers": [
        {
          "name": "Name",
          "role": "Position",
          "background": "Background",
          "linkedinUrl": "LinkedIn URL if available"
        }
      ],
      "financialData": {
        "revenue": "Revenue information",
        "fundingHistory": [
          {
            "round": "Series A/Seed/etc",
            "amount": "$X million",
            "date": "Date",
            "investors": ["Investor1", "Investor2"]
          }
        ],
        "valuation": "Current valuation",
        "employeeCount": "Number of employees"
      },
      "marketAnalysis": {
        "marketSize": "Market size information",
        "competitors": ["Competitor1", "Competitor2"],
        "marketPosition": "Position description",
        "uniqueValueProposition": "UVP description"
      },
      "externalLinks": {
        "pitchbookUrl": "Pitchbook URL if found",
        "crunchbaseUrl": "Crunchbase URL if found",
        "northdataUrl": "Northdata URL if found",
        "linkedinCompanyUrl": "LinkedIn company URL",
        "angellistUrl": "AngelList URL if found"
      },
      "businessIntelligence": {
        "recentNews": [
          {
            "title": "News title",
            "source": "News source",
            "date": "Date",
            "url": "URL if available"
          }
        ],
        "patents": "Number of patents",
        "partnerships": ["Partner1", "Partner2"],
        "customerBase": "Customer information"
      },
      "riskFactors": {
        "regulatory": ["Risk1", "Risk2"],
        "competitive": ["Risk1", "Risk2"],
        "financial": ["Risk1", "Risk2"],
        "operational": ["Risk1", "Risk2"]
      },
      "investmentHighlights": {
        "traction": ["Highlight1", "Highlight2"],
        "growthMetrics": ["Metric1", "Metric2"],
        "differentiation": ["Factor1", "Factor2"],
        "teamStrength": ["Strength1", "Strength2"]
      }
    }
    
    Only include fields where you have actual information. Use null for missing data.
    Ensure all URLs are complete and valid if included.
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a data structuring expert. Extract and organize information into valid JSON format."
        },
        {
          role: "user",
          content: structuringPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 3000,
      temperature: 0.1
    });
    
    try {
      const structuredData = JSON.parse(response.choices[0].message.content || '{}');
      return structuredData as CompanyResearchData;
    } catch (error) {
      console.error('Failed to parse structured research data:', error);
      return {};
    }
  }
  
  // Method to update deal with research data
  async enrichDealWithResearch(dealId: number, researchData: CompanyResearchData): Promise<void> {
    // This will be implemented to update the deal with research findings
    console.log(`📊 Enriching deal ${dealId} with research data`);
    // Implementation will depend on how we want to store this data
  }
}

export const aiCompanyResearchService = new AICompanyResearchService();