import { jsPDF } from 'jspdf';
import type { Deal } from '@shared/schema';

interface MemoData {
  [key: string]: any;
}

export class ProfessionalPdfExportService {
  static async generatePdf(memo: MemoData, companyName: string): Promise<Buffer> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      putOnlyUsedFonts: true,
      compress: true
    });
    
    // Professional color scheme
    const colors = {
      primary: [31, 81, 137],      // Deep blue
      secondary: [75, 101, 132],   // Steel blue
      accent: [210, 180, 140],     // Tan/gold
      text: [51, 51, 51],          // Dark gray
      lightText: [102, 102, 102],  // Medium gray
      background: [248, 249, 250], // Light gray
      white: [255, 255, 255],
      divider: [220, 220, 220]
    };

    // Enhanced typography
    const fonts = {
      title: 22,
      heading: 16,
      subheading: 14,
      body: 11,
      small: 9,
      caption: 8
    };

    // Layout constants
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 60;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;
    let pageNumber = 1;

    // Page management
    const addPage = () => {
      doc.addPage();
      yPosition = margin + 20;
      pageNumber++;
      this.addPageHeader(doc, companyName, pageNumber, colors, fonts, margin, contentWidth);
    };

    const checkPageBreak = (requiredSpace: number = 40) => {
      if (yPosition + requiredSpace > pageHeight - margin - 40) {
        addPage();
      }
    };

    // Enhanced text rendering with professional formatting
    const addFormattedText = (text: string, style: any = {}) => {
      const {
        fontSize = fonts.body,
        fontWeight = 'normal',
        color = colors.text,
        alignment = 'left',
        indent = 0,
        lineHeight = 1.4,
        marginBottom = 8
      } = style;

      if (!text || text.trim() === '') return;

      doc.setFontSize(fonts.body);
      doc.setFont('helvetica', fontWeight);
      doc.setTextColor(color[0], color[1], color[2]);

      const cleanText = this.cleanAndFormatText(text);
      const x = margin + indent;
      const maxWidth = contentWidth - indent;
      
      const lines = doc.splitTextToSize(cleanText, maxWidth);
      const actualLineHeight = fonts.body * lineHeight;
      
      lines.forEach((line: string, index: number) => {
        checkPageBreak(actualLineHeight);
        
        if (alignment === 'center') {
          doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
        } else if (alignment === 'right') {
          doc.text(line, pageWidth - margin, yPosition, { align: 'right' });
        } else {
          doc.text(line, x, yPosition);
        }
        
        if (index < lines.length - 1) {
          yPosition += actualLineHeight;
        }
      });
      
      yPosition += actualLineHeight + marginBottom;
    };

    // Professional section headers
    const addSectionHeader = (title: string, level: number = 1) => {
      checkPageBreak(50);
      
      // Add extra spacing before section
      yPosition += level === 1 ? 20 : 12;
      
      // Section divider line for main sections
      if (level === 1) {
        doc.setLineWidth(2);
        doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.line(margin, yPosition - 10, pageWidth - margin, yPosition - 10);
        yPosition += 5;
      }
      
      const fonts.body = level === 1 ? fonts.heading : fonts.subheading;
      const color = level === 1 ? colors.primary : colors.secondary;
      
      addFormattedText(title.toUpperCase(), {
        fonts.body,
        fontWeight: 'bold',
        color,
        marginBottom: level === 1 ? 16 : 12
      });
    };

    // Bullet points with professional formatting
    const addBulletPoints = (items: string[], style: any = {}) => {
      if (!Array.isArray(items) || items.length === 0) return;
      
      const bulletStyle = {
        fonts.body: fonts.body,
        color: colors.text,
        indent: 20,
        bulletIndent: 30,
        ...style
      };
      
      items.forEach((item, index) => {
        if (!item || item.trim() === '') return;
        
        checkPageBreak(30);
        
        // Bullet symbol
        doc.setFontSize(bulletStyle.fonts.body);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        doc.text('•', margin + bulletStyle.indent, yPosition);
        
        // Bullet text
        const cleanItem = this.cleanAndFormatText(item);
        const bulletLines = doc.splitTextToSize(cleanItem, contentWidth - bulletStyle.bulletIndent - 10);
        
        doc.setTextColor(bulletStyle.color[0], bulletStyle.color[1], bulletStyle.color[2]);
        
        bulletLines.forEach((line: string, lineIndex: number) => {
          if (lineIndex > 0) {
            yPosition += bulletStyle.fonts.body * 1.4;
            checkPageBreak(20);
          }
          doc.text(line, margin + bulletStyle.bulletIndent, yPosition);
        });
        
        yPosition += bulletStyle.fonts.body * 1.4 + (index < items.length - 1 ? 8 : 12);
      });
    };

    // Enhanced table rendering
    const addTable = (data: any[], headers: string[], title?: string) => {
      if (!data || data.length === 0) return;
      
      if (title) {
        addFormattedText(title, {
          fonts.body: fonts.subheading,
          fontWeight: 'bold',
          color: colors.secondary,
          marginBottom: 12
        });
      }
      
      checkPageBreak(100);
      
      const tableWidth = contentWidth;
      const colWidth = tableWidth / headers.length;
      const rowHeight = 25;
      
      // Table header
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(margin, yPosition, tableWidth, rowHeight, 'F');
      
      doc.setFontSize(fonts.body);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      
      headers.forEach((header, index) => {
        doc.text(header, margin + (index * colWidth) + 8, yPosition + 16);
      });
      
      yPosition += rowHeight;
      
      // Table rows
      data.slice(0, 10).forEach((row, rowIndex) => {
        checkPageBreak(rowHeight + 10);
        
        // Alternating row colors
        if (rowIndex % 2 === 0) {
          doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
          doc.rect(margin, yPosition, tableWidth, rowHeight, 'F');
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        
        headers.forEach((header, colIndex) => {
          const cellValue = String(row[header] || '').substring(0, 30);
          doc.text(cellValue, margin + (colIndex * colWidth) + 8, yPosition + 16);
        });
        
        yPosition += rowHeight;
      });
      
      yPosition += 15;
    };

    // Generate cover page
    this.generateCoverPage(doc, memo, companyName, colors, fonts);
    
    // Table of Contents
    addPage();
    this.generateTableOfContents(doc, colors, fonts, margin, contentWidth);
    
    // Executive Summary
    addPage();
    addSectionHeader('Executive Summary');
    if (memo.executiveSummary) {
      addFormattedText(memo.executiveSummary, { lineHeight: 1.5 });
    }
    
    // Investment Highlights
    addPage();
    addSectionHeader('Investment Highlights');
    if (memo.investmentHighlights) {
      if (Array.isArray(memo.investmentHighlights)) {
        addBulletPoints(memo.investmentHighlights);
      } else {
        addFormattedText(memo.investmentHighlights, { lineHeight: 1.5 });
      }
    }
    
    // Market Analysis
    addPage();
    addSectionHeader('Market Analysis');
    this.renderComplexSection(memo.marketAnalysis, addFormattedText, addSectionHeader, addBulletPoints, addTable);
    
    // Technology Assessment
    if (memo.technologyAssessment) {
      addPage();
      addSectionHeader('Technology Assessment');
      this.renderComplexSection(memo.technologyAssessment, addFormattedText, addSectionHeader, addBulletPoints, addTable);
    }
    
    // Business Model
    if (memo.businessModel) {
      addPage();
      addSectionHeader('Business Model');
      this.renderComplexSection(memo.businessModel, addFormattedText, addSectionHeader, addBulletPoints, addTable);
    }
    
    // Financial Analysis
    if (memo.financialAnalysis) {
      addPage();
      addSectionHeader('Financial Analysis');
      this.renderComplexSection(memo.financialAnalysis, addFormattedText, addSectionHeader, addBulletPoints, addTable);
    }
    
    // Risk Assessment
    if (memo.riskAssessment) {
      addPage();
      addSectionHeader('Risk Assessment');
      this.renderComplexSection(memo.riskAssessment, addFormattedText, addSectionHeader, addBulletPoints, addTable);
    }
    
    // Investment Recommendation
    if (memo.recommendation) {
      addPage();
      addSectionHeader('Investment Recommendation');
      this.renderComplexSection(memo.recommendation, addFormattedText, addSectionHeader, addBulletPoints, addTable);
    }
    
    // Add footer to all pages
    this.addPageFooters(doc, pageNumber, colors, fonts);
    
    return Buffer.from(doc.output('arraybuffer'));
  }

  private static generateCoverPage(doc: jsPDF, memo: any, companyName: string, colors: any, fonts: any) {
    const pageWidth = 595;
    const margin = 60;
    
    // Header design
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.rect(0, 0, pageWidth, 120, 'F');
    
    // Title
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.text('INVESTMENT MEMORANDUM', pageWidth / 2, 50, { align: 'center' });
    
    // Company name with accent
    doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.rect(margin, 140, pageWidth - (margin * 2), 60, 'F');
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.text(companyName, pageWidth / 2, 175, { align: 'center' });
    
    // Date and confidentiality
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    doc.setFontSize(fonts.body);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
    doc.text(currentDate, pageWidth / 2, 250, { align: 'center' });
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text('CONFIDENTIAL & PROPRIETARY', pageWidth / 2, 280, { align: 'center' });
    
    // Professional footer
    doc.setLineWidth(1);
    doc.setDrawColor(colors.divider[0], colors.divider[1], colors.divider[2]);
    doc.line(margin, 750, pageWidth - margin, 750);
    
    doc.setFontSize(fonts.small);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
    doc.text('Prepared by Aescuvest Investment Intelligence Platform', pageWidth / 2, 770, { align: 'center' });
  }

  private static generateTableOfContents(doc: jsPDF, colors: any, fonts: any, margin: number, contentWidth: number) {
    doc.setFontSize(fonts.title);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('TABLE OF CONTENTS', margin, 80);
    
    const sections = [
      'Executive Summary',
      'Investment Highlights',
      'Market Analysis',
      'Technology Assessment',
      'Business Model',
      'Financial Analysis',
      'Risk Assessment',
      'Investment Recommendation'
    ];
    
    let yPos = 120;
    sections.forEach((section, index) => {
      doc.setFontSize(fonts.body);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      
      const pageNum = index + 3;
      doc.text(`${index + 1}. ${section}`, margin, yPos);
      doc.text(`${pageNum}`, 520, yPos);
      
      // Dotted line
      const dots = '.'.repeat(Math.floor((460 - doc.getTextWidth(`${index + 1}. ${section}`)) / 3));
      doc.text(dots, margin + doc.getTextWidth(`${index + 1}. ${section}`) + 5, yPos);
      
      yPos += 25;
    });
  }

  private static addPageHeader(doc: jsPDF, companyName: string, pageNumber: number, colors: any, fonts: any, margin: number, contentWidth: number) {
    doc.setLineWidth(0.5);
    doc.setDrawColor(colors.divider[0], colors.divider[1], colors.divider[2]);
    doc.line(margin, margin + 15, 595 - margin, margin + 15);
    
    doc.setFontSize(fonts.small);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
    doc.text(`${companyName} - Investment Memorandum`, margin, margin + 10);
    doc.text(`Page ${pageNumber}`, 595 - margin, margin + 10, { align: 'right' });
  }

  private static addPageFooters(doc: jsPDF, totalPages: number, colors: any, fonts: any) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      if (i > 1) { // Skip footer on cover page
        doc.setFontSize(fonts.caption);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
        doc.text('Confidential and Proprietary', 60, 820);
        doc.text(`Page ${i} of ${pageCount}`, 535, 820, { align: 'right' });
      }
    }
  }

  private static renderComplexSection(sectionData: any, addFormattedText: Function, addSectionHeader: Function, addBulletPoints: Function, addTable: Function) {
    if (!sectionData) return;
    
    if (typeof sectionData === 'string') {
      addFormattedText(sectionData, { lineHeight: 1.5 });
    } else if (Array.isArray(sectionData)) {
      addBulletPoints(sectionData);
    } else if (typeof sectionData === 'object') {
      Object.entries(sectionData).forEach(([key, value]) => {
        if (key && value) {
          const formattedKey = this.formatKey(key);
          addSectionHeader(formattedKey, 2);
          
          if (Array.isArray(value)) {
            addBulletPoints(value);
          } else if (typeof value === 'string') {
            addFormattedText(value, { lineHeight: 1.5, marginBottom: 16 });
          } else if (typeof value === 'object') {
            addFormattedText(JSON.stringify(value, null, 2), { 
              fonts.body: 10, 
              fontWeight: 'normal',
              lineHeight: 1.3 
            });
          }
        }
      });
    }
  }

  private static cleanAndFormatText(text: string): string {
    if (!text) return '';
    
    return text
      // Remove all markdown formatting
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
      .replace(/\*{2,}/g, '')
      .replace(/#{2,}/g, '')
      .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/>\s*/g, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Clean up whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .trim();
  }

  private static formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}