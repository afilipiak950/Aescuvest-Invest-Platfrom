import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
// Import jobProcessor for creating OCR jobs
// backgroundJobManager removed - using jobProcessor for automatic processing
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

  /**
   * Process ZIP file downloaded from GCS for direct upload solution
   * Bypasses 413 errors by processing files already in GCS
   */
  async processZipFromGCS(
    tempFilePath: string,
    dealId: number,
    parentDocumentId: number,
    gcsPath: string
  ): Promise<any[]> {
    console.log('📦 MICRO-STEP: Processing ZIP from GCS direct upload', {
      tempFile: tempFilePath,
      dealId,
      parentId: parentDocumentId,
      gcsPath
    });

    try {
      const yauzl = await import('yauzl');
      const util = await import('util');
      const openZip = util.promisify(yauzl.open);
      
      // Open the ZIP file
      const zipFile = await openZip(tempFilePath);
      const documents: any[] = [];
      
      return new Promise((resolve, reject) => {
        zipFile.on('entry', async (entry: any) => {
          const fileName = entry.fileName;
          
          // Skip directories and system files
          if (/\/$/.test(fileName) || fileName.startsWith('__MACOSX/') || fileName.startsWith('.')) {
            zipFile.readEntry();
            return;
          }

          console.log(`📄 Processing entry: ${fileName}`);
          
          // Create document entry using storage
          try {
            const doc = await storage.createDocument({
              dealId,
              name: path.basename(fileName),
              type: 'text/plain', // Default type for extracted files
              path: `extracted/${fileName}`, // Virtual path for extracted files
              size: 0, // Size unknown for extracted files
              parentId: parentDocumentId,
              uploadedAt: new Date(),
              metadata: {
                originalPath: fileName,
                extractedFrom: gcsPath,
                compressed: true,
                extractedAt: new Date().toISOString()
              }
            } as any);
            
            documents.push(doc);
            console.log(`✅ Created document ${doc.id} for ${fileName}`);
          } catch (error) {
            console.error(`❌ Failed to process ${fileName}:`, error);
          }

          zipFile.readEntry();
        });

        zipFile.on('end', () => {
          console.log(`✅ ZIP processing complete: ${documents.length} documents`);
          resolve(documents);
        });

        zipFile.on('error', (error: any) => {
          console.error('❌ ZIP processing error:', error);
          reject(error);
        });

        zipFile.readEntry();
      });

    } catch (error) {
      console.error('❌ Failed to process ZIP from GCS:', error);
      throw error;
    }
  }

  async processZipFile(zipPath: string, dealId: number, folderName: string, jobId?: number): Promise<{
    connection: any;
    processedFiles: ProcessedFile[];
    totalFiles: number;
  }> {
    try {
      console.log(`🔄 Processing ZIP file for deal ${dealId}: ${zipPath}`);
      
      // Handle different storage types
      let actualZipPath = zipPath;
      
      // Handle Google Cloud Storage paths
      if (zipPath.startsWith('gs://')) {
        console.log(`☁️ Downloading ZIP from Google Cloud Storage: ${zipPath}`);
        const { gcsService } = await import('./googleCloudStorage');
        const tempPath = path.join(this.uploadDir, `temp-gcs-${Date.now()}.zip`);
        
        // Create temp directory if it doesn't exist
        if (!fs.existsSync(this.uploadDir)) {
          fs.mkdirSync(this.uploadDir, { recursive: true });
        }
        
        // Download from GCS to temp file
        await gcsService.downloadFile(zipPath, tempPath);
        actualZipPath = tempPath;
        console.log(`📥 Downloaded ZIP from GCS to: ${tempPath}`);
      }
      // Handle database-stored files
      else if (zipPath.startsWith('db://')) {
        const { dbFileStorage } = await import('./databaseFileStorage');
        const tempPath = path.join(this.uploadDir, `temp-${Date.now()}.zip`);
        await dbFileStorage.retrieveFile(zipPath, tempPath);
        actualZipPath = tempPath;
        console.log(`📥 Retrieved ZIP from database to: ${tempPath}`);
      }
      
      // Create data room connection
      const connection = {
        id: Date.now(),
        dealId,
        connectionType: 'zip_upload',
        folderName,
        connectionData: { 
          zipPath: actualZipPath,
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
      
      const zip = new AdmZip(actualZipPath);
      zip.extractAllTo(extractPath, true);
      
      // Clean up temp file if it was from GCS or database
      if ((zipPath.startsWith('gs://') || zipPath.startsWith('db://')) && fs.existsSync(actualZipPath)) {
        fs.unlinkSync(actualZipPath);
        console.log(`🗑️ Cleaned up temporary ZIP file`);
      }
      
      console.log(`📁 Extracted ZIP to: ${extractPath}`);

      // Find all files recursively
      const allFiles = this.getAllFiles(extractPath);
      console.log(`📄 Found ${allFiles.length} files - ALL WILL BE ANALYZED WITH OCR`);

      // Update connection with file count
      connection.totalFiles = allFiles.length;
      connection.status = 'processing';

      // Note: jobId parameter is for legacy compatibility
      // Individual OCR jobs will be created for each file below
      console.log(`📄 Extracted ${allFiles.length} files, creating OCR jobs for automatic processing...`);

      // Create documents and OCR jobs for automatic processing
      const processedFiles: ProcessedFile[] = [];
      let processedCount = 0;
      
      // Import backgroundJobManager for creating automatic OCR jobs (UI compatibility)
      const { backgroundJobManager } = await import('./backgroundJobManager');

      for (const filePath of allFiles) {
        try {
          const relativePath = path.relative(extractPath, filePath);
          const fileName = path.basename(filePath);
          const fileStats = fs.statSync(filePath);
          const fileType = this.getFileType(fileName);

          console.log(`📄 Creating document and OCR job for: ${fileName} (Type: ${fileType})`);

          // Extract folder path relative to extraction directory
          const relativeDir = path.relative(this.extractDir, path.dirname(filePath));
          let folderPath = relativeDir === '.' ? '' : relativeDir;
          
          // Remove deal-specific prefix from folder path to show clean hierarchy
          const dealPrefix = `deal-${dealId}-`;
          const dealDirRegex = new RegExp(`^${dealPrefix}\\d+[\\\\/]?`, 'g');
          folderPath = folderPath.replace(dealDirRegex, '');
          
          // Normalize folder path separators for consistent display
          folderPath = folderPath.replace(/\\/g, '/');
          
          console.log(`📁 Folder path calculation: ${filePath} -> ${folderPath}`);

          // Create document in database first
          const document = await storage.createDocument({
            dealId,
            name: fileName,
            type: fileType,
            path: `extracted/${relativePath}`, // Virtual path for display
            size: fileStats.size,
            status: 'Pending', // Will be updated by OCR job
            folderPath: folderPath,
            isFolder: false,
            category: 'General',
            documentType: fileType
          } as any);
          
          console.log(`✅ Created document ${document.id}: ${fileName}`);

          // Create OCR job for automatic processing (OCR + AI Summary)
          const ocrJobId = await backgroundJobManager.createJob({
            jobType: 'document_ocr',
            dealId: dealId,
            documentId: document.id,
            jobData: {
              filePath: filePath, // Actual file path for OCR processing
              fileName: fileName,
              fileType: fileType,
              documentId: document.id,
              documentName: fileName
            }
          });
          
          console.log(`🚀 Created OCR job ${ocrJobId} for document ${document.id}: ${fileName}`);

          const processedFile: ProcessedFile = {
            name: fileName,
            path: relativePath,
            size: fileStats.size,
            type: fileType
          };
          
          processedFiles.push(processedFile);
          processedCount++;
          
          console.log(`📊 Progress: ${processedCount}/${allFiles.length} files queued for processing`);

        } catch (error: any) {
          console.error(`❌ Error creating document/job for ${path.basename(filePath)}:`, error);
          
          // Still create a basic document entry even if job creation fails
          try {
            await storage.createDocument({
              dealId,
              name: path.basename(filePath),
              type: this.getFileType(path.basename(filePath)),
              path: path.relative(extractPath, filePath),
              size: fs.statSync(filePath).size,
              status: 'Failed',
              folderPath: '',
              isFolder: false,
              category: 'General',
              documentType: 'Unknown'
            } as any);
            console.log(`⚠️ Created basic document entry for ${path.basename(filePath)}`);
          } catch (dbError) {
            console.error(`❌ Failed to create document entry:`, dbError);
          }

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