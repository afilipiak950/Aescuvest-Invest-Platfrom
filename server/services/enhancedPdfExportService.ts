import { jsPDF } from 'jspdf';

export class EnhancedPdfExportService {
  static async generatePDF(memo: any, companyName: string): Promise<Buffer> {
    // Create PDF document with enhanced settings
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
      compress: true
    });

    // Enhanced styling variables
    const colors = {
      primary: [41, 67, 108], // Professional blue
      secondary: [78, 115, 160], // Light blue
      accent: [220, 53, 69], // Red accent
      text: [51, 51, 51], // Dark gray
      light: [128, 128, 128], // Light gray
      white: [255, 255, 255]
    };

    const fonts = {
      title: 18,
      heading: 14,
      subheading: 12,
      body: 10,
      small: 9
    };

    let yPosition = 20;
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Helper functions
    const addPage = () => {
      doc.addPage();
      yPosition = margin;
    };

    const checkPageBreak = (spaceNeeded: number = 15) => {
      if (yPosition + spaceNeeded > pageHeight - margin) {
        addPage();
      }
    };

    const addTitle = (text: string, fontSize: number = fonts.heading, color: number[] = colors.primary) => {
      checkPageBreak(15);
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(text, margin, yPosition);
      yPosition += fontSize * 0.5 + 5;
    };

    const addText = (text: string, fontSize: number = fonts.body, isIndented: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      
      const x = isIndented ? margin + 10 : margin;
      const maxWidth = contentWidth - (isIndented ? 10 : 0);
      
      // Clean and format text
      const cleanText = this.cleanText(text);
      const lines = doc.splitTextToSize(cleanText, maxWidth);
      
      lines.forEach((line: string) => {
        checkPageBreak();
        doc.text(line, x, yPosition);
        yPosition += fontSize * 0.4 + 2;
      });
      
      yPosition += 3; // Extra spacing after paragraphs
    };

    const addSection = (title: string, content: any) => {
      if (!content) return;
      
      checkPageBreak(25);
      
      // Add colored section header with line
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(margin, yPosition - 3, contentWidth, 8, 'F');
      
      doc.setFontSize(fonts.heading);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.text(title.toUpperCase(), margin + 5, yPosition + 2);
      
      yPosition += 12;
      
      // Process content based on type
      if (typeof content === 'string') {
        addText(content);
      } else if (Array.isArray(content)) {
        content.forEach((item, index) => {
          addText(`${index + 1}. ${this.formatItem(item)}`, fonts.body, true);
        });
      } else if (typeof content === 'object') {
        Object.entries(content).forEach(([key, value]) => {
          if (key && value) {
            addText(`${this.formatKey(key)}: ${this.formatItem(value)}`, fonts.body, true);
          }
        });
      }
      
      yPosition += 5; // Extra spacing after sections
    };

    // Generate cover page with professional design
    this.generateCoverPage(doc, memo, companyName, colors, fonts, margin, contentWidth);
    
    // Table of contents
    addPage();
    addTitle('TABLE OF CONTENTS', fonts.title);
    yPosition += 5;
    
    const sections = this.getSectionList();
    sections.forEach((section, index) => {
      doc.setFontSize(fonts.body);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      doc.text(`${index + 1}. ${section}`, margin, yPosition);
      
      // Add dots and page number
      const dots = '.'.repeat(Math.max(3, Math.floor((contentWidth - doc.getTextWidth(`${index + 1}. ${section}`) - doc.getTextWidth('XX')) / doc.getTextWidth('.'))));
      doc.text(dots, margin + doc.getTextWidth(`${index + 1}. ${section}`) + 2, yPosition);
      doc.text(`${index + 3}`, pageWidth - margin - 10, yPosition);
      
      yPosition += 6;
    });

    // Generate memo sections
    addPage();
    
    // Executive Summary with enhanced formatting
    if (memo.executiveSummary) {
      addTitle('EXECUTIVE SUMMARY', fonts.title);
      addText(memo.executiveSummary);
      addPage();
    }

    // Investment Highlights with bullet points
    if (memo.investmentHighlights) {
      addTitle('INVESTMENT HIGHLIGHTS', fonts.title);
      if (Array.isArray(memo.investmentHighlights)) {
        memo.investmentHighlights.forEach((highlight) => {
          addText(`• ${highlight}`, fonts.body, true);
        });
      } else {
        addText(memo.investmentHighlights);
      }
      addPage();
    }

    // Main sections
    const sectionMappings = [
      { key: 'marketAnalysis', title: 'Market Analysis' },
      { key: 'productAnalysis', title: 'Product Analysis' },
      { key: 'businessModel', title: 'Business Model' },
      { key: 'teamAssessment', title: 'Team Assessment' },
      { key: 'financialAnalysis', title: 'Financial Analysis' },
      { key: 'clinicalAssessment', title: 'Clinical Assessment' },
      { key: 'technologyAssessment', title: 'Technology Assessment' },
      { key: 'ipAnalysis', title: 'Intellectual Property Analysis' },
      { key: 'regulatoryAnalysis', title: 'Regulatory Analysis' },
      { key: 'competitiveAnalysis', title: 'Competitive Analysis' },
      { key: 'commercialStrategy', title: 'Commercial Strategy' },
      { key: 'swotAnalysis', title: 'SWOT Analysis' },
      { key: 'riskAssessment', title: 'Risk Assessment' },
      { key: 'mitigationStrategies', title: 'Mitigation Strategies' },
      { key: 'legalAssessment', title: 'Legal Assessment' },
      { key: 'financialProjections', title: 'Financial Projections' },
      { key: 'tamSamSomAnalysis', title: 'TAM/SAM/SOM Analysis' },
      { key: 'valuationAnalysis', title: 'Valuation Analysis' },
      { key: 'investmentTerms', title: 'Investment Terms' },
      { key: 'exitStrategy', title: 'Exit Strategy' },
      { key: 'recommendation', title: 'Investment Recommendation' }
    ];

    sectionMappings.forEach((section) => {
      const content = (memo as any)[section.key];
      if (content) {
        addSection(section.title, content);
      }
    });

    // Generate PDF buffer
    const pdfArrayBuffer = doc.output('arraybuffer');
    return Buffer.from(pdfArrayBuffer);
  }

  private static generateCoverPage(
    doc: jsPDF, 
    memo: InvestmentMemo, 
    companyName: string, 
    colors: any, 
    fonts: any, 
    margin: number, 
    contentWidth: number
  ) {
    // Gradient background simulation with rectangles
    for (let i = 0; i < 10; i++) {
      const alpha = 0.1 - (i * 0.01);
      const blue = Math.floor(colors.primary[2] + (i * 15));
      doc.setFillColor(colors.primary[0], colors.primary[1], Math.min(blue, 255));
      doc.rect(0, i * 5, 210, 5, 'F');
    }

    // Company logo placeholder (blue circle)
    doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.circle(105, 60, 15, 'F');
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.circle(105, 60, 10, 'F');

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('INVESTMENT MEMORANDUM', 105, 100, { align: 'center' });

    // Company name
    doc.setFontSize(20);
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(companyName, 105, 120, { align: 'center' });

    // Subtitle line
    doc.setLineWidth(0.5);
    doc.setDrawColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.line(margin, 130, 210 - margin, 130);

    // Date and confidentiality
    doc.setFontSize(fonts.body);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.light[0], colors.light[1], colors.light[2]);
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    });
    
    doc.text(currentDate, 105, 150, { align: 'center' });
    doc.text('CONFIDENTIAL & PROPRIETARY', 105, 160, { align: 'center' });

    // Professional footer
    doc.setFontSize(fonts.small);
    doc.text('Prepared by Aescuvest Investment Intelligence Platform', 105, 280, { align: 'center' });
  }

  private static getSectionList(): string[] {
    return [
      'Executive Summary',
      'Investment Highlights', 
      'Market Analysis',
      'Product Analysis',
      'Business Model',
      'Team Assessment',
      'Financial Analysis',
      'Technology Assessment',
      'Risk Assessment',
      'Investment Recommendation'
    ];
  }

  private static cleanText(text: string): string {
    if (!text) return '';
    return text
      .replace(/[#*\-_]/g, '') // Remove markdown formatting
      .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private static formatItem(item: any): string {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return item.toString();
    if (typeof item === 'object') return JSON.stringify(item, null, 2);
    return String(item);
  }

  private static formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  }
}