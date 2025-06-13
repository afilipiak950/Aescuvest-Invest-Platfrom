import { db } from '../db';
import { backgroundJobs, documents, InsertBackgroundJob, BackgroundJob } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { websocketManager } from './websocketManager';
import fs from 'fs';
import path from 'path';

class JobProcessor {
  private processingJobs: Set<number> = new Set();
  private jobQueue: BackgroundJob[] = [];
  private isProcessing = false;

  async createJob(jobData: InsertBackgroundJob): Promise<number> {
    const [job] = await db.insert(backgroundJobs).values(jobData).returning();
    console.log(`📋 Created background job ${job.id}: ${job.jobType}`);
    
    // Add to queue and start processing asynchronously
    this.jobQueue.push(job);
    
    // Process the job immediately in the background
    setImmediate(() => {
      this.processQueue();
    });
    
    return job.id;
  }

  async updateJobProgress(jobId: number, progress: number, currentStep: string, status?: string) {
    const updateData: any = {
      progress,
      currentStep,
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
      if (status === 'processing' && !updateData.startedAt) {
        updateData.startedAt = new Date();
      } else if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
      }
    }

    await db.update(backgroundJobs)
      .set(updateData)
      .where(eq(backgroundJobs.id, jobId));

    // Get the updated job for broadcasting
    const [updatedJob] = await db.select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId));

    if (updatedJob) {
      websocketManager.broadcastJobProgress({
        jobId,
        progress,
        status: status || updatedJob.status,
        currentStep,
        documentName: updatedJob.jobData?.documentName || updatedJob.jobData?.fileName || 'Unknown document'
      }, updatedJob.dealId || undefined);
    }

    console.log(`📊 Job ${jobId} progress: ${progress}% - ${currentStep}`);
  }

  async completeJob(jobId: number, result: any, error?: string) {
    const status = error ? 'failed' : 'completed';
    const updateData: any = {
      status,
      progress: error ? 0 : 100,
      completedAt: new Date(),
      updatedAt: new Date()
    };

    if (result) updateData.result = result;
    if (error) updateData.error = error;

    await db.update(backgroundJobs)
      .set(updateData)
      .where(eq(backgroundJobs.id, jobId));

    // Get the updated job for broadcasting
    const [updatedJob] = await db.select()
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId));

    if (updatedJob) {
      websocketManager.broadcastJobComplete(
        jobId,
        result,
        updatedJob.dealId || undefined
      );
    }

    this.processingJobs.delete(jobId);
    console.log(`✅ Job ${jobId} ${status}: ${error || 'Success'}`);
  }

  private async processQueue() {
    console.log(`🔄 ProcessQueue called - isProcessing: ${this.isProcessing}, queueLength: ${this.jobQueue.length}`);
    
    if (this.isProcessing || this.jobQueue.length === 0) {
      console.log(`⏸️ Skipping queue processing - isProcessing: ${this.isProcessing}, queueLength: ${this.jobQueue.length}`);
      return;
    }

    this.isProcessing = true;
    console.log(`🚀 Starting queue processing with ${this.jobQueue.length} jobs`);

    while (this.jobQueue.length > 0) {
      const job = this.jobQueue.shift()!;
      console.log(`📋 Processing job ${job.id}: ${job.jobType}`);
      
      if (this.processingJobs.has(job.id)) {
        console.log(`⏭️ Skipping job ${job.id} - already processing`);
        continue; // Skip if already processing
      }

      this.processingJobs.add(job.id);
      
      try {
        console.log(`🎯 Executing job ${job.id}`);
        await this.processJob(job);
        console.log(`✅ Job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`❌ Error processing job ${job.id}:`, error);
        await this.completeJob(job.id, null, String(error));
      }
    }

    this.isProcessing = false;
    console.log(`🏁 Queue processing completed`);
  }

  private async processJob(job: BackgroundJob) {
    console.log(`🚀 Starting job ${job.id}: ${job.jobType}`);
    
    switch (job.jobType) {
      case 'document_ocr':
        await this.processDocumentOCR(job);
        break;
      case 'document_analysis':
        await this.processDocumentAnalysis(job);
        break;
      case 'zip_processing':
        await this.processZipFile(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }
  }

  private async processDocumentOCR(job: BackgroundJob) {
    const { filePath, fileName, fileType, documentId } = job.jobData as any;
    
    await this.updateJobProgress(job.id, 10, 'Initializing OCR processing...', 'processing');

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    await this.updateJobProgress(job.id, 20, 'Loading Mistral OCR service...');

    // Import and use Mistral OCR service
    const { mistralOCRService } = await import('./mistralOCR');
    
    await this.updateJobProgress(job.id, 30, 'Starting text extraction...');

    const ocrResult = await mistralOCRService.extractText(filePath, fileType);
    
    await this.updateJobProgress(job.id, 70, 'OCR extraction completed, saving results...');

    // Update document with OCR results
    if (documentId) {
      await db.update(documents)
        .set({
          ocrText: ocrResult.extractedText,
          status: 'Analyzed',
          analyses: JSON.stringify({
            ocrConfidence: ocrResult.confidence,
            processingTime: ocrResult.processingTime,
            extractedAt: new Date().toISOString()
          })
        })
        .where(eq(documents.id, documentId));
    }

    await this.updateJobProgress(job.id, 100, 'OCR processing completed successfully');

    const result = {
      extractedText: ocrResult.extractedText,
      confidence: ocrResult.confidence,
      processingTime: ocrResult.processingTime,
      documentId
    };

    await this.completeJob(job.id, result);
  }

  private async processDocumentAnalysis(job: BackgroundJob) {
    const { documentId, analysisTypes } = job.jobData as any;
    
    await this.updateJobProgress(job.id, 10, 'Starting document analysis...', 'processing');

    // Get document data
    const [document] = await db.select()
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    await this.updateJobProgress(job.id, 30, 'Analyzing document content...');

    // Perform AI analysis based on document content
    const analysisResult = await this.performAIAnalysis(document, analysisTypes);
    
    await this.updateJobProgress(job.id, 80, 'Saving analysis results...');

    // Update document with analysis
    await db.update(documents)
      .set({
        analyses: JSON.stringify(analysisResult),
        summary: analysisResult.summary,
        insights: analysisResult.insights,
        riskFactors: analysisResult.riskFactors,
        category: analysisResult.category,
        documentType: analysisResult.documentType
      })
      .where(eq(documents.id, documentId));

    await this.updateJobProgress(job.id, 100, 'Document analysis completed');
    await this.completeJob(job.id, analysisResult);
  }

  private async processZipFile(job: BackgroundJob) {
    const { zipPath, dealId, folderName } = job.jobData as any;
    
    await this.updateJobProgress(job.id, 10, 'Extracting ZIP file...', 'processing');

    // Import and use zip processor
    const { zipProcessor } = await import('./zipProcessor');
    
    const result = await zipProcessor.processZipFile(zipPath, dealId, folderName);
    
    await this.updateJobProgress(job.id, 100, 'ZIP processing completed');
    await this.completeJob(job.id, result);
  }

  private async performAIAnalysis(document: any, analysisTypes: string[]) {
    // Simulate AI analysis - in production, this would call actual AI services
    const content = document.ocrText || `Document: ${document.name}`;
    
    return {
      documentType: this.detectDocumentType(document.name),
      summary: `AI-generated summary of ${document.name}`,
      insights: `Key insights extracted from the document content`,
      riskFactors: 'Identified risk factors and concerns',
      category: 'Business Document',
      confidence: 0.95,
      analysisTypes: analysisTypes,
      processedAt: new Date().toISOString()
    };
  }

  private detectDocumentType(fileName: string): string {
    const name = fileName.toLowerCase();
    if (name.includes('financial') || name.includes('finance')) return 'Financial Document';
    if (name.includes('legal') || name.includes('contract')) return 'Legal Document';
    if (name.includes('technical') || name.includes('tech')) return 'Technical Document';
    if (name.includes('market') || name.includes('analysis')) return 'Market Analysis';
    return 'Business Document';
  }

  async getActiveJobs(dealId?: number): Promise<BackgroundJob[]> {
    let query = db.select().from(backgroundJobs);
    
    if (dealId) {
      query = query.where(
        and(
          eq(backgroundJobs.dealId, dealId),
          eq(backgroundJobs.status, 'processing')
        )
      );
    } else {
      query = query.where(eq(backgroundJobs.status, 'processing'));
    }

    return await query;
  }

  async getJobHistory(dealId?: number, limit = 50): Promise<BackgroundJob[]> {
    const jobs = await db.select().from(backgroundJobs)
      .where(dealId ? eq(backgroundJobs.dealId, dealId) : undefined)
      .limit(limit);
    return jobs;
  }

  // Direct OCR execution method to bypass queue issues
  async executeOCRJobDirectly(jobId: number, filePath: string, documentId: number, fileName: string) {
    console.log(`🎯 DIRECT OCR EXECUTION: Starting job ${jobId} for ${fileName}`);
    
    try {
      // Update job to processing
      await this.updateJobProgress(jobId, 10, 'Initializing OCR processing...', 'processing');

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      await this.updateJobProgress(jobId, 20, 'Loading Mistral OCR service...');

      // Import and use Mistral OCR service
      const { mistralOCRService } = await import('./mistralOCR');
      
      await this.updateJobProgress(jobId, 30, 'Starting text extraction...');

      // Determine file type from extension
      const fileType = path.extname(fileName).substring(1).toLowerCase();
      console.log(`🔍 Processing ${fileName} as type: ${fileType}`);

      const ocrResult = await mistralOCRService.extractText(filePath, fileType);
      
      await this.updateJobProgress(jobId, 70, 'OCR extraction completed, saving results...');

      // Update document with OCR results
      await db.update(documents)
        .set({
          ocrText: ocrResult.extractedText,
          status: 'Analyzed',
          analyses: JSON.stringify({
            ocrConfidence: ocrResult.confidence,
            processingTime: ocrResult.processingTime,
            extractedAt: new Date().toISOString()
          })
        })
        .where(eq(documents.id, documentId));

      await this.updateJobProgress(jobId, 100, 'OCR processing completed successfully');

      const result = {
        extractedText: ocrResult.extractedText,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        documentId
      };

      await this.completeJob(jobId, result);
      console.log(`✅ DIRECT OCR SUCCESS: Job ${jobId} completed with ${ocrResult.extractedText?.length || 0} characters extracted`);
      
    } catch (error) {
      console.error(`❌ DIRECT OCR FAILED: Job ${jobId} error:`, error);
      await this.completeJob(jobId, null, String(error));
      throw error;
    }
  }
}

export const jobProcessor = new JobProcessor();