import openaiService from './openai';
import { storage } from '../storage';
import { InsertDeal } from '@shared/schema';

/**
 * Allocation Agent: Evaluates incoming investment requests and scores them
 */
export async function evaluateInvestmentRequest(
  requestText: string,
  attachments: string[] = []
): Promise<{
  score: number;
  companyName: string;
  sector: string;
  stage: string;
  recommendedAction: string;
  analysis: string;
}> {
  // Define what structured data we want to extract
  const extractionGoal = `
    Extract the following information:
    - Company name
    - Description of the business
    - Sector/industry
    - Funding stage sought
    - Funding amount requested
    - Current traction/metrics
    - Team background
    - Location
  `;

  // Extract structured information from the request
  const extractedInfo = await openaiService.extractInformation(requestText, extractionGoal, {
    temperature: 0.1
  });

  // Combine the request text and any attachments for comprehensive analysis
  let fullContent = requestText;
  if (attachments.length > 0) {
    fullContent += "\n\nAttachments:\n" + attachments.join("\n\n");
  }

  // Analyze the fit with Aescuvest investment criteria
  const analysisPrompt = `
    Analyze this investment opportunity for an Aescuvest healthcare investment fund. 
    Consider the following factors:
    1. Relevance to healthcare/biotech/medtech sectors
    2. Stage appropriateness (preferring Series A to B)
    3. Quality of team background
    4. Market potential
    5. Innovation level
    6. Competitive differentiation
    7. Regulatory pathway clarity
    8. Commercial potential
    
    Rate the opportunity from 0-100 based on initial assessment and recommend one of these actions:
    - "proceed": High-quality opportunity that warrants further review
    - "request-more-info": Potentially interesting but requires additional information
    - "decline": Not a fit for Aescuvest's investment criteria
    
    Return your analysis as a JSON object with:
    {
      "score": number from 0-100,
      "companyName": extracted company name,
      "sector": healthcare subsector,
      "stage": funding stage,
      "recommendedAction": one of the three actions,
      "analysis": brief explanation of the rating and recommendation (100-200 words)
    }
  `;

  const analysisResult = await openaiService.generateResponse(
    analysisPrompt,
    fullContent,
    { jsonResponse: true, temperature: 0.4 }
  );

  // Parse and return the analysis
  try {
    return JSON.parse(analysisResult);
  } catch (error) {
    console.error("Failed to parse allocation agent analysis:", error);
    // Return default structure with error information
    return {
      score: 0,
      companyName: extractedInfo.companyName || "Unknown Company",
      sector: extractedInfo.sector || "Unspecified",
      stage: extractedInfo.stage || "Unspecified",
      recommendedAction: "request-more-info",
      analysis: "Error in analyzing request. Please review manually."
    };
  }
}

/**
 * Communication Agent: Generates appropriate responses to founders
 */
export async function generateFounderResponse(
  requestData: any,
  responseType: "rejection" | "more-info" | "follow-up" | "proceed",
  customContext: string = ""
): Promise<string> {
  // Prepare data for communication template
  const templateData = {
    companyName: requestData.companyName,
    sector: requestData.sector,
    stage: requestData.stage,
    analysis: requestData.analysis,
    customContext
  };

  // Map response types to communication template types
  const templateTypeMap: Record<string, string> = {
    "rejection": "rejection",
    "more-info": "more-info",
    "follow-up": "follow-up",
    "proceed": "meeting-request"
  };

  return openaiService.draftCommunication(
    templateTypeMap[responseType] || "more-info",
    templateData,
    { temperature: 0.7 }
  );
}

/**
 * Document Agent: Creates a deal record in the database
 */
export async function createDealRecord(requestAnalysis: any): Promise<number> {
  // Extract information from the analysis to create a deal record
  const dealData: InsertDeal = {
    companyName: requestAnalysis.companyName,
    description: requestAnalysis.analysis.slice(0, 100) + "...", // Truncate for description
    sector: requestAnalysis.sector,
    stage: requestAnalysis.stage,
    status: "New Submission",
    // Optional fields if available
    location: requestAnalysis.location || null,
    website: requestAnalysis.website || null,
    fundingAmount: requestAnalysis.fundingAmount || null
  };

  // Create the deal in the database
  const newDeal = await storage.createDeal(dealData);

  // Update the AI score based on the allocation agent's scoring
  if (newDeal && requestAnalysis.score) {
    await storage.updateDealAiScore(newDeal.id, requestAnalysis.score);
  }

  return newDeal.id;
}

/**
 * Routing Agent: Determines who should handle a request based on deal characteristics
 */
export async function determineRoutingAssignment(dealData: any): Promise<{
  assignedTo: string;
  priority: "high" | "medium" | "low";
  rationale: string;
}> {
  const routingPrompt = `
    Determine the optimal team member assignment for this investment opportunity.
    
    Key team members:
    - Patrick: Managing Partner, focuses on later-stage opportunities (Series B+) and strategic investments
    - Olivier: Partner, specializes in early-stage medtech and biotech (Seed to Series A)
    - Investment Analysts: Handle initial screening and support for smaller opportunities
    
    Based on the deal characteristics, determine:
    1. Who should be assigned (Patrick, Olivier, or Investment Analysts)
    2. Priority level (high, medium, low)
    3. Brief rationale for the assignment

    Return as JSON:
    {
      "assignedTo": "Patrick" | "Olivier" | "Investment Analysts",
      "priority": "high" | "medium" | "low",
      "rationale": "brief explanation"
    }
  `;

  const routingResult = await openaiService.generateResponse(
    routingPrompt,
    JSON.stringify(dealData),
    { jsonResponse: true, temperature: 0.3 }
  );

  try {
    return JSON.parse(routingResult);
  } catch (error) {
    console.error("Failed to parse routing assignment:", error);
    return {
      assignedTo: "Investment Analysts",
      priority: "medium",
      rationale: "Default assignment due to processing error. Please review manually."
    };
  }
}

export default {
  evaluateInvestmentRequest,
  generateFounderResponse,
  createDealRecord,
  determineRoutingAssignment
};