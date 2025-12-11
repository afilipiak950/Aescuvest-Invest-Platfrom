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

  // Fix table formatting issues
  // Ensure table rows are on separate lines
  result = result.replace(/\|\s*\n?\s*\|/g, '|\n|');
  
  // Ensure proper spacing around tables
  result = result.replace(/([^\n])\n?\|(\s*[A-Za-z])/g, '$1\n\n|$2');
  result = result.replace(/\|\n([^\|])/g, '|\n\n$1');

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
 * @param content - Memo section content
 * @returns Narrative density score (higher = more prose)
 */
export function calculateNarrativeDensity(content: string): number {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  // Split by double newlines to get paragraphs/blocks
  const blocks = content.split(/\n\n+/).filter(block => block.trim().length > 0);
  if (blocks.length === 0) return 0;

  let proseWordCount = 0;
  let structuredWordCount = 0; // tables, bullets, headers

  for (const block of blocks) {
    const trimmed = block.trim();
    const words = trimmed.split(/\s+/).length;
    
    // Check if this is a structured element (table, bullets, header)
    const lines = trimmed.split('\n');
    const isTable = lines.some(line => line.trim().startsWith('|') && line.trim().endsWith('|'));
    const isBulletList = lines.every(line => {
      const t = line.trim();
      return t.startsWith('•') || t.startsWith('-') || t.startsWith('*') || /^\d+\./.test(t) || t === '';
    });
    const isHeader = lines.every(line => {
      const t = line.trim();
      return t.startsWith('#') || t === '';
    });
    
    if (isTable || isBulletList || isHeader) {
      structuredWordCount += words;
    } else if (words >= 15) {
      // Count as prose if block has at least 15 words (roughly 2 sentences)
      proseWordCount += words;
    } else {
      // Short fragments - could be either, count as structured
      structuredWordCount += words;
    }
  }

  const totalWords = proseWordCount + structuredWordCount;
  if (totalWords === 0) return 0;

  // Calculate prose percentage based on word count
  const prosePercentage = (proseWordCount / totalWords) * 100;
  
  return Math.round(prosePercentage);
}

export default {
  normalizeBulletLists,
  formatAgentAnswer,
  formatKeyFindings,
  cleanMemoSectionContent,
  calculateNarrativeDensity
};
