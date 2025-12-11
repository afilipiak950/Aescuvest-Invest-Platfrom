import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MemoMarkdownRendererProps {
  content: string | null | undefined;
  className?: string;
}

/**
 * Preprocess markdown content to fix common table formatting issues
 * - Ensures tables have proper newlines before/after
 * - Fixes inline table syntax that doesn't render properly
 */
function preprocessMarkdown(content: string): string {
  let processed = content;
  
  // Fix tables that are missing newlines before/after
  // Match table rows and ensure they're on separate lines
  processed = processed.replace(/\|\s*\|/g, '|\n|');
  
  // Fix inline table headers - detect patterns like "| Header | | |---|---|"
  // and convert to proper multi-line format
  const inlineTablePattern = /(\|[^|\n]+\|[^|\n]*)\s*(\|[-:\s|]+\|)/g;
  processed = processed.replace(inlineTablePattern, '$1\n$2');
  
  // Ensure table separator rows are on their own line
  processed = processed.replace(/([^\n])(\|[-:\s|]+\|)/g, '$1\n$2');
  processed = processed.replace(/(\|[-:\s|]+\|)([^\n])/g, '$1\n$2');
  
  // Ensure each table row starts on a new line
  processed = processed.replace(/([^\n|])(\|[^|\n]+\|)/g, '$1\n$2');
  
  // Add blank line before and after table blocks for proper parsing
  // Match the start of a table (line starting with |)
  processed = processed.replace(/([^\n])\n(\|)/g, '$1\n\n$2');
  processed = processed.replace(/(\|[^\n]*)\n([^|\n])/g, '$1\n\n$2');
  
  // Clean up multiple consecutive newlines (max 2)
  processed = processed.replace(/\n{3,}/g, '\n\n');
  
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
          li: ({ children, ...props }) => {
            // Check if this is a "highlight" style item (starts with bold text)
            // These get rendered as styled cards instead of plain bullets
            const childArray = Array.isArray(children) ? children : [children];
            const firstChild = childArray[0];
            const hasStrongStart = firstChild?.type === 'strong' || 
              (typeof firstChild === 'object' && firstChild?.props?.children);
            
            // Render as a styled card for highlight/risk items
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
            
            // Default bullet point style
            return (
              <li className="flex items-start gap-2 text-slate-300 leading-relaxed">
                <span className="text-blue-400 mt-1.5">•</span>
                <span>{children}</span>
              </li>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-600 shadow-lg">
              <table className="min-w-full divide-y divide-slate-600 bg-slate-800/50">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-700/80">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-700 bg-slate-800/30">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-700/40 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-100 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-slate-300 whitespace-normal">
              {children}
            </td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-slate-800/50 rounded-r-lg italic text-slate-300">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
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
