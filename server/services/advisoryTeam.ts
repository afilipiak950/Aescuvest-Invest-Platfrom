import openaiService from './openai';
import { storage } from '../storage';
import { InsertInvestorMatch } from '@shared/schema';

/**
 * Teaser Agent: Generates investment opportunity teasers
 */
export async function generateInvestmentTeaser(
  dealId: number,
  includeConfidential: boolean = false
): Promise<{
  title: string;
  summary: string;
  highlights: string[];
  investmentOpportunity: string;
  teamHighlights: string;
  contactInfo: string;
}> {
  // Fetch deal data and any related documents
  const deal = await storage.getDealById(dealId);
  if (!deal) {
    throw new Error(`Deal with ID ${dealId} not found`);
  }

  // Get additional data if available
  const memo = await storage.getMemoByDealId(dealId);
  const analyses = await storage.getAnalysesByDealId(dealId);
  
  // Prepare data for teaser generation
  const teaserData = {
    deal,
    memo: includeConfidential ? memo : null,
    analyses: includeConfidential ? analyses : null,
    confidentialityLevel: includeConfidential ? "NDA-covered" : "Public"
  };

  const teaserPrompt = `
    Create a compelling investment opportunity teaser for ${deal.companyName}.
    
    This is for a ${teaserData.confidentialityLevel} distribution. 
    ${!includeConfidential ? "DO NOT include any confidential information, specific financial metrics, or proprietary details." : ""}
    
    Create a professional, compelling summary that highlights key value drivers while maintaining appropriate confidentiality.
    
    Return the teaser as a JSON object with:
    {
      "title": "concise, attention-grabbing title",
      "summary": "1-2 paragraph company and opportunity overview",
      "highlights": ["key highlight 1", "key highlight 2", ...],
      "investmentOpportunity": "1 paragraph on the investment opportunity and potential returns",
      "teamHighlights": "brief highlight of key team strengths without naming specific people if confidential",
      "contactInfo": "standardized contact text for Aescuvest"
    }
  `;

  const teaserResult = await openaiService.analyzeDeal(
    teaserData,
    "teaser",
    { jsonResponse: true, temperature: 0.7 }
  );

  try {
    return JSON.parse(teaserResult);
  } catch (error) {
    console.error("Failed to parse investment teaser:", error);
    return {
      title: `${deal.companyName} - Investment Opportunity`,
      summary: `${deal.companyName} is a ${deal.stage} company in the ${deal.sector} sector. ${deal.description}`,
      highlights: ["Error generating detailed highlights"],
      investmentOpportunity: "Please contact Aescuvest for more information on this investment opportunity.",
      teamHighlights: "Experienced team with relevant industry expertise.",
      contactInfo: "For more information, contact Aescuvest at invest@aescuvest.com"
    };
  }
}

/**
 * Matching Agent: Identifies suitable investors for deals
 */
export async function matchInvestorsForDeal(
  dealId: number,
  minMatchScore: number = 60
): Promise<{
  investorId: number;
  matchScore: number;
  matchInsights: string[];
}[]> {
  // Fetch deal data
  const deal = await storage.getDealById(dealId);
  if (!deal) {
    throw new Error(`Deal with ID ${dealId} not found`);
  }

  // Fetch all investors from the database
  const allInvestors = await storage.getAllInvestors();
  
  // For each investor, calculate a match score using AI
  const matchResults = [];
  
  for (const investor of allInvestors) {
    const matchData = {
      deal,
      investor
    };
    
    const matchPrompt = `
      Evaluate the match between this investment opportunity and potential investor.
      
      Consider the following factors:
      1. Sector alignment (Does the deal match the investor's focus areas?)
      2. Stage fit (Is the deal at a stage this investor typically targets?)
      3. Check size alignment (Is the funding amount in the investor's typical range?)
      4. Geographic preference (Does the deal location match investor preferences?)
      5. Portfolio fit (Would this complement their existing investments?)
      
      Return your analysis as a JSON object with:
      {
        "matchScore": number from 0-100,
        "matchInsights": ["specific reason for match/mismatch 1", "reason 2", ...]
      }
      
      Be specific with your insights and explain exactly why this is or isn't a good match.
    `;

    const matchResult = await openaiService.generateResponse(
      matchPrompt,
      JSON.stringify(matchData),
      { jsonResponse: true, temperature: 0.4 }
    );

    try {
      const parsedResult = JSON.parse(matchResult);
      
      // Only include if the match score meets the minimum threshold
      if (parsedResult.matchScore >= minMatchScore) {
        matchResults.push({
          investorId: investor.id,
          matchScore: parsedResult.matchScore,
          matchInsights: parsedResult.matchInsights
        });
      }
    } catch (error) {
      console.error(`Failed to parse match result for investor ${investor.id}:`, error);
    }
  }
  
  // Sort matches by score (highest first)
  return matchResults.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Save investor matches to the database
 */
export async function saveInvestorMatches(
  dealId: number,
  matches: { investorId: number; matchScore: number; matchInsights: string[] }[]
): Promise<void> {
  for (const match of matches) {
    const matchData: InsertInvestorMatch = {
      dealId,
      investorId: match.investorId,
      matchScore: match.matchScore,
      matchInsights: match.matchInsights,
      status: "New Match"
    };
    
    await storage.createInvestorMatch(matchData);
  }
}

/**
 * Communication Agent: Generates investor communications
 */
export async function generateInvestorCommunication(
  dealId: number,
  investorId: number,
  communicationType: "initial-outreach" | "follow-up" | "meeting-request"
): Promise<{
  subject: string;
  body: string;
  suggestedTiming: string;
}> {
  // Fetch the deal and investor data
  const deal = await storage.getDealById(dealId);
  const investor = await storage.getInvestorById(investorId);
  
  if (!deal || !investor) {
    throw new Error("Deal or investor not found");
  }
  
  // Fetch the match data if it exists
  const matches = await storage.getInvestorMatchesByDealId(dealId);
  const match = matches.find(m => m.investorId === investorId);
  
  const communicationData = {
    deal,
    investor,
    match,
    communicationType
  };
  
  const communicationPrompt = `
    Generate a professional email communication to an investor about an investment opportunity.
    
    This is a ${communicationType} email regarding ${deal.companyName}, a ${deal.stage} company in the ${deal.sector} sector.
    
    The email should be:
    - Professional and concise
    - Tailored to the investor's interests and preferences
    - Compelling without overpromising
    - Clear about next steps
    
    Return the communication as a JSON object with:
    {
      "subject": "email subject line",
      "body": "full email body text with proper formatting",
      "suggestedTiming": "recommendation on when to send (e.g., 'Tuesday morning')"
    }
  `;

  const communicationResult = await openaiService.generateResponse(
    communicationPrompt,
    JSON.stringify(communicationData),
    { jsonResponse: true, temperature: 0.7 }
  );

  try {
    return JSON.parse(communicationResult);
  } catch (error) {
    console.error("Failed to parse investor communication:", error);
    return {
      subject: `${deal.companyName} - Investment Opportunity`,
      body: `Dear ${investor.name},\n\nI wanted to bring to your attention an exciting investment opportunity in the ${deal.sector} sector that aligns with your investment focus.\n\n${deal.companyName} is a ${deal.stage} company looking for funding. Please let me know if you'd like to learn more.\n\nBest regards,\nAescuvest Team`,
      suggestedTiming: "Business hours"
    };
  }
}

export default {
  generateInvestmentTeaser,
  matchInvestorsForDeal,
  saveInvestorMatches,
  generateInvestorCommunication
};