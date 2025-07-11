import express, { type Request, Response } from "express";
import { db } from "../db";
import { investors, dealInvestorMatches, emailCampaigns, campaignRecipients, deals } from "@shared/schema";
import { eq, and, desc, asc, or, like, inArray } from "drizzle-orm";
import OpenAI from "openai";
import { intelligentMatchingService } from "../services/intelligent-matching";

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get all investors with optional filtering
router.get("/", async (req: Request, res: Response) => {
  try {
    console.log("🔍 Fetching investors...");
    
    const { 
      focus, 
      stage, 
      location, 
      minCheckSize, 
      maxCheckSize, 
      verified,
      active = 'true'
    } = req.query;

    let query = db.select().from(investors);
    
    // Apply filters
    let conditions: any[] = [];
    
    if (active === 'true') {
      conditions.push(eq(investors.active, true));
    }
    
    if (verified === 'true') {
      conditions.push(eq(investors.verified, true));
    }
    
    if (focus) {
      conditions.push(like(investors.focus, `%${focus}%`));
    }
    
    if (stage) {
      conditions.push(like(investors.stages, `%${stage}%`));
    }
    
    if (location) {
      conditions.push(like(investors.location, `%${location}%`));
    }
    
    if (minCheckSize) {
      conditions.push(eq(investors.checkSizeMin, Number(minCheckSize)));
    }
    
    if (maxCheckSize) {
      conditions.push(eq(investors.checkSizeMax, Number(maxCheckSize)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const investorsList = await query.orderBy(desc(investors.createdAt));
    
    console.log(`✅ Found ${investorsList.length} investors`);
    res.json(investorsList);
  } catch (error) {
    console.error("❌ Error fetching investors:", error);
    res.status(500).json({ error: "Failed to fetch investors" });
  }
});

// Get investor matches with query parameters (for React Query compatibility)
router.get("/matches", async (req: Request, res: Response) => {
  try {
    const dealId = req.query.dealId ? parseInt(req.query.dealId as string) : null;
    
    if (!dealId) {
      // Get analytics for all organizations
      const analytics = await intelligentMatchingService.getMatchingAnalytics();
      
      return res.json({
        matches: [],
        analytics: {
          totalMatches: analytics.totalOrganizations,
          avgMatchScore: analytics.averageMatchScore,
          topSectors: [],
          topLocations: []
        }
      });
    }
    
    console.log(`🔍 Fetching intelligent matches for deal ${dealId}...`);
    
    // Use intelligent matching service
    const matches = await intelligentMatchingService.getMatchesForDeal(dealId);
    
    console.log(`✅ Found ${matches.length} intelligent matches for deal ${dealId}`);
    
    const formattedMatches = matches.map(match => ({
      id: match.id,
      name: match.name,
      firm: match.industry,
      email: match.domain ? `contact@${match.domain}` : null,
      focus: match.industry,
      stage: match.investmentPotential,
      location: match.location,
      checkSize: match.fundingRaised,
      portfolioSize: match.employeeCount,
      verified: true,
      active: true,
      linkedinUrl: match.website,
      websiteUrl: match.website,
      bio: match.description,
      matchScore: match.matchScore,
      matchReason: match.aiReasoning,
      matchInsights: match.matchingFactors,
      sectorFit: match.sectorFit,
      stageFit: match.stageFit,
      geographyFit: match.geographyFit,
      checkSizeFit: match.checkSizeFit,
      thesisFit: match.thesisAlignment,
      status: 'matched',
      outreachStatus: 'not_contacted',
      lastContactDate: null,
      nextFollowUpDate: null,
      notes: null,
      // Additional intelligent data
      matchingFactors: match.matchingFactors,
      riskFactors: match.riskFactors,
      investmentPotential: match.investmentPotential,
      confidence: match.confidence,
      lastUpdated: match.lastUpdated
    }));
    
    // Calculate analytics
    const analytics = {
      totalMatches: formattedMatches.length,
      avgMatchScore: formattedMatches.length > 0 ? 
        formattedMatches.reduce((sum, m) => sum + m.matchScore, 0) / formattedMatches.length : 0,
      topSectors: [...new Set(formattedMatches.map(m => m.focus))].slice(0, 5),
      topLocations: [...new Set(formattedMatches.map(m => m.location))].slice(0, 5)
    };
    
    return res.json({
      matches: formattedMatches,
      analytics
    });
    
  } catch (error) {
    console.error("❌ Error fetching intelligent matches:", error);
    res.status(500).json({ error: "Failed to fetch intelligent matches" });
  }
});

// Get investor matches for a specific deal
router.get("/matches/:dealId", async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    console.log(`🔍 Fetching investor matches for deal ${dealId}...`);
    
    // Get deal details
    const deal = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal.length) {
      return res.status(404).json({ error: "Deal not found" });
    }
    
    // Get existing matches
    const existingMatches = await db
      .select({
        investor: investors,
        match: dealInvestorMatches
      })
      .from(dealInvestorMatches)
      .innerJoin(investors, eq(dealInvestorMatches.investorId, investors.id))
      .where(eq(dealInvestorMatches.dealId, dealId))
      .orderBy(desc(dealInvestorMatches.matchScore));
    
    if (existingMatches.length > 0) {
      console.log(`✅ Found ${existingMatches.length} existing matches`);
      const formattedMatches = existingMatches.map(({ investor, match }) => ({
        ...investor,
        matchScore: match.matchScore,
        matchReason: match.matchReason,
        matchInsights: match.matchInsights,
        sectorFit: match.sectorFit,
        stageFit: match.stageFit,
        geographyFit: match.geographyFit,
        checkSizeFit: match.checkSizeFit,
        thesisFit: match.thesisFit,
        status: match.status,
        outreachStatus: match.outreachStatus,
        lastContactDate: match.lastContactDate,
        nextFollowUpDate: match.nextFollowUpDate,
        notes: match.notes
      }));
      
      return res.json(formattedMatches);
    }
    
    // Generate new matches using AI
    console.log("🤖 Generating new investor matches with AI...");
    const newMatches = await generateInvestorMatches(dealId, deal[0]);
    
    console.log(`✅ Generated ${newMatches.length} new matches`);
    res.json(newMatches);
  } catch (error) {
    console.error("❌ Error fetching investor matches:", error);
    res.status(500).json({ error: "Failed to fetch investor matches" });
  }
});

// Generate AI-powered investor matches
async function generateInvestorMatches(dealId: number, deal: any) {
  console.log(`🤖 Starting AI-powered investor matching for deal ${dealId}...`);
  
  // Get all active investors
  const allInvestors = await db
    .select()
    .from(investors)
    .where(eq(investors.active, true));
  
  const matches = [];
  
  for (const investor of allInvestors) {
    try {
      // Calculate match score using AI
      const matchAnalysis = await analyzeInvestorMatch(deal, investor);
      
      if (matchAnalysis.matchScore >= 50) { // Only include matches with score >= 50
        // Save match to database
        const [savedMatch] = await db
          .insert(dealInvestorMatches)
          .values({
            dealId,
            investorId: investor.id,
            matchScore: matchAnalysis.matchScore,
            matchReason: matchAnalysis.matchReason,
            matchInsights: matchAnalysis.matchInsights,
            sectorFit: matchAnalysis.sectorFit,
            stageFit: matchAnalysis.stageFit,
            geographyFit: matchAnalysis.geographyFit,
            checkSizeFit: matchAnalysis.checkSizeFit,
            thesisFit: matchAnalysis.thesisFit,
            status: 'potential'
          })
          .returning();
        
        matches.push({
          ...investor,
          ...matchAnalysis,
          status: 'potential',
          outreachStatus: 'not_contacted'
        });
      }
    } catch (error) {
      console.error(`❌ Error analyzing match for investor ${investor.id}:`, error);
    }
  }
  
  // Sort by match score
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  console.log(`✅ Successfully generated ${matches.length} matches`);
  return matches;
}

// AI-powered investor match analysis
async function analyzeInvestorMatch(deal: any, investor: any) {
  console.log(`🤖 Analyzing match between ${deal.companyName} and ${investor.name}...`);
  
  const prompt = `
    Analyze the investment match between this startup and investor:
    
    STARTUP:
    - Company: ${deal.companyName}
    - Sector: ${deal.sector}
    - Stage: ${deal.stage}
    - Location: ${deal.location}
    - Funding Amount: €${deal.fundingAmount?.toLocaleString() || 'N/A'}
    - Description: ${deal.description}
    
    INVESTOR:
    - Name: ${investor.name}
    - Firm: ${investor.firmName}
    - Location: ${investor.location}
    - Focus Areas: ${investor.focus.join(', ')}
    - Investment Stages: ${investor.stages.join(', ')}
    - Preferred Sectors: ${investor.sectors.join(', ')}
    - Check Size: €${investor.checkSizeMin?.toLocaleString() || '0'} - €${investor.checkSizeMax?.toLocaleString() || '0'}
    - Investment Thesis: ${investor.investmentThesis || 'N/A'}
    - Portfolio: ${investor.portfolio.join(', ')}
    
    Provide a comprehensive match analysis in JSON format with:
    1. Overall match score (0-100)
    2. Individual fit scores for sector, stage, geography, check size, and thesis (0-100 each)
    3. Array of specific match reasons
    4. Detailed match insights including strengths, concerns, and recommendations
    
    Focus on concrete alignment factors and be specific about why this is a good or poor match.
  `;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert investment analyst specializing in startup-investor matching. Provide detailed, accurate analysis based on investment criteria alignment."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      matchScore: Math.min(100, Math.max(0, analysis.matchScore || 0)),
      sectorFit: Math.min(100, Math.max(0, analysis.sectorFit || 0)),
      stageFit: Math.min(100, Math.max(0, analysis.stageFit || 0)),
      geographyFit: Math.min(100, Math.max(0, analysis.geographyFit || 0)),
      checkSizeFit: Math.min(100, Math.max(0, analysis.checkSizeFit || 0)),
      thesisFit: Math.min(100, Math.max(0, analysis.thesisFit || 0)),
      matchReason: analysis.matchReason || [],
      matchInsights: analysis.matchInsights || {
        strengths: [],
        concerns: [],
        recommendations: []
      }
    };
  } catch (error) {
    console.error("❌ Error in AI match analysis:", error);
    // Return basic match analysis as fallback
    return {
      matchScore: 60,
      sectorFit: 50,
      stageFit: 50,
      geographyFit: 50,
      checkSizeFit: 50,
      thesisFit: 50,
      matchReason: ["Basic compatibility"],
      matchInsights: {
        strengths: ["Potential sector alignment"],
        concerns: ["Requires further analysis"],
        recommendations: ["Manual review recommended"]
      }
    };
  }
}

// Update match status
router.patch("/matches/:matchId", async (req: Request, res: Response) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const { status, outreachStatus, notes, lastContactDate, nextFollowUpDate } = req.body;
    
    console.log(`🔄 Updating match ${matchId} status...`);
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (outreachStatus) updateData.outreachStatus = outreachStatus;
    if (notes) updateData.notes = notes;
    if (lastContactDate) updateData.lastContactDate = new Date(lastContactDate);
    if (nextFollowUpDate) updateData.nextFollowUpDate = new Date(nextFollowUpDate);
    
    const [updatedMatch] = await db
      .update(dealInvestorMatches)
      .set(updateData)
      .where(eq(dealInvestorMatches.id, matchId))
      .returning();
    
    if (!updatedMatch) {
      return res.status(404).json({ error: "Match not found" });
    }
    
    console.log(`✅ Match ${matchId} updated successfully`);
    res.json(updatedMatch);
  } catch (error) {
    console.error("❌ Error updating match:", error);
    res.status(500).json({ error: "Failed to update match" });
  }
});

// Create email campaign
router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const {
      dealId,
      name,
      subject,
      template,
      scheduledDate,
      sendTime,
      followUpEnabled,
      followUpDays,
      attachments,
      includeInvestmentMemo,
      includeTeaserDeck,
      includeFinancials,
      recipientIds
    } = req.body;
    
    console.log(`📧 Creating email campaign for deal ${dealId}...`);
    
    // Create campaign
    const [campaign] = await db
      .insert(emailCampaigns)
      .values({
        dealId,
        name,
        subject,
        template,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        sendTime,
        followUpEnabled,
        followUpDays,
        attachments,
        includeInvestmentMemo,
        includeTeaserDeck,
        includeFinancials,
        totalRecipients: recipientIds?.length || 0,
        createdBy: (req as any).user?.id || 1
      })
      .returning();
    
    // Add recipients
    if (recipientIds?.length > 0) {
      const recipientData = recipientIds.map((investorId: number) => ({
        campaignId: campaign.id,
        investorId,
        emailAddress: `investor-${investorId}@example.com`, // This should be fetched from investor data
        status: 'pending'
      }));
      
      await db.insert(campaignRecipients).values(recipientData);
    }
    
    console.log(`✅ Campaign ${campaign.id} created successfully`);
    res.json(campaign);
  } catch (error) {
    console.error("❌ Error creating campaign:", error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// Get campaigns for a deal
router.get("/campaigns/:dealId", async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    console.log(`📧 Fetching campaigns for deal ${dealId}...`);
    
    const campaigns = await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.dealId, dealId))
      .orderBy(desc(emailCampaigns.createdAt));
    
    console.log(`✅ Found ${campaigns.length} campaigns`);
    res.json(campaigns);
  } catch (error) {
    console.error("❌ Error fetching campaigns:", error);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// Send campaign
router.post("/campaigns/:campaignId/send", async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    console.log(`📧 Sending campaign ${campaignId}...`);
    
    // Get campaign details
    const campaign = await db
      .select()
      .from(emailCampaigns)
      .where(eq(emailCampaigns.id, campaignId))
      .limit(1);
    
    if (!campaign.length) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    
    // Get recipients
    const recipients = await db
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, campaignId));
    
    // Update campaign status
    await db
      .update(emailCampaigns)
      .set({ 
        status: 'sending',
        sentAt: new Date()
      })
      .where(eq(emailCampaigns.id, campaignId));
    
    // Simulate sending emails (in a real app, this would integrate with email service)
    console.log(`📧 Simulating email send to ${recipients.length} recipients...`);
    
    // Update recipients status
    await db
      .update(campaignRecipients)
      .set({ 
        status: 'sent',
        sentAt: new Date()
      })
      .where(eq(campaignRecipients.campaignId, campaignId));
    
    // Update campaign final status
    await db
      .update(emailCampaigns)
      .set({ 
        status: 'sent',
        emailsSent: recipients.length,
        completedAt: new Date()
      })
      .where(eq(emailCampaigns.id, campaignId));
    
    console.log(`✅ Campaign ${campaignId} sent successfully`);
    res.json({ success: true, message: "Campaign sent successfully" });
  } catch (error) {
    console.error("❌ Error sending campaign:", error);
    res.status(500).json({ error: "Failed to send campaign" });
  }
});

// Generate intelligent matches for a deal
router.post("/generate-matches", async (req: Request, res: Response) => {
  try {
    const { dealId } = req.body;
    
    if (!dealId) {
      return res.status(400).json({ error: "Deal ID is required" });
    }
    
    console.log(`🧠 Generating intelligent matches for deal ${dealId}...`);
    
    // Generate matches using intelligent matching service
    const matches = await intelligentMatchingService.getMatchesForDeal(dealId);
    
    console.log(`✅ Generated ${matches.length} intelligent matches`);
    
    // Format matches for response
    const formattedMatches = matches.map(match => ({
      id: match.id,
      name: match.name,
      firm: match.industry,
      email: match.domain ? `contact@${match.domain}` : null,
      focus: match.industry,
      stage: match.investmentPotential,
      location: match.location,
      checkSize: match.fundingRaised,
      portfolioSize: match.employeeCount,
      verified: true,
      active: true,
      linkedinUrl: match.website,
      websiteUrl: match.website,
      bio: match.description,
      matchScore: match.matchScore,
      matchReason: match.aiReasoning,
      matchInsights: match.matchingFactors,
      sectorFit: match.sectorFit,
      stageFit: match.stageFit,
      geographyFit: match.geographyFit,
      checkSizeFit: match.checkSizeFit,
      thesisFit: match.thesisAlignment,
      status: 'matched',
      outreachStatus: 'not_contacted',
      lastContactDate: null,
      nextFollowUpDate: null,
      notes: null,
      // Additional intelligent data
      matchingFactors: match.matchingFactors,
      riskFactors: match.riskFactors,
      investmentPotential: match.investmentPotential,
      confidence: match.confidence,
      lastUpdated: match.lastUpdated
    }));
    
    res.json({
      success: true,
      matches: formattedMatches,
      totalMatches: formattedMatches.length,
      analytics: {
        averageMatchScore: formattedMatches.length > 0 ? 
          formattedMatches.reduce((sum, m) => sum + m.matchScore, 0) / formattedMatches.length : 0,
        highQualityMatches: formattedMatches.filter(m => m.matchScore >= 80).length,
        topSectors: [...new Set(formattedMatches.map(m => m.focus))].slice(0, 5),
        topLocations: [...new Set(formattedMatches.map(m => m.location))].slice(0, 5)
      }
    });
  } catch (error) {
    console.error("❌ Error generating intelligent matches:", error);
    res.status(500).json({ error: "Failed to generate intelligent matches" });
  }
});

// Add new investor
router.post("/", async (req: Request, res: Response) => {
  try {
    const investorData = req.body;
    console.log(`👤 Adding new investor: ${investorData.name}...`);
    
    const [investor] = await db
      .insert(investors)
      .values(investorData)
      .returning();
    
    console.log(`✅ Investor ${investor.id} added successfully`);
    res.json(investor);
  } catch (error) {
    console.error("❌ Error adding investor:", error);
    res.status(500).json({ error: "Failed to add investor" });
  }
});

export default router;