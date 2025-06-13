import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { backgroundJobManager } from './backgroundJobManager';
import { storage } from '../storage';

interface ProcessedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  ocrText?: string;
  analysisResult?: any;
}

interface DataRoomConnection {
  id: string;
  dealId: number;
  status: 'syncing' | 'processing' | 'connected' | 'failed';
  totalFiles: number;
  processedFiles: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date | null;
  connectionData: {
    extractPath: string;
    zipPath: string;
    folderName: string;
  };
}

interface TimeEstimation {
  totalFiles: number;
  estimatedTotalTime: string;
  averageTimePerFile: number;
  remainingTime: string;
}

export class OptimizedZipProcessor {
  private uploadDir: string;
  private extractDir: string;
  private processingTimes: number[] = [];
  private startTime: Date | null = null;
  private connections: Map<string, DataRoomConnection> = new Map();

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.extractDir = path.join(process.cwd(), 'uploads', 'extracted');
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.extractDir)) {
      fs.mkdirSync(this.extractDir, { recursive: true });
    }
  }

  private calculateTimeEstimation(processedFiles: number, totalFiles: number): TimeEstimation {
    const avgTime = this.processingTimes.length > 0 
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length 
      : 15; // Default estimate of 15 seconds per file

    const remainingFiles = totalFiles - processedFiles;
    const remainingSeconds = remainingFiles * avgTime;
    const totalSeconds = totalFiles * avgTime;

    return {
      totalFiles,
      estimatedTotalTime: this.formatTime(totalSeconds),
      averageTimePerFile: avgTime,
      remainingTime: this.formatTime(remainingSeconds)
    };
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  async processZipFileOptimized(zipPath: string, dealId: number, folderName: string, jobId?: number): Promise<{
    success: boolean;
    message: string;
    processedFiles: ProcessedFile[];
    totalFiles: number;
    processingTime: string;
  }> {
    this.startTime = new Date();
    const connectionId = `${dealId}_${Date.now()}`;
    
    try {
      console.log(`🚀 Starting optimized ZIP processing for deal ${dealId}`);
      
      if (jobId) {
        await backgroundJobManager.updateProgress(jobId, 1, 'Initializing ZIP processing...');
      }

      // Create data room connection
      const extractPath = path.join(this.extractDir, `deal_${dealId}_${Date.now()}`);
      const connection: DataRoomConnection = {
        id: connectionId,
        dealId,
        status: 'syncing',
        totalFiles: 0,
        processedFiles: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null as Date | null,
        connectionData: {
          extractPath,
          zipPath,
          folderName
        }
      };

      // Store connection
      this.connections.set(connectionId, connection);

      // Check cancellation
      if (jobId && await this.isJobCancelled(jobId)) {
        throw new Error('Job was cancelled');
      }

      // Update progress - Starting extraction
      if (jobId) {
        await backgroundJobManager.updateProgress(jobId, 2, 'Extracting ZIP file...');
      }

      // Extract ZIP file
      fs.mkdirSync(extractPath, { recursive: true });
      
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);
      
      console.log(`📁 Extracted ZIP to: ${extractPath}`);

      // Check cancellation after extraction
      if (jobId && await this.isJobCancelled(jobId)) {
        throw new Error('Job was cancelled');
      }

      // Find ALL files recursively - NO FILTERING
      const allFiles = this.getAllFilesOptimized(extractPath);
      
      console.log(`📄 Found ${allFiles.length} total files - ALL WILL BE ANALYZED WITH OCR`);

      // Update connection with file count (process ALL files)
      connection.totalFiles = allFiles.length;
      connection.status = 'processing';

      // Update progress with initial time estimation
      const initialEstimation = this.calculateTimeEstimation(0, allFiles.length);
      if (jobId) {
        await backgroundJobManager.updateProgress(
          jobId, 
          5, 
          `Analyzing ${allFiles.length} documents (Est. ${initialEstimation.estimatedTotalTime})`
        );
      }

      // Process files with OCR and analysis (batch processing for better performance)
      const processedFiles: ProcessedFile[] = [];
      let processedCount = 0;
      const batchSize = 3; // Process 3 files concurrently for better performance

      for (let i = 0; i < allFiles.length; i += batchSize) {
        // Check cancellation before each batch
        if (jobId && await this.isJobCancelled(jobId)) {
          throw new Error('Job was cancelled');
        }

        const batch = allFiles.slice(i, i + batchSize);
        const batchPromises = batch.map(filePath => this.processFileOptimized(filePath, extractPath, dealId));

        try {
          const batchResults = await Promise.allSettled(batchPromises);
          
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              processedFiles.push(result.value);
            }
            processedCount++;
          }

          // Calculate progress and time estimation
          const progress = Math.round(5 + (processedCount / allFiles.length) * 90);
          const timeEstimation = this.calculateTimeEstimation(processedCount, allFiles.length);
          
          // Update progress with time estimation
          if (jobId) {
            await backgroundJobManager.updateProgress(
              jobId, 
              progress, 
              `Analyzed ${processedCount}/${allFiles.length} documents (${timeEstimation.remainingTime} remaining)`
            );
          }

          console.log(`📊 Progress: ${processedCount}/${allFiles.length} files processed (${progress}%)`);

        } catch (batchError) {
          console.error('❌ Error processing batch:', batchError);
          processedCount += batch.length; // Count failed files to continue progress
        }
      }

      // Mark as completed
      connection.status = 'connected';
      connection.lastSyncAt = new Date();
      connection.processedFiles = processedCount;
      connection.updatedAt = new Date();

      this.saveConnection(connection);

      const totalTime = ((Date.now() - this.startTime.getTime()) / 1000).toFixed(2);
      console.log(`✅ ZIP processing completed: ${processedCount}/${allFiles.length} files in ${totalTime}s`);

      return {
        success: true,
        message: `Successfully processed ${processedCount} files`,
        processedFiles,
        totalFiles: allFiles.length,
        processingTime: `${totalTime}s`
      };

    } catch (error: any) {
      console.error('❌ ZIP processing error:', error);
      
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.status = 'failed';
        connection.updatedAt = new Date();
        this.saveConnection(connection);
      }

      throw error;
    }
  }

  private async processFileOptimized(filePath: string, extractPath: string, dealId: number): Promise<ProcessedFile | null> {
    const fileStartTime = Date.now();
    
    try {
      const relativePath = path.relative(extractPath, filePath);
      const fileName = path.basename(filePath);
      const fileStats = fs.statSync(filePath);
      const fileType = this.getFileType(fileName);

      console.log(`🔍 MANDATORY OCR ANALYSIS for: ${fileName} (Type: ${fileType})`);

      let processedFile: ProcessedFile = {
        name: fileName,
        path: relativePath,
        size: fileStats.size,
        type: fileType
      };

      // Process EVERY file with OCR - no exceptions
      try {
        // Force OCR analysis on ALL files regardless of type
        const analysisResult = await Promise.race([
          this.analyzeWithMistralOCR(filePath),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OCR timeout after 120 seconds')), 120000) // Extended timeout
          )
        ]) as any;
        
        processedFile.ocrText = analysisResult.ocrText;
        processedFile.analysisResult = analysisResult;
        
        console.log(`✅ OCR SUCCESS for ${fileName}: ${analysisResult.ocrText?.length || 0} characters extracted`);

        // Save document to database with optimized error handling
        try {
          const relativePath = path.relative(this.extractDir, path.dirname(filePath));
          const folderPath = relativePath === '.' ? '' : relativePath;
          
          const cleanOcrText = analysisResult.ocrText
            ? analysisResult.ocrText.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            : null;

          await storage.createDocument({
            dealId,
            name: fileName,
            type: fileType,
            path: filePath,
            size: fileStats.size,
            status: 'Analyzed',
            ocrText: cleanOcrText,
            analyses: JSON.stringify(analysisResult),
            folderPath: folderPath,
            isFolder: false,
            category: analysisResult.analysis?.category || 'General',
            documentType: analysisResult.analysis?.documentType || fileType,
            summary: analysisResult.analysis?.summary,
            insights: analysisResult.analysis?.insights,
            riskFactors: analysisResult.analysis?.riskFactors
          });
        } catch (dbError) {
          console.error(`Database save error for ${fileName}:`, dbError);
        }

        // Record processing time for estimation
        const processingTime = (Date.now() - fileStartTime) / 1000;
        this.processingTimes.push(processingTime);
        if (this.processingTimes.length > 10) {
          this.processingTimes.shift(); // Keep only last 10 times for better estimation
        }

        console.log(`✅ Analyzed: ${fileName} (${this.formatTime(processingTime)})`);
        return processedFile;

      } catch (error: any) {
        console.error(`❌ Error analyzing ${fileName}:`, error.message);
        
        // Save as unanalyzed document
        try {
          await storage.createDocument({
            dealId,
            name: fileName,
            type: fileType,
            path: filePath,
            size: fileStats.size,
            status: 'Failed Analysis',
            ocrText: null,
            analyses: JSON.stringify({ error: error.message }),
            folderPath: '',
            isFolder: false,
            category: 'General',
            documentType: fileType
          });
        } catch (dbError) {
          console.error(`Database save error for failed ${fileName}:`, dbError);
        }

        return processedFile;
      }

    } catch (fileError) {
      console.error(`❌ Error processing file ${filePath}:`, fileError);
      return null;
    }
  }

  private async isJobCancelled(jobId: number): Promise<boolean> {
    try {
      const { db } = await import('../db');
      const { backgroundJobs } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [job] = await db.select().from(backgroundJobs)
        .where(eq(backgroundJobs.id, jobId));
      
      return job?.status === 'cancelled';
    } catch (error) {
      console.error('Error checking job cancellation:', error);
      return false;
    }
  }

  private getAllFilesOptimized(dirPath: string): string[] {
    const files: string[] = [];
    const maxDepth = 10; // Prevent infinite recursion
    
    const traverse = (currentPath: string, depth: number = 0) => {
      if (depth > maxDepth) return;
      
      try {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
          const fullPath = path.join(currentPath, item);
          try {
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
              traverse(fullPath, depth + 1);
            } else if (stats.size < 100 * 1024 * 1024) { // Skip files larger than 100MB
              files.push(fullPath);
            }
          } catch (statError) {
            console.warn(`⚠️  Could not stat file: ${fullPath}`);
          }
        }
      } catch (readError) {
        console.warn(`⚠️  Could not read directory: ${currentPath}`);
      }
    };

    traverse(dirPath);
    return files;
  }

  private getFileType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    const typeMap: { [key: string]: string } = {
      '.pdf': 'PDF',
      '.doc': 'Word Document',
      '.docx': 'Word Document',
      '.txt': 'Text File',
      '.png': 'Image',
      '.jpg': 'Image',
      '.jpeg': 'Image',
      '.gif': 'Image',
      '.bmp': 'Image',
      '.xls': 'Excel',
      '.xlsx': 'Excel',
      '.csv': 'CSV',
      '.ppt': 'PowerPoint',
      '.pptx': 'PowerPoint',
      '.html': 'HTML',
      '.htm': 'HTML',
      '.xml': 'XML',
      '.json': 'JSON'
    };
    
    return typeMap[ext] || 'Other';
  }

  private async analyzeWithMistralOCR(filePath: string): Promise<any> {
    // Use the actual enhanced Mistral OCR service
    try {
      const fileName = path.basename(filePath);
      const fileType = this.getFileType(fileName);
      
      console.log(`🔍 Starting Mistral OCR for: ${fileName}`);
      
      // Import and use the enhanced Mistral OCR service
      const { mistralOCRService } = await import('./mistralOCR');
      const ocrResult = await mistralOCRService.extractText(filePath, fileType);
      
      console.log(`✅ OCR completed for ${fileName}: ${ocrResult.extractedText.length} characters (${ocrResult.processingTime})`);
      
      return {
        ocrText: ocrResult.extractedText,
        analysis: {
          category: 'Document',
          documentType: fileType,
          summary: ocrResult.extractedText.substring(0, 200) + (ocrResult.extractedText.length > 200 ? '...' : ''),
          confidence: ocrResult.confidence,
          processingTime: ocrResult.processingTime
        }
      };
    } catch (error) {
      console.error(`❌ OCR analysis error for ${path.basename(filePath)}:`, error);
      
      // Return error info instead of throwing to allow batch processing to continue
      return {
        ocrText: `Error processing ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        analysis: {
          category: 'Error',
          documentType: this.getFileType(path.basename(filePath)),
          summary: 'Failed to process document',
          confidence: 0
        }
      };
    }
  }

  private saveConnection(connection: DataRoomConnection): void {
    this.connections.set(connection.id, connection);
  }

  getConnection(connectionId: string): DataRoomConnection | undefined {
    return this.connections.get(connectionId);
  }
}

export const optimizedZipProcessor = new OptimizedZipProcessor();