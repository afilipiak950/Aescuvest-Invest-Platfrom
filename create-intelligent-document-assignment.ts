#!/usr/bin/env tsx

import { db } from './server/db';
import { documents } from './shared/schema';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define the 7 available agents with their specialties
const AGENT_DEFINITIONS = {
  legal: {
    name: "Legal Agent",
    keywords: ["contract", "agreement", "legal", "terms", "conditions", "liability", "compliance", "regulation", "law", "clause", "intellectual property", "patent", "trademark", "copyright", "license", "privacy", "gdpr", "employment", "termination", "non-compete", "confidentiality", "nda", "litigation", "dispute", "court", "regulatory", "securities", "corporate", "governance", "board", "shareholder", "equity", "stock", "option", "warrant"],
    description: "Analyzes legal documents, contracts, agreements, compliance, and regulatory matters"
  },
  clinical: {
    name: "Clinical Agent", 
    keywords: ["clinical", "trial", "study", "patient", "medical", "healthcare", "regulatory", "fda", "ce mark", "iso", "gcp", "protocol", "endpoint", "efficacy", "safety", "adverse", "device", "drug", "pharmaceutical", "biotech", "preclinical", "phase", "approval", "submission", "ethics", "irb", "informed consent", "medical device", "diagnostic", "therapeutic", "treatment", "health", "hospital", "physician", "doctor", "nurse", "quality", "validation", "verification"],
    description: "Analyzes clinical trials, medical research, regulatory submissions, and healthcare compliance"
  },
  commercial: {
    name: "Commercial Agent",
    keywords: ["market", "sales", "revenue", "customer", "commercial", "business model", "pricing", "competition", "competitive", "go-to-market", "gtm", "marketing", "brand", "partnership", "distribution", "channel", "segment", "target", "addressable", "tam", "som", "sam", "growth", "expansion", "strategy", "positioning", "value proposition", "differentiation", "advantage", "moat", "scalability", "unit economics", "churn", "retention", "acquisition", "funnel"],
    description: "Analyzes market strategy, business models, competitive positioning, and commercial viability"
  },
  hr: {
    name: "HR Agent",
    keywords: ["employee", "employment", "hr", "human resources", "salary", "compensation", "benefits", "insurance", "equity", "stock option", "vesting", "performance", "review", "training", "development", "organizational", "structure", "team", "management", "executive", "hiring", "recruitment", "onboarding", "culture", "engagement", "retention", "termination", "severance", "policy", "handbook", "compliance", "discrimination", "harassment", "diversity", "inclusion", "workplace", "safety"],
    description: "Analyzes human resources, employment matters, compensation, and organizational structure"
  },
  financial: {
    name: "Financial Agent",
    keywords: ["financial", "finance", "revenue", "cost", "profit", "margin", "cash", "burn", "runway", "funding", "investment", "valuation", "accounting", "audit", "budget", "forecast", "projection", "kpi", "metrics", "ebitda", "gross", "net", "balance sheet", "income statement", "cash flow", "working capital", "debt", "equity", "cap table", "dilution", "liquidation", "preference", "dividend", "tax", "expense", "opex", "capex", "arr", "mrr", "ltv", "cac"],
    description: "Analyzes financial statements, budgets, funding, and economic performance"
  },
  ip: {
    name: "IP Agent", 
    keywords: ["intellectual property", "patent", "trademark", "copyright", "trade secret", "proprietary", "invention", "innovation", "technology", "know-how", "licensing", "royalty", "infringement", "prior art", "novelty", "non-obviousness", "prosecution", "portfolio", "freedom to operate", "fto", "clearance", "due diligence", "ip strategy", "protection", "enforcement", "litigation", "invalidity", "claim", "specification", "filing", "application", "grant", "maintenance", "renewal"],
    description: "Analyzes intellectual property, patents, trademarks, and technology protection"
  },
  research: {
    name: "Research Agent",
    keywords: ["research", "development", "r&d", "innovation", "technology", "technical", "scientific", "experiment", "data", "analysis", "methodology", "hypothesis", "results", "conclusion", "publication", "paper", "study", "investigation", "discovery", "breakthrough", "prototype", "proof of concept", "poc", "feasibility", "validation", "testing", "laboratory", "bench", "scale", "optimization", "algorithm", "software", "platform", "system", "architecture", "design", "engineering"],
    description: "Analyzes research activities, technical development, and innovation processes"
  }
};

async function createIntelligentDocumentAssignment(dealId: number) {
  console.log(`🤖 Starting intelligent document assignment for deal ${dealId}`);
  
  try {
    // Get all documents for the deal
    const allDocuments = await db.query.documents.findMany({
      where: eq(documents.dealId, dealId),
    });

    console.log(`📋 Found ${allDocuments.length} documents to analyze`);

    let processedCount = 0;
    let totalAssignments = 0;
    const assignmentStats: Record<string, number> = {};

    // Process documents in batches to avoid rate limiting
    const BATCH_SIZE = 3;
    for (let i = 0; i < allDocuments.length; i += BATCH_SIZE) {
      const batch = allDocuments.slice(i, i + BATCH_SIZE);
      
      console.log(`📊 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allDocuments.length / BATCH_SIZE)} (documents ${i + 1}-${Math.min(i + BATCH_SIZE, allDocuments.length)})`);
      
      // Process each document in the batch
      for (const document of batch) {
        try {
          const assignment = await analyzeDocumentForAssignment(document);
          
          if (assignment.agents.length > 0) {
            // Update document with intelligent assignment
            await db.update(documents)
              .set({
                assignedAgents: assignment.agents,
                assignmentReason: assignment.reasoning,
                assignmentConfidence: assignment.confidence,
                assignedAt: new Date(),
                manuallyAssigned: false
              })
              .where(eq(documents.id, document.id));

            totalAssignments++;
            assignment.agents.forEach(agent => {
              assignmentStats[agent] = (assignmentStats[agent] || 0) + 1;
            });

            console.log(`✅ Document ${document.id} "${document.name}": Assigned to [${assignment.agents.join(', ')}] (${Math.round(assignment.confidence * 100)}% confidence)`);
          } else {
            console.log(`⚠️ Document ${document.id} "${document.name}": No suitable agents found`);
          }
        } catch (error) {
          console.error(`❌ Error processing document ${document.id}:`, error);
        }
        
        processedCount++;
        
        // Progress update
        const progressPercent = Math.round((processedCount / allDocuments.length) * 100);
        if (processedCount % 10 === 0 || processedCount === allDocuments.length) {
          console.log(`📈 Progress: ${processedCount}/${allDocuments.length} (${progressPercent}%) - ${totalAssignments} documents assigned`);
        }
      }
      
      // Small delay between batches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 Intelligent document assignment completed!`);
    console.log(`📊 Final Statistics:`);
    console.log(`   • Total documents processed: ${processedCount}`);
    console.log(`   • Documents successfully assigned: ${totalAssignments}`);
    console.log(`   • Assignment distribution:`);
    
    Object.entries(assignmentStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([agent, count]) => {
        const percentage = Math.round((count / totalAssignments) * 100);
        console.log(`     - ${AGENT_DEFINITIONS[agent as keyof typeof AGENT_DEFINITIONS]?.name}: ${count} documents (${percentage}%)`);
      });

  } catch (error) {
    console.error('❌ Error in intelligent document assignment:', error);
    throw error;
  }
}

async function analyzeDocumentForAssignment(document: any): Promise<{
  agents: string[];
  reasoning: string;
  confidence: number;
}> {
  try {
    // Extract content for analysis
    let content = '';
    let summary = '';
    
    // Use AI summary if available
    if (document.aiSummary) {
      if (typeof document.aiSummary === 'object') {
        summary = document.aiSummary.executiveSummary || '';
        const criticalFindings = document.aiSummary.criticalFindings || [];
        const keyFinancialData = document.aiSummary.keyFinancialData || [];
        const riskAssessment = document.aiSummary.riskAssessment || [];
        
        content = [summary, ...criticalFindings, ...keyFinancialData, ...riskAssessment].join(' ');
      } else if (typeof document.aiSummary === 'string') {
        summary = document.aiSummary;
        content = document.aiSummary;
      }
    }
    
    // Fallback to OCR text if no AI summary
    if (!content && document.ocrText) {
      content = document.ocrText.substring(0, 2000); // Limit content size
    }
    
    // Use document name as additional context
    const documentName = document.name.toLowerCase();
    content = `Document: ${document.name}\n\n${content}`;
    
    if (!content || content.length < 10) {
      return {
        agents: ['research'], // Default fallback
        reasoning: 'No content available for analysis - assigned to Research as default',
        confidence: 0.3
      };
    }

    // Create AI prompt for intelligent assignment
    const prompt = `
You are an expert due diligence analyst. Analyze this document and determine which agents should review it. You can assign up to 3 agents maximum.

Available Agents:
${Object.entries(AGENT_DEFINITIONS).map(([key, def]) => `• ${key}: ${def.description}`).join('\n')}

Document Content:
${content}

Instructions:
1. Assign documents to up to 3 agents maximum when content is relevant to multiple areas
2. Consider cross-functional documents (e.g., employee agreements → legal + hr)  
3. Be precise - only assign to agents whose expertise is genuinely needed
4. Provide confidence score between 0-1
5. Explain your reasoning clearly

Respond in JSON format:
{
  "assignments": ["agent1", "agent2"],
  "reasoning": "Clear explanation of why these agents were selected",
  "confidence": 0.85
}
    `;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.1
    });

    let result;
    try {
      result = JSON.parse(response.content[0].text || '{}');
    } catch (parseError) {
      console.error('JSON parse error for document', document.id, parseError);
      return {
        agents: ['research'],
        reasoning: 'AI analysis failed - assigned to Research as fallback',
        confidence: 0.3
      };
    }

    // Validate and clean the response
    const validAgents = (result.assignments || [])
      .filter((agent: string) => agent in AGENT_DEFINITIONS)
      .slice(0, 3); // Maximum 3 agents

    if (validAgents.length === 0) {
      // Fallback to keyword-based assignment if AI fails
      return performKeywordBasedAssignment(content, document.name);
    }

    return {
      agents: validAgents,
      reasoning: result.reasoning || 'AI-powered assignment based on content analysis',
      confidence: Math.min(1, Math.max(0, result.confidence || 0.7))
    };

  } catch (error) {
    console.error(`Error in AI analysis for document ${document.id}:`, error);
    
    // Fallback to keyword-based assignment
    return performKeywordBasedAssignment(
      document.ocrText || document.name, 
      document.name
    );
  }
}

function performKeywordBasedAssignment(content: string, documentName: string): {
  agents: string[];
  reasoning: string;
  confidence: number;
} {
  const contentLower = (content + ' ' + documentName).toLowerCase();
  const scores: Record<string, number> = {};

  // Score each agent based on keyword matches
  Object.entries(AGENT_DEFINITIONS).forEach(([agentKey, agentDef]) => {
    let score = 0;
    agentDef.keywords.forEach(keyword => {
      if (contentLower.includes(keyword)) {
        score += 1;
      }
    });
    
    if (score > 0) {
      scores[agentKey] = score;
    }
  });

  // Get top agents (max 3)
  const sortedAgents = Object.entries(scores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([agent]) => agent);

  if (sortedAgents.length === 0) {
    return {
      agents: ['research'],
      reasoning: 'No keyword matches found - assigned to Research as default',
      confidence: 0.3
    };
  }

  const reasoningScores = Object.entries(scores)
    .map(([agent, score]) => `${agent}(${score})`)
    .join(', ');

  return {
    agents: sortedAgents,
    reasoning: `Keyword-based assignment: ${reasoningScores}`,
    confidence: 0.6
  };
}

// Run the intelligent assignment for deal 22
createIntelligentDocumentAssignment(22)
  .then(() => {
    console.log('🎯 Intelligent document assignment completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Intelligent document assignment failed:', error);
    process.exit(1);
  });