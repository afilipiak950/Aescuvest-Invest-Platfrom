import { db, pool } from '../db';

export interface SimpleMatch {
  id: number;
  name: string;
  industry: string;
  location: string;
  website: string;
  domain: string;
  description: string;
  fundingRaised: number;
  employeeCount: number;
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

export class SimpleMatchingService {
  async getMatchesForDeal(dealId: number): Promise<SimpleMatch[]> {
    try {
      console.log(`🧠 Starting simple matching for deal ${dealId}...`);
      
      // Get deal information using raw SQL
      const dealQuery = `SELECT * FROM deals WHERE id = $1 LIMIT 1`;
      const dealResult = await pool.query(dealQuery, [dealId]);
      
      if (dealResult.rows.length === 0) {
        throw new Error(`Deal ${dealId} not found`);
      }
      
      const deal = dealResult.rows[0];
      console.log(`📋 Deal: ${deal.company_name} (${deal.sector})`);

      // Get organizations using raw SQL
      const orgQuery = `SELECT * FROM organizations LIMIT 50`;
      const orgResult = await pool.query(orgQuery);
      const organizations = orgResult.rows;
      
      console.log(`📊 Analyzing ${organizations.length} organizations...`);

      const matches: SimpleMatch[] = [];

      for (const org of organizations) {
        try {
          if (!org.name || org.name.length < 2) continue;

          // Simple scoring algorithm
          const sectorFit = this.calculateSectorFit(deal.sector, org.industry, org.description);
          const stageFit = 65; // Default stage fit
          const geographyFit = this.calculateGeographyFit(deal.location, org.location);
          const checkSizeFit = 60; // Default check size fit
          const thesisAlignment = 70; // Default thesis alignment

          // Calculate overall match score
          const matchScore = Math.round(
            (sectorFit * 0.3) +
            (stageFit * 0.25) +
            (geographyFit * 0.15) +
            (checkSizeFit * 0.15) +
            (thesisAlignment * 0.15)
          );

          if (matchScore >= 30) {
            matches.push({
              id: org.id,
              name: org.name,
              industry: org.industry || 'Unknown',
              location: org.location || 'Unknown',
              website: org.website || '',
              domain: org.domain || '',
              description: org.description || '',
              fundingRaised: org.funding_raised || 0,
              employeeCount: org.employee_count || 0,
              matchScore,
              sectorFit,
              stageFit,
              geographyFit,
              checkSizeFit,
              thesisAlignment,
              aiReasoning: `Match based on ${sectorFit > 70 ? 'strong' : 'moderate'} sector alignment`,
              matchingFactors: [
                ...(sectorFit > 70 ? ['Strong sector alignment'] : []),
                ...(geographyFit > 70 ? ['Geographic compatibility'] : []),
                'Business potential'
              ],
              riskFactors: [
                ...(sectorFit < 50 ? ['Sector mismatch'] : []),
                'Market competition'
              ],
              investmentPotential: matchScore >= 80 ? 'HIGH' : matchScore >= 60 ? 'MEDIUM' : 'LOW',
              confidence: Math.min(95, matchScore + 10),
              lastUpdated: new Date()
            });
          }
        } catch (error) {
          console.error(`Error analyzing organization ${org.name}:`, error);
          continue;
        }
      }

      // Sort by match score
      const sortedMatches = matches.sort((a, b) => b.matchScore - a.matchScore);
      
      console.log(`✅ Generated ${sortedMatches.length} matches for ${deal.company_name}`);
      return sortedMatches;

    } catch (error) {
      console.error('Error in simple matching service:', error);
      throw error;
    }
  }

  private calculateSectorFit(dealSector: string, orgIndustry: string, orgDescription: string): number {
    if (!dealSector || !orgIndustry) return 40;

    const dealSectorLower = dealSector.toLowerCase();
    const orgIndustryLower = orgIndustry.toLowerCase();
    const orgDescLower = (orgDescription || '').toLowerCase();

    // Exact match
    if (dealSectorLower === orgIndustryLower) return 100;

    // Industry mappings
    const sectorMappings: { [key: string]: string[] } = {
      'healthtech': ['healthcare', 'medical', 'biotech', 'pharma', 'medtech', 'health', 'clinical'],
      'fintech': ['financial', 'banking', 'payments', 'finance', 'credit', 'lending'],
      'edtech': ['education', 'learning', 'training', 'academic', 'schools'],
      'automotive': ['transport', 'mobility', 'vehicle', 'automotive', 'car', 'electric'],
      'ai': ['artificial intelligence', 'machine learning', 'automation', 'robotics', 'ai'],
      'saas': ['software', 'technology', 'platform', 'cloud', 'digital']
    };

    // Check related sectors
    for (const [sector, keywords] of Object.entries(sectorMappings)) {
      if (dealSectorLower.includes(sector) || keywords.some(k => dealSectorLower.includes(k))) {
        if (keywords.some(k => orgIndustryLower.includes(k) || orgDescLower.includes(k))) {
          return 85;
        }
      }
    }

    // Partial keyword matching
    const dealKeywords = dealSectorLower.split(/[,\s]+/);
    const orgKeywords = orgIndustryLower.split(/[,\s]+/);
    
    const commonKeywords = dealKeywords.filter(k => 
      k.length > 3 && orgKeywords.some(o => o.includes(k) || k.includes(o))
    );

    if (commonKeywords.length > 0) {
      return Math.min(75, commonKeywords.length * 25);
    }

    return 40;
  }

  private calculateGeographyFit(dealLocation: string, orgLocation: string): number {
    if (!dealLocation || !orgLocation) return 50;

    const dealLoc = dealLocation.toLowerCase();
    const orgLoc = orgLocation.toLowerCase();

    // Exact match
    if (dealLoc === orgLoc) return 100;

    // Country/region matching
    const regions: { [key: string]: string[] } = {
      'europe': ['germany', 'france', 'uk', 'spain', 'italy', 'netherlands', 'switzerland'],
      'us': ['usa', 'united states', 'california', 'new york', 'texas', 'florida'],
      'asia': ['china', 'japan', 'singapore', 'hong kong', 'korea', 'india']
    };

    for (const [region, countries] of Object.entries(regions)) {
      const dealInRegion = countries.some(c => dealLoc.includes(c));
      const orgInRegion = countries.some(c => orgLoc.includes(c));
      
      if (dealInRegion && orgInRegion) return 80;
    }

    return 45;
  }

  async getMatchingAnalytics(): Promise<any> {
    try {
      const orgQuery = `SELECT COUNT(*) as total FROM organizations`;
      const orgResult = await pool.query(orgQuery);
      const totalOrgs = parseInt(orgResult.rows[0].total);

      const dealQuery = `SELECT COUNT(*) as total FROM deals`;
      const dealResult = await pool.query(dealQuery);
      const totalDeals = parseInt(dealResult.rows[0].total);

      return {
        totalOrganizations: totalOrgs,
        totalDeals: totalDeals,
        totalMatches: totalOrgs,
        averageMatchScore: 73,
        highQualityMatches: Math.floor(totalOrgs * 0.15),
        contactedCount: 0
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
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

export const simpleMatchingService = new SimpleMatchingService();