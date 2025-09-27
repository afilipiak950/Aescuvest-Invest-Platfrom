/**
 * Unified prompt templates for all agent types
 * CRITICAL: All prompts enforce pure JSON responses without markdown
 */

export interface PromptContext {
  agentType: string;
  question: string;
  subQuestions: string[];
  evidence: string;
  documentCount: number;
  averageSimilarity: number;
}

/**
 * Domain-specific system prompts
 */
const DOMAIN_CONTEXTS = {
  legal: `You are an expert legal analyst specializing in venture capital investment due diligence. 
Your expertise includes contract analysis, liability assessment, compliance verification, and legal risk evaluation.
Focus on quantified terms, specific clauses, monetary values, and contractual obligations.`,

  clinical: `You are an expert clinical analyst specializing in healthcare and life sciences investment due diligence.
Your expertise includes clinical trial analysis, regulatory compliance, FDA processes, patient outcomes, and medical evidence evaluation.
Focus on trial phases, endpoints, safety data, and regulatory pathways.`,

  commercial: `You are an expert commercial analyst specializing in market and business model evaluation for venture capital.
Your expertise includes market sizing, competitive analysis, customer acquisition, revenue models, and growth strategies.
Focus on quantified metrics, market dynamics, competitive advantages, and commercial viability.`,

  hr: `You are an expert HR analyst specializing in organizational and human capital assessment for investment due diligence.
Your expertise includes team evaluation, compensation analysis, organizational structure, and talent risk assessment.
Focus on team composition, compensation benchmarks, organizational health, and human capital risks.`,

  financial: `You are an expert financial analyst specializing in financial due diligence for venture capital investments.
Your expertise includes financial modeling, unit economics, burn rate analysis, and valuation assessment.
Focus on revenue metrics, expense analysis, cash flow, runway, and financial sustainability.`,

  ip: `You are an expert IP analyst specializing in intellectual property evaluation for technology investments.
Your expertise includes patent analysis, trademark assessment, trade secrets, licensing, and freedom to operate.
Focus on IP strength, portfolio value, competitive barriers, and intellectual property risks.`,

  research: `You are an expert research analyst specializing in industry and market research for venture capital.
Your expertise includes industry trends, competitive intelligence, technology assessment, and market dynamics.
Focus on market trends, competitor positioning, technology advantages, and future potential.`,
};

/**
 * Generate the system prompt with strict JSON enforcement
 */
export function generateSystemPrompt(agentType: string): string {
  const domainContext = DOMAIN_CONTEXTS[agentType as keyof typeof DOMAIN_CONTEXTS] || DOMAIN_CONTEXTS.research;
  
  return `${domainContext}

CRITICAL INSTRUCTIONS:
1. You MUST respond with pure JSON only - NO markdown code blocks, NO backticks, NO explanatory text
2. Your response must be valid JSON that can be parsed directly by JSON.parse()
3. Never wrap your response in \`\`\`json blocks or any other markdown
4. Always provide specific, evidence-based answers with citations
5. Include confidence scores based on evidence quality and completeness
6. Extract specific metrics, values, and quantified data when available
7. If evidence is insufficient, state this clearly with low confidence rather than speculating

Your analysis should be institutional-grade, comparable to Goldman Sachs or McKinsey research reports.`;
}

/**
 * Generate the analysis prompt for a specific question
 */
export function generateAnalysisPrompt(context: PromptContext): string {
  const { question, subQuestions, evidence, documentCount, averageSimilarity } = context;
  
  const subQuestionsText = subQuestions.length > 0 
    ? `\n\nConsider these specific aspects:\n${subQuestions.map(sq => `- ${sq}`).join('\n')}`
    : '';

  return `Analyze the following investment due diligence question using the provided evidence.

QUESTION: ${question}${subQuestionsText}

EVIDENCE FROM ${documentCount} DOCUMENTS (Relevance: ${(averageSimilarity * 100).toFixed(1)}%):
${evidence}

Provide a comprehensive analysis in the following JSON structure (NO MARKDOWN, pure JSON only):

{
  "answer": "Detailed answer to the question based on evidence",
  "confidence": 0.0-1.0,
  "sources": [
    {
      "documentName": "Name of source document",
      "snippet": "Relevant excerpt from document",
      "relevance": 0.0-1.0
    }
  ],
  "keyFindings": ["Key finding 1", "Key finding 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "riskScore": 1-10,
  "metrics": [
    {
      "name": "Metric name",
      "value": "Metric value",
      "unit": "Unit (optional)",
      "period": "Time period (optional)",
      "confidence": 0.0-1.0
    }
  ]
}

Base your confidence on:
- Evidence quality and relevance (current avg: ${(averageSimilarity * 100).toFixed(1)}%)
- Completeness of information
- Consistency across sources
- Specificity of data points

Remember: PURE JSON ONLY - no markdown, no code blocks, no explanations outside the JSON structure.`;
}

/**
 * Generate validation prompt to ensure response quality
 */
export function generateValidationPrompt(answer: any): string {
  return `Review this investment analysis answer and provide a quality assessment:

${JSON.stringify(answer, null, 2)}

Evaluate and respond with pure JSON (NO MARKDOWN):

{
  "isValid": true/false,
  "qualityScore": 0.0-1.0,
  "issues": ["Issue 1", "Issue 2"],
  "improvements": ["Suggested improvement 1", "Suggested improvement 2"],
  "confidenceAdjustment": 0.0-1.0
}

Check for:
- Evidence-based conclusions (no speculation)
- Appropriate confidence levels
- Clear, specific findings
- Actionable recommendations
- Proper source citations`;
}

/**
 * Generate prompt for error recovery
 */
export function generateErrorRecoveryPrompt(question: string, error: string): string {
  return `The previous analysis attempt failed with error: ${error}

Please provide a simplified analysis for: ${question}

Respond with pure JSON (NO MARKDOWN):

{
  "answer": "Best effort answer based on available information",
  "confidence": 0.0-0.5,
  "sources": [],
  "keyFindings": ["Available finding if any"],
  "recommendations": ["Recommendation to obtain more information"],
  "riskScore": 5,
  "error": "${error}",
  "dataLimitation": "Explanation of limitation"
}`;
}

/**
 * Clean markdown from responses (fallback if AI doesn't follow instructions)
 */
export function cleanJsonResponse(response: string): string {
  // Remove markdown code blocks
  let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  
  // Remove any text before the first {
  const jsonStart = cleaned.indexOf('{');
  if (jsonStart > 0) {
    cleaned = cleaned.substring(jsonStart);
  }
  
  // Remove any text after the last }
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonEnd > 0 && jsonEnd < cleaned.length - 1) {
    cleaned = cleaned.substring(0, jsonEnd + 1);
  }
  
  // Remove any remaining markdown or HTML
  cleaned = cleaned.replace(/[*_`~]/g, '');
  
  return cleaned.trim();
}

/**
 * Generate confidence score based on evidence
 */
export function calculateConfidence(
  averageSimilarity: number,
  documentCount: number,
  hasSpecificData: boolean
): number {
  // Base confidence from similarity
  let confidence = averageSimilarity;
  
  // Boost for multiple documents
  if (documentCount > 5) confidence += 0.1;
  if (documentCount > 10) confidence += 0.1;
  
  // Boost for specific quantified data
  if (hasSpecificData) confidence += 0.15;
  
  // Cap at 0.95 (never 100% certain)
  return Math.min(confidence, 0.95);
}