import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CompanyResearchData {
  dealId: number;
  companyName: string;
  website?: string;
  researchStatus: string;
  executiveTeam: {
    ceo?: {
      name: string;
      linkedinUrl?: string;
      background: string;
      experience: string;
      previousCompanies: string[];
      education?: string;
      achievements?: string[];
    };
    cto?: {
      name: string;
      linkedinUrl?: string;
      background: string;
      experience: string;
    };
    cfo?: {
      name: string;
      linkedinUrl?: string;
      background: string;
      experience: string;
    };
  };
  financialInsights: {
    revenue?: string;
    valuation?: string;
    employeeCount?: string;
    fundingHistory: Array<{
      round: string;
      amount: string;
      date: string;
      investors: string[];
      leadInvestor?: string;
    }>;
    totalFunding?: string;
    lastRoundDate?: string;
    nextRoundProjection?: string;
  };
  externalSources: {
    pitchbookUrl?: string;
    crunchbaseUrl?: string;
    northdataUrl?: string;
    linkedinCompanyUrl?: string;
    angelListUrl?: string;
    owlerUrl?: string;
    glassdoorUrl?: string;
    similarWebUrl?: string;
  };
  businessIntelligence: {
    marketPosition: string;
    competitors: string[];
    partnerships: string[];
    customers: string[];
    recentNews: Array<{
      title: string;
      source: string;
      date: string;
      url?: string;
      summary?: string;
    }>;
    patents?: string[];
    awards?: string[];
  };
  marketAnalysis: {
    marketSize: string;
    marketGrowth: string;
    targetMarket: string;
    geographicPresence: string[];
    marketShare?: string;
    competitiveAdvantages: string[];
  };
  technicalAnalysis: {
    technologyStack?: string[];
    intellectualProperty: string[];
    researchAndDevelopment: string;
    technicalTeamSize?: string;
    innovations: string[];
  };
  investmentHighlights: {
    marketOpportunity: string;
    traction: string[];
    teamStrength: string[];
    differentiation: string[];
    scalabilityFactors: string[];
    exitPotential: string;
  };
  riskAssessment: {
    competitiveRisks: string[];
    marketRisks: string[];
    executionRisks: string[];
    financialRisks: string[];
    technicalRisks: string[];
    regulatoryRisks: string[];
    mitigation: string[];
  };
  socialMediaPresence?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    followers?: any;
  };
  esgFactors?: {
    environmental: string[];
    social: string[];
    governance: string[];
    certifications: string[];
  };
}

export async function performComprehensiveResearch(
  companyName: string, 
  website?: string, 
  dealId?: number
): Promise<CompanyResearchData> {
  try {
    console.log(`🔍 Starting comprehensive research for ${companyName}`);
    
    // Phase 1: Company Overview and Leadership Research
    const executiveResearch = await researchExecutiveTeam(companyName, website);
    
    // Phase 2: Financial and Funding Intelligence
    const financialResearch = await researchFinancialData(companyName, website);
    
    // Phase 3: Market and Business Intelligence
    const businessResearch = await researchBusinessIntelligence(companyName, website);
    
    // Phase 4: Technical and IP Analysis
    const technicalResearch = await researchTechnicalCapabilities(companyName, website);
    
    // Phase 5: External Database Links
    const externalSources = await gatherExternalSources(companyName, website);
    
    // Phase 6: Risk Assessment
    const riskAnalysis = await performRiskAssessment(companyName, website, businessResearch);
    
    return {
      dealId: dealId || 0,
      companyName,
      website,
      researchStatus: 'completed',
      executiveTeam: executiveResearch,
      financialInsights: financialResearch,
      businessIntelligence: businessResearch,
      technicalAnalysis: technicalResearch,
      externalSources,
      marketAnalysis: await analyzeMarketPosition(companyName, website, businessResearch),
      investmentHighlights: await generateInvestmentHighlights(companyName, businessResearch, financialResearch),
      riskAssessment: riskAnalysis,
      socialMediaPresence: await researchSocialMediaPresence(companyName),
      esgFactors: await analyzeESGFactors(companyName, website)
    };
    
  } catch (error) {
    console.error('Research error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to complete research for ${companyName}: ${errorMessage}`);
  }
}

async function researchExecutiveTeam(companyName: string, website?: string) {
  const prompt = `
    Research the executive team of ${companyName}${website ? ` (${website})` : ''}. 
    
    Find detailed information about:
    1. CEO - Name, background, experience, previous companies, education, achievements
    2. CTO/Technical leaders - Background and experience
    3. CFO/Financial leaders - Background and experience
    
    Focus on:
    - Professional backgrounds and career progression
    - Previous startup/corporate experience
    - Educational background
    - Notable achievements or recognitions
    - LinkedIn profiles when available
    
    Return comprehensive but factual information only. If information is not available, state "Information not publicly available" rather than making assumptions.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function researchFinancialData(companyName: string, website?: string) {
  const prompt = `
    Research the financial information and funding history of ${companyName}${website ? ` (${website})` : ''}.
    
    Find information about:
    1. Funding rounds (seed, series A, B, C, etc.)
    2. Investment amounts and dates
    3. Investor names and lead investors
    4. Current valuation estimates
    5. Revenue information (if publicly available)
    6. Employee count and growth
    7. Total funding raised
    8. Most recent funding round details
    
    Look for information from reliable sources like:
    - Company press releases
    - TechCrunch, VentureBeat articles
    - Investor websites
    - SEC filings (if applicable)
    
    Return only verified information. If data is not available, indicate clearly.
    Format as JSON with specific funding rounds and amounts.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function researchBusinessIntelligence(companyName: string, website?: string) {
  const prompt = `
    Research business intelligence for ${companyName}${website ? ` (${website})` : ''}.
    
    Analyze:
    1. Market position and competitive landscape
    2. Direct and indirect competitors
    3. Strategic partnerships and integrations
    4. Key customers or client base
    5. Recent news, announcements, product launches
    6. Patents and intellectual property
    7. Awards and recognitions
    8. Business model and revenue streams
    
    Gather recent news from:
    - Technology publications
    - Industry trade publications
    - Company press releases
    - Conference presentations
    
    Focus on factual, verifiable information. Include source credibility assessment.
    Return as structured JSON with arrays for competitors, partnerships, news items.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function researchTechnicalCapabilities(companyName: string, website?: string) {
  const prompt = `
    Research technical capabilities and innovation for ${companyName}${website ? ` (${website})` : ''}.
    
    Investigate:
    1. Technology stack and platforms used
    2. Technical innovations and unique approaches
    3. Patents and intellectual property portfolio
    4. Research and development activities
    5. Technical team size and expertise
    6. Open source contributions
    7. Technical partnerships
    8. Product architecture and scalability
    
    Look for:
    - Technical blog posts and documentation
    - GitHub repositories (if public)
    - Technical conference presentations
    - Patent filings
    - Technical job postings
    
    Return factual technical information only.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function gatherExternalSources(companyName: string, website?: string) {
  // Generate likely URLs for external databases
  const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return {
    crunchbaseUrl: `https://www.crunchbase.com/organization/${cleanName}`,
    pitchbookUrl: `https://pitchbook.com/profiles/company/${cleanName}`,
    linkedinCompanyUrl: `https://www.linkedin.com/company/${cleanName}`,
    angelListUrl: `https://angel.co/company/${cleanName}`,
    owlerUrl: `https://www.owler.com/company/${cleanName}`,
    glassdoorUrl: `https://www.glassdoor.com/Overview/Working-at-${cleanName}`,
    similarWebUrl: website ? `https://www.similarweb.com/website/${website.replace('https://', '').replace('http://', '').split('/')[0]}` : undefined,
    northdataUrl: `https://www.northdata.com/search?query=${encodeURIComponent(companyName)}`
  };
}

async function analyzeMarketPosition(companyName: string, website?: string, businessData: any) {
  const prompt = `
    Analyze the market position for ${companyName}${website ? ` (${website})` : ''}.
    
    Based on the business information: ${JSON.stringify(businessData)}
    
    Provide analysis on:
    1. Total addressable market (TAM) size
    2. Market growth rate and trends
    3. Target market segments
    4. Geographic presence and expansion plans
    5. Market share estimates (if available)
    6. Competitive advantages and moat
    7. Market positioning strategy
    
    Use industry reports and market research when possible.
    Return structured market analysis.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function generateInvestmentHighlights(companyName: string, businessData: any, financialData: any) {
  const prompt = `
    Generate investment highlights for ${companyName}.
    
    Business data: ${JSON.stringify(businessData)}
    Financial data: ${JSON.stringify(financialData)}
    
    Create investment thesis covering:
    1. Market opportunity size and growth potential
    2. Traction metrics and growth indicators
    3. Team strengths and track record
    4. Competitive differentiation
    5. Scalability factors and expansion potential
    6. Exit potential and comparable transactions
    7. Key value drivers
    
    Focus on quantifiable metrics and concrete evidence.
    Return as structured investment highlights.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function performRiskAssessment(companyName: string, website?: string, businessData: any) {
  const prompt = `
    Perform comprehensive risk assessment for ${companyName}${website ? ` (${website})` : ''}.
    
    Business context: ${JSON.stringify(businessData)}
    
    Analyze risks in these categories:
    1. Competitive risks - Market competition, new entrants, technology disruption
    2. Market risks - Market size, adoption rates, economic factors
    3. Execution risks - Team capability, operational challenges, scaling issues
    4. Financial risks - Funding requirements, burn rate, profitability timeline
    5. Technical risks - Technology challenges, security, scalability
    6. Regulatory risks - Compliance requirements, regulatory changes
    7. Risk mitigation strategies
    
    Provide specific, actionable risk analysis.
    Return structured risk assessment with mitigation strategies.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function researchSocialMediaPresence(companyName: string) {
  const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  return {
    twitter: `https://twitter.com/${cleanName}`,
    linkedin: `https://www.linkedin.com/company/${cleanName}`,
    facebook: `https://www.facebook.com/${cleanName}`,
    instagram: `https://www.instagram.com/${cleanName}`,
    youtube: `https://www.youtube.com/c/${cleanName}`,
    followers: "Social media analytics would require API access"
  };
}

async function analyzeESGFactors(companyName: string, website?: string) {
  const prompt = `
    Analyze ESG (Environmental, Social, Governance) factors for ${companyName}${website ? ` (${website})` : ''}.
    
    Research:
    1. Environmental initiatives and sustainability practices
    2. Social impact programs and community involvement
    3. Governance structure and ethical practices
    4. Diversity and inclusion policies
    5. ESG certifications and ratings
    6. Sustainability reporting
    
    Look for:
    - CSR reports and sustainability statements
    - ESG ratings from agencies
    - Diversity statistics
    - Environmental certifications
    
    Return factual ESG information only.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}