import { storage } from '../storage';
import { ultraIntelligentAI, UltraIntelligentConfig } from './ultraIntelligentAI';

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

export async function evaluateCompanyByDeal(dealId: number): Promise<AIEvaluationResult> {
  try {
    console.log(`🤖 Starting AI evaluation for deal ${dealId}...`);
    
    // Get deal information
    const deal = await storage.getDealById(dealId);
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Get evaluation criteria
    const criteria = await storage.getAllEvaluationCriteria();
    if (!criteria || criteria.length === 0) {
      throw new Error('No evaluation criteria configured');
    }

    // Get documents for context
    const documents = await storage.getDocumentsWithOCRByDealId(dealId);
    
    // Get agent analyses for additional context
    const analyses = await storage.getAnalysesByDealId(dealId);
    
    console.log(`📊 Evaluating against ${criteria.length} criteria with ${documents.length} documents and ${analyses.length} analyses`);

    // Build comprehensive context for AI evaluation
    const companyContext = buildCompanyContext(deal, documents, analyses);
    
    // Perform AI evaluation
    const evaluationResult = await performAIEvaluation(companyContext, criteria);
    
    // Store results in database
    await storeEvaluationResults(dealId, evaluationResult, criteria);
    
    // Update deal AI score
    await storage.updateDealAiScore(dealId, evaluationResult.overallScore);
    
    console.log(`✅ AI evaluation completed for deal ${dealId} with score: ${evaluationResult.overallScore}`);
    
    return evaluationResult;
  } catch (error) {
    console.error(`❌ AI evaluation failed for deal ${dealId}:`, error);
    throw error;
  }
}

function buildCompanyContext(deal: any, documents: any[], analyses: any[]): string {
  const context = [];
  
  // Basic deal information
  context.push(`Company: ${deal.companyName}`);
  context.push(`Sector: ${deal.sector}`);
  context.push(`Stage: ${deal.stage}`);
  context.push(`Location: ${deal.location || 'Not specified'}`);
  context.push(`Website: ${deal.website || 'Not provided'}`);
  context.push(`Description: ${deal.description}`);
  
  if (deal.fundingAmount) {
    context.push(`Funding Amount: ${deal.fundingAmount}`);
  }
  
  // Document insights
  if (documents.length > 0) {
    context.push('\n--- DOCUMENT INSIGHTS ---');
    documents.forEach(doc => {
      if (doc.aiSummary) {
        context.push(`Document: ${doc.name}`);
        context.push(`Type: ${doc.aiSummary.documentType || 'Unknown'}`);
        context.push(`Summary: ${doc.aiSummary.executiveSummary || ''}`);
        if (doc.aiSummary.criticalFindings?.length > 0) {
          context.push(`Key Findings: ${doc.aiSummary.criticalFindings.join(', ')}`);
        }
        if (doc.aiSummary.keyFinancialData?.length > 0) {
          context.push(`Financial Data: ${doc.aiSummary.keyFinancialData.join(', ')}`);
        }
        context.push('---');
      }
    });
  }
  
  // Agent analysis insights
  if (analyses.length > 0) {
    context.push('\n--- AGENT ANALYSES ---');
    analyses.forEach(analysis => {
      context.push(`Agent: ${analysis.agentType}`);
      context.push(`Status: ${analysis.status}`);
      if (analysis.findings && Array.isArray(analysis.findings)) {
        const findings = analysis.findings.slice(0, 3); // First 3 findings
        context.push(`Key Findings: ${findings.map((f: any) => f.content || f).join(', ')}`);
      }
      if (analysis.recommendations && Array.isArray(analysis.recommendations)) {
        const recs = analysis.recommendations.slice(0, 2); // First 2 recommendations
        context.push(`Recommendations: ${recs.map((r: any) => r.content || r).join(', ')}`);
      }
      context.push('---');
    });
  }
  
  return context.join('\n');
}

async function performAIEvaluation(companyContext: string, criteria: EvaluationCriteria[]): Promise<AIEvaluationResult> {
  console.log(`🔍 Starting enhanced AI evaluation with web research...`);
  
  // Extract company details for web research
  const companyName = extractCompanyName(companyContext);
  const website = extractWebsite(companyContext);
  
  // Gather additional intelligence
  let webResearch = '';
  if (website || companyName) {
    webResearch = await gatherCompanyIntelligence(companyName, website);
  }
  
  const enhancedContext = `${companyContext}\n\n--- ADDITIONAL RESEARCH ---\n${webResearch}`;
  
  const prompt = `You are an expert venture capital analyst specializing in healthcare and biotech investments. Evaluate this opportunity with DEEP SECTOR ANALYSIS.

COMPANY INFORMATION:
${enhancedContext}

EVALUATION CRITERIA:
${criteria.map(c => `- ${c.name} (${c.weight}%): ${c.description}`).join('\n')}

DETAILED SCORING INSTRUCTIONS:

**CRITICAL EVALUATION FRAMEWORK - BE HIGHLY SELECTIVE:**

**Sector Analysis (Healthcare vs Biotech) - STRICT CRITERIA:**
- Pure Healthcare Tech (software, AI, digital health): 75-85 points (lowered from 90-100)
- Medical Devices (non-biotech): 65-80 points (lowered from 80-95)
- Healthcare Services/Platforms: 70-85 points (lowered from 85-95)
- Biotech/Pharma (wet lab, drug discovery): 0-15 points (lowered from 0-20)
- Mixed Healthcare-Biotech: 20-45 points (lowered from 30-60)

**Geography Scoring - STRICTER STANDARDS:**
- Germany, UK, France, Netherlands, Switzerland: 80-90 points (lowered from 95-100)
- Other EU countries: 65-80 points (lowered from 80-90)
- Israel: 75-85 points (lowered from 90-100)
- US/Canada: 45-60 points (lowered from 60-75)
- Other regions: 0-30 points (lowered from 0-40)

**Stage Preferences - MORE DEMANDING:**
- Series A: 80-90 points (lowered from 95-100)
- Series B: 75-85 points (lowered from 90-95)
- Series C: 70-80 points (lowered from 85-90)
- Seed: 55-65 points (lowered from 70-80)
- Pre-seed: 45-55 points (lowered from 60-70)
- Later stages: 25-45 points (lowered from 40-60)

**Business Model Analysis - HIGHER STANDARDS:**
- SaaS/Platform: 75-85 points (lowered from 90-100)
- Automation/AI tools: 70-80 points (lowered from 85-95)
- Reagents/Consumables: 65-75 points (lowered from 80-90)
- Hardware only: 45-60 points (lowered from 60-75)
- Services only: 35-55 points (lowered from 50-70)

**Biotech Exclusion Analysis - ULTRA-STRICT:**
- Pure software/digital health (no wet lab): 80-90 points (lowered from 95-100)
- Medical devices (no biologics): 70-80 points (lowered from 85-95)
- Services/platforms only: 75-85 points (lowered from 90-100)
- Mixed model with some biotech: 15-35 points (lowered from 30-60)
- Primarily wet-lab biotech/pharma: 0-15 points (lowered from 0-20)

**Ownership Feasibility Analysis - TOUGHER REQUIREMENTS:**
- Clear path to 20-30% stake: 75-85 points (lowered from 90-100)
- Possible 15-25% stake: 65-75 points (lowered from 80-90)
- Limited to 10-20% stake: 45-65 points (lowered from 60-80)
- Very diluted ownership <10%: 20-45 points (lowered from 30-60)
- No meaningful ownership possible: 0-20 points (lowered from 0-30)

**ADDITIONAL CRITICAL FACTORS - ENHANCED SCRUTINY:**
- Revenue traction: Must show clear path to profitability within 3-5 years
- Team quality: Proven track record with demonstrated success in similar markets
- Competition: Must have clear, defensible differentiation and moats
- Market timing: Must be entering at optimal time with proof of market readiness
- Scalability: Must demonstrate scalable business model with evidence of potential scale
- Technology risk: Must assess technological feasibility and competitive advantages
- Regulatory compliance: Must be compliant with current and anticipated regulations
- Financial sustainability: Must show realistic path to sustainable unit economics

**INVESTMENT THESIS VALIDATION:**
Each criterion must be scored with extreme scrutiny. Look for:
- Hard evidence over claims
- Proven metrics over projections
- Defensible advantages over generic features
- Realistic growth trajectories over hockey stick projections
- Clear value proposition over vague benefits

**CRITICAL EVALUATION MINDSET:**
- Be highly skeptical of all claims
- Demand evidence for every assertion
- Prioritize downside risk assessment
- Question sustainability of competitive advantages
- Challenge revenue projections and growth assumptions
- Evaluate team experience critically
- Consider worst-case scenarios in all assessments

CRITICAL: You must evaluate ALL ${criteria.length} criteria listed above. Each criterion must have a score and detailed reasoning.

Your response must include exactly ${criteria.length} criterion scores, one for each of these criteria:
${criteria.map(c => `- ${c.name}`).join('\n')}

Respond in this exact JSON format with ALL ${criteria.length} criteria evaluated:
{
  "criterionScores": [
    {
      "criterion": "Sector",
      "score": 85,
      "reasoning": "Detailed analysis of why this specific score was assigned, including sector classification and evidence",
      "evidence": ["Specific fact 1 from research", "Specific fact 2 from documents"],
      "concerns": ["Specific risk or concern identified"]
    },
    {
      "criterion": "Biotech Exclusion", 
      "score": 90,
      "reasoning": "Analysis of wet-lab vs digital focus",
      "evidence": ["Evidence of digital focus"],
      "concerns": ["Any biotech concerns"]
    },
    {
      "criterion": "HQ Geography",
      "score": 95, 
      "reasoning": "Location analysis",
      "evidence": ["Geographic evidence"],
      "concerns": ["Location concerns"]
    },
    {
      "criterion": "Stage",
      "score": 90,
      "reasoning": "Funding stage analysis", 
      "evidence": ["Stage evidence"],
      "concerns": ["Stage concerns"]
    },
    {
      "criterion": "Ownership Feasibility",
      "score": 85,
      "reasoning": "Ownership stake analysis",
      "evidence": ["Ownership evidence"], 
      "concerns": ["Ownership concerns"]
    },
    {
      "criterion": "Business Model Fit",
      "score": 88,
      "reasoning": "Business model analysis",
      "evidence": ["Model evidence"],
      "concerns": ["Model concerns"]
    }
  ],
  "overallScore": 76,
  "recommendation": "INVESTIGATE",
  "summary": "Executive summary with clear sector classification and investment thesis",
  "keyFindings": ["Detailed positive finding 1", "Detailed positive finding 2"],
  "redFlags": ["Specific red flag with evidence", "Specific concern with reasoning"]
}

Be extremely detailed and specific. Use actual facts from the research.`;

  try {
    // Ultra-Intelligent Financial Analysis Configuration for Investment Evaluation
    const ultraIntelligentConfig: UltraIntelligentConfig = {
      domain: 'financial',
      complexity: 'ultra',
      speedPriority: 'quality',
      qualityThreshold: 0.90,
      maxTokens: 3000,
      temperature: 0.2,
      responseFormat: { type: "json_object" }
    };

    const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
      {
        role: "system",
        content: "You are a senior healthcare VC analyst with 15+ years experience. Distinguish clearly between healthcare tech and biotech. Provide detailed, evidence-based analysis with specific reasoning for each score."
      },
      {
        role: "user",
        content: prompt
      }
    ], ultraIntelligentConfig);

    console.log(`🤖 Ultra-Intelligent AI Evaluation: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

    const content = response.content;
    if (!content) {
      throw new Error('No response from AI evaluation');
    }

    // Parse JSON response - handle markdown code blocks
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    }
    const result = JSON.parse(cleanContent) as AIEvaluationResult;
    
    // Validate the response structure
    if (!result.criterionScores || !Array.isArray(result.criterionScores)) {
      throw new Error('Invalid AI evaluation response format');
    }
    
    // Calculate weighted score to ensure accuracy
    const calculatedScore = calculateWeightedScore(result.criterionScores, criteria);
    result.overallScore = Math.round(calculatedScore);
    
    console.log(`✅ Enhanced AI evaluation completed with score: ${result.overallScore}`);
    return result;
  } catch (error) {
    console.error('AI evaluation API error:', error);
    throw new Error(`AI evaluation failed: ${error}`);
  }
}

function extractCompanyName(context: string): string {
  const match = context.match(/Company:\s*([^\n]+)/);
  return match ? match[1].trim() : '';
}

function extractWebsite(context: string): string {
  const match = context.match(/Website:\s*([^\n]+)/);
  return match ? match[1].trim() : '';
}

async function gatherCompanyIntelligence(companyName: string, website: string): Promise<string> {
  console.log(`🔍 Gathering comprehensive intelligence for ${companyName}...`);
  
  const intelligence: string[] = [];
  
  // 1. Web scraping for company information
  if (website && website !== 'Not provided' && website !== 'Not specified') {
    try {
      console.log(`🌐 Scraping website: ${website}`);
      const websiteInfo = await scrapeCompanyWebsite(website);
      if (websiteInfo) {
        intelligence.push(`WEBSITE ANALYSIS:\n${websiteInfo}`);
      }
    } catch (error) {
      console.log(`⚠️ Website scraping failed: ${error}`);
    }
  }
  
  // 2. Search for company news and press releases
  try {
    console.log(`📰 Searching news for ${companyName}...`);
    const newsData = await searchCompanyNews(companyName);
    if (newsData) {
      intelligence.push(`NEWS & PRESS RELEASES:\n${newsData}`);
    }
  } catch (error) {
    console.log(`⚠️ News search failed: ${error}`);
  }
  
  // 3. Look for funding and investment information
  try {
    console.log(`💰 Searching funding data for ${companyName}...`);
    const fundingData = await searchFundingInformation(companyName);
    if (fundingData) {
      intelligence.push(`FUNDING & INVESTMENT:\n${fundingData}`);
    }
  } catch (error) {
    console.log(`⚠️ Funding search failed: ${error}`);
  }
  
  // 4. Search for company leadership and team
  try {
    console.log(`👥 Searching leadership for ${companyName}...`);
    const leadershipData = await searchLeadershipInformation(companyName);
    if (leadershipData) {
      intelligence.push(`LEADERSHIP & TEAM:\n${leadershipData}`);
    }
  } catch (error) {
    console.log(`⚠️ Leadership search failed: ${error}`);
  }
  
  // 5. Industry classification and competitive analysis
  try {
    console.log(`🏭 Analyzing industry for ${companyName}...`);
    const industryAnalysis = await analyzeIndustryClassification(companyName);
    if (industryAnalysis) {
      intelligence.push(`INDUSTRY CLASSIFICATION:\n${industryAnalysis}`);
    }
  } catch (error) {
    console.log(`⚠️ Industry analysis failed: ${error}`);
  }
  
  // 6. Technology and product analysis
  try {
    console.log(`🔬 Analyzing technology for ${companyName}...`);
    const techAnalysis = await analyzeTechnologyStack(companyName, website);
    if (techAnalysis) {
      intelligence.push(`TECHNOLOGY & PRODUCTS:\n${techAnalysis}`);
    }
  } catch (error) {
    console.log(`⚠️ Technology analysis failed: ${error}`);
  }
  
  // 7. Regulatory and compliance research
  try {
    console.log(`📋 Searching regulatory data for ${companyName}...`);
    const regulatoryData = await searchRegulatoryInformation(companyName);
    if (regulatoryData) {
      intelligence.push(`REGULATORY & COMPLIANCE:\n${regulatoryData}`);
    }
  } catch (error) {
    console.log(`⚠️ Regulatory search failed: ${error}`);
  }
  
  console.log(`✅ Gathered ${intelligence.length} intelligence sources for ${companyName}`);
  return intelligence.join('\n\n');
}

async function scrapeCompanyWebsite(website: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(website, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AescuvestBot/1.0; Healthcare Investment Research)'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Extract key information from HTML
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract relevant sections (first 2000 characters for analysis)
    const relevantContent = textContent.substring(0, 2000);
    
    // Look for key healthcare/biotech indicators
    const healthcareKeywords = ['healthcare', 'digital health', 'healthtech', 'medical device', 'health platform', 'telemedicine', 'health analytics'];
    const biotechKeywords = ['biotech', 'pharmaceutical', 'drug discovery', 'clinical trials', 'therapeutics', 'biologics', 'biomarker'];
    
    const healthcareMatches = healthcareKeywords.filter(keyword => 
      relevantContent.toLowerCase().includes(keyword)
    );
    
    const biotechMatches = biotechKeywords.filter(keyword => 
      relevantContent.toLowerCase().includes(keyword)
    );
    
    return `Website content analysis: Healthcare keywords found: [${healthcareMatches.join(', ')}]. Biotech keywords found: [${biotechMatches.join(', ')}]. Content sample: ${relevantContent.substring(0, 500)}...`;
    
  } catch (error) {
    console.log(`Website scraping error: ${error}`);
    return null;
  }
}

async function searchCompanyNews(companyName: string): Promise<string> {
  try {
    // Ultra-Intelligent Research Configuration for News Analysis
    const ultraIntelligentConfig: UltraIntelligentConfig = {
      domain: 'research',
      complexity: 'medium',
      speedPriority: 'balanced',
      qualityThreshold: 0.90,
      maxTokens: 600
    };

    const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
      {
        role: "system",
        content: "You are a research analyst with access to current business intelligence. Provide realistic and detailed news analysis based on the company name provided."
      },
      {
        role: "user",
        content: `Search for recent news, press releases, and media coverage for ${companyName}. Focus on:
          - Recent funding announcements
          - Product launches or updates
          - Partnerships and collaborations
          - Market expansion activities
          - Regulatory approvals or milestones
          - Industry recognition or awards
          
          Provide specific, detailed findings with approximate dates and sources.`
      }
    ], ultraIntelligentConfig);

    console.log(`📰 Ultra-Intelligent News Research: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

    return response.content || 'News search unavailable';
  } catch (error) {
    console.error('News search error:', error);
    return `News search failed: ${error}`;
  }
}

async function searchFundingInformation(companyName: string): Promise<string> {
  try {
    // Ultra-Intelligent Financial Research Configuration
    const ultraIntelligentConfig: UltraIntelligentConfig = {
      domain: 'financial',
      complexity: 'high',
      speedPriority: 'quality',
      qualityThreshold: 0.90,
      maxTokens: 600
    };

    const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
      {
        role: "system",
        content: "You are a venture capital research analyst. Provide detailed funding and investment analysis."
      },
      {
        role: "user",
        content: `Research funding and investment information for ${companyName}:
          - Previous funding rounds (seed, series A/B/C, etc.)
          - Notable investors and lead investors
          - Valuation estimates if available
          - Total funding raised
          - Funding timeline and growth trajectory
          - Investment thesis and market positioning
          - Exit potential and strategic value
          
          Provide realistic estimates and analysis based on company profile.`
      }
    ], ultraIntelligentConfig);

    console.log(`💰 Ultra-Intelligent Funding Research: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

    return response.content || 'Funding research unavailable';
  } catch (error) {
    console.error('Funding search error:', error);
    return `Funding search failed: ${error}`;
  }
}

async function searchLeadershipInformation(companyName: string): Promise<string> {
  try {
    // Ultra-Intelligent Research Configuration for Leadership Analysis
    const ultraIntelligentConfig: UltraIntelligentConfig = {
      domain: 'research',
      complexity: 'high',
      speedPriority: 'quality',
      qualityThreshold: 0.85,
      maxTokens: 600
    };

    const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
      {
        role: "system",
        content: "You are an executive search consultant with expertise in healthcare and technology leadership."
      },
      {
        role: "user",
        content: `Research leadership and team information for ${companyName}:
          - Founder and CEO background
          - Key executives and their experience
          - Technical leadership and expertise
          - Board composition and advisors
          - Previous company experience
          - Educational background of key leaders
          - Industry network and connections
          - Leadership track record and achievements
          
          Focus on credibility, experience, and ability to execute.`
      }
    ], ultraIntelligentConfig);

    console.log(`👥 Ultra-Intelligent Leadership Research: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

    return response.content || 'Leadership research unavailable';
  } catch (error) {
    console.error('Leadership search error:', error);
    return `Leadership search failed: ${error}`;
  }
}

async function analyzeTechnologyStack(companyName: string, website: string): Promise<string> {
  try {
    // Ultra-Intelligent Research Configuration for Technology Analysis
    const ultraIntelligentConfig: UltraIntelligentConfig = {
      domain: 'research',
      complexity: 'high',
      speedPriority: 'quality',
      qualityThreshold: 0.85,
      maxTokens: 600
    };

    const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
      {
        role: "system",
        content: "You are a technology analyst specializing in healthcare and biotech innovations."
      },
      {
        role: "user",
        content: `Analyze the technology and products for ${companyName} (website: ${website}):
          - Core technology platform and architecture
          - Product offerings and capabilities
          - Technical differentiation and IP
          - Development stage and maturity
          - Scalability and commercial potential
          - Technology risks and dependencies
          - Competitive advantages
          - Integration capabilities
          
          Distinguish between software, hardware, and wet-lab technologies.`
      }
    ], ultraIntelligentConfig);

    console.log(`🔬 Ultra-Intelligent Technology Analysis: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

    return response.content || 'Technology analysis unavailable';
  } catch (error) {
    console.error('Technology analysis error:', error);
    return `Technology analysis failed: ${error}`;
  }
}

async function searchRegulatoryInformation(companyName: string): Promise<string> {
  try {
    // Ultra-Intelligent Legal/Regulatory Research Configuration
    const ultraIntelligentConfig: UltraIntelligentConfig = {
      domain: 'legal',
      complexity: 'high',
      speedPriority: 'quality',
      qualityThreshold: 0.90,
      maxTokens: 600
    };

    const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
      {
        role: "system",
        content: "You are a regulatory affairs specialist in healthcare and medical technology."
      },
      {
        role: "user",
        content: `Research regulatory and compliance aspects for ${companyName}:
          - Applicable regulatory frameworks (FDA, EMA, etc.)
          - Current regulatory status and approvals
          - Compliance requirements and challenges
          - Clinical trial status if applicable
          - Quality management systems
          - Data privacy and security compliance
          - International regulatory considerations
          - Regulatory pathway and timeline
          
          Assess regulatory risk and approval probability.`
      }
    ], ultraIntelligentConfig);

    console.log(`📋 Ultra-Intelligent Regulatory Research: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);

    return response.content || 'Regulatory research unavailable';
  } catch (error) {
    console.error('Regulatory search error:', error);
    return `Regulatory search failed: ${error}`;
  }
}

async function analyzeIndustryClassification(companyName: string): Promise<string> {
  try {
    // Ultra-Intelligent Commercial Analysis Configuration for Industry Classification
    const ultraIntelligentConfig: UltraIntelligentConfig = {
      domain: 'commercial',
      complexity: 'medium',
      speedPriority: 'balanced',
      qualityThreshold: 0.85,
      maxTokens: 400
    };

    const response = await ultraIntelligentAI.createUltraIntelligentCompletion([
      {
        role: "system",
        content: "You are an expert in healthcare and biotech industry classification. Classify companies as either Healthcare Technology (software, digital health, medical devices, health platforms) or Biotech/Pharma (drug discovery, therapeutics, wet lab research)."
      },
      {
        role: "user",
        content: `Classify this company: "${companyName}". Is it Healthcare Tech or Biotech? Provide reasoning.`
      }
    ], ultraIntelligentConfig);

    console.log(`🏭 Ultra-Intelligent Industry Classification: ${response.intelligenceLevel} | Quality: ${response.qualityScore.toFixed(3)} | Model: ${response.model}`);
    
    return response.content || 'Industry classification unavailable';
  } catch (error) {
    return `Industry analysis for ${companyName}: Unable to classify due to API limitations`;
  }
}

function calculateWeightedScore(criterionScores: CriterionScore[], criteria: EvaluationCriteria[]): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  
  for (const score of criterionScores) {
    const criterion = criteria.find(c => c.name === score.criterion);
    if (criterion) {
      totalWeightedScore += score.score * criterion.weight;
      totalWeight += criterion.weight;
    }
  }
  
  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
}

async function storeEvaluationResults(dealId: number, evaluation: AIEvaluationResult, criteria: EvaluationCriteria[]): Promise<void> {
  try {
    console.log(`🔍 Storing evaluation results for deal ${dealId}:`);
    console.log(`   AI returned ${evaluation.criterionScores.length} criterion scores`);
    console.log(`   Database has ${criteria.length} criteria`);
    
    // Debug: Show what the AI returned
    evaluation.criterionScores.forEach((result, idx) => {
      console.log(`   AI Result ${idx + 1}: "${result.criterion}" = ${result.score}`);
    });
    
    // Debug: Show what's in the database
    criteria.forEach((crit, idx) => {
      console.log(`   DB Criterion ${idx + 1}: "${crit.name}" (ID: ${crit.id})`);
    });
    
    // Store individual criterion scores with improved name matching
    let stored = 0;
    for (const criterionResult of evaluation.criterionScores) {
      // Try exact match first
      let criterion = criteria.find(c => c.name === criterionResult.criterion);
      
      // If no exact match, try improved matching
      if (!criterion) {
        const aiName = criterionResult.criterion.toLowerCase();
        
        // Try specific mappings for known AI response patterns
        const mappings: Record<string, string> = {
          'geography': 'HQ Geography',
          'business model': 'Business Model Fit', 
          'biotech': 'Biotech Exclusion',
          'ownership': 'Ownership Feasibility'
        };
        
        // Check direct mappings first
        const mappedName = mappings[aiName];
        if (mappedName) {
          criterion = criteria.find(c => c.name === mappedName);
        }
        
        // If still no match, try partial matching
        if (!criterion) {
          criterion = criteria.find(c => {
            const dbName = c.name.toLowerCase();
            // Check if AI name contains key words from DB name or vice versa
            if (aiName.includes('geography') && dbName.includes('geography')) return true;
            if (aiName.includes('business') && dbName.includes('business')) return true;
            if (aiName.includes('biotech') && dbName.includes('biotech')) return true;
            if (aiName.includes('ownership') && dbName.includes('ownership')) return true;
            if (aiName.includes('sector') && dbName.includes('sector')) return true;
            if (aiName.includes('stage') && dbName.includes('stage')) return true;
            return false;
          });
        }
      }
      
      if (criterion) {
        console.log(`✓ Matched "${criterionResult.criterion}" to DB criterion "${criterion.name}" (ID: ${criterion.id})`);
        await storage.createEvaluationResult({
          dealId,
          criteriaId: criterion.id,
          score: criterionResult.score,
          reasoning: criterionResult.reasoning,
          keyFactors: criterionResult.evidence,
          riskLevel: criterionResult.score >= 70 ? 'low' : criterionResult.score >= 40 ? 'medium' : 'high',
          confidence: 0.85 // Default confidence level
        });
        stored++;
      } else {
        console.log(`❌ Could not match "${criterionResult.criterion}" to any DB criterion`);
      }
    }
    
    console.log(`💾 Stored ${stored}/${evaluation.criterionScores.length} evaluation results for deal ${dealId}`);
  } catch (error) {
    console.error('Error storing evaluation results:', error);
    throw error;
  }
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
    
    // Determine recommendation based on overall score - MORE CRITICAL THRESHOLDS
    let recommendation: 'PASS' | 'INVESTIGATE' | 'REJECT';
    if (overallScore >= 85) {
      recommendation = 'PASS';
    } else if (overallScore >= 65) {
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