import { ultraIntelligentAI, UltraIntelligentConfig } from './ultraIntelligentAI';
import { storage } from "../storage";

// All OpenAI calls migrated to Ultra-Intelligent AI system with GPT-5

export interface CompanyIntelligence {
  ceoProfile?: {
    name: string;
    background: string;
    experience: string;
    previousCompanies: string[];
    linkedinUrl?: string;
  };
  
  financialInsights?: {
    fundingHistory?: Array<{
      round: string;
      amount: string;
      date: string;
      investors: string[];
    }>;
    revenue?: string;
    valuation?: string;
    employeeCount?: string;
  };
  
  externalSources?: {
    pitchbookUrl?: string;
    crunchbaseUrl?: string;
    northdataUrl?: string;
    linkedinCompanyUrl?: string;
  };
  
  businessIntelligence?: {
    competitors?: string[];
    marketPosition?: string;
    recentNews?: Array<{
      title: string;
      source: string;
      date: string;
    }>;
    partnerships?: string[];
  };
  
  investmentHighlights?: {
    traction?: string[];
    teamStrength?: string[];
    marketOpportunity?: string;
    differentiation?: string[];
  };
  
  riskAssessment?: {
    competitiveRisks?: string[];
    marketRisks?: string[];
    executionRisks?: string[];
  };
}

export class CompanyResearchService {
  
  async conductAutomatedResearch(
    companyName: string, 
    website?: string,
    sector?: string
  ): Promise<CompanyIntelligence> {
    try {
      console.log(`Starting automated research for: ${companyName}`);
      
      const researchPrompt = `
      As a senior venture capital analyst, conduct comprehensive due diligence research on "${companyName}" ${website ? `(website: ${website})` : ''} ${sector ? `in the ${sector} sector` : ''}.
      
      Focus on gathering the following critical investor information:
      
      1. CEO & LEADERSHIP TEAM:
         - CEO/Founder name, background, previous experience
         - Key executives and their track records
         - Educational background and notable achievements
         - LinkedIn profiles and professional networks
      
      2. FINANCIAL INTELLIGENCE:
         - Historical funding rounds (seed, Series A, B, etc.)
         - Investment amounts, dates, and lead investors
         - Current revenue estimates and growth metrics
         - Valuation history and current market cap
         - Employee headcount and growth rate
      
      3. EXTERNAL DATA SOURCES (provide direct URLs when available):
         - Pitchbook company profile URL
         - Crunchbase company page URL
         - Northdata information (for German/European companies)
         - LinkedIn company page URL
         - Other relevant startup databases
      
      4. MARKET & COMPETITIVE ANALYSIS:
         - Direct competitors and market positioning
         - Market size and growth potential
         - Competitive advantages and differentiation
         - Recent industry developments
      
      5. BUSINESS TRACTION & NEWS:
         - Recent funding announcements
         - Product launches and milestones
         - Strategic partnerships and collaborations
         - Customer wins and market expansion
         - Press coverage and media mentions
      
      6. INVESTMENT ASSESSMENT:
         - Key growth metrics and KPIs
         - Team quality and execution capability
         - Market opportunity size and timing
         - Technology or business model innovation
         - Scalability and expansion potential
      
      7. RISK FACTORS:
         - Competitive threats and market risks
         - Execution challenges and dependencies
         - Regulatory or compliance issues
         - Technology or market disruption risks
      
      Please provide specific, factual information with actual names, numbers, dates, and URLs where available.
      Focus on information that would be critical for investor due diligence and decision-making.
      `;
      
      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        {
          role: "system",
          content: "You are a senior venture capital analyst with expertise in startup due diligence. Provide comprehensive, factual research based on publicly available information. Structure your response clearly and include specific details that investors need for decision-making."
        },
        {
          role: "user",
          content: researchPrompt
        }
      ], {
        qualityThreshold: 0.90,
        maxTokens: 4000,
        temperature: 0.2
      } as UltraIntelligentConfig);
      
      console.log(`🤖 Ultra-Intelligent Company Research: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);
      
      const researchText = response.content || '';
      
      // Structure the research findings
      const structuredData = await this.structureFindings(researchText, companyName);
      
      console.log(`Research completed for: ${companyName}`);
      return structuredData;
      
    } catch (error) {
      console.error(`Research failed for ${companyName}:`, error);
      throw new Error(`Failed to conduct research: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async structureFindings(researchText: string, companyName: string): Promise<CompanyIntelligence> {
    const structuringPrompt = `
    Extract and structure the following research about "${companyName}" into a clean JSON format:
    
    ${researchText}
    
    Structure the information as follows:
    {
      "ceoProfile": {
        "name": "CEO name",
        "background": "Professional background",
        "experience": "Relevant experience",
        "previousCompanies": ["Company1", "Company2"],
        "linkedinUrl": "LinkedIn URL if found"
      },
      "financialInsights": {
        "fundingHistory": [
          {
            "round": "Series A/Seed",
            "amount": "$X million",
            "date": "Date",
            "investors": ["Investor1", "Investor2"]
          }
        ],
        "revenue": "Revenue information",
        "valuation": "Current valuation",
        "employeeCount": "Number of employees"
      },
      "externalSources": {
        "pitchbookUrl": "Pitchbook URL",
        "crunchbaseUrl": "Crunchbase URL", 
        "northdataUrl": "Northdata URL",
        "linkedinCompanyUrl": "LinkedIn company URL"
      },
      "businessIntelligence": {
        "competitors": ["Competitor1", "Competitor2"],
        "marketPosition": "Market position description",
        "recentNews": [
          {
            "title": "News title",
            "source": "Source",
            "date": "Date"
          }
        ],
        "partnerships": ["Partner1", "Partner2"]
      },
      "investmentHighlights": {
        "traction": ["Highlight1", "Highlight2"],
        "teamStrength": ["Strength1", "Strength2"],
        "marketOpportunity": "Market opportunity description",
        "differentiation": ["Factor1", "Factor2"]
      },
      "riskAssessment": {
        "competitiveRisks": ["Risk1", "Risk2"],
        "marketRisks": ["Risk1", "Risk2"],
        "executionRisks": ["Risk1", "Risk2"]
      }
    }
    
    Only include fields with actual information. Use null for missing data.
    Ensure URLs are complete and valid.
    `;
    
    try {
      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        {
          role: "system",
          content: "You are a data extraction expert. Convert research text into structured JSON format."
        },
        {
          role: "user",
          content: structuringPrompt
        }
      ], {
        responseFormat: { type: "json_object" },
        qualityThreshold: 0.90,
        maxTokens: 2000,
        temperature: 0.1
      } as UltraIntelligentConfig);
      
      console.log(`🤖 Ultra-Intelligent Data Structuring: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);
      
      // Clean response content and strip markdown code blocks before parsing
      let cleanContent = response.content;
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      }
      if (cleanContent.includes('```')) {
        cleanContent = cleanContent.replace(/```[a-zA-Z]*\s*/g, '').replace(/```\s*$/g, '');
      }
      
      return JSON.parse(cleanContent || '{}');
    } catch (error) {
      console.error('Failed to structure research data:', error);
      return {};
    }
  }
  
  async saveResearchToDeal(dealId: number, researchData: CompanyIntelligence): Promise<void> {
    try {
      await storage.createCompanyResearch({
        dealId,
        ceoProfile: researchData.ceoProfile,
        keyTeamMembers: null,
        financialData: researchData.financialInsights,
        marketAnalysis: researchData.businessIntelligence,
        externalLinks: researchData.externalSources,
        businessIntelligence: researchData.businessIntelligence,
        riskFactors: researchData.riskAssessment,
        investmentHighlights: researchData.investmentHighlights,
        researchStatus: 'completed'
      });
      
      console.log(`Research data saved for deal ${dealId}`);
    } catch (error) {
      console.error(`Failed to save research for deal ${dealId}:`, error);
    }
  }
}

export const companyResearchService = new CompanyResearchService();