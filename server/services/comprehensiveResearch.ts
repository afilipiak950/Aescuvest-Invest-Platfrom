import { ultraIntelligentAI, UltraIntelligentConfig } from './ultraIntelligentAI';

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

    try {
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

      // Ultra-Intelligent Research Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'research',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.85,
        maxTokens: 2000,
        temperature: 0.3
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`🧠 Ultra-Intelligent Website Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return response.content || "";
    } catch (error) {
      console.error(`❌ Website analysis failed for ${data.companyName}:`, error);
      return `Website analysis temporarily unavailable for ${data.companyName}. Please try again later.`;
    }
  }

  private async gatherNewsAndPress(data: CompanyResearchData): Promise<string> {
    try {
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

      // Ultra-Intelligent Research Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'research',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.85,
        maxTokens: 2000,
        temperature: 0.3
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`📰 Ultra-Intelligent News Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return response.content || "";
    } catch (error) {
      console.error(`❌ News analysis failed for ${data.companyName}:`, error);
      return `News and press analysis temporarily unavailable for ${data.companyName}. Please try again later.`;
    }
  }

  private async researchFunding(data: CompanyResearchData): Promise<string> {
    try {
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

      // Ultra-Intelligent Financial Research Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'financial',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.90,
        maxTokens: 2500,
        temperature: 0.2
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`💰 Ultra-Intelligent Funding Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return response.content || "";
    } catch (error) {
      console.error(`❌ Funding research failed for ${data.companyName}:`, error);
      return `Funding research temporarily unavailable for ${data.companyName}. Please try again later.`;
    }
  }

  private async analyzeLeadership(data: CompanyResearchData): Promise<string> {
    try {
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

      // Ultra-Intelligent Research Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'research',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.85,
        maxTokens: 2000,
        temperature: 0.3
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`👥 Ultra-Intelligent Leadership Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return response.content || "";
    } catch (error) {
      console.error(`❌ Leadership analysis failed for ${data.companyName}:`, error);
      return `Leadership analysis temporarily unavailable for ${data.companyName}. Please try again later.`;
    }
  }

  private async classifyIndustry(data: CompanyResearchData): Promise<string> {
    try {
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

      // Ultra-Intelligent Commercial Analysis Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'commercial',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.85,
        maxTokens: 2000,
        temperature: 0.3
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`🏭 Ultra-Intelligent Industry Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return response.content || "";
    } catch (error) {
      console.error(`❌ Industry analysis failed for ${data.companyName}:`, error);
      return `Industry analysis temporarily unavailable for ${data.companyName}. Please try again later.`;
    }
  }

  private async analyzeTechnology(data: CompanyResearchData): Promise<string> {
    try {
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

      // Ultra-Intelligent Research Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'research',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.85,
        maxTokens: 2000,
        temperature: 0.3
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`🔬 Ultra-Intelligent Technology Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return response.content || "";
    } catch (error) {
      console.error(`❌ Technology analysis failed for ${data.companyName}:`, error);
      return `Technology analysis temporarily unavailable for ${data.companyName}. Please try again later.`;
    }
  }

  private async assessCompliance(data: CompanyResearchData): Promise<string> {
    try {
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

      // Ultra-Intelligent Legal Analysis Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'legal',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.90,
        maxTokens: 2000,
        temperature: 0.2
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`⚖️ Ultra-Intelligent Compliance Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return response.content || "";
    } catch (error) {
      console.error(`❌ Compliance assessment failed for ${data.companyName}:`, error);
      return `Compliance assessment temporarily unavailable for ${data.companyName}. Please try again later.`;
    }
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
    try {
      const prompt = `Create a detailed CEO profile for the company "${data.companyName}". Respond with JSON in this format:
      {
        "name": "CEO Name",
        "background": "Educational and professional background",
        "experience": "Years of experience and previous roles",
        "achievements": ["Achievement 1", "Achievement 2"],
        "leadership_style": "Description of leadership approach",
        "industry_expertise": "Relevant industry knowledge and connections"
      }`;

      // Ultra-Intelligent Research Configuration for CEO Analysis
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'research',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.85,
        maxTokens: 1500,
        temperature: 0.3,
        responseFormat: { type: "json_object" }
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`👤 Ultra-Intelligent CEO Profile: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return JSON.parse(response.content || "{}");
    } catch (error) {
      console.error(`❌ CEO profile generation failed for ${data.companyName}:`, error);
      return {
        name: "CEO profile temporarily unavailable",
        background: "Please try again later",
        experience: "Data collection in progress",
        achievements: [],
        leadership_style: "Analysis pending",
        industry_expertise: "Research ongoing"
      };
    }
  }

  private async generateFinancialData(data: CompanyResearchData): Promise<any> {
    try {
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

      // Ultra-Intelligent Financial Analysis Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'financial',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.90,
        maxTokens: 2000,
        temperature: 0.2,
        responseFormat: { type: "json_object" }
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`💰 Ultra-Intelligent Financial Data: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return JSON.parse(response.content || "{}");
    } catch (error) {
      console.error(`❌ Financial data generation failed for ${data.companyName}:`, error);
      return {
        revenue_model: "Financial analysis temporarily unavailable",
        funding_stage: "Data collection in progress", 
        total_funding: "Please try again later",
        latest_valuation: "Analysis pending",
        burn_rate: "Research ongoing",
        runway: "Data processing",
        key_metrics: [],
        financial_health: "Assessment unavailable"
      };
    }
  }

  private async generateExternalLinks(data: CompanyResearchData): Promise<any> {
    try {
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

      // Ultra-Intelligent Research Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'research',
        complexity: 'medium',
        speedPriority: 'balanced',
        qualityThreshold: 0.80,
        maxTokens: 1000,
        temperature: 0.3,
        responseFormat: { type: "json_object" }
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`🔗 Ultra-Intelligent External Links: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return JSON.parse(response.content || "{}");
    } catch (error) {
      console.error(`❌ External links generation failed for ${data.companyName}:`, error);
      return {
        company_website: data.website || "Website unavailable",
        linkedin: "Research in progress",
        crunchbase: "Data collection pending",
        news_articles: [],
        industry_reports: [],
        social_media: {
          twitter: "Analysis ongoing",
          linkedin: "Please try again later"
        },
        regulatory_filings: []
      };
    }
  }

  private async generateBusinessIntelligence(data: CompanyResearchData, research: ResearchResult): Promise<any> {
    try {
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

      // Ultra-Intelligent Commercial Analysis Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'commercial',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.85,
        maxTokens: 2000,
        temperature: 0.3,
        responseFormat: { type: "json_object" }
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`💼 Ultra-Intelligent Business Intelligence: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return JSON.parse(response.content || "{}");
    } catch (error) {
      console.error(`❌ Business intelligence generation failed for ${data.companyName}:`, error);
      return {
        market_opportunity: "Analysis temporarily unavailable",
        competitive_position: "Research in progress",
        business_model_strength: "Assessment pending",
        scalability: "Evaluation ongoing",
        customer_traction: "Data collection in progress",
        partnership_ecosystem: "Research ongoing",
        technology_moat: "Analysis pending",
        execution_capability: "Assessment unavailable"
      };
    }
  }

  private async generateInvestmentHighlights(data: CompanyResearchData, research: ResearchResult): Promise<any> {
    try {
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

      // Ultra-Intelligent Financial Analysis Configuration for Investment Highlights
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'financial',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.90,
        maxTokens: 2000,
        temperature: 0.2,
        responseFormat: { type: "json_object" }
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`📈 Ultra-Intelligent Investment Highlights: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return JSON.parse(response.content || "{}");
    } catch (error) {
      console.error(`❌ Investment highlights generation failed for ${data.companyName}:`, error);
      return {
        key_strengths: [],
        market_opportunity: "Investment analysis temporarily unavailable",
        competitive_advantages: [],
        growth_potential: "Assessment pending",
        team_quality: "Evaluation in progress",
        traction_metrics: [],
        strategic_value: "Analysis ongoing",
        exit_potential: "Please try again later"
      };
    }
  }

  private async generateRiskFactors(data: CompanyResearchData, research: ResearchResult): Promise<any> {
    try {
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

      // Ultra-Intelligent Risk Assessment Configuration
      const ultraIntelligentConfig: UltraIntelligentConfig = {
        domain: 'financial',
        complexity: 'high',
        speedPriority: 'quality',
        qualityThreshold: 0.90,
        maxTokens: 2000,
        temperature: 0.2,
        responseFormat: { type: "json_object" }
      };

      const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
        { role: "user", content: prompt }
      ], ultraIntelligentConfig);

      console.log(`⚠️ Ultra-Intelligent Risk Assessment: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

      return JSON.parse(response.content || "{}");
    } catch (error) {
      console.error(`❌ Risk factors generation failed for ${data.companyName}:`, error);
      return {
        market_risks: [],
        competitive_risks: [],
        execution_risks: [],
        financial_risks: [],
        regulatory_risks: [],
        technology_risks: [],
        team_risks: [],
        overall_risk_level: "Assessment unavailable",
        key_mitigating_factors: []
      };
    }
  }
}


export const comprehensiveResearchService = new ComprehensiveResearchService();