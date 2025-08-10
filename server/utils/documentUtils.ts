/**
 * Document Utilities for Type-Safe Document Processing
 * 
 * This utility module provides safe methods for extracting and processing
 * document content, preventing type errors and null reference crashes
 * that can occur when documents have inconsistent data structures.
 */

export interface SafeDocumentContent {
  text: string;
  hasContent: boolean;
  source: 'ocr' | 'summary' | 'name' | 'fallback';
  length: number;
}

export interface DocumentAssignmentContext {
  name: string;
  type: string;
  content: string;
  summary?: any;
  confidence: number;
}

/**
 * Safely extracts text content from a document, handling various data types
 * and null/undefined values that can cause crashes in AI processing
 */
export function safeGetDocumentContent(document: any): SafeDocumentContent {
  if (!document) {
    return {
      text: '',
      hasContent: false,
      source: 'fallback',
      length: 0
    };
  }

  // Try OCR text first (most reliable) - check both camelCase and snake_case
  const ocrText = document.ocrText || document.ocr_text;
  if (ocrText && typeof ocrText === 'string' && ocrText.trim().length > 50) {
    return {
      text: ocrText.trim(),
      hasContent: true,
      source: 'ocr',
      length: ocrText.trim().length
    };
  }

  // Try AI summary content - check both camelCase and snake_case
  const aiSummary = document.aiSummary || document.ai_summary;
  if (aiSummary) {
    let summaryText = '';
    
    try {
      if (typeof aiSummary === 'string') {
        summaryText = aiSummary;
      } else if (typeof aiSummary === 'object') {
        // Extract text from summary object
        if (aiSummary.executiveSummary) {
          summaryText += aiSummary.executiveSummary + ' ';
        }
        if (aiSummary.criticalFindings && Array.isArray(aiSummary.criticalFindings)) {
          summaryText += aiSummary.criticalFindings.join(' ') + ' ';
        }
        if (aiSummary.keyFinancialData && Array.isArray(aiSummary.keyFinancialData)) {
          summaryText += aiSummary.keyFinancialData.join(' ') + ' ';
        }
        if (aiSummary.strategicImplications) {
          summaryText += aiSummary.strategicImplications;
        }
      }
    } catch (error) {
      console.warn('Error extracting AI summary text:', error);
    }

    if (summaryText.trim().length > 20) {
      return {
        text: summaryText.trim(),
        hasContent: true,
        source: 'summary',
        length: summaryText.trim().length
      };
    }
  }

  // Fallback to document name and metadata
  const fallbackText = `Document: ${document.name || 'Unknown'}\nType: ${document.type || 'Unknown'}\nSize: ${document.size || 0} bytes`;
  
  return {
    text: fallbackText,
    hasContent: false,
    source: 'name',
    length: fallbackText.length
  };
}

/**
 * Safely extracts executable summary content, handling both string and object types
 */
export function safeGetExecutiveSummary(aiSummary: any): string {
  if (!aiSummary) return '';

  try {
    if (typeof aiSummary === 'string') {
      return aiSummary;
    }
    
    if (typeof aiSummary === 'object' && aiSummary.executiveSummary) {
      return aiSummary.executiveSummary;
    }
  } catch (error) {
    console.warn('Error extracting executive summary:', error);
  }

  return '';
}

/**
 * Creates assignment context for AI-powered document categorization
 */
export function createAssignmentContext(document: any): DocumentAssignmentContext {
  const content = safeGetDocumentContent(document);
  
  return {
    name: document.name || 'Unknown Document',
    type: document.type || 'unknown',
    content: content.text,
    summary: document.aiSummary,
    confidence: content.hasContent ? 0.8 : 0.3
  };
}

/**
 * Safely checks if a document has sufficient content for AI analysis
 */
export function hasMinimumContentForAnalysis(document: any, minLength: number = 100): boolean {
  const content = safeGetDocumentContent(document);
  return content.hasContent && content.length >= minLength;
}

/**
 * Extracts key terms from document content for assignment logic
 */
export function extractKeyTerms(document: any): string[] {
  const content = safeGetDocumentContent(document);
  const text = (document.name || '') + ' ' + content.text;
  
  const keyTerms = [];
  const lowerText = text.toLowerCase();

  // Legal terms
  if (lowerText.includes('agreement') || lowerText.includes('contract') || lowerText.includes('legal')) {
    keyTerms.push('legal');
  }

  // Financial terms
  if (lowerText.includes('financial') || lowerText.includes('budget') || lowerText.includes('revenue')) {
    keyTerms.push('financial');
  }

  // Clinical terms
  if (lowerText.includes('clinical') || lowerText.includes('medical') || lowerText.includes('patient')) {
    keyTerms.push('clinical');
  }

  // Commercial terms
  if (lowerText.includes('sales') || lowerText.includes('marketing') || lowerText.includes('business')) {
    keyTerms.push('commercial');
  }

  // IP terms
  if (lowerText.includes('patent') || lowerText.includes('intellectual') || lowerText.includes('trademark')) {
    keyTerms.push('ip');
  }

  // HR terms
  if (lowerText.includes('employment') || lowerText.includes('employee') || lowerText.includes('hiring')) {
    keyTerms.push('hr');
  }

  // Research terms
  if (lowerText.includes('research') || lowerText.includes('study') || lowerText.includes('analysis')) {
    keyTerms.push('research');
  }

  return keyTerms;
}

/**
 * Validates document object structure to prevent processing errors
 */
export function validateDocumentStructure(document: any): { isValid: boolean; errors: string[] } {
  const errors = [];

  if (!document) {
    errors.push('Document is null or undefined');
    return { isValid: false, errors };
  }

  if (!document.id) {
    errors.push('Document missing ID');
  }

  if (!document.name || typeof document.name !== 'string') {
    errors.push('Document missing or invalid name');
  }

  if (!document.dealId) {
    errors.push('Document missing dealId');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Formats document information for logging and debugging
 */
export function formatDocumentInfo(document: any): string {
  const validation = validateDocumentStructure(document);
  
  if (!validation.isValid) {
    return `Invalid document: ${validation.errors.join(', ')}`;
  }

  const content = safeGetDocumentContent(document);
  const assignedAgents = document.assignedAgents || [];

  return `Document: ${document.name} | Type: ${document.type} | Content: ${content.source} (${content.length} chars) | Agents: ${assignedAgents.length}`;
}

export default {
  safeGetDocumentContent,
  safeGetExecutiveSummary,
  createAssignmentContext,
  hasMinimumContentForAnalysis,
  extractKeyTerms,
  validateDocumentStructure,
  formatDocumentInfo
};