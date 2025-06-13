import fs from 'fs';
import path from 'path';

interface OCRResult {
  ocrText: string;
  analysis: any;
  confidence: number;
  processingTime: number;
}

export async function analyzeDocumentWithMistral(filePath: string): Promise<OCRResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Starting Mistral OCR analysis for: ${path.basename(filePath)}`);
    
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY not configured');
    }

    // Read file as base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const mimeType = getMimeType(filePath);

    // Call Mistral OCR API
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please perform comprehensive OCR and analysis on this document. Extract all text content and provide detailed analysis including:

1. **Document Type**: Identify the type of document (contract, financial statement, presentation, etc.)
2. **Key Information**: Extract important data points, numbers, dates, names, companies
3. **Summary**: Provide a concise summary of the document's content
4. **Legal/Financial Insights**: Highlight any legal terms, financial data, or business insights
5. **Risk Factors**: Identify potential risks or red flags mentioned
6. **Action Items**: Extract any deadlines, requirements, or action items

Please structure your response as JSON with the following format:
{
  "extractedText": "full text content",
  "documentType": "type of document",
  "keyInformation": {
    "companies": [],
    "people": [],
    "dates": [],
    "amounts": [],
    "locations": []
  },
  "summary": "document summary",
  "insights": {
    "legal": [],
    "financial": [],
    "business": []
  },
  "riskFactors": [],
  "actionItems": []
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const analysisContent = result.choices[0]?.message?.content;

    if (!analysisContent) {
      throw new Error('No analysis content received from Mistral API');
    }

    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch (parseError) {
      // If JSON parsing fails, create structured response from text
      analysis = {
        extractedText: analysisContent,
        documentType: 'Unknown',
        keyInformation: {},
        summary: analysisContent.substring(0, 200) + '...',
        insights: { legal: [], financial: [], business: [] },
        riskFactors: [],
        actionItems: []
      };
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Mistral OCR completed for ${path.basename(filePath)} in ${processingTime}ms`);

    return {
      ocrText: analysis.extractedText || analysisContent,
      analysis,
      confidence: 0.95, // Mistral typically has high confidence
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Mistral OCR failed for ${path.basename(filePath)}:`, error);
    
    throw {
      error: error.message,
      processingTime,
      file: path.basename(filePath)
    };
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

export function isSupportedForOCR(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const supportedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
  return supportedExtensions.includes(ext);
}