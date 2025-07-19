import { db } from './db';
import { comprehensiveHrAnalyses, backgroundJobs } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// HR questions covering employment, executive contracts, ESOP/VSOP, freelancer agreements, HR SaaS, policies, and compensation
const HR_QUESTIONS = [
  // Employment Contracts
  {
    id: 'employment_1',
    question: 'Are all employment contracts signed and dated?',
    keywords: ['employment contract', 'signed', 'dated', 'employee agreement', 'employment terms']
  },
  {
    id: 'employment_2', 
    question: 'Are notice periods in line with local labor law or extended?',
    keywords: ['notice period', 'termination notice', 'labor law', 'employment notice']
  },
  {
    id: 'employment_3',
    question: 'Are probation periods defined? If yes, how long?',
    keywords: ['probation', 'probationary period', 'trial period', 'initial employment']
  },
  {
    id: 'employment_4',
    question: 'Are termination clauses (ordinary, extraordinary) present?',
    keywords: ['termination clause', 'dismissal', 'termination conditions', 'employment termination']
  },
  {
    id: 'employment_5',
    question: 'Is there mention of confidentiality, IP assignment, and post-contractual non-compete?',
    keywords: ['confidentiality', 'intellectual property', 'non-compete', 'IP assignment', 'trade secrets']
  },
  {
    id: 'employment_6',
    question: 'Are variable components (bonuses, stock options, commissions) clearly described?',
    keywords: ['bonus', 'variable pay', 'stock options', 'commission', 'incentive compensation']
  },
  {
    id: 'employment_7',
    question: 'Are working hours, overtime rules, and leave entitlements defined?',
    keywords: ['working hours', 'overtime', 'leave', 'vacation', 'working time', 'time off']
  },
  
  // Executive/Managing Director Contracts
  {
    id: 'executive_1',
    question: 'Is the total compensation package broken down (base, bonus, equity)?',
    keywords: ['executive compensation', 'total compensation', 'base salary', 'executive pay', 'management compensation']
  },
  {
    id: 'executive_2',
    question: 'Are KPI-driven bonuses explicitly defined?',
    keywords: ['KPI bonus', 'performance bonus', 'key performance indicators', 'executive bonus']
  },
  {
    id: 'executive_3',
    question: 'Are severance packages or golden parachutes included?',
    keywords: ['severance', 'golden parachute', 'executive severance', 'termination benefits']
  },
  {
    id: 'executive_4',
    question: 'What exit clauses exist in case of M&A or investor-led changes?',
    keywords: ['exit clause', 'M&A', 'acquisition', 'change of control', 'investor changes']
  },
  
  // ESOP/VSOP Agreements
  {
    id: 'equity_1',
    question: 'What is the total pool reserved (as % of shares)?',
    keywords: ['ESOP', 'VSOP', 'equity pool', 'stock option pool', 'employee shares']
  },
  {
    id: 'equity_2',
    question: 'What vesting model is used? (cliff, linear, backloaded)',
    keywords: ['vesting', 'equity vesting', 'stock vesting', 'vesting schedule', 'cliff vesting']
  },
  {
    id: 'equity_3',
    question: 'Are good leaver/bad leaver rules defined?',
    keywords: ['good leaver', 'bad leaver', 'leaver provisions', 'equity forfeiture']
  },
  
  // HR Systems and Policies
  {
    id: 'systems_1',
    question: 'What HR SaaS systems are in use (Personio, Workday, HiBob)?',
    keywords: ['HR software', 'HRIS', 'Personio', 'Workday', 'HiBob', 'payroll system']
  },
  {
    id: 'policies_1',
    question: 'Are internal HR policies covering leave, diversity, misconduct documented?',
    keywords: ['HR policy', 'leave policy', 'diversity policy', 'misconduct policy', 'employee handbook']
  },
  {
    id: 'compensation_1',
    question: 'Are salaries benchmarked and pay bands defined by level and function?',
    keywords: ['salary benchmarking', 'pay bands', 'compensation structure', 'salary levels']
  }
];

interface ProcessedDocument {
  name: string;
  content: string;
  summary: string;
}

export async function startComprehensiveHrAnalysis(dealId: number) {
  const jobId = `hr-analysis-${dealId}-${Date.now()}`;
  
  // Check if analysis is already running
  const existingJob = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.dealId, dealId))
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(1);
    
  if (existingJob.length > 0 && existingJob[0].status === 'processing') {
    return { success: true, message: 'HR analysis already running', jobId: existingJob[0].jobId };
  }

  // Create new background job
  await db.insert(backgroundJobs).values({
    jobId,
    dealId,
    jobType: 'comprehensive_hr_analysis',
    status: 'processing',
    progress: 0,
    message: 'Starting comprehensive HR analysis',
    agentType: 'hr',
    totalSteps: HR_QUESTIONS.length,
    currentStep: 'Initializing HR analysis...'
  });

  // Start background processing
  processHrAnalysisInBackground(dealId, jobId);
  
  return { success: true, message: 'HR analysis started', jobId };
}

async function processHrAnalysisInBackground(dealId: number, jobId: string) {
  try {
    console.log(`🏢 Starting comprehensive HR analysis for deal ${dealId}`);
    
    // Update progress - Finding relevant documents
    await updateJobProgress(jobId, 5, 'Finding HR-relevant documents...');
    
    // Get all documents with AI summaries for this deal
    const documents = await db.query.documents.findMany({
      where: (documents, { eq, and, isNotNull }) => and(
        eq(documents.dealId, dealId),
        isNotNull(documents.aiSummary)
      )
    });

    console.log(`📋 Found ${documents.length} documents with AI summaries for HR analysis`);
    
    if (documents.length === 0) {
      await updateJobProgress(jobId, 100, 'No documents available for analysis', 'completed');
      return;
    }

    // Filter documents that are relevant to HR analysis using broader criteria
    const hrRelevantDocuments = documents.filter(doc => {
      if (!doc.aiSummary) return false;
      
      // Handle aiSummary as object with executiveSummary field
      let summaryText = '';
      if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
        summaryText = doc.aiSummary.executiveSummary.toLowerCase();
      } else if (typeof doc.aiSummary === 'string') {
        summaryText = doc.aiSummary.toLowerCase();
      } else {
        return false;
      }

      // HR-related keywords for document filtering
      const hrKeywords = [
        'employment', 'employee', 'contract', 'salary', 'compensation', 'payroll',
        'hr', 'human resources', 'personnel', 'staff', 'workforce', 'hiring',
        'termination', 'severance', 'bonus', 'incentive', 'stock option', 'equity',
        'vesting', 'esop', 'vsop', 'executive', 'management', 'director',
        'confidentiality', 'non-compete', 'intellectual property', 'ip assignment',
        'probation', 'notice period', 'leave', 'vacation', 'overtime', 'working hours',
        'performance', 'kpi', 'review', 'promotion', 'benefits', 'insurance',
        'policy', 'handbook', 'misconduct', 'diversity', 'whistleblowing',
        'freelancer', 'contractor', 'consultant', 'agreement'
      ];
      
      return hrKeywords.some(keyword => 
        summaryText.includes(keyword) || 
        doc.name.toLowerCase().includes(keyword)
      );
    });

    console.log(`📋 Filtered to ${hrRelevantDocuments.length} HR-relevant documents`);
    
    // If no documents match HR criteria, fall back to analyzing all documents  
    const documentsToAnalyze = hrRelevantDocuments.length > 0 ? hrRelevantDocuments : documents;
    
    console.log(`📋 Will analyze ${documentsToAnalyze.length} documents across ${HR_QUESTIONS.length} questions`);

    // Process documents in batches of 10
    const batchSize = 10;
    const totalBatches = Math.ceil(documentsToAnalyze.length / batchSize);
    
    const allAnswers: any = {};
    const allFindings: any[] = [];
    const allRecommendations: any[] = [];

    // Process each question
    for (let questionIndex = 0; questionIndex < HR_QUESTIONS.length; questionIndex++) {
      const question = HR_QUESTIONS[questionIndex];
      const progressPercent = Math.round(((questionIndex + 1) / HR_QUESTIONS.length) * 90) + 5;
      
      await updateJobProgress(jobId, progressPercent, `Analyzing: ${question.question.substring(0, 50)}...`);
      
      console.log(`🏢 Processing question ${questionIndex + 1}/${HR_QUESTIONS.length}: ${question.question}`);
      
      // Find documents with evidence for this question
      const relevantDocs = documentsToAnalyze.filter(doc => {
        const summaryText = typeof doc.aiSummary === 'object' 
          ? doc.aiSummary.executiveSummary?.toLowerCase() || ''
          : (doc.aiSummary || '').toLowerCase();
        
        return question.keywords.some(keyword => 
          summaryText.includes(keyword.toLowerCase()) || 
          doc.name.toLowerCase().includes(keyword.toLowerCase())
        );
      });

      console.log(`🔎 Found ${relevantDocs.length} documents with potential evidence for: ${question.question}`);
      
      // Process documents in batches for this question
      const questionFindings: string[] = [];
      const questionSources: string[] = [];
      
      for (let batchIndex = 0; batchIndex < Math.ceil(relevantDocs.length / batchSize); batchIndex++) {
        const batchStart = batchIndex * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, relevantDocs.length);
        const batch = relevantDocs.slice(batchStart, batchEnd);
        
        console.log(`🏢 Processing batch ${batchIndex + 1}/${Math.ceil(relevantDocs.length / batchSize)} for question: ${question.id}`);
        
        // Extract evidence from this batch
        for (const doc of batch) {
          try {
            const summaryText = typeof doc.aiSummary === 'object' 
              ? doc.aiSummary.executiveSummary || ''
              : doc.aiSummary || '';
            
            if (summaryText.length > 50) {
              // Check if document contains relevant content
              const hasRelevantContent = question.keywords.some(keyword =>
                summaryText.toLowerCase().includes(keyword.toLowerCase()) ||
                doc.name.toLowerCase().includes(keyword.toLowerCase())
              );
              
              if (hasRelevantContent) {
                // Extract specific evidence using AI
                const evidencePrompt = `
                Analyze this document summary for HR due diligence evidence related to: "${question.question}"

                Document: ${doc.name}
                Summary: ${summaryText}

                Extract specific evidence that directly answers the question. If no relevant evidence exists, return "No relevant evidence found."

                Provide your response as specific findings with confidence level.
                `;

                const response = await openai.chat.completions.create({
                  model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
                  messages: [{ role: 'user', content: evidencePrompt }],
                  temperature: 0.1,
                  max_tokens: 500
                });

                const evidence = response.choices[0].message.content?.trim();
                if (evidence && !evidence.includes('No relevant evidence found') && evidence.length > 20) {
                  questionFindings.push(evidence);
                  questionSources.push(doc.name);
                }
              }
            }
          } catch (error) {
            console.error(`Error processing document ${doc.name}:`, error);
          }
        }
      }

      // Generate comprehensive answer for this question
      let answer = '';
      let confidence = 0;
      let sources: string[] = [];
      let evidenceCount = 0;
      let keyFindings: string[] = [];
      
      if (questionFindings.length > 0) {
        // Generate AI-powered comprehensive answer
        console.log(`🏢 Generating answer for: ${question.question} (${questionFindings.length} findings)`);
        
        try {
          const answerPrompt = `
          Based on the following evidence from HR due diligence documents, provide a comprehensive answer to: "${question.question}"

          Evidence:
          ${questionFindings.map((finding, i) => `${i + 1}. From ${questionSources[i]}: ${finding}`).join('\n')}

          Provide:
          1. A clear, specific answer addressing the question
          2. Key findings from the evidence
          3. Overall confidence level (0-100)
          4. Any recommendations if gaps are identified

          Format as JSON:
          {
            "answer": "comprehensive answer",
            "keyFindings": ["finding1", "finding2"],
            "confidence": 85,
            "recommendations": ["rec1", "rec2"]
          }
          `;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [{ role: 'user', content: answerPrompt }],
            temperature: 0.1,
            response_format: { type: "json_object" }
          });

          const result = JSON.parse(response.choices[0].message.content || '{}');
          
          answer = result.answer || 'Analysis completed but no specific answer generated';
          confidence = Math.min(100, Math.max(0, result.confidence || 75)) / 100;
          keyFindings = result.keyFindings || [];
          sources = [...new Set(questionSources)]; // Remove duplicates
          evidenceCount = questionFindings.length;
          
          // Add recommendations to global list
          if (result.recommendations && Array.isArray(result.recommendations)) {
            result.recommendations.forEach((rec: string) => {
              allRecommendations.push({
                title: `HR: ${rec.substring(0, 50)}...`,
                content: rec,
                category: 'HR',
                priority: 'Medium',
                impact: 'Medium'
              });
            });
          }
          
        } catch (error) {
          console.error(`Error generating answer for ${question.id}:`, error);
          answer = `Evidence found in ${questionFindings.length} documents but analysis failed`;
          confidence = 0.5;
        }
      } else {
        answer = `No specific evidence found in the analyzed HR documents for: ${question.question}`;
        confidence = 0;
        sources = [];
        evidenceCount = 0;
        keyFindings = [];
      }

      // Store the answer
      allAnswers[question.id] = {
        question: question.question,
        answer,
        confidence,
        sources,
        evidenceCount,
        documentsCovered: relevantDocs.length,
        keyFindings,
        evidenceSummary: questionFindings.length > 0 
          ? `Found relevant HR evidence in ${questionFindings.length} document extracts`
          : 'No relevant HR evidence available',
        recommendations: questionFindings.length === 0 
          ? ['Consider providing additional HR documentation for comprehensive analysis']
          : [],
        detailedEvidence: questionFindings.map((finding, i) => ({
          documentName: questionSources[i],
          content: finding,
          confidence: 0.8,
          relevanceScore: 0.8
        })),
        hrAssessment: questionFindings.length > 0 
          ? `HR analysis based on evidence from ${questionFindings.length} relevant documents`
          : 'Unable to assess due to lack of relevant HR documentation'
      };

      // Add to findings
      if (questionFindings.length > 0) {
        allFindings.push({
          id: allFindings.length,
          content: `${question.question}: ${answer}`,
          type: 'hr_finding',
          confidence,
          source: sources.join(', '),
          category: question.id.split('_')[0] // employment, executive, equity, etc.
        });
      }
    }

    // Final step - store results
    await updateJobProgress(jobId, 95, 'Storing comprehensive HR analysis results...');
    
    const hrAnswers = JSON.stringify(allAnswers);
    
    // Store comprehensive analysis results
    await db.insert(comprehensiveHrAnalyses).values({
      dealId,
      hrAnswers,
      findings: JSON.stringify(allFindings),
      recommendations: JSON.stringify(allRecommendations),
      status: 'Completed',
      progress: 100
    });

    await updateJobProgress(jobId, 100, 'Comprehensive HR analysis completed successfully', 'completed');
    
    console.log(`✅ Comprehensive HR analysis completed for deal ${dealId}: ${allFindings.length} findings, ${allRecommendations.length} recommendations`);

    // Invalidate relevant caches
    // Note: In a real app, you'd want to implement cache invalidation
    
  } catch (error) {
    console.error(`❌ Error in HR analysis for deal ${dealId}:`, error);
    await updateJobProgress(jobId, 0, `Analysis failed: ${error.message}`, 'failed');
  }
}

async function updateJobProgress(jobId: string, progress: number, message: string, status: string = 'processing') {
  await db
    .update(backgroundJobs)
    .set({
      progress,
      message,
      status,
      updatedAt: new Date()
    })
    .where(eq(backgroundJobs.jobId, jobId));
}

export async function getComprehensiveHrAnalysisProgress(dealId: number) {
  const job = await db
    .select()
    .from(backgroundJobs)
    .where(eq(backgroundJobs.dealId, dealId))
    .orderBy(desc(backgroundJobs.createdAt))
    .limit(1);

  if (job.length === 0) {
    return { success: true, isRunning: false, progress: 0, message: 'No comprehensive HR analysis running' };
  }

  const activeJob = job[0];
  const isRunning = activeJob.status === 'processing';
  
  return {
    success: true,
    isRunning,
    progress: activeJob.progress,
    message: activeJob.message,
    currentStep: activeJob.currentStep,
    status: activeJob.status
  };
}

export async function getComprehensiveHrAnalysisResults(dealId: number) {
  const analysis = await db
    .select()
    .from(comprehensiveHrAnalyses)
    .where(eq(comprehensiveHrAnalyses.dealId, dealId))
    .orderBy(desc(comprehensiveHrAnalyses.createdAt))
    .limit(1);

  if (analysis.length === 0) {
    return { success: false, message: 'No comprehensive HR analysis found' };
  }

  const result = analysis[0];
  
  return {
    success: true,
    hrAnswers: result.hrAnswers ? JSON.parse(result.hrAnswers) : {},
    findings: result.findings ? JSON.parse(result.findings) : [],
    recommendations: result.recommendations ? JSON.parse(result.recommendations) : [],
    status: result.status,
    progress: result.progress
  };
}