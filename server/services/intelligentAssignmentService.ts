import { storage } from '../storage';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AgentMapping {
  type: string;
  name: string;
  keywords: string[];
  contentTypes: string[];
  patterns: RegExp[];
  aiPrompt: string;
}

// Enhanced agent mapping with AI-powered decision making
const AGENT_MAPPINGS: AgentMapping[] = [
  {
    type: 'clinical',
    name: 'Clinical',
    keywords: [
      'clinical', 'medical', 'healthcare', 'patient', 'treatment', 'therapy', 'diagnosis',
      'hospital', 'clinic', 'doctor', 'physician', 'nurse', 'health', 'wellness',
      'pharmaceutical', 'drug', 'medication', 'trial', 'study', 'research', 'fda',
      'regulatory', 'approval', 'safety', 'efficacy', 'adverse', 'side effects'
    ],
    contentTypes: ['clinical trial', 'medical device', 'pharmaceutical', 'healthcare'],
    patterns: [
      /clinical\s+trial/i,
      /medical\s+device/i,
      /fda\s+approval/i,
      /health\s+technology/i,
      /patient\s+care/i
    ],
    aiPrompt: 'This document should be assigned to Clinical agent if it contains medical information, healthcare services, patient care, clinical trials, medical devices, pharmaceutical content, or health technology solutions.'
  },
  {
    type: 'legal',
    name: 'Legal',
    keywords: [
      'legal', 'contract', 'agreement', 'license', 'patent', 'intellectual property',
      'trademark', 'copyright', 'litigation', 'lawsuit', 'compliance', 'regulatory',
      'terms', 'conditions', 'liability', 'indemnity', 'jurisdiction', 'governing law',
      'nda', 'confidentiality', 'employment agreement', 'shareholder'
    ],
    contentTypes: ['contract', 'legal document', 'patent', 'license', 'agreement'],
    patterns: [
      /patent\s+application/i,
      /license\s+agreement/i,
      /employment\s+agreement/i,
      /intellectual\s+property/i,
      /non.disclosure/i
    ],
    aiPrompt: 'This document should be assigned to Legal agent if it contains contracts, legal agreements, intellectual property, compliance matters, patents, licenses, or regulatory legal content.'
  },
  {
    type: 'commercial',
    name: 'Commercial',
    keywords: [
      'market', 'sales', 'marketing', 'customer', 'revenue', 'pricing', 'competition',
      'business model', 'go-to-market', 'customer acquisition', 'retention', 'churn',
      'market size', 'addressable market', 'competitive analysis', 'positioning',
      'branding', 'product launch', 'distribution', 'channel', 'partnership'
    ],
    contentTypes: ['market analysis', 'sales data', 'marketing plan', 'competitive analysis'],
    patterns: [
      /market\s+analysis/i,
      /competitive\s+landscape/i,
      /sales\s+strategy/i,
      /customer\s+acquisition/i,
      /go.to.market/i
    ],
    aiPrompt: 'This document should be assigned to Commercial agent if it contains market analysis, sales data, customer information, marketing strategies, competitive analysis, or business development content.'
  },
  {
    type: 'hr',
    name: 'HR',
    keywords: [
      'human resources', 'employee', 'staff', 'team', 'hiring', 'recruitment',
      'compensation', 'salary', 'benefits', 'payroll', 'performance', 'review',
      'organizational chart', 'culture', 'training', 'development', 'policy',
      'handbook', 'onboarding', 'termination', 'retention', 'diversity'
    ],
    contentTypes: ['employee data', 'hr policy', 'compensation', 'organizational'],
    patterns: [
      /employment\s+agreement/i,
      /organizational\s+chart/i,
      /compensation\s+plan/i,
      /employee\s+handbook/i,
      /performance\s+review/i
    ],
    aiPrompt: 'This document should be assigned to HR agent if it contains employee information, organizational structure, compensation data, hiring plans, company culture, or human resources policies.'
  },
  {
    type: 'financial',
    name: 'Financial',
    keywords: [
      'financial', 'finance', 'accounting', 'revenue', 'profit', 'loss', 'cash flow',
      'balance sheet', 'income statement', 'budget', 'forecast', 'valuation',
      'investment', 'funding', 'capital', 'equity', 'debt', 'loan', 'interest',
      'tax', 'audit', 'compliance', 'reporting', 'metrics', 'kpi'
    ],
    contentTypes: ['financial statement', 'budget', 'forecast', 'valuation', 'tax'],
    patterns: [
      /financial\s+statement/i,
      /cash\s+flow/i,
      /balance\s+sheet/i,
      /income\s+statement/i,
      /profit\s+and\s+loss/i
    ],
    aiPrompt: 'This document should be assigned to Financial agent if it contains financial statements, accounting data, budgets, forecasts, tax information, or financial analysis.'
  },
  {
    type: 'ip',
    name: 'IP',
    keywords: [
      'intellectual property', 'patent', 'trademark', 'copyright', 'trade secret',
      'invention', 'innovation', 'technology', 'proprietary', 'licensing',
      'royalty', 'infringement', 'prior art', 'claims', 'specification',
      'application', 'registration', 'protection', 'enforcement'
    ],
    contentTypes: ['patent', 'trademark', 'copyright', 'ip license', 'technology'],
    patterns: [
      /patent\s+application/i,
      /trademark\s+registration/i,
      /intellectual\s+property/i,
      /licensing\s+agreement/i,
      /trade\s+secret/i
    ],
    aiPrompt: 'This document should be assigned to IP agent if it contains intellectual property matters, patents, trademarks, copyrights, technology licensing, or innovation protection.'
  },
  {
    type: 'research',
    name: 'Research',
    keywords: [
      'research', 'development', 'study', 'analysis', 'report', 'findings',
      'methodology', 'data', 'results', 'conclusion', 'hypothesis', 'experiment',
      'investigation', 'survey', 'academic', 'scientific', 'publication',
      'white paper', 'case study', 'technical', 'innovation'
    ],
    contentTypes: ['research report', 'study', 'analysis', 'white paper', 'technical'],
    patterns: [
      /research\s+report/i,
      /case\s+study/i,
      /white\s+paper/i,
      /technical\s+analysis/i,
      /market\s+research/i
    ],
    aiPrompt: 'This document should be assigned to Research agent if it contains research reports, studies, technical analysis, academic content, or investigative findings.'
  }
];

export class IntelligentAssignmentService {
  
  // Core AI-powered assignment function
  async assignDocumentToAgents(documentId: number, userId: number): Promise<{
    assignments: string[];
    reasoning: string;
    confidence: number;
  }> {
    try {
      console.log(`🤖 Starting intelligent assignment for document ${documentId}`);
      
      // Get document with AI summary
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Check if document already has assignments (skip for now due to schema limitations)
      // TODO: Add assignedAgents support when database schema is updated
      /*
      if (document.assignedAgents && document.assignedAgents.length > 0) {
        console.log(`📋 Document ${documentId} already assigned to: ${document.assignedAgents.join(', ')}`);
        return {
          assignments: document.assignedAgents,
          reasoning: document.assignmentReason || 'Previously assigned',
          confidence: document.assignmentConfidence || 0.8
        };
      }
      */

      // Extract content for analysis
      const content = this.extractDocumentContent(document);
      if (!content) {
        console.log(`⚠️ No content available for document ${documentId} - assigning to Research by default`);
        return this.createDefaultAssignment(documentId, userId);
      }

      // Get learning data from previous assignments
      const learningData = await this.getLearningData();

      // Perform AI-powered assignment
      const aiAssignment = await this.performAIAssignment(content, learningData);
      
      // Validate and enhance assignment with rule-based logic
      const finalAssignment = await this.enhanceWithRules(content, aiAssignment);

      // Save assignment to database
      await this.saveAssignment(documentId, finalAssignment, userId);

      console.log(`✅ Document ${documentId} assigned to: ${finalAssignment.assignments.join(', ')} (confidence: ${finalAssignment.confidence})`);
      
      return finalAssignment;

    } catch (error) {
      console.error(`❌ Failed to assign document ${documentId}:`, error);
      return this.createDefaultAssignment(documentId, userId);
    }
  }

  // Extract relevant content from document for analysis
  private extractDocumentContent(document: any): string {
    const parts: string[] = [];
    
    // Add document name (important for context)
    if (document.name) {
      parts.push(`Title: ${document.name}`);
    }

    // Add AI summary if available (most important)
    if (document.aiSummary) {
      const summary = document.aiSummary;
      if (summary.executiveSummary) parts.push(`Summary: ${summary.executiveSummary}`);
      if (summary.criticalFindings?.length) parts.push(`Critical Findings: ${summary.criticalFindings.join(', ')}`);
      if (summary.keyFinancialData?.length) parts.push(`Financial Data: ${summary.keyFinancialData.join(', ')}`);
      if (summary.riskAssessment?.length) parts.push(`Risks: ${summary.riskAssessment.join(', ')}`);
      if (summary.strategicImplications) parts.push(`Strategic Implications: ${summary.strategicImplications}`);
      if (summary.documentType) parts.push(`Document Type: ${summary.documentType}`);
    }

    // Add OCR text as fallback (truncated)
    if (document.ocrText && parts.length === 1) {
      parts.push(`Content: ${document.ocrText.substring(0, 2000)}`);
    }

    // Add document description if available
    if (document.summary) {
      parts.push(`Description: ${document.summary}`);
    }

    return parts.join('\n\n');
  }

  // Get learning data from previous assignments
  private async getLearningData(): Promise<any[]> {
    try {
      // This would get learning data from the database
      // For now, return empty array until database is ready
      return [];
    } catch (error) {
      console.warn('Could not fetch learning data:', error);
      return [];
    }
  }

  // Perform AI-powered assignment using OpenAI
  private async performAIAssignment(content: string, learningData: any[]): Promise<{
    assignments: string[];
    reasoning: string;
    confidence: number;
  }> {
    try {
      const agentDescriptions = AGENT_MAPPINGS.map(agent => 
        `${agent.type}: ${agent.name} - ${agent.aiPrompt}`
      ).join('\n');

      const prompt = `
Analyze this document content and assign it to the most appropriate agent(s) for due diligence analysis.

Available Agents:
${agentDescriptions}

Document Content:
${content}

Instructions:
1. Assign to 1-3 most relevant agents based on content analysis
2. Primary assignment should be the most relevant agent
3. Secondary assignments for documents with multiple aspects
4. Provide clear reasoning for each assignment
5. Rate confidence from 0.0 to 1.0

Respond in JSON format:
{
  "assignments": ["agent_type1", "agent_type2"],
  "reasoning": "Detailed explanation of why these agents were selected",
  "confidence": 0.85
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert document analyst specializing in due diligence assignment. Analyze documents and assign them to the most appropriate specialized agents based on content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate the response
      if (!result.assignments || !Array.isArray(result.assignments)) {
        throw new Error('Invalid AI response format');
      }

      // Ensure assignments are valid agent types
      const validAssignments = result.assignments.filter(agent => 
        AGENT_MAPPINGS.some(mapping => mapping.type === agent)
      );

      if (validAssignments.length === 0) {
        throw new Error('No valid agent assignments from AI');
      }

      return {
        assignments: validAssignments,
        reasoning: result.reasoning || 'AI-powered content analysis',
        confidence: Math.min(Math.max(result.confidence || 0.7, 0.0), 1.0)
      };

    } catch (error) {
      console.error('AI assignment failed:', error);
      // Fallback to rule-based assignment
      return this.performRuleBasedAssignment(content);
    }
  }

  // Enhance AI assignment with rule-based validation
  private async enhanceWithRules(content: string, aiAssignment: any): Promise<{
    assignments: string[];
    reasoning: string;
    confidence: number;
  }> {
    const contentLower = content.toLowerCase();
    const additionalAgents: string[] = [];
    const ruleReasons: string[] = [];

    // Check each agent mapping against content
    for (const agent of AGENT_MAPPINGS) {
      if (aiAssignment.assignments.includes(agent.type)) {
        continue; // Already assigned by AI
      }

      // Check keywords
      const keywordMatches = agent.keywords.filter(keyword => 
        contentLower.includes(keyword.toLowerCase())
      );

      // Check patterns
      const patternMatches = agent.patterns.filter(pattern => 
        pattern.test(content)
      );

      // If strong rule-based evidence, add as secondary assignment
      if (keywordMatches.length >= 2 || patternMatches.length >= 1) {
        additionalAgents.push(agent.type);
        ruleReasons.push(`${agent.name}: ${keywordMatches.length} keyword matches, ${patternMatches.length} pattern matches`);
      }
    }

    // Combine AI and rule-based assignments
    const finalAssignments = [...aiAssignment.assignments];
    
    // Add rule-based assignments as secondary (max 3 total agents)
    for (const agent of additionalAgents) {
      if (finalAssignments.length < 3 && !finalAssignments.includes(agent)) {
        finalAssignments.push(agent);
      }
    }

    const enhancedReasoning = [
      aiAssignment.reasoning,
      ...ruleReasons
    ].filter(Boolean).join(' | ');

    return {
      assignments: finalAssignments,
      reasoning: enhancedReasoning,
      confidence: aiAssignment.confidence
    };
  }

  // Fallback rule-based assignment
  private performRuleBasedAssignment(content: string): {
    assignments: string[];
    reasoning: string;
    confidence: number;
  } {
    const contentLower = content.toLowerCase();
    const scores: { [key: string]: number } = {};

    // Score each agent based on keyword matches
    for (const agent of AGENT_MAPPINGS) {
      let score = 0;
      
      // Keyword scoring
      for (const keyword of agent.keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      // Pattern scoring (higher weight)
      for (const pattern of agent.patterns) {
        if (pattern.test(content)) {
          score += 3;
        }
      }

      if (score > 0) {
        scores[agent.type] = score;
      }
    }

    // Sort by score and take top assignments
    const sortedAgents = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2) // Max 2 agents for rule-based
      .map(([agent]) => agent);

    // If no matches, assign to research as catch-all
    if (sortedAgents.length === 0) {
      sortedAgents.push('research');
    }

    return {
      assignments: sortedAgents,
      reasoning: `Rule-based assignment: ${Object.entries(scores).map(([agent, score]) => `${agent}(${score})`).join(', ')}`,
      confidence: 0.6
    };
  }

  // Save assignment to database
  private async saveAssignment(documentId: number, assignment: any, userId: number): Promise<void> {
    try {
      // Update document with assignment
      await storage.updateDocument(documentId, {
        assignedAgents: assignment.assignments,
        assignmentReason: assignment.reasoning,
        assignmentConfidence: assignment.confidence,
        assignedAt: new Date(),
        assignedBy: userId
      });

      // Save to learning table (when database is ready)
      // await storage.createDocumentAssignmentLearning({
      //   documentId,
      //   agentType: assignment.assignments[0], // Primary assignment
      //   assignmentType: 'ai',
      //   aiReasoning: assignment.reasoning,
      //   confidence: assignment.confidence,
      //   assignedBy: userId
      // });

    } catch (error) {
      console.error('Failed to save assignment:', error);
    }
  }

  // Create default assignment for error cases
  private createDefaultAssignment(documentId: number, userId: number): {
    assignments: string[];
    reasoning: string;
    confidence: number;
  } {
    return {
      assignments: ['research'],
      reasoning: 'Default assignment - requires manual review',
      confidence: 0.3
    };
  }

  // Batch assign all unassigned documents for a deal
  async batchAssignDocuments(dealId: number, userId: number): Promise<{
    totalProcessed: number;
    successfulAssignments: number;
    errors: number;
  }> {
    console.log(`🔄 Starting batch assignment for deal ${dealId}`);
    
    const documents = await storage.getDocumentsByDealId(dealId);
    const unassignedDocs = documents.filter(doc => 
      !doc.assignedAgents || doc.assignedAgents.length === 0
    );

    console.log(`📄 Found ${unassignedDocs.length} unassigned documents out of ${documents.length} total`);

    let successfulAssignments = 0;
    let errors = 0;

    for (const doc of unassignedDocs) {
      try {
        await this.assignDocumentToAgents(doc.id, userId);
        successfulAssignments++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to assign document ${doc.id}:`, error);
        errors++;
      }
    }

    console.log(`✅ Batch assignment completed: ${successfulAssignments} successful, ${errors} errors`);

    return {
      totalProcessed: unassignedDocs.length,
      successfulAssignments,
      errors
    };
  }
}

export const intelligentAssignmentService = new IntelligentAssignmentService();