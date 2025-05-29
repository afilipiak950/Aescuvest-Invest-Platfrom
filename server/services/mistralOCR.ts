import fs from 'fs/promises';
import fetch from 'node-fetch';

interface OCRResult {
  extractedText: string;
  confidence: number;
  processingTime: string;
}

interface MistralOCRService {
  extractText(filePath: string, fileType: string): Promise<OCRResult>;
}

class MistralOCRServiceImpl implements MistralOCRService {
  private apiKey: string;
  private baseUrl = 'https://api.mistral.ai/v1';

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY || '';
    if (!this.apiKey) {
      console.warn('MISTRAL_API_KEY not found. OCR will use fallback processing.');
    }
  }

  async extractText(filePath: string, fileType: string): Promise<OCRResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Starting OCR extraction for: ${filePath} (${fileType})`);
      console.log(`🔑 API Key available: ${!!this.apiKey}`);
      console.log(`🔗 Base URL: ${this.baseUrl}`);
      
      if (!this.apiKey) {
        console.log('⚠️ No Mistral API key found, using fallback');
        return this.fallbackTextExtraction(filePath, fileType);
      }

      // Check if file exists
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        console.error(`❌ File not found: ${filePath}`);
        return this.fallbackTextExtraction(filePath, fileType);
      }

      // For text files, read directly
      if (fileType === 'text/plain') {
        const text = await fs.readFile(filePath, 'utf-8');
        return {
          extractedText: text,
          confidence: 1.0,
          processingTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
        };
      }

      // For PDFs, use Mistral's dedicated OCR API
      if (fileType === 'application/pdf') {
        return await this.extractTextFromPDF(filePath, startTime);
      }

      // For images, use Mistral's OCR API
      if (fileType.startsWith('image/')) {
        return await this.extractTextFromImage(filePath, fileType, startTime);
      }

      throw new Error(`Unsupported file type: ${fileType}`);
      
    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      console.error('❌ Error details:', error.message);
      console.log('🔄 Falling back to demo content');
      return this.fallbackTextExtraction(filePath, fileType);
    }
  }

  private async extractTextFromPDF(filePath: string, startTime: number): Promise<OCRResult> {
    console.log(`🔍 Processing PDF with Mistral OCR API: ${filePath}`);
    
    // Read and encode the PDF file
    const fileBuffer = await fs.readFile(filePath);
    const base64File = fileBuffer.toString('base64');
    
    console.log(`📄 File size: ${fileBuffer.length} bytes`);
    console.log(`📄 Base64 length: ${base64File.length} characters`);

    // Use Mistral's dedicated OCR endpoint as per documentation
    const response = await fetch(`${this.baseUrl}/ocr/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          document_url: `data:application/pdf;base64,${base64File}`
        },
        include_image_base64: false
      })
    });

    console.log(`📡 OCR API Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Mistral OCR API error: ${response.status} - ${errorText}`);
      throw new Error(`Mistral OCR API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('🔍 Mistral OCR Response structure:', Object.keys(result));
    console.log('🔍 Full OCR Response:', JSON.stringify(result, null, 2));
    
    // Extract text from the OCR response structure
    let extractedText = '';
    
    // Try different possible response structures
    if (result.text) {
      extractedText = result.text;
    } else if (result.content) {
      extractedText = result.content;
    } else if (result.extracted_text) {
      extractedText = result.extracted_text;
    } else if (result.data && result.data.text) {
      extractedText = result.data.text;
    } else if (result.result && result.result.text) {
      extractedText = result.result.text;
    } else {
      console.log('⚠️ Unknown OCR response structure, checking all fields');
      extractedText = JSON.stringify(result, null, 2);
    }

    const processingTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

    console.log(`✅ OCR completed: ${extractedText.length} characters extracted`);
    console.log(`📝 Extracted text preview: ${extractedText.substring(0, 200)}...`);

    return {
      extractedText,
      confidence: 0.95,
      processingTime
    };
  }

  private async extractTextFromImage(filePath: string, fileType: string, startTime: number): Promise<OCRResult> {
    console.log(`🔍 Processing image with Mistral OCR API: ${filePath}`);
    
    const fileBuffer = await fs.readFile(filePath);
    const base64File = fileBuffer.toString('base64');

    const response = await fetch(`${this.baseUrl}/ocr/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: {
          type: 'image_url',
          image_url: `data:${fileType};base64,${base64File}`
        },
        include_image_base64: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Mistral OCR API error: ${response.status} - ${errorText}`);
      throw new Error(`Mistral OCR API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const extractedText = result.text || result.content || result.extracted_text || '';
    const processingTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

    return {
      extractedText,
      confidence: 0.95,
      processingTime
    };
  }

  private fallbackTextExtraction(filePath: string, fileType: string): OCRResult {
    console.log('🔄 Using fallback text extraction');
    
    return {
      extractedText: `[OCR Processing Failed]\n\nFile: ${filePath}\nType: ${fileType}\n\nThe Mistral OCR service is currently unavailable. Please check your API key configuration and try again.`,
      confidence: 0.0,
      processingTime: '0.0s'
    };
  }
}

export const mistralOCRService = new MistralOCRServiceImpl();