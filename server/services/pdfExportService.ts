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
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Generate HTML with exact BAIBYS styling
      const html = this.generateBAIBYSHTML(memo, companyName);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1in',
          bottom: '1in', 
          left: '0.75in',
          right: '0.75in'
        },
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(companyName),
        footerTemplate: this.getFooterTemplate()
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
    </style>
</head>
<body>
    ${this.generateCoverPage(memo, companyName)}
    ${this.generateExecutiveSummary(memo)}
    ${this.generateCompanyOverview(memo)}
    ${this.generateMarketAnalysis(memo)}
    ${this.generateFinancialAnalysis(memo)}
    ${this.generateRiskAssessment(memo)}
    ${this.generateLegalAnalysis(memo)}
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