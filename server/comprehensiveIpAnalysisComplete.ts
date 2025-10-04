/**
 * Comprehensive IP Analysis Service
 * Analyzes ALL assigned IP documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced IP questions for comprehensive analysis
export const COMPREHENSIVE_IP_QUESTIONS = [
  {
    id: 'patents_1',
    category: 'Patent Applications / Grants',
    question: 'What jurisdictions are covered?',
    analysisPrompt: 'Find patent applications and grants, identify the jurisdictions (countries/regions) where patents are filed or granted. Look for PCT applications, national phase entries, and specific country filings.',
    keywords: ['patent', 'jurisdiction', 'country', 'pct', 'filing', 'national phase', 'patent office', 'uspto', 'epo', 'jpo']
  },
  {
    id: 'patents_2', 
    category: 'Patent Applications / Grants',
    question: 'What is the legal status (granted, pending, expired)?',
    analysisPrompt: 'Identify the current legal status of patents - whether they are granted, pending application, expired, abandoned, or under examination. Look for patent office communications and status updates.',
    keywords: ['patent status', 'granted', 'pending', 'expired', 'abandoned', 'examination', 'patent office', 'application status']
  },
  {
    id: 'patents_3',
    category: 'Patent Applications / Grants', 
    question: 'What is the remaining protection duration?',
    analysisPrompt: 'Calculate or find information about remaining patent protection duration, patent expiry dates, maintenance fee status, and term extensions.',
    keywords: ['patent term', 'expiry', 'protection duration', 'maintenance fees', 'term extension', 'patent life']
  },
  {
    id: 'patents_4',
    category: 'Patent Applications / Grants',
    question: 'Is freedom-to-operate (FTO) mentioned?',
    analysisPrompt: 'Look for freedom-to-operate analysis, FTO studies, patent landscape analysis, or clearance opinions that assess risk of patent infringement.',
    keywords: ['freedom to operate', 'fto', 'clearance opinion', 'patent landscape', 'infringement risk', 'prior art']
  },
  {
    id: 'trademarks_1',
    category: 'Trademark Registrations',
    question: 'Which classes are covered?',
    analysisPrompt: 'Identify trademark classes (Nice Classification) covered by trademark registrations, including goods and services classifications.',
    keywords: ['trademark class', 'nice classification', 'goods', 'services', 'trademark registration', 'class coverage']
  },
  {
    id: 'trademarks_2',
    category: 'Trademark Registrations',
    question: 'Are oppositions pending?',
    analysisPrompt: 'Find any pending trademark oppositions, cancellation proceedings, or disputes related to trademark registrations.',
    keywords: ['trademark opposition', 'cancellation', 'trademark dispute', 'opposition proceeding', 'trademark conflict']
  },
  {
    id: 'trademarks_3',
    category: 'Trademark Registrations',
    question: 'Are brand extensions protected?',
    analysisPrompt: 'Look for trademark protection of brand extensions, product variants, or related brand elements beyond the core trademark.',
    keywords: ['brand extension', 'trademark portfolio', 'brand protection', 'product variants', 'trademark family']
  },
  {
    id: 'licenses_1',
    category: 'License Agreements (Inbound / Outbound)',
    question: 'Are licenses exclusive / non-exclusive?',
    analysisPrompt: 'Identify whether intellectual property licenses are exclusive or non-exclusive, including territorial and field of use restrictions.',
    keywords: ['exclusive license', 'non-exclusive license', 'licensing terms', 'territorial rights', 'field of use']
  },
  {
    id: 'licenses_2',
    category: 'License Agreements (Inbound / Outbound)', 
    question: 'Are royalties, sublicensing, revocation rights defined?',
    analysisPrompt: 'Find details about royalty rates, payment terms, sublicensing rights, termination conditions, and revocation clauses in license agreements.',
    keywords: ['royalties', 'sublicense', 'revocation', 'license termination', 'payment terms', 'licensing fees']
  },
  {
    id: 'source_1',
    category: 'Source Code Ownership Declarations',
    question: 'Is third-party code used? Which licenses?',
    analysisPrompt: 'Identify use of third-party code, open source components, libraries, and their respective licenses (GPL, MIT, Apache, etc.).',
    keywords: ['third-party code', 'open source', 'software license', 'gpl', 'mit', 'apache', 'library', 'dependency']
  },
  {
    id: 'source_2',
    category: 'Source Code Ownership Declarations',
    question: 'Are open-source usage policies in place?',
    analysisPrompt: 'Look for open source usage policies, compliance procedures, and governance frameworks for managing open source components.',
    keywords: ['open source policy', 'license compliance', 'oss governance', 'software compliance', 'code review']
  },
  {
    id: 'domain_1',
    category: 'Domain Names & Digital Assets',
    question: 'Are key domain names owned by the company?',
    analysisPrompt: 'Identify domain name ownership, key brand-related domains, and domain portfolio management.',
    keywords: ['domain name', 'website', 'brand domain', 'domain ownership', 'digital assets']
  },
  {
    id: 'trade_secrets_1',
    category: 'Trade Secrets & Confidential Information',
    question: 'Are trade secrets clearly identified and protected?',
    analysisPrompt: 'Look for trade secret identification, protection measures, confidentiality agreements, and trade secret policies.',
    keywords: ['trade secrets', 'confidential information', 'proprietary', 'nda', 'confidentiality agreement', 'know-how']
  }
];

export class ComprehensiveIpAnalysisService {
  
  /**
   * Run comprehensive analysis for all assigned IP documents
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🔐 Starting comprehensive IP analysis for deal ${dealId}`);
    
    try {
      // Get all IP documents
      const assignedDocuments = await this.getAssignedIpDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} IP documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No IP documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No IP documents available for analysis'
        });
        return { success: false, message: 'No IP documents found' };
      }
      
      // Initialize progress
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting IP analysis',
        processedDocuments: 0,
        totalDocuments: COMPREHENSIVE_IP_QUESTIONS.length
      });
      
      // Process each question systematically
      const ipAnswers: Record<string, any> = {};
      
      for (let i = 0; i < COMPREHENSIVE_IP_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_IP_QUESTIONS[i];
        console.log(`🔍 Processing IP question ${i + 1}/${COMPREHENSIVE_IP_QUESTIONS.length}: ${question.question}`);
        
        // Update progress
        const progress = Math.round(((i + 1) / COMPREHENSIVE_IP_QUESTIONS.length) * 90) + 5;
        await storageService.updateBackgroundJob(jobId, {
          progress,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`,
          processedDocuments: i
        });
        
        try {
          console.log(`📊 Extracting IP evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, 
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer based on all evidence
          const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
          ipAnswers[question.id] = answer;
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_IP_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question
          ipAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          continue;
        }
      }
      
      // Update progress to completion
      await storageService.updateBackgroundJob(jobId, {
        progress: 100,
        processedDocuments: COMPREHENSIVE_IP_QUESTIONS.length,
        currentStep: 'Generating findings and recommendations',
        status: 'completing'
      });
      
      // Generate comprehensive findings and recommendations
      const findings = this.generateComprehensiveFindings(ipAnswers);
      const recommendations = this.generateComprehensiveRecommendations(ipAnswers);
      
      // Store the analysis results
      await this.storeComprehensiveResults(dealId, ipAnswers, findings, recommendations, assignedDocuments);
      
      // Mark job as completed
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        currentStep: 'Analysis completed'
      });
      
      console.log(`✅ Comprehensive IP analysis completed for deal ${dealId}`);
      
      return {
        success: true,
        documentsAnalyzed: assignedDocuments.length,
        questionsAnswered: Object.keys(ipAnswers).length,
        findings: findings.length,
        recommendations: recommendations.length
      };
      
    } catch (error) {
      console.error(`❌ Critical error in IP analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all documents suitable for IP analysis
   */
  private async getAssignedIpDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to IP agent
    let ipDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('ip')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to IP: ${ipDocuments.length}`);
    
    // If no documents are explicitly assigned, identify IP-related documents
    if (ipDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to IP agent, identifying IP-related documents...');
      
      ipDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // IP document keywords
        const ipKeywords = [
          'patent', 'trademark', 'copyright', 'license', 'intellectual property', 'ip',
          'trade secret', 'confidential', 'proprietary', 'invention', 'innovation',
          'domain', 'brand', 'software', 'code', 'open source', 'oss', 'gpl', 'mit',
          'apache', 'licensing', 'royalty', 'fto', 'freedom to operate', 'prior art',
          'infringement', 'clearance', 'opposition', 'registration', 'filing'
        ];
        
        // Check document name and content for IP keywords
        const hasIpKeywords = ipKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for IP document type
        const isIpDocument = aiSummary?.documentType?.toLowerCase().includes('ip') ||
                            aiSummary?.documentType?.toLowerCase().includes('patent') ||
                            aiSummary?.executiveSummary?.toLowerCase().includes('intellectual property') ||
                            aiSummary?.executiveSummary?.toLowerCase().includes('patent');
        
        return hasIpKeywords || isIpDocument;
      });
      
      console.log(`📄 Auto-identified IP documents: ${ipDocuments.length}`);
    }
    
    // If still no IP documents, take documents with meaningful content for analysis
    if (ipDocuments.length === 0) {
      console.log('📄 No IP-related documents found, using all documents with OCR text...');
      ipDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`📄 Documents with content available: ${ipDocuments.length}`);
    }
    
    return ipDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    const batchSize = 10;
    const evidence = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${batch.length} documents)`);
      
      const batchResults = await Promise.all(
        batch.map(async (doc) => {
          console.log(`🔎 Extracting evidence from: ${doc.name}`);
          return this.extractEvidenceFromDocument(doc, question);
        })
      );
      
      const validEvidence = batchResults.filter(docEvidence => 
        docEvidence && docEvidence.relevantContent.length > 0
      );
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${validEvidence.length}/${batch.length} documents had relevant evidence`);
    }
    
    console.log(`📋 Extracted evidence from ${evidence.length}/${documents.length} documents`);
    return evidence;
  }
  
  /**
   * Extract specific evidence from a single document
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    const content = document.ocrText || document.aiSummary?.executiveSummary || '';
    
    if (!content) return null;
    
    const prompt = `You are an expert IP analyst conducting comprehensive investment analysis. Your task is to find ANY intellectual property, patent, trademark, licensing, or confidential information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Look for DIRECT IP terms, patents, trademarks, licenses, trade secrets, copyrights
- Look for INDIRECT references to proprietary technology, innovation, brand protection, software licensing
- Consider business documents that mention IP assets, licensing deals, technology protection, brand strategy
- Even general business context often has IP implications for investment due diligence
- For technology companies, most business documents contain IP information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "ipContext": "How this document relates to IP/technology protection aspects of the business"
}

Be thorough in finding relevance - most business documents have IP implications for investment analysis.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: analysis.relevantContent || [],
        hasRelevantInfo: analysis.hasRelevantInfo || false,
        confidence: analysis.confidence || 0,
        keyFindings: analysis.keyFindings || [],
        documentSummary: analysis.documentSummary || '',
        fullContent: content.substring(0, 1000)
      };
      
    } catch (error) {
      console.error(`Error extracting evidence from ${document.name}:`, error);
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: [],
        hasRelevantInfo: false,
        confidence: 0,
        keyFindings: [],
        documentSummary: 'Analysis failed',
        fullContent: content.substring(0, 1000)
      };
    }
  }
  
  /**
   * Compile comprehensive answer based on all evidence
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No evidence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant IP information found in the assigned IP documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant IP information found'],
        category: question.category
      };
    }

    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    const prompt = `You are an expert IP analyst compiling a comprehensive answer based on evidence from multiple documents.

QUESTION: "${question.question}"
CATEGORY: ${question.category}
ANALYSIS TASK: ${question.analysisPrompt}

EVIDENCE FROM DOCUMENTS:
${evidenceSummary.map(ev => `
DOCUMENT: ${ev.document}
CONTENT: ${ev.content}
KEY FINDINGS: ${ev.findings}
CONFIDENCE: ${ev.confidence}%
`).join('\n')}

Instructions:
1. Synthesize ALL evidence into a comprehensive answer
2. Cite specific documents and quotes
3. Identify gaps in information
4. Provide confidence assessment
5. Include IP recommendations

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "ipAssessment": "Overall IP assessment based on evidence",
  "evidenceCount": ${evidence.length}
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2000
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: compiledAnswer.sources || evidence.map(e => e.documentName),
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        ipAssessment: compiledAnswer.ipAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error) {
      console.error(`Error compiling answer for "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName),
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
        recommendations: ['Manual review required'],
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_IP_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'IP Documents',
          confidence: answer.confidence / 100,
          category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          evidenceCount: answer.evidenceCount || 0
        });
      }
      
      // Risk findings for low confidence or gaps
      if (answer.confidence < 50 || (answer.gaps && answer.gaps.length > 0)) {
        findings.push({
          id: findings.length + 1,
          type: 'risk',
          content: `Insufficient IP information for: ${question.question}. Additional documentation may be required.`,
          source: 'IP Analysis',
          confidence: 0.3,
          category: 'gaps',
          evidenceCount: answer.evidenceCount || 0
        });
      }
    }
    
    return findings;
  }
  
  /**
   * Generate comprehensive recommendations
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer.recommendations && answer.recommendations.length > 0) {
        for (const rec of answer.recommendations) {
          recommendations.push({
            title: `IP Due Diligence: ${answer.question}`,
            description: rec,
            priority: answer.confidence < 60 ? 'high' : 'medium',
            category: 'ip',
            impact: answer.confidence < 40 ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Documentation Gap: ${answer.question}`,
          description: `Missing IP information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'ip',
          impact: 'critical'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Store comprehensive analysis results
   */
  private async storeComprehensiveResults(
    dealId: number, 
    ipAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documentsAnalyzed: any[]
  ): Promise<void> {
    // First, delete any existing IP analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'ip')
      ));
    
    console.log(`🗑️ Cleared existing IP analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'ip' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      ipAnswers: JSON.stringify(ipAnswers),
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive IP analysis for deal ${dealId} with ${Object.keys(ipAnswers).length} questions answered`);
  }
}

// Export the service instance
export const comprehensiveIpAnalysisService = new ComprehensiveIpAnalysisService();