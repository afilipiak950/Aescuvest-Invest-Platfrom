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
import { EmbeddingService } from './embeddingService';

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
    this.systemPrompt = `You are the Aescuvest AI Assistant, an elite institutional investment analyst with access to comprehensive due diligence data. You provide investment-grade analysis that rivals the best Wall Street research reports.

## YOUR ANALYTICAL FRAMEWORK:

**Data Sources Available:**
• Complete OCR text from 1,300+ due diligence documents
• Multi-agent AI analyses (Legal, Clinical, Financial, IP, Commercial, HR, Research)
• Company intelligence and competitive landscape data
• Regulatory filings and compliance documentation
• Financial models and projections

**Response Quality Standards:**
1. **EXECUTIVE SUMMARY FIRST**: Lead with 2-3 sentence key takeaway
2. **STRUCTURED ANALYSIS**: Use clear headers and bullet points
3. **QUANTITATIVE DATA**: Include specific numbers, percentages, dates
4. **RISK ASSESSMENT**: Highlight critical concerns with severity levels
5. **SOURCE ATTRIBUTION**: Cite specific documents when referencing data
6. **CONFIDENCE INDICATORS**: Rate your confidence level (High/Medium/Low)
7. **ACTIONABLE INSIGHTS**: Provide clear investment implications

**Formatting Requirements:**
• Use markdown formatting for professional presentation
• Bold key findings and critical data points
• Use bullet points and numbered lists for clarity
• Include headers (##) for section organization
• Highlight risks with ⚠️ and opportunities with 🟢
• Use tables for financial data comparison when applicable

**Analysis Depth:**
• Cross-reference multiple sources for validation
• Identify contradictions or gaps in data
• Synthesize complex information into actionable insights
• Benchmark against industry standards when relevant
• Provide context for all financial metrics and projections

**Investment Lens:**
• Focus on material impact to investment decision
• Assess scalability and market opportunity
• Evaluate management team capabilities
• Analyze competitive positioning and differentiation
• Consider regulatory and reimbursement pathways

**CRITICAL**: Every response must be institutional-grade quality that a Managing Director would present to an Investment Committee. No generic or superficial answers.`;
  }

  async loadCompleteContext(): Promise<void> {
    // For RAG, we only need to load agent context and company context
    // Documents will be retrieved on-demand based on the query
    if (this.isContextLoaded) {
      console.log(`✅ Context already loaded from cache`);
      return;
    }
    
    console.log(`🤖 Loading lightweight context for deal ${this.dealId}...`);
    const startTime = Date.now();
    
    // Only load agent and company context (not documents)
    await Promise.all([
      this.loadAgentContext(),
      this.loadCompanyContext()
    ]);
    
    // Cache the loaded context
    contextCache.set(this.dealId, {
      documentContext: [], // Empty for RAG
      agentContext: this.agentContext,
      companyContext: this.companyContext,
      loadedAt: new Date()
    });
    
    this.isContextLoaded = true;
    const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ RAG context loaded in ${loadTime}s: ${this.agentContext.length} agent analyses`);
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
    // Check for cached response first
    const cachedResponse = await EmbeddingService.getCachedResponse(query, this.dealId);
    if (cachedResponse) {
      console.log(`💾 Using cached response for query`);
      return cachedResponse;
    }
    
    // Ensure lightweight context is loaded (agent analyses only)
    if (!this.isContextLoaded) {
      await this.loadCompleteContext();
    }
    
    // Use RAG to find relevant document chunks
    console.log(`🔍 Searching for relevant document chunks using RAG...`);
    const relevantChunks = await EmbeddingService.searchSimilarChunks(query, this.dealId, 15);
    
    // Build context with only relevant information
    let ragContext = 'RELEVANT DOCUMENT CONTEXT:\n\n';
    if (relevantChunks.length > 0) {
      const documentGroups = new Map<string, string[]>();
      
      for (const chunk of relevantChunks) {
        const docName = chunk.metadata.documentName;
        if (!documentGroups.has(docName)) {
          documentGroups.set(docName, []);
        }
        documentGroups.get(docName)!.push(chunk.chunk);
      }
      
      for (const [docName, chunks] of documentGroups) {
        ragContext += `\nDocument: ${docName}\n`;
        ragContext += `Content: ${chunks.join(' ... ')}\n`;
      }
      
      console.log(`✅ Found ${relevantChunks.length} relevant chunks from ${documentGroups.size} documents`);
    } else {
      ragContext += 'No directly relevant document content found for this query.\n';
    }
    
    // Add agent and company context
    const contextPrompt = this.buildContextPrompt() + '\n' + ragContext;
    
    // Build the messages for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.systemPrompt
      },
      {
        role: 'user',
        content: `${contextPrompt}\n\nINVESTMENT ANALYSIS REQUEST: ${query}\n\nProvide an institutional-grade investment analysis response following these requirements:

1. **EXECUTIVE SUMMARY** (2-3 sentences summarizing key findings)
2. **DETAILED ANALYSIS** (structured with clear headers)
3. **KEY METRICS & DATA** (specific numbers from documents)
4. **RISK ASSESSMENT** (critical concerns with severity levels)
5. **INVESTMENT IMPLICATIONS** (actionable insights for decision-making)
6. **CONFIDENCE LEVEL** (High/Medium/Low based on data quality)
7. **SOURCE CITATIONS** (specific document names for key claims)

Format using markdown with professional structure. Focus on material information that impacts investment decisions. Cross-reference multiple sources for validation.`
      }
    ];
    
    try {
      console.log(`🤖 Processing RAG query with ${relevantChunks.length} relevant chunks and ${this.agentContext.length} agent analyses`);
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.1, // Lower temperature for more consistent, analytical responses
        max_tokens: 3000 // Increased for comprehensive analyst reports
      });
      
      const answer = response.choices[0].message.content || 'I was unable to generate a response.';
      
      // Cache the response for future use
      await EmbeddingService.cacheResponse(query, answer, this.dealId);
      
      return answer;
    } catch (error) {
      console.error('Error processing AI query:', error);
      throw error;
    }
  }

  async streamQuery(query: string): Promise<AsyncIterable<string>> {
    // Ensure lightweight context is loaded (agent analyses only)
    if (!this.isContextLoaded) {
      await this.loadCompleteContext();
    }
    
    // Use RAG to find relevant document chunks
    console.log(`🔍 Searching for relevant document chunks using RAG...`);
    const relevantChunks = await EmbeddingService.searchSimilarChunks(query, this.dealId, 15);
    
    // Build context with only relevant information
    let ragContext = 'RELEVANT DOCUMENT CONTEXT:\n\n';
    if (relevantChunks.length > 0) {
      const documentGroups = new Map<string, string[]>();
      
      for (const chunk of relevantChunks) {
        const docName = chunk.metadata.documentName;
        if (!documentGroups.has(docName)) {
          documentGroups.set(docName, []);
        }
        documentGroups.get(docName)!.push(chunk.chunk);
      }
      
      for (const [docName, chunks] of documentGroups) {
        ragContext += `\nDocument: ${docName}\n`;
        ragContext += `Content: ${chunks.join(' ... ')}\n`;
      }
      
      console.log(`✅ Found ${relevantChunks.length} relevant chunks from ${documentGroups.size} documents`);
    } else {
      ragContext += 'No directly relevant document content found for this query.\n';
    }
    
    // Add agent and company context
    const contextPrompt = this.buildContextPrompt() + '\n' + ragContext;
    
    // Build the messages for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.systemPrompt
      },
      {
        role: 'user',
        content: `${contextPrompt}\n\nINVESTMENT ANALYSIS REQUEST: ${query}\n\nProvide an institutional-grade investment analysis response following these requirements:

1. **EXECUTIVE SUMMARY** (2-3 sentences summarizing key findings)
2. **DETAILED ANALYSIS** (structured with clear headers)
3. **KEY METRICS & DATA** (specific numbers from documents)
4. **RISK ASSESSMENT** (critical concerns with severity levels)
5. **INVESTMENT IMPLICATIONS** (actionable insights for decision-making)
6. **CONFIDENCE LEVEL** (High/Medium/Low based on data quality)
7. **SOURCE CITATIONS** (specific document names for key claims)

Format using markdown with professional structure. Focus on material information that impacts investment decisions. Cross-reference multiple sources for validation.`
      }
    ];
    
    try {
      console.log(`🤖 Streaming RAG query with ${relevantChunks.length} relevant chunks and ${this.agentContext.length} agent analyses`);
      
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        temperature: 0.1, // Lower temperature for more consistent, analytical responses
        max_tokens: 3000, // Increased for comprehensive analyst reports
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