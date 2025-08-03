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
        } else if (paragraph.type === 'highlight') {
          checkPageBreak();
          
          // Render highlight with special formatting (green bullet, bold text)
          doc.setTextColor(34, 139, 34); // Forest green for highlight bullet
          doc.setFont('helvetica', 'bold');
          doc.text('★', x, yPosition);
          
          // Render content in emphasized style
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(fontSize);
          doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
          
          const highlightLines = doc.splitTextToSize(paragraph.content, maxWidth - 10);
          highlightLines.forEach((line: string, lineIndex: number) => {
            if (lineIndex === 0) {
              doc.text(line, x + 10, yPosition);
            } else {
              yPosition += fontSize * 0.5 + 3;
              checkPageBreak();
              doc.text(line, x + 10, yPosition);
            }
          });
          
          // Reset formatting
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
          yPosition += fontSize * 0.5 + 6; // Extra spacing for highlights
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
        } else if (paragraph.type === 'keyvalue') {
          checkPageBreak(8);
          
          // Split the key-value content
          const kvMatch = paragraph.content.match(/\*\*(.*?)\*\*:\s*(.*)/);
          if (kvMatch) {
            const [, key, value] = kvMatch;
            
            // Render key in bold
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSize);
            doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
            doc.text(`${key}:`, x, yPosition);
            
            // Calculate key width for value positioning
            const keyWidth = doc.getTextWidth(`${key}: `);
            
            // Render value in normal font
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            
            const valueMaxWidth = maxWidth - keyWidth - 5;
            const valueLines = doc.splitTextToSize(value, valueMaxWidth);
            
            valueLines.forEach((valueLine: string, lineIndex: number) => {
              if (lineIndex === 0) {
                doc.text(valueLine, x + keyWidth, yPosition);
              } else {
                yPosition += fontSize * 0.5 + 3;
                checkPageBreak();
                doc.text(valueLine, x + keyWidth, yPosition);
              }
            });
            
            yPosition += fontSize * 0.5 + 6; // Extra spacing after key-value pairs
          } else {
            // Fallback to regular text if parsing fails
            const lines = doc.splitTextToSize(paragraph.content, maxWidth);
            lines.forEach((line: string) => {
              checkPageBreak();
              doc.text(line, x, yPosition);
              yPosition += fontSize * 0.5 + 3;
            });
            yPosition += 4;
          }
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
      // Remove markdown formatting but preserve structure indicators
      .replace(/#{1,6}\s*/g, '') // Remove markdown headers
      .replace(/\*{3}([^*]+)\*{3}/g, '$1') // Remove triple asterisks (bold+italic)
      .replace(/\*{2}([^*]+)\*{2}/g, '$1') // Remove double asterisks (bold)
      .replace(/\*{1}([^*]+)\*{1}/g, '$1') // Remove single asterisks (italic)
      .replace(/_{3}([^_]+)_{3}/g, '$1') // Remove triple underscores
      .replace(/_{2}([^_]+)_{2}/g, '$1') // Remove double underscores (bold)
      .replace(/_{1}([^_]+)_{1}/g, '$1') // Remove single underscores (italic)
      .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // Remove code formatting
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links, keep text
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Remove markdown images, keep alt text
      .replace(/>\s*/g, '') // Remove blockquote markers
      // Clean up excessive whitespace but preserve line structure
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce triple+ line breaks to double
      .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs to single spaces
      .replace(/\n[ \t]+/g, '\n') // Remove leading spaces/tabs after line breaks
      .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces/tabs before line breaks
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
    
    const result: Array<{type: string, content: string}> = [];
    
    // Split text into lines first, then process for better structure detection
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return [];
    
    let currentParagraph = '';
    
    lines.forEach((line, index) => {
      // Enhanced bullet point detection with more patterns
      if (line.match(/^[\-\*•]\s+/) || 
          line.match(/^\d+\.\s+/) || 
          line.match(/^[a-zA-Z]\.\s+/) || 
          line.match(/^[ivxIVX]+\.\s+/) ||
          line.match(/^○\s+/) ||
          line.match(/^→\s+/) ||
          line.match(/^▪\s+/) ||
          line.match(/^‣\s+/) ||
          line.match(/^•\s+/)) {
        
        // Save any accumulated paragraph first
        if (currentParagraph.trim()) {
          result.push({ type: 'paragraph', content: this.cleanText(currentParagraph) });
          currentParagraph = '';
        }
        
        // Extract bullet content with comprehensive pattern matching
        let bulletContent = line
          .replace(/^[\-\*•○→▪‣]\s+/, '')
          .replace(/^\d+\.\s+/, '')
          .replace(/^[a-zA-Z]\.\s+/, '')
          .replace(/^[ivxIVX]+\.\s+/, '')
          .trim();
          
        // Special handling for key highlights (often start with action words or key phrases)
        if (bulletContent.match(/^(Key|Strong|Significant|Major|Critical|Important|Notable|Excellent|Outstanding|Proven)/i)) {
          result.push({ type: 'highlight', content: this.cleanText(bulletContent) });
        } else if (bulletContent) {
          result.push({ type: 'bullet', content: this.cleanText(bulletContent) });
        }
      }
      // Enhanced heading detection
      else if (
        (line.match(/^[A-Z][A-Z\s\-:]+$/) && line.length < 80) || // ALL CAPS headings
        (line.match(/^\d+\.\s*[A-Z]/) && line.length < 100) || // Numbered sections
        (line.endsWith(':') && line.length < 100 && !line.includes(',')) || // Colon endings
        (line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/) && line.length < 80 && !line.includes(',')) // Title Case
      ) {
        // Save any accumulated paragraph first
        if (currentParagraph.trim()) {
          result.push({ type: 'paragraph', content: this.cleanText(currentParagraph) });
          currentParagraph = '';
        }
        
        const headingContent = line.replace(/:+$/, '').trim();
        if (headingContent) {
          result.push({ type: 'heading', content: headingContent });
        }
      }
      // Key-value pairs (common in investment memos)
      else if (line.includes(':') && line.split(':').length === 2 && line.length < 150) {
        // Save any accumulated paragraph first
        if (currentParagraph.trim()) {
          result.push({ type: 'paragraph', content: this.cleanText(currentParagraph) });
          currentParagraph = '';
        }
        
        const [key, value] = line.split(':').map(part => part.trim());
        if (key && value) {
          result.push({ type: 'keyvalue', content: `**${key}:** ${value}` });
        }
      }
      // Regular text - accumulate into paragraphs
      else {
        if (currentParagraph) {
          currentParagraph += ' ' + line;
        } else {
          currentParagraph = line;
        }
        
        // Check if this might be end of paragraph (next line is different type or end of text)
        const nextLine = lines[index + 1];
        if (!nextLine || 
            nextLine.match(/^[\-\*•]\s+/) || 
            nextLine.match(/^\d+\.\s+/) ||
            nextLine.match(/^[A-Z][A-Z\s\-:]+$/) ||
            nextLine === '' ||
            nextLine.includes(':')) {
          
          if (currentParagraph.trim()) {
            const cleanContent = this.cleanText(currentParagraph)
              .replace(/\$(\d+),?(\d+)/g, '$$$1,$2') // Currency formatting
              .replace(/(\d+)%/g, '$1%') // Percentage formatting
              .replace(/(\d+)\s+million/gi, '$1 million') // Million formatting
              .replace(/(\d+)\s+billion/gi, '$1 billion'); // Billion formatting
              
            result.push({ type: 'paragraph', content: cleanContent });
          }
          currentParagraph = '';
        }
      }
    });
    
    // Add any remaining paragraph
    if (currentParagraph.trim()) {
      const cleanContent = this.cleanText(currentParagraph);
      if (cleanContent) {
        result.push({ type: 'paragraph', content: cleanContent });
      }
    }
    
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