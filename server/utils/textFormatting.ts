/**
 * Shared text formatting utilities for AI-generated content
 * Ensures consistent bullet point and list formatting across all agents
 */

/**
 * BULLETPROOF citation stripping function
 * Removes ALL agent citation references from memo content for clean professional output
 * 
 * Handles patterns:
 * - [AGENT Agent - Category] (full citation)
 * - [AGENT Agent] (short citation)
 * - Citations split across lines: [Legal Agent\n- Finding]
 * - Orphaned fragments: - Obligations].
 * - All 9 agent types: Legal, Clinical, Commercial, Financial, IP, HR, Research, FOUNDER SUCCESS, ADVISORY
 * 
 * @param content - Content that may contain citation references
 * @returns Clean content with all citations removed
 */
export function stripAgentCitations(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let result = content;

  // All agent name patterns (case-insensitive)
  const agentNames = [
    'LEGAL', 'Legal',
    'CLINICAL', 'Clinical',
    'COMMERCIAL', 'Commercial',
    'FINANCIAL', 'Financial',
    'IP', 'Ip',
    'HR', 'Hr',
    'RESEARCH', 'Research',
    'FOUNDER SUCCESS', 'Founder Success', 'FOUNDER', 'Founder',
    'ADVISORY', 'Advisory'
  ];

  // Build agent pattern (matches any agent name)
  const agentPattern = agentNames.join('|');

  // Pattern 1: Full citations with category [AGENT Agent - Category]
  // Handles single line: [Legal Agent - Funding]
  const fullCitationRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*[-–—]\\s*[^\\]]+\\]`,
    'gi'
  );
  result = result.replace(fullCitationRegex, '');

  // Pattern 2: Short citations [AGENT Agent]
  const shortCitationRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*\\]`,
    'gi'
  );
  result = result.replace(shortCitationRegex, '');

  // Pattern 3: Citations split across lines with newline/whitespace before dash
  // e.g., "[Legal Agent\n- Finding]" or "[Legal Agent\n\n- Finding]"
  const splitCitationRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*[\\n\\s]*[-–—]\\s*[^\\]]+\\]`,
    'gi'
  );
  result = result.replace(splitCitationRegex, '');

  // Pattern 4: Orphaned closing fragments like "- Category]." or "- Category]"
  // These appear when the opening "[Agent" was on previous line
  const orphanedClosingRegex = /^\s*[-–—]\s*[A-Za-z\s]+\]\s*[.,;]?\s*$/gm;
  result = result.replace(orphanedClosingRegex, '');

  // Pattern 5: Orphaned opening fragments like "[Legal Agent" at end of line
  const orphanedOpeningRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*$`,
    'gmi'
  );
  result = result.replace(orphanedOpeningRegex, '');

  // Pattern 6: Inline orphaned fragments mid-text
  // e.g., "some text [Legal Agent\n" 
  const inlineOrphanRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*\\n`,
    'gi'
  );
  result = result.replace(inlineOrphanRegex, '\n');

  // Pattern 7: Just the dash-category fragment without bracket context
  // e.g., "\n- Finding]." or "\n- Obligations]."
  const dashFragmentRegex = /\n\s*[-–—]\s*[A-Za-z]+\]\s*[.,;]?/g;
  result = result.replace(dashFragmentRegex, '');

  // Pattern 8: Trailing orphaned bracket closings
  // e.g., "Finding]." at start of line after citation was split
  const trailingBracketRegex = /^\s*[A-Za-z\s]+\]\s*[.,;]?\s*$/gm;
  // Only apply if line is short (likely orphaned)
  result = result.split('\n').map(line => {
    const trimmed = line.trim();
    // If line is short and ends with ] or ]. - likely orphaned citation fragment
    if (trimmed.length < 40 && /^[A-Za-z\s]+\]\s*[.,;]?$/.test(trimmed)) {
      return '';
    }
    return line;
  }).join('\n');

  // Clean up: Remove extra whitespace left by removals
  result = result.replace(/\s+\./g, '.');  // Fix " ." after removal
  result = result.replace(/\s+,/g, ',');   // Fix " ," after removal
  result = result.replace(/\s+\)/g, ')');  // Fix " )" after removal
  result = result.replace(/\(\s+/g, '(');  // Fix "( " after removal
  
  // Clean up multiple spaces
  result = result.replace(/  +/g, ' ');
  
  // Clean up multiple blank lines left by removals
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Clean up lines that are just whitespace
  result = result.split('\n').filter(line => line.trim() !== '' || line === '').join('\n');

  return result;
}

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
 * SIMPLE table spacing - ensures blank lines around tables for proper parsing
 * Does NOT modify table content to avoid corrupting valid tables
 * 
 * @param content - Content that may have tables
 * @returns Content with proper spacing around tables
 */
export function ensureTableSpacing(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  const lines = content.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prevLine = result[result.length - 1]?.trim() || '';
    
    // Detect valid table rows (starts and ends with |)
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
    const prevIsTableRow = prevLine.startsWith('|') && prevLine.endsWith('|') && prevLine.length > 2;
    const isSeparator = /^\|[-:\s|]+\|$/.test(trimmed);
    const prevIsSeparator = /^\|[-:\s|]+\|$/.test(prevLine);
    
    // Add blank line BEFORE table start if previous is not table/separator/blank
    if ((isTableRow || isSeparator) && !prevIsTableRow && !prevIsSeparator && prevLine !== '') {
      result.push('');
    }
    
    result.push(line);
    
    // Add blank line AFTER table end
    const nextLine = lines[i + 1]?.trim() || '';
    const nextIsTableRow = nextLine.startsWith('|') && nextLine.endsWith('|') && nextLine.length > 2;
    const nextIsSeparator = /^\|[-:\s|]+\|$/.test(nextLine);
    
    if ((isTableRow || isSeparator) && !nextIsTableRow && !nextIsSeparator && nextLine !== '') {
      result.push('');
    }
  }
  
  return result.join('\n');
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

  // CRITICAL: Strip all agent citations for clean professional output
  result = stripAgentCitations(result);

  // Ensure proper spacing around tables for parsing
  result = ensureTableSpacing(result);

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
