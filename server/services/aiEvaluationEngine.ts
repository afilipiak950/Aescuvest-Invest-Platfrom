import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EvaluationCriteria {
  id: number;
  name: string;
  description: string;
  weight: number;
}

interface CompanyData {
  companyName: string;
  sector: string;
  location: string;
  website: string;
  stage: string;
  fundingAmount: number;
  description: string;
}

interface CriteriaEvaluation {
  criteriaId: number;
  criteriaName: string;
  score: number; // 0-100
  reasoning: string;
  keyFactors: string[];
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
}

export class AIEvaluationEngine {
  
  async evaluateCompanyAgainstCriteria(
    company: CompanyData,
    criteria: EvaluationCriteria,
    companyResearch?: any
  ): Promise<CriteriaEvaluation> {
    try {
      console.log(`🤖 AI Evaluating ${company.companyName} against ${criteria.name}...`);
      
      const prompt = this.buildEvaluationPrompt(company, criteria, companyResearch);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert venture capital analyst specializing in investment evaluation. 
            Analyze companies against specific investment criteria with precision and provide detailed, data-driven assessments.
            Always provide realistic scores based on actual market conditions and company performance.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        criteriaId: criteria.id,
        criteriaName: criteria.name,
        score: Math.max(0, Math.min(100, result.score || 0)),
        reasoning: result.reasoning || 'Analysis completed',
        keyFactors: result.keyFactors || [],
        riskLevel: result.riskLevel || 'medium',
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5))
      };
      
    } catch (error) {
      console.error(`❌ Error evaluating ${company.companyName} against ${criteria.name}:`, error);
      
      // Return fallback evaluation
      return {
        criteriaId: criteria.id,
        criteriaName: criteria.name,
        score: 50,
        reasoning: `Unable to complete AI analysis for ${criteria.name}. Please check API configuration.`,
        keyFactors: ['Analysis incomplete'],
        riskLevel: 'medium',
        confidence: 0.3
      };
    }
  }

  private buildEvaluationPrompt(
    company: CompanyData,
    criteria: EvaluationCriteria,
    companyResearch?: any
  ): string {
    const baseInfo = `
Company: ${company.companyName}
Sector: ${company.sector}
Location: ${company.location}
Website: ${company.website}
Stage: ${company.stage}
Funding Amount: $${(company.fundingAmount / 1000000).toFixed(1)}M
Description: ${company.description}
`;

    const researchInfo = companyResearch ? `
Additional Research Data:
- Market Cap: ${companyResearch.marketMetrics?.marketCap || 'N/A'}
- Revenue: ${companyResearch.marketMetrics?.revenue || 'N/A'}
- Employees: ${companyResearch.marketMetrics?.employees || 'N/A'}
- CEO: ${companyResearch.executiveSummary?.ceo || 'N/A'}
- Founded: ${companyResearch.executiveSummary?.founded || 'N/A'}
- Key Products: ${companyResearch.productMarket?.keyProducts?.join(', ') || 'N/A'}
- Competitors: ${companyResearch.marketMetrics?.competitors?.join(', ') || 'N/A'}
` : '';

    return `${baseInfo}${researchInfo}

Evaluation Criteria: ${criteria.name}
Description: ${criteria.description}
Weight in Portfolio: ${criteria.weight}%

Please evaluate this company against the "${criteria.name}" criterion and provide a JSON response with:
{
  "score": <number 0-100>,
  "reasoning": "<detailed 2-3 sentence explanation with specific examples>",
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "riskLevel": "<low|medium|high>",
  "confidence": <number 0-1>
}

Scoring Guidelines:
- 90-100: Exceptional fit, market leader
- 80-89: Strong fit, competitive advantage
- 70-79: Good fit, meets requirements
- 60-69: Adequate fit, some concerns
- 50-59: Marginal fit, significant concerns
- 0-49: Poor fit, does not meet criteria

Consider real market data, financial performance, competitive position, and growth potential.`;
  }

  async evaluateAllCriteria(
    company: CompanyData,
    criteriaList: EvaluationCriteria[],
    companyResearch?: any
  ): Promise<{
    overallScore: number;
    weightedScore: number;
    evaluations: CriteriaEvaluation[];
  }> {
    console.log(`🚀 Starting comprehensive AI evaluation for ${company.companyName}...`);
    
    const evaluations: CriteriaEvaluation[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    // Evaluate each criterion
    for (const criteria of criteriaList) {
      const evaluation = await this.evaluateCompanyAgainstCriteria(
        company,
        criteria,
        companyResearch
      );
      
      evaluations.push(evaluation);
      
      // Calculate weighted contribution
      const weightedContribution = (evaluation.score * criteria.weight) / 100;
      totalWeightedScore += weightedContribution;
      totalWeight += criteria.weight;
    }

    // Calculate final scores
    const weightedScore = totalWeight > 0 ? totalWeightedScore : 0;
    const overallScore = evaluations.length > 0 
      ? evaluations.reduce((sum, eval) => sum + eval.score, 0) / evaluations.length
      : 0;

    console.log(`✅ Evaluation complete. Overall: ${overallScore.toFixed(1)}, Weighted: ${weightedScore.toFixed(1)}`);

    return {
      overallScore: Math.round(overallScore),
      weightedScore: Math.round(weightedScore),
      evaluations
    };
  }
}