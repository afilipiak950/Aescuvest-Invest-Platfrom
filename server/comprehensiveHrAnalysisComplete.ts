/**
 * Comprehensive HR Analysis Service
 * Analyzes ALL assigned HR documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced HR questions for comprehensive analysis - covering all 7 categories
export const COMPREHENSIVE_HR_QUESTIONS = [
  // 1. Employment Contracts (Employees) - 8 questions
  {
    id: 'employment_1',
    question: 'Are all employment contracts signed and dated?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Check for signed and dated employment contracts, contract completion status, and documentation compliance.',
    keywords: ['employment contract', 'signed', 'dated', 'employee agreement', 'employment terms']
  },
  {
    id: 'employment_2', 
    question: 'Are notice periods in line with local labor law or extended?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Review termination notice periods, labor law compliance, and contractual notice requirements.',
    keywords: ['notice period', 'termination notice', 'labor law', 'employment notice']
  },
  {
    id: 'employment_3',
    question: 'Are probation periods defined? If yes, how long?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Identify probationary periods, trial periods, and initial employment terms.',
    keywords: ['probation', 'probationary period', 'trial period', 'initial employment']
  },
  {
    id: 'employment_4',
    question: 'Are termination clauses (ordinary, extraordinary) present?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Find termination conditions, dismissal clauses, and employment termination procedures.',
    keywords: ['termination clause', 'dismissal', 'termination conditions', 'employment termination']
  },
  {
    id: 'employment_5',
    question: 'Is there mention of confidentiality, IP assignment, and post-contractual non-compete?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Look for confidentiality agreements, intellectual property assignments, and non-compete clauses.',
    keywords: ['confidentiality', 'intellectual property', 'non-compete', 'IP assignment', 'trade secrets']
  },
  {
    id: 'employment_6',
    question: 'Are variable components (bonuses, stock options, commissions) clearly described and performance-based?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Analyze variable compensation structures, bonus schemes, equity compensation, and performance linkage.',
    keywords: ['bonus', 'variable pay', 'stock options', 'commission', 'incentive compensation', 'performance-based']
  },
  {
    id: 'employment_7',
    question: 'Are working hours, overtime rules, and leave entitlements defined?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Review working time regulations, overtime policies, vacation entitlements, and leave policies.',
    keywords: ['working hours', 'overtime', 'leave', 'vacation', 'working time', 'time off']
  },
  {
    id: 'employment_8',
    question: 'Are there unusual clauses (e.g. guaranteed salary raises, minimum employment duration)?',
    category: 'Employment Contracts (Employees)',
    analysisPrompt: 'Identify unusual contractual provisions, guaranteed benefits, and special employment terms.',
    keywords: ['unusual clauses', 'guaranteed salary', 'salary raises', 'minimum employment', 'employment duration']
  },
  
  // 2. Executive/Managing Director Contracts - 5 questions
  {
    id: 'executive_1',
    question: 'Is the total compensation package broken down (base, bonus, equity)?',
    category: 'Executive/Managing Director Contracts',
    analysisPrompt: 'Analyze executive compensation structure, base salary, bonus components, and equity participation.',
    keywords: ['executive compensation', 'total compensation', 'base salary', 'executive pay', 'management compensation']
  },
  {
    id: 'executive_2',
    question: 'Are KPI-driven bonuses explicitly defined?',
    category: 'Executive/Managing Director Contracts',
    analysisPrompt: 'Review performance-based compensation, KPI definitions, and bonus calculation methods.',
    keywords: ['KPI bonus', 'performance bonus', 'key performance indicators', 'executive bonus']
  },
  {
    id: 'executive_3',
    question: 'Are severance packages or golden parachutes included?',
    category: 'Executive/Managing Director Contracts',
    analysisPrompt: 'Identify severance arrangements, termination benefits, and executive protection clauses.',
    keywords: ['severance', 'golden parachute', 'executive severance', 'termination benefits']
  },
  {
    id: 'executive_4',
    question: 'Are liability exclusions or indemnity clauses included?',
    category: 'Executive/Managing Director Contracts',
    analysisPrompt: 'Look for executive liability protection, indemnification provisions, and risk allocation.',
    keywords: ['liability exclusion', 'indemnity clause', 'executive liability', 'indemnification']
  },
  {
    id: 'executive_5',
    question: 'Are change-of-control provisions defined?',
    category: 'Executive/Managing Director Contracts',
    analysisPrompt: 'Review change of control triggers, acceleration provisions, and transaction-related benefits.',
    keywords: ['change of control', 'acceleration', 'transaction benefits', 'control provisions']
  },

  // 3. Employee Stock Option Plans (ESOPs) - 4 questions  
  {
    id: 'esop_1',
    question: 'What is the total percentage allocated to employee stock options?',
    category: 'Employee Stock Option Plans (ESOPs)',
    analysisPrompt: 'Identify ESOP pool size, equity allocation percentages, and option pool capacity.',
    keywords: ['ESOP', 'stock options', 'equity pool', 'option allocation', 'employee equity']
  },
  {
    id: 'esop_2',
    question: 'Are vesting schedules defined (cliff, linear, milestone-based)?',
    category: 'Employee Stock Option Plans (ESOPs)',
    analysisPrompt: 'Analyze vesting schedules, cliff periods, milestone triggers, and vesting acceleration.',
    keywords: ['vesting schedule', 'cliff vesting', 'milestone vesting', 'vesting acceleration']
  },
  {
    id: 'esop_3',
    question: 'Are exercise prices / strike prices documented?',
    category: 'Employee Stock Option Plans (ESOPs)',
    analysisPrompt: 'Review option exercise prices, strike prices, valuation methods, and pricing policies.',
    keywords: ['exercise price', 'strike price', 'option pricing', 'valuation']
  },
  {
    id: 'esop_4',
    question: 'Are leaver provisions (good vs. bad leaver) clear?',
    category: 'Employee Stock Option Plans (ESOPs)',
    analysisPrompt: 'Examine leaver categories, good/bad leaver definitions, and equity treatment upon departure.',
    keywords: ['leaver provisions', 'good leaver', 'bad leaver', 'equity forfeiture']
  },

  // 4. Consultant/Advisor Agreements - 3 questions
  {
    id: 'consultant_1',
    question: 'Are consultant/advisor equity grants documented?',
    category: 'Consultant/Advisor Agreements',
    analysisPrompt: 'Review consultant equity compensation, advisor grants, and external service provider equity.',
    keywords: ['consultant equity', 'advisor grants', 'external equity', 'service provider compensation']
  },
  {
    id: 'consultant_2',
    question: 'Are deliverables and milestones clearly defined?',
    category: 'Consultant/Advisor Agreements',
    analysisPrompt: 'Analyze deliverable specifications, milestone definitions, and performance expectations.',
    keywords: ['deliverables', 'milestones', 'consultant scope', 'advisor responsibilities']
  },
  {
    id: 'consultant_3',
    question: 'Are termination conditions fair and mutual?',
    category: 'Consultant/Advisor Agreements',
    analysisPrompt: 'Evaluate termination provisions, notice requirements, and mutual termination rights.',
    keywords: ['termination conditions', 'consultant termination', 'mutual termination', 'advisory termination']
  },

  // 5. Organizational Chart - 3 questions
  {
    id: 'org_1',
    question: 'Is the reporting structure clear?',
    category: 'Organizational Chart',
    analysisPrompt: 'Review organizational hierarchy, reporting relationships, and management structure clarity.',
    keywords: ['organizational chart', 'reporting structure', 'hierarchy', 'management structure']
  },
  {
    id: 'org_2',
    question: 'Are key roles (C-level, VP-level) filled?',
    category: 'Organizational Chart',
    analysisPrompt: 'Identify key leadership positions, C-level roles, VP-level positions, and organizational completeness.',
    keywords: ['key roles', 'C-level', 'VP-level', 'leadership positions', 'executive team']
  },
  {
    id: 'org_3',
    question: 'Are there succession plans for key positions?',
    category: 'Organizational Chart',
    analysisPrompt: 'Look for succession planning, key person risk mitigation, and leadership continuity plans.',
    keywords: ['succession planning', 'key person risk', 'leadership continuity', 'succession plans']
  },

  // 6. HR Policies - 4 questions
  {
    id: 'hr_1',
    question: 'Are disciplinary procedures documented?',
    category: 'HR Policies',
    analysisPrompt: 'Review disciplinary policies, progressive discipline procedures, and employee conduct management.',
    keywords: ['disciplinary procedures', 'employee discipline', 'conduct policies', 'progressive discipline']
  },
  {
    id: 'hr_2',
    question: 'Are grievance handling processes in place?',
    category: 'HR Policies',
    analysisPrompt: 'Analyze grievance procedures, complaint handling, and employee dispute resolution processes.',
    keywords: ['grievance procedures', 'complaint handling', 'dispute resolution', 'employee grievances']
  },
  {
    id: 'hr_3',
    question: 'Are diversity and inclusion policies documented?',
    category: 'HR Policies',
    analysisPrompt: 'Examine diversity policies, inclusion initiatives, equal opportunity provisions, and anti-discrimination measures.',
    keywords: ['diversity policies', 'inclusion', 'equal opportunity', 'anti-discrimination', 'workplace diversity']
  },
  {
    id: 'hr_4',
    question: 'Are performance review processes standardized?',
    category: 'HR Policies',
    analysisPrompt: 'Review performance management systems, review processes, evaluation standards, and feedback mechanisms.',
    keywords: ['performance review', 'performance management', 'evaluation processes', 'employee assessment']
  },

  // 7. Compliance Documentation - 5 questions
  {
    id: 'compliance_1',
    question: 'Are labor law compliance certificates current?',
    category: 'Compliance Documentation',
    analysisPrompt: 'Check labor law compliance status, regulatory certificates, and employment law adherence.',
    keywords: ['labor law compliance', 'compliance certificates', 'employment law', 'regulatory compliance']
  },
  {
    id: 'compliance_2',
    question: 'Are workplace safety protocols documented?',
    category: 'Compliance Documentation',
    analysisPrompt: 'Review workplace safety policies, OSHA compliance, safety protocols, and risk management.',
    keywords: ['workplace safety', 'safety protocols', 'OSHA compliance', 'safety policies']
  },
  {
    id: 'compliance_3',
    question: 'Are data protection/privacy policies in place?',
    category: 'Compliance Documentation',
    analysisPrompt: 'Analyze data protection policies, privacy compliance, GDPR adherence, and employee data security.',
    keywords: ['data protection', 'privacy policies', 'GDPR compliance', 'employee data', 'privacy']
  },
  {
    id: 'compliance_4',
    question: 'Are training records and certifications maintained?',
    category: 'Compliance Documentation',
    analysisPrompt: 'Review training documentation, certification records, professional development tracking, and skills maintenance.',
    keywords: ['training records', 'certifications', 'professional development', 'skills training']
  },
  {
    id: 'compliance_5',
    question: 'Are whistleblower protection policies documented?',
    category: 'Compliance Documentation',
    analysisPrompt: 'Look for whistleblower policies, protection mechanisms, reporting procedures, and ethics compliance.',
    keywords: ['whistleblower protection', 'ethics policies', 'reporting mechanisms', 'compliance reporting']
  }
];

export class ComprehensiveHrAnalysisService {
  
  /**
   * Run comprehensive analysis for all assigned HR documents
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`👥 Starting comprehensive HR analysis for deal ${dealId}`);
    
    try {
      // Get all HR documents
      const assignedDocuments = await this.getAssignedHrDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} HR documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No HR documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No HR documents available for analysis'
        });
        return { success: false, message: 'No HR documents found' };
      }
      
      // Initialize progress
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting HR analysis',
        processedDocuments: 0,
        totalDocuments: COMPREHENSIVE_HR_QUESTIONS.length
      });
      
      // Process each question systematically
      const hrAnswers: Record<string, any> = {};
      
      for (let i = 0; i < COMPREHENSIVE_HR_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_HR_QUESTIONS[i];
        console.log(`🔍 Processing HR question ${i + 1}/${COMPREHENSIVE_HR_QUESTIONS.length}: ${question.question}`);
        
        // Update progress
        const progress = Math.round(((i + 1) / COMPREHENSIVE_HR_QUESTIONS.length) * 90) + 5;
        await storageService.updateBackgroundJob(jobId, {
          progress,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`,
          processedDocuments: i
        });
        
        try {
          console.log(`📊 Extracting HR evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, 
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer based on all evidence
          const answer = await this.compileComprehensiveAnswer(question, documentEvidence);
          hrAnswers[question.id] = answer;
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_HR_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question
          hrAnswers[question.id] = {
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
        processedDocuments: COMPREHENSIVE_HR_QUESTIONS.length,
        currentStep: 'Generating findings and recommendations',
        status: 'completing'
      });
      
      // Generate comprehensive findings and recommendations
      const findings = this.generateComprehensiveFindings(hrAnswers);
      const recommendations = this.generateComprehensiveRecommendations(hrAnswers);
      
      // Store the analysis results
      await this.storeComprehensiveResults(dealId, hrAnswers, findings, recommendations, assignedDocuments);
      
      // Mark job as completed
      await storageService.updateBackgroundJob(jobId, {
        status: 'completed',
        currentStep: 'Analysis completed'
      });
      
      console.log(`✅ Comprehensive HR analysis completed for deal ${dealId}`);
      
      return {
        success: true,
        documentsAnalyzed: assignedDocuments.length,
        questionsAnswered: Object.keys(hrAnswers).length,
        findings: findings.length,
        recommendations: recommendations.length
      };
      
    } catch (error) {
      console.error(`❌ Critical error in HR analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all documents suitable for HR analysis
   */
  private async getAssignedHrDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to HR agent
    let hrDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('hr')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to HR: ${hrDocuments.length}`);
    
    // If no documents are explicitly assigned, identify HR-related documents
    if (hrDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to HR agent, identifying HR-related documents...');
      
      hrDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // HR document keywords
        const hrKeywords = [
          'employment', 'employee', 'hr', 'human resources', 'contract', 'salary',
          'compensation', 'benefits', 'stock option', 'equity', 'esop', 'vesting',
          'organizational', 'org chart', 'management', 'executive', 'director',
          'consultant', 'advisor', 'policy', 'compliance', 'labor', 'workforce',
          'personnel', 'staff', 'hiring', 'recruitment', 'performance', 'review',
          'disciplinary', 'grievance', 'diversity', 'inclusion', 'safety', 'training'
        ];
        
        // Check document name and content for HR keywords
        const hasHrKeywords = hrKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for HR document type
        const isHrDocument = aiSummary?.documentType?.toLowerCase().includes('hr') ||
                            aiSummary?.documentType?.toLowerCase().includes('employment') ||
                            aiSummary?.executiveSummary?.toLowerCase().includes('employee') ||
                            aiSummary?.executiveSummary?.toLowerCase().includes('human resources');
        
        return hasHrKeywords || isHrDocument;
      });
      
      console.log(`📄 Auto-identified HR documents: ${hrDocuments.length}`);
    }
    
    // If still no HR documents, take documents with meaningful content for analysis
    if (hrDocuments.length === 0) {
      console.log('📄 No HR-related documents found, using all documents with OCR text...');
      hrDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`📄 Documents with content available: ${hrDocuments.length}`);
    }
    
    return hrDocuments;
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
    
    const prompt = `You are an expert HR analyst conducting comprehensive investment analysis. Your task is to find ANY HR, employment, organizational, or compliance information, even if indirectly related.

DOCUMENT: ${document.name}
CONTENT: ${content.substring(0, 4000)}

QUESTION: "${question.question}"
ANALYSIS TASK: ${question.analysisPrompt}

Instructions:
- Look for DIRECT HR terms, employment contracts, organizational structures, compliance policies
- Look for INDIRECT references to workforce management, personnel policies, equity compensation
- Consider business documents that mention team structure, hiring, compensation, organizational matters
- Even general business context often has HR implications for investment due diligence
- For growing companies, most business documents contain HR information relevant to investors

Respond in JSON format:
{
  "relevantContent": ["Exact quote 1 from document", "Exact quote 2 from document"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1", "Finding 2"],
  "documentSummary": "Brief summary of what this document contains relevant to the question",
  "hrContext": "How this document relates to HR/organizational aspects of the business"
}

Be thorough in finding relevance - most business documents have HR implications for investment analysis.`;

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
        answer: `No relevant HR information found in the assigned HR documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant HR information found'],
        category: question.category
      };
    }

    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' '),
      findings: ev.keyFindings.join(' '),
      confidence: ev.confidence
    }));

    const prompt = `You are an expert HR analyst compiling a comprehensive answer based on evidence from multiple documents.

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
5. Include HR recommendations

Respond in JSON format:
{
  "answer": "Comprehensive answer synthesizing all evidence",
  "confidence": 0-100,
  "sources": ["Document name 1", "Document name 2"],
  "keyFindings": ["Finding 1", "Finding 2"],
  "gaps": ["Missing information 1", "Missing information 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "hrAssessment": "Overall HR assessment based on evidence",
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
        hrAssessment: compiledAnswer.hrAssessment || '',
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
      const question = COMPREHENSIVE_HR_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // High confidence findings
      if (answer.confidence > 70) {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          content: `${question.question}: ${answer.answer.substring(0, 150)}...`,
          source: answer.sources.length > 0 ? answer.sources[0] : 'HR Documents',
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
          content: `Insufficient HR information for: ${question.question}. Additional documentation may be required.`,
          source: 'HR Analysis',
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
            title: `HR Due Diligence: ${answer.question}`,
            description: rec,
            priority: answer.confidence < 60 ? 'high' : 'medium',
            category: 'hr',
            impact: answer.confidence < 40 ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Documentation Gap: ${answer.question}`,
          description: `Missing HR information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'hr',
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
    hrAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documentsAnalyzed: any[]
  ): Promise<void> {
    // First, delete any existing HR analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'hr')
      ));
    
    console.log(`🗑️ Cleared existing HR analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'hr' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      hrAnswers: JSON.stringify(hrAnswers),
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive HR analysis for deal ${dealId} with ${Object.keys(hrAnswers).length} questions answered`);
  }
}

// Export the service instance
export const comprehensiveHrAnalysisService = new ComprehensiveHrAnalysisService();