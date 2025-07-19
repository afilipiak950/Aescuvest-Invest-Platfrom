#!/usr/bin/env tsx

import { db } from './server/db';
import { backgroundJobs, comprehensiveHrAnalyses } from './shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HR_QUESTIONS = [
  // Employment Contracts (8 questions)
  { id: 'employment_1', category: 'Employment Contracts', question: 'Are all employment contracts signed and legally compliant?' },
  { id: 'employment_2', category: 'Employment Contracts', question: 'Do employment contracts include proper termination clauses and notice periods?' },
  { id: 'employment_3', category: 'Employment Contracts', question: 'Are salary and compensation details clearly defined in employment contracts?' },
  { id: 'employment_4', category: 'Employment Contracts', question: 'Do contracts include confidentiality and non-disclosure provisions?' },
  { id: 'employment_5', category: 'Employment Contracts', question: 'Are intellectual property assignment clauses present in employment contracts?' },
  { id: 'employment_6', category: 'Employment Contracts', question: 'Do employment contracts comply with local labor laws and regulations?' },
  { id: 'employment_7', category: 'Employment Contracts', question: 'Are probation periods and performance review processes defined?' },
  { id: 'employment_8', category: 'Employment Contracts', question: 'Do contracts address working hours, overtime, and leave policies?' },

  // Executive Compensation (5 questions)  
  { id: 'executive_1', category: 'Executive Compensation', question: 'Are executive compensation packages properly documented and approved?' },
  { id: 'executive_2', category: 'Executive Compensation', question: 'Do executives have appropriate equity participation and vesting schedules?' },
  { id: 'executive_3', category: 'Executive Compensation', question: 'Are executive bonus structures tied to performance metrics?' },
  { id: 'executive_4', category: 'Executive Compensation', question: 'Do executive agreements include change of control provisions?' },
  { id: 'executive_5', category: 'Executive Compensation', question: 'Are executive severance packages reasonable and well-defined?' },

  // Equity & Stock Options (5 questions)
  { id: 'equity_1', category: 'Equity & Stock Options', question: 'Is there a comprehensive equity incentive plan in place?' },
  { id: 'equity_2', category: 'Equity & Stock Options', question: 'Are stock option grants properly documented with vesting schedules?' },
  { id: 'equity_3', category: 'Equity & Stock Options', question: 'Do equity plans comply with tax regulations and accounting standards?' },
  { id: 'equity_4', category: 'Equity & Stock Options', question: 'Are there appropriate restrictions on equity transfers?' },
  { id: 'equity_5', category: 'Equity & Stock Options', question: 'Is there adequate equity pool reserved for future hires?' },

  // Benefits & Insurance (4 questions)
  { id: 'benefits_1', category: 'Benefits & Insurance', question: 'Are employee benefits packages competitive and comprehensive?' },
  { id: 'benefits_2', category: 'Benefits & Insurance', question: 'Is there adequate health, dental, and disability insurance coverage?' },
  { id: 'benefits_3', category: 'Benefits & Insurance', question: 'Are retirement plans and savings programs available to employees?' },
  { id: 'benefits_4', category: 'Benefits & Insurance', question: 'Do benefits comply with regulatory requirements (ERISA, ACA, etc.)?' },

  // Compliance & Legal (5 questions)
  { id: 'compliance_1', category: 'Compliance & Legal', question: 'Are all HR policies and procedures documented and up-to-date?' },
  { id: 'compliance_2', category: 'Compliance & Legal', question: 'Does the company comply with employment discrimination laws?' },
  { id: 'compliance_3', category: 'Compliance & Legal', question: 'Are workplace safety and harassment policies in place?' },
  { id: 'compliance_4', category: 'Compliance & Legal', question: 'Does the company maintain proper employment records and documentation?' },
  { id: 'compliance_5', category: 'Compliance & Legal', question: 'Are there appropriate procedures for handling employee complaints and disputes?' },

  // Performance & Development (3 questions)
  { id: 'performance_1', category: 'Performance & Development', question: 'Are there structured performance review and evaluation processes?' },
  { id: 'performance_2', category: 'Performance & Development', question: 'Does the company provide adequate training and development opportunities?' },
  { id: 'performance_3', category: 'Performance & Development', question: 'Are career progression paths clearly defined for employees?' },

  // Organizational Structure (2 questions)  
  { id: 'organization_1', category: 'Organizational Structure', question: 'Is the organizational structure clearly defined with appropriate reporting lines?' },
  { id: 'organization_2', category: 'Organizational Structure', question: 'Are key person dependencies identified and mitigated?' }
];

async function directHrAnalysis(dealId: number) {
  try {
    console.log(`🏢 STARTING DIRECT HR ANALYSIS for deal ${dealId}`);
    
    // Clear existing jobs
    await db.delete(backgroundJobs)
      .where(eq(backgroundJobs.dealId, dealId));
    console.log(`🧹 Cleared existing background jobs`);

    // Get documents
    const documents = await db.query.documents.findMany({
      where: (documents, { eq, and, isNotNull }) => and(
        eq(documents.dealId, dealId),
        isNotNull(documents.aiSummary)
      )
    });

    console.log(`📋 Found ${documents.length} documents for HR analysis`);

    if (documents.length === 0) {
      console.log(`❌ No documents found for deal ${dealId}`);
      return;
    }

    const allAnswers: any = {};
    const allFindings: any[] = [];
    const allRecommendations: any[] = [];
    
    let processed = 0;
    const totalQuestions = HR_QUESTIONS.length;

    // Process each HR question  
    for (const question of HR_QUESTIONS) {
      processed++;
      const progressPercent = Math.floor((processed / totalQuestions) * 100);
      
      console.log(`📊 Processing question ${processed}/${totalQuestions} (${progressPercent}%): ${question.question}`);
      
      // Find relevant documents with enhanced keyword matching
      const hrKeywords = [
        'employment', 'employee', 'salary', 'wage', 'compensation', 'contract', 'agreement',
        'hr', 'human resources', 'benefits', 'insurance', 'equity', 'stock option', 'vesting',
        'executive', 'management', 'performance', 'training', 'development', 'termination',
        'severance', 'non-compete', 'confidentiality', 'nda', 'intellectual property'
      ];

      const relevantDocs = documents.filter(doc => {
        if (!doc.aiSummary) return false;
        
        let summaryText = '';
        if (typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary) {
          summaryText = doc.aiSummary.executiveSummary.toLowerCase();
        } else if (typeof doc.aiSummary === 'string') {
          summaryText = doc.aiSummary.toLowerCase();
        } else {
          return false;
        }

        return hrKeywords.some(keyword => summaryText.includes(keyword)) ||
               doc.name.toLowerCase().includes('employment') ||
               doc.name.toLowerCase().includes('contract') ||
               doc.name.toLowerCase().includes('agreement');
      });

      console.log(`🔍 Found ${relevantDocs.length} relevant documents for: ${question.question}`);

      if (relevantDocs.length > 0) {
        try {
          // Create AI analysis prompt
          const docSummaries = relevantDocs.slice(0, 5).map(doc => {
            const summary = typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary 
              ? doc.aiSummary.executiveSummary 
              : doc.aiSummary;
            return `Document: ${doc.name}\nSummary: ${summary}`;
          }).join('\n\n');

          const prompt = `
Analyze the following documents for HR due diligence and answer this specific question:

QUESTION: ${question.question}

DOCUMENTS:
${docSummaries}

Please provide a detailed analysis in JSON format:
{
  "answer": "Detailed answer to the HR question based on document evidence",
  "confidence": 85,
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
          `;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" }
          });

          const result = JSON.parse(response.choices[0].message.content || '{}');
          
          // Store the comprehensive answer
          allAnswers[question.id] = {
            question: question.question,
            answer: result.answer || 'Analysis completed but no specific answer generated',
            confidence: Math.min(100, Math.max(0, result.confidence || 75)) / 100,
            sources: relevantDocs.slice(0, 5).map(doc => doc.name),
            evidenceCount: relevantDocs.length,
            documentsCovered: relevantDocs.length,
            keyFindings: result.keyFindings || [],
            evidenceSummary: `Found relevant HR evidence in ${relevantDocs.length} documents`,
            recommendations: result.recommendations || [],
            detailedEvidence: relevantDocs.slice(0, 3).map((doc, i) => ({
              documentName: doc.name,
              content: typeof doc.aiSummary === 'object' && doc.aiSummary.executiveSummary 
                ? doc.aiSummary.executiveSummary.substring(0, 300) + '...'
                : doc.aiSummary?.toString().substring(0, 300) + '...' || '',
              confidence: 0.8,
              relevanceScore: 0.8
            })),
            hrAssessment: `HR analysis based on evidence from ${relevantDocs.length} relevant documents`
          };

          // Add findings
          if (result.keyFindings && result.keyFindings.length > 0) {
            result.keyFindings.forEach((finding: string) => {
              allFindings.push({
                id: allFindings.length,
                content: `${question.question}: ${finding}`,
                type: 'hr_finding',
                confidence: (result.confidence || 75) / 100,
                source: relevantDocs.slice(0, 3).map(doc => doc.name).join(', '),
                category: question.category.toLowerCase().replace(/\s+/g, '_')
              });
            });
          }

          // Add recommendations
          if (result.recommendations && result.recommendations.length > 0) {
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

          console.log(`✅ Completed analysis for question ${processed}: ${result.keyFindings?.length || 0} findings`);

        } catch (error) {
          console.error(`❌ Error analyzing question ${question.id}:`, error);
          // Store a basic answer even if AI analysis fails
          allAnswers[question.id] = {
            question: question.question,
            answer: `Evidence found in ${relevantDocs.length} documents but AI analysis failed`,
            confidence: 0.5,
            sources: relevantDocs.slice(0, 5).map(doc => doc.name),
            evidenceCount: relevantDocs.length,
            documentsCovered: relevantDocs.length,
            keyFindings: [],
            evidenceSummary: `${relevantDocs.length} potentially relevant documents found`,
            recommendations: ['Consider manual review of identified documents'],
            detailedEvidence: [],
            hrAssessment: 'Manual review required due to analysis error'
          };
        }
      } else {
        // No relevant documents found
        allAnswers[question.id] = {
          question: question.question,
          answer: `No specific HR evidence found for: ${question.question}`,
          confidence: 0,
          sources: [],
          evidenceCount: 0,
          documentsCovered: 0,
          keyFindings: [],
          evidenceSummary: 'No relevant HR evidence available',
          recommendations: ['Consider providing additional HR documentation for comprehensive analysis'],
          detailedEvidence: [],
          hrAssessment: 'Unable to assess due to lack of relevant HR documentation'
        };
      }
      
      // Small delay between questions to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`📊 Storing HR analysis results: ${allFindings.length} findings, ${allRecommendations.length} recommendations`);
    
    // Store comprehensive analysis results
    await db.insert(comprehensiveHrAnalyses).values({
      dealId,
      hrAnswers: JSON.stringify(allAnswers),
      findings: JSON.stringify(allFindings),
      recommendations: JSON.stringify(allRecommendations),
      status: 'Completed',
      progress: 100
    });

    console.log(`✅ DIRECT HR ANALYSIS COMPLETED for deal ${dealId}`);
    console.log(`📈 Results: ${Object.keys(allAnswers).length} questions answered, ${allFindings.length} findings, ${allRecommendations.length} recommendations`);

  } catch (error) {
    console.error(`❌ Error in direct HR analysis:`, error);
  }
}

// Run direct HR analysis for deal 22
directHrAnalysis(22).then(() => {
  console.log('🎉 Direct HR analysis completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Direct HR analysis failed:', error);
  process.exit(1);
});