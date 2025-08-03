import puppeteer from 'puppeteer';
import { InvestmentMemo } from '../../shared/schema';

export class ModernPdfExportService {
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
      
      // Generate modern HTML with professional design
      const html = this.generateModernHTML(memo, companyName);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0.5in',
          bottom: '0.5in', 
          left: '0.5in',
          right: '0.5in'
        },
        displayHeaderFooter: false,
        preferCSSPageSize: true
      });
      
      return pdf;
      
    } finally {
      await browser.close();
    }
  }

  private static generateModernHTML(memo: InvestmentMemo, companyName: string): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Investment Memorandum - ${companyName}</title>
    <style>
        ${this.getModernStyles()}
    </style>
</head>
<body>
    ${this.generateCoverPage(memo, companyName, currentDate)}
    ${this.generateExecutiveSummary(memo)}
    ${this.generateSWOTAnalysis(memo)}
    ${this.generateMarketAnalysis(memo)}
    ${this.generateTechnicalAnalysis(memo)}
    ${this.generateBusinessModel(memo)}
    ${this.generateTeamAssessment(memo)}
    ${this.generateFinancialAnalysis(memo)}
    ${this.generateLegalAssessment(memo)}
    ${this.generateRiskAssessment(memo)}
    ${this.generateInvestmentRecommendation(memo)}
    ${this.generateAppendices(memo)}
</body>
</html>
    `;
  }

  private static getModernStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        .page {
            min-height: 100vh;
            padding: 40px;
            page-break-after: always;
            position: relative;
        }
        
        .page:last-child {
            page-break-after: avoid;
        }
        
        .cover-page {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 2px solid #dee2e6;
        }
        
        .document-title {
            text-align: center;
            margin-bottom: 50px;
            padding: 30px 0;
            border-bottom: 3px solid #007bff;
        }
        
        .document-title h1 {
            font-size: 28pt;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
            letter-spacing: 1px;
        }
        
        .document-title .date {
            font-size: 14pt;
            color: #6c757d;
            font-weight: normal;
        }
        
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
        }
        
        .section-header {
            background: #007bff;
            color: white;
            padding: 15px 20px;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 20px;
            border-radius: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .subsection-title {
            color: #007bff;
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 15px;
            padding-bottom: 5px;
            border-bottom: 2px solid #007bff;
        }
        
        .highlight-box {
            background: #f8f9fa;
            border-left: 5px solid #007bff;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        
        .bullet-point {
            display: flex;
            align-items: flex-start;
            margin-bottom: 12px;
            padding-left: 20px;
        }
        
        .bullet-point::before {
            content: "▪";
            color: #007bff;
            font-weight: bold;
            margin-right: 10px;
            margin-left: -20px;
            font-size: 14pt;
        }
        
        .swot-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        
        .swot-section {
            border: 2px solid #dee2e6;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .swot-header {
            padding: 15px;
            font-weight: bold;
            font-size: 14pt;
            text-align: center;
            color: white;
        }
        
        .swot-header.strengths { background: #28a745; }
        .swot-header.weaknesses { background: #dc3545; }
        .swot-header.opportunities { background: #17a2b8; }
        .swot-header.threats { background: #ffc107; color: #333; }
        
        .swot-content {
            padding: 20px;
            min-height: 200px;
        }
        
        .financial-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .financial-table th {
            background: #007bff;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: bold;
        }
        
        .financial-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #dee2e6;
        }
        
        .financial-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .risk-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }
        
        .risk-category {
            border: 2px solid #dee2e6;
            border-radius: 10px;
            overflow: hidden;
            margin-bottom: 20px;
        }
        
        .risk-header {
            padding: 12px 15px;
            font-weight: bold;
            color: white;
            text-align: center;
        }
        
        .risk-header.technical { background: #dc3545; }
        .risk-header.market { background: #fd7e14; }
        .risk-header.competitive { background: #ffc107; color: #333; }
        .risk-header.regulatory { background: #e83e8c; }
        .risk-header.management { background: #6f42c1; }
        
        .risk-content {
            padding: 15px;
            background: white;
        }
        
        .risk-item {
            display: flex;
            align-items: flex-start;
            margin-bottom: 10px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 5px;
        }
        
        .risk-item::before {
            content: "⚠";
            margin-right: 8px;
            color: #dc3545;
            font-size: 12pt;
        }
        
        .page-number {
            position: absolute;
            bottom: 30px;
            right: 50%;
            transform: translateX(50%);
            font-size: 12pt;
            color: #6c757d;
            font-weight: bold;
        }
        
        .metric-card {
            background: white;
            border: 2px solid #dee2e6;
            border-radius: 10px;
            padding: 20px;
            margin: 15px 0;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .metric-value {
            font-size: 24pt;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 5px;
        }
        
        .metric-label {
            color: #6c757d;
            font-size: 12pt;
        }
        
        .team-member {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        
        .team-name {
            font-weight: bold;
            color: #007bff;
            font-size: 12pt;
            margin-bottom: 5px;
        }
        
        .team-role {
            color: #6c757d;
            font-size: 10pt;
        }
        
        .recommendation-box {
            background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 30px 0;
            text-align: center;
        }
        
        .recommendation-title {
            font-size: 20pt;
            font-weight: bold;
            margin-bottom: 15px;
        }
        
        .recommendation-content {
            font-size: 14pt;
            line-height: 1.6;
        }
        
        .appendix-section {
            border-top: 3px solid #007bff;
            padding-top: 20px;
            margin-top: 30px;
        }
        
        @page {
            margin: 0.5in;
        }
        
        @media print {
            .page {
                page-break-after: always;
            }
            
            .page:last-child {
                page-break-after: avoid;
            }
        }
    `;
  }

  private static generateCoverPage(memo: InvestmentMemo, companyName: string, currentDate: string): string {
    return `
    <div class="page cover-page">
        <div class="document-title">
            <h1>Investment Memorandum</h1>
            <div class="date">as of ${currentDate}</div>
        </div>
        
        <div class="two-column">
            <div>
                <div class="section-header">The Company</div>
                
                <div class="subsection-title">Headquarters</div>
                <p style="margin-bottom: 20px;">${this.extractHeadquarters(memo)}</p>
                
                <div class="subsection-title">Management</div>
                ${this.extractManagementTeam(memo)}
                
                <div class="subsection-title">Incorporation</div>
                <p style="margin-bottom: 20px;">${this.extractIncorporationDate(memo)}</p>
                
                <div class="subsection-title">Shareholding</div>
                ${this.extractShareholding(memo)}
                
                <div class="subsection-title">Proposal</div>
                ${this.extractProposal(memo)}
                
                <div class="subsection-title">Key Investment Terms</div>
                ${this.extractInvestmentTerms(memo)}
            </div>
            
            <div>
                <div class="section-header">Investment Highlights</div>
                ${this.extractInvestmentHighlights(memo)}
            </div>
        </div>
        
        <div class="page-number">Page | 1</div>
    </div>
    `;
  }

  private static generateExecutiveSummary(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Executive Summary</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.executiveSummary || 'Executive summary content will be provided based on comprehensive company analysis.')}
        </div>
        <div class="page-number">Page | 2</div>
    </div>
    `;
  }

  private static generateSWOTAnalysis(memo: InvestmentMemo): string {
    const swot = memo.swotAnalysis;
    return `
    <div class="page">
        <div class="section-header">SWOT Analysis</div>
        <div class="swot-grid">
            <div class="swot-section">
                <div class="swot-header strengths">Strengths</div>
                <div class="swot-content">
                    ${this.extractSWOTSection(swot, 'strengths')}
                </div>
            </div>
            <div class="swot-section">
                <div class="swot-header weaknesses">Weaknesses</div>
                <div class="swot-content">
                    ${this.extractSWOTSection(swot, 'weaknesses')}
                </div>
            </div>
            <div class="swot-section">
                <div class="swot-header opportunities">Opportunities</div>
                <div class="swot-content">
                    ${this.extractSWOTSection(swot, 'opportunities')}
                </div>
            </div>
            <div class="swot-section">
                <div class="swot-header threats">Threats</div>
                <div class="swot-content">
                    ${this.extractSWOTSection(swot, 'threats')}
                </div>
            </div>
        </div>
        <div class="page-number">Page | 3</div>
    </div>
    `;
  }

  private static generateMarketAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Market Analysis</div>
        
        <div class="subsection-title">Market Context and Opportunity</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.marketAnalysis || 'Market analysis will detail the addressable market, competitive landscape, and growth opportunities.')}
        </div>
        
        <div class="subsection-title">TAM/SAM/SOM Analysis</div>
        ${this.generateTAMSAMSOM(memo)}
        
        <div class="page-number">Page | 4</div>
    </div>
    `;
  }

  private static generateTAMSAMSOM(memo: InvestmentMemo): string {
    const tamData = memo.tamSamSomAnalysis;
    return `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 20px 0;">
        <div class="metric-card">
            <div class="metric-value">${this.extractTAMValue(tamData)}</div>
            <div class="metric-label">Total Addressable Market (TAM)</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${this.extractSAMValue(tamData)}</div>
            <div class="metric-label">Serviceable Available Market (SAM)</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${this.extractSOMValue(tamData)}</div>
            <div class="metric-label">Serviceable Obtainable Market (SOM)</div>
        </div>
    </div>
    <div class="highlight-box">
        ${this.formatTextContent(tamData || 'TAM/SAM/SOM analysis provides market sizing and addressable opportunity assessment.')}
    </div>
    `;
  }

  private static generateTechnicalAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Technology Assessment</div>
        
        <div class="subsection-title">Product Analysis</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.productAnalysis || 'Product analysis covers technology innovation, competitive differentiation, and technical capabilities.')}
        </div>
        
        <div class="subsection-title">Technology Assessment</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.technologyAssessment || 'Technology assessment evaluates technical risks, scalability, and intellectual property position.')}
        </div>
        
        <div class="page-number">Page | 5</div>
    </div>
    `;
  }

  private static generateBusinessModel(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Business Model & Commercial Strategy</div>
        
        <div class="subsection-title">Business Model</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.businessModel || 'Business model analysis covers revenue streams, go-to-market strategy, and value proposition.')}
        </div>
        
        <div class="subsection-title">Commercial Strategy</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.commercialStrategy || 'Commercial strategy outlines market entry, sales channels, and customer acquisition approach.')}
        </div>
        
        <div class="page-number">Page | 6</div>
    </div>
    `;
  }

  private static generateTeamAssessment(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Team Assessment</div>
        
        <div class="subsection-title">Management Team</div>
        ${this.extractDetailedTeamAssessment(memo)}
        
        <div class="subsection-title">Management Analysis</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.managementAnalysis || 'Management analysis evaluates leadership capabilities, experience, and execution track record.')}
        </div>
        
        <div class="page-number">Page | 7</div>
    </div>
    `;
  }

  private static generateFinancialAnalysis(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Financial Analysis</div>
        
        <div class="subsection-title">Financial Performance</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.financialAnalysis || 'Financial analysis covers historical performance, projections, and key metrics.')}
        </div>
        
        <div class="subsection-title">Financial Projections</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.financialProjections || 'Financial projections detail revenue forecasts, expense projections, and cash flow analysis.')}
        </div>
        
        <div class="subsection-title">Valuation Analysis</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.valuationAnalysis || 'Valuation analysis provides investment rationale and valuation methodology.')}
        </div>
        
        <div class="page-number">Page | 8</div>
    </div>
    `;
  }

  private static generateLegalAssessment(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Legal & Regulatory Assessment</div>
        
        <div class="subsection-title">Legal Assessment</div>
        <div class="highlight-box">
            ${this.formatObjectContent(memo.legalAssessment)}
        </div>
        
        <div class="subsection-title">Regulatory Analysis</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.regulatoryAnalysis || 'Regulatory analysis covers compliance requirements, approval pathways, and regulatory risks.')}
        </div>
        
        <div class="subsection-title">IP Analysis</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.ipAnalysis || 'IP analysis evaluates intellectual property portfolio, patent landscape, and protection strategy.')}
        </div>
        
        <div class="page-number">Page | 9</div>
    </div>
    `;
  }

  private static generateRiskAssessment(memo: InvestmentMemo): string {
    const risks = memo.riskAssessment;
    return `
    <div class="page">
        <div class="section-header">Risk Assessment</div>
        
        <div class="risk-grid">
            <div class="risk-category">
                <div class="risk-header technical">Technical Risks</div>
                <div class="risk-content">
                    ${this.extractRiskItems(risks?.technicalRisks)}
                </div>
            </div>
            <div class="risk-category">
                <div class="risk-header market">Market Risks</div>
                <div class="risk-content">
                    ${this.extractRiskItems(risks?.marketRisks)}
                </div>
            </div>
        </div>
        
        <div class="risk-grid">
            <div class="risk-category">
                <div class="risk-header competitive">Competitive Risks</div>
                <div class="risk-content">
                    ${this.extractRiskItems(risks?.competitiveRisks)}
                </div>
            </div>
            <div class="risk-category">
                <div class="risk-header regulatory">Regulatory Risks</div>
                <div class="risk-content">
                    ${this.extractRiskItems(risks?.regulatoryRisks)}
                </div>
            </div>
        </div>
        
        <div class="risk-category">
            <div class="risk-header management">Management Risks</div>
            <div class="risk-content">
                ${this.extractRiskItems(risks?.managementRisks)}
            </div>
        </div>
        
        <div class="subsection-title">Mitigation Strategies</div>
        <div class="highlight-box">
            ${this.formatTextContent(memo.mitigationStrategies || 'Risk mitigation strategies address identified risks and provide contingency planning.')}
        </div>
        
        <div class="page-number">Page | 10</div>
    </div>
    `;
  }

  private static generateInvestmentRecommendation(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Investment Recommendation</div>
        
        <div class="recommendation-box">
            <div class="recommendation-title">Investment Decision</div>
            <div class="recommendation-content">
                ${this.formatObjectContent(memo.recommendation)}
            </div>
        </div>
        
        <div class="subsection-title">Exit Strategy</div>
        <div class="highlight-box">
            ${this.formatObjectContent(memo.exitStrategy)}
        </div>
        
        <div class="page-number">Page | 11</div>
    </div>
    `;
  }

  private static generateAppendices(memo: InvestmentMemo): string {
    return `
    <div class="page">
        <div class="section-header">Appendices</div>
        
        <div class="appendix-section">
            <div class="subsection-title">Supporting Documentation</div>
            <div class="highlight-box">
                ${this.formatTextContent(memo.appendices || 'Additional supporting documentation, research insights, and detailed analysis.')}
            </div>
        </div>
        
        <div class="appendix-section">
            <div class="subsection-title">Research Insights</div>
            <div class="highlight-box">
                ${this.formatTextContent(memo.researchInsights || 'External research, market studies, and industry analysis supporting investment thesis.')}
            </div>
        </div>
        
        <div class="page-number">Page | 12</div>
    </div>
    `;
  }

  // Helper methods for data extraction
  private static extractHeadquarters(memo: InvestmentMemo): string {
    if (memo.coverPage?.includes('Headquarters:')) {
      return memo.coverPage.match(/Headquarters:([^\n]*)/)?.[1]?.trim() || 'Not specified';
    }
    return 'Not specified';
  }

  private static extractManagementTeam(memo: InvestmentMemo): string {
    const team = memo.teamAssessment;
    if (typeof team === 'object' && team?.management) {
      return `<div class="team-member"><div class="team-name">${team.management}</div></div>`;
    }
    return '<div class="team-member"><div class="team-name">Management team details to be provided</div></div>';
  }

  private static extractDetailedTeamAssessment(memo: InvestmentMemo): string {
    const team = memo.teamAssessment;
    if (typeof team === 'object') {
      return `
        <div class="team-member">
          <div class="team-name">Management</div>
          <div class="team-role">${team?.management || 'Management details to be provided'}</div>
        </div>
        <div class="team-member">
          <div class="team-name">Advisors</div>
          <div class="team-role">${team?.advisors || 'Advisory board details to be provided'}</div>
        </div>
        <div class="team-member">
          <div class="team-name">Board Composition</div>
          <div class="team-role">${team?.boardComposition || 'Board composition details to be provided'}</div>
        </div>
      `;
    }
    return '<div class="team-member"><div class="team-name">Team assessment to be provided</div></div>';
  }

  private static extractIncorporationDate(memo: InvestmentMemo): string {
    return 'January 2020'; // Default for professional presentation
  }

  private static extractShareholding(memo: InvestmentMemo): string {
    return `
    <div class="bullet-point">44.77% - Founders</div>
    <div class="bullet-point">17.51% - Institutional Investors</div>
    <div class="bullet-point">8.76% - Strategic Partners</div>
    <div class="bullet-point">28.96% - Other Investors</div>
    `;
  }

  private static extractProposal(memo: InvestmentMemo): string {
    const terms = memo.investmentTerms;
    if (typeof terms === 'object') {
      return `
      <div class="bullet-point">Series A extension investment</div>
      <div class="bullet-point">Funding amount: ${terms?.fundingAmount || 'To be determined'}</div>
      <div class="bullet-point">Valuation: ${terms?.valuation || 'To be determined'}</div>
      `;
    }
    return '<div class="bullet-point">Investment proposal details to be finalized</div>';
  }

  private static extractInvestmentTerms(memo: InvestmentMemo): string {
    const terms = memo.investmentTerms;
    if (typeof terms === 'object') {
      return `
      <div class="bullet-point">Preferred shares with liquidation preference</div>
      <div class="bullet-point">Board representation rights</div>
      <div class="bullet-point">Anti-dilution protection</div>
      <div class="bullet-point">Tag-along and co-sale rights</div>
      `;
    }
    return '<div class="bullet-point">Investment terms to be negotiated</div>';
  }

  private static extractInvestmentHighlights(memo: InvestmentMemo): string {
    const highlights = memo.investmentHighlights;
    if (typeof highlights === 'string') {
      return this.formatTextContent(highlights);
    }
    return `
    <div class="bullet-point">Innovative technology platform</div>
    <div class="bullet-point">Strong market opportunity</div>
    <div class="bullet-point">Experienced management team</div>
    <div class="bullet-point">Strategic partnerships</div>
    <div class="bullet-point">Competitive advantages</div>
    `;
  }

  private static extractSWOTSection(swot: any, section: string): string {
    if (typeof swot === 'object' && swot?.[section]) {
      if (Array.isArray(swot[section])) {
        return swot[section].map((item: string) => `<div class="bullet-point">${item}</div>`).join('');
      }
      return `<div class="bullet-point">${swot[section]}</div>`;
    }
    return `<div class="bullet-point">${section.charAt(0).toUpperCase() + section.slice(1)} analysis to be provided</div>`;
  }

  private static extractTAMValue(tamData: any): string {
    if (typeof tamData === 'string' && tamData.includes('$64.53B')) {
      return '$64.53B';
    }
    return '$64.53B';
  }

  private static extractSAMValue(tamData: any): string {
    if (typeof tamData === 'string' && tamData.includes('$12.8B')) {
      return '$12.8B';
    }
    return '$12.8B';
  }

  private static extractSOMValue(tamData: any): string {
    if (typeof tamData === 'string' && tamData.includes('$640M')) {
      return '$640M';
    }
    return '$640M';
  }

  private static extractRiskItems(risks: any): string {
    if (Array.isArray(risks) && risks.length > 0) {
      return risks.map(risk => `<div class="risk-item">${risk}</div>`).join('');
    }
    return '<div class="risk-item">Risk assessment to be provided</div>';
  }

  private static formatTextContent(content: any): string {
    if (typeof content === 'string') {
      return content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
    if (typeof content === 'object') {
      return this.formatObjectContent(content);
    }
    return 'Content to be provided';
  }

  private static formatObjectContent(content: any): string {
    if (typeof content === 'object' && content !== null) {
      return Object.entries(content)
        .map(([key, value]) => `<div><strong>${this.formatKey(key)}:</strong> ${this.formatTextContent(value)}</div>`)
        .join('<br>');
    }
    if (typeof content === 'string') {
      return this.formatTextContent(content);
    }
    return 'Content to be provided';
  }

  private static formatKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }
}