import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MemoMarkdownRendererProps {
  content: string | null | undefined;
  className?: string;
}

/**
 * BULLETPROOF citation stripping - removes ALL agent citation references
 * Duplicated from backend for client-side defense-in-depth
 */
function stripAgentCitations(content: string): string {
  if (!content) return content;

  let result = content;

  // All agent name patterns
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

  const agentPattern = agentNames.join('|');

  // Pattern 1: Full citations [AGENT Agent - Category]
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

  // Pattern 3: Citations split across lines (handles \n, \n\n, etc.)
  const splitCitationRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*[\\n\\s]*[-–—]\\s*[^\\]]+\\]`,
    'gi'
  );
  result = result.replace(splitCitationRegex, '');

  // Pattern 4: Orphaned closing fragments
  result = result.replace(/^\s*[-–—]\s*[A-Za-z\s]+\]\s*[.,;]?\s*$/gm, '');

  // Pattern 5: Orphaned opening fragments
  const orphanedOpeningRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*$`,
    'gmi'
  );
  result = result.replace(orphanedOpeningRegex, '');

  // Pattern 6: Inline orphaned fragments
  const inlineOrphanRegex = new RegExp(
    `\\[\\s*(${agentPattern})\\s+Agent\\s*\\n`,
    'gi'
  );
  result = result.replace(inlineOrphanRegex, '\n');

  // Pattern 7: Dash-category fragments
  result = result.replace(/\n\s*[-–—]\s*[A-Za-z]+\]\s*[.,;]?/g, '');

  // Pattern 8: Trailing orphaned bracket closings (short lines ending with ])
  result = result.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.length < 40 && /^[A-Za-z\s]+\]\s*[.,;]?$/.test(trimmed)) {
      return '';
    }
    return line;
  }).join('\n');

  // Cleanup
  result = result.replace(/\s+\./g, '.');
  result = result.replace(/\s+,/g, ',');
  result = result.replace(/  +/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * BULLETPROOF table normalization - fixes malformed AI-generated tables
 * Handles inline tables, bullets inside cells, missing separators
 */
function normalizeMemoTables(content: string): string {
  if (!content) return content;

  let result = content;

  // Step 1: Fix bullets inside table cells (convert to dash separator)
  result = result.replace(/\|\s*([^|]+?)\s*\n+\s*[•]\s*\n+\s*([^|]+?)\s*\|/g, '| $1 - $2 |');
  result = result.replace(/\|\s*([^|•]+?)\s*•\s*([^|]+?)\s*\|/g, '| $1 - $2 |');

  // Step 2: Fix inline multi-row tables: `| A | B | | C | D |` → separate rows
  // Only split when `| |` is followed by word content (avoids breaking empty cells)
  result = result.replace(/\|\s+\|\s+(?=[A-Za-z0-9$*\[])/g, '|\n| ');

  // Step 4: Process line by line to ensure proper structure
  const lines = result.split('\n');
  const outputLines: string[] = [];
  let tableRows: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    const isValidTableRow = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
    const isSeparator = /^\|[-:\s|]+\|$/.test(trimmed);
    
    if (isValidTableRow || isSeparator) {
      tableRows.push(trimmed);
    } else {
      // Flush table
      if (tableRows.length > 0) {
        outputLines.push('');
        const colCount = (tableRows[0].match(/\|/g) || []).length - 1;
        const hasSep = tableRows.some(r => /^\|[-:\s|]+\|$/.test(r));
        
        for (let j = 0; j < tableRows.length; j++) {
          outputLines.push(tableRows[j]);
          if (j === 0 && !hasSep && tableRows.length > 1) {
            outputLines.push('|' + Array(Math.max(colCount, 1)).fill(' --- ').join('|') + '|');
          }
        }
        if (tableRows.length === 1 && !hasSep) {
          outputLines.push('|' + Array(Math.max(colCount, 1)).fill(' --- ').join('|') + '|');
        }
        outputLines.push('');
        tableRows = [];
      }
      outputLines.push(lines[i]);
    }
  }

  // Flush remaining
  if (tableRows.length > 0) {
    outputLines.push('');
    const colCount = (tableRows[0].match(/\|/g) || []).length - 1;
    const hasSep = tableRows.some(r => /^\|[-:\s|]+\|$/.test(r));
    for (let j = 0; j < tableRows.length; j++) {
      outputLines.push(tableRows[j]);
      if (j === 0 && !hasSep && tableRows.length > 1) {
        outputLines.push('|' + Array(Math.max(colCount, 1)).fill(' --- ').join('|') + '|');
      }
    }
    if (tableRows.length === 1 && !hasSep) {
      outputLines.push('|' + Array(Math.max(colCount, 1)).fill(' --- ').join('|') + '|');
    }
    outputLines.push('');
  }

  return outputLines.join('\n');
}

/**
 * SIMPLE and SAFE table preprocessing
 * Only ensures proper blank lines around tables - does NOT modify table content
 * This lets remarkGfm parse valid tables correctly
 */
function ensureTableSpacing(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const prevLine = result[result.length - 1]?.trim() || '';
    
    // Detect table rows (starts and ends with |)
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
    const prevIsTableRow = prevLine.startsWith('|') && prevLine.endsWith('|') && prevLine.length > 2;
    
    // Add blank line BEFORE table if previous line is not a table row and not blank
    if (isTableRow && !prevIsTableRow && prevLine !== '' && prevLine !== '---') {
      result.push('');
    }
    
    result.push(line);
    
    // Add blank line AFTER table if next line is not a table row
    const nextLine = lines[i + 1]?.trim() || '';
    const nextIsTableRow = nextLine.startsWith('|') && nextLine.endsWith('|') && nextLine.length > 2;
    const nextIsSeparator = /^\|[-:\s|]+\|$/.test(nextLine);
    
    if (isTableRow && !nextIsTableRow && !nextIsSeparator && nextLine !== '') {
      result.push('');
    }
  }
  
  return result.join('\n');
}

export function MemoMarkdownRenderer({ content, className = '' }: MemoMarkdownRendererProps) {
  if (!content || content.trim() === '') {
    return (
      <div className="text-gray-400 italic">
        No information available
      </div>
    );
  }

  // CRITICAL: Clean content in proper order
  // 1. Strip agent citations
  // 2. Normalize malformed tables
  // 3. Add spacing around tables
  const cleanedContent = stripAgentCitations(content);
  const normalizedContent = normalizeMemoTables(cleanedContent);
  const processedContent = ensureTableSpacing(normalizedContent);

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
            <div className="overflow-x-auto my-6 rounded-xl border border-slate-600/80 shadow-xl bg-gradient-to-b from-slate-800/90 to-slate-900/90">
              <table className="min-w-full divide-y divide-slate-600">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-r from-slate-700 to-slate-700/80">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-700/60 bg-slate-800/30">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-700/30 transition-all duration-150">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-5 py-4 text-left text-sm font-bold text-blue-100 uppercase tracking-wider">
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
