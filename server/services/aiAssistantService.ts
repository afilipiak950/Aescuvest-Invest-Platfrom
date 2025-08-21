/**
 * Aescuvest AI Assistant Service
 * Ultra-powerful AI assistant with complete access to all OCR, AI summaries, and agent analyses
 * Can answer ANY question about the company, documents, and due diligence
 */

import { db } from '../db';
import { documents, agentAnalyses, deals } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from '../storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache for pre-loaded contexts to avoid reloading
const contextCache = new Map<number, {
  documentContext: DocumentContext[];
  agentContext: AgentContext[];
  companyContext: CompanyContext | null;
  loadedAt: Date;
}>();

interface DocumentContext {
  name: string;
  ocrText: string;
  aiSummary: any;
  agentType?: string;
}

interface AgentContext {
  agentType: string;
  findings: any[];
  recommendations: any[];
  answers: any;
  completionRate: number;
}

interface CompanyContext {
  companyName: string;
  description: string;
  stage: string;
  sector: string;
  founded: string;
  website: string;
  location: string;
  team: string;
  summary: string;
  ceoName: string;
  ceoBackground: string;
  competitorAnalysis: any;
  researchFindings: any;
}

export class AescuvestAIAssistant {
  private dealId: number;
  private documentContext: DocumentContext[] = [];
  private agentContext: AgentContext[] = [];
  private companyContext: CompanyContext | null = null;
  private systemPrompt: string;
  private isContextLoaded: boolean = false;

  constructor(dealId: number) {
    this.dealId = dealId;
    
    // Check if we have cached context (less than 5 minutes old)
    const cached = contextCache.get(dealId);
    if (cached && (Date.now() - cached.loadedAt.getTime()) < 5 * 60 * 1000) {
      console.log(`🚀 Using cached context for deal ${dealId}`);
      this.documentContext = cached.documentContext;
      this.agentContext = cached.agentContext;
      this.companyContext = cached.companyContext;
      this.isContextLoaded = true;
    }
    this.systemPrompt = `You are the Aescuvest AI Assistant, an ultra-intelligent investment analysis assistant with comprehensive knowledge of all deal documents, due diligence reports, and agent analyses.

You have access to:
1. Complete OCR text from all documents
2. AI-generated summaries for each document
3. Specialized agent analyses (Legal, Clinical, Commercial, Financial, IP, HR, Research)
4. Company information and competitive intelligence
5. Investment recommendations and risk assessments

Your capabilities:
- Answer ANY question about the company, documents, or analyses
- Provide specific quotes and references from documents
- Synthesize information across multiple sources
- Identify patterns, risks, and opportunities
- Offer investment insights based on comprehensive data
- Compare findings across different agent analyses
- Highlight critical information for investment decisions

Always be specific, cite sources when possible, and provide actionable insights.`;
  }

  async loadCompleteContext(): Promise<void> {
    // Skip if already loaded from cache
    if (this.isContextLoaded) {
      console.log(`✅ Context already loaded from cache`);
      return;
    }
    
    console.log(`🤖 Loading complete context for deal ${this.dealId}...`);
    const startTime = Date.now();
    
    // Load all in parallel for speed
    await Promise.all([
      this.loadDocumentContext(),
      this.loadAgentContext(),
      this.loadCompanyContext()
    ]);
    
    // Cache the loaded context
    contextCache.set(this.dealId, {
      documentContext: this.documentContext,
      agentContext: this.agentContext,
      companyContext: this.companyContext,
      loadedAt: new Date()
    });
    
    this.isContextLoaded = true;
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Context loaded in ${loadTime}s: ${this.documentContext.length} documents, ${this.agentContext.length} agent analyses`);
  }

  private async loadDocumentContext(): Promise<void> {
    try {
      const docResults = await db.select().from(documents).where(eq(documents.dealId, this.dealId));
      
      for (const doc of docResults) {
        // Include both OCR text and AI summary for maximum context
        const ocrText = typeof doc.ocrText === 'string' ? doc.ocrText : '';
        const aiSummary = doc.aiSummary || {};
        
        this.documentContext.push({
          name: doc.name,
          ocrText: ocrText.substring(0, 50000), // Limit to 50k chars per doc for context window
          aiSummary: aiSummary,
          agentType: doc.agentType
        });
      }
      
      console.log(`📄 Loaded ${this.documentContext.length} documents with OCR and AI summaries`);
    } catch (error) {
      console.error('Error loading document context:', error);
    }
  }

  private async loadAgentContext(): Promise<void> {
    try {
      // Load all agent analyses for this deal
      const analyses = await db.select()
        .from(agentAnalyses)
        .where(eq(agentAnalyses.dealId, this.dealId))
        .orderBy(desc(agentAnalyses.createdAt));
      
      // Group by agent type and get the most recent complete analysis
      const agentMap = new Map<string, any>();
      
      for (const analysis of analyses) {
        const agentType = analysis.agentType.toLowerCase();
        if (!agentMap.has(agentType) && analysis.status === 'completed') {
          // Parse all the different answer fields
          let answers = {};
          if (analysis.legal_answers) answers = analysis.legal_answers;
          else if (analysis.clinical_answers) answers = { clinicalAnswers: analysis.clinical_answers };
          else if (analysis.commercial_answers) answers = analysis.commercial_answers;
          else if (analysis.financial_answers) answers = analysis.financial_answers;
          else if (analysis.ip_answers) answers = analysis.ip_answers;
          else if (analysis.hr_answers) answers = analysis.hr_answers;
          else if (analysis.research_answers) answers = analysis.research_answers;
          
          agentMap.set(agentType, {
            agentType: analysis.agentType,
            findings: analysis.findings || [],
            recommendations: analysis.recommendations || [],
            answers: answers,
            completionRate: analysis.completion_rate || 0
          });
        }
      }
      
      this.agentContext = Array.from(agentMap.values());
      console.log(`🔬 Loaded ${this.agentContext.length} agent analyses`);
    } catch (error) {
      console.error('Error loading agent context:', error);
    }
  }

  private async loadCompanyContext(): Promise<void> {
    try {
      const dealData = await db.select()
        .from(deals)
        .where(eq(deals.id, this.dealId))
        .limit(1);
      
      if (dealData.length > 0) {
        const deal = dealData[0];
        
        // Use deal data directly since companies table doesn't exist
        this.companyContext = {
          companyName: deal.companyName,
          description: deal.description || '',
          stage: deal.stage,
          sector: deal.sector || '',
          founded: '',
          website: deal.website || '',
          location: deal.location || '',
          team: '',
          summary: '',
          ceoName: '',
          ceoBackground: '',
          competitorAnalysis: {},
          researchFindings: {}
        };
        
        console.log(`🏢 Loaded company context for ${this.companyContext.companyName}`);
      }
    } catch (error) {
      console.error('Error loading company context:', error);
    }
  }

  private buildContextPrompt(): string {
    let contextPrompt = 'COMPLETE DEAL CONTEXT:\n\n';
    
    // Add company context
    if (this.companyContext) {
      contextPrompt += `COMPANY INFORMATION:\n`;
      contextPrompt += `Company: ${this.companyContext.companyName}\n`;
      contextPrompt += `Stage: ${this.companyContext.stage}\n`;
      contextPrompt += `Sector: ${this.companyContext.sector}\n`;
      contextPrompt += `Description: ${this.companyContext.description}\n`;
      if (this.companyContext.ceoName) {
        contextPrompt += `CEO: ${this.companyContext.ceoName}\n`;
        contextPrompt += `CEO Background: ${this.companyContext.ceoBackground}\n`;
      }
      contextPrompt += '\n';
    }
    
    // Add agent analyses context
    if (this.agentContext.length > 0) {
      contextPrompt += `AGENT ANALYSES:\n`;
      for (const agent of this.agentContext) {
        contextPrompt += `\n${agent.agentType.toUpperCase()} AGENT (${agent.completionRate}% complete):\n`;
        
        // Add findings
        if (agent.findings && agent.findings.length > 0) {
          contextPrompt += `Key Findings: ${JSON.stringify(agent.findings.slice(0, 5))}\n`;
        }
        
        // Add recommendations
        if (agent.recommendations && agent.recommendations.length > 0) {
          contextPrompt += `Recommendations: ${JSON.stringify(agent.recommendations.slice(0, 3))}\n`;
        }
        
        // Add specific answers
        if (agent.answers && Object.keys(agent.answers).length > 0) {
          contextPrompt += `Analysis Details: ${JSON.stringify(agent.answers).substring(0, 2000)}...\n`;
        }
      }
      contextPrompt += '\n';
    }
    
    // Add document summaries (prioritize AI summaries over raw OCR)
    if (this.documentContext.length > 0) {
      contextPrompt += `\nDOCUMENT SUMMARIES (${this.documentContext.length} documents):\n`;
      
      // Group documents by type for better organization
      const docsByType = new Map<string, DocumentContext[]>();
      for (const doc of this.documentContext) {
        const type = doc.agentType || 'general';
        if (!docsByType.has(type)) {
          docsByType.set(type, []);
        }
        docsByType.get(type)!.push(doc);
      }
      
      // Add summaries by type
      for (const [type, docs] of Array.from(docsByType)) {
        contextPrompt += `\n[${type.toUpperCase()} Documents]:\n`;
        for (const doc of docs.slice(0, 10)) { // Limit to 10 docs per type
          contextPrompt += `\nDocument: ${doc.name}\n`;
          
          // Prioritize AI summary if available
          if (doc.aiSummary && doc.aiSummary.executiveSummary) {
            contextPrompt += `Summary: ${doc.aiSummary.executiveSummary}\n`;
            if (doc.aiSummary.criticalFindings) {
              contextPrompt += `Critical Findings: ${JSON.stringify(doc.aiSummary.criticalFindings)}\n`;
            }
          } else if (doc.ocrText) {
            // Fall back to OCR excerpt if no AI summary
            contextPrompt += `Content Excerpt: ${doc.ocrText.substring(0, 500)}...\n`;
          }
        }
      }
    }
    
    return contextPrompt;
  }

  async processQuery(query: string): Promise<string> {
    // Ensure context is loaded (will use cache if available)
    if (!this.isContextLoaded) {
      await this.loadCompleteContext();
    }
    
    const contextPrompt = this.buildContextPrompt();
    
    // Build the messages for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.systemPrompt
      },
      {
        role: 'user',
        content: `${contextPrompt}\n\nUSER QUESTION: ${query}\n\nProvide a comprehensive answer based on all available data. Be specific and cite document names or agent analyses when referencing information.`
      }
    ];
    
    try {
      console.log(`🤖 Processing query with ${this.documentContext.length} documents and ${this.agentContext.length} agent analyses`);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.3,
        max_tokens: 2000
      });
      
      return response.choices[0].message.content || 'I was unable to generate a response.';
    } catch (error) {
      console.error('Error processing AI query:', error);
      throw error;
    }
  }

  async streamQuery(query: string): Promise<AsyncIterable<string>> {
    // Ensure context is loaded (will use cache if available)
    if (!this.isContextLoaded) {
      await this.loadCompleteContext();
    }
    
    const contextPrompt = this.buildContextPrompt();
    
    // Build the messages for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.systemPrompt
      },
      {
        role: 'user',
        content: `${contextPrompt}\n\nUSER QUESTION: ${query}\n\nProvide a comprehensive answer based on all available data. Be specific and cite document names or agent analyses when referencing information.`
      }
    ];
    
    try {
      console.log(`🤖 Streaming query with ${this.documentContext.length} documents and ${this.agentContext.length} agent analyses`);
      
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.3,
        max_tokens: 2000,
        stream: true
      });
      
      // Return async generator for streaming
      return (async function* () {
        for await (const chunk of stream) {
          if (chunk.choices[0]?.delta?.content) {
            yield chunk.choices[0].delta.content;
          }
        }
      })();
    } catch (error) {
      console.error('Error streaming AI query:', error);
      throw error;
    }
  }

  // Get context statistics for UI display
  getContextStats() {
    return {
      documentsLoaded: this.documentContext.length,
      agentAnalyses: this.agentContext.length,
      hasCompanyInfo: !!this.companyContext,
      totalContextSize: this.documentContext.reduce((acc, doc) => acc + (doc.ocrText?.length || 0), 0)
    };
  }
}