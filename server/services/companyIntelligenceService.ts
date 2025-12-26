import { storage } from '../storage';

export interface DataCompletenessSection {
  name: string;
  hasData: boolean;
  dataPoints: number;
  sources: string[];
  lastUpdated?: string;
}

export interface UnifiedCompanyIntelligence {
  dealId: number;
  companyName: string;
  website?: string;
  sector?: string;
  stage?: string;
  
  dataCompleteness: {
    overallScore: number;
    sections: DataCompletenessSection[];
    missingCritical: string[];
    lastFullUpdate?: string;
  };
  
  executiveTeam: {
    ceo?: {
      name: string;
      background?: string;
      experience?: string;
      education?: string;
      previousCompanies?: string[];
      linkedinUrl?: string;
      source: string;
    };
    keyMembers?: Array<{
      name: string;
      role: string;
      background?: string;
      source: string;
    }>;
    teamStrengths?: string[];
    teamRisks?: string[];
  };
  
  financialIntelligence: {
    revenue?: string;
    valuation?: string;
    fundingAmount?: string;
    fundingHistory?: Array<{
      round: string;
      amount: string;
      date: string;
      investors?: string[];
      source: string;
    }>;
    employeeCount?: string;
    growthRate?: string;
    burnRate?: string;
    runway?: string;
    financialStrengths?: string[];
    financialRisks?: string[];
    sources: string[];
  };
  
  marketAnalysis: {
    marketSize?: string;
    marketPosition?: string;
    competitors?: string[];
    competitiveAdvantages?: string[];
    customerSegments?: string[];
    businessModel?: string;
    marketOpportunity?: string;
    sources: string[];
  };
  
  riskAssessment: {
    overallRiskLevel: 'low' | 'medium' | 'high' | 'unknown';
    regulatory?: string[];
    competitive?: string[];
    financial?: string[];
    operational?: string[];
    clinical?: string[];
    legal?: string[];
    ip?: string[];
    sources: string[];
  };
  
  investmentHighlights: {
    keyStrengths: string[];
    keyRisks: string[];
    traction?: string[];
    differentiators?: string[];
    investmentThesis?: string[];
    sources: string[];
  };
  
  aiScoring: {
    overallScore?: number;
    confidence?: number;
    criteriaScores?: Array<{
      name: string;
      score: number;
      weight: number;
      reasoning?: string;
    }>;
    recommendation?: string;
    lastEvaluated?: string;
  };
  
  agentInsights: {
    legal?: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    };
    clinical?: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    };
    commercial?: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    };
    financial?: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    };
    hr?: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    };
    ip?: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    };
    research?: {
      status: string;
      keyFindings: string[];
      risks: string[];
      lastAnalyzed?: string;
    };
  };
  
  externalLinks: {
    website?: string;
    pitchbookUrl?: string;
    crunchbaseUrl?: string;
    linkedinCompanyUrl?: string;
    northdataUrl?: string;
  };
  
  metadata: {
    researchStatus: 'pending' | 'processing' | 'complete' | 'error';
    lastResearchUpdate?: string;
    sourcesCount: number;
    qualityScore: number;
  };
}

class CompanyIntelligenceService {
  
  async getUnifiedIntelligence(dealId: number): Promise<UnifiedCompanyIntelligence | null> {
    try {
      console.log(`🧠 Building unified intelligence for deal ${dealId}`);
      
      const deal = await storage.getDealById(dealId);
      if (!deal) {
        console.log(`❌ Deal ${dealId} not found`);
        return null;
      }
      
      const [
        researchData,
        agentAnalyses,
        comprehensiveAnalysis,
        evaluationResults,
        evaluationCriteria
      ] = await Promise.all([
        this.getResearchData(dealId),
        storage.getAnalysesByDealId(dealId),
        storage.getComprehensiveAnalysis(dealId),
        storage.getEvaluationResultsByDealId(dealId),
        storage.getAllEvaluationCriteria()
      ]);
      
      const intelligence = this.buildUnifiedIntelligence(
        deal,
        researchData,
        agentAnalyses,
        comprehensiveAnalysis,
        evaluationResults,
        evaluationCriteria
      );
      
      console.log(`✅ Unified intelligence built for deal ${dealId} - Quality Score: ${intelligence.metadata.qualityScore}%`);
      return intelligence;
      
    } catch (error) {
      console.error(`❌ Error building unified intelligence for deal ${dealId}:`, error);
      throw error;
    }
  }
  
  private async getResearchData(dealId: number): Promise<any> {
    try {
      // Use getCompanyResearchRawByDealId to get the parsed JSON fields (ceoProfile, investmentHighlights, etc.)
      // instead of getCompanyResearchByDealId which returns flat text format
      const research = await storage.getCompanyResearchRawByDealId(dealId);
      if (research) {
        console.log(`✅ Research data found for deal ${dealId} from companyResearch table (raw JSON fields)`);
        console.log(`   - ceoProfile: ${research.ceoProfile ? 'present' : 'missing'}`);
        console.log(`   - investmentHighlights: ${research.investmentHighlights ? 'present' : 'missing'}`);
        console.log(`   - marketAnalysis: ${research.marketAnalysis ? 'present' : 'missing'}`);
        console.log(`   - aiAnalysis: ${research.aiAnalysis ? 'present' : 'missing'}`);
        return research;
      }
      console.log(`⚠️ No research data found for deal ${dealId} - returning null`);
      return null;
    } catch (error) {
      console.log(`⚠️ Error fetching research data for deal ${dealId}:`, error);
      return null;
    }
  }
  
  private normalizeAgentStatus(status: string | undefined | null): string {
    if (!status) return 'Pending';
    const s = status.toLowerCase();
    if (s === 'completed' || s === 'success' || s === 'done') return 'Completed';
    if (s === 'failed' || s === 'error') return 'Failed';
    if (s === 'processing' || s === 'running' || s === 'in_progress') return 'Processing';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
  
  private buildUnifiedIntelligence(
    deal: any,
    researchData: any,
    agentAnalyses: any[],
    comprehensiveAnalysis: any,
    evaluationResults: any[],
    evaluationCriteria: any[]
  ): UnifiedCompanyIntelligence {
    
    const sections: DataCompletenessSection[] = [];
    let sourcesCount = 0;
    
    const executiveTeam = this.extractExecutiveTeam(researchData, agentAnalyses);
    const execHasData = !!executiveTeam.ceo || (executiveTeam.keyMembers?.length || 0) > 0;
    const execTeamSources = execHasData && executiveTeam.ceo?.source ? [executiveTeam.ceo.source] : [];
    sections.push({
      name: 'Executive Team',
      hasData: execHasData,
      dataPoints: this.countDataPoints(executiveTeam),
      sources: execTeamSources
    });
    if (execHasData) sourcesCount += execTeamSources.length;
    
    const financialIntelligence = this.extractFinancialIntelligence(deal, researchData, agentAnalyses);
    const financialHasData = !!financialIntelligence.fundingAmount || !!financialIntelligence.revenue || !!financialIntelligence.valuation || (financialIntelligence.fundingHistory?.length || 0) > 0;
    sections.push({
      name: 'Financial Intelligence',
      hasData: financialHasData,
      dataPoints: this.countDataPoints(financialIntelligence),
      sources: financialHasData ? financialIntelligence.sources : []
    });
    if (financialHasData) sourcesCount += financialIntelligence.sources.length;
    
    const marketAnalysis = this.extractMarketAnalysis(researchData, agentAnalyses);
    const marketHasData = !!marketAnalysis.marketSize || (marketAnalysis.competitors?.length || 0) > 0;
    sections.push({
      name: 'Market Analysis',
      hasData: marketHasData,
      dataPoints: this.countDataPoints(marketAnalysis),
      sources: marketHasData ? marketAnalysis.sources : []
    });
    if (marketHasData) sourcesCount += marketAnalysis.sources.length;
    
    const riskAssessment = this.extractRiskAssessment(researchData, agentAnalyses);
    const riskHasData = riskAssessment.overallRiskLevel !== 'unknown';
    sections.push({
      name: 'Risk Assessment',
      hasData: riskHasData,
      dataPoints: this.countRisks(riskAssessment),
      sources: riskHasData ? riskAssessment.sources : []
    });
    if (riskHasData) sourcesCount += riskAssessment.sources.length;
    
    const investmentHighlights = this.extractInvestmentHighlights(researchData, agentAnalyses);
    const investmentHasData = investmentHighlights.keyStrengths.length > 0 || investmentHighlights.keyRisks.length > 0;
    sections.push({
      name: 'Investment Highlights',
      hasData: investmentHasData,
      dataPoints: investmentHighlights.keyStrengths.length + investmentHighlights.keyRisks.length,
      sources: investmentHasData ? investmentHighlights.sources : []
    });
    if (investmentHasData) sourcesCount += investmentHighlights.sources.length;
    
    const aiScoring = this.extractAIScoring(deal, evaluationResults, evaluationCriteria);
    const aiScoringSources = aiScoring.overallScore !== undefined ? ['AI Evaluation Engine'] : [];
    sections.push({
      name: 'AI Scoring',
      hasData: aiScoring.overallScore !== undefined,
      dataPoints: aiScoring.criteriaScores?.length || 0,
      sources: aiScoringSources
    });
    sourcesCount += aiScoringSources.length;
    
    const agentInsights = this.extractAgentInsights(agentAnalyses);
    const agentsWithData = Object.entries(agentInsights).filter(([_, agent]) => {
      if (!agent || agent.status !== 'Completed') return false;
      const hasFindings = agent.keyFindings && agent.keyFindings.length > 0;
      const hasRisks = agent.risks && agent.risks.length > 0;
      return hasFindings || hasRisks;
    });
    const agentCount = agentsWithData.length;
    const agentSources = agentsWithData.map(([k, _]) => `${k.charAt(0).toUpperCase() + k.slice(1)} Agent`);
    sections.push({
      name: 'Agent Analyses',
      hasData: agentCount > 0,
      dataPoints: agentCount,
      sources: agentSources
    });
    sourcesCount += agentSources.length;
    
    const externalLinks = this.extractExternalLinks(deal, researchData);
    
    const completedSections = sections.filter(s => s.hasData).length;
    const overallScore = Math.round((completedSections / sections.length) * 100);
    
    const missingCritical: string[] = [];
    if (!executiveTeam.ceo?.name) missingCritical.push('CEO Information');
    if (!financialIntelligence.fundingAmount && !financialIntelligence.revenue) missingCritical.push('Financial Data');
    if (!marketAnalysis.marketSize) missingCritical.push('Market Size');
    if (investmentHighlights.keyStrengths.length === 0) missingCritical.push('Key Strengths');
    
    const qualityScore = this.calculateQualityScore(sections, missingCritical.length);
    
    return {
      dealId: deal.id,
      companyName: deal.companyName,
      website: deal.website,
      sector: deal.sector,
      stage: deal.stage,
      
      dataCompleteness: {
        overallScore,
        sections,
        missingCritical,
        lastFullUpdate: researchData?.lastUpdated || deal.updatedAt?.toISOString()
      },
      
      executiveTeam,
      financialIntelligence,
      marketAnalysis,
      riskAssessment,
      investmentHighlights,
      aiScoring,
      agentInsights,
      externalLinks,
      
      metadata: {
        researchStatus: researchData ? (researchData.researchStatus || 'complete') : 'pending',
        lastResearchUpdate: researchData?.lastUpdated,
        sourcesCount: Math.max(sourcesCount, 1),
        qualityScore
      }
    };
  }
  
  private extractExecutiveTeam(researchData: any, agentAnalyses: any[]): UnifiedCompanyIntelligence['executiveTeam'] {
    const result: UnifiedCompanyIntelligence['executiveTeam'] = {};
    
    if (researchData?.ceoProfile) {
      result.ceo = {
        name: researchData.ceoProfile.name,
        background: researchData.ceoProfile.background,
        experience: researchData.ceoProfile.experience,
        education: researchData.ceoProfile.education,
        previousCompanies: researchData.ceoProfile.previousCompanies || [],
        linkedinUrl: researchData.ceoProfile.linkedinUrl,
        source: 'Company Research'
      };
    }
    
    if (researchData?.keyTeamMembers) {
      result.keyMembers = researchData.keyTeamMembers.map((m: any) => ({
        name: m.name,
        role: m.role,
        background: m.background,
        source: 'Company Research'
      }));
    }
    
    const hrAnalysis = agentAnalyses.find(a => a.agentType?.toLowerCase() === 'hr');
    if (hrAnalysis?.findings?.length > 0) {
      result.teamStrengths = hrAnalysis.findings.slice(0, 5);
    }
    if (hrAnalysis?.recommendations?.length > 0) {
      result.teamRisks = hrAnalysis.recommendations.slice(0, 3);
    }
    
    return result;
  }
  
  private extractFinancialIntelligence(deal: any, researchData: any, agentAnalyses: any[]): UnifiedCompanyIntelligence['financialIntelligence'] {
    const sources: string[] = [];
    const result: UnifiedCompanyIntelligence['financialIntelligence'] = { sources };
    
    if (deal.fundingAmount) {
      result.fundingAmount = `$${(deal.fundingAmount / 1000000).toFixed(1)}M`;
      sources.push('Deal Data');
    }
    
    if (researchData?.financialData || researchData?.financialInsights) {
      const fd = researchData.financialData || researchData.financialInsights;
      result.revenue = fd.revenue;
      result.valuation = fd.valuation;
      result.employeeCount = fd.employeeCount;
      result.growthRate = fd.growthRate || fd.financialMetrics?.growthRate;
      result.burnRate = fd.burnRate || fd.financialMetrics?.burnRate;
      result.runway = fd.runway || fd.financialMetrics?.runway;
      
      if (fd.fundingHistory?.length > 0) {
        result.fundingHistory = fd.fundingHistory.map((f: any) => ({
          ...f,
          source: 'Company Research'
        }));
      }
      sources.push('Company Research');
    }
    
    const financialAnalysis = agentAnalyses.find(a => a.agentType?.toLowerCase() === 'financial');
    if (financialAnalysis) {
      if (financialAnalysis.findings?.length > 0) {
        result.financialStrengths = financialAnalysis.findings.slice(0, 5);
      }
      if (financialAnalysis.recommendations?.length > 0) {
        result.financialRisks = financialAnalysis.recommendations.slice(0, 3);
      }
      sources.push('Financial Agent');
    }
    
    return result;
  }
  
  private extractMarketAnalysis(researchData: any, agentAnalyses: any[]): UnifiedCompanyIntelligence['marketAnalysis'] {
    const sources: string[] = [];
    const result: UnifiedCompanyIntelligence['marketAnalysis'] = { sources };
    
    if (researchData?.marketAnalysis) {
      const ma = researchData.marketAnalysis;
      result.marketSize = ma.marketSize;
      result.marketPosition = ma.marketPosition;
      result.competitors = ma.competitors;
      result.customerSegments = ma.customerSegments;
      result.marketOpportunity = ma.uniqueValueProposition;
      sources.push('Company Research');
    }
    
    if (researchData?.businessIntelligence) {
      result.businessModel = researchData.businessIntelligence.businessModel;
      if (!result.competitors) {
        result.competitors = researchData.businessIntelligence.competitors;
      }
    }
    
    const commercialAnalysis = agentAnalyses.find(a => a.agentType?.toLowerCase() === 'commercial');
    if (commercialAnalysis) {
      if (commercialAnalysis.findings?.length > 0) {
        result.competitiveAdvantages = commercialAnalysis.findings.slice(0, 5);
      }
      sources.push('Commercial Agent');
    }
    
    return result;
  }
  
  private extractRiskAssessment(researchData: any, agentAnalyses: any[]): UnifiedCompanyIntelligence['riskAssessment'] {
    const sources: string[] = [];
    const result: UnifiedCompanyIntelligence['riskAssessment'] = { 
      overallRiskLevel: 'unknown',
      sources 
    };
    
    if (researchData?.riskFactors || researchData?.riskAssessment) {
      const rf = researchData.riskFactors || researchData.riskAssessment;
      result.regulatory = rf.regulatory || rf.regulatoryRisks;
      result.competitive = rf.competitive || rf.competitiveRisks;
      result.financial = rf.financial || rf.marketRisks;
      result.operational = rf.operational || rf.executionRisks;
      result.overallRiskLevel = rf.riskLevel || 'medium';
      sources.push('Company Research');
    }
    
    const legalAnalysis = agentAnalyses.find(a => a.agentType?.toLowerCase() === 'legal');
    if (legalAnalysis?.recommendations?.length > 0) {
      result.legal = legalAnalysis.recommendations.slice(0, 5);
      sources.push('Legal Agent');
    }
    
    const clinicalAnalysis = agentAnalyses.find(a => a.agentType?.toLowerCase() === 'clinical');
    if (clinicalAnalysis?.recommendations?.length > 0) {
      result.clinical = clinicalAnalysis.recommendations.slice(0, 5);
      sources.push('Clinical Agent');
    }
    
    const ipAnalysis = agentAnalyses.find(a => a.agentType?.toLowerCase() === 'ip');
    if (ipAnalysis?.recommendations?.length > 0) {
      result.ip = ipAnalysis.recommendations.slice(0, 5);
      sources.push('IP Agent');
    }
    
    const totalRisks = this.countRisks(result);
    if (totalRisks === 0) {
      result.overallRiskLevel = 'unknown';
    } else if (totalRisks <= 5) {
      result.overallRiskLevel = 'low';
    } else if (totalRisks <= 12) {
      result.overallRiskLevel = 'medium';
    } else {
      result.overallRiskLevel = 'high';
    }
    
    return result;
  }
  
  private extractInvestmentHighlights(researchData: any, agentAnalyses: any[]): UnifiedCompanyIntelligence['investmentHighlights'] {
    const sources: string[] = [];
    const keyStrengths: string[] = [];
    const keyRisks: string[] = [];
    
    if (researchData?.investmentHighlights) {
      const ih = researchData.investmentHighlights;
      if (ih.traction) keyStrengths.push(...ih.traction.slice(0, 3));
      if (ih.competitiveAdvantages) keyStrengths.push(...ih.competitiveAdvantages.slice(0, 3));
      if (ih.growthMetrics) keyStrengths.push(...ih.growthMetrics.slice(0, 2));
      sources.push('Company Research');
    }
    
    if (researchData?.aiAnalysis) {
      if (researchData.aiAnalysis.keyStrengths) {
        keyStrengths.push(...researchData.aiAnalysis.keyStrengths);
      }
      if (researchData.aiAnalysis.keyRisks) {
        keyRisks.push(...researchData.aiAnalysis.keyRisks);
      }
    }
    
    for (const analysis of agentAnalyses) {
      if (analysis.findings?.length > 0) {
        keyStrengths.push(...analysis.findings.slice(0, 2).map((f: string) => 
          `[${analysis.agentType}] ${f}`
        ));
      }
      if (analysis.recommendations?.length > 0) {
        keyRisks.push(...analysis.recommendations.slice(0, 1).map((r: string) => 
          `[${analysis.agentType}] ${r}`
        ));
      }
      if (analysis.status === 'Completed') {
        sources.push(`${analysis.agentType} Agent`);
      }
    }
    
    return {
      keyStrengths: Array.from(new Set(keyStrengths)).slice(0, 10),
      keyRisks: Array.from(new Set(keyRisks)).slice(0, 8),
      traction: researchData?.investmentHighlights?.traction,
      differentiators: researchData?.investmentHighlights?.competitiveAdvantages,
      investmentThesis: researchData?.aiAnalysis?.nextSteps,
      sources: Array.from(new Set(sources))
    };
  }
  
  private extractAIScoring(deal: any, evaluationResults: any[], evaluationCriteria: any[]): UnifiedCompanyIntelligence['aiScoring'] {
    const result: UnifiedCompanyIntelligence['aiScoring'] = {};
    
    if (deal.aiScore) {
      result.overallScore = deal.aiScore;
    }
    
    if (evaluationResults.length > 0 && evaluationCriteria.length > 0) {
      result.criteriaScores = evaluationResults.map((er: any) => {
        const criteria = evaluationCriteria.find((c: any) => c.id === er.criteriaId);
        return {
          name: criteria?.name || 'Unknown',
          score: er.score,
          weight: criteria?.weight || 1,
          reasoning: er.reasoning
        };
      });
      
      const totalWeight = result.criteriaScores.reduce((sum, c) => sum + c.weight, 0);
      const weightedSum = result.criteriaScores.reduce((sum, c) => sum + (c.score * c.weight), 0);
      result.overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : undefined;
      
      const avgConfidence = evaluationResults.reduce((sum: number, er: any) => sum + (er.confidence || 70), 0) / evaluationResults.length;
      result.confidence = Math.round(avgConfidence);
      
      result.lastEvaluated = evaluationResults[0]?.createdAt;
    }
    
    return result;
  }
  
  private extractAgentInsights(agentAnalyses: any[]): UnifiedCompanyIntelligence['agentInsights'] {
    const result: UnifiedCompanyIntelligence['agentInsights'] = {};
    
    const agentTypes = ['legal', 'clinical', 'commercial', 'financial', 'hr', 'ip', 'research'];
    
    for (const agentType of agentTypes) {
      const analysis = agentAnalyses.find(a => a.agentType?.toLowerCase() === agentType);
      if (analysis) {
        const normalizedStatus = this.normalizeAgentStatus(analysis.status);
        (result as any)[agentType] = {
          status: normalizedStatus,
          keyFindings: analysis.findings?.slice(0, 5) || [],
          risks: analysis.recommendations?.slice(0, 3) || [],
          lastAnalyzed: analysis.updatedAt?.toISOString?.() || analysis.createdAt?.toISOString?.() || 
                        (analysis.updatedAt ? new Date(analysis.updatedAt).toISOString() : undefined)
        };
      }
    }
    
    return result;
  }
  
  private extractExternalLinks(deal: any, researchData: any): UnifiedCompanyIntelligence['externalLinks'] {
    return {
      website: deal.website,
      pitchbookUrl: researchData?.externalLinks?.pitchbookUrl || researchData?.externalSources?.pitchbookUrl,
      crunchbaseUrl: researchData?.externalLinks?.crunchbaseUrl || researchData?.externalSources?.crunchbaseUrl,
      linkedinCompanyUrl: researchData?.externalLinks?.linkedinCompanyUrl || researchData?.externalSources?.linkedinCompanyUrl,
      northdataUrl: researchData?.externalSources?.northdataUrl
    };
  }
  
  private countDataPoints(obj: any): number {
    if (!obj) return 0;
    let count = 0;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim()) count++;
      else if (typeof value === 'number') count++;
      else if (Array.isArray(value)) count += value.length;
      else if (typeof value === 'object') count += this.countDataPoints(value);
    }
    return count;
  }
  
  private countRisks(riskAssessment: any): number {
    let count = 0;
    const riskArrays = ['regulatory', 'competitive', 'financial', 'operational', 'clinical', 'legal', 'ip'];
    for (const key of riskArrays) {
      if (Array.isArray(riskAssessment[key])) {
        count += riskAssessment[key].length;
      }
    }
    return count;
  }
  
  private calculateQualityScore(sections: DataCompletenessSection[], missingCriticalCount: number): number {
    const completedSections = sections.filter(s => s.hasData).length;
    const sectionScore = (completedSections / sections.length) * 60;
    
    const totalDataPoints = sections.reduce((sum, s) => sum + s.dataPoints, 0);
    const dataPointScore = Math.min(totalDataPoints / 30, 1) * 25;
    
    const criticalPenalty = Math.min(missingCriticalCount * 5, 15);
    
    return Math.round(Math.max(sectionScore + dataPointScore - criticalPenalty, 0));
  }
}

export const companyIntelligenceService = new CompanyIntelligenceService();
