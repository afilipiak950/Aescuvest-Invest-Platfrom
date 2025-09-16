/**
 * Safe string utility functions to prevent string operation errors
 */

/**
 * Safely converts input to string and provides safe substring operation
 * @param input - Input value that might be string, null, undefined, etc.
 * @param start - Start index for substring (default: 0)
 * @param end - End index for substring (optional)
 * @returns Safe string result
 */
export function safeString(input: any, start: number = 0, end?: number): string {
  // Handle null, undefined, or non-string inputs
  if (input === null || input === undefined) {
    return '';
  }

  // Convert to string safely
  const str = String(input);
  
  // If no start parameter or start is 0 and no end, return full string
  if (start === 0 && end === undefined) {
    return str;
  }

  // Validate start index
  if (start < 0) {
    start = 0;
  }

  // If end is specified, use substring with both parameters
  if (end !== undefined) {
    // Validate end index
    if (end < start) {
      return '';
    }
    return str.substring(start, Math.min(end, str.length));
  }

  // Use substring with just start parameter
  return str.substring(start);
}

/**
 * Safely truncates text to specified length with optional ellipsis
 * @param input - Input text
 * @param maxLength - Maximum length (default: 2000)
 * @param ellipsis - Whether to add '...' when truncated (default: false)
 * @returns Safely truncated string
 */
export function safeTruncate(input: any, maxLength: number = 2000, ellipsis: boolean = false): string {
  const str = safeString(input);
  
  if (str.length <= maxLength) {
    return str;
  }

  const truncated = str.substring(0, maxLength);
  return ellipsis ? truncated + '...' : truncated;
}

/**
 * Safely extracts a portion of text for content analysis
 * @param input - Input text
 * @param maxLength - Maximum length to extract (default: 2000)
 * @returns Safe content excerpt
 */
export function safeContentExcerpt(input: any, maxLength: number = 2000): string {
  return safeTruncate(input, maxLength, false);
}