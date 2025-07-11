import OpenAI from 'openai';
import { db } from '../db';
import { organizations, dealOrganizationMatches, deals, dailySyncJobs } from '@shared/schema';
import { eq, desc, and, like, gt, lt, isNull, or } from 'drizzle-orm';
import { AffinityService } from './affinity-service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface MatchingCriteria {
  industry?: string;
  fundingStage?: string;
  location?: string;
  minRevenue?: number;
  maxRevenue?: number;
  employeeCount?: number;
  targetMarket?: string;
  businessModel?: string;
  technologyStack?: string[];
  keywords?: string[];
}

interface MatchingResult {
  organizationId: number;
  dealId: number;
  matchScore: number;
  matchReasons: string[];
  matchDetails: {
    industryMatch: boolean;
    sizeMatch: boolean;
    stageMatch: boolean;
    geoMatch: boolean;
    technologyMatch: boolean;
    businessModelMatch: boolean;
    competitorAnalysis: any;
    marketAnalysis: any;
  };
  probabilityScore: number;
  aiGeneratedPitch: string;
  expectedInvestment: number;
}

export class MatchingIntelligenceService {
  private affinityService: AffinityService;

  constructor(affinityApiKey: string) {
    this.affinityService = new AffinityService({
      apiKey: affinityApiKey,
      baseUrl: 'https://api.affinity.co',
      version: 'v2'
    });
  }

  // Daily sync job to retrieve all 8,000+ organizations from Affinity
  async syncAllOrganizations(): Promise<{ success: boolean; organizations: number; newOrganizations: number; errors: string[] }> {
    console.log('🔄 Starting daily organization sync from Affinity...');
    
    const syncJob = await db.insert(dailySyncJobs).values({
      jobType: 'affinity_organizations',
      status: 'running',
      startedAt: new Date()
    }).returning();

    const jobId = syncJob[0].id;
    let totalOrganizations = 0;
    let newOrganizations = 0;
    const errors: string[] = [];

    try {
      let cursor: string | undefined;
      let processedCount = 0;

      do {
        console.log(`📊 Fetching organizations batch (processed: ${processedCount})`);
        
        const response = await this.affinityService.getOrganizations({
          cursor,
          limit: 100,
          with_interaction_dates: true
        });

        if (response.organizations.length === 0) {
          console.log('✅ No more organizations to process');
          break;
        }

        for (const org of response.organizations) {
          try {
            // Check if organization already exists
            const existingOrg = await db.query.organizations.findFirst({
              where: eq(organizations.affinityId, org.id)
            });

            const organizationData = {
              affinityId: org.id,
              name: org.name,
              domain: org.domain,
              domains: org.domains || [],
              type: org.type,
              isGlobal: org.global,
              website: org.domain ? `https://${org.domain}` : null,
              affinityData: {
                listEntries: org.list_entries,
                fieldValues: org.field_values || {},
                interactionDates: org.interaction_dates,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              lastSyncAt: new Date(),
              syncStatus: 'synced' as const
            };

            if (existingOrg) {
              // Update existing organization
              await db.update(organizations)
                .set({
                  ...organizationData,
                  updatedAt: new Date()
                })
                .where(eq(organizations.id, existingOrg.id));
            } else {
              // Create new organization
              await db.insert(organizations).values(organizationData);
              newOrganizations++;
            }

            totalOrganizations++;
            processedCount++;

            // Update job progress
            if (processedCount % 50 === 0) {
              await db.update(dailySyncJobs)
                .set({
                  processedItems: processedCount,
                  progress: Math.min(90, Math.floor((processedCount / 8000) * 100))
                })
                .where(eq(dailySyncJobs.id, jobId));
            }

          } catch (error) {
            console.error(`❌ Error processing organization ${org.name}:`, error);
            errors.push(`Error processing ${org.name}: ${error}`);
          }
        }

        cursor = response.next_cursor;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } while (cursor);

      // Complete the sync job
      await db.update(dailySyncJobs)
        .set({
          status: 'completed',
          progress: 100,
          processedItems: totalOrganizations,
          newItems: newOrganizations,
          errors: errors,
          result: {
            organizations: totalOrganizations,
            duration: Date.now() - syncJob[0].startedAt!.getTime(),
            stats: {
              newOrganizations,
              updatedOrganizations: totalOrganizations - newOrganizations,
              errors: errors.length
            }
          },
          completedAt: new Date()
        })
        .where(eq(dailySyncJobs.id, jobId));

      console.log(`✅ Organization sync completed: ${totalOrganizations} total, ${newOrganizations} new`);
      
      return {
        success: true,
        organizations: totalOrganizations,
        newOrganizations,
        errors
      };

    } catch (error) {
      console.error('❌ Organization sync failed:', error);
      
      await db.update(dailySyncJobs)
        .set({
          status: 'failed',
          errors: [...errors, `Sync failed: ${error}`],
          completedAt: new Date()
        })
        .where(eq(dailySyncJobs.id, jobId));

      return {
        success: false,
        organizations: totalOrganizations,
        newOrganizations,
        errors: [...errors, `Sync failed: ${error}`]
      };
    }
  }

  // AI-powered matching intelligence
  async generateIntelligentMatches(dealId: number): Promise<MatchingResult[]> {
    console.log(`🤖 Generating intelligent matches for deal ${dealId}...`);

    // Get deal details
    const deal = await db.query.deals.findFirst({
      where: eq(deals.id, dealId)
    });

    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Get all organizations
    const allOrganizations = await db.query.organizations.findMany({
      where: eq(organizations.syncStatus, 'synced'),
      limit: 1000 // Process top 1000 organizations
    });

    console.log(`📊 Analyzing ${allOrganizations.length} organizations for deal matching...`);

    // Use OpenAI to analyze deal and generate matching criteria
    const dealAnalysis = await this.analyzeDealWithAI(deal);
    
    const matchingResults: MatchingResult[] = [];

    for (const org of allOrganizations) {
      try {
        // Calculate match score using AI
        const matchResult = await this.calculateMatchScore(deal, org, dealAnalysis);
        
        if (matchResult.matchScore >= 60) { // Only include matches with 60%+ score
          matchingResults.push(matchResult);
        }
      } catch (error) {
        console.error(`❌ Error matching organization ${org.name}:`, error);
      }
    }

    // Sort by match score and probability
    matchingResults.sort((a, b) => (b.matchScore * b.probabilityScore) - (a.matchScore * a.probabilityScore));

    // Take top 50 matches
    const topMatches = matchingResults.slice(0, 50);

    // Save matches to database
    for (const match of topMatches) {
      await db.insert(dealOrganizationMatches).values({
        dealId: match.dealId,
        organizationId: match.organizationId,
        matchScore: match.matchScore,
        matchReasons: match.matchReasons,
        matchDetails: match.matchDetails,
        probabilityScore: match.probabilityScore,
        aiGeneratedPitch: match.aiGeneratedPitch,
        expectedInvestment: match.expectedInvestment
      }).onConflictDoUpdate({
        target: [dealOrganizationMatches.dealId, dealOrganizationMatches.organizationId],
        set: {
          matchScore: match.matchScore,
          matchReasons: match.matchReasons,
          matchDetails: match.matchDetails,
          probabilityScore: match.probabilityScore,
          aiGeneratedPitch: match.aiGeneratedPitch,
          expectedInvestment: match.expectedInvestment,
          updatedAt: new Date()
        }
      });
    }

    console.log(`✅ Generated ${topMatches.length} intelligent matches for deal ${dealId}`);
    return topMatches;
  }

  // AI analysis of deal for matching criteria
  private async analyzeDealWithAI(deal: any): Promise<MatchingCriteria> {
    const prompt = `
Analyze this investment deal and extract key matching criteria for finding relevant organizations:

Deal Information:
- Company: ${deal.companyName}
- Description: ${deal.description}
- Stage: ${deal.stage}
- Valuation: ${deal.valuation}
- Funding Amount: ${deal.fundingAmount}
- Industry: ${deal.industry}
- Business Model: ${deal.businessModel}
- Target Market: ${deal.targetMarket}

Extract and return JSON with matching criteria:
{
  "industry": "specific industry sector",
  "fundingStage": "seed/series-a/series-b/growth/etc",
  "location": "preferred geographic region",
  "minRevenue": number,
  "maxRevenue": number,
  "employeeCount": number,
  "targetMarket": "B2B/B2C/marketplace/etc",
  "businessModel": "SaaS/marketplace/hardware/etc",
  "technologyStack": ["tech1", "tech2"],
  "keywords": ["keyword1", "keyword2"]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  // Calculate AI-powered match score
  private async calculateMatchScore(deal: any, organization: any, dealCriteria: MatchingCriteria): Promise<MatchingResult> {
    const prompt = `
Analyze this investment deal and organization for matching potential:

DEAL:
- Company: ${deal.companyName}
- Industry: ${deal.industry}
- Stage: ${deal.stage}
- Valuation: ${deal.valuation}
- Target Market: ${deal.targetMarket}
- Business Model: ${deal.businessModel}

ORGANIZATION:
- Name: ${organization.name}
- Domain: ${organization.domain}
- Industry: ${organization.industry}
- Description: ${organization.description}
- Business Model: ${organization.businessModel}
- Employee Count: ${organization.employeeCount}
- Location: ${organization.location}

ANALYSIS CRITERIA:
${JSON.stringify(dealCriteria, null, 2)}

Calculate match score (0-100) and provide detailed analysis:
{
  "matchScore": number,
  "matchReasons": ["reason1", "reason2"],
  "matchDetails": {
    "industryMatch": boolean,
    "sizeMatch": boolean,
    "stageMatch": boolean,
    "geoMatch": boolean,
    "technologyMatch": boolean,
    "businessModelMatch": boolean,
    "competitorAnalysis": "analysis text",
    "marketAnalysis": "analysis text"
  },
  "probabilityScore": number,
  "aiGeneratedPitch": "personalized pitch text",
  "expectedInvestment": number
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      organizationId: organization.id,
      dealId: deal.id,
      matchScore: analysis.matchScore || 0,
      matchReasons: analysis.matchReasons || [],
      matchDetails: analysis.matchDetails || {},
      probabilityScore: analysis.probabilityScore || 0,
      aiGeneratedPitch: analysis.aiGeneratedPitch || '',
      expectedInvestment: analysis.expectedInvestment || 0
    };
  }

  // Get intelligent matches for a deal
  async getIntelligentMatches(dealId: number): Promise<any[]> {
    const matches = await db
      .select({
        organization: organizations,
        match: dealOrganizationMatches
      })
      .from(dealOrganizationMatches)
      .innerJoin(organizations, eq(dealOrganizationMatches.organizationId, organizations.id))
      .where(eq(dealOrganizationMatches.dealId, dealId))
      .orderBy(desc(dealOrganizationMatches.matchScore));

    return matches.map(({ organization, match }) => ({
      ...organization,
      matchScore: match.matchScore,
      matchReasons: match.matchReasons,
      matchDetails: match.matchDetails,
      probabilityScore: match.probabilityScore,
      aiGeneratedPitch: match.aiGeneratedPitch,
      expectedInvestment: match.expectedInvestment,
      status: match.status
    }));
  }

  // Schedule daily automated sync
  async scheduleDailySync(): Promise<void> {
    console.log('⏰ Scheduling daily organization sync...');
    
    // Create a scheduled job for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // 2 AM daily

    await db.insert(dailySyncJobs).values({
      jobType: 'affinity_organizations',
      status: 'pending',
      scheduledFor: tomorrow
    });

    console.log(`✅ Daily sync scheduled for ${tomorrow.toISOString()}`);
  }
}

// Export singleton instance
export const matchingIntelligenceService = new MatchingIntelligenceService(
  process.env.AFFINITY_API_KEY || ''
);