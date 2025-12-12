import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MemoMarkdownRendererProps {
  content: string | null | undefined;
  className?: string;
}

/**
 * Comprehensive markdown table fixer
 * Handles multiple broken table formats:
 * 1. Tables with each cell on separate lines
 * 2. Missing separator rows
 * 3. Inline tables that need line breaks
 */
function fixBrokenTables(content: string): string {
  let processed = content;
  
  // Pattern 1: Fix "| Header | Value |" style tables that got split across lines
  // Detects lines starting with | followed by content
  const lines = processed.split('\n');
  const fixedLines: string[] = [];
  let inPotentialTable = false;
  let tableBuffer: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim() || '';
    
    // Detect if this could be a malformed table (starts with | or is just |)
    const isTableLine = line.startsWith('|') || line === '|' || line.match(/^\|[-:\s]+\|$/);
    const isEmptyPipes = line === '| |' || line === '||' || line === '|';
    const isSeparator = line.match(/^\|[-:\s|]+\|?$/);
    
    if (isTableLine && !isEmptyPipes && !isSeparator) {
      // This is likely table content
      if (!inPotentialTable) {
        inPotentialTable = true;
        tableBuffer = [];
      }
      tableBuffer.push(line);
    } else if (inPotentialTable && (isEmptyPipes || isSeparator || line === '')) {
      // Skip empty pipe lines and separators in table mode
      if (isSeparator) {
        tableBuffer.push(line);
      }
      continue;
    } else {
      // Not a table line - flush buffer if we have one
      if (tableBuffer.length > 0) {
        // Try to reconstruct the table
        const reconstructed = reconstructTable(tableBuffer);
        fixedLines.push(reconstructed);
        tableBuffer = [];
      }
      inPotentialTable = false;
      fixedLines.push(lines[i]); // Keep original formatting
    }
  }
  
  // Flush any remaining buffer
  if (tableBuffer.length > 0) {
    const reconstructed = reconstructTable(tableBuffer);
    fixedLines.push(reconstructed);
  }
  
  return fixedLines.join('\n');
}

/**
 * Reconstruct a proper markdown table from fragmented lines
 */
function reconstructTable(lines: string[]): string {
  // Try to detect if this is a key-value table (common in memos)
  // Pattern: | Key | | Value or similar
  
  const cleanLines = lines
    .map(l => l.trim())
    .filter(l => l && l !== '|' && l !== '| |' && l !== '||');
  
  if (cleanLines.length === 0) return '';
  
  // Check if we have proper table structure
  const hasProperTable = cleanLines.some(l => {
    const pipeCount = (l.match(/\|/g) || []).length;
    return pipeCount >= 2 && l.includes('|') && !l.match(/^\|[-:\s]+\|$/);
  });
  
  if (hasProperTable) {
    // Table has some structure - clean it up
    const tableLines: string[] = [];
    let hasHeader = false;
    
    for (const line of cleanLines) {
      // Skip pure separator lines for now
      if (line.match(/^\|[-:\s|]+\|?$/)) {
        if (tableLines.length > 0 && !hasHeader) {
          tableLines.push(line);
          hasHeader = true;
        }
        continue;
      }
      
      // Clean up the line
      let cleaned = line;
      if (!cleaned.startsWith('|')) cleaned = '| ' + cleaned;
      if (!cleaned.endsWith('|')) cleaned = cleaned + ' |';
      
      tableLines.push(cleaned);
    }
    
    // Add separator after first row if missing
    if (tableLines.length > 0 && !hasHeader) {
      const firstRow = tableLines[0];
      const colCount = (firstRow.match(/\|/g) || []).length - 1;
      const separator = '|' + Array(Math.max(colCount, 2)).fill('---').join('|') + '|';
      tableLines.splice(1, 0, separator);
    }
    
    return '\n' + tableLines.join('\n') + '\n';
  }
  
  // Convert to a styled key-value format if not a proper table
  // This handles the completely broken format shown in the image
  return convertToKeyValueHtml(cleanLines);
}

/**
 * Convert broken table data to a clean key-value HTML format
 */
function convertToKeyValueHtml(lines: string[]): string {
  // Extract key-value pairs from lines like:
  // | Legal Name
  // | BAIBYS Fertility Ltd.
  // or
  // **Legal Name** | BAIBYS Fertility Ltd.
  
  const pairs: Array<{key: string, value: string}> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\|+\s*/, '').replace(/\s*\|+$/, '').trim();
    
    if (!line) continue;
    
    // Check if this is a key (bold text or ends with :)
    const isBold = line.startsWith('**') || line.match(/^[A-Z][a-zA-Z\s]+$/);
    const isKey = isBold || line.endsWith(':');
    
    if (isKey && i + 1 < lines.length) {
      const nextLine = lines[i + 1].replace(/^\|+\s*/, '').replace(/\s*\|+$/, '').trim();
      if (nextLine && !nextLine.startsWith('**') && !nextLine.endsWith(':')) {
        pairs.push({
          key: line.replace(/\*\*/g, '').replace(/:$/, ''),
          value: nextLine
        });
        i++; // Skip next line since we consumed it
        continue;
      }
    }
    
    // Check for inline key:value or key | value
    const colonMatch = line.match(/^(.+?):\s*(.+)$/);
    const pipeMatch = line.match(/^(.+?)\s*\|\s*(.+)$/);
    
    if (colonMatch && colonMatch[2]) {
      pairs.push({
        key: colonMatch[1].replace(/\*\*/g, ''),
        value: colonMatch[2]
      });
    } else if (pipeMatch && pipeMatch[2]) {
      pairs.push({
        key: pipeMatch[1].replace(/\*\*/g, ''),
        value: pipeMatch[2]
      });
    }
  }
  
  if (pairs.length === 0) {
    // Just return as regular text if we couldn't parse
    return lines.join('\n');
  }
  
  // Build a proper markdown table from the pairs
  const tableRows = pairs.map(p => `| **${p.key}** | ${p.value} |`);
  return '\n| Field | Details |\n|---|---|\n' + tableRows.join('\n') + '\n';
}

/**
 * Preprocess markdown to ensure tables render correctly
 */
function preprocessMarkdown(content: string): string {
  let processed = content;
  
  // First, try to fix completely broken tables
  processed = fixBrokenTables(processed);
  
  // Ensure proper spacing around tables
  processed = processed.replace(/([^\n])\n(\|[^|])/g, '$1\n\n$2');
  processed = processed.replace(/(\|[^\n]*)\n([^|\n])/g, '$1\n\n$2');
  
  // Clean up excessive newlines
  processed = processed.replace(/\n{4,}/g, '\n\n\n');
  
  return processed;
}

export function MemoMarkdownRenderer({ content, className = '' }: MemoMarkdownRendererProps) {
  if (!content || content.trim() === '') {
    return (
      <div className="text-gray-400 italic">
        No information available
      </div>
    );
  }

  // Preprocess content to fix table formatting issues
  const processedContent = preprocessMarkdown(content);

  return (
    <div className={`memo-markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-600">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-white mt-6 mb-3 pb-2 border-b border-slate-700">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-slate-100 mt-5 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-slate-200 mt-4 mb-2">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-slate-300 leading-relaxed mb-4 text-base">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-200">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-none ml-0 mb-4 space-y-3 text-slate-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside ml-6 mb-4 space-y-2 text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children }) => {
            const childArray = Array.isArray(children) ? children : [children];
            const firstChild = childArray[0];
            const hasStrongStart = firstChild?.type === 'strong' || 
              (typeof firstChild === 'object' && firstChild?.props?.children);
            
            if (hasStrongStart) {
              return (
                <li className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-700/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                    <div className="flex-1 text-slate-300 leading-relaxed">
                      {children}
                    </div>
                  </div>
                </li>
              );
            }
            
            return (
              <li className="flex items-start gap-2 text-slate-300 leading-relaxed">
                <span className="text-blue-400 mt-1.5">•</span>
                <span>{children}</span>
              </li>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 rounded-xl border border-slate-600/80 shadow-xl bg-gradient-to-b from-slate-800/90 to-slate-850/90">
              <table className="min-w-full">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-slate-700 to-slate-700/80 border-b-2 border-blue-500/30">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-700/60">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-700/30 transition-all duration-150">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-5 py-4 text-left text-sm font-bold text-blue-100 uppercase tracking-wider bg-slate-700/50">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-5 py-4 text-sm text-slate-200 whitespace-normal leading-relaxed">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-slate-800/50 rounded-r-lg italic text-slate-300">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-slate-700 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-slate-900 text-slate-300 p-4 rounded-lg text-sm font-mono overflow-x-auto my-4">
                {children}
              </code>
            );
          },
          hr: () => (
            <hr className="my-6 border-slate-600" />
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              className="text-blue-400 hover:text-blue-300 underline transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
