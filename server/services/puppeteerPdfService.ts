import puppeteer from 'puppeteer';
import { StructuredMemo } from './claudePdfSynthesisService';
import { generatePremiumMemoHTML } from '../templates/premiumMemoTemplate';

export class PuppeteerPdfService {
  async generatePDF(memo: StructuredMemo): Promise<Buffer> {
    console.log('🖨️ Puppeteer PDF Service: Starting premium PDF generation...');
    
    const html = generatePremiumMemoHTML(memo);
    console.log(`📄 Generated HTML template: ${html.length} characters`);

    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--font-render-hinting=none'
        ]
      });

      const page = await browser.newPage();
      
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      await page.evaluateHandle('document.fonts.ready');

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width: 100%; font-size: 8px; font-family: Arial, sans-serif; padding: 0 40px; display: flex; justify-content: space-between; color: #495057;">
            <span style="font-weight: bold; color: #1a233a;">AESCUVEST INVESTMENT INTELLIGENCE</span>
            <span>Investment Memorandum</span>
          </div>
        `,
        footerTemplate: `
          <div style="width: 100%; font-size: 8px; font-family: Arial, sans-serif; padding: 0 40px; display: flex; justify-content: space-between; color: #495057;">
            <span>CONFIDENTIAL & PROPRIETARY</span>
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
        margin: {
          top: '25mm',
          bottom: '25mm',
          left: '20mm',
          right: '20mm'
        }
      });

      console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);
      
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('❌ Puppeteer PDF generation failed:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  async generatePDFFromHTML(html: string): Promise<Buffer> {
    console.log('🖨️ Puppeteer PDF Service: Generating PDF from raw HTML...');

    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '20mm',
          right: '20mm'
        }
      });

      console.log(`✅ PDF from HTML generated: ${pdfBuffer.length} bytes`);
      
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('❌ Puppeteer HTML to PDF failed:', error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

export const puppeteerPdfService = new PuppeteerPdfService();
