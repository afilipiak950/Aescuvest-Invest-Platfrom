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

    const addTable = (tableData: string[][], hasHeader: boolean = true) => {
      if (!tableData || tableData.length === 0) return;
      
      const cellPadding = 3;
      const rowHeight = 12;
      const headerHeight = 15;
      
      // Calculate column widths based on content
      const colCount = Math.max(...tableData.map(row => row.length));
      const colWidths = new Array(colCount).fill(0);
      
      // Find maximum width for each column
      tableData.forEach(row => {
        row.forEach((cell, colIndex) => {
          const cellWidth = doc.getTextWidth(cell || '') + (cellPadding * 2);
          colWidths[colIndex] = Math.max(colWidths[colIndex] || 0, cellWidth);
        });
      });
      
      // Ensure columns fit within page width
      const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
      if (totalWidth > contentWidth) {
        const scaleFactor = contentWidth / totalWidth;
        colWidths.forEach((width, index) => {
          colWidths[index] = width * scaleFactor;
        });
      }
      
      let currentX = margin;
      let currentY = yPosition;
      
      tableData.forEach((row, rowIndex) => {
        checkPageBreak(rowIndex === 0 && hasHeader ? headerHeight : rowHeight);
        
        currentX = margin;
        currentY = yPosition;
        
        // Draw row background for header
        if (rowIndex === 0 && hasHeader) {
          doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          doc.rect(margin, currentY - 8, contentWidth, headerHeight, 'F');
        } else if (rowIndex % 2 === 0) {
          // Alternate row colors
          doc.setFillColor(245, 245, 245);
          doc.rect(margin, currentY - 8, contentWidth, rowHeight, 'F');
        }
        
        // Draw cells
        row.forEach((cell, colIndex) => {
          if (colIndex < colWidths.length) {
            // Set text style
            if (rowIndex === 0 && hasHeader) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(fonts.body);
              doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(fonts.small);
              doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            }
            
            // Draw cell borders
            doc.setLineWidth(0.1);
            doc.setDrawColor(200, 200, 200);
            doc.rect(currentX, currentY - 8, colWidths[colIndex], rowIndex === 0 && hasHeader ? headerHeight : rowHeight);
            
            // Add cell text with proper truncation and number formatting
            let cellText = (cell || '').toString();
            
            // Format numbers and currency values
            if (cellText.match(/^\$?[\d,]+\.?\d*$/) || cellText.match(/^\$[\d,]+$/)) {
              // Right-align numbers and currency
              const maxCellWidth = colWidths[colIndex] - (cellPadding * 2);
              const truncatedText = doc.splitTextToSize(cellText, maxCellWidth)[0] || '';
              const textWidth = doc.getTextWidth(truncatedText);
              doc.text(truncatedText, currentX + colWidths[colIndex] - cellPadding - textWidth, currentY);
            } else {
              // Left-align text
              const maxCellWidth = colWidths[colIndex] - (cellPadding * 2);
              const truncatedText = doc.splitTextToSize(cellText, maxCellWidth)[0] || '';
              doc.text(truncatedText, currentX + cellPadding, currentY, { 
                maxWidth: maxCellWidth 
              });
            }
            
            currentX += colWidths[colIndex];
          }
        });
        
        yPosition += rowIndex === 0 && hasHeader ? headerHeight : rowHeight;
      });
      
      yPosition += 8; // Extra spacing after table
    };

    const addText = (text: string, fontSize: number = fonts.body, isIndented: boolean = false) => {
      if (!text || text.trim() === '') return;
      
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      
      const x = isIndented ? margin + 10 : margin;
      const maxWidth = contentWidth - (isIndented ? 10 : 0);
      
      // Check if this looks like table data (contains pipe separators)
      if (text.includes('|') && text.split('|').length > 3) {
        const tableData = this.parseTableData(text);
        if (tableData.length > 0) {
          addTable(tableData, true);
          return;
        }
      }
      
      // Enhanced text processing with better paragraph handling
      const processedText = this.processTextContent(text);
      
      processedText.forEach((paragraph) => {
        if (paragraph.type === 'paragraph') {
          const lines = doc.splitTextToSize(paragraph.content, maxWidth);
          lines.forEach((line: string) => {
            checkPageBreak();
            doc.text(line, x, yPosition);
            yPosition += fontSize * 0.5 + 3; // Increased line spacing
          });
          yPosition += 6; // Increased paragraph spacing
        } else if (paragraph.type === 'bullet') {
          checkPageBreak();
          doc.text('•', x, yPosition);
          const bulletLines = doc.splitTextToSize(paragraph.content, maxWidth - 10);
          bulletLines.forEach((line: string, lineIndex: number) => {
            if (lineIndex === 0) {
              doc.text(line, x + 10, yPosition);
            } else {
              yPosition += fontSize * 0.5 + 3; // Increased line spacing
              checkPageBreak();
              doc.text(line, x + 10, yPosition);
            }
          });
          yPosition += fontSize * 0.5 + 4; // Increased bullet spacing
        } else if (paragraph.type === 'heading') {
          checkPageBreak(12);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fontSize + 2);
          doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
          doc.text(paragraph.content, x, yPosition);
          yPosition += (fontSize + 2) * 0.5 + 8; // Increased heading spacing
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        }
      });
      
      yPosition += 2; // Extra spacing after text blocks
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
      
      // Process content based on type with enhanced formatting
      if (typeof content === 'string') {
        addText(content);
      } else if (Array.isArray(content)) {
        content.forEach((item, index) => {
          if (typeof item === 'string') {
            addText(`• ${item}`, fonts.body, true);
          } else {
            addText(`${index + 1}. ${this.formatItem(item)}`, fonts.body, true);
          }
        });
      } else if (typeof content === 'object' && content !== null) {
        Object.entries(content).forEach(([key, value]) => {
          if (key && value) {
            const formattedKey = this.formatKey(key);
            const formattedValue = this.formatItem(value);
            
            // Create a sub-heading for the key
            checkPageBreak(8);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fonts.body + 1);
            doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
            doc.text(formattedKey, margin + 5, yPosition);
            yPosition += (fonts.body + 1) * 0.4 + 4;
            
            // Reset formatting for content
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(fonts.body);
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            
            // Add the content with proper formatting
            addText(formattedValue, fonts.body, true);
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
        // Special handling for financial sections
        if (section.key === 'financialProjections' || section.key === 'financialAnalysis') {
          addSection(section.title, content);
          
          // Try to extract and format any embedded table data specifically
          if (typeof content === 'string' && content.includes('|')) {
            const tableData = this.parseTableData(content);
            if (tableData.length > 1) {
              // Add a subtitle for the table
              checkPageBreak(8);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(fonts.body + 1);
              doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
              doc.text('Financial Data Summary', margin + 5, yPosition);
              yPosition += 12;
              
              // Reset formatting
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(fonts.body);
              doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
              
              // Render the table
              addTable(tableData, true);
            }
          }
        } else {
          addSection(section.title, content);
        }
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
      // Remove all markdown formatting
      .replace(/#{1,6}\s*/g, '') // Remove markdown headers
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // Remove bold/italic asterisks
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1') // Remove bold/italic underscores
      .replace(/\*{2,}/g, '') // Remove standalone asterisks
      .replace(/#{2,}/g, '') // Remove standalone hashes
      .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // Remove code formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links, keep text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Remove markdown images, keep alt text
      .replace(/>\s*/g, '') // Remove blockquote markers
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers at line start
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      // Clean up whitespace and line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce triple+ line breaks to double
      .replace(/\s+/g, ' ') // Normalize all whitespace to single spaces
      .replace(/\n\s+/g, '\n') // Remove leading spaces after line breaks
      .replace(/\s+\n/g, '\n') // Remove trailing spaces before line breaks
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

  private static processTextContent(text: string): Array<{type: string, content: string}> {
    if (!text) return [];
    
    // First, thoroughly clean the text of all markdown artifacts
    const cleanedText = this.cleanText(text);
    if (!cleanedText) return [];
    
    const result: Array<{type: string, content: string}> = [];
    
    // Split text into logical paragraphs and process each
    const paragraphs = cleanedText.split(/\n\s*\n/).filter(p => p.trim());
    
    paragraphs.forEach(paragraph => {
      const trimmed = paragraph.trim();
      
      if (!trimmed) return;
      
      // Check for different content types after cleaning
      if (trimmed.match(/^[•\-\*]\s/) || trimmed.match(/^\s*•\s/)) {
        // Bullet point
        const content = trimmed.replace(/^[•\-\*]\s+/, '').replace(/^\s*•\s+/, '').trim();
        if (content) {
          result.push({ type: 'bullet', content });
        }
      } else if (trimmed.match(/^\d+\.\s/)) {
        // Numbered list item - treat as bullet
        const content = trimmed.replace(/^\d+\.\s+/, '').trim();
        if (content) {
          result.push({ type: 'bullet', content });
        }
      } else if (trimmed.match(/^[A-Z][A-Z\s]+:?\s*$/) && trimmed.length < 100) {
        // Heading (all caps, short length)
        const content = trimmed.replace(/:+$/, '').trim();
        if (content) {
          result.push({ type: 'heading', content });
        }
      } else if (trimmed.includes('\n•') || trimmed.includes('\n-') || trimmed.includes('\n*')) {
        // Paragraph with embedded bullet points - split them
        const lines = trimmed.split('\n');
        let currentParagraph = '';
        
        lines.forEach(line => {
          const cleanLine = line.trim();
          if (cleanLine.match(/^[•\-\*]\s/) || cleanLine.match(/^\s*•\s/)) {
            // Save any accumulated paragraph
            if (currentParagraph.trim()) {
              result.push({ type: 'paragraph', content: this.cleanText(currentParagraph) });
              currentParagraph = '';
            }
            // Add bullet point
            const content = cleanLine.replace(/^[•\-\*]\s+/, '').replace(/^\s*•\s+/, '').trim();
            if (content) {
              result.push({ type: 'bullet', content });
            }
          } else if (cleanLine) {
            currentParagraph += (currentParagraph ? ' ' : '') + cleanLine;
          }
        });
        
        // Add any remaining paragraph content
        if (currentParagraph.trim()) {
          result.push({ type: 'paragraph', content: this.cleanText(currentParagraph) });
        }
      } else {
        // Regular paragraph - ensure it's properly cleaned and formatted
        let cleanContent = trimmed
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure proper sentence spacing
          .replace(/\s([,.!?;:])/g, '$1') // Fix spacing before punctuation
          .trim();
          
        // Better financial text formatting
        cleanContent = cleanContent
          .replace(/\$(\d+),?(\d+)/g, '$$$1,$2') // Ensure currency formatting
          .replace(/(\d+)%/g, '$1%') // Ensure percentage formatting
          .replace(/(\d+)\s+million/gi, '$1 million') // Standardize million formatting
          .replace(/(\d+)\s+billion/gi, '$1 billion') // Standardize billion formatting
          .replace(/\s+([,.])/g, '$1') // Fix spacing before punctuation
          .replace(/([,.!?])\s*([A-Z])/g, '$1 $2'); // Proper sentence spacing
          
        if (cleanContent && cleanContent.length > 0) {
          result.push({ type: 'paragraph', content: cleanContent });
        }
      }
    });
    
    return result;
  }

  private static parseTableData(text: string): string[][] {
    if (!text || !text.includes('|')) return [];
    
    // Split by lines and filter out empty lines
    const lines = text.split('\n').filter(line => line.trim() && line.includes('|'));
    
    if (lines.length === 0) return [];
    
    const tableData: string[][] = [];
    
    lines.forEach(line => {
      // Clean and split by pipe separator
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter((cell, index, array) => {
          // Remove empty cells at beginning and end (common in markdown tables)
          return !(cell === '' && (index === 0 || index === array.length - 1));
        })
        .filter(cell => {
          // Remove separator lines (like |----|-----|)
          return !cell.match(/^[-\s]*$/);
        });
      
      if (cells.length > 0) {
        tableData.push(cells);
      }
    });
    
    // Clean up table data further
    const cleanedTable = tableData.filter(row => {
      // Remove rows that are all dashes/separators
      return !row.every(cell => cell.match(/^[-\s]*$/));
    });
    
    return cleanedTable;
  }
}