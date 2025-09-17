/**
 * AI-Powered Document Assignment Service
 * Automatically assigns each document to 1-3 relevant agents based on AI analysis
 * Uses document summaries and content to determine optimal agent assignments
 */

import { db } from '../db';
import { documents } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';
import { aiClientWrapper } from './aiClientWrapper';

// Available agents for assignment
export const AVAILABLE_AGENTS = [
  'Legal',
  'Clinical', 
  'Commercial',
  'HR',
  'Financial',
  'IP',
  'Research'
] as const;

export type AgentType = typeof AVAILABLE_AGENTS[number];

interface AssignmentResult {
  agents: AgentType[];
  confidence: number;
  reasoning: string;
}

interface DocumentAssignmentAnalysis {
  documentId: number;
  documentName: string;
  assignedAgents: AgentType[];
  confidence: number;
  reasoning: string;
}

/**
 * Main service class for AI-powered document assignment
 */
export class AIDocumentAssignmentService {
  
  /**
   * Analyze document content and assign to relevant agents using AI
   */
  async analyzeDocumentForAssignment(
    documentName: string,
    documentContent: string,
    aiSummary?: any
  ): Promise<AssignmentResult> {
    
    // Extract summary text from various formats
    let summaryText = '';
    if (aiSummary) {
      if (typeof aiSummary === 'string') {
        summaryText = aiSummary;
      } else if (aiSummary.executiveSummary) {
        summaryText = aiSummary.executiveSummary;
      } else if (aiSummary.summary) {
        summaryText = aiSummary.summary;
      }
    }

    // Truncate content to avoid token limits (keep first 3000 chars)
    const truncatedContent = documentContent.substring(0, 3000);
    
    const prompt = `As an AI investment analyst, analyze this document and determine which 1-3 agents should review it for due diligence purposes.

Document Name: ${documentName}
Document Content Preview: ${truncatedContent}
AI Summary: ${summaryText}

Available Agents:
- Legal: Corporate governance, contracts, agreements, IP assignments, compliance, litigation, regulatory matters
- Clinical: Medical devices, clinical trials, FDA approvals, regulatory submissions, safety data, efficacy studies
- Commercial: Business strategy, market analysis, sales agreements, partnerships, competitive landscape
- HR: Employment contracts, advisory agreements, consulting agreements, compensation, organizational structure
- Financial: Financial statements, revenue models, funding history, financial projections, accounting practices
- IP: Patents, trademarks, intellectual property portfolios, technology licensing, invention disclosures
- Research: Technical whitepapers, academic publications, research reports, technology assessments

Rules:
1. Assign to 1-3 agents maximum (minimum 1)
2. Choose agents based on document content relevance
3. Prioritize primary relevance over secondary connections
4. Consider document type, content, and business context

Respond with JSON format:
{
  "agents": ["Agent1", "Agent2"],
  "confidence": 0.85,
  "reasoning": "This document contains X and Y, making it relevant for Agent1 due to Z and Agent2 due to W"
}`;

    try {
      const responseContent = await aiClientWrapper.generateOpenAIResponse(
        "You are an AI investment analyst specializing in document classification and agent assignment for due diligence processes.",
        prompt,
        {
          model: "gpt-4o",
          temperature: 0.3,
          jsonResponse: true
        }
      );

      const result = JSON.parse(responseContent);
      
      // Validate and clean the response
      const validAgents = result.agents?.filter((agent: string) => 
        AVAILABLE_AGENTS.includes(agent as AgentType)
      ) || [];

      if (validAgents.length === 0) {
        // Fallback assignment based on document name keywords
        return this.fallbackAssignment(documentName, documentContent);
      }

      return {
        agents: validAgents.slice(0, 3), // Ensure max 3 agents
        confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
        reasoning: result.reasoning || 'AI analysis completed'
      };

    } catch (error) {
      console.error('❌ AI assignment analysis failed:', error);
      return this.fallbackAssignment(documentName, documentContent);
    }
  }

  /**
   * Fallback assignment based on keyword analysis when AI fails
   */
  private fallbackAssignment(documentName: string, content: string): AssignmentResult {
    const name = documentName.toLowerCase();
    const text = content.toLowerCase();
    const agents: AgentType[] = [];
    
    // Legal keywords
    if (this.containsKeywords(name, text, [
      'agreement', 'contract', 'legal', 'terms', 'conditions', 'license', 
      'confidential', 'nda', 'governance', 'shareholder', 'incorporation',
      'bylaws', 'articles', 'constitution', 'compliance', 'regulatory'
    ])) {
      agents.push('Legal');
    }

    // HR keywords  
    if (this.containsKeywords(name, text, [
      'employment', 'advisory', 'consulting', 'consultant', 'advisor',
      'employee', 'compensation', 'salary', 'benefits', 'hr', 'human'
    ])) {
      agents.push('HR');
    }

    // Clinical keywords
    if (this.containsKeywords(name, text, [
      'clinical', 'trial', 'medical', 'fda', 'regulatory', 'safety',
      'efficacy', 'patient', 'study', 'protocol', 'device', 'drug'
    ])) {
      agents.push('Clinical');
    }

    // Financial keywords
    if (this.containsKeywords(name, text, [
      'financial', 'revenue', 'accounting', 'audit', 'budget', 'investment',
      'funding', 'valuation', 'profit', 'loss', 'balance', 'cash'
    ])) {
      agents.push('Financial');
    }

    // IP keywords
    if (this.containsKeywords(name, text, [
      'patent', 'intellectual', 'property', 'trademark', 'copyright',
      'invention', 'technology', 'licensing', 'ip'
    ])) {
      agents.push('IP');
    }

    // Commercial keywords
    if (this.containsKeywords(name, text, [
      'business', 'commercial', 'market', 'sales', 'partnership',
      'distribution', 'strategy', 'competitive', 'customer'
    ])) {
      agents.push('Commercial');
    }

    // Research keywords
    if (this.containsKeywords(name, text, [
      'research', 'technical', 'whitepaper', 'academic', 'publication',
      'study', 'analysis', 'report', 'technology', 'innovation'
    ])) {
      agents.push('Research');
    }

    // Default to Legal if no matches found
    if (agents.length === 0) {
      agents.push('Legal');
    }

    return {
      agents: agents.slice(0, 3),
      confidence: 0.6,
      reasoning: `Fallback keyword-based assignment: ${agents.join(', ')}`
    };
  }

  /**
   * Helper to check if text contains any of the specified keywords
   */
  private containsKeywords(name: string, content: string, keywords: string[]): boolean {
    return keywords.some(keyword => 
      name.includes(keyword) || content.includes(keyword)
    );
  }

  /**
   * Process all documents for a deal and assign agents automatically
   */
  async assignAgentsForAllDocuments(dealId: number, progressCallback?: (processedCount: number, totalCount: number, currentDoc: string) => Promise<void>): Promise<DocumentAssignmentAnalysis[]> {
    console.log(`🤖 Starting AI-powered document assignment for deal ${dealId}`);
    
    // Get all documents for the deal
    const dealDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));

    console.log(`📄 Found ${dealDocuments.length} documents to analyze for assignment`);

    const results: DocumentAssignmentAnalysis[] = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const doc of dealDocuments) {
      try {
        // Skip if document has no content to analyze
        if (!doc.ocrText && !doc.aiSummary) {
          console.log(`⏭️ Skipping document ${doc.name} - no content available`);
          skippedCount++;
          // Still add to results with existing assignments or default
          if (doc.assignedAgents && doc.assignedAgents.length > 0) {
            results.push({
              documentId: doc.id,
              documentName: doc.name,
              assignedAgents: doc.assignedAgents,
              confidence: 0.5,
              reasoning: 'Using existing assignments (no content for re-analysis)'
            });
          }
          continue;
        }

        console.log(`🔍 Analyzing document ${++processedCount}/${dealDocuments.length}: ${doc.name}`);
        
        // Update progress if callback provided
        if (progressCallback) {
          await progressCallback(processedCount, dealDocuments.length, doc.name);
        }

        // Get document content for analysis
        const documentContent = doc.ocrText || '';
        
        // Perform AI assignment analysis
        const assignment = await this.analyzeDocumentForAssignment(
          doc.name,
          documentContent,
          doc.aiSummary
        );

        // Update document with new agent assignments
        await db
          .update(documents)
          .set({
            assignedAgents: assignment.agents,
            agentType: assignment.agents[0], // Set primary agent as agentType for UI compatibility
            updatedAt: new Date()
          })
          .where(eq(documents.id, doc.id));

        results.push({
          documentId: doc.id,
          documentName: doc.name,
          assignedAgents: assignment.agents,
          confidence: assignment.confidence,
          reasoning: assignment.reasoning
        });

        console.log(`✅ Document "${doc.name}" assigned to: ${assignment.agents.join(', ')} (confidence: ${Math.round(assignment.confidence * 100)}%)`);

        // Rate limiting is now handled by aiClientWrapper, so reduced delay
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error processing document ${doc.name}:`, error);
        
        // Fallback to Legal assignment if error occurs
        await db
          .update(documents)
          .set({
            assignedAgents: ['Legal'],
            agentType: 'Legal', // Set fallback agentType for UI compatibility
            updatedAt: new Date()
          })
          .where(eq(documents.id, doc.id));

        results.push({
          documentId: doc.id,
          documentName: doc.name,
          assignedAgents: ['Legal'],
          confidence: 0.3,
          reasoning: `Error during analysis - defaulted to Legal`
        });
      }
    }

    console.log(`🎯 Assignment complete! Processed ${processedCount} documents, skipped ${skippedCount}, total results: ${results.length}`);
    
    // Clear document cache to ensure frontend gets updated assignments
    if (dealDocuments.length > 0) {
      const dealId = dealDocuments[0].dealId;
      storage.invalidateDocumentCache(dealId);
      console.log(`🗂️ Cleared document cache for deal ${dealId} after assignments`);
    }
    
    // Log assignment summary
    const agentCounts = AVAILABLE_AGENTS.map(agent => ({
      agent,
      count: results.filter(r => r.assignedAgents.includes(agent)).length
    }));
    
    console.log('📊 Assignment Summary:', agentCounts);
    
    return results;
  }

  /**
   * Re-assign agents for a specific document
   */
  async reassignDocument(documentId: number): Promise<DocumentAssignmentAnalysis | null> {
    const doc = await db
      .select()
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (doc.length === 0) {
      console.error(`❌ Document ${documentId} not found`);
      return null;
    }

    const document = doc[0];
    const documentContent = document.ocrText || '';
    
    if (!documentContent && !document.aiSummary) {
      console.error(`❌ Document ${documentId} has no content for analysis`);
      return null;
    }

    const assignment = await this.analyzeDocumentForAssignment(
      document.name,
      documentContent,
      document.aiSummary
    );

    // Update document with new assignments
    await db
      .update(documents)
      .set({
        assignedAgents: assignment.agents,
        agentType: assignment.agents[0], // Set primary agent as agentType for UI compatibility
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId));

    console.log(`🔄 Document "${document.name}" reassigned to: ${assignment.agents.join(', ')}`);

    return {
      documentId: document.id,
      documentName: document.name,
      assignedAgents: assignment.agents,
      confidence: assignment.confidence,
      reasoning: assignment.reasoning
    };
  }
}

// Export singleton instance
export const aiDocumentAssignmentService = new AIDocumentAssignmentService();