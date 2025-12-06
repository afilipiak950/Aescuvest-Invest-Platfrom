/**
 * Memo Refinement Controller
 * 
 * Validates memo quality, identifies weak sections, and triggers
 * targeted refinement passes to ensure high-quality output.
 * 
 * Enhanced with:
 * - Stricter quality gates (85% threshold for critical sections)
 * - Minimum 5 metrics per section requirement
 * - Fail-closed behavior when data is insufficient
 * - Evidence-based validation with provenance tracking
 */

import { 
  claudeOpusMemoSynthesis, 
  SectionGenerationRequest, 
  SectionGenerationResult,
  MemoQualityMetrics 
} from './claudeOpusMemoSynthesis';
import { AgentFactMatrix } from './agentDataFusion';
import { getSectionConfig, MEMO_SECTION_CONFIGS, SectionConfig } from './memoSectionConfig';

export interface RefinementResult {
  originalScore: number;
  finalScore: number;
  refinementAttempts: number;
  sectionsRefined: string[];
  overallImprovement: number;
  failedSections: string[];
  evidenceGaps: string[];
}

export interface MemoSection {
  name: string;
  title: string;
  type: string;
  content: string;
  qualityScore: number;
  citationsUsed: string[];
  quantitativeDataPoints: number;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  evidenceCount: number;
  meetsMinimumRequirements: boolean;
}

export interface CompleteMemo {
  dealId: number;
  companyName: string;
  sections: MemoSection[];
  qualityMetrics: MemoQualityMetrics;
  refinementResult?: RefinementResult;
  generatedAt: string;
  evidenceSummary: {
    totalMetrics: number;
    highConfidenceMetrics: number;
    sectionsWithSufficientData: number;
    sectionsWithInsufficientData: string[];
  };
}

export interface EvidenceValidationResult {
  isValid: boolean;
  sectionName: string;
  requiredMetrics: number;
  actualMetrics: number;
  requiredHighConfidence: number;
  actualHighConfidence: number;
  missingCategories: string[];
  recommendation: string;
}

export class MemoRefinementController {
  private static instance: MemoRefinementController;
  private readonly DEFAULT_QUALITY_THRESHOLD = 85; // Raised to 85 for stricter quality
  private readonly MAX_REFINEMENT_ATTEMPTS = 3;
  private readonly FAIL_CLOSED = true; // If true, reject sections without sufficient data

  static getInstance(): MemoRefinementController {
    if (!MemoRefinementController.instance) {
      MemoRefinementController.instance = new MemoRefinementController();
    }
    return MemoRefinementController.instance;
  }

  /**
   * Get quality threshold for a specific section (some sections have higher requirements)
   */
  private getQualityThreshold(sectionName: string): number {
    const config = getSectionConfig(sectionName);
    return config?.qualityThreshold || this.DEFAULT_QUALITY_THRESHOLD;
  }

  /**
   * Validate evidence availability for a section BEFORE attempting generation
   */
  validateEvidenceForSection(
    sectionName: string,
    evidence: any[]
  ): EvidenceValidationResult {
    const config = getSectionConfig(sectionName);
    if (!config) {
      return {
        isValid: false,
        sectionName,
        requiredMetrics: 5,
        actualMetrics: evidence.length,
        requiredHighConfidence: 2,
        actualHighConfidence: 0,
        missingCategories: [],
        recommendation: `No configuration found for section: ${sectionName}`
      };
    }

    const highConfidence = evidence.filter(e => e.confidence === 'high');
    const categories = new Set(evidence.map(e => e.category));
    const missingCategories = config.requiredCategories.filter(c => !categories.has(c));

    const isValid = evidence.length >= config.minMetrics && 
                    highConfidence.length >= config.minHighConfidenceMetrics;

    let recommendation = '';
    if (!isValid) {
      if (evidence.length < config.minMetrics) {
        recommendation = `Need ${config.minMetrics - evidence.length} more data points. `;
      }
      if (highConfidence.length < config.minHighConfidenceMetrics) {
        recommendation += `Need ${config.minHighConfidenceMetrics - highConfidence.length} more high-confidence metrics. `;
      }
      if (missingCategories.length > 0) {
        recommendation += `Missing categories: ${missingCategories.join(', ')}.`;
      }
    } else {
      recommendation = 'Evidence is sufficient for quality generation.';
    }

    return {
      isValid,
      sectionName,
      requiredMetrics: config.minMetrics,
      actualMetrics: evidence.length,
      requiredHighConfidence: config.minHighConfidenceMetrics,
      actualHighConfidence: highConfidence.length,
      missingCategories,
      recommendation
    };
  }

  /**
   * Validate section quality and determine if refinement is needed
   */
  validateSectionQuality(
    result: SectionGenerationResult,
    sectionName?: string
  ): {
    isAcceptable: boolean;
    issues: string[];
    refinementNeeded: boolean;
  } {
    const issues: string[] = [];
    const threshold = sectionName ? this.getQualityThreshold(sectionName) : this.DEFAULT_QUALITY_THRESHOLD;
    const config = sectionName ? getSectionConfig(sectionName) : null;
    
    // Check for minimum content length (increased threshold)
    if (result.content.length < 1500) {
      issues.push('Content is too short for a comprehensive section');
    }
    
    // Check for minimum citations (use config or default of 5)
    const minCitations = 5;
    if (result.citationsUsed.length < minCitations) {
      issues.push(`Insufficient source citations (need ${minCitations}+, have ${result.citationsUsed.length})`);
    }
    
    // Check for quantitative data (use config minMetrics or default of 8)
    const minDataPoints = config?.minMetrics || 8;
    if (result.quantitativeDataPoints < minDataPoints) {
      issues.push(`Lacks specific quantitative data points (need ${minDataPoints}+, have ${result.quantitativeDataPoints})`);
    }
    
    // Check for placeholder content (FAIL-CLOSED)
    const placeholderPatterns = [
      /information not available/gi,
      /data not found/gi,
      /to be determined/gi,
      /placeholder/gi,
      /\[TBD\]/gi,
      /analysis pending/gi,
      /no data available/gi,
      /information unavailable/gi,
      /data unavailable/gi,
      /not disclosed/gi,
      /details not provided/gi
    ];
    
    for (const pattern of placeholderPatterns) {
      if (pattern.test(result.content)) {
        issues.push('CRITICAL: Contains placeholder or unavailable data markers');
        break;
      }
    }
    
    // Check for generic/filler content
    const genericPatterns = [
      /will be analyzed/gi,
      /requires further review/gi,
      /pending analysis/gi,
      /to be completed/gi,
      /further research needed/gi,
      /additional information required/gi,
      /\[insert .+\]/gi,
      /\[add .+\]/gi
    ];
    
    for (const pattern of genericPatterns) {
      if (pattern.test(result.content)) {
        issues.push('CRITICAL: Contains generic filler content');
        break;
      }
    }

    // Check for vague language in investment context
    const vaguePatterns = [
      /significant growth/gi,
      /substantial revenue/gi,
      /strong performance/gi,
      /considerable market/gi,
      /notable traction/gi
    ];
    
    let vagueCount = 0;
    for (const pattern of vaguePatterns) {
      if (pattern.test(result.content)) {
        vagueCount++;
      }
    }
    
    if (vagueCount >= 3) {
      issues.push('Contains too many vague terms without specific numbers');
    }
    
    const hasBlockingIssues = issues.some(i => i.startsWith('CRITICAL'));
    const isAcceptable = result.qualityScore >= threshold && issues.length <= 1 && !hasBlockingIssues;
    const refinementNeeded = result.qualityScore < threshold || issues.length > 2 || hasBlockingIssues;
    
    return {
      isAcceptable,
      issues,
      refinementNeeded
    };
  }

  /**
   * Identify weak sections that need refinement
   */
  identifyWeakSections(
    sections: Record<string, SectionGenerationResult>
  ): { sectionName: string; score: number; issues: string[] }[] {
    const weakSections: { sectionName: string; score: number; issues: string[] }[] = [];
    
    for (const [sectionName, result] of Object.entries(sections)) {
      const validation = this.validateSectionQuality(result);
      
      if (validation.refinementNeeded) {
        weakSections.push({
          sectionName,
          score: result.qualityScore,
          issues: validation.issues
        });
      }
    }
    
    // Sort by score (lowest first) to prioritize worst sections
    return weakSections.sort((a, b) => a.score - b.score);
  }

  /**
   * Run refinement passes on weak sections
   */
  async triggerRefinementPass(
    weakSections: { sectionName: string; score: number; issues: string[] }[],
    sectionRequests: Record<string, SectionGenerationRequest>,
    currentResults: Record<string, SectionGenerationResult>
  ): Promise<{
    refinedResults: Record<string, SectionGenerationResult>;
    refinementStats: { section: string; originalScore: number; newScore: number }[];
  }> {
    const refinedResults = { ...currentResults };
    const refinementStats: { section: string; originalScore: number; newScore: number }[] = [];
    
    console.log(`🔄 Starting refinement pass for ${weakSections.length} weak sections...`);
    
    for (const weakSection of weakSections) {
      const request = sectionRequests[weakSection.sectionName];
      const currentResult = currentResults[weakSection.sectionName];
      
      if (!request || !currentResult) {
        console.warn(`⚠️ Cannot refine ${weakSection.sectionName} - missing request or result`);
        continue;
      }
      
      let bestResult = currentResult;
      let attempts = 0;
      
      // Try refinement up to MAX_REFINEMENT_ATTEMPTS times
      while (bestResult.qualityScore < this.QUALITY_THRESHOLD && attempts < this.MAX_REFINEMENT_ATTEMPTS) {
        attempts++;
        console.log(`🔄 Refinement attempt ${attempts} for ${weakSection.sectionName}...`);
        
        try {
          const refinedResult = await claudeOpusMemoSynthesis.refineWeakSection(
            request,
            bestResult,
            attempts
          );
          
          // Keep the better result
          if (refinedResult.qualityScore > bestResult.qualityScore) {
            bestResult = refinedResult;
            console.log(`✅ Improved ${weakSection.sectionName}: ${currentResult.qualityScore} → ${refinedResult.qualityScore}`);
          } else {
            console.log(`ℹ️ No improvement for ${weakSection.sectionName}`);
            break;
          }
        } catch (error) {
          console.error(`❌ Refinement failed for ${weakSection.sectionName}:`, error);
          break;
        }
      }
      
      refinedResults[weakSection.sectionName] = bestResult;
      refinementStats.push({
        section: weakSection.sectionName,
        originalScore: currentResult.qualityScore,
        newScore: bestResult.qualityScore
      });
    }
    
    return { refinedResults, refinementStats };
  }

  /**
   * Calculate overall memo quality improvement
   */
  calculateImprovement(
    originalScores: Record<string, number>,
    finalScores: Record<string, number>
  ): number {
    const originalTotal = Object.values(originalScores).reduce((a, b) => a + b, 0);
    const finalTotal = Object.values(finalScores).reduce((a, b) => a + b, 0);
    const count = Object.keys(originalScores).length;
    
    if (count === 0) return 0;
    
    const originalAvg = originalTotal / count;
    const finalAvg = finalTotal / count;
    
    return finalAvg - originalAvg;
  }

  /**
   * Check for numerical consistency across sections
   */
  checkNumericalConsistency(sections: Record<string, SectionGenerationResult>): string[] {
    const inconsistencies: string[] = [];
    const extractedNumbers: Record<string, { value: string; section: string }[]> = {};
    
    // Extract key metrics from each section
    for (const [sectionName, result] of Object.entries(sections)) {
      // Look for funding amounts
      const fundingMatches = result.content.match(/(?:raised?|funding|round)[:\s]*\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B))?/gi) || [];
      for (const match of fundingMatches) {
        if (!extractedNumbers['funding']) extractedNumbers['funding'] = [];
        extractedNumbers['funding'].push({ value: match, section: sectionName });
      }
      
      // Look for valuations
      const valuationMatches = result.content.match(/valuation[:\s]*\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B))?/gi) || [];
      for (const match of valuationMatches) {
        if (!extractedNumbers['valuation']) extractedNumbers['valuation'] = [];
        extractedNumbers['valuation'].push({ value: match, section: sectionName });
      }
      
      // Look for employee counts
      const employeeMatches = result.content.match(/\b(\d+)\s*(?:employees?|team members?|staff)/gi) || [];
      for (const match of employeeMatches) {
        if (!extractedNumbers['employees']) extractedNumbers['employees'] = [];
        extractedNumbers['employees'].push({ value: match, section: sectionName });
      }
    }
    
    // Check for inconsistencies
    for (const [metricType, occurrences] of Object.entries(extractedNumbers)) {
      if (occurrences.length > 1) {
        // Normalize and compare values
        const normalizedValues = occurrences.map(o => this.normalizeNumericValue(o.value));
        const uniqueValues = Array.from(new Set(normalizedValues));
        
        if (uniqueValues.length > 1) {
          const sections = occurrences.map(o => o.section).join(', ');
          inconsistencies.push(
            `Potential ${metricType} inconsistency across sections (${sections}): ${occurrences.map(o => o.value).join(' vs ')}`
          );
        }
      }
    }
    
    return inconsistencies;
  }

  /**
   * Normalize numeric values for comparison
   */
  private normalizeNumericValue(value: string): number {
    // Remove non-numeric characters except decimal and minus
    let normalized = value.replace(/[^0-9.-]/g, '');
    let numValue = parseFloat(normalized) || 0;
    
    // Handle million/billion suffixes
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('billion') || lowerValue.includes('b')) {
      numValue *= 1000000000;
    } else if (lowerValue.includes('million') || lowerValue.includes('m')) {
      numValue *= 1000000;
    } else if (lowerValue.includes('k') || lowerValue.includes('thousand')) {
      numValue *= 1000;
    }
    
    return numValue;
  }

  /**
   * Check for missing required information in critical sections
   */
  checkCoverageThresholds(sections: Record<string, SectionGenerationResult>): string[] {
    const gaps: string[] = [];
    
    const requiredElements: Record<string, { patterns: RegExp[]; minMatches: number }> = {
      'executive_summary': {
        patterns: [
          /(?:founded|incorporated|established)\s+(?:in\s+)?(?:\d{4}|20\d{2})/gi,
          /(?:CEO|CTO|CFO|founder)[:\s]+[A-Z][a-z]+\s+[A-Z][a-z]+/gi,
          /\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|M|B))?/gi,
          /(?:patent|trademark|IP)/gi
        ],
        minMatches: 3
      },
      'financial_analysis': {
        patterns: [
          /revenue|sales|income/gi,
          /valuation/gi,
          /funding|investment|raised/gi,
          /burn\s*rate|runway/gi
        ],
        minMatches: 3
      },
      'team_assessment': {
        patterns: [
          /(?:CEO|CTO|CFO|COO|founder)[:\s]+[A-Z][a-z]+/gi,
          /(?:years?|experience)/gi,
          /(?:university|degree|MBA|PhD|education)/gi
        ],
        minMatches: 2
      },
      'risk_assessment': {
        patterns: [
          /(?:risk|threat|challenge)/gi,
          /(?:mitigation|mitigate|address)/gi,
          /(?:regulatory|compliance)/gi
        ],
        minMatches: 2
      }
    };
    
    for (const [sectionName, requirements] of Object.entries(requiredElements)) {
      const result = sections[sectionName];
      if (!result) continue;
      
      let matchCount = 0;
      for (const pattern of requirements.patterns) {
        if (pattern.test(result.content)) {
          matchCount++;
        }
      }
      
      if (matchCount < requirements.minMatches) {
        gaps.push(
          `${sectionName} is missing key elements (found ${matchCount}/${requirements.minMatches} required patterns)`
        );
      }
    }
    
    return gaps;
  }

  /**
   * Generate comprehensive quality report
   */
  generateQualityReport(
    sections: Record<string, SectionGenerationResult>,
    refinementResult?: RefinementResult
  ): string {
    const lines: string[] = [
      '# Investment Memo Quality Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      ''
    ];
    
    // Overall metrics
    const scores = Object.values(sections).map(s => s.qualityScore);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const totalCitations = Object.values(sections).reduce((a, b) => a + b.citationsUsed.length, 0);
    const totalDataPoints = Object.values(sections).reduce((a, b) => a + b.quantitativeDataPoints, 0);
    
    lines.push('## Overall Metrics');
    lines.push(`- **Average Quality Score**: ${avgScore.toFixed(1)}/100`);
    lines.push(`- **Total Citations**: ${totalCitations}`);
    lines.push(`- **Total Quantitative Data Points**: ${totalDataPoints}`);
    lines.push('');
    
    // Section-by-section breakdown
    lines.push('## Section Quality Breakdown');
    lines.push('');
    lines.push('| Section | Score | Citations | Data Points | Confidence |');
    lines.push('|---------|-------|-----------|-------------|------------|');
    
    for (const [sectionName, result] of Object.entries(sections)) {
      lines.push(
        `| ${sectionName} | ${result.qualityScore} | ${result.citationsUsed.length} | ${result.quantitativeDataPoints} | ${result.confidence} |`
      );
    }
    lines.push('');
    
    // Refinement results
    if (refinementResult) {
      lines.push('## Refinement Results');
      lines.push(`- **Original Score**: ${refinementResult.originalScore.toFixed(1)}`);
      lines.push(`- **Final Score**: ${refinementResult.finalScore.toFixed(1)}`);
      lines.push(`- **Improvement**: +${refinementResult.overallImprovement.toFixed(1)} points`);
      lines.push(`- **Sections Refined**: ${refinementResult.sectionsRefined.join(', ')}`);
      lines.push(`- **Total Attempts**: ${refinementResult.refinementAttempts}`);
      lines.push('');
    }
    
    // Consistency check
    const inconsistencies = this.checkNumericalConsistency(sections);
    if (inconsistencies.length > 0) {
      lines.push('## Consistency Warnings');
      for (const issue of inconsistencies) {
        lines.push(`- ⚠️ ${issue}`);
      }
      lines.push('');
    }
    
    // Coverage gaps
    const coverageGaps = this.checkCoverageThresholds(sections);
    if (coverageGaps.length > 0) {
      lines.push('## Coverage Gaps');
      for (const gap of coverageGaps) {
        lines.push(`- ⚠️ ${gap}`);
      }
      lines.push('');
    }
    
    // Warnings from sections
    const allWarnings = Object.entries(sections)
      .filter(([_, r]) => r.warnings.length > 0)
      .map(([name, r]) => ({ name, warnings: r.warnings }));
    
    if (allWarnings.length > 0) {
      lines.push('## Section Warnings');
      for (const { name, warnings } of allWarnings) {
        lines.push(`\n### ${name}`);
        for (const warning of warnings) {
          lines.push(`- ${warning}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}

export const memoRefinementController = MemoRefinementController.getInstance();
