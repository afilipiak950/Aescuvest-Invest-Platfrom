/**
 * Shared text formatting utilities for AI-generated content
 * Ensures consistent bullet point and list formatting across all agents
 */

/**
 * Normalize inline bullet points to proper markdown list format
 * Converts patterns like "• point1 • point2 • point3" to proper line-separated bullets
 * 
 * @param text - Raw AI-generated text that may contain inline bullets
 * @returns Text with properly formatted markdown lists
 */
export function normalizeBulletLists(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;

  // Pattern 1: Inline bullets with • character (e.g., "• point1 • point2 • point3")
  // Look for patterns where bullets are separated by minimal whitespace (not already on new lines)
  result = result.replace(/([^\n])•\s*(?=[A-Z\*\[])/g, '$1\n\n• ');

  // Pattern 2: Multiple bullets on same line separated by semicolons or periods
  // e.g., "• point1; • point2; • point3" or "• point1. • point2"
  result = result.replace(/([.;])\s*•\s*/g, '$1\n\n• ');

  // Pattern 3: Inline dashes used as bullets (e.g., "- point1 - point2")
  // Only when followed by uppercase or bold marker (to avoid false positives like "year-over-year")
  result = result.replace(/([^\n-])\s+-\s+(?=\*\*[A-Z]|\*\*\[|[A-Z][a-z])/g, '$1\n\n- ');

  // Pattern 4: Ensure bullets after colons or periods are on new lines
  // e.g., "The analysis reveals the following: • point1 • point2"
  result = result.replace(/([:.])\s*•\s*/g, '$1\n\n• ');

  // Pattern 5: Fix bullets that have content immediately after without space
  result = result.replace(/•([A-Z\*])/g, '• $1');

  // Pattern 6: Normalize multiple newlines before bullets to exactly 2
  result = result.replace(/\n{3,}•/g, '\n\n•');

  // Pattern 7: Ensure proper spacing after bullet points in paragraphs
  // Detect paragraphs that look like run-on bullet lists
  result = result.replace(/\.\s*•\s*\*\*/g, '.\n\n• **');

  // Pattern 8: Convert numbered inline lists to proper format
  // e.g., "1. item1 2. item2 3. item3"
  result = result.replace(/(\d+)\.\s+([^.]+)(?=\s+\d+\.\s+)/g, '$1. $2\n\n');

  // Pattern 9: Fix cases where bullet content wraps back to inline
  // Look for sentences that end and new bullets start inline
  result = result.replace(/([a-z])\.\s+•/g, '$1.\n\n•');

  // Clean up: Ensure no trailing spaces before newlines
  result = result.replace(/[ \t]+\n/g, '\n');

  // Clean up: Normalize excessive newlines
  result = result.replace(/\n{4,}/g, '\n\n\n');

  return result;
}

/**
 * Format AI answer for consistent display
 * Combines normalization with markdown cleanup
 * 
 * @param answer - Raw AI-generated answer text
 * @returns Properly formatted answer text
 */
export function formatAgentAnswer(answer: string): string {
  if (!answer || typeof answer !== 'string') {
    return answer;
  }

  let result = answer;

  // First normalize bullet lists
  result = normalizeBulletLists(result);

  // Ensure proper spacing around section headers (bold text followed by colon)
  result = result.replace(/\*\*([^*]+)\*\*:\s*(?!\n)/g, '**$1**:\n');

  // Ensure headers followed by bullets have proper spacing
  result = result.replace(/(:\n)(?=•)/g, ':\n\n');

  // Clean up multiple blank lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

/**
 * Extract and format key findings array
 * Ensures each finding is a clean, formatted string
 * 
 * @param findings - Array of findings from AI response
 * @returns Cleaned and formatted findings array
 */
export function formatKeyFindings(findings: string[]): string[] {
  if (!Array.isArray(findings)) {
    return [];
  }

  return findings
    .map(finding => {
      if (typeof finding !== 'string') {
        return String(finding);
      }
      // Clean up individual findings
      return finding
        .replace(/^\s*[-•*]\s*/, '') // Remove leading bullets
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    })
    .filter(finding => finding.length > 0);
}

/**
 * Fix malformed markdown tables that have rows on separate lines or broken syntax
 * This handles common AI output issues where tables get fragmented
 * 
 * @param content - Content that may contain broken tables
 * @returns Content with properly formatted markdown tables
 */
export function fixMalformedTables(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let result = content;
  const lines = result.split('\n');
  const outputLines: string[] = [];
  
  let inTableBlock = false;
  let tableLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Detect table-related lines
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
    const isPartialTableRow = trimmed.startsWith('|') || trimmed.endsWith('|');
    const isSeparatorRow = /^\|[\s\-:]+\|$/.test(trimmed) || /^\|[-:\s|]+\|$/.test(trimmed);
    const isEmptyPipes = trimmed === '|' || trimmed === '| |' || trimmed === '||';
    const isBrokenSeparator = /^\|[-]+\|?$/.test(trimmed) || /^\|[-|]+$/.test(trimmed);
    
    // Complete valid table row - just pass through
    if (isTableRow && !isSeparatorRow && !isEmptyPipes) {
      if (!inTableBlock) {
        // Start of a new table - add blank line before
        if (outputLines.length > 0 && outputLines[outputLines.length - 1].trim() !== '') {
          outputLines.push('');
        }
        inTableBlock = true;
      }
      tableLines.push(trimmed);
      continue;
    }
    
    // Valid separator row
    if (isSeparatorRow) {
      if (inTableBlock) {
        tableLines.push(trimmed);
      }
      continue;
    }
    
    // Broken separator - fix it
    if (isBrokenSeparator && inTableBlock) {
      // Count columns from first table row
      const firstRow = tableLines[0];
      if (firstRow) {
        const colCount = (firstRow.match(/\|/g) || []).length - 1;
        const fixedSeparator = '|' + Array(Math.max(colCount, 1)).fill('---|').join('');
        tableLines.push(fixedSeparator);
      }
      continue;
    }
    
    // Empty pipe lines - skip them
    if (isEmptyPipes) {
      continue;
    }
    
    // Partial table content - might be a broken row
    if (isPartialTableRow && !isTableRow && inTableBlock) {
      // Try to merge with previous line or treat as cell content
      const cellContent = trimmed.replace(/^\|+\s*/, '').replace(/\s*\|+$/, '').trim();
      if (cellContent && tableLines.length > 0) {
        // This might be continuation content - skip for now
        continue;
      }
    }
    
    // Non-table line - flush table buffer if we have one
    if (tableLines.length > 0) {
      // Ensure we have a separator row after the header
      if (tableLines.length === 1) {
        // Single row table needs a separator
        const colCount = (tableLines[0].match(/\|/g) || []).length - 1;
        const separator = '|' + Array(Math.max(colCount, 1)).fill(' --- |').join('');
        tableLines.splice(1, 0, separator);
      } else {
        // Check if second row is a separator
        const secondRow = tableLines[1];
        if (secondRow && !/^[\|\s\-:]+$/.test(secondRow)) {
          // Insert separator after header
          const colCount = (tableLines[0].match(/\|/g) || []).length - 1;
          const separator = '|' + Array(Math.max(colCount, 1)).fill(' --- |').join('');
          tableLines.splice(1, 0, separator);
        }
      }
      
      outputLines.push(...tableLines);
      outputLines.push(''); // Blank line after table
      tableLines = [];
      inTableBlock = false;
    }
    
    outputLines.push(line);
  }
  
  // Flush any remaining table
  if (tableLines.length > 0) {
    if (tableLines.length === 1) {
      const colCount = (tableLines[0].match(/\|/g) || []).length - 1;
      const separator = '|' + Array(Math.max(colCount, 1)).fill(' --- |').join('');
      tableLines.splice(1, 0, separator);
    }
    outputLines.push(...tableLines);
  }
  
  return outputLines.join('\n');
}

/**
 * Clean up memo section content for professional display
 * Handles HTML tags, spacing issues, and formatting consistency
 * 
 * @param content - Raw memo section content
 * @returns Cleaned and formatted content ready for rendering
 */
export function cleanMemoSectionContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let result = content;

  // Remove raw HTML tags that shouldn't be in markdown
  result = result.replace(/<br\s*\/?>/gi, '\n');
  result = result.replace(/<\/?(p|div|span)[^>]*>/gi, '\n');
  result = result.replace(/<strong>([^<]+)<\/strong>/gi, '**$1**');
  result = result.replace(/<em>([^<]+)<\/em>/gi, '*$1*');
  result = result.replace(/<b>([^<]+)<\/b>/gi, '**$1**');
  result = result.replace(/<i>([^<]+)<\/i>/gi, '*$1*');
  
  // Clean up stray HTML entities
  result = result.replace(/&nbsp;/gi, ' ');
  result = result.replace(/&amp;/gi, '&');
  result = result.replace(/&lt;/gi, '<');
  result = result.replace(/&gt;/gi, '>');
  result = result.replace(/&quot;/gi, '"');

  // Fix malformed tables first
  result = fixMalformedTables(result);

  // Normalize bullet lists
  result = normalizeBulletLists(result);

  // Ensure proper heading formatting
  // Add blank line before headers
  result = result.replace(/([^\n])\n(#{1,4}\s)/g, '$1\n\n$2');
  // Add blank line after headers
  result = result.replace(/(#{1,4}\s[^\n]+)\n([^\n#])/g, '$1\n\n$2');

  // Fix citation formatting (ensure they stay inline with text)
  result = result.replace(/\]\s*\n+\s*\[/g, '] [');

  // Clean up excessive blank lines
  result = result.replace(/\n{4,}/g, '\n\n\n');

  // Trim whitespace
  result = result.trim();

  return result;
}

/**
 * Validate that memo content is not mostly tables/bullets
 * Returns a narrative density score (0-100)
 * 
 * Uses word counts per paragraph rather than line length for accuracy,
 * since markdown can wrap paragraphs across multiple short lines.
 * 
 * ENHANCED: Better detection of tables and structured content
 * 
 * @param content - Memo section content
 * @returns Narrative density score (higher = more prose)
 */
export function calculateNarrativeDensity(content: string): number {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  // Split by newlines for line-by-line analysis
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return 0;

  let proseWordCount = 0;
  let structuredWordCount = 0;
  let tableLineCount = 0;
  let bulletLineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const words = trimmed.split(/\s+/).length;
    
    // ENHANCED: Detect table rows (starts/ends with | or is separator like |---|---|)
    const isTableRow = (trimmed.startsWith('|') || trimmed.endsWith('|')) ||
                       /^\|[\s\-:]+\|/.test(trimmed);
    
    // ENHANCED: Detect bullet/list items (including bold bullet headers)
    const isBulletLine = /^[\-•*]\s/.test(trimmed) || 
                         /^\d+\.\s/.test(trimmed) ||
                         /^[\-•*]\s*\*\*/.test(trimmed);
    
    // Detect headers
    const isHeader = /^#{1,6}\s/.test(trimmed);
    
    // Detect short fragments (labels, short headers, etc.)
    const isShortFragment = words < 8 && !trimmed.includes('.') && !trimmed.includes(',');
    
    if (isTableRow) {
      structuredWordCount += words;
      tableLineCount++;
    } else if (isBulletLine) {
      structuredWordCount += words;
      bulletLineCount++;
    } else if (isHeader) {
      structuredWordCount += words;
    } else if (isShortFragment) {
      // Short fragments without punctuation are likely labels/headers
      structuredWordCount += words;
    } else if (words >= 10) {
      // Longer sentences are prose (10+ words = roughly 1 full sentence)
      proseWordCount += words;
    } else if (trimmed.includes('.') || trimmed.includes(',')) {
      // Shorter lines with punctuation are likely prose continuation
      proseWordCount += words;
    } else {
      structuredWordCount += words;
    }
  }

  const totalWords = proseWordCount + structuredWordCount;
  if (totalWords === 0) return 0;

  // Calculate prose percentage
  let prosePercentage = (proseWordCount / totalWords) * 100;
  
  // PENALTY: If >30% of content lines are tables, apply table-heavy penalty
  const totalLines = lines.length;
  const tableRatio = tableLineCount / totalLines;
  if (tableRatio > 0.3) {
    prosePercentage = Math.max(0, prosePercentage - 15);
  }
  
  // PENALTY: If >50% of content lines are bullets, apply bullet-heavy penalty
  const bulletRatio = bulletLineCount / totalLines;
  if (bulletRatio > 0.5) {
    prosePercentage = Math.max(0, prosePercentage - 10);
  }
  
  return Math.round(prosePercentage);
}

/**
 * Calculate table content percentage for quality scoring
 * Returns what % of the content is table rows
 */
export function calculateTablePercentage(content: string): number {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return 0;

  let tableLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if ((trimmed.startsWith('|') || trimmed.endsWith('|')) ||
        /^\|[\s\-:]+\|/.test(trimmed)) {
      tableLines++;
    }
  }

  return Math.round((tableLines / lines.length) * 100);
}

export default {
  normalizeBulletLists,
  formatAgentAnswer,
  formatKeyFindings,
  cleanMemoSectionContent,
  calculateNarrativeDensity,
  calculateTablePercentage
};
