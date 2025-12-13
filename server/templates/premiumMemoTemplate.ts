import { StructuredMemo, SectionElement, StructuredMemoSection } from '../services/claudePdfSynthesisService';

const COLORS = {
  primary: '#1a233a',
  secondary: '#3a5284',
  accent: '#cea46b',
  highlight: '#007bbe',
  success: '#28a745',
  warning: '#dc6545',
  text: '#212529',
  lightText: '#495057',
  border: '#ced4da',
  background: '#f8f9fa',
  white: '#ffffff',
  tableHeader: '#e9ecef',
  tableStripe: '#f8f9fa'
};

export function generatePremiumMemoHTML(memo: StructuredMemo): string {
  const sections = memo.sections.map((section, index) => 
    renderSection(section, index)
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investment Memorandum - ${escapeHtml(memo.companyName)}</title>
  <style>
    ${getGlobalStyles()}
  </style>
</head>
<body>
  ${renderCoverPage(memo)}
  ${renderTableOfContents(memo)}
  ${sections}
  ${renderFooterPage(memo)}
</body>
</html>`;
}

function getGlobalStyles(): string {
  return `
    @page {
      size: A4;
      margin: 20mm;
      @top-left {
        content: "AESCUVEST INVESTMENT INTELLIGENCE";
        font-size: 8pt;
        color: ${COLORS.primary};
        font-family: 'Helvetica Neue', Arial, sans-serif;
      }
      @top-right {
        content: "Investment Memorandum";
        font-size: 8pt;
        color: ${COLORS.lightText};
        font-family: 'Helvetica Neue', Arial, sans-serif;
      }
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: ${COLORS.lightText};
        font-family: 'Helvetica Neue', Arial, sans-serif;
      }
      @bottom-left {
        content: "CONFIDENTIAL & PROPRIETARY";
        font-size: 7pt;
        color: ${COLORS.lightText};
        font-family: 'Helvetica Neue', Arial, sans-serif;
      }
    }

    @page :first {
      margin: 0;
      @top-left { content: none; }
      @top-right { content: none; }
      @bottom-center { content: none; }
      @bottom-left { content: none; }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 10pt;
      line-height: 1.6;
      color: ${COLORS.text};
      background: ${COLORS.white};
    }

    .cover-page {
      page-break-after: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(145deg, ${COLORS.primary} 0%, #0d1421 100%);
      color: ${COLORS.white};
      text-align: center;
      padding: 60px;
    }

    .cover-logo {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 14pt;
      font-weight: 300;
      letter-spacing: 8px;
      color: ${COLORS.accent};
      margin-bottom: 60px;
      text-transform: uppercase;
    }

    .cover-title {
      font-size: 36pt;
      font-weight: 700;
      margin-bottom: 20px;
      line-height: 1.2;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }

    .cover-subtitle {
      font-size: 16pt;
      font-weight: 300;
      color: rgba(255,255,255,0.8);
      margin-bottom: 40px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }

    .cover-line {
      width: 100px;
      height: 3px;
      background: ${COLORS.accent};
      margin: 40px 0;
    }

    .cover-date {
      font-size: 11pt;
      color: rgba(255,255,255,0.7);
      margin-top: 40px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }

    .cover-confidential {
      position: absolute;
      bottom: 40px;
      font-size: 9pt;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }

    .toc-page {
      page-break-after: always;
      padding: 40px 0;
    }

    .toc-title {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 24pt;
      font-weight: 700;
      color: ${COLORS.primary};
      margin-bottom: 40px;
      padding-bottom: 15px;
      border-bottom: 3px solid ${COLORS.accent};
    }

    .toc-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 12px 0;
      border-bottom: 1px dotted ${COLORS.border};
    }

    .toc-item:nth-child(odd) {
      background: ${COLORS.background};
      margin: 0 -20px;
      padding: 12px 20px;
    }

    .toc-number {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 700;
      color: ${COLORS.primary};
      margin-right: 15px;
      min-width: 30px;
    }

    .toc-text {
      flex: 1;
      font-size: 11pt;
    }

    .toc-page-num {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: ${COLORS.lightText};
      font-size: 10pt;
    }

    .section {
      page-break-before: always;
      padding-top: 20px;
    }

    .section:first-of-type {
      page-break-before: auto;
    }

    .section-header {
      background: ${COLORS.primary};
      color: ${COLORS.white};
      padding: 12px 20px;
      margin: 0 -20px 25px -20px;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .section-header::after {
      content: '';
      width: 8px;
      height: 8px;
      background: ${COLORS.accent};
      border-radius: 50%;
    }

    .element {
      margin-bottom: 16px;
    }

    .paragraph {
      text-align: justify;
      text-indent: 0;
      margin-bottom: 14px;
    }

    .heading {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12pt;
      font-weight: 700;
      color: ${COLORS.secondary};
      margin: 25px 0 12px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid ${COLORS.border};
    }

    .bullets {
      margin: 15px 0 15px 25px;
    }

    .bullet-item {
      position: relative;
      padding-left: 20px;
      margin-bottom: 8px;
      line-height: 1.5;
    }

    .bullet-item::before {
      content: '•';
      position: absolute;
      left: 0;
      color: ${COLORS.accent};
      font-weight: bold;
      font-size: 14pt;
      line-height: 1.2;
    }

    .table-container {
      margin: 20px 0;
      overflow: hidden;
      border-radius: 4px;
      border: 1px solid ${COLORS.border};
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    th {
      background: ${COLORS.primary};
      color: ${COLORS.white};
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 700;
      text-align: left;
      padding: 12px 15px;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
    }

    td {
      padding: 10px 15px;
      border-bottom: 1px solid ${COLORS.border};
      vertical-align: top;
    }

    tr:nth-child(even) {
      background: ${COLORS.tableStripe};
    }

    tr:last-child td {
      border-bottom: none;
    }

    .numeric {
      text-align: right;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 600;
      color: ${COLORS.highlight};
    }

    .callout {
      margin: 20px 0;
      padding: 18px 20px;
      border-radius: 4px;
      border-left: 4px solid;
    }

    .callout-key-takeaway {
      background: linear-gradient(135deg, rgba(40,167,69,0.08) 0%, rgba(40,167,69,0.03) 100%);
      border-left-color: ${COLORS.success};
    }

    .callout-key-takeaway::before {
      content: 'KEY TAKEAWAY';
      display: block;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 8pt;
      font-weight: 700;
      color: ${COLORS.success};
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .callout-risk, .callout-warning {
      background: linear-gradient(135deg, rgba(220,101,69,0.08) 0%, rgba(220,101,69,0.03) 100%);
      border-left-color: ${COLORS.warning};
    }

    .callout-risk::before, .callout-warning::before {
      content: 'RISK FACTOR';
      display: block;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 8pt;
      font-weight: 700;
      color: ${COLORS.warning};
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .callout-info, .callout-highlight {
      background: linear-gradient(135deg, rgba(0,123,190,0.08) 0%, rgba(0,123,190,0.03) 100%);
      border-left-color: ${COLORS.highlight};
    }

    .callout-info::before, .callout-highlight::before {
      content: 'INSIGHT';
      display: block;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 8pt;
      font-weight: 700;
      color: ${COLORS.highlight};
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin: 20px 0;
    }

    .metric-box {
      flex: 1;
      min-width: 120px;
      background: ${COLORS.background};
      padding: 15px;
      border-radius: 4px;
      text-align: center;
      border: 1px solid ${COLORS.border};
    }

    .metric-value {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 18pt;
      font-weight: 700;
      color: ${COLORS.primary};
      margin-bottom: 5px;
    }

    .metric-label {
      font-size: 8pt;
      color: ${COLORS.lightText};
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .keyvalue {
      display: flex;
      margin-bottom: 10px;
      padding: 8px 0;
      border-bottom: 1px dotted ${COLORS.border};
    }

    .keyvalue-label {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 700;
      color: ${COLORS.secondary};
      min-width: 150px;
      margin-right: 15px;
    }

    .keyvalue-value {
      flex: 1;
    }

    .footer-page {
      page-break-before: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: ${COLORS.background};
      padding: 60px;
    }

    .footer-logo {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 14pt;
      font-weight: 300;
      letter-spacing: 8px;
      color: ${COLORS.primary};
      margin-bottom: 30px;
      text-transform: uppercase;
    }

    .footer-disclaimer {
      max-width: 600px;
      font-size: 9pt;
      color: ${COLORS.lightText};
      line-height: 1.8;
    }
  `;
}

function renderCoverPage(memo: StructuredMemo): string {
  return `
    <div class="cover-page">
      <div class="cover-logo">Aescuvest</div>
      <div class="cover-title">${escapeHtml(memo.companyName)}</div>
      <div class="cover-subtitle">Investment Memorandum</div>
      <div class="cover-line"></div>
      <div class="cover-date">${escapeHtml(memo.generatedDate)}</div>
      <div class="cover-confidential">Confidential & Proprietary</div>
    </div>
  `;
}

function renderTableOfContents(memo: StructuredMemo): string {
  const items = memo.sections
    .filter(s => s.title !== 'Cover Page')
    .map((section, index) => `
      <div class="toc-item">
        <span class="toc-number">${index + 1}.</span>
        <span class="toc-text">${escapeHtml(section.title)}</span>
        <span class="toc-page-num">${index + 3}</span>
      </div>
    `).join('');

  return `
    <div class="toc-page">
      <div class="toc-title">Table of Contents</div>
      ${items}
    </div>
  `;
}

function renderSection(section: StructuredMemoSection, index: number): string {
  if (section.title === 'Cover Page') return '';

  const elements = section.elements.map(elem => renderElement(elem)).join('');

  return `
    <div class="section">
      <div class="section-header">${escapeHtml(section.title)}</div>
      ${elements}
    </div>
  `;
}

function renderElement(element: SectionElement): string {
  switch (element.type) {
    case 'paragraph':
      return `<p class="element paragraph">${escapeHtml(String(element.content))}</p>`;

    case 'heading':
      return `<h3 class="element heading">${escapeHtml(String(element.content))}</h3>`;

    case 'bullets':
      if (Array.isArray(element.content)) {
        const items = element.content.map(item => 
          `<div class="bullet-item">${escapeHtml(String(item))}</div>`
        ).join('');
        return `<div class="element bullets">${items}</div>`;
      }
      return `<div class="element bullets"><div class="bullet-item">${escapeHtml(String(element.content))}</div></div>`;

    case 'table':
      return renderTable(element.content as { headers: string[]; rows: string[][] });

    case 'callout':
      const style = element.style || 'info';
      return `<div class="element callout callout-${style}">${escapeHtml(String(element.content))}</div>`;

    case 'metrics':
      return renderMetrics(element.content);

    case 'keyvalue':
      return renderKeyValue(String(element.content));

    default:
      return `<p class="element paragraph">${escapeHtml(String(element.content))}</p>`;
  }
}

function renderTable(data: { headers: string[]; rows: string[][] }): string {
  if (!data.headers || !data.rows) return '';

  const headerCells = data.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const bodyRows = data.rows.map(row => {
    const cells = row.map(cell => {
      const isNumeric = /^\$?[\d,]+\.?\d*$|^[\d,]+%$/.test(cell);
      return `<td${isNumeric ? ' class="numeric"' : ''}>${escapeHtml(cell)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <div class="element table-container">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function renderMetrics(content: any): string {
  if (typeof content === 'string') {
    const metrics = content.split(/[,;]/).map(m => m.trim()).filter(Boolean);
    const boxes = metrics.map(metric => {
      const match = metric.match(/(.+?):\s*(.+)/);
      if (match) {
        return `<div class="metric-box"><div class="metric-value">${escapeHtml(match[2])}</div><div class="metric-label">${escapeHtml(match[1])}</div></div>`;
      }
      return `<div class="metric-box"><div class="metric-value">${escapeHtml(metric)}</div></div>`;
    }).join('');
    return `<div class="element metrics">${boxes}</div>`;
  }
  return '';
}

function renderKeyValue(content: string): string {
  const match = content.match(/([^:]+):\s*(.+)/);
  if (match) {
    return `<div class="element keyvalue"><span class="keyvalue-label">${escapeHtml(match[1].trim())}</span><span class="keyvalue-value">${escapeHtml(match[2].trim())}</span></div>`;
  }
  return `<p class="element paragraph">${escapeHtml(content)}</p>`;
}

function renderFooterPage(memo: StructuredMemo): string {
  return `
    <div class="footer-page">
      <div class="footer-logo">Aescuvest</div>
      <div class="footer-disclaimer">
        This investment memorandum is provided for informational purposes only and does not constitute 
        an offer to sell or a solicitation of an offer to buy any securities. The information contained 
        herein has been prepared from sources believed to be reliable but is not guaranteed as to accuracy 
        or completeness. Past performance is not indicative of future results.
        <br><br>
        © ${new Date().getFullYear()} Aescuvest. All rights reserved.
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
