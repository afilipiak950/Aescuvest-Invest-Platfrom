/**
 * Utility functions for cleaning and formatting text content
 */

export function cleanMarkdown(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove excessive asterisks and hashtags but preserve structure
    .replace(/\*{3,}/g, '') // Remove 3+ asterisks
    .replace(/#{3,}/g, '') // Remove 3+ hashtags
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
    .replace(/#{1,6}\s*/g, '') // Remove heading markers
    // Preserve paragraph structure - protect double newlines
    .replace(/\n\s*\n/g, '§PARAGRAPH§') 
    // Clean up excessive whitespace within lines
    .replace(/[ \t]{2,}/g, ' ') // Multiple spaces/tabs to single space
    // Restore paragraph breaks
    .replace(/§PARAGRAPH§/g, '\n\n')
    // Convert bullet points but preserve line structure - BUT NOT subheadings with colons
    .replace(/^\s*[-*+]\s*(?!.*:$)/gm, '• ') // Convert bullet points (but not lines ending with :)
    .replace(/^\s*\d+\.\s*(?!.*:$)/gm, '• ') // Convert numbered lists (but not lines ending with :)
    // Final cleanup - limit excessive line breaks but preserve paragraphs
    .replace(/\n{3,}/g, '\n\n') // Limit to double line breaks
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/^[ \t]+/gm, '') // Remove indentation
    .replace(/[ \t]+$/gm, ''); // Remove trailing spaces
}

// Enhanced business text formatter with better paragraph and section handling
export function formatBusinessTextEnhanced(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return 'No information available';
  }

  let formatted = cleanMarkdown(text);
  
  // If text is very short or empty after cleaning, return fallback
  if (formatted.length < 3) {
    return 'No information available';
  }

  // Enhanced formatting for better readability
  formatted = formatted
    // Ensure proper spacing after periods and colons in lists
    .replace(/([.:])\s*\n\s*([A-Z•])/g, '$1\n\n$2')
    // Add spacing around section breaks
    .replace(/([a-z])\n([A-Z][A-Za-z\s]+:)/g, '$1\n\n$2')
    // Fix spacing around bullet points
    .replace(/\n•\s*/g, '\n• ')
    // Ensure consistent paragraph spacing
    .replace(/\n{2,}/g, '\n\n')
    // Clean up any remaining formatting issues
    .trim();

  return formatted;
}

export function formatBusinessText(text: string | null | undefined): string {
  return formatBusinessTextEnhanced(text);
}

export function formatArrayContent(content: any): string {
  if (!content) return 'No information available';
  
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === 'string') {
          return cleanMarkdown(item);
        } else if (typeof item === 'object' && item !== null) {
          return Object.values(item).join(' - ');
        }
        return String(item);
      })
      .filter(item => item.length > 0)
      .join('\n• ');
  }
  
  if (typeof content === 'string') {
    return cleanMarkdown(content);
  }
  
  if (typeof content === 'object' && content !== null) {
    return Object.entries(content)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }
  
  return String(content);
}

export function formatObjectContent(content: any): string {
  if (!content) return 'No information available';
  
  if (typeof content === 'string') {
    return cleanMarkdown(content);
  }
  
  if (typeof content === 'object' && content !== null) {
    // Try to format as readable text instead of JSON
    if (Array.isArray(content)) {
      return formatArrayContent(content);
    } else {
      return Object.entries(content)
        .map(([key, value]) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          return `${formattedKey}: ${formatBusinessText(String(value))}`;
        })
        .join('\n\n');
    }
  }
  
  return String(content);
}