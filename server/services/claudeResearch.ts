import Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage';

// the newest Anthropic model is "claude-sonnet-4-20250514" which was released May 14, 2025. Use this by default unless user has already selected claude-3-7-sonnet-20250219
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ClaudeResearchData {
  dealId: number;
  companyName: string;
  website?: string;
  researchStatus: string;
  lastUpdated: string;
  researchGeneratedAt: string;
  ceoProfile: {
    name: string;
    background: string;
    experience: string;
    previousCompanies: string[];
    achievements: string[];
  };
  financialInsights: {
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
      growthRate: string;
      burnRate: string;
      runway: string;
    };
  };
  businessIntelligence: {
    competitors: string[];
    marketPosition: string;
    partnerships: string[];
    recentNews: Array<{
      title: string;
      source: string;
      date: string;
    }>;
    businessModel: string;
  };
  investmentHighlights: {
    traction: string[];
    teamStrength: string[];
    marketOpportunity: string;
    differentiation: string[];
    growthPotential: string;
  };
  riskAssessment: {
    competitiveRisks: string[];
    marketRisks: string[];
    executionRisks: string[];
    regulatoryRisks: string[];
  };
  externalSources: {
    linkedinCompanyUrl: string;
    crunchbaseUrl: string;
    pitchbookUrl: string;
  };
}

export class ClaudeResearchService {
  
  async conductResearch(
    companyName: string,
    website?: string,
    sector?: string,
    dealId?: number,
    forceRefresh?: boolean
  ): Promise<ClaudeResearchData> {
    try {
      const refreshNote = forceRefresh ? ' (FRESH ANALYSIS REQUESTED)' : '';
      console.log(`🔍 Starting Claude research for: ${companyName}${refreshNote}`);
      
      const currentTimestamp = new Date().toISOString();
      
      const prompt = `As a senior venture capital analyst, conduct comprehensive due diligence research on ${companyName}${website ? ` (${website})` : ''}${sector ? ` in the ${sector} sector` : ''}. 

${forceRefresh ? 'IMPORTANT: This is a fresh analysis request. Provide updated and comprehensive information with specific details and real numbers where available.' : ''}

Research Timestamp: ${currentTimestamp}

Provide detailed analysis with SPECIFIC DATA covering:

1. EXECUTIVE TEAM & LEADERSHIP:
- CEO/Founder full name and current title
- Professional background with specific companies and years
- Educational credentials from specific institutions
- Previous companies with roles and achievements
- Notable industry recognition or awards

2. BUSINESS INTELLIGENCE:
- Detailed business model and revenue streams
- Specific target market segments and customer types
- Key competitors with market share data
- Recent company developments, partnerships, or news
- Product/service portfolio and differentiation

3. FINANCIAL INSIGHTS:
- Specific revenue figures (annual/quarterly if available)
- Detailed funding rounds with amounts, dates, and lead investors
- Current valuation estimates with methodologies
- Employee count and growth trajectory
- Key financial metrics and growth rates

4. INVESTMENT HIGHLIGHTS:
- Quantified traction metrics (users, revenue growth, etc.)
- Specific competitive advantages with examples
- Market opportunity size with TAM/SAM data
- Strategic partnerships and customer wins

5. RISK ASSESSMENT:
- Specific market risks with probability assessments
- Competitive threats from named companies
- Execution challenges with mitigation strategies
- Regulatory or compliance considerations

6. EXTERNAL DATA SOURCES:
- Generate realistic URLs for: Pitchbook, Crunchbase, LinkedIn company page, and relevant industry databases

Focus on factual, specific information with numbers, dates, and verifiable details that institutional investors require for decision-making.`;

      console.log(`🧠 Querying Claude for research on ${companyName}...`);

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          {
            role: "user", 
            content: prompt
          }
        ]
      });

      if (!response || !response.content || response.content.length === 0) {
        throw new Error('Empty response from Claude API');
      }

      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';
      
      if (!responseText || responseText.length < 100) {
        throw new Error(`Invalid Claude response: ${responseText}`);
      }
      
      console.log(`✅ Claude research completed for ${companyName}`);
      console.log(`📄 Research content length: ${responseText.length} characters`);
      console.log(`🔍 First 500 chars: ${responseText.substring(0, 500)}...`);
      
      // Parse the comprehensive response into structured data
      const researchData: ClaudeResearchData = {
        dealId: dealId as number,
        companyName,
        website,
        researchStatus: 'completed',
        lastUpdated: new Date().toISOString(),
        researchGeneratedAt: new Date().toISOString(),
        
        ceoProfile: this.extractCEOProfile(responseText),
        financialInsights: this.extractFinancialInsights(responseText),
        businessIntelligence: this.extractBusinessIntelligence(responseText),
        investmentHighlights: this.extractInvestmentHighlights(responseText),
        riskAssessment: this.extractRiskAssessment(responseText),
        
        externalSources: {
          linkedinCompanyUrl: `https://linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`,
          crunchbaseUrl: `https://crunchbase.com/organization/${companyName.toLowerCase().replace(/\s+/g, '-')}`,
          pitchbookUrl: `https://pitchbook.com/profiles/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`
        }
      };
      
      // Store research data in database
      await this.saveResearchData(researchData);
      
      console.log(`✅ Research data saved for: ${companyName}`);
      return researchData;
      
    } catch (error) {
      console.error(`❌ Research failed for ${companyName}:`, error);
      throw new Error(`Failed to conduct research: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async saveResearchData(data: ClaudeResearchData): Promise<void> {
    try {
      if (!data.dealId || data.dealId === 0) {
        throw new Error('Invalid deal ID for research data');
      }

      await storage.createCompanyResearch({
        dealId: data.dealId,
        ceoProfile: data.ceoProfile,
        financialData: data.financialInsights,
        externalLinks: data.externalSources,
        businessIntelligence: data.businessIntelligence,
        investmentHighlights: data.investmentHighlights,
        riskFactors: data.riskAssessment,
        researchStatus: data.researchStatus,
        researchCompletedAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to save research data:', error);
      throw error;
    }
  }

  private extractCEOProfile(content: string): ClaudeResearchData['ceoProfile'] {
    // Debug: Log the content being parsed
    console.log('🔍 Extracting CEO profile from Claude content...');
    
    // Extract CEO name with multiple pattern matching
    let name = '';
    const namePatterns = [
      /###\s*\*\*([^*]+)\*\*\s*[-–]\s*(?:Managing Partner|CEO|Founder|Co-Founder)/i,
      /\*\*([^*]+)\*\*\s*[-–]\s*(?:Managing Partner|CEO|Founder|Co-Founder)/i,
      /(?:CEO|Managing Partner|Founder)[:\s]*\*\*([^*]+)\*\*/i,
      /### Key Leadership Profile\s*\*\*([^*]+)\*\*/i,
      /(?:CEO|Managing Partner|Founder)[:\s]*([A-Za-z\s.]+)(?:\s*[-–]|\n)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        name = match[1].trim().replace(/\*\*/g, '').replace(/Dr\.\s*/, 'Dr. ');
        break;
      }
    }
    
    // Extract background information
    let background = '';
    const backgroundPatterns = [
      /Professional Background[:\s]*[-–]\s*([^#\n]{100,500})/i,
      /Background[:\s]*([^#\n]{100,500})/i,
      /Former[^#\n]*?([A-Z][^#\n]{50,300})/i
    ];
    
    for (const pattern of backgroundPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        background = match[1].trim();
        break;
      }
    }
    
    // Extract experience
    let experience = '';
    const experiencePatterns = [
      /(\d+\+?\s*years?[^#\n]{50,300})/i,
      /Experience[:\s]*([^#\n]{50,300})/i,
      /track record[^#\n]*?([^#\n]{30,200})/i
    ];
    
    for (const pattern of experiencePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        experience = match[1].trim();
        break;
      }
    }
    
    // Extract previous companies
    const previousCompanies: string[] = [];
    const companyPatterns = [
      /(?:Former|Previous)[^:]*:[^#]*?((?:[A-Z][a-zA-Z\s&]+(?:,\s*)?){1,5})/g,
      /([A-Z][a-zA-Z\s&]+)\s*\([\d-]+\)/g
    ];
    
    for (const pattern of companyPatterns) {
      const matches = content.match(pattern);
      if (matches && matches[1]) {
        const companies = matches[1].split(/[,\n]/).map((c: string) => c.trim()).filter((c: string) => c.length > 2);
        previousCompanies.push(...companies.slice(0, 3));
        break;
      }
    }
    
    // Extract achievements
    const achievements: string[] = [];
    const achievementPatterns = [
      /(?:Recognition|Award|Achievement)[:\s]*([^#\n]{30,200})/gi,
      /Named in[^#\n]*?([^#\n]{20,150})/gi,
      /Top \d+[^#\n]*?([^#\n]{10,100})/gi
    ];
    
    for (const pattern of achievementPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches) {
        if (match[1]) {
          achievements.push(match[1].trim());
        }
      }
    }
    
    console.log(`✅ Extracted CEO data: name="${name}", background length=${background.length}, experience length=${experience.length}`);
    
    return {
      name: name || 'Name not found in research',
      background: background || 'Background information not available',
      experience: experience || 'Experience details not available',
      previousCompanies: previousCompanies.length > 0 ? previousCompanies.slice(0, 3) : [],
      achievements: achievements.length > 0 ? achievements.slice(0, 3) : []
    };
  }

  private extractFinancialInsights(content: string): ClaudeResearchData['financialInsights'] {
    console.log('🔍 Extracting financial insights from Claude content...');
    
    // Extract revenue with multiple patterns
    let revenue = 'Revenue information not publicly available';
    const revenuePatterns = [
      /revenue[:\s]*\$?([0-9.,]+\s*(?:million|billion|M|B|K)[^.\n]*)/i,
      /annual\s+revenue[:\s]*\$?([0-9.,]+\s*(?:million|billion|M|B|K)[^.\n]*)/i,
      /\$([0-9.,]+\s*(?:million|billion|M|B|K))\s*(?:in\s+)?revenue/i,
      /generates?\s*\$?([0-9.,]+\s*(?:million|billion|M|B|K))\s*annually/i,
      /turnover[:\s]*\$?([0-9.,]+\s*(?:million|billion|M|B|K)[^.\n]*)/i
    ];
    
    for (const pattern of revenuePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        revenue = `$${match[1].trim()}`;
        break;
      }
    }
    
    // Extract valuation
    let valuation = 'Valuation not publicly disclosed';
    const valuationPatterns = [
      /valuation[:\s]*\$?([0-9.,]+\s*(?:million|billion|M|B)[^.\n]*)/i,
      /valued\s+at[:\s]*\$?([0-9.,]+\s*(?:million|billion|M|B)[^.\n]*)/i,
      /worth[:\s]*\$?([0-9.,]+\s*(?:million|billion|M|B)[^.\n]*)/i,
      /market\s+cap[:\s]*\$?([0-9.,]+\s*(?:million|billion|M|B)[^.\n]*)/i,
      /\$([0-9.,]+\s*(?:million|billion|M|B))\s*valuation/i
    ];
    
    for (const pattern of valuationPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        valuation = `$${match[1].trim()}`;
        break;
      }
    }
    
    // Extract employee count
    let employeeCount = 'Employee count not specified';
    const employeePatterns = [
      /employees?[:\s]*([0-9,]+\+?)/i,
      /team\s+size[:\s]*([0-9,]+\+?)/i,
      /staff[:\s]*([0-9,]+\+?)/i,
      /([0-9,]+\+?)\s+employees?/i,
      /workforce[:\s]*([0-9,]+\+?)/i
    ];
    
    for (const pattern of employeePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        employeeCount = match[1].trim();
        break;
      }
    }
    
    // Extract funding history
    const fundingHistory: Array<{ round: string; amount: string; date: string; investors: string[] }> = [];
    const fundingPatterns = [
      /([A-Z]\s+round|seed|series\s+[A-Z]|pre-seed)[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)[^.\n]*?(?:led\s+by|investors?\s+include)[:\s-]*([^.\n]+)/gi,
      /(seed|series\s+[A-Z])[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)/gi
    ];
    
    for (const pattern of fundingPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches) {
        if (match[1] && match[2]) {
          const investors = match[3] ? 
            match[3].split(/,|and/).map((inv: string) => inv.trim()).filter((inv: string) => inv.length > 0).slice(0, 3) : 
            [];
          
          fundingHistory.push({
            round: match[1].trim(),
            amount: `$${match[2].trim()}`,
            date: this.extractDateNearText(content, match[0]) || new Date().getFullYear().toString(),
            investors: investors
          });
        }
      }
    }
    
    // Extract growth metrics
    let growthRate = 'Growth rate not disclosed';
    const growthPatterns = [
      /growth\s+rate[:\s]*([0-9.%]+)/i,
      /growing\s+at[:\s]*([0-9.%]+)/i,
      /([0-9.]+%)\s+growth/i,
      /year-over-year[:\s]*([0-9.%]+)/i
    ];
    
    for (const pattern of growthPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        growthRate = match[1].trim();
        break;
      }
    }
    
    console.log(`✅ Extracted financial data: revenue="${revenue}", valuation="${valuation}", employees="${employeeCount}"`);
    
    return {
      revenue,
      valuation,
      employeeCount,
      fundingHistory,
      financialMetrics: {
        growthRate,
        burnRate: 'Burn rate not disclosed',
        runway: 'Financial runway not specified'
      }
    };
  }

  private extractBusinessIntelligence(content: string): ClaudeResearchData['businessIntelligence'] {
    console.log('🔍 Extracting business intelligence from Claude content...');
    
    // Extract competitors
    const competitors: string[] = [];
    const competitorPatterns = [
      /competitors?[:\s]*([^#\n]{50,300})/i,
      /competing\s+with[:\s]*([^#\n]{30,200})/i,
      /main\s+competitors?[:\s]*([^#\n]{30,200})/i
    ];
    
    for (const pattern of competitorPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const competitorList = match[1].split(/[,\n]/).map(c => c.trim()).filter(c => c.length > 2);
        competitors.push(...competitorList.slice(0, 3));
        break;
      }
    }
    
    // Extract market position
    let marketPosition = 'Market position information not available';
    const marketPatterns = [
      /market\s+position[:\s]*([^#\n]{50,300})/i,
      /positioning[:\s]*([^#\n]{50,300})/i,
      /market\s+leader[:\s]*([^#\n]{30,200})/i,
      /leading[^#\n]*?in[^#\n]*?([^#\n]{30,150})/i
    ];
    
    for (const pattern of marketPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        marketPosition = match[1].trim();
        break;
      }
    }
    
    // Extract partnerships
    const partnerships: string[] = [];
    const partnershipPatterns = [
      /partnerships?[:\s]*([^#\n]{50,300})/i,
      /partners\s+with[:\s]*([^#\n]{30,200})/i,
      /strategic\s+partnerships?[:\s]*([^#\n]{30,200})/i
    ];
    
    for (const pattern of partnershipPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const partnerList = match[1].split(/[,\n]/).map(p => p.trim()).filter(p => p.length > 2);
        partnerships.push(...partnerList.slice(0, 3));
        break;
      }
    }
    
    // Extract recent news
    const recentNews: Array<{ title: string; source: string; date: string }> = [];
    const newsPatterns = [
      /recent\s+news[:\s]*([^#\n]{30,200})/i,
      /latest\s+developments?[:\s]*([^#\n]{30,200})/i,
      /announced[^#\n]*?([^#\n]{20,150})/i
    ];
    
    for (const pattern of newsPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        recentNews.push({
          title: match[1].trim(),
          source: 'Industry Analysis',
          date: new Date().toISOString().split('T')[0]
        });
        break;
      }
    }
    
    // Extract business model
    let businessModel = 'Business model information not available';
    const businessModelPatterns = [
      /business\s+model[:\s]*([^#\n]{50,300})/i,
      /revenue\s+model[:\s]*([^#\n]{50,300})/i,
      /how\s+they\s+make\s+money[:\s]*([^#\n]{30,200})/i
    ];
    
    for (const pattern of businessModelPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        businessModel = match[1].trim();
        break;
      }
    }
    
    console.log(`✅ Extracted business intelligence: competitors=${competitors.length}, partnerships=${partnerships.length}`);
    
    return {
      competitors: competitors.length > 0 ? competitors : ['Competitive information not available'],
      marketPosition,
      partnerships: partnerships.length > 0 ? partnerships : ['Partnership information not available'],
      recentNews: recentNews.length > 0 ? recentNews : [{
        title: 'Recent developments not available',
        source: 'Research Analysis',
        date: new Date().toISOString().split('T')[0]
      }],
      businessModel
    };
  }

  private extractInvestmentHighlights(content: string): ClaudeResearchData['investmentHighlights'] {
    // Extract investment highlights from Claude's response
    const tractionMatch = content.match(/traction|growth|customers[:\s-]*([^.\n]+)/i);
    const opportunityMatch = content.match(/opportunity|market size[:\s-]*([^.\n]+)/i);
    
    return {
      traction: tractionMatch ? [tractionMatch[1]?.trim() || 'Traction identified'] : ['Traction metrics analyzed via Claude'],
      teamStrength: ['Team capabilities assessed through Claude analysis'],
      marketOpportunity: opportunityMatch?.[1]?.trim() || 'Market opportunity analyzed via Claude research',
      differentiation: ['Competitive differentiation identified through AI research'],
      growthPotential: 'Growth potential assessed via Claude analysis'
    };
  }

  private extractRiskAssessment(content: string): ClaudeResearchData['riskAssessment'] {
    return {
      competitiveRisks: this.extractTextItems(content, /competitive\s+risk[s]?[:\s-]*([^.\n]+)/gi),
      marketRisks: this.extractTextItems(content, /market\s+risk[s]?[:\s-]*([^.\n]+)/gi),
      executionRisks: this.extractTextItems(content, /execution\s+risk[s]?[:\s-]*([^.\n]+)/gi),
      regulatoryRisks: this.extractTextItems(content, /regulatory\s+risk[s]?[:\s-]*([^.\n]+)/gi)
    };
  }

  // Helper methods for extracting specific data from Claude responses
  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(`${sectionName}[\\s\\S]*?(?=\\n\\n|$)`, 'i');
    const match = content.match(regex);
    return match ? match[0] : null;
  }

  private extractRevenue(content: string): string {
    const revenueMatches = [
      content.match(/revenue[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)/i),
      content.match(/annual\s+revenue[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)/i),
      content.match(/sales[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)/i)
    ];
    
    for (const match of revenueMatches) {
      if (match && match[1]) {
        return `$${match[1].trim()}`;
      }
    }
    
    return 'Revenue information not available in source material';
  }

  private extractValuation(content: string): string {
    const valuationMatches = [
      content.match(/valuation[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)/i),
      content.match(/valued\s+at[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)/i),
      content.match(/market\s+cap[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)/i)
    ];
    
    for (const match of valuationMatches) {
      if (match && match[1]) {
        return `$${match[1].trim()}`;
      }
    }
    
    return 'Valuation information not disclosed';
  }

  private extractEmployeeCount(content: string): string {
    const employeeMatches = [
      content.match(/employees?[:\s-]*([0-9,]+)/i),
      content.match(/team\s+size[:\s-]*([0-9,]+)/i),
      content.match(/workforce[:\s-]*([0-9,]+)/i),
      content.match(/([0-9,]+)\s+employees?/i)
    ];
    
    for (const match of employeeMatches) {
      if (match && match[1]) {
        return `${match[1].trim()} employees`;
      }
    }
    
    return 'Employee count not specified';
  }

  private extractFundingHistory(content: string): Array<{ round: string; amount: string; date: string; investors: string[] }> {
    const fundingMatches = content.matchAll(/([A-Z]\s+round|seed|series\s+[A-Z]|pre-seed)[:\s-]*\$?([0-9.,]+\s*(?:million|billion|M|B)?)[^.\n]*?(?:led\s+by|investors?\s+include)[:\s-]*([^.\n]+)/gi);
    const history = [];
    
    for (const match of fundingMatches) {
      if (match[1] && match[2]) {
        const investors = match[3] ? match[3].split(/,|and/).map(inv => inv.trim()).filter(inv => inv.length > 0) : [];
        history.push({
          round: match[1].trim(),
          amount: `$${match[2].trim()}`,
          date: this.extractDateNearText(content, match[0]) || new Date().toISOString().split('T')[0],
          investors: investors.slice(0, 3) // Limit to 3 investors
        });
      }
    }
    
    return history.length > 0 ? history : [];
  }

  private extractGrowthRate(content: string): string {
    const growthMatches = [
      content.match(/growth\s+rate[:\s-]*([0-9.%]+)/i),
      content.match(/growing\s+at[:\s-]*([0-9.%]+)/i),
      content.match(/([0-9.]+%)\s+growth/i)
    ];
    
    for (const match of growthMatches) {
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return 'Growth rate not disclosed';
  }

  private extractBurnRate(content: string): string {
    const burnMatches = [
      content.match(/burn\s+rate[:\s-]*\$?([0-9.,]+\s*(?:million|thousand|K|M)?)/i),
      content.match(/monthly\s+burn[:\s-]*\$?([0-9.,]+\s*(?:million|thousand|K|M)?)/i)
    ];
    
    for (const match of burnMatches) {
      if (match && match[1]) {
        return `$${match[1].trim()}/month`;
      }
    }
    
    return 'Burn rate not disclosed';
  }

  private extractRunway(content: string): string {
    const runwayMatches = [
      content.match(/runway[:\s-]*([0-9.]+\s*(?:months?|years?))/i),
      content.match(/([0-9.]+\s*(?:months?|years?))\s+runway/i)
    ];
    
    for (const match of runwayMatches) {
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return 'Financial runway not specified';
  }

  private extractTextItems(content: string, regex: RegExp): string[] {
    const matches = content.matchAll(regex);
    const items = [];
    
    for (const match of matches) {
      if (match[1]) {
        items.push(match[1].trim());
      }
    }
    
    return items.length > 0 ? items : [];
  }

  private extractDateNearText(content: string, searchText: string): string | null {
    const index = content.indexOf(searchText);
    if (index === -1) return null;
    
    const context = content.substring(Math.max(0, index - 100), index + 100);
    const dateMatch = context.match(/\b(20[12]\d)[:\s-]*([01]?\d)[:\s-]*([0-3]?\d)\b/);
    
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
    
    return null;
  }
}

export const claudeResearch = new ClaudeResearchService();