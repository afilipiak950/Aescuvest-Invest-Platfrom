import fs from 'fs';
import path from 'path';
import { Mistral } from '@mistralai/mistralai';
import sharp from 'sharp';
import XLSX from 'xlsx';
import mammoth from 'mammoth';

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || '',
});

export class MistralOCRService {
  
  async extractText(filePath: string, mimeType?: string): Promise<{
    extractedText: string;
    confidence: number;
    processingTime: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Starting Mistral OCR analysis for: ${path.basename(filePath)}`);
      console.log(`📁 Full file path: ${filePath}`);
      
      const fileExtension = path.extname(filePath).toLowerCase();
      console.log(`📋 Detected file extension: "${fileExtension}"`);
      let extractedText = '';
      
      // Add timeout wrapper for OCR operations
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timeout after 30 seconds')), 30000);
      });
      
      let ocrPromise: Promise<string>;
      
      if (['.txt', '.md', '.json', '.csv'].includes(fileExtension)) {
        console.log(`📝 Reading text file: ${path.basename(filePath)}`);
        ocrPromise = Promise.resolve(fs.readFileSync(filePath, 'utf8'));
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(fileExtension)) {
        console.log(`🖼️ Processing image file with Mistral Vision: ${path.basename(filePath)}`);
        ocrPromise = this.extractTextFromImage(filePath);
      } else if (fileExtension === '.pdf') {
        console.log(`📄 Processing PDF file: ${path.basename(filePath)}`);
        ocrPromise = this.extractTextFromPDF(filePath);
      } else if (['.xlsx', '.xls', '.csv'].includes(fileExtension)) {
        console.log(`📊 Processing spreadsheet file: ${path.basename(filePath)}`);
        ocrPromise = this.extractTextFromSpreadsheet(filePath);
      } else if (['.docx', '.doc'].includes(fileExtension)) {
        console.log(`📝 Processing document file: ${path.basename(filePath)}`);
        ocrPromise = this.extractTextFromDocument(filePath);
      } else {
        console.log(`⚠️ Unsupported file type for OCR: ${fileExtension}`);
        ocrPromise = Promise.resolve(`File type ${fileExtension} is not supported for text extraction.`);
      }
      
      // Race between OCR and timeout
      extractedText = await Promise.race([ocrPromise, timeoutPromise]);
      
      // Clean text to remove null bytes and invalid UTF-8 characters
      const cleanText = extractedText
        .replace(/\0/g, '') // Remove null bytes
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\uFFFD/g, '') // Remove replacement characters
        .trim();
      
      const processingTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      const confidence = cleanText.length > 0 ? 0.95 : 0.0;
      
      console.log(`✅ OCR completed: ${cleanText.length} characters extracted in ${processingTime}`);
      
      return {
        extractedText: cleanText,
        confidence,
        processingTime
      };
    } catch (error) {
      console.error(`❌ OCR extraction failed for ${filePath}:`, error);
      const processingTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      
      return {
        extractedText: `Error extracting text from ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.0,
        processingTime
      };
    }
  }

  private async extractTextFromImage(filePath: string): Promise<string> {
    try {
      // Convert image to base64
      const imageBuffer = await sharp(filePath)
        .jpeg({ quality: 90 })
        .toBuffer();
      
      const base64Image = imageBuffer.toString('base64');
      
      const response = await mistral.chat.complete({
        model: 'pixtral-12b-2409',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image. Preserve formatting, structure, and layout as much as possible. Include all visible text, numbers, and readable content. If the image contains tables, preserve the table structure. Return only the extracted text without any commentary.'
              },
              {
                type: 'image_url',
                imageUrl: `data:image/jpeg;base64,${base64Image}`
              }
            ]
          }
        ],
        maxTokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    } catch (error) {
      console.error('Error in Mistral image OCR:', error);
      throw error;
    }
  }

  private async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      console.log(`📄 Processing PDF with system tools: ${path.basename(filePath)}`);
      
      const { execSync } = await import('child_process');
      
      // First try direct text extraction with pdftotext
      try {
        console.log(`🔍 Attempting direct text extraction from PDF`);
        const textOutput = execSync(`pdftotext "${filePath}" -`, { encoding: 'utf8', timeout: 30000 });
        
        if (textOutput && textOutput.trim().length > 50) {
          console.log(`✅ Successfully extracted ${textOutput.length} characters via direct text extraction`);
          return textOutput.trim();
        }
        console.log(`⚠️ Direct text extraction returned insufficient content, trying OCR approach`);
      } catch (directError) {
        console.log(`⚠️ Direct text extraction failed, using OCR: ${directError}`);
      }
      
      // Fallback to PDF-to-image OCR conversion
      console.log(`🖼️ Converting PDF to images for OCR processing`);
      const outputDir = `/tmp/pdf_conversion_${Date.now()}`;
      
      // Ensure output directory exists
      execSync(`mkdir -p "${outputDir}"`, { timeout: 5000 });
      
      try {
        // Convert PDF to high-quality images using pdftoppm
        execSync(`pdftoppm -jpeg -r 300 "${filePath}" "${outputDir}/page"`, { timeout: 60000 });
        
        // Get list of generated images
        const imageFiles = execSync(`find "${outputDir}" -name "page-*.jpg" | sort`, { encoding: 'utf8' })
          .trim().split('\n').filter(f => f.length > 0);
        
        if (imageFiles.length === 0) {
          throw new Error('No images generated from PDF');
        }
        
        console.log(`📑 Generated ${imageFiles.length} page images for OCR processing`);
        let fullText = '';
        
        for (let i = 0; i < imageFiles.length; i++) {
          const imagePath = imageFiles[i];
          console.log(`🔍 Processing PDF page ${i + 1}/${imageFiles.length}`);
          
          // Process image with Mistral OCR
          const pageText = await this.extractTextFromImage(imagePath);
          fullText += `--- Page ${i + 1} ---\n${pageText}\n\n`;
        }
        
        console.log(`✅ OCR completed for ${imageFiles.length} pages, total text length: ${fullText.length}`);
        return fullText.trim();
        
      } finally {
        // Clean up output directory
        try {
          execSync(`rm -rf "${outputDir}"`, { timeout: 5000 });
        } catch (cleanupError) {
          console.warn(`Failed to cleanup directory: ${cleanupError}`);
        }
      }
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractTextFromSpreadsheet(filePath: string): Promise<string> {
    try {
      console.log(`📊 Processing Excel/spreadsheet file: ${path.basename(filePath)}`);
      
      // Read the Excel file using XLSX library
      const workbook = XLSX.readFile(filePath);
      let extractedText = '';
      
      // Process each worksheet
      workbook.SheetNames.forEach((sheetName, index) => {
        console.log(`📋 Processing sheet ${index + 1}: ${sheetName}`);
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to CSV format first for better text structure
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        if (csvData.trim().length > 0) {
          extractedText += `\n--- Sheet: ${sheetName} ---\n`;
          extractedText += csvData;
          extractedText += '\n';
        }
      });
      
      if (extractedText.trim().length === 0) {
        return 'No readable content found in spreadsheet.';
      }
      
      console.log(`✅ Successfully extracted ${extractedText.length} characters from ${workbook.SheetNames.length} sheets`);
      return extractedText.trim();
      
    } catch (error) {
      console.error('Error processing spreadsheet:', error);
      throw new Error(`Failed to process spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractTextFromDocument(filePath: string): Promise<string> {
    try {
      console.log(`📝 Processing Word document: ${path.basename(filePath)}`);
      const fileExtension = path.extname(filePath).toLowerCase();
      
      if (fileExtension === '.docx') {
        // Use mammoth for .docx files
        const result = await mammoth.extractRawText({ path: filePath });
        
        if (result.value && result.value.trim().length > 0) {
          console.log(`✅ Successfully extracted ${result.value.length} characters from DOCX`);
          return result.value.trim();
        } else {
          return 'No readable text content found in the Word document.';
        }
      } else if (fileExtension === '.doc') {
        // For older .doc files, recommend conversion or provide basic extraction
        console.log(`⚠️ Legacy .doc format detected - using basic text extraction`);
        return 'Legacy Word document format (.doc) detected. For best results, please convert to .docx format. Basic text extraction may be limited for this format.';
      } else {
        return `Unsupported document format: ${fileExtension}`;
      }
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const mistralOCRService = new MistralOCRService();