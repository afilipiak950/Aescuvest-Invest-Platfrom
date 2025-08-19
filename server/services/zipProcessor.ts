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

export class ZipProcessor {
  private uploadDir: string;
  private extractDir: string;
  private connections: Map<string, any> = new Map();

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

  async processZipFile(zipPath: string, dealId: number, folderName: string, jobId?: number): Promise<{
    connection: any;
    processedFiles: ProcessedFile[];
    totalFiles: number;
  }> {
    try {
      console.log(`🔄 Processing ZIP file for deal ${dealId}: ${zipPath}`);
      
      // Create data room connection
      const connection = {
        id: Date.now(),
        dealId,
        connectionType: 'zip_upload',
        folderName,
        connectionData: { 
          zipPath,
          extractPath: path.join(this.extractDir, `deal-${dealId}-${Date.now()}`)
        },
        status: 'syncing',
        totalFiles: 0,
        processedFiles: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null as Date | null
      };

      // Extract ZIP file
      const extractPath = connection.connectionData.extractPath;
      fs.mkdirSync(extractPath, { recursive: true });
      
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractPath, true);
      
      console.log(`📁 Extracted ZIP to: ${extractPath}`);

      // Find all files recursively
      const allFiles = this.getAllFiles(extractPath);
      console.log(`📄 Found ${allFiles.length} files - ALL WILL BE ANALYZED WITH OCR`);

      // Update connection with file count
      connection.totalFiles = allFiles.length;
      connection.status = 'processing';

      // Update job progress
      if (jobId) {
        await backgroundJobManager.updateProgress(jobId, 5, `Extracted ${allFiles.length} files, starting OCR analysis...`);
      }

      // Process files with OCR and analysis
      const processedFiles: ProcessedFile[] = [];
      let processedCount = 0;

      for (const filePath of allFiles) {
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

          // Process EVERY file with OCR - no file type restrictions
          try {
            console.log(`⏱️ Starting OCR with 30-second timeout for: ${fileName}`);
            
            // Force OCR analysis on ALL files regardless of type with timeout
            const analysisResult = await Promise.race([
              this.analyzeWithMistralOCR(filePath),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`OCR timeout for ${fileName}`)), 30000)
              )
            ]);
            
            processedFile.ocrText = analysisResult.ocrText;
            processedFile.analysisResult = analysisResult;
            
            console.log(`✅ OCR SUCCESS for ${fileName}: ${analysisResult.ocrText?.length || 0} characters extracted`);

            // Save document to database with folder structure
            try {
              // Extract folder path relative to extraction directory
              const relativePath = path.relative(this.extractDir, path.dirname(filePath));
              const folderPath = relativePath === '.' ? '' : relativePath;
              
              // Clean OCR text to remove null bytes and non-UTF8 characters
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

            console.log(`✅ Analyzed: ${fileName}`);
          } catch (error: any) {
            console.error(`❌ Error analyzing ${fileName}:`, error);
            
            // Save document with error status - still save every file to database
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
          }

          processedFiles.push(processedFile);
          processedCount++;
          
          // Update progress
          connection.processedFiles = processedCount;

          // Calculate progress percentage (5% for extraction + 95% for processing)
          const progressPercent = Math.round(5 + (processedCount / allFiles.length) * 95);
          
          // Update job progress with current file
          if (jobId) {
            console.log(`📊 Updating job ${jobId} progress: ${progressPercent}% - ${fileName}`);
            await backgroundJobManager.updateProgress(
              jobId, 
              progressPercent, 
              `Analyzing document ${processedCount}/${allFiles.length}`, 
              fileName
            );
          }

          console.log(`📊 Progress: ${processedCount}/${allFiles.length} files processed`);

        } catch (fileError) {
          console.error(`❌ Error processing file ${filePath}:`, fileError);
        }
      }

      // Mark as completed
      connection.status = 'connected';
      connection.lastSyncAt = new Date();
      connection.processedFiles = processedCount;
      connection.updatedAt = new Date();
      
      // Save connection to memory store
      this.saveConnection(connection);

      console.log(`🎉 Completed processing ZIP file for deal ${dealId}`);
      console.log(`📈 Final stats: ${processedCount}/${allFiles.length} files processed`);

      return {
        connection,
        processedFiles,
        totalFiles: allFiles.length
      };

    } catch (error) {
      console.error('❌ Error processing ZIP file:', error);
      throw error;
    }
  }

  private getAllFiles(dirPath: string): string[] {
    const files: string[] = [];
    
    const traverse = (currentPath: string) => {
      try {
        const items = fs.readdirSync(currentPath);
        
        for (const item of items) {
          const fullPath = path.join(currentPath, item);
          try {
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
              traverse(fullPath);
            } else {
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

  private saveConnection(connection: any): void {
    this.connections.set(connection.id.toString(), connection);
  }

  getConnection(connectionId: string): any {
    return this.connections.get(connectionId);
  }
}

export const zipProcessor = new ZipProcessor();