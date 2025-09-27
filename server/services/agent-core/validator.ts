import { z } from "zod";
import { 
  AgentAnswerBaseSchema,
  LegalAnswerSchema,
  ClinicalAnswerSchema,
  CommercialAnswerSchema,
  HRAnswerSchema,
  FinancialAnswerSchema,
  IPAnswerSchema,
  ResearchAnswerSchema
} from "@shared/schema";

export interface ValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
  confidenceAdjustment?: number;
}

/**
 * Get the appropriate schema for an agent type
 */
export function getAgentSchema(agentType: string): z.ZodSchema<any> {
  const schemas: Record<string, z.ZodSchema<any>> = {
    legal: LegalAnswerSchema,
    clinical: ClinicalAnswerSchema,
    commercial: CommercialAnswerSchema,
    hr: HRAnswerSchema,
    financial: FinancialAnswerSchema,
    ip: IPAnswerSchema,
    research: ResearchAnswerSchema,
  };

  return schemas[agentType] || AgentAnswerBaseSchema;
}

/**
 * Validate agent answer against schema
 */
export function validateAgentAnswer<T = any>(
  data: any,
  agentType: string
): ValidationResult<T> {
  const schema = getAgentSchema(agentType);
  
  try {
    const validated = schema.parse(data);
    
    // Additional validation logic
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check answer quality
    if (!validated.answer || validated.answer.length < 50) {
      errors.push("Answer is too brief or missing");
    }
    
    // Check confidence alignment
    if (validated.confidence > 0.8 && (!validated.sources || validated.sources.length < 2)) {
      warnings.push("High confidence with limited sources");
      validated.confidence = Math.min(validated.confidence, 0.6);
    }
    
    // Check source quality
    if (validated.sources) {
      const validSources = validated.sources.filter((s: any) => 
        s.documentName && s.snippet && s.snippet.length > 20
      );
      
      if (validSources.length < validated.sources.length) {
        warnings.push(`${validated.sources.length - validSources.length} sources have incomplete information`);
        validated.sources = validSources;
      }
    }
    
    // Check findings and recommendations
    if (validated.confidence > 0.5) {
      if (!validated.keyFindings || validated.keyFindings.length === 0) {
        warnings.push("No key findings despite reasonable confidence");
      }
      if (!validated.recommendations || validated.recommendations.length === 0) {
        warnings.push("No recommendations provided");
      }
    }
    
    return {
      isValid: errors.length === 0,
      data: validated as T,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return {
        isValid: false,
        errors,
      };
    }
    
    return {
      isValid: false,
      errors: [error.message || "Unknown validation error"],
    };
  }
}

/**
 * Calculate confidence based on evidence quality
 */
export function calibrateConfidence(
  baseConfidence: number,
  evidenceFactors: {
    documentCount: number;
    averageSimilarity: number;
    hasSpecificData: boolean;
    sourceConsistency: number; // 0-1 score for source agreement
    answerCompleteness: number; // 0-1 score for answer completeness
  }
): number {
  let adjustedConfidence = baseConfidence;
  
  const {
    documentCount,
    averageSimilarity,
    hasSpecificData,
    sourceConsistency,
    answerCompleteness,
  } = evidenceFactors;
  
  // Adjust based on document count
  if (documentCount < 2) {
    adjustedConfidence *= 0.7; // Reduce confidence for single source
  } else if (documentCount > 5) {
    adjustedConfidence *= 1.1; // Boost for multiple sources
  }
  
  // Adjust based on similarity
  if (averageSimilarity < 0.3) {
    adjustedConfidence *= 0.8; // Low relevance penalty
  } else if (averageSimilarity > 0.6) {
    adjustedConfidence *= 1.15; // High relevance boost
  }
  
  // Adjust based on specific data
  if (hasSpecificData) {
    adjustedConfidence *= 1.2; // Boost for quantified data
  }
  
  // Adjust based on source consistency
  adjustedConfidence *= (0.7 + 0.3 * sourceConsistency); // 70-100% based on consistency
  
  // Adjust based on answer completeness
  adjustedConfidence *= (0.8 + 0.2 * answerCompleteness); // 80-100% based on completeness
  
  // Ensure confidence is within bounds
  return Math.max(0.1, Math.min(0.95, adjustedConfidence));
}

/**
 * Perform self-check on the answer
 */
export async function selfCheckAnswer(
  answer: any,
  question: string,
  agentType: string
): Promise<{
  passed: boolean;
  issues: string[];
  suggestions: string[];
  confidenceAdjustment: number;
}> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidenceAdjustment = 1.0;
  
  // Check if answer addresses the question
  const questionKeywords = question.toLowerCase().split(/\W+/);
  const answerText = (answer.answer || "").toLowerCase();
  const addressedKeywords = questionKeywords.filter(kw => 
    kw.length > 3 && answerText.includes(kw)
  );
  
  const addressRate = addressedKeywords.length / questionKeywords.filter(kw => kw.length > 3).length;
  if (addressRate < 0.5) {
    issues.push("Answer may not fully address the question");
    suggestions.push("Ensure all aspects of the question are covered");
    confidenceAdjustment *= 0.8;
  }
  
  // Check for speculative language
  const speculativeTerms = [
    "might", "could", "possibly", "perhaps", "maybe", "seems", "appears",
    "likely", "probably", "presumably", "suggests", "indicates"
  ];
  
  const speculativeCount = speculativeTerms.filter(term => 
    answerText.includes(term)
  ).length;
  
  if (speculativeCount > 3) {
    issues.push("Answer contains significant speculation");
    suggestions.push("Focus on concrete evidence-based statements");
    confidenceAdjustment *= 0.85;
  }
  
  // Check for domain-specific requirements
  const domainChecks = performDomainSpecificChecks(answer, agentType);
  issues.push(...domainChecks.issues);
  suggestions.push(...domainChecks.suggestions);
  confidenceAdjustment *= domainChecks.confidenceMultiplier;
  
  // Check internal consistency
  if (answer.confidence > 0.7 && answer.riskScore && answer.riskScore > 7) {
    issues.push("High confidence conflicts with high risk score");
    suggestions.push("Reconcile confidence level with identified risks");
    confidenceAdjustment *= 0.9;
  }
  
  return {
    passed: issues.length === 0,
    issues,
    suggestions,
    confidenceAdjustment,
  };
}

/**
 * Perform domain-specific validation checks
 */
function performDomainSpecificChecks(
  answer: any,
  agentType: string
): {
  issues: string[];
  suggestions: string[];
  confidenceMultiplier: number;
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidenceMultiplier = 1.0;
  
  switch (agentType) {
    case 'legal':
      // Check for specific legal terms
      if (!answer.answer.match(/\b(agreement|contract|liability|clause|term)\b/i)) {
        issues.push("Legal analysis lacks specific legal terminology");
        suggestions.push("Include specific contract terms and legal provisions");
        confidenceMultiplier *= 0.85;
      }
      break;
      
    case 'clinical':
      // Check for clinical data
      if (!answer.answer.match(/\b(phase|trial|patient|endpoint|FDA|safety|efficacy)\b/i)) {
        issues.push("Clinical analysis lacks medical/regulatory terminology");
        suggestions.push("Include specific clinical trial data and regulatory context");
        confidenceMultiplier *= 0.85;
      }
      break;
      
    case 'commercial':
      // Check for market data
      if (!answer.answer.match(/\b(market|customer|revenue|competition|growth)\b/i)) {
        issues.push("Commercial analysis lacks market-specific data");
        suggestions.push("Include market size, growth rates, and competitive positioning");
        confidenceMultiplier *= 0.85;
      }
      break;
      
    case 'financial':
      // Check for financial metrics
      if (!answer.answer.match(/\$[\d,]+|[\d,]+%|\b(revenue|burn|runway|valuation)\b/i)) {
        issues.push("Financial analysis lacks quantified metrics");
        suggestions.push("Include specific financial figures and metrics");
        confidenceMultiplier *= 0.8;
      }
      break;
      
    case 'hr':
      // Check for organizational data
      if (!answer.answer.match(/\b(team|employee|compensation|culture|talent)\b/i)) {
        issues.push("HR analysis lacks organizational specifics");
        suggestions.push("Include team structure, compensation data, and cultural assessments");
        confidenceMultiplier *= 0.85;
      }
      break;
      
    case 'ip':
      // Check for IP terminology
      if (!answer.answer.match(/\b(patent|trademark|intellectual property|licensing|freedom)\b/i)) {
        issues.push("IP analysis lacks intellectual property specifics");
        suggestions.push("Include patent details, IP portfolio assessment, and licensing terms");
        confidenceMultiplier *= 0.85;
      }
      break;
      
    case 'research':
      // Check for research depth
      if (!answer.answer.match(/\b(trend|analysis|data|study|research|finding)\b/i)) {
        issues.push("Research analysis lacks analytical depth");
        suggestions.push("Include industry trends, competitive analysis, and market insights");
        confidenceMultiplier *= 0.85;
      }
      break;
  }
  
  return { issues, suggestions, confidenceMultiplier };
}

/**
 * Merge multiple validation results
 */
export function mergeValidationResults(
  results: ValidationResult[]
): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let totalConfidenceAdjustment = 1.0;
  
  for (const result of results) {
    if (result.errors) {
      allErrors.push(...result.errors);
    }
    if (result.warnings) {
      allWarnings.push(...result.warnings);
    }
    if (result.confidenceAdjustment) {
      totalConfidenceAdjustment *= result.confidenceAdjustment;
    }
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors.length > 0 ? allErrors : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    confidenceAdjustment: totalConfidenceAdjustment,
  };
}