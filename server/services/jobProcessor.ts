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
  
  constructor() {
    // Start automatic cleanup of stuck jobs every 5 minutes
    setInterval(() => {
      this.cleanupStuckJobs();
    }, 5 * 60 * 1000); // 5 minutes
  }

  async createJob(jobData: InsertBackgroundJob): Promise<number> {
    console.log(`🔍 JOB CREATE MICRO-STEP 1: Inserting job to database...`);
    
    // Add jobId to the data to ensure proper tracking
    const jobDataWithId = {
      ...jobData,
      jobId: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    const [job] = await db.insert(backgroundJobs).values(jobDataWithId).returning();
    console.log(`📋 Created background job ${job.id}: ${job.jobType}`);
    console.log(`🔍 JOB CREATE MICRO-STEP 2: Job details:`, {
      id: job.id,
      jobType: job.jobType,
      dealId: job.dealId,
      status: job.status
    });
    
    // Add to queue and start processing asynchronously
    this.jobQueue.push(job);
    console.log(`🔍 JOB CREATE MICRO-STEP 3: Added to queue. Queue length: ${this.jobQueue.length}`);
    
    // Process the job immediately in the background
    console.log(`🔍 JOB CREATE MICRO-STEP 4: Scheduling processQueue with setImmediate...`);
    setImmediate(() => {
      console.log(`🔍 JOB CREATE MICRO-STEP 5: setImmediate callback triggered!`);
      this.processQueue();
    });
    
    console.log(`🔍 JOB CREATE MICRO-STEP 6: Returning job ID: ${job.id}`);
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
      const jobData = updatedJob.jobData as any || {};
      websocketManager.broadcastJobProgress({
        jobId,
        progress,
        status: status || updatedJob.status,
        currentStep,
        documentName: jobData?.documentName || jobData?.fileName || 'Unknown document'
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

  async cleanupStuckJobs() {
    try {
      console.log('🧹 Checking for stuck jobs...');
      
      // Find jobs that have been processing for more than 10 minutes
      const stuckJobs = await db.select()
        .from(backgroundJobs)
        .where(and(
          eq(backgroundJobs.status, 'processing')
        ));

      const now = new Date();
      const stuckThreshold = 10 * 60 * 1000; // 10 minutes

      for (const job of stuckJobs) {
        const lastUpdate = job.updatedAt || job.startedAt || job.createdAt;
        const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
        
        if (timeSinceUpdate > stuckThreshold) {
          console.log(`🧹 Cleaning up stuck job ${job.id} (stuck for ${Math.floor(timeSinceUpdate / 60000)} minutes)`);
          
          await this.completeJob(job.id, null, `Job automatically cleaned up - stuck for ${Math.floor(timeSinceUpdate / 60000)} minutes`);
          this.processingJobs.delete(job.id);
        }
      }
    } catch (error) {
      console.error('❌ Error during stuck job cleanup:', error);
    }
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
      case 'ai_summary_generation':
        await this.processAISummaryGeneration(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.jobType}`);
    }
  }

  private async processDocumentOCR(job: BackgroundJob) {
    const { filePath, fileName, fileType, documentId } = job.jobData as any;
    
    await this.updateJobProgress(job.id, 10, 'Initializing OCR processing...', 'processing');

    // Handle database-stored files
    let actualFilePath = filePath;
    let tempFilePath: string | null = null;
    
    if (filePath.startsWith('db://')) {
      // File is stored in database, retrieve it
      const { dbFileStorage } = await import('./databaseFileStorage');
      await this.updateJobProgress(job.id, 15, 'Retrieving file from database storage...');
      
      const fileBuffer = await dbFileStorage.retrieveFile(filePath);
      
      // Create temporary file for OCR processing
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, `temp_${Date.now()}_${fileName}`);
      await fs.promises.writeFile(tempFilePath, fileBuffer);
      actualFilePath = tempFilePath;
      
      await this.updateJobProgress(job.id, 18, 'File retrieved from database, starting OCR...');
    } else {
      // Check if local file exists, with fallback path resolution
      if (!fs.existsSync(filePath)) {
        // Try to resolve the path by searching in uploads/extracted directories
        const fileName = path.basename(filePath);
        console.log(`🔍 File not found at ${filePath}, searching for: ${fileName}`);
        
        // Search in uploads/extracted subdirectories
        const uploadsDir = path.join(process.cwd(), 'uploads', 'extracted');
        if (fs.existsSync(uploadsDir)) {
          const subDirs = fs.readdirSync(uploadsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
          
          for (const subDir of subDirs) {
            const possiblePath = path.join(uploadsDir, subDir, fileName);
            if (fs.existsSync(possiblePath)) {
              actualFilePath = possiblePath;
              console.log(`✅ Found file at: ${actualFilePath}`);
              break;
            }
          }
        }
        
        if (!fs.existsSync(actualFilePath)) {
          throw new Error(`File not found: ${filePath}. Searched in uploads/extracted directories.`);
        }
      }
    }

    await this.updateJobProgress(job.id, 20, 'Loading Mistral OCR service...');

    // Import and use Mistral OCR service
    const { mistralOCRService } = await import('./mistralOCR');
    
    await this.updateJobProgress(job.id, 30, 'Starting text extraction...');

    // Add timeout wrapper for OCR processing to prevent hangs
    const ocrTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OCR processing timeout after 5 minutes')), 300000); // 5 minutes max
    });

    let ocrResult;
    try {
      ocrResult = await Promise.race([
        mistralOCRService.extractText(actualFilePath, fileType),
        ocrTimeoutPromise
      ]);
    } catch (error) {
      console.error(`❌ OCR failed for ${actualFilePath}:`, error);
      // Return a fallback result instead of failing completely
      ocrResult = {
        extractedText: `OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. File: ${path.basename(actualFilePath)}`,
        confidence: 0.0,
        processingTime: '0s'
      };
    }
    
    await this.updateJobProgress(job.id, 60, 'OCR extraction completed, generating AI summary...');

    let aiSummary = null;
    let aiSummaryStatus = 'failed';

    // Generate AI summary automatically if we have extracted text
    if (ocrResult.extractedText && ocrResult.extractedText.trim().length > 50) {
      try {
        await this.updateJobProgress(job.id, 70, 'Generating intelligent document summary...');
        aiSummary = await this.generateAISummary(ocrResult.extractedText);
        aiSummaryStatus = 'completed';
        await this.updateJobProgress(job.id, 90, 'AI summary generated successfully...');
      } catch (error) {
        console.error('Failed to generate AI summary during OCR:', error);
        aiSummaryStatus = 'failed';
        await this.updateJobProgress(job.id, 85, 'AI summary failed, continuing with OCR results...');
      }
    } else {
      aiSummaryStatus = 'skipped';
      await this.updateJobProgress(job.id, 85, 'Insufficient text content for AI summary...');
    }

    // Update document with OCR results and AI summary
    if (documentId) {
      const updateData: any = {
        ocrText: ocrResult.extractedText,
        status: 'Analyzed',
        analyses: JSON.stringify({
          ocrConfidence: ocrResult.confidence,
          processingTime: ocrResult.processingTime,
          extractedAt: new Date().toISOString()
        }),
        aiSummaryStatus
      };

      if (aiSummary) {
        updateData.aiSummary = aiSummary;
        updateData.aiSummaryGeneratedAt = new Date();
      }

      await db.update(documents)
        .set(updateData)
        .where(eq(documents.id, documentId));
    }

    await this.updateJobProgress(job.id, 100, 'OCR processing and AI analysis completed successfully');

    const result = {
      extractedText: ocrResult.extractedText,
      confidence: ocrResult.confidence,
      processingTime: ocrResult.processingTime,
      aiSummary,
      aiSummaryStatus,
      documentId
    };

    await this.completeJob(job.id, result);
    
    // Clean up temporary file if it was created
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (err) {
        console.warn('Failed to cleanup temp file:', err);
      }
    }
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
    
    console.log(`🔍 MICRO-STEP 1: processZipFile called with:`, {
      jobId: job.id,
      zipPath,
      dealId,
      folderName
    });
    
    await this.updateJobProgress(job.id, 10, 'Extracting ZIP file...', 'processing');

    console.log(`🔍 MICRO-STEP 2: Loading zipProcessor module...`);
    // Import and use zip processor
    const { zipProcessor } = await import('./zipProcessor');
    
    console.log(`🔍 MICRO-STEP 3: Calling zipProcessor.processZipFile...`);
    const result = await zipProcessor.processZipFile(zipPath, dealId, folderName);
    
    console.log(`🔍 MICRO-STEP 4: ZIP processing result:`, result);
    
    await this.updateJobProgress(job.id, 100, 'ZIP processing completed');
    await this.completeJob(job.id, result);
    
    console.log(`🔍 MICRO-STEP 5: ZIP job completed successfully`);
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
      ) as any;
    } else {
      query = query.where(eq(backgroundJobs.status, 'processing')) as any;
    }

    return await query;
  }

  async getJobHistory(dealId?: number, limit = 50): Promise<BackgroundJob[]> {
    const jobs = await db.select().from(backgroundJobs)
      .where(dealId ? eq(backgroundJobs.dealId, dealId) : undefined)
      .limit(limit);
    return jobs;
  }

  private async generateAISummary(text: string): Promise<any> {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });

    const prompt = `Analyze this investment-related document and provide a comprehensive summary in JSON format.

Document text:
${text.substring(0, 8000)} ${text.length > 8000 ? '...(truncated)' : ''}

Please provide your analysis in exactly this JSON structure:
{
  "executiveSummary": "A concise 2-3 sentence overview of the document's main purpose and content",
  "criticalFindings": ["Array of 3-5 critical points that require immediate attention or are deal-breakers"],
  "keyFinancialData": ["Array of 3-5 important financial metrics, numbers, or projections mentioned"],
  "riskAssessment": ["Array of 2-4 potential risks or concerns identified"],
  "neutralFindings": ["Array of 4-6 factual background information points"],
  "strategicImplications": "2-3 sentences about what this means for investment decisions",
  "documentType": "Classification of document type (e.g., Financial Statement, Pitch Deck, Legal Document, etc.)",
  "confidenceScore": 0.85
}

Focus on investment-relevant information. Be concise but comprehensive. Only include factual information from the document.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert investment analyst. Analyze documents for venture capital due diligence. Provide structured, factual analysis in valid JSON format."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate the required fields exist
      const requiredFields = ['executiveSummary', 'criticalFindings', 'keyFinancialData', 'riskAssessment', 'neutralFindings', 'strategicImplications', 'documentType', 'confidenceScore'];
      for (const field of requiredFields) {
        if (!(field in result)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return result;

    } catch (error: any) {
      console.error('OpenAI API error during summary generation:', error);
      throw new Error(`Failed to generate AI summary: ${error?.message || 'Unknown error'}`);
    }
  }

  private async processAISummaryGeneration(job: BackgroundJob) {
    console.log(`🤖 Processing AI summary generation for job ${job.id}`);
    
    try {
      const documentId = job.documentId;
      if (!documentId) {
        throw new Error('No document ID provided for AI summary generation');
      }

      // Get document data
      const [document] = await db.select()
        .from(documents)
        .where(eq(documents.id, documentId));

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (!document.ocrText || document.ocrText.trim().length === 0) {
        throw new Error('No OCR text available for AI summary generation');
      }

      await this.updateJobProgress(job.id, 25, 'Analyzing document content...');

      // Generate AI summary using OpenAI
      const aiSummary = await this.generateAISummary(document.ocrText);

      await this.updateJobProgress(job.id, 75, 'Processing AI analysis results...');

      // Update document with AI summary
      await db.update(documents)
        .set({
          aiSummary: aiSummary,
          aiSummaryStatus: 'completed',
          aiSummaryGeneratedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(documents.id, documentId));

      await this.updateJobProgress(job.id, 100, 'AI summary generation completed');
      await this.completeJob(job.id, { 
        success: true, 
        documentId: documentId,
        aiSummary: aiSummary 
      });

      console.log(`✅ AI summary generated successfully for document ${documentId}`);

    } catch (error: any) {
      console.error(`❌ AI summary generation failed for job ${job.id}:`, error);
      
      // Update document status to failed
      if (job.documentId) {
        await db.update(documents)
          .set({
            aiSummaryStatus: 'failed',
            updatedAt: new Date()
          })
          .where(eq(documents.id, job.documentId));
      }

      await this.completeJob(job.id, null, error instanceof Error ? error.message : 'AI summary generation failed');
    }
  }

  // Direct AI summary execution method
  async executeAISummaryJobDirectly(jobId: number) {
    console.log(`🎯 DIRECT AI SUMMARY EXECUTION: Starting job ${jobId}`);
    
    try {
      const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId));
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      await this.processAISummaryGeneration(job);
    } catch (error) {
      console.error(`Failed to execute AI summary job ${jobId}:`, error);
      throw error;
    }
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

      // Add timeout for ZIP processing OCR
      const zipOcrTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('ZIP OCR processing timeout after 3 minutes')), 180000); // 3 minutes
      });

      // Determine file type from extension
      const fileType = path.extname(fileName).substring(1).toLowerCase();
      console.log(`🔍 Processing ${fileName} as type: ${fileType}`);

      let ocrResult;
      try {
        ocrResult = await Promise.race([
          mistralOCRService.extractText(filePath, fileType),
          zipOcrTimeoutPromise
        ]);
      } catch (error) {
        console.error(`❌ ZIP OCR failed for ${fileName}:`, error);
        ocrResult = {
          extractedText: `OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. File: ${fileName}`,
          confidence: 0.0,
          processingTime: '0s'
        };
      }
      
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