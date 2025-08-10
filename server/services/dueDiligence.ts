import openaiService from './openai';
import { storage } from '../storage';
import { InsertAgentAnalysis } from '@shared/schema';

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
    You are an expert ${agent.specialty} specialist conducting comprehensive due diligence on a healthcare investment opportunity.
    
    DETAILED ANALYSIS REQUIREMENTS:
    Conduct an exhaustive analysis of the following ${documentType} document with specific focus on:
    ${agent.focusAreas.map(area => `- ${area}`).join('\n')}
    
    ANALYSIS SECTIONS TO COMPLETE:
    
    1. EXECUTIVE SUMMARY (2-3 sentences)
    Provide a high-level assessment of the document's relevance and key implications for investment decision-making.
    
    2. DETAILED FINDINGS (15-25 findings minimum)
    Identify comprehensive findings and classify them as:
    - Positive: Favorable aspects that strongly support investment thesis
    - Negative: Concerning issues that represent significant investment risks
    - Warning: Potential red flags requiring immediate further investigation
    - Info: Critical neutral information that impacts investment evaluation
    
    For each finding, provide:
    - Specific evidence from the document
    - Investment implications
    - Risk/opportunity assessment
    - Confidence level (High/Medium/Low)
    
    3. RISK ASSESSMENT
    - Identify all potential risks across technical, commercial, regulatory, and financial dimensions
    - Assess probability and impact for each risk
    - Provide risk mitigation strategies
    
    4. STRATEGIC RECOMMENDATIONS (10-15 recommendations minimum)
    Provide specific, actionable recommendations including:
    - Immediate next steps for due diligence
    - Additional information/documents required
    - Key questions for management team
    - Potential deal structure considerations
    - Timeline implications
    
    5. COMPETITIVE LANDSCAPE INSIGHTS
    - Market positioning analysis
    - Competitive advantages/disadvantages identified
    - Differentiation factors
    
    6. INVESTMENT DECISION FACTORS
    - Key value drivers identified
    - Critical success factors
    - Potential value creation opportunities
    - Exit strategy considerations
    
    Return your analysis as a comprehensive JSON object with:
    {
      "executiveSummary": "2-3 sentence high-level assessment",
      "findings": [
        {
          "id": 1, 
          "content": "detailed finding with specific evidence and investment implications (minimum 100 words per finding)", 
          "type": "Positive|Negative|Warning|Info",
          "confidence": "High|Medium|Low",
          "investmentImpact": "description of how this affects investment decision",
          "evidence": "specific quotes or data points from document"
        },
        ... (minimum 15-25 findings)
      ],
      "riskAssessment": {
        "technicalRisks": ["detailed risk descriptions"],
        "commercialRisks": ["detailed risk descriptions"],
        "regulatoryRisks": ["detailed risk descriptions"],
        "financialRisks": ["detailed risk descriptions"],
        "mitigationStrategies": ["specific mitigation approaches"]
      },
      "recommendations": [
        "detailed actionable recommendation with specific next steps and rationale (minimum 50 words per recommendation)",
        ... (minimum 10-15 recommendations)
      ],
      "competitiveLandscape": {
        "positioning": "market position analysis",
        "advantages": ["competitive advantages identified"],
        "disadvantages": ["competitive weaknesses"],
        "differentiation": "key differentiating factors"
      },
      "investmentFactors": {
        "valueDrivers": ["key value creation opportunities"],
        "successFactors": ["critical success factors"],
        "exitConsiderations": ["potential exit strategy factors"]
      },
      "additionalDataNeeded": [
        "specific documents or information required for complete assessment"
      ]
    }
    
    QUALITY REQUIREMENTS:
    - Each finding must be substantive (minimum 100 words) with specific evidence
    - Each recommendation must be actionable (minimum 50 words) with clear rationale
    - Provide detailed analysis rather than superficial observations
    - Focus on investment-relevant insights that drive decision-making
    - Include specific quotes and data points where available
    - Maintain professional investment analysis standards throughout
  `;

  const analysisResult = await openaiService.analyzeDocument(
    documentContent,
    analysisPrompt,
    { 
      jsonResponse: true, 
      temperature: 0.2, // Lower temperature for more consistent, detailed analysis
      model: "gpt-4o", // Ensure we use the most capable model
      maxTokens: 8000 // Increase token limit for detailed responses
    }
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
  const analysisData: InsertAgentAnalysis = {
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