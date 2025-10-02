import openaiService from './openai';
import { storage } from '../storage';
import { agentAnalyses } from '@shared/schema';

// Define the types of due diligence agents
export type AgentType = 
  | 'Clinical'
  | 'Legal'
  | 'Commercial'
  | 'HR'
  | 'Financial'
  | 'IP'
  | 'Research';

// Map agent types to their specialties and focus areas
const agentSpecialties: Record<AgentType, { 
  specialty: string, 
  focusAreas: string[],
  expectedOutput: string 
}> = {
  Clinical: {
    specialty: "Clinical and regulatory assessment",
    focusAreas: [
      "Clinical trial design and results",
      "Regulatory pathway and timeline",
      "Safety and efficacy data",
      "Medical claims substantiation",
      "Regulatory compliance history"
    ],
    expectedOutput: "Evaluation of clinical evidence, regulatory risks, and pathway to approval"
  },
  Legal: {
    specialty: "Legal structure and risk assessment",
    focusAreas: [
      "Cap table structure and cleanliness",
      "Corporate governance",
      "Existing legal claims/litigation",
      "Contractual obligations",
      "Compliance with applicable laws and regulations"
    ],
    expectedOutput: "Analysis of legal risks, governance issues, and structural concerns"
  },
  Commercial: {
    specialty: "Business model and market assessment",
    focusAreas: [
      "Business model sustainability",
      "Market size and growth potential",
      "Competitive landscape",
      "Go-to-market strategy",
      "Revenue model and pricing strategy",
      "Customer acquisition and retention"
    ],
    expectedOutput: "Evaluation of commercial viability, scalability, and market positioning"
  },
  HR: {
    specialty: "Team and organizational assessment",
    focusAreas: [
      "Founder and management team background",
      "Key employment agreements",
      "Compensation structure",
      "Retention risks",
      "Culture and organizational health",
      "Hiring plans and talent strategy"
    ],
    expectedOutput: "Analysis of team strengths, retention risks, and organizational structure"
  },
  Financial: {
    specialty: "Financial assessment",
    focusAreas: [
      "Financial statements and projections",
      "Burn rate and runway",
      "Revenue growth and quality",
      "Cost structure and unit economics",
      "Debt obligations",
      "Cash management"
    ],
    expectedOutput: "Evaluation of financial health, forecasts, and investment risks"
  },
  IP: {
    specialty: "Intellectual property assessment",
    focusAreas: [
      "Patent portfolio and strategy",
      "IP ownership clarity",
      "Freedom to operate",
      "Licensing agreements",
      "IP litigation risks",
      "Trade secrets protection"
    ],
    expectedOutput: "Analysis of IP strength, protection strategy, and competitive moat"
  },
  Research: {
    specialty: "Market and industry research",
    focusAreas: [
      "Industry trends and dynamics",
      "Market size validation",
      "Competitor intelligence",
      "Regulatory landscape changes",
      "Relevant academic/scientific research",
      "Macro factors impacting the sector"
    ],
    expectedOutput: "Comprehensive market analysis, competitive positioning, and industry outlook"
  }
};

/**
 * Analyze a document based on a specific due diligence focus area
 */
export async function analyzeDocument(
  documentContent: string,
  documentType: string,
  agentType: AgentType
): Promise<{
  findings: { id: number; content: string; type: "Positive" | "Negative" | "Warning" | "Info" }[];
  recommendations: string[];
}> {
  const agent = agentSpecialties[agentType];
  
  const analysisPrompt = `
    You are an expert ${agent.specialty} specialist conducting due diligence on a healthcare investment opportunity.
    
    Analyze the following ${documentType} document with specific focus on:
    ${agent.focusAreas.map(area => `- ${area}`).join('\n')}
    
    Identify key findings and classify them as:
    - Positive: Favorable aspects that support investment
    - Negative: Concerning issues that represent significant risks
    - Warning: Potential issues that require further investigation
    - Info: Neutral but important information
    
    Provide specific, actionable recommendations based on your findings.
    
    Return your analysis as a JSON object with:
    {
      "findings": [
        {"id": 1, "content": "detailed finding description", "type": "Positive|Negative|Warning|Info"},
        ...
      ],
      "recommendations": [
        "specific recommendation 1",
        "specific recommendation 2",
        ...
      ]
    }
    
    Limit to 5-7 most significant findings and 3-5 actionable recommendations.
  `;

  const analysisResult = await openaiService.analyzeDocument(
    documentContent,
    analysisPrompt,
    { jsonResponse: true, temperature: 0.4 }
  );

  try {
    return JSON.parse(analysisResult);
  } catch (error) {
    console.error(`Failed to parse ${agentType} agent analysis:`, error);
    // Return default structure with error information
    return {
      findings: [{ 
        id: 1, 
        content: `Error analyzing document with ${agentType} agent. Please review manually.`,
        type: "Warning" 
      }],
      recommendations: ["Perform manual review of this document."]
    };
  }
}

/**
 * Create a new agent analysis in the database
 */
export async function createAgentAnalysis(
  dealId: number,
  agentType: AgentType,
  analysisResults: any
): Promise<number> {
  const analysisData: typeof agentAnalyses.$inferInsert = {
    dealId,
    agentType,
    status: "In Progress",
    findings: analysisResults.findings,
    recommendations: analysisResults.recommendations
  };

  const newAnalysis = await storage.createAgentAnalysis(analysisData);
  return newAnalysis.id;
}

/**
 * Update the progress of an agent analysis
 */
export async function updateAnalysisProgress(
  analysisId: number,
  progress: number,
  status: "In Progress" | "Complete" | "Waiting" = "In Progress"
): Promise<void> {
  await storage.updateAgentAnalysis(analysisId, { progress, status });
}

/**
 * Generate a comprehensive due diligence report from multiple agent analyses
 */
export async function generateDueDiligenceReport(
  dealId: number,
  includeAgentTypes: AgentType[] = ['Clinical', 'Legal', 'Commercial', 'Financial', 'IP']
): Promise<{
  executiveSummary: string;
  keyRisks: string[];
  keyStrengths: string[];
  recommendations: string[];
  agentSummaries: Record<string, string>;
}> {
  // Fetch all completed analyses for this deal
  const analyses = await storage.getAnalysesByDealId(dealId);
  const completedAnalyses = analyses.filter(analysis => 
    analysis.status === "Complete" && 
    includeAgentTypes.includes(analysis.agentType as AgentType)
  );

  // Fetch deal data
  const deal = await storage.getDealById(dealId);
  if (!deal) {
    throw new Error(`Deal with ID ${dealId} not found`);
  }

  // Prepare data for the report generation
  const reportData = {
    deal,
    analyses: completedAnalyses
  };

  const reportPrompt = `
    Generate a comprehensive due diligence report based on multiple specialist analyses.
    
    Synthesize the findings and recommendations from each analysis into a cohesive executive summary.
    Highlight the most significant risks and strengths across all dimensions.
    Provide actionable, prioritized recommendations.
    
    Return the report as a JSON object with:
    {
      "executiveSummary": "comprehensive 2-3 paragraph summary",
      "keyRisks": ["risk 1", "risk 2", ...],
      "keyStrengths": ["strength 1", "strength 2", ...],
      "recommendations": ["recommendation 1", "recommendation 2", ...],
      "agentSummaries": {
        "Clinical": "summary of clinical analysis",
        "Legal": "summary of legal analysis",
        ...
      }
    }
  `;

  const reportResult = await openaiService.generateResponse(
    reportPrompt,
    JSON.stringify(reportData),
    { jsonResponse: true, temperature: 0.5 }
  );

  try {
    return JSON.parse(reportResult);
  } catch (error) {
    console.error("Failed to parse due diligence report:", error);
    return {
      executiveSummary: "Error generating comprehensive report. Please review individual analyses.",
      keyRisks: ["Error in report generation"],
      keyStrengths: [],
      recommendations: ["Review individual agent analyses manually"],
      agentSummaries: {}
    };
  }
}

export default {
  analyzeDocument,
  createAgentAnalysis,
  updateAnalysisProgress,
  generateDueDiligenceReport,
  agentSpecialties
};