import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CompanyResearchData {
  companyName: string;
  website?: string;
  sector?: string;
  dealId: number;
}

interface ResearchResult {
  websiteAnalysis?: string;
  newsAndPress?: string;
  fundingInformation?: string;
  leadershipTeam?: string;
  industryClassification?: string;
  technologyStack?: string;
  regulatoryCompliance?: string;
  ceoProfile?: any;
  financialData?: any;
  externalLinks?: any;
  businessIntelligence?: any;
  investmentHighlights?: any;
  riskFactors?: any;
  sources: number;
}

export class ComprehensiveResearchService {
  private rateLimiter = new OpenAIRateLimiter();

  async conductComprehensiveResearch(data: CompanyResearchData): Promise<ResearchResult> {
    console.log(`🔍 Starting comprehensive research for ${data.companyName}`);
    
    const researchPromises = [
      this.analyzeWebsite(data),
      this.gatherNewsAndPress(data),
      this.researchFunding(data),
      this.analyzeLeadership(data),
      this.classifyIndustry(data),
      this.analyzeTechnology(data),
      this.assessCompliance(data)
    ];

    const [
      websiteAnalysis,
      newsAndPress,
      fundingInformation,
      leadershipTeam,
      industryClassification,
      technologyStack,
      regulatoryCompliance
    ] = await Promise.allSettled(researchPromises);

    const result: ResearchResult = {
      sources: 0
    };

    // Process results
    if (websiteAnalysis.status === 'fulfilled' && websiteAnalysis.value) {
      result.websiteAnalysis = websiteAnalysis.value;
      result.sources++;
    }

    if (newsAndPress.status === 'fulfilled' && newsAndPress.value) {
      result.newsAndPress = newsAndPress.value;
      result.sources++;
    }

    if (fundingInformation.status === 'fulfilled' && fundingInformation.value) {
      result.fundingInformation = fundingInformation.value;
      result.sources++;
    }

    if (leadershipTeam.status === 'fulfilled' && leadershipTeam.value) {
      result.leadershipTeam = leadershipTeam.value;
      result.sources++;
    }

    if (industryClassification.status === 'fulfilled' && industryClassification.value) {
      result.industryClassification = industryClassification.value;
      result.sources++;
    }

    if (technologyStack.status === 'fulfilled' && technologyStack.value) {
      result.technologyStack = technologyStack.value;
      result.sources++;
    }

    if (regulatoryCompliance.status === 'fulfilled' && regulatoryCompliance.value) {
      result.regulatoryCompliance = regulatoryCompliance.value;
      result.sources++;
    }

    // Generate enhanced research data
    const enhancedData = await this.generateEnhancedInsights(data, result);
    
    return {
      ...result,
      ...enhancedData
    };
  }

  private async analyzeWebsite(data: CompanyResearchData): Promise<string> {
    if (!data.website) {
      return `No website provided for ${data.companyName}. Unable to conduct website analysis.`;
    }

    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Analyze the company "${data.companyName}" with website ${data.website}. 
      
      Provide a comprehensive website analysis including:
      - Company mission and value proposition
      - Products/services offered
      - Target market and customer base
      - Business model assessment
      - Company size and maturity indicators
      - Key competitive advantages
      - Technology platform assessment
      
      Focus on extracting factual information that would be relevant for investment analysis. Be specific and detailed.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return response.choices[0].message.content || "";
    });
  }

  private async gatherNewsAndPress(data: CompanyResearchData): Promise<string> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Research recent news, press releases, and media coverage for "${data.companyName}" in the ${data.sector || 'technology'} sector.
      
      Provide analysis on:
      - Recent major announcements or milestones
      - Media sentiment and coverage
      - Industry recognition or awards
      - Partnership announcements
      - Product launches or updates
      - Any regulatory or compliance news
      - Market positioning and public perception
      
      Focus on information from the last 2 years that would impact investment decisions.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return response.choices[0].message.content || "";
    });
  }

  private async researchFunding(data: CompanyResearchData): Promise<string> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Research the funding history and financial status of "${data.companyName}".
      
      Analyze:
      - Previous funding rounds (seed, Series A, B, C, etc.)
      - Notable investors and venture capital firms
      - Valuation trends over time
      - Revenue model and monetization strategy
      - Financial milestones or reported metrics
      - Debt or alternative financing
      - Exit opportunities or IPO readiness
      
      Provide specific details where available, including amounts, dates, and investor names.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return response.choices[0].message.content || "";
    });
  }

  private async analyzeLeadership(data: CompanyResearchData): Promise<string> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Research the leadership team and key personnel of "${data.companyName}".
      
      Focus on:
      - CEO background, experience, and track record
      - Key co-founders and their roles
      - Executive team composition and expertise
      - Board of directors and advisors
      - Previous successful exits or company building experience
      - Educational backgrounds and industry connections
      - Leadership changes or recent appointments
      
      Emphasize experience relevant to the ${data.sector || 'technology'} sector and startup success factors.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return response.choices[0].message.content || "";
    });
  }

  private async classifyIndustry(data: CompanyResearchData): Promise<string> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Provide a detailed industry classification and market analysis for "${data.companyName}" in the ${data.sector || 'technology'} sector.
      
      Include:
      - Specific industry vertical and sub-sector
      - Market size and growth projections
      - Key industry trends and drivers
      - Competitive landscape overview
      - Regulatory environment
      - Barriers to entry and competitive moats
      - Industry adoption patterns and customer behavior
      - Technology disruption factors
      
      Focus on investment-relevant industry dynamics and positioning.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return response.choices[0].message.content || "";
    });
  }

  private async analyzeTechnology(data: CompanyResearchData): Promise<string> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Analyze the technology stack, intellectual property, and technical capabilities of "${data.companyName}".
      
      Research:
      - Core technology platform and architecture
      - Proprietary technologies or algorithms
      - Patent portfolio and intellectual property
      - Technical team and engineering capabilities
      - Technology partnerships and integrations
      - Scalability and technical infrastructure
      - Data handling and security measures
      - Innovation pipeline and R&D focus
      
      Assess technical differentiation and competitive advantages from a technology perspective.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return response.choices[0].message.content || "";
    });
  }

  private async assessCompliance(data: CompanyResearchData): Promise<string> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Assess the regulatory compliance and legal considerations for "${data.companyName}" in the ${data.sector || 'technology'} sector.
      
      Analyze:
      - Industry-specific regulations and compliance requirements
      - Data privacy and security regulations (GDPR, CCPA, etc.)
      - Financial services regulations if applicable
      - Healthcare or biotech regulations if applicable
      - International compliance for global operations
      - Licensing requirements and regulatory approvals
      - Legal risks and litigation history
      - Compliance certifications and standards
      
      Focus on regulatory factors that could impact business operations or investment risk.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000
      });

      return response.choices[0].message.content || "";
    });
  }

  private async generateEnhancedInsights(data: CompanyResearchData, basicResearch: ResearchResult): Promise<Partial<ResearchResult>> {
    const enhancedPromises = [
      this.generateCEOProfile(data),
      this.generateFinancialData(data),
      this.generateExternalLinks(data),
      this.generateBusinessIntelligence(data, basicResearch),
      this.generateInvestmentHighlights(data, basicResearch),
      this.generateRiskFactors(data, basicResearch)
    ];

    const [
      ceoProfile,
      financialData,
      externalLinks,
      businessIntelligence,
      investmentHighlights,
      riskFactors
    ] = await Promise.allSettled(enhancedPromises);

    const enhanced: Partial<ResearchResult> = {};

    if (ceoProfile.status === 'fulfilled') enhanced.ceoProfile = ceoProfile.value;
    if (financialData.status === 'fulfilled') enhanced.financialData = financialData.value;
    if (externalLinks.status === 'fulfilled') enhanced.externalLinks = externalLinks.value;
    if (businessIntelligence.status === 'fulfilled') enhanced.businessIntelligence = businessIntelligence.value;
    if (investmentHighlights.status === 'fulfilled') enhanced.investmentHighlights = investmentHighlights.value;
    if (riskFactors.status === 'fulfilled') enhanced.riskFactors = riskFactors.value;

    return enhanced;
  }

  private async generateCEOProfile(data: CompanyResearchData): Promise<any> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Create a detailed CEO profile for the company "${data.companyName}". Respond with JSON in this format:
      {
        "name": "CEO Name",
        "background": "Educational and professional background",
        "experience": "Years of experience and previous roles",
        "achievements": ["Achievement 1", "Achievement 2"],
        "leadership_style": "Description of leadership approach",
        "industry_expertise": "Relevant industry knowledge and connections"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    });
  }

  private async generateFinancialData(data: CompanyResearchData): Promise<any> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Generate financial analysis for "${data.companyName}". Respond with JSON in this format:
      {
        "revenue_model": "Description of how the company makes money",
        "funding_stage": "Current funding stage",
        "total_funding": "Total amount raised",
        "latest_valuation": "Most recent valuation if known",
        "burn_rate": "Estimated monthly burn rate",
        "runway": "Estimated runway in months",
        "key_metrics": ["Metric 1", "Metric 2", "Metric 3"],
        "financial_health": "Overall financial health assessment"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    });
  }

  private async generateExternalLinks(data: CompanyResearchData): Promise<any> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Generate relevant external links and sources for "${data.companyName}". Respond with JSON in this format:
      {
        "company_website": "${data.website || ''}",
        "linkedin": "LinkedIn company page URL",
        "crunchbase": "Crunchbase profile URL",
        "news_articles": ["Article URL 1", "Article URL 2"],
        "industry_reports": ["Report URL 1", "Report URL 2"],
        "social_media": {
          "twitter": "Twitter handle",
          "linkedin": "LinkedIn URL"
        },
        "regulatory_filings": ["Filing URL 1", "Filing URL 2"]
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    });
  }

  private async generateBusinessIntelligence(data: CompanyResearchData, research: ResearchResult): Promise<any> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Generate business intelligence analysis for "${data.companyName}" based on the research data. Respond with JSON in this format:
      {
        "market_opportunity": "Size and growth potential of market opportunity",
        "competitive_position": "Position relative to competitors",
        "business_model_strength": "Assessment of business model viability",
        "scalability": "Potential for scaling operations",
        "customer_traction": "Evidence of customer adoption and satisfaction",
        "partnership_ecosystem": "Key partnerships and ecosystem position",
        "technology_moat": "Technical competitive advantages",
        "execution_capability": "Team's ability to execute on vision"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    });
  }

  private async generateInvestmentHighlights(data: CompanyResearchData, research: ResearchResult): Promise<any> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Generate investment highlights for "${data.companyName}". Respond with JSON in this format:
      {
        "key_strengths": ["Strength 1", "Strength 2", "Strength 3"],
        "market_opportunity": "Summary of market opportunity",
        "competitive_advantages": ["Advantage 1", "Advantage 2"],
        "growth_potential": "Assessment of growth potential",
        "team_quality": "Quality of leadership and team",
        "traction_metrics": ["Metric 1", "Metric 2"],
        "strategic_value": "Strategic value proposition for investors",
        "exit_potential": "Potential exit scenarios and timeline"
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    });
  }

  private async generateRiskFactors(data: CompanyResearchData, research: ResearchResult): Promise<any> {
    return this.rateLimiter.executeWithLimit(async () => {
      const prompt = `Generate risk assessment for "${data.companyName}". Respond with JSON in this format:
      {
        "market_risks": ["Risk 1", "Risk 2"],
        "competitive_risks": ["Risk 1", "Risk 2"],
        "execution_risks": ["Risk 1", "Risk 2"],
        "financial_risks": ["Risk 1", "Risk 2"],
        "regulatory_risks": ["Risk 1", "Risk 2"],
        "technology_risks": ["Risk 1", "Risk 2"],
        "team_risks": ["Risk 1", "Risk 2"],
        "overall_risk_level": "Low/Medium/High",
        "key_mitigating_factors": ["Factor 1", "Factor 2"]
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || "{}");
    });
  }
}

class OpenAIRateLimiter {
  private lastRequestTime = 0;
  private minInterval = 1000; // 1 second between requests
  private concurrentLimit = 3;
  private activeRequests = 0;
  private requestQueue: (() => void)[] = [];

  async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        if (this.activeRequests >= this.concurrentLimit) {
          this.requestQueue.push(execute);
          return;
        }

        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minInterval) {
          setTimeout(execute, this.minInterval - timeSinceLastRequest);
          return;
        }

        this.activeRequests++;
        this.lastRequestTime = Date.now();

        try {
          const result = await this.executeWithRetry(fn);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          if (this.requestQueue.length > 0) {
            const nextRequest = this.requestQueue.shift();
            if (nextRequest) {
              setTimeout(nextRequest, this.minInterval);
            }
          }
        }
      };

      execute();
    });
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (error?.status === 429 || error?.code === 'rate_limit_exceeded') {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    throw lastError!;
  }
}

export const comprehensiveResearchService = new ComprehensiveResearchService();