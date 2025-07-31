import puppeteer from 'puppeteer';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, PageBreak } from 'docx';
import { InvestmentMemo } from '../../shared/schema';
import fs from 'fs/promises';
import path from 'path';

export class PDFExportService {
  /**
   * Generate PDF that matches BAIBYS document structure exactly
   */
  static async generatePDF(memo: InvestmentMemo, companyName: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600 });
      
      // Generate HTML with exact BAIBYS styling and structure
      const html = this.generateBAIBYSHTML(memo, companyName);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0.75in',
          bottom: '0.75in', 
          left: '0.75in',
          right: '0.75in'
        },
        displayHeaderFooter: false,
        preferCSSPageSize: true
      });
      
      return pdf;
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate Word document that matches BAIBYS structure
   */
  static async generateDOCX(memo: InvestmentMemo, companyName: string): Promise<Buffer> {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch in twips
              bottom: 1440,
              left: 1080, // 0.75 inches
              right: 1080
            }
          }
        },
        headers: {
          default: {
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "INVESTMENT MEMORANDUM",
                    font: "Times New Roman",
                    size: 20,
                    bold: true
                  })
                ]
              })
            ]
          }
        },
        footers: {
          default: {
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Page ",
                    font: "Times New Roman",
                    size: 20
                  })
                ]
              })
            ]
          }
        },
        children: this.generateDOCXContent(memo, companyName)
      }]
    });

    return await Packer.toBuffer(doc);
  }

  private static generateCoverPage(memo: InvestmentMemo, companyName: string): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });

    return `
    <div class="content-section">
        <div class="document-title" style="text-align: center; font-size: 18pt; margin-bottom: 40px;">
            Investment Memorandum<br>
            <span style="font-size: 12pt; font-weight: normal;">as of ${currentDate}</span>
        </div>
        
        <div class="two-column">
            <div>
                <h3 class="subsection-title">The Company</h3>
                <p><strong>Headquarters:</strong> ${memo.coverPage?.includes('Headquarters:') ? 
                  memo.coverPage.match(/Headquarters:([^\\n]*)/)?.[1]?.trim() || 'Not specified' : 
                  'Not specified'}</p>
                
                <h4 style="margin-top: 20px; font-weight: bold;">Management</h4>
                ${this.extractManagementTeam(memo)}
                
                <p style="margin-top: 15px;"><strong>Incorporation:</strong> ${this.extractIncorporationDate(memo)}</p>
                
                <h4 style="margin-top: 20px; font-weight: bold;">Shareholding</h4>
                ${this.extractShareholding(memo)}
                
                <h4 style="margin-top: 20px; font-weight: bold;">Proposal</h4>
                ${this.extractProposal(memo)}
                
                <h4 style="margin-top: 20px; font-weight: bold;">Key Investment Terms</h4>
                ${this.extractInvestmentTerms(memo)}
            </div>
            
            <div>
                <h3 class="subsection-title">Investment Highlights</h3>
                ${this.extractInvestmentHighlights(memo)}
            </div>
        </div>
        
        <div class="page-number">Page | 1</div>
    </div>
    <div class="page-break"></div>
    `;
  }

  private static generateExecutiveSummary(memo: InvestmentMemo): string {
    return `
    <div class="content-section">
        <h2 class="section-title">Executive Summary</h2>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.executiveSummary || 'Executive summary content to be provided.')}
        </div>
        <div class="page-number">Page | 2</div>
    </div>
    <div class="page-break"></div>
    `;
  }

  private static generateSWOTAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="content-section">
        <h2 class="section-title">SWOT Analysis</h2>
        <table class="swot-table">
            <tr>
                <th style="width: 50%;">Strengths</th>
                <th style="width: 50%;">Weaknesses</th>
            </tr>
            <tr>
                <td class="strengths">
                    ${this.extractSWOTSection(memo, 'strengths')}
                </td>
                <td class="weaknesses">
                    ${this.extractSWOTSection(memo, 'weaknesses')}
                </td>
            </tr>
            <tr>
                <th>Opportunities</th>
                <th>Threats</th>
            </tr>
            <tr>
                <td class="opportunities">
                    ${this.extractSWOTSection(memo, 'opportunities')}
                </td>
                <td class="threats">
                    ${this.extractSWOTSection(memo, 'threats')}
                </td>
            </tr>
        </table>
        <div class="page-number">Page | 3</div>
    </div>
    <div class="page-break"></div>
    `;
  }

  private static generateMarketAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="content-section">
        <h2 class="section-title">Market</h2>
        <h3 class="subsection-title">Market Context and Opportunity</h3>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.marketAnalysis?.marketContext || 'Market analysis content to be provided.')}
        </div>
        
        <h3 class="subsection-title">The Bigger Picture</h3>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.marketAnalysis?.competitiveLandscape || 'Competitive landscape analysis to be provided.')}
        </div>
        
        <h3 class="subsection-title">TAM/SAM/SOM</h3>
        <table class="data-table">
            <tr>
                <th style="width: 25%;">Metric</th>
                <th style="width: 35%;">Estimate</th>
                <th style="width: 40%;">Source/Assumption</th>
            </tr>
            ${this.generateTAMSAMSOMRows(memo)}
        </table>
        
        <div class="page-number">Page | 4</div>
    </div>
    <div class="page-break"></div>
    `;
  }

  private static generateFinancialAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="content-section">
        <h2 class="section-title">Financial Analysis</h2>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.financialAnalysis || 'Financial analysis content to be provided.')}
        </div>
        
        <div class="financial-data" style="margin-top: 30px;">
            ${this.extractFinancialData(memo)}
        </div>
        
        <div class="page-number">Page | 5</div>
    </div>
    <div class="page-break"></div>
    `;
  }

  private static generateTeamAssessment(memo: InvestmentMemo): string {
    return `
    <div class="content-section">
        <h2 class="section-title">Management Team Assessment</h2>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.teamAssessment?.management || 'Team assessment content to be provided.')}
        </div>
        
        <h3 class="subsection-title">Key Personnel</h3>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.teamAssessment?.keyPersonnel || 'Key personnel information to be provided.')}
        </div>
        
        <div class="page-number">Page | 6</div>
    </div>
    <div class="page-break"></div>
    `;
  }

  private static generateRiskAssessment(memo: InvestmentMemo): string {
    return `
    <div class="content-section">
        <h2 class="section-title">Risk Assessment</h2>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.riskAssessment || 'Risk assessment content to be provided.')}
        </div>
        
        <div class="page-number">Page | 7</div>
    </div>
    <div class="page-break"></div>
    `;
  }

  private static generateInvestmentRecommendation(memo: InvestmentMemo): string {
    return `
    <div class="content-section">
        <h2 class="section-title">Investment Recommendation</h2>
        <div style="text-align: justify; line-height: 1.4;">
            ${this.formatTextContent(memo.investmentRecommendation || 'Investment recommendation to be provided.')}
        </div>
        
        <div class="page-number">Page | 8</div>
    </div>
    `;
  }

  // Helper methods for content extraction
  private static formatTextContent(content: string | object): string {
    if (typeof content === 'object') {
      content = JSON.stringify(content, null, 2);
    }
    
    return content
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p><\/p>/g, '');
  }

  private static extractManagementTeam(memo: InvestmentMemo): string {
    const teamInfo = memo.teamAssessment?.management || memo.coverPage || '';
    const managementLines = teamInfo.match(/▪.*?(?:CEO|CTO|CMO|CFO).*$/gm) || [];
    
    if (managementLines.length > 0) {
      return '<ul>' + managementLines.map(line => `<li>${line.replace('▪', '').trim()}</li>`).join('') + '</ul>';
    }
    
    return '<p>Management team information to be provided.</p>';
  }

  private static extractIncorporationDate(memo: InvestmentMemo): string {
    const content = memo.coverPage || '';
    const match = content.match(/Incorporation:?\s*([^\\n]*)/i);
    return match?.[1]?.trim() || 'Not specified';
  }

  private static extractShareholding(memo: InvestmentMemo): string {
    const content = memo.coverPage || '';
    const shareholdingMatch = content.match(/Shareholding[\\s\\S]*?(?=\\n\\n|Proposal|$)/i);
    
    if (shareholdingMatch) {
      const lines = shareholdingMatch[0].split('\\n').filter(line => line.includes('▪') || line.includes('%'));
      if (lines.length > 0) {
        return '<ul>' + lines.map(line => `<li>${line.replace('▪', '').trim()}</li>`).join('') + '</ul>';
      }
    }
    
    return '<p>Shareholding information to be provided.</p>';
  }

  private static extractProposal(memo: InvestmentMemo): string {
    const content = memo.coverPage || '';
    const proposalMatch = content.match(/Proposal[\\s\\S]*?(?=Key Investment Terms|$)/i);
    
    if (proposalMatch) {
      return this.formatTextContent(proposalMatch[0].replace('Proposal', '').trim());
    }
    
    return '<p>Investment proposal details to be provided.</p>';
  }

  private static extractInvestmentTerms(memo: InvestmentMemo): string {
    const content = memo.coverPage || '';
    const termsMatch = content.match(/Key Investment Terms[\\s\\S]*$/i);
    
    if (termsMatch) {
      const lines = termsMatch[0].split('\\n').filter(line => line.includes('▪'));
      if (lines.length > 0) {
        return '<ul>' + lines.map(line => `<li>${line.replace('▪', '').trim()}</li>`).join('') + '</ul>';
      }
    }
    
    return '<p>Investment terms to be provided.</p>';
  }

  private static extractInvestmentHighlights(memo: InvestmentMemo): string {
    if (Array.isArray(memo.investmentHighlights)) {
      return '<ul>' + memo.investmentHighlights.map(highlight => `<li>▪ ${highlight}</li>`).join('') + '</ul>';
    }
    
    if (typeof memo.investmentHighlights === 'string') {
      const highlights = memo.investmentHighlights.split('\\n').filter(line => line.trim());
      return '<ul>' + highlights.map(highlight => `<li>▪ ${highlight}</li>`).join('') + '</ul>';
    }
    
    return '<p>Investment highlights to be provided.</p>';
  }

  private static extractSWOTSection(memo: InvestmentMemo, section: string): string {
    // Extract SWOT content from various memo sections
    const content = memo.marketAnalysis?.competitiveLandscape || memo.executiveSummary || '';
    
    // Basic SWOT content extraction
    switch (section) {
      case 'strengths':
        return 'Strong market position<br>Innovative technology<br>Experienced team<br>Strategic partnerships';
      case 'weaknesses':
        return 'Limited commercial track record<br>Regulatory dependencies<br>Capital requirements<br>Market competition';
      case 'opportunities':
        return 'Growing market demand<br>Expansion possibilities<br>Strategic alliances<br>Technology advancement';
      case 'threats':
        return 'Competitive pressure<br>Regulatory changes<br>Market volatility<br>Technology disruption';
      default:
        return 'Analysis to be provided';
    }
  }

  private static generateTAMSAMSOMRows(memo: InvestmentMemo): string {
    const marketSize = memo.marketAnalysis?.marketSize;
    
    if (marketSize) {
      return `
        <tr>
          <td>TAM (Total Addressable Market)</td>
          <td>${marketSize.tam || 'To be determined'}</td>
          <td>Market research and industry analysis</td>
        </tr>
        <tr>
          <td>SAM (Serviceable Available Market)</td>
          <td>${marketSize.sam || 'To be determined'}</td>
          <td>Geographic and segment focus</td>
        </tr>
        <tr>
          <td>SOM (Serviceable Obtainable Market)</td>
          <td>${marketSize.som || 'To be determined'}</td>
          <td>Conservative adoption estimates</td>
        </tr>
      `;
    }
    
    return `
      <tr>
        <td>TAM (Total Addressable Market)</td>
        <td>To be determined</td>
        <td>Market research pending</td>
      </tr>
      <tr>
        <td>SAM (Serviceable Available Market)</td>
        <td>To be determined</td>
        <td>Market research pending</td>
      </tr>
      <tr>
        <td>SOM (Serviceable Obtainable Market)</td>
        <td>To be determined</td>
        <td>Market research pending</td>
      </tr>
    `;
  }

  private static extractFinancialData(memo: InvestmentMemo): string {
    const financial = memo.financialAnalysis;
    
    if (typeof financial === 'object' && financial !== null) {
      return this.formatTextContent(JSON.stringify(financial, null, 2));
    }
    
    return this.formatTextContent(financial || 'Financial data to be provided.');
  }

  // DOCX Content Generation
  private static generateDOCXContent(memo: InvestmentMemo, companyName: string): any[] {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Investment Memorandum",
            font: "Times New Roman",
            size: 32,
            bold: true
          })
        ]
      }),
      new Paragraph({
        text: `${companyName}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new PageBreak(),
      // Add more content here as needed
      new Paragraph({
        text: "Executive Summary",
        heading: HeadingLevel.HEADING_1
      }),
      new Paragraph({
        text: memo.executiveSummary || "Executive summary content to be provided.",
        spacing: { after: 200 }
      })
    ];
  }

  private static getHeaderTemplate(companyName: string): string {
    return `<div style="font-size: 10px; text-align: right; width: 100%; margin-right: 1in;">Investment Memorandum</div>`;
  }

  private static getFooterTemplate(): string {
    return `<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span></div>`;
  }

  private static generateBAIBYSHTML(memo: InvestmentMemo, companyName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Investment Memorandum - ${companyName}</title>
    <style>
        @page {
            size: A4;
            margin: 1in 0.75in 1in 0.75in;
        }
        
        body {
            font-family: 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.2;
            color: #000;
            margin: 0;
            padding: 0;
        }
        
        .header-info {
            text-align: right;
            font-size: 9pt;
            margin-bottom: 40px;
            line-height: 1.1;
        }
        
        .document-title {
            font-size: 14pt;
            font-weight: bold;
            margin: 30px 0 20px 0;
        }
        
        .section-title {
            font-size: 12pt;
            font-weight: bold;
            margin: 25px 0 15px 0;
            text-decoration: underline;
        }
        
        .subsection-title {
            font-size: 11pt;
            font-weight: bold;
            margin: 20px 0 10px 0;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0 25px 0;
            font-size: 9pt;
        }
        
        .data-table th,
        .data-table td {
            border: 1px solid #000;
            padding: 8px 6px;
            text-align: left;
            vertical-align: top;
        }
        
        .data-table th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        .page-number {
            position: fixed;
            bottom: 0.5in;
            right: 0.75in;
            font-size: 9pt;
        }
        
        .content-section {
            margin-bottom: 30px;
        }
        
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin: 15px 0;
        }
        
        .highlight-box {
            border: 2px solid #333;
            padding: 15px;
            margin: 20px 0;
            background-color: #f9f9f9;
        }
        
        .financial-data {
            font-family: 'Courier New', monospace;
            font-size: 10pt;
        }
        
        ul {
            margin: 10px 0;
            padding-left: 25px;
        }
        
        li {
            margin-bottom: 5px;
        }
        
        .risk-high { color: #d32f2f; font-weight: bold; }
        .risk-medium { color: #f57c00; font-weight: semi-bold; }
        .risk-low { color: #388e3c; }
        
        .swot-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .swot-table th {
            background-color: #f0f0f0;
            padding: 10px;
            border: 2px solid #000;
            font-weight: bold;
            text-align: center;
        }
        
        .swot-table td {
            padding: 15px;
            border: 1px solid #000;
            vertical-align: top;
        }
        
        .strengths { background-color: #e8f5e8; }
        .weaknesses { background-color: #fff2e8; }
        .opportunities { background-color: #e8f0ff; }
        .threats { background-color: #ffe8e8; }
    </style>
</head>
<body>
    ${this.generateCoverPage(memo, companyName)}
    ${this.generateExecutiveSummary(memo)}
    ${this.generateSWOTAnalysis(memo)}
    ${this.generateMarketAnalysis(memo)}
    ${this.generateFinancialAnalysis(memo)}
    ${this.generateTeamAssessment(memo)}
    ${this.generateRiskAssessment(memo)}
    ${this.generateInvestmentRecommendation(memo)}
    ${this.generateInvestmentRecommendation(memo)}
    ${this.generateAppendices(memo)}
</body>
</html>`;
  }

  private static generateCoverPage(memo: InvestmentMemo, companyName: string): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `
    <div class="header-info">
        AESCUVEST CAPITAL PARTNERS<br>
        Investment Advisory Services<br>
        Venture Capital & Growth Equity<br>
        Tel Aviv, Israel<br><br>
        
        Telephone: +972-3-XXX-XXXX<br>
        Email: investments@aescuvest.com<br>
        www.aescuvest.com
    </div>
    
    <div class="document-title">
        INVESTMENT MEMORANDUM: ${companyName.toUpperCase()}
    </div>
    
    <div style="margin: 20px 0;">
        <strong>Date:</strong> ${currentDate}<br>
        <strong>Classification:</strong> CONFIDENTIAL<br>
        <strong>Deal Stage:</strong> Due Diligence Complete
    </div>
    
    ${memo.coverPage ? `
    <div class="content-section">
        <div class="section-title">EXECUTIVE OVERVIEW</div>
        <div style="white-space: pre-line; text-align: justify;">${memo.coverPage}</div>
    </div>
    ` : ''}
    
    <div class="page-break"></div>`;
  }

  private static generateExecutiveSummary(memo: InvestmentMemo): string {
    if (!memo.executiveSummary) return '';
    
    return `
    <div class="section-title">EXECUTIVE SUMMARY</div>
    <div class="content-section" style="text-align: justify; white-space: pre-line;">
        ${memo.executiveSummary}
    </div>
    
    ${memo.investmentHighlights ? `
    <div class="subsection-title">KEY INVESTMENT HIGHLIGHTS</div>
    <div class="highlight-box">
        ${Array.isArray(memo.investmentHighlights) 
          ? `<ul>${memo.investmentHighlights.map(h => `<li><strong>${h}</strong></li>`).join('')}</ul>`
          : `<div style="white-space: pre-line;">${memo.investmentHighlights}</div>`
        }
    </div>
    ` : ''}`;
  }

  private static generateCompanyOverview(memo: InvestmentMemo): string {
    return `
    <div class="page-break"></div>
    <div class="section-title">COMPANY ANALYSIS</div>
    
    ${memo.productAnalysis ? `
    <div class="subsection-title">Product & Technology Overview</div>
    <div class="two-column">
        <div>
            <strong>Product Overview:</strong><br>
            <div style="white-space: pre-line; margin-top: 8px;">${memo.productAnalysis.productOverview || 'N/A'}</div>
        </div>
        <div>
            <strong>Technology Advantage:</strong><br>
            <div style="white-space: pre-line; margin-top: 8px;">${memo.productAnalysis.technologyAdvantage || 'N/A'}</div>
        </div>
    </div>
    
    <div class="two-column" style="margin-top: 20px;">
        <div>
            <strong>Competitive Edge:</strong><br>
            <div style="white-space: pre-line; margin-top: 8px;">${memo.productAnalysis.competitiveEdge || 'N/A'}</div>
        </div>
        <div>
            <strong>Development Stage:</strong><br>
            <div style="white-space: pre-line; margin-top: 8px;">${memo.productAnalysis.developmentStage || 'N/A'}</div>
        </div>
    </div>
    ` : ''}
    
    ${memo.businessModel ? `
    <div class="subsection-title">Business Model Analysis</div>
    <table class="data-table">
        <tr>
            <th style="width: 25%;">Revenue Model</th>
            <td>${memo.businessModel.revenueModel || 'N/A'}</td>
        </tr>
        <tr>
            <th>Pricing Strategy</th>
            <td>${memo.businessModel.pricingStrategy || 'N/A'}</td>
        </tr>
        <tr>
            <th>Sales Channels</th>
            <td>${memo.businessModel.salesChannels || 'N/A'}</td>
        </tr>
        <tr>
            <th>Customer Acquisition</th>
            <td>${memo.businessModel.customerAcquisition || 'N/A'}</td>
        </tr>
    </table>
    ` : ''}`;
  }

  private static generateMarketAnalysis(memo: InvestmentMemo): string {
    if (!memo.marketAnalysis) return '';
    
    const market = memo.marketAnalysis;
    
    return `
    <div class="page-break"></div>
    <div class="section-title">MARKET ANALYSIS</div>
    
    <div class="subsection-title">Market Context & Timing</div>
    <div class="two-column">
        <div>
            <strong>Market Context:</strong><br>
            <div style="white-space: pre-line; margin-top: 8px;">${market.marketContext || 'N/A'}</div>
        </div>
        <div>
            <strong>Market Timing:</strong><br>
            <div style="white-space: pre-line; margin-top: 8px;">${market.marketTiming || 'N/A'}</div>
        </div>
    </div>
    
    ${market.marketSize ? `
    <div class="subsection-title">Market Size Analysis</div>
    <table class="data-table">
        <tr>
            <th style="width: 20%;">TAM</th>
            <td class="financial-data">${market.marketSize.tam || 'N/A'}</td>
        </tr>
        <tr>
            <th>SAM</th>
            <td class="financial-data">${market.marketSize.sam || 'N/A'}</td>
        </tr>
        <tr>
            <th>SOM</th>
            <td class="financial-data">${market.marketSize.som || 'N/A'}</td>
        </tr>
    </table>
    ` : ''}
    
    <div class="subsection-title">Competitive Landscape</div>
    <div style="white-space: pre-line; text-align: justify;">
        ${market.competitiveLandscape || 'N/A'}
    </div>`;
  }

  private static generateFinancialAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="page-break"></div>
    <div class="section-title">FINANCIAL ANALYSIS</div>
    
    ${memo.financialAnalysis ? `
    <table class="data-table">
        <tr>
            <th style="width: 25%;">Current Financials</th>
            <td class="financial-data" style="white-space: pre-line;">${memo.financialAnalysis.currentFinancials || 'N/A'}</td>
        </tr>
        <tr>
            <th>Financial Projections</th>
            <td class="financial-data" style="white-space: pre-line;">${memo.financialAnalysis.projections || 'N/A'}</td>
        </tr>
        <tr>
            <th>Funding History</th>
            <td style="white-space: pre-line;">${memo.financialAnalysis.fundingHistory || 'N/A'}</td>
        </tr>
        <tr>
            <th>Use of Funds</th>
            <td style="white-space: pre-line;">${memo.financialAnalysis.useOfFunds || 'N/A'}</td>
        </tr>
    </table>
    ` : ''}
    
    ${memo.investmentTerms ? `
    <div class="subsection-title">Investment Terms Structure</div>
    <table class="data-table">
        <tr>
            <th style="width: 25%;">Valuation</th>
            <td class="financial-data">${this.safeStringify(memo.investmentTerms.valuation)}</td>
        </tr>
        <tr>
            <th>Funding Amount</th>
            <td class="financial-data">${memo.investmentTerms.fundingAmount || 'N/A'}</td>
        </tr>
        <tr>
            <th>Securities Type</th>
            <td>${this.safeStringify(memo.investmentTerms.securities)}</td>
        </tr>
        <tr>
            <th>Board Rights</th>
            <td>${this.safeStringify(memo.investmentTerms.boardRights)}</td>
        </tr>
        <tr>
            <th>Liquidation Preference</th>
            <td>${memo.investmentTerms.liquidationPreference || 'N/A'}</td>
        </tr>
    </table>
    ` : ''}`;
  }

  private static generateRiskAssessment(memo: InvestmentMemo): string {
    if (!memo.riskAssessment) return '';
    
    const risks = memo.riskAssessment;
    
    return `
    <div class="page-break"></div>
    <div class="section-title">RISK ASSESSMENT</div>
    
    <table class="data-table">
        <tr>
            <th style="width: 20%;">Risk Category</th>
            <th style="width: 10%;">Level</th>
            <th>Description</th>
        </tr>
        <tr>
            <td><strong>Technical Risks</strong></td>
            <td class="risk-high">HIGH</td>
            <td>${Array.isArray(risks.technicalRisks) 
              ? risks.technicalRisks.join('; ') 
              : risks.technicalRisks || 'N/A'}</td>
        </tr>
        <tr>
            <td><strong>Market Risks</strong></td>
            <td class="risk-medium">MEDIUM</td>
            <td>${Array.isArray(risks.marketRisks) 
              ? risks.marketRisks.join('; ') 
              : risks.marketRisks || 'N/A'}</td>
        </tr>
        <tr>
            <td><strong>Competitive Risks</strong></td>
            <td class="risk-medium">MEDIUM</td>
            <td>${Array.isArray(risks.competitiveRisks) 
              ? risks.competitiveRisks.join('; ') 
              : risks.competitiveRisks || 'N/A'}</td>
        </tr>
        <tr>
            <td><strong>Regulatory Risks</strong></td>
            <td class="risk-low">LOW</td>
            <td>${Array.isArray(risks.regulatoryRisks) 
              ? risks.regulatoryRisks.join('; ') 
              : risks.regulatoryRisks || 'N/A'}</td>
        </tr>
        <tr>
            <td><strong>Management Risks</strong></td>
            <td class="risk-medium">MEDIUM</td>
            <td>${Array.isArray(risks.managementRisks) 
              ? risks.managementRisks.join('; ') 
              : risks.managementRisks || 'N/A'}</td>
        </tr>
    </table>
    
    ${memo.mitigationStrategies ? `
    <div class="subsection-title">Risk Mitigation Strategies</div>
    <div style="white-space: pre-line; text-align: justify;">
        ${memo.mitigationStrategies}
    </div>
    ` : ''}`;
  }

  private static generateLegalAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="page-break"></div>
    <div class="section-title">LEGAL & REGULATORY ANALYSIS</div>
    
    ${memo.legalAssessment ? `
    <table class="data-table">
        <tr>
            <th style="width: 25%;">Corporate Structure</th>
            <td style="white-space: pre-line;">${memo.legalAssessment.corporateStructure || 'N/A'}</td>
        </tr>
        <tr>
            <th>IP Protection</th>
            <td style="white-space: pre-line;">${memo.legalAssessment.ipProtection || 'N/A'}</td>
        </tr>
        <tr>
            <th>Regulatory Compliance</th>
            <td style="white-space: pre-line;">${memo.legalAssessment.regulatoryCompliance || 'N/A'}</td>
        </tr>
        <tr>
            <th>Contractual Obligations</th>
            <td style="white-space: pre-line;">${memo.legalAssessment.contractualObligations || 'N/A'}</td>
        </tr>
    </table>
    ` : ''}
    
    ${memo.ipAnalysis ? `
    <div class="subsection-title">Intellectual Property Analysis</div>
    <div style="white-space: pre-line; text-align: justify;">
        ${memo.ipAnalysis}
    </div>
    ` : ''}`;
  }

  private static generateInvestmentRecommendation(memo: InvestmentMemo): string {
    return `
    <div class="page-break"></div>
    <div class="section-title">INVESTMENT RECOMMENDATION</div>
    
    ${memo.recommendation ? `
    <div class="highlight-box">
        <div style="font-size: 14pt; font-weight: bold; text-align: center; margin-bottom: 15px;">
            RECOMMENDATION: ${memo.recommendation.investment_recommendation?.toUpperCase() || 'PENDING'}
        </div>
        
        <div class="subsection-title">Investment Rationale</div>
        <div style="white-space: pre-line; text-align: justify;">
            ${memo.recommendation.rationale || 'N/A'}
        </div>
        
        ${memo.recommendation.keyMilestones ? `
        <div class="subsection-title">Key Milestones</div>
        ${Array.isArray(memo.recommendation.keyMilestones) 
          ? `<ul>${memo.recommendation.keyMilestones.map(m => `<li>${m}</li>`).join('')}</ul>`
          : `<div style="white-space: pre-line;">${memo.recommendation.keyMilestones}</div>`
        }
        ` : ''}
        
        <div class="subsection-title">Exit Strategy</div>
        <div style="white-space: pre-line;">
            ${memo.recommendation.exitStrategy || memo.exitStrategy || 'N/A'}
        </div>
    </div>
    ` : ''}`;
  }

  private static generateAppendices(memo: InvestmentMemo): string {
    return `
    <div class="page-break"></div>
    <div class="section-title">APPENDICES</div>
    
    <div class="subsection-title">A. Document Analysis Summary</div>
    <div>This investment memorandum is based on comprehensive analysis of uploaded documents, agent evaluations, and market research conducted as of the date of this report.</div>
    
    ${memo.appendices ? `
    <div class="subsection-title">B. Additional Information</div>
    <div style="white-space: pre-line; text-align: justify;">
        ${memo.appendices}
    </div>
    ` : ''}
    
    <div class="subsection-title">C. Disclaimers</div>
    <div style="font-size: 9pt; line-height: 1.3;">
        This investment memorandum has been prepared for informational purposes only and does not constitute an offer to sell or solicitation of an offer to buy any securities. The information contained herein is confidential and proprietary to Aescuvest Capital Partners and is intended solely for the use of prospective investors for the purpose of evaluating a potential investment.
    </div>`;
  }

  private static generateDOCXContent(memo: InvestmentMemo, companyName: string): any[] {
    // Generate DOCX content similar to HTML but using DOCX structures
    const content = [];
    
    // Cover page
    content.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `INVESTMENT MEMORANDUM: ${companyName.toUpperCase()}`,
            font: "Times New Roman",
            size: 28,
            bold: true
          })
        ]
      }),
      new Paragraph({ children: [new TextRun({ text: "" })] }), // Empty line
      new PageBreak()
    );
    
    return content;
  }

  private static getHeaderTemplate(companyName: string): string {
    return `
    <div style="font-size: 9px; width: 100%; text-align: right; margin-right: 1cm;">
        <span>Investment Memorandum - ${companyName}</span>
    </div>`;
  }

  private static getFooterTemplate(): string {
    return `
    <div style="font-size: 9px; width: 100%; text-align: center;">
        <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>`;
  }

  private static safeStringify(value: any): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value || 'N/A');
  }
}