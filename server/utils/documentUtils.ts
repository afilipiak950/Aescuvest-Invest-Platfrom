/**
 * Safe utility functions for document content extraction
 * Prevents type errors when dealing with document.ocrText and document.aiSummary
 */

/**
 * Safely extract document content from various sources
 * Handles both string and object aiSummary types
 */
export function getDocumentContentSafely(document: any): string {
  try {
    // Try OCR text first (most reliable)
    if (document.ocrText && typeof document.ocrText === 'string') {
      return document.ocrText;
    }
    
    // Try AI summary
    if (document.aiSummary) {
      if (typeof document.aiSummary === 'string') {
        return document.aiSummary;
      }
      if (typeof document.aiSummary === 'object') {
        // Handle object-type AI summaries (structured format)
        if (document.aiSummary.executiveSummary) {
          return document.aiSummary.executiveSummary;
        }
        // Handle arrays of findings/data
        if (Array.isArray(document.aiSummary.criticalFindings) && document.aiSummary.criticalFindings.length > 0) {
          return document.aiSummary.criticalFindings.join(' ');
        }
        // Fallback to JSON stringification for objects
        return JSON.stringify(document.aiSummary);
      }
    }
    
    // Return empty string if no content available
    return '';
  } catch (error) {
    console.error('Error extracting document content:', error);
    return '';
  }
}

/**
 * Get a preview of document content (limited length)
 */
export function getDocumentPreview(document: any, maxLength: number = 2000): string {
  const content = getDocumentContentSafely(document);
  return content.substring(0, maxLength);
}

/**
 * Check if document has any text content
 */
export function hasDocumentContent(document: any): boolean {
  return getDocumentContentSafely(document).trim().length > 0;
}

/**
 * Extract text for keyword matching (case-insensitive)
 */
export function getDocumentTextForMatching(document: any): string {
  const content = getDocumentContentSafely(document);
  return (document.name + ' ' + content).toLowerCase();
}

/**
 * Safe document content extraction for analysis services
 * Returns both content and metadata
 */
export function extractDocumentAnalysisData(document: any): {
  content: string;
  hasOcr: boolean;
  hasAiSummary: boolean;
  contentLength: number;
  contentSource: 'ocr' | 'aiSummary' | 'none';
} {
  const hasOcr = !!(document.ocrText && typeof document.ocrText === 'string');
  const hasAiSummary = !!(document.aiSummary);
  const content = getDocumentContentSafely(document);
  
  let contentSource: 'ocr' | 'aiSummary' | 'none' = 'none';
  if (hasOcr && content === document.ocrText) {
    contentSource = 'ocr';
  } else if (hasAiSummary && content.length > 0) {
    contentSource = 'aiSummary';
  }
  
  return {
    content,
    hasOcr,
    hasAiSummary,
    contentLength: content.length,
    contentSource
  };
}