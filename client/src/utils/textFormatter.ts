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
    // Convert bullet points but preserve line structure
    .replace(/^\s*[-*+]\s*/gm, '• ') // Convert bullet points
    .replace(/^\s*\d+\.\s*/gm, '• ') // Convert numbered lists
    // Final cleanup - limit excessive line breaks but preserve paragraphs
    .replace(/\n{3,}/g, '\n\n') // Limit to double line breaks
    .replace(/^\s+|\s+$/g, '') // Trim start and end
    .replace(/^[ \t]+/gm, '') // Remove indentation
    .replace(/[ \t]+$/gm, ''); // Remove trailing spaces
}

export function formatBusinessText(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return 'No information available';
  }

  const cleaned = cleanMarkdown(text);
  
  // If text is very short or empty after cleaning, return fallback
  if (cleaned.length < 3) {
    return 'No information available';
  }

  return cleaned;
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