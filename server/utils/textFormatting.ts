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

export default {
  normalizeBulletLists,
  formatAgentAnswer,
  formatKeyFindings
};
