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

    // Ultra-premium enterprise styling
    const colors = {
      primary: [26, 35, 58], // Deep navy blue (enterprise)
      secondary: [58, 82, 132], // Professional blue
      accent: [206, 164, 107], // Premium gold accent
      highlight: [0, 123, 190], // Corporate bright blue
      success: [40, 167, 69], // Professional green
      text: [33, 37, 41], // Rich black
      lightText: [73, 80, 87], // Medium gray
      border: [206, 212, 218], // Light border
      background: [248, 249, 250], // Ultra-light background
      white: [255, 255, 255],
      tableHeader: [233, 236, 239], // Table header background
      tableStripe: [248, 249, 250] // Alternating table rows
    };

    const fonts = {
      title: 22, // Larger, more impactful
      sectionHeader: 16, // Clear hierarchy
      heading: 14, // Professional size
      subheading: 12, // Supporting content
      body: 10, // Readable body text
      caption: 9, // Fine details
      small: 8 // Legal/footer text
    };

    let yPosition = 30; // Account for header space
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Helper functions with ultra-premium page styling
    const addPage = () => {
      doc.addPage();
      yPosition = margin + 20; // Start content below header with proper spacing
      
      // Add premium header to each page
      addPageHeader();
      addPageFooter();
    };

    const addPageHeader = () => {
      const headerY = 12;
      
      // Header background stripe
      doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
      doc.rect(0, 0, pageWidth, 15, 'F');
      
      // Accent line
      doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.setLineWidth(0.8);
      doc.line(margin, 15, pageWidth - margin, 15);
      
      // Company name in header
      doc.setFontSize(fonts.small);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.text('AESCUVEST INVESTMENT INTELLIGENCE', margin, headerY);
      
      // Document type
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
      doc.text('Investment Memorandum', pageWidth - margin, headerY, { align: 'right' });
    };

    const addPageFooter = () => {
      const footerY = pageHeight - 8;
      
      // Footer background
      doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
      doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
      
      // Accent line
      doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.setLineWidth(0.8);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      // Page number with premium styling
      doc.setFontSize(fonts.small);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
      const pageNum = doc.getNumberOfPages();
      doc.text(`Page ${pageNum}`, pageWidth - margin, footerY, { align: 'right' });
      
      // Confidentiality notice
      doc.text('CONFIDENTIAL & PROPRIETARY', margin, footerY);
    };

    const checkPageBreak = (spaceNeeded: number = 15) => {
      if (yPosition + spaceNeeded > pageHeight - 35) { // Account for footer space
        addPage();
      }
    };

    const startNewSection = (forceNewPage: boolean = false) => {
      // Only start new page if forced or if we need significant space
      if (forceNewPage || yPosition > pageHeight - 80) {
        addPage();
        yPosition += 10; // Additional spacing at start of sections
      } else {
        // Just add some spacing between sections on same page
        yPosition += 15;
      }
    };

    const addTitle = (text: string, fontSize: number = fonts.title, color: number[] = colors.primary) => {
      checkPageBreak(25);
      
      // Ultra-premium title with background and accents
      doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
      doc.rect(margin - 5, yPosition - 8, contentWidth + 10, fontSize + 8, 'F');
      
      // Golden accent borders
      doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.setLineWidth(1);
      doc.line(margin - 5, yPosition - 8, margin + contentWidth + 5, yPosition - 8);
      doc.line(margin - 5, yPosition + fontSize, margin + contentWidth + 5, yPosition + fontSize);
      
      // Enhanced typography
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(text, margin, yPosition);
      
      // Decorative diamond accent
      doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      const diamondX = margin + contentWidth - 8;
      const diamondY = yPosition - 2;
      doc.circle(diamondX, diamondY, 2, 'F');
      
      yPosition += fontSize * 0.8 + 10;
    };

    const addTable = (tableData: string[][], hasHeader: boolean = true) => {
      if (!tableData || tableData.length === 0) return;
      
      // Ultra-premium table specifications with perfect measurements
      const cellPadding = 8;
      const rowHeight = 18;
      const headerHeight = 22;
      const borderWidth = 0.8;
      
      // Calculate optimal column widths with intelligent distribution
      const colCount = Math.max(...tableData.map(row => row.length));
      const colWidths = new Array(colCount).fill(0);
      const minColWidth = 80;
      const maxColWidth = 200;
      
      // Find maximum width for each column with smart sizing
      tableData.forEach(row => {
        row.forEach((cell, colIndex) => {
          const cellText = (cell || '').toString();
          const cellWidth = Math.min(maxColWidth, Math.max(minColWidth, doc.getTextWidth(cellText) + (cellPadding * 2) + 10));
          colWidths[colIndex] = Math.max(colWidths[colIndex] || 0, cellWidth);
        });
      });
      
      // Ensure columns fit within page width with proportional scaling
      const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const availableWidth = contentWidth - 4; // Account for outer borders
      
      if (totalWidth > availableWidth) {
        const scaleFactor = availableWidth / totalWidth;
        colWidths.forEach((width, index) => {
          colWidths[index] = Math.max(minColWidth, width * scaleFactor);
        });
      } else if (totalWidth < availableWidth) {
        // Distribute extra space proportionally
        const extraSpace = availableWidth - totalWidth;
        const spacePerCol = extraSpace / colCount;
        colWidths.forEach((width, index) => {
          colWidths[index] = width + spacePerCol;
        });
      }
      
      // Ensure proper page space for table
      const totalTableHeight = (hasHeader ? headerHeight : 0) + (tableData.length - (hasHeader ? 1 : 0)) * rowHeight + 20;
      checkPageBreak(totalTableHeight);
      
      const startY = yPosition;
      let currentY = startY;
      
      // Draw ultra-premium table with perfect borders
      tableData.forEach((row, rowIndex) => {
        let currentX = margin + 2; // Account for outer border
        const isHeaderRow = rowIndex === 0 && hasHeader;
        const currentRowHeight = isHeaderRow ? headerHeight : rowHeight;
        
        // Ultra-premium row backgrounds with sophisticated styling
        if (isHeaderRow) {
          // Premium navy header with subtle gradient effect
          doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          doc.rect(currentX, currentY, availableWidth, currentRowHeight, 'F');
          
          // Golden accent top border for premium look
          doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
          doc.setLineWidth(2.5);
          doc.line(currentX, currentY, currentX + availableWidth, currentY);
        } else if (rowIndex % 2 === 1) {
          // Sophisticated alternating stripe
          doc.setFillColor(250, 251, 252); // Ultra-light premium gray
          doc.rect(currentX, currentY, availableWidth, currentRowHeight, 'F');
        }
        
        // Draw individual cells with perfect typography
        row.forEach((cell, colIndex) => {
          if (colIndex < colWidths.length) {
            const cellWidth = colWidths[colIndex];
            
            // Ultra-premium typography settings
            let cellText = (cell || '').toString().trim();
            
            if (isHeaderRow) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(fonts.body + 2);
              doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
            } else {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(fonts.body);
              doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
            }
            
            // Enhanced number and currency detection with premium styling
            const isNumeric = !isHeaderRow && (
              cellText.match(/^\$?[\d,]+\.?\d*$/) || 
              cellText.match(/^\$[\d,]+$/) || 
              cellText.match(/^[\d,]+%$/) || 
              cellText.match(/^[\d,.-]+$/)
            );
            
            if (isNumeric) {
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(colors.highlight[0], colors.highlight[1], colors.highlight[2]);
            }
            
            // Smart text placement with proper truncation
            const maxCellWidth = cellWidth - (cellPadding * 2);
            const truncatedText = doc.splitTextToSize(cellText, maxCellWidth)[0] || '';
            
            // Vertical centering calculation
            const textY = currentY + (currentRowHeight / 2) + 3;
            
            if (isNumeric) {
              // Right-align numbers for professional financial presentation
              const textWidth = doc.getTextWidth(truncatedText);
              doc.text(truncatedText, currentX + cellWidth - cellPadding - textWidth, textY);
            } else {
              // Left-align text with perfect spacing
              doc.text(truncatedText, currentX + cellPadding, textY, { 
                maxWidth: maxCellWidth 
              });
            }
            
            // Perfect cell borders with enterprise styling
            doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
            doc.setLineWidth(borderWidth);
            
            // Vertical borders between columns (except last)
            if (colIndex < colWidths.length - 1) {
              doc.line(currentX + cellWidth, currentY, currentX + cellWidth, currentY + currentRowHeight);
            }
            
            // Horizontal borders between rows
            if (rowIndex < tableData.length - 1) {
              doc.line(currentX, currentY + currentRowHeight, currentX + cellWidth, currentY + currentRowHeight);
            }
            
            currentX += cellWidth;
          }
        });
        
        currentY += currentRowHeight;
      });
      
      // Perfect outer table border with premium finish
      doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.setLineWidth(2);
      const finalTableHeight = currentY - startY;
      doc.rect(margin + 2, startY, availableWidth, finalTableHeight);
      
      // Golden accent bottom border for luxury finish
      doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.setLineWidth(2.5);
      doc.line(margin + 2, currentY, margin + 2 + availableWidth, currentY);
      
      yPosition = currentY + 18; // Enhanced spacing after table
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
      
      // Ultra-premium section header with gradient effect
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(margin, yPosition - 5, contentWidth, 12, 'F');
      
      // Golden accent border
      doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.setLineWidth(0.8);
      doc.line(margin, yPosition - 5, margin + contentWidth, yPosition - 5);
      doc.line(margin, yPosition + 7, margin + contentWidth, yPosition + 7);
      
      // Section number and title
      doc.setFontSize(fonts.sectionHeader);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.text(title.toUpperCase(), margin + 8, yPosition + 2);
      
      // Decorative section icon (geometric shape)
      doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.circle(margin + contentWidth - 8, yPosition + 1, 2, 'F');
      
      yPosition += 20;
      
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
    
    // Ultra-premium table of contents
    startNewSection(true); // Force new page for TOC
    addTitle('TABLE OF CONTENTS', fonts.title);
    yPosition += 8;
    
    const sections = this.getSectionList();
    sections.forEach((section, index) => {
      checkPageBreak(12);
      
      // Alternating background colors for better readability
      if (index % 2 === 1) {
        doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
        doc.rect(margin - 2, yPosition - 6, contentWidth + 4, 10, 'F');
      }
      
      // Section number with premium styling
      doc.setFontSize(fonts.body);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.text(`${index + 1}.`, margin, yPosition);
      
      // Section title
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
      doc.text(section, margin + 15, yPosition);
      
      // Premium dotted line with proper spacing
      const sectionTextWidth = doc.getTextWidth(`${index + 1}. ${section}`);
      const pageNumWidth = doc.getTextWidth(`${index + 3}`);
      const dotsSpace = contentWidth - sectionTextWidth - pageNumWidth - 10;
      const dotCount = Math.max(5, Math.floor(dotsSpace / doc.getTextWidth('.')));
      const dots = '.'.repeat(dotCount);
      
      doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
      doc.text(dots, margin + sectionTextWidth + 8, yPosition);
      
      // Page number with accent background
      const pageNumX = pageWidth - margin - 12;
      doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      doc.rect(pageNumX - 3, yPosition - 4, 12, 8, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.text(`${index + 3}`, pageNumX, yPosition, { align: 'center' });
      
      yPosition += 8;
    });

    // Generate memo sections with strategic page breaks
    startNewSection(true); // Force new page for first section
    
    // Executive Summary with enhanced formatting
    if (memo.executiveSummary) {
      addTitle('EXECUTIVE SUMMARY', fonts.title);
      addText(memo.executiveSummary);
      startNewSection(true); // Force new page after executive summary
    }

    // Ultra-premium Investment Highlights section
    if (memo.investmentHighlights) {
      addTitle('INVESTMENT HIGHLIGHTS', fonts.title);
      yPosition += 5;
      
      if (Array.isArray(memo.investmentHighlights)) {
        memo.investmentHighlights.forEach((highlight, index) => {
          checkPageBreak(18);
          
          // Premium highlight box with gradient background
          doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
          doc.rect(margin - 2, yPosition - 8, contentWidth + 4, 16, 'F');
          
          // Accent border
          doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
          doc.setLineWidth(0.5);
          doc.line(margin - 2, yPosition - 8, margin + contentWidth + 2, yPosition - 8);
          doc.line(margin - 2, yPosition + 8, margin + contentWidth + 2, yPosition + 8);
          
          // Premium bullet with numbering
          doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
          doc.circle(margin + 5, yPosition - 1, 3, 'F');
          
          doc.setFontSize(fonts.small);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
          doc.text(`${index + 1}`, margin + 5, yPosition, { align: 'center' });
          
          // Highlight content with premium typography
          doc.setFontSize(fonts.body);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
          
          const cleanHighlight = this.processTextContent(highlight)[0]?.content || highlight;
          const highlightLines = doc.splitTextToSize(cleanHighlight, contentWidth - 25);
          
          highlightLines.forEach((line: string, lineIndex: number) => {
            doc.text(line, margin + 15, yPosition + (lineIndex * 5) - 1);
          });
          
          yPosition += Math.max(16, highlightLines.length * 5 + 8);
        });
      } else {
        addText(memo.investmentHighlights);
      }
      startNewSection(true); // Force new page after investment highlights
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
        // Only force new pages for major sections
        const majorSections = ['marketAnalysis', 'financialAnalysis', 'clinicalAssessment', 
                              'riskAssessment', 'competitiveAnalysis', 'recommendation'];
        const forceNewPage = majorSections.includes(section.key);
        startNewSection(forceNewPage);
        
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
    // Ultra-premium header banner with subtle gradient
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Accent gold stripe
    doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.rect(0, 35, 210, 3, 'F');
    
    // Premium geometric logo design
    doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.circle(105, 70, 18, 'F');
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.circle(105, 70, 15, 'F');
    doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.circle(105, 70, 8, 'F');
    doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
    doc.circle(105, 70, 5, 'F');

    // Ultra-premium title typography
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('INVESTMENT', 105, 110, { align: 'center' });
    doc.text('MEMORANDUM', 105, 125, { align: 'center' });

    // Company name with premium styling
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text(companyName, 105, 150, { align: 'center' });

    // Sophisticated decorative elements
    doc.setLineWidth(1);
    doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.line(60, 160, 150, 160);
    
    // Decorative corner elements
    doc.setLineWidth(0.5);
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    // Top left corner
    doc.line(margin, margin, margin + 15, margin);
    doc.line(margin, margin, margin, margin + 15);
    // Top right corner  
    doc.line(210 - margin - 15, margin, 210 - margin, margin);
    doc.line(210 - margin, margin, 210 - margin, margin + 15);
    // Bottom left corner
    doc.line(margin, 297 - margin - 15, margin, 297 - margin);
    doc.line(margin, 297 - margin, margin + 15, 297 - margin);
    // Bottom right corner
    doc.line(210 - margin, 297 - margin - 15, 210 - margin, 297 - margin);
    doc.line(210 - margin - 15, 297 - margin, 210 - margin, 297 - margin);

    // Professional metadata section
    doc.setFontSize(fonts.body);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    });
    
    // Date with elegant formatting
    doc.setFont('helvetica', 'bold');
    doc.text('PREPARED:', 105, 180, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(currentDate, 105, 190, { align: 'center' });

    // Confidentiality notice with premium styling
    doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
    doc.rect(30, 200, 150, 25, 'F');
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.rect(30, 200, 150, 25, 'S');
    
    doc.setFontSize(fonts.caption);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('CONFIDENTIAL & PROPRIETARY', 105, 210, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fonts.small);
    doc.text('This document contains confidential and proprietary information', 105, 218, { align: 'center' });

    // Ultra-professional footer with branding
    doc.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
    doc.rect(0, 260, 210, 37, 'F');
    doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
    doc.line(0, 260, 210, 260);
    
    doc.setFontSize(fonts.caption);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('PREPARED BY', 105, 272, { align: 'center' });
    
    doc.setFontSize(fonts.body);
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.text('Aescuvest Investment Intelligence Platform', 105, 282, { align: 'center' });
    
    doc.setFontSize(fonts.small);
    doc.setTextColor(colors.lightText[0], colors.lightText[1], colors.lightText[2]);
    doc.text('Advanced AI-Powered Investment Analysis & Due Diligence', 105, 290, { align: 'center' });
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
      .replace(/\*{4,}([^*]*)\*{2,}:\*{0,2}\s*/g, '$1: ') // Remove ****text:**** patterns
      .replace(/\*{4,}([^*]*?):\*{2}\s*/g, '$1: ') // Remove ****text:** patterns  
      .replace(/\*{4,}([^*]*)\*{4,}/g, '$1') // Remove ****text**** patterns
      .replace(/\*{3}([^*]+)\*{3}/g, '$1') // Remove triple asterisks (bold+italic)
      .replace(/\*{2}([^*]+)\*{2}/g, '$1') // Remove double asterisks (bold)
      .replace(/\*{1}([^*]+)\*{1}/g, '$1') // Remove single asterisks (italic)
      .replace(/\*{2,}/g, '') // Remove any remaining multiple asterisks
      .replace(/_{4,}([^_]*?):{1,2}\s*/g, '$1: ') // Remove ____text:__ patterns
      .replace(/_{3}([^_]+)_{3}/g, '$1') // Remove triple underscores
      .replace(/_{2}([^_]+)_{2}/g, '$1') // Remove double underscores (bold)
      .replace(/_{1}([^_]+)_{1}/g, '$1') // Remove single underscores (italic)
      .replace(/_{2,}/g, '') // Remove any remaining multiple underscores
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
    
    // First, aggressively clean all formatting patterns
    let cleanedText = text
      .replace(/\*{4,}([^*]*?)\*{2,}:\*{0,2}/g, '$1:') // ****text:**** -> text:
      .replace(/\*{4,}([^*]*?):\*{2}/g, '$1:') // ****text:** -> text:
      .replace(/\*{4,}([^*]*?)\*{4,}/g, '$1') // ****text**** -> text
      .replace(/\*{2,}([^*]*?)\*{2,}:\*{0,2}/g, '$1:') // **text:** -> text:
      .replace(/\*{2,}([^*]*?)\*{2,}/g, '$1') // **text** -> text
      .replace(/\*{2,}/g, '') // Remove standalone asterisks
      .replace(/_{4,}([^_]*?)_{2,}:\*{0,2}/g, '$1:') // ____text__: -> text:
      .replace(/_{2,}([^_]*?)_{2,}/g, '$1') // __text__ -> text
      .replace(/_{2,}/g, '') // Remove standalone underscores
      // Clean up list formatting patterns
      .replace(/\[\s*"/g, '\n• ') // [" -> bullet point
      .replace(/",\s*"/g, '\n• ') // ", " -> new bullet point  
      .replace(/"\s*\]/g, '') // "] -> remove
      .replace(/^\s*\[\s*/gm, '') // Remove opening brackets at line start
      .replace(/\s*\]\s*$/gm, '') // Remove closing brackets at line end
      .replace(/^"/gm, '') // Remove quotes at line start
      .replace(/"$/gm, '') // Remove quotes at line end
      .replace(/",$/gm, '') // Remove trailing quote-comma
      // Clean up JSON-like formatting
      .replace(/^\s*\{\s*$/gm, '') // Remove standalone opening braces
      .replace(/^\s*\}\s*$/gm, '') // Remove standalone closing braces
      .replace(/"\s*:\s*"/g, ': ') // "key": "value" -> key: value
      .replace(/^[\s]*"([^"]+)"\s*:\s*/gm, '**$1:** ') // "key": -> **key:**
      .replace(/^[\s]*([a-zA-Z]+)"\s*:\s*/gm, '**$1:** ') // key": -> **key:**
    
    // Split text into lines first, then process for better structure detection
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return [];
    
    let currentParagraph = '';
    
    lines.forEach((line, index) => {
      // Skip empty JSON artifacts
      if (line.match(/^\s*[\{\}]\s*$/) || line.trim() === '') {
        return;
      }
      
      // Enhanced bullet point detection with more patterns
      if (line.match(/^[\-\*•]\s+/) || 
          line.match(/^\d+\.\s+/) || 
          line.match(/^[a-zA-Z]\.\s+/) || 
          line.match(/^[ivxIVX]+\.\s+/) ||
          line.match(/^○\s+/) ||
          line.match(/^→\s+/) ||
          line.match(/^▪\s+/) ||
          line.match(/^‣\s+/) ||
          line.match(/^•\s+/) ||
          line.match(/^[\s]*"[^"]*"[,\s]*$/) || // Quoted list items: "text",
          line.match(/^\s*•\s*/) || // Clean bullet points from preprocessing
          line.match(/^\s*[A-Z][^"]*"[,\s]*$/) || // Items that start with capital and end with quote-comma
          line.match(/^\s*"[a-zA-Z]+"\s*:\s*/) || // JSON key patterns: "key":
          line.match(/^\s*[a-zA-Z]+"\s*:\s*/) // Partial JSON key patterns: key":
          ) {
        
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
          .replace(/^[\s]*"/, '') // Remove leading quotes
          .replace(/"[,\s]*$/, '') // Remove trailing quotes and commas
          .replace(/^\s*•\s*/, '') // Remove bullet symbols from preprocessing
          .replace(/^[\s]*"([^"]+)"\s*:\s*(.*)/, '**$1:** $2') // "key": value -> **key:** value
          .replace(/^[\s]*([a-zA-Z]+)"\s*:\s*(.*)/, '**$1:** $2') // key": value -> **key:** value
          .trim();
          
        // Special handling for key highlights (often start with action words or key phrases)
        if (bulletContent.match(/^(Key|Strong|Significant|Major|Critical|Important|Notable|Excellent|Outstanding|Proven)/i)) {
          result.push({ type: 'highlight', content: this.cleanText(bulletContent) });
        } else if (bulletContent) {
          result.push({ type: 'bullet', content: this.cleanText(bulletContent) });
        }
      }
      // Enhanced heading detection - including cleaned asterisk patterns
      else if (
        (line.match(/^[A-Z][A-Z\s\-:]+$/) && line.length < 80) || // ALL CAPS headings
        (line.match(/^\d+\.\s*[A-Z]/) && line.length < 100) || // Numbered sections
        (line.endsWith(':') && line.length < 100 && !line.includes(',') && !line.includes('.')) || // Colon endings
        (line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/) && line.length < 80 && !line.includes(',')) || // Title Case
        (line.match(/^\*{4,}.*?:/) || line.match(/^.*?:\*{2,}/)) || // Asterisk patterns like ****text:** or text:**
        (line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+:$/) && line.length < 100) // Clean title case with colon
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