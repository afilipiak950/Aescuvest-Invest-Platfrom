import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface EvaluationCriteria {
  id: number;
  name: string;
  description: string;
  weight: number;
}

interface CriteriaEvaluation {
  criteriaId: number;
  score: number; // 0-100
  analysis: string;
  confidence: number; // 0-100
}

export interface WebsiteEvaluationResult {
  overallScore: number;
  criteriaEvaluations: CriteriaEvaluation[];
  recommendation: string;
  nextSteps: string[];
}

export async function evaluateWebsite(
  website: string, 
  companyName: string,
  sector: string,
  criteria: EvaluationCriteria[]
): Promise<WebsiteEvaluationResult> {
  
  // Step 1: Fetch website content for analysis
  const websiteContent = await fetchWebsiteContent(website);
  
  // Step 2: Evaluate each criteria intelligently
  const criteriaEvaluations: CriteriaEvaluation[] = [];
  
  for (const criterion of criteria) {
    const evaluation = await evaluateSingleCriteria(
      websiteContent,
      companyName,
      sector,
      criterion
    );
    criteriaEvaluations.push(evaluation);
  }
  
  // Step 3: Calculate weighted overall score
  const overallScore = calculateWeightedScore(criteriaEvaluations, criteria);
  
  // Step 4: Generate recommendation and next steps
  const { recommendation, nextSteps } = await generateRecommendation(
    criteriaEvaluations,
    overallScore,
    companyName,
    sector
  );
  
  return {
    overallScore,
    criteriaEvaluations,
    recommendation,
    nextSteps
  };
}

async function fetchWebsiteContent(website: string): Promise<string> {
  try {
    // Use OpenAI to analyze the website by browsing it
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a web content analyzer. Extract and summarize key information from websites for investment analysis."
        },
        {
          role: "user",
          content: `Please analyze the website ${website} and provide a comprehensive summary including:
          - Company description and mission
          - Products/services offered
          - Target market and customers
          - Technology stack and approach
          - Team information if available
          - Business model
          - Competitive advantages
          - Market positioning
          - Any regulatory or compliance information
          - Geographic presence and headquarters location
          
          Focus on extracting factual information that would be relevant for investment analysis.`
        }
      ],
      max_tokens: 2000
    });

    return response.choices[0].message.content || "Unable to fetch website content";
  } catch (error) {
    console.error("Error fetching website content:", error);
    return "Unable to analyze website content";
  }
}

async function evaluateSingleCriteria(
  websiteContent: string,
  companyName: string,
  sector: string,
  criterion: EvaluationCriteria
): Promise<CriteriaEvaluation> {
  
  const prompt = buildCriteriaPrompt(criterion, websiteContent, companyName, sector);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert investment analyst specializing in healthcare technology. Evaluate companies based on specific investment criteria and provide detailed, factual analysis."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      criteriaId: criterion.id,
      score: Math.max(0, Math.min(100, result.score || 0)),
      analysis: result.analysis || "No analysis available",
      confidence: Math.max(0, Math.min(100, result.confidence || 0))
    };
  } catch (error) {
    console.error(`Error evaluating criteria ${criterion.name}:`, error);
    return {
      criteriaId: criterion.id,
      score: 0,
      analysis: "Unable to evaluate this criteria",
      confidence: 0
    };
  }
}

function buildCriteriaPrompt(
  criterion: EvaluationCriteria,
  websiteContent: string,
  companyName: string,
  sector: string
): string {
  
  const basePrompt = `
Analyze ${companyName} (sector: ${sector}) against the following investment criterion:

**Criterion: ${criterion.name}**
**Description: ${criterion.description}**

**Website Content Analysis:**
${websiteContent}

Please evaluate this company against the specific criterion and provide your analysis in JSON format:

{
  "score": [0-100 integer score],
  "analysis": "[Detailed analysis explaining the score]",
  "confidence": [0-100 confidence level in your assessment]
}

Focus on factual evidence from the website content. Be specific about what you found that supports or contradicts the criterion.
`;

  // Add specific guidance based on criterion type
  switch (criterion.name.toLowerCase()) {
    case 'sector':
      return basePrompt + `
**Specific Evaluation Guidelines:**
- Score 100 if clearly in healthcare/HealthTech
- Score 50-80 if healthcare-adjacent or has health components
- Score 0-30 if not healthcare related
- Look for: medical devices, digital health, biotechnology, pharmaceuticals, health services, medical software
`;

    case 'biotech exclusion':
      return basePrompt + `
**Specific Evaluation Guidelines:**
- Score 100 if NOT wet-lab biotech (software, devices, services)
- Score 50 if digital biotech or biotech-adjacent
- Score 0 if traditional wet-lab biotech requiring extensive lab facilities
- Look for: lab requirements, drug development, clinical trials, wet-lab processes
`;

    case 'hq geography':
      return basePrompt + `
**Specific Evaluation Guidelines:**
- Score 100 if headquarters in EU or Israel
- Score 70-90 if European presence with non-EU HQ
- Score 30-60 if other developed markets
- Score 0-20 if in restricted or difficult markets
- Look for: company address, office locations, legal entity information
`;

    case 'stage':
      return basePrompt + `
**Specific Evaluation Guidelines:**
- Score 100 if Series A-C
- Score 80 if late Seed with clear Series A trajectory  
- Score 60 if early Seed with strong traction
- Score 30 if pre-Seed with product
- Score 0 if idea stage only
- Look for: funding history, product maturity, customer base, revenue indicators
`;

    case 'ownership feasibility':
      return basePrompt + `
**Specific Evaluation Guidelines:**
- Score 100 if 20-30% ownership clearly achievable
- Score 80 if 15-25% ownership likely
- Score 60 if 10-20% ownership possible
- Score 40 if 5-15% ownership possible
- Score 0 if minimal ownership only
- Look for: funding stage, valuation indicators, team equity distribution
`;

    case 'business model fit':
      return basePrompt + `
**Specific Evaluation Guidelines:**
- Score 100 if clear platform logic (software, automation, reagents)
- Score 80 if scalable software/SaaS model
- Score 60 if automation/efficiency solutions
- Score 40 if service-based with some scalability
- Score 0 if pure services or non-scalable model
- Look for: platform approach, scalability, recurring revenue, technology leverage
`;

    default:
      return basePrompt;
  }
}

function calculateWeightedScore(
  evaluations: CriteriaEvaluation[],
  criteria: EvaluationCriteria[]
): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  for (const evaluation of evaluations) {
    const criterion = criteria.find(c => c.id === evaluation.criteriaId);
    if (criterion) {
      totalWeightedScore += evaluation.score * (criterion.weight / 100);
      totalWeight += criterion.weight;
    }
  }
  
  return totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) : 0;
}

async function generateRecommendation(
  evaluations: CriteriaEvaluation[],
  overallScore: number,
  companyName: string,
  sector: string
): Promise<{ recommendation: string; nextSteps: string[] }> {
  
  const evaluationSummary = evaluations.map(e => 
    `- Score ${e.score}/100 (Confidence: ${e.confidence}%): ${e.analysis.substring(0, 100)}...`
  ).join('\n');
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a senior investment partner providing investment recommendations based on due diligence analysis."
        },
        {
          role: "user",
          content: `Based on the evaluation of ${companyName} (${sector}), provide an investment recommendation and next steps.

Overall Score: ${overallScore}/100

Detailed Evaluations:
${evaluationSummary}

Provide your response in JSON format:
{
  "recommendation": "[PASS/INVESTIGATE/REJECT with brief reasoning]",
  "nextSteps": ["step1", "step2", "step3"]
}

Recommendation guidelines:
- PASS (80-100): Strong candidate, proceed to term sheet
- INVESTIGATE (50-79): Potential, needs deeper analysis  
- REJECT (0-49): Does not meet criteria`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      recommendation: result.recommendation || "Unable to generate recommendation",
      nextSteps: result.nextSteps || ["Contact investment team for manual review"]
    };
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return {
      recommendation: "Unable to generate recommendation - manual review required",
      nextSteps: ["Contact investment team for manual review"]
    };
  }
}