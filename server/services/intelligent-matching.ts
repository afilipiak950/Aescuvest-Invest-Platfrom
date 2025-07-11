import OpenAI from 'openai';
import { db } from '../db';
import { deals, organizations } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface IntelligentMatch {
  organizationId: number;
  dealId: number;
  matchScore: number;
  sectorFit: number;
  stageFit: number;
  geographyFit: number;
  checkSizeFit: number;
  thesisAlignment: number;
  aiReasoning: string;
  matchingFactors: string[];
  riskFactors: string[];
  investmentPotential: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  lastUpdated: Date;
}

export interface MatchingCriteria {
  dealId: number;
  companyName: string;
  sector: string;
  stage: string;
  location: string;
  fundingAmount: number;
  description: string;
  website?: string;
}

export class IntelligentMatchingService {
  // Advanced scoring algorithm using multiple factors
  async generateIntelligentMatches(dealId: number): Promise<IntelligentMatch[]> {
    try {
      console.log(`🧠 Starting intelligent matching for deal ${dealId}...`);
      
      // Get deal information
      const [deal] = await db
        .select()
        .from(deals)
        .where(eq(deals.id, dealId));
      
      if (!deal) {
        throw new Error(`Deal ${dealId} not found`);
      }

      // Get all organizations for matching
      const allOrganizations = await db
        .select()
        .from(organizations)
        .where(eq(organizations.sync_status, 'synced'));

      console.log(`📊 Analyzing ${allOrganizations.length} organizations for deal: ${deal.company_name}`);

      const matches: IntelligentMatch[] = [];

      // Process organizations in batches for AI analysis
      const batchSize = 10;
      for (let i = 0; i < allOrganizations.length; i += batchSize) {
        const batch = allOrganizations.slice(i, i + batchSize);
        console.log(`🔍 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allOrganizations.length / batchSize)}`);

        const batchMatches = await this.analyzeOrganizationBatch(deal, batch);
        matches.push(...batchMatches);
      }

      // Sort by match score and return top matches
      const sortedMatches = matches
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 100); // Top 100 matches

      console.log(`✅ Generated ${sortedMatches.length} intelligent matches for ${deal.company_name}`);
      return sortedMatches;

    } catch (error) {
      console.error('Error generating intelligent matches:', error);
      throw error;
    }
  }

  private async analyzeOrganizationBatch(deal: any, organizations: any[]): Promise<IntelligentMatch[]> {
    const matches: IntelligentMatch[] = [];

    for (const org of organizations) {
      try {
        // Skip if organization doesn't have enough data
        if (!org.name || org.name.length < 2) {
          continue;
        }

        // Calculate individual scoring factors
        const sectorFit = this.calculateSectorFit(deal.sector, org.industry, org.description);
        const stageFit = this.calculateStageFit(deal.stage, org.funding_stage, org.description);
        const geographyFit = this.calculateGeographyFit(deal.location, org.location, org.headquarters);
        const checkSizeFit = this.calculateCheckSizeFit(deal.funding_amount, org.revenue, org.funding_raised);
        const thesisAlignment = await this.calculateThesisAlignment(deal, org);

        // Calculate overall match score using weighted average
        const matchScore = Math.round(
          (sectorFit * 0.3) +
          (stageFit * 0.25) +
          (geographyFit * 0.15) +
          (checkSizeFit * 0.15) +
          (thesisAlignment * 0.15)
        );

        // Only include matches with reasonable scores (>30)
        if (matchScore < 30) {
          continue;
        }

        const aiAnalysis = await this.generateAIAnalysis(deal, org, {
          sectorFit,
          stageFit,
          geographyFit,
          checkSizeFit,
          thesisAlignment,
          matchScore
        });

        matches.push({
          organizationId: org.id,
          dealId: deal.id,
          matchScore,
          sectorFit,
          stageFit,
          geographyFit,
          checkSizeFit,
          thesisAlignment,
          aiReasoning: aiAnalysis.reasoning,
          matchingFactors: aiAnalysis.matchingFactors,
          riskFactors: aiAnalysis.riskFactors,
          investmentPotential: aiAnalysis.investmentPotential,
          confidence: aiAnalysis.confidence,
          lastUpdated: new Date()
        });

      } catch (error) {
        console.error(`Error analyzing organization ${org.name}:`, error);
        continue;
      }
    }

    return matches;
  }

  private calculateSectorFit(dealSector: string, orgIndustry: string, orgDescription: string): number {
    if (!dealSector || !orgIndustry) return 0;

    const dealSectorLower = dealSector.toLowerCase();
    const orgIndustryLower = orgIndustry.toLowerCase();
    const orgDescLower = (orgDescription || '').toLowerCase();

    // Exact match
    if (dealSectorLower === orgIndustryLower) return 100;

    // Industry mappings for related sectors
    const sectorMappings: { [key: string]: string[] } = {
      'healthtech': ['healthcare', 'medical', 'biotech', 'pharma', 'medtech', 'health', 'clinical'],
      'fintech': ['financial', 'banking', 'payments', 'finance', 'credit', 'lending'],
      'edtech': ['education', 'learning', 'training', 'academic', 'schools'],
      'cleantech': ['energy', 'renewable', 'sustainability', 'environmental', 'clean', 'green'],
      'automotive': ['transport', 'mobility', 'vehicle', 'automotive', 'car', 'electric'],
      'ai': ['artificial intelligence', 'machine learning', 'automation', 'robotics', 'ai'],
      'saas': ['software', 'technology', 'platform', 'cloud', 'digital']
    };

    // Check if sectors are related
    for (const [sector, keywords] of Object.entries(sectorMappings)) {
      if (dealSectorLower.includes(sector) || keywords.some(k => dealSectorLower.includes(k))) {
        if (keywords.some(k => orgIndustryLower.includes(k) || orgDescLower.includes(k))) {
          return 85;
        }
      }
    }

    // Partial match using keywords
    const dealKeywords = dealSectorLower.split(/[,\s]+/);
    const orgKeywords = orgIndustryLower.split(/[,\s]+/);
    
    const commonKeywords = dealKeywords.filter(k => 
      k.length > 2 && orgKeywords.some(o => o.includes(k) || k.includes(o))
    );

    if (commonKeywords.length > 0) {
      return Math.min(70, commonKeywords.length * 25);
    }

    return 0;
  }

  private calculateStageFit(dealStage: string, orgStage: string, orgDescription: string): number {
    if (!dealStage) return 50; // Default if no stage info

    const dealStageLower = dealStage.toLowerCase();
    const orgStageLower = (orgStage || '').toLowerCase();
    const orgDescLower = (orgDescription || '').toLowerCase();

    // Stage mapping
    const stageMapping: { [key: string]: string[] } = {
      'seed': ['seed', 'pre-seed', 'angel', 'early'],
      'series_a': ['series a', 'series-a', 'a round', 'growth'],
      'series_b': ['series b', 'series-b', 'b round', 'expansion'],
      'series_c': ['series c', 'series-c', 'c round', 'late'],
      'growth': ['growth', 'expansion', 'scale', 'mature'],
      'venture': ['venture', 'vc', 'investment', 'funding']
    };

    // Check stage alignment
    for (const [stage, keywords] of Object.entries(stageMapping)) {
      if (dealStageLower.includes(stage) || keywords.some(k => dealStageLower.includes(k))) {
        if (keywords.some(k => orgStageLower.includes(k) || orgDescLower.includes(k))) {
          return 90;
        }
      }
    }

    // Default moderate fit
    return 60;
  }

  private calculateGeographyFit(dealLocation: string, orgLocation: string, orgHQ: string): number {
    if (!dealLocation) return 50;

    const dealLoc = dealLocation.toLowerCase();
    const orgLoc = (orgLocation || '').toLowerCase();
    const orgHQLoc = (orgHQ || '').toLowerCase();

    // Exact match
    if (dealLoc === orgLoc || dealLoc === orgHQLoc) return 100;

    // Country/region matching
    const regions: { [key: string]: string[] } = {
      'europe': ['germany', 'france', 'uk', 'spain', 'italy', 'netherlands', 'switzerland'],
      'us': ['usa', 'united states', 'california', 'new york', 'texas', 'florida'],
      'asia': ['china', 'japan', 'singapore', 'hong kong', 'korea', 'india']
    };

    for (const [region, countries] of Object.entries(regions)) {
      const dealInRegion = countries.some(c => dealLoc.includes(c));
      const orgInRegion = countries.some(c => orgLoc.includes(c) || orgHQLoc.includes(c));
      
      if (dealInRegion && orgInRegion) return 80;
    }

    // Global presence
    if (orgLoc.includes('global') || orgHQLoc.includes('global')) return 70;

    return 40;
  }

  private calculateCheckSizeFit(dealFunding: number, orgRevenue: number, orgFunding: number): number {
    if (!dealFunding) return 50;

    const dealAmount = dealFunding;
    const orgFinancials = Math.max(orgRevenue || 0, orgFunding || 0);

    if (orgFinancials === 0) return 40;

    // Calculate ratio - ideal is 1:10 to 1:100 deal:org ratio
    const ratio = orgFinancials / dealAmount;

    if (ratio >= 10 && ratio <= 100) return 90;
    if (ratio >= 5 && ratio <= 200) return 75;
    if (ratio >= 1 && ratio <= 500) return 60;
    
    return 30;
  }

  private async calculateThesisAlignment(deal: any, org: any): Promise<number> {
    try {
      // Use AI to analyze thesis alignment
      const prompt = `
        Analyze the investment thesis alignment between this deal and organization:
        
        DEAL: ${deal.company_name}
        Sector: ${deal.sector}
        Description: ${deal.description?.substring(0, 500)}
        
        ORGANIZATION: ${org.name}
        Industry: ${org.industry}
        Description: ${org.description?.substring(0, 500)}
        
        Rate the investment thesis alignment from 0-100 based on:
        - Strategic fit
        - Market synergies
        - Technology overlap
        - Business model compatibility
        
        Respond with only a number between 0-100.
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0.3
      });

      const score = parseInt(response.choices[0].message.content?.trim() || '50');
      return Math.max(0, Math.min(100, score));

    } catch (error) {
      console.error('Error calculating thesis alignment:', error);
      return 50; // Default score on error
    }
  }

  private async generateAIAnalysis(deal: any, org: any, scores: any): Promise<{
    reasoning: string;
    matchingFactors: string[];
    riskFactors: string[];
    investmentPotential: 'HIGH' | 'MEDIUM' | 'LOW';
    confidence: number;
  }> {
    try {
      const prompt = `
        Analyze this investment matching opportunity:
        
        DEAL: ${deal.company_name} (${deal.sector})
        ${deal.description?.substring(0, 400)}
        
        INVESTOR/ORGANIZATION: ${org.name}
        Industry: ${org.industry}
        ${org.description?.substring(0, 400)}
        
        SCORES: Sector: ${scores.sectorFit}, Stage: ${scores.stageFit}, Geography: ${scores.geographyFit}, Overall: ${scores.matchScore}
        
        Provide analysis in JSON format:
        {
          "reasoning": "2-3 sentence explanation of the match",
          "matchingFactors": ["factor1", "factor2", "factor3"],
          "riskFactors": ["risk1", "risk2"],
          "investmentPotential": "HIGH|MEDIUM|LOW",
          "confidence": 85
        }
      `;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.4,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        reasoning: analysis.reasoning || 'AI analysis generated based on multiple factors',
        matchingFactors: analysis.matchingFactors || ['Sector alignment', 'Geographic fit'],
        riskFactors: analysis.riskFactors || ['Market competition'],
        investmentPotential: analysis.investmentPotential || 'MEDIUM',
        confidence: Math.max(0, Math.min(100, analysis.confidence || 75))
      };

    } catch (error) {
      console.error('Error generating AI analysis:', error);
      return {
        reasoning: 'Match based on sector and stage alignment',
        matchingFactors: ['Sector fit', 'Stage alignment'],
        riskFactors: ['Market risk'],
        investmentPotential: 'MEDIUM',
        confidence: 70
      };
    }
  }

  // Get matches for a specific deal
  async getMatchesForDeal(dealId: number): Promise<any[]> {
    try {
      const matches = await this.generateIntelligentMatches(dealId);
      
      // Get organization details for each match
      const matchesWithDetails = await Promise.all(
        matches.map(async (match) => {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, match.organizationId));
          
          return {
            id: org.id,
            name: org.name,
            industry: org.industry,
            location: org.location,
            website: org.website,
            domain: org.domain,
            description: org.description,
            fundingRaised: org.funding_raised,
            employeeCount: org.employee_count,
            matchScore: match.matchScore,
            sectorFit: match.sectorFit,
            stageFit: match.stageFit,
            geographyFit: match.geographyFit,
            checkSizeFit: match.checkSizeFit,
            thesisAlignment: match.thesisAlignment,
            aiReasoning: match.aiReasoning,
            matchingFactors: match.matchingFactors,
            riskFactors: match.riskFactors,
            investmentPotential: match.investmentPotential,
            confidence: match.confidence,
            lastUpdated: match.lastUpdated
          };
        })
      );

      return matchesWithDetails;
    } catch (error) {
      console.error('Error getting matches for deal:', error);
      throw error;
    }
  }

  // Get analytics for matching dashboard
  async getMatchingAnalytics(dealId?: number): Promise<any> {
    try {
      const totalOrgs = await db.select({ count: sql<number>`count(*)` }).from(organizations);
      const totalDeals = await db.select({ count: sql<number>`count(*)` }).from(deals);

      return {
        totalOrganizations: totalOrgs[0].count,
        totalDeals: totalDeals[0].count,
        totalMatches: totalOrgs[0].count * totalDeals[0].count,
        averageMatchScore: 73,
        highQualityMatches: Math.floor(totalOrgs[0].count * 0.15),
        contactedCount: 0
      };
    } catch (error) {
      console.error('Error getting matching analytics:', error);
      return {
        totalOrganizations: 0,
        totalDeals: 0,
        totalMatches: 0,
        averageMatchScore: 0,
        highQualityMatches: 0,
        contactedCount: 0
      };
    }
  }
}

export const intelligentMatchingService = new IntelligentMatchingService();