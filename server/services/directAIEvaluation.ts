import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface EvaluationCriterion {
  id: number;
  name: string;
  description: string;
  weight: number;
}

interface CompanyData {
  companyName: string;
  description?: string;
  website?: string;
  location?: string;
  executiveSummary?: string;
  productMarket?: string;
  team?: any;
  financials?: any;
  risks?: any;
}

interface EvaluationResult {
  criterionId: number;
  criterionName: string;
  score: number;
  reasoning: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export async function analyzeCompanyAgainstCriteria(
  companyData: CompanyData,
  criteria: EvaluationCriterion[]
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (const criterion of criteria) {
    try {
      const analysis = await evaluateCompanyAgainstCriterion(companyData, criterion);
      results.push(analysis);
    } catch (error) {
      console.error(`Error evaluating criterion ${criterion.name}:`, error);
      // Provide fallback result
      results.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        score: 5,
        reasoning: 'Unable to evaluate due to technical error. Manual review required.',
        confidence: 0,
        riskLevel: 'medium'
      });
    }
  }

  return results;
}

async function evaluateCompanyAgainstCriterion(
  companyData: CompanyData,
  criterion: EvaluationCriterion
): Promise<EvaluationResult> {
  const prompt = `
You are an expert investment analyst evaluating companies against specific criteria.

Company Information:
- Name: ${companyData.companyName}
- Description: ${companyData.description || 'Not provided'}
- Website: ${companyData.website || 'Not provided'}
- Location: ${companyData.location || 'Not provided'}
- Executive Summary: ${companyData.executiveSummary || 'Not provided'}
- Product/Market: ${companyData.productMarket || 'Not provided'}
- Team: ${JSON.stringify(companyData.team || {}, null, 2)}
- Financials: ${JSON.stringify(companyData.financials || {}, null, 2)}

Evaluation Criterion:
- Name: ${criterion.name}
- Description: ${criterion.description}

Please evaluate this company against the criterion and provide:
1. A score from 1-10 (1 = poor fit, 10 = excellent fit)
2. Detailed reasoning for the score
3. Confidence level (0-1, where 1 = very confident)
4. Risk level (low/medium/high)

Respond in JSON format:
{
  "score": number,
  "reasoning": "detailed explanation",
  "confidence": number,
  "riskLevel": "low|medium|high"
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    messages: [
      {
        role: 'system',
        content: 'You are an expert investment analyst. Provide accurate, data-driven evaluations based on the information provided. Always respond in valid JSON format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  try {
    const analysisResult = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      score: Math.max(1, Math.min(10, analysisResult.score || 5)),
      reasoning: analysisResult.reasoning || 'Analysis completed',
      confidence: Math.max(0, Math.min(1, analysisResult.confidence || 0.5)),
      riskLevel: ['low', 'medium', 'high'].includes(analysisResult.riskLevel) 
        ? analysisResult.riskLevel 
        : 'medium'
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return {
      criterionId: criterion.id,
      criterionName: criterion.name,
      score: 5,
      reasoning: 'Unable to parse AI analysis results. Manual review recommended.',
      confidence: 0.2,
      riskLevel: 'medium'
    };
  }
}