import OpenAI from 'openai';
import { storage } from '../storage';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface EvaluationCriteria {
  id: number;
  name: string;
  description: string;
  weight: number;
  isActive: boolean;
}

interface CriterionScore {
  criterion: string;
  score: number;
  reasoning: string;
  evidence: string[];
  concerns: string[];
}

interface AIEvaluationResult {
  overallScore: number;
  recommendation: 'PASS' | 'INVESTIGATE' | 'REJECT';
  criterionScores: CriterionScore[];
  summary: string;
  keyFindings: string[];
  redFlags: string[];
}

export async function evaluateCompanyWebsite(
  website: string, 
  companyName: string
): Promise<AIEvaluationResult> {
  try {
    // Fetch website content
    const websiteResponse = await fetch(website, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Aescuvest-Bot/1.0)'
      }
    });

    if (!websiteResponse.ok) {
      throw new Error('Unable to fetch website content');
    }

    const htmlContent = await websiteResponse.text();
    
    // Extract text content from HTML
    const textContent = htmlContent
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 12000); // Increased limit for comprehensive analysis

    // Get evaluation criteria
    const criteria = await storage.getAllEvaluationCriteria();
    const activeCriteria = criteria.filter(c => c.isActive);

    // Perform AI evaluation
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert investment analyst specializing in healthcare technology investments. You work for Aescuvest, a venture capital firm focused on healthcare innovation.

Analyze the company website content against these specific investment criteria:

${activeCriteria.map(c => `${c.name} (Weight: ${c.weight}%): ${c.description}`).join('\n')}

For each criterion, provide:
1. A score from 0-100 (where 0 = completely fails criteria, 100 = perfectly meets criteria)
2. Clear reasoning for the score
3. Specific evidence from the website that supports your assessment
4. Any concerns or red flags related to this criterion

Scoring Guidelines:
- 80-100: Clearly meets investment criteria (PASS)
- 50-79: Requires further investigation (INVESTIGATE)  
- 0-49: Does not meet investment criteria (REJECT)

Return your analysis in JSON format with this structure:
{
  "criterionScores": [
    {
      "criterion": "Sector",
      "score": 85,
      "reasoning": "Clear healthcare focus with digital health solutions",
      "evidence": ["Specific quotes or facts from website"],
      "concerns": ["Any concerns or missing information"]
    }
  ],
  "summary": "Overall assessment of investment potential",
  "keyFindings": ["Most important positive discoveries"],
  "redFlags": ["Major concerns that need attention"]
}`
        },
        {
          role: "user",
          content: `Analyze this company: ${companyName}

Website content:
${textContent}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Calculate weighted overall score
    let weightedScore = 0;
    let totalWeight = 0;

    for (const criterionScore of analysis.criterionScores) {
      const criterion = activeCriteria.find(c => c.name === criterionScore.criterion);
      if (criterion) {
        weightedScore += (criterionScore.score * criterion.weight / 100);
        totalWeight += criterion.weight;
      }
    }

    const overallScore = totalWeight > 0 ? Math.round(weightedScore) : 0;
    
    // Determine recommendation based on overall score
    let recommendation: 'PASS' | 'INVESTIGATE' | 'REJECT';
    if (overallScore >= 80) {
      recommendation = 'PASS';
    } else if (overallScore >= 50) {
      recommendation = 'INVESTIGATE';
    } else {
      recommendation = 'REJECT';
    }

    return {
      overallScore,
      recommendation,
      criterionScores: analysis.criterionScores || [],
      summary: analysis.summary || 'Analysis completed',
      keyFindings: analysis.keyFindings || [],
      redFlags: analysis.redFlags || []
    };

  } catch (error) {
    console.error('Error in AI evaluation:', error);
    throw new Error('Failed to evaluate company website');
  }
}

export async function processAIEvaluationForDeal(dealId: number, website: string, companyName: string) {
  try {
    // Mark deal as processing
    await storage.updateDealAiScore(dealId, -1); // -1 indicates processing
    
    // Perform evaluation
    const evaluation = await evaluateCompanyWebsite(website, companyName);
    
    // Store evaluation results
    const evaluationResult = await storage.createEvaluationResult({
      dealId,
      overallScore: evaluation.overallScore,
      recommendation: evaluation.recommendation,
      criterionScores: JSON.stringify(evaluation.criterionScores),
      summary: evaluation.summary,
      keyFindings: JSON.stringify(evaluation.keyFindings),
      redFlags: JSON.stringify(evaluation.redFlags),
      evaluatedAt: new Date()
    });
    
    // Update deal with final score
    await storage.updateDealAiScore(dealId, evaluation.overallScore);
    
    console.log(`AI evaluation completed for deal ${dealId}: ${evaluation.overallScore}/100 (${evaluation.recommendation})`);
    
    return evaluation;
  } catch (error) {
    console.error(`Error processing AI evaluation for deal ${dealId}:`, error);
    // Mark as failed evaluation
    await storage.updateDealAiScore(dealId, 0);
    throw error;
  }
}