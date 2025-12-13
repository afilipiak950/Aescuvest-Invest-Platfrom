import Anthropic from '@anthropic-ai/sdk';

export interface SectionElement {
  type: 'paragraph' | 'table' | 'bullets' | 'callout' | 'metrics' | 'heading' | 'keyvalue';
  content: string | string[] | { headers: string[]; rows: string[][] };
  style?: 'highlight' | 'warning' | 'info' | 'key-takeaway' | 'risk';
}

export interface StructuredMemoSection {
  title: string;
  elements: SectionElement[];
}

export interface StructuredMemo {
  companyName: string;
  generatedDate: string;
  sections: StructuredMemoSection[];
}

const SECTION_ORDER = [
  { key: 'coverPage', title: 'Cover Page' },
  { key: 'executiveSummary', title: 'Executive Summary' },
  { key: 'marketAnalysis', title: 'Market Analysis' },
  { key: 'teamAssessment', title: 'Team Assessment' },
  { key: 'financialAnalysis', title: 'Financial Analysis' },
  { key: 'clinicalEvidence', title: 'Clinical Evidence' },
  { key: 'technologyAssessment', title: 'Technology Assessment' },
  { key: 'intellectualProperty', title: 'Intellectual Property' },
  { key: 'regulatoryPathway', title: 'Regulatory Pathway' },
  { key: 'competitiveAnalysis', title: 'Competitive Analysis' },
  { key: 'riskAnalysis', title: 'Risk Analysis' },
  { key: 'investmentTerms', title: 'Investment Terms' }
];

export class ClaudePdfSynthesisService {
  private anthropic: Anthropic | null = null;

  private getAnthropicClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured. Premium PDF export requires Anthropic API access.');
      }
      this.anthropic = new Anthropic({ apiKey });
    }
    return this.anthropic;
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async synthesizeMemoToStructuredFormat(memo: any, companyName: string): Promise<StructuredMemo> {
    console.log('🎨 Claude PDF Synthesis: Starting structured transformation...');
    
    const normalizedMemo = this.normalizeMemo(memo);
    const structuredSections: StructuredMemoSection[] = [];

    for (const section of SECTION_ORDER) {
      const content = normalizedMemo[section.key];
      if (content && typeof content === 'string' && content.trim().length > 0) {
        console.log(`📝 Processing section: ${section.title}`);
        try {
          const structuredSection = await this.synthesizeSection(section.title, content);
          structuredSections.push(structuredSection);
        } catch (error) {
          console.error(`❌ Error processing section ${section.title}:`, error);
          structuredSections.push(this.fallbackParsing(section.title, content));
        }
      }
    }

    console.log(`✅ Claude PDF Synthesis complete: ${structuredSections.length} sections processed`);
    
    return {
      companyName,
      generatedDate: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      sections: structuredSections
    };
  }

  private normalizeMemo(memo: any): Record<string, string> {
    const normalized: Record<string, string> = {};
    
    if (memo?.sections && typeof memo.sections === 'object') {
      Object.keys(memo.sections).forEach(key => {
        normalized[key] = memo.sections[key];
      });
    } else if (memo && typeof memo === 'object') {
      Object.keys(memo).forEach(key => {
        normalized[key] = memo[key];
      });
    }
    
    return normalized;
  }

  private async synthesizeSection(title: string, content: string): Promise<StructuredMemoSection> {
    const prompt = `You are a document structuring expert. Transform this investment memo section into structured JSON format for premium PDF rendering.

SECTION TITLE: ${title}

CONTENT:
${content.substring(0, 15000)}

OUTPUT FORMAT (strict JSON):
{
  "title": "${title}",
  "elements": [
    {
      "type": "paragraph" | "table" | "bullets" | "callout" | "metrics" | "heading" | "keyvalue",
      "content": "string for paragraph/heading" | ["array", "for", "bullets"] | {"headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]},
      "style": "highlight" | "warning" | "info" | "key-takeaway" | "risk" (optional)
    }
  ]
}

RULES:
1. Use "paragraph" for flowing narrative text (prefer this for professional prose)
2. Use "table" ONLY when data is truly tabular (with clear column headers and rows)
3. Use "bullets" for lists of distinct items
4. Use "callout" with style "key-takeaway" for important insights, "risk" for risk factors, "warning" for concerns
5. Use "metrics" for key financial figures or statistics
6. Use "heading" for subsection titles within the section
7. Use "keyvalue" for label-value pairs (e.g., "Revenue: $10M")
8. Prioritize narrative prose over bullet points for professional investment memo style
9. Tables must have at least 2 columns and 2 data rows to be valid
10. Clean all markdown syntax (**, ##, etc.) from the content

Return ONLY valid JSON, no markdown code blocks.`;

    try {
      const client = this.getAnthropicClient();
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      let jsonStr = textContent.text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }

      const parsed = JSON.parse(jsonStr);
      return this.validateAndCleanSection(parsed, title);
    } catch (error) {
      console.error(`Claude synthesis failed for ${title}, using fallback:`, error);
      return this.fallbackParsing(title, content);
    }
  }

  private validateAndCleanSection(parsed: any, title: string): StructuredMemoSection {
    const elements: SectionElement[] = [];

    if (!parsed.elements || !Array.isArray(parsed.elements)) {
      return { title, elements: [] };
    }

    for (const elem of parsed.elements) {
      if (!elem.type || !elem.content) continue;

      const cleanedElement: SectionElement = {
        type: elem.type,
        content: this.cleanContent(elem.content, elem.type)
      };

      if (elem.style && ['highlight', 'warning', 'info', 'key-takeaway', 'risk'].includes(elem.style)) {
        cleanedElement.style = elem.style;
      }

      if (elem.type === 'table' && typeof elem.content === 'object') {
        const tableContent = elem.content as { headers?: string[]; rows?: string[][] };
        if (!tableContent.headers || !tableContent.rows || 
            tableContent.headers.length < 2 || tableContent.rows.length < 1) {
          continue;
        }
      }

      elements.push(cleanedElement);
    }

    return { title, elements };
  }

  private cleanContent(content: any, type: string): any {
    if (type === 'table' && typeof content === 'object') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map(item => this.stripMarkdown(String(item)));
    }

    return this.stripMarkdown(String(content));
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .trim();
  }

  private fallbackParsing(title: string, content: string): StructuredMemoSection {
    const elements: SectionElement[] = [];
    const lines = content.split('\n');
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ').trim();
        if (text) {
          elements.push({ type: 'paragraph', content: this.stripMarkdown(text) });
        }
        currentParagraph = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) {
        flushParagraph();
        continue;
      }

      if (trimmed.startsWith('##') || trimmed.startsWith('###')) {
        flushParagraph();
        elements.push({ type: 'heading', content: this.stripMarkdown(trimmed) });
        continue;
      }

      if (trimmed.includes('|') && trimmed.split('|').length >= 3) {
        flushParagraph();
        const tableData = this.parseMarkdownTable(lines, lines.indexOf(line));
        if (tableData) {
          elements.push({ type: 'table', content: tableData });
        }
        continue;
      }

      if (trimmed.match(/^[-*+]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        flushParagraph();
        elements.push({ type: 'bullets', content: [this.stripMarkdown(trimmed)] });
        continue;
      }

      if (trimmed.match(/^\*\*[^:]+\*\*:\s*.+/)) {
        flushParagraph();
        elements.push({ type: 'keyvalue', content: this.stripMarkdown(trimmed) });
        continue;
      }

      currentParagraph.push(trimmed);
    }

    flushParagraph();
    return { title, elements };
  }

  private parseMarkdownTable(lines: string[], startIndex: number): { headers: string[]; rows: string[][] } | null {
    const tableLines: string[] = [];
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('|')) {
        tableLines.push(line);
      } else if (tableLines.length > 0) {
        break;
      }
    }

    if (tableLines.length < 2) return null;

    const parseRow = (line: string): string[] => {
      return line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell && !cell.match(/^[-:]+$/));
    };

    const headers = parseRow(tableLines[0]);
    if (headers.length < 2) return null;

    const rows: string[][] = [];
    for (let i = 1; i < tableLines.length; i++) {
      const row = parseRow(tableLines[i]);
      if (row.length > 0 && !row.every(cell => cell.match(/^[-:]+$/))) {
        rows.push(row);
      }
    }

    if (rows.length === 0) return null;

    return { headers, rows };
  }
}

export const claudePdfSynthesisService = new ClaudePdfSynthesisService();
