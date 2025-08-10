#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs';

// Fix React rendering errors by safely handling quote.document objects
const filePath = 'client/src/components/EnhancedAgentCard.tsx';
const content = readFileSync(filePath, 'utf-8');

// Pattern to find and fix unsafe quote.document rendering
const unsafePattern = /onClick={() => handleDocumentClick\(quote\.document\)}/g;
const unsafeTitlePattern = /title={`View document: \${quote\.document}`}/g;
const unsafeDisplayPattern = /📄 \{quote\.document\.length > 25 \? `\${quote\.document\.substring\(0, 25\)}\.\.\.` : quote\.document\}/g;

const safeOnClickReplacement = `onClick={() => {
                                              const docName = typeof quote.document === 'string' ? quote.document : (quote.document?.title || quote.document?.name || 'Document');
                                              handleDocumentClick(docName);
                                            }}`;

const safeTitleReplacement = `title={\`View document: \${typeof quote.document === 'string' ? quote.document : (quote.document?.title || quote.document?.name || 'Document')}\`}`;

const safeDisplayReplacement = `📄 {(() => {
                                              const docName = typeof quote.document === 'string' ? quote.document : (quote.document?.title || quote.document?.name || 'Document');
                                              return docName.length > 25 ? \`\${docName.substring(0, 25)}...\` : docName;
                                            })()}`;

// Apply fixes
let fixedContent = content
  .replace(unsafePattern, safeOnClickReplacement)
  .replace(unsafeTitlePattern, safeTitleReplacement)
  .replace(unsafeDisplayPattern, safeDisplayReplacement);

// Write the fixed content
writeFileSync(filePath, fixedContent, 'utf-8');

console.log('✅ Fixed React rendering errors for quote.document objects');