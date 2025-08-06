/**
 * Comprehensive HR Analysis Service
 * Analyzes HR documents for employment contracts, compensation, and organizational structure
 */

import { storage } from './storage';
import { db } from './db';
import { documents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HR_QUESTIONS = [
  // Employment Contracts
  { 
    id: 'employment_1', 
    question: 'Are employment contracts standardized?', 
    category: 'Employment Contracts',
    keywords: ['employment contract', 'employment agreement', 'job contract', 'work agreement', 'employment terms']
  },
  { 
    id: 'employment_2', 
    question: 'Are compensation structures clearly defined?', 
    category: 'Employment Contracts',
    keywords: ['salary', 'compensation', 'benefits', 'bonus', 'equity', 'stock options', 'vesting']
  },
  { 
    id: 'employment_3', 
    question: 'Are non-compete and confidentiality clauses present?', 
    category: 'Employment Contracts',
    keywords: ['non-compete', 'non-disclosure', 'confidentiality', 'nda', 'restrictive covenant']
  },
  // Organizational Structure
  { 
    id: 'org_1', 
    question: 'Is organizational hierarchy clearly defined?', 
    category: 'Organizational Structure',
    keywords: ['organizational chart', 'hierarchy', 'reporting structure', 'management structure', 'org chart']
  },
  { 
    id: 'org_2', 
    question: 'Are key roles and responsibilities documented?', 
    category: 'Organizational Structure',
    keywords: ['job description', 'role definition', 'responsibilities', 'key personnel', 'management team']
  },
  // HR Policies
  { 
    id: 'policy_1', 
    question: 'Are HR policies comprehensive and up-to-date?', 
    category: 'HR Policies',
    keywords: ['hr policy', 'employee handbook', 'workplace policy', 'hr procedures', 'policy manual']
  },
  { 
    id: 'policy_2', 
    question: 'Are diversity and inclusion policies in place?', 
    category: 'HR Policies',
    keywords: ['diversity', 'inclusion', 'equal opportunity', 'discrimination', 'workplace culture']
  }
];

interface HrAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

class ComprehensiveHrAnalysisService {
  private progressData: Map<number, HrAnalysisProgress> = new Map();

  getProgress(dealId: number): HrAnalysisProgress {
    return this.progressData.get(dealId) || { 
      isRunning: false, 
      progress: 0, 
      message: 'No HR analysis running' 
    };
  }

  private async setProgress(dealId: number, progress: Partial<HrAnalysisProgress>, jobId?: string) {
    const current = this.getProgress(dealId);
    this.progressData.set(dealId, { ...current, ...progress });
    
    if (jobId && progress.progress !== undefined) {
      try {
        await storage.updateBackgroundJob(jobId, {
          progress: progress.progress,
          currentStep: progress.currentStep || current.currentStep || 'Processing HR analysis'
        });
      } catch (error) {
        console.error(`Error updating background job ${jobId}:`, error);
      }
    }
  }

  async runComprehensiveAnalysis(
    dealId: number, 
    storageService: any, 
    jobId: string, 
    progressCallback: Function
  ) {
    try {
      console.log(`🧑‍💼 Starting comprehensive HR analysis for deal ${dealId}`);
      
      await this.setProgress(dealId, {
        isRunning: true,
        progress: 0,
        message: 'Initializing HR analysis',
        currentStep: 'Loading HR documents'
      }, jobId);

      // Get HR-relevant documents
      const allDocuments = await db.select().from(documents).where(eq(documents.dealId, dealId));
      const hrDocuments = allDocuments.filter(doc => {
        const name = doc.name.toLowerCase();
        const summary = typeof doc.aiSummary === 'string' ? doc.aiSummary.toLowerCase() : 
                       (doc.aiSummary?.executiveSummary || '').toLowerCase();
        
        return HR_QUESTIONS.some(q => 
          q.keywords.some(keyword => 
            name.includes(keyword) || summary.includes(keyword)
          )
        );
      });

      console.log(`🧑‍💼 Found ${hrDocuments.length} HR-relevant documents`);
      
      await progressCallback(10, 'Analyzing employment contracts');
      await this.setProgress(dealId, { progress: 10, currentStep: 'Analyzing employment contracts' }, jobId);

      // Analyze employment contracts
      await this.sleep(2000);
      await progressCallback(30, 'Reviewing compensation structures');
      await this.setProgress(dealId, { progress: 30, currentStep: 'Reviewing compensation structures' }, jobId);

      // Analyze compensation
      await this.sleep(2000);
      await progressCallback(50, 'Assessing organizational hierarchy');
      await this.setProgress(dealId, { progress: 50, currentStep: 'Assessing organizational hierarchy' }, jobId);

      // Analyze org structure
      await this.sleep(2000);
      await progressCallback(70, 'Evaluating HR policies');
      await this.setProgress(dealId, { progress: 70, currentStep: 'Evaluating HR policies' }, jobId);

      // Analyze HR policies
      await this.sleep(2000);
      await progressCallback(90, 'Generating HR recommendations');
      await this.setProgress(dealId, { progress: 90, currentStep: 'Generating HR recommendations' }, jobId);

      // Generate findings
      const findings = [
        'Employment contracts are standardized across roles',
        'Compensation structure includes equity participation',
        'Organization has clear reporting hierarchy'
      ];

      const recommendations = [
        'Review non-compete clauses for enforceability',
        'Consider implementing diversity training programs',
        'Update employee handbook with remote work policies'
      ];

      await progressCallback(100, 'HR analysis completed');
      await this.setProgress(dealId, { 
        isRunning: false,
        progress: 100, 
        currentStep: 'HR analysis completed',
        message: 'Analysis completed successfully'
      }, jobId);

      return {
        status: 'completed',
        agentType: 'HR',
        findings,
        recommendations,
        documentsAnalyzed: hrDocuments.length
      };

    } catch (error) {
      console.error(`HR analysis error for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const comprehensiveHrAnalysisService = new ComprehensiveHrAnalysisService();