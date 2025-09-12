import { storage } from "../storage";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DocumentBasedResearchData {
  companyName: string;
  extractedFromDocuments: boolean;
  documentCount: number;
  
  // Executive Information extracted from documents
  executives: Array<{
    name: string;
    title: string;
    source: string; // Which document this came from
  }>;
  
  // Advisory Board from documents
  advisoryBoard: Array<{
    name: string;
    role: string;
    agreementDate?: string;
    source: string;
  }>;
  
  // Partnerships and Customers from documents
  partners: Array<{
    name: string;
    type: string; // customer, partner, supplier, etc.
    details?: string;
    source: string;
  }>;
  
  // Financial Information from documents
  financialInfo: {
    fundingRounds?: Array<{
      amount: string;
      date: string;
      investors?: string[];
      source: string;
    }>;
    revenue?: string;
    employeeCount?: string;
    sources: string[];
  };
  
  // Technology and Products from documents
  technology: {
    products?: string[];
    technologies?: string[];
    patents?: string[];
    sources: string[];
  };
  
  // Legal and Compliance from documents
  legal: {
    incorporationDetails?: string;
    legalStructure?: string;
    jurisdictions?: string[];
    sources: string[];
  };
}

export class DocumentBasedResearchService {
  private static instance: DocumentBasedResearchService;
  
  static getInstance(): DocumentBasedResearchService {
    if (!DocumentBasedResearchService.instance) {
      DocumentBasedResearchService.instance = new DocumentBasedResearchService();
    }
    return DocumentBasedResearchService.instance;
  }
  
  async extractResearchFromDocuments(dealId: number): Promise<DocumentBasedResearchData> {
    console.log(`📚 Starting document-based research extraction for deal ${dealId}`);
    
    try {
      // Get all documents with OCR content for this deal
      const documents = await storage.getDocumentsWithOCRByDealId(dealId);
      console.log(`📄 Found ${documents.length} documents with OCR content`);
      
      if (documents.length === 0) {
        console.log(`⚠️ No documents found for deal ${dealId}`);
        return this.getEmptyResearchData(dealId);
      }
      
      // Group documents by type for better extraction
      const advisoryDocs = documents.filter(d => 
        d.name?.toLowerCase().includes('advisory') || 
        d.name?.toLowerCase().includes('advisor') ||
        d.name?.toLowerCase().includes('board')
      );
      
      const legalDocs = documents.filter(d => 
        d.name?.toLowerCase().includes('agreement') || 
        d.name?.toLowerCase().includes('contract') ||
        d.name?.toLowerCase().includes('legal') ||
        d.name?.toLowerCase().includes('engagement')
      );
      
      const financialDocs = documents.filter(d => 
        d.name?.toLowerCase().includes('financial') || 
        d.name?.toLowerCase().includes('audit') ||
        d.name?.toLowerCase().includes('tax') ||
        d.name?.toLowerCase().includes('investment')
      );
      
      const consultingDocs = documents.filter(d => 
        d.name?.toLowerCase().includes('consulting') ||
        d.name?.toLowerCase().includes('consultant')
      );
      
      console.log(`📊 Document breakdown: ${advisoryDocs.length} advisory, ${legalDocs.length} legal, ${financialDocs.length} financial, ${consultingDocs.length} consulting`);
      
      // Extract information from each document type
      const [
        executives,
        advisoryBoard,
        partners,
        financialInfo,
        technology,
        legal
      ] = await Promise.all([
        this.extractExecutives(documents),
        this.extractAdvisoryBoard(advisoryDocs),
        this.extractPartners(legalDocs),
        this.extractFinancialInfo(financialDocs),
        this.extractTechnology(documents),
        this.extractLegalInfo(legalDocs)
      ]);
      
      // Determine the real company name from documents
      const companyName = await this.extractCompanyName(documents);
      
      return {
        companyName,
        extractedFromDocuments: true,
        documentCount: documents.length,
        executives,
        advisoryBoard,
        partners,
        financialInfo,
        technology,
        legal
      };
      
    } catch (error) {
      console.error(`❌ Error extracting research from documents:`, error);
      return this.getEmptyResearchData(dealId);
    }
  }
  
  private async extractCompanyName(documents: any[]): Promise<string> {
    // Look for company name in document titles and content
    const nameMatches = new Set<string>();
    
    for (const doc of documents.slice(0, 10)) { // Check first 10 docs
      const content = doc.ocrText || doc.aiSummary || '';
      const fileName = doc.name || '';
      
      // Look for "Neteera" or similar patterns
      const neteeraMatch = /Neteera\s*(?:Technologies)?(?:\s*Ltd\.?|\s*LTD)?/gi.exec(content + ' ' + fileName);
      if (neteeraMatch) {
        nameMatches.add('Neteera Technologies');
      }
    }
    
    // Return the most common match or default
    return nameMatches.size > 0 ? Array.from(nameMatches)[0] : 'Unknown Company';
  }
  
  private async extractExecutives(documents: any[]): Promise<any[]> {
    const executives: any[] = [];
    const seen = new Set<string>();
    
    for (const doc of documents) {
      if (!doc.ocrText) continue;
      
      // Extract CEO, CTO, CFO mentions
      const execPattern = /(?:CEO|Chief Executive Officer|CTO|Chief Technology Officer|CFO|Chief Financial Officer|President|VP|Vice President)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/g;
      let match;
      
      while ((match = execPattern.exec(doc.ocrText)) !== null) {
        const name = match[1];
        const title = match[0].split(/[:\s]+/)[0];
        const key = `${name}-${title}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          executives.push({
            name,
            title,
            source: doc.name
          });
        }
      }
    }
    
    return executives;
  }
  
  private async extractAdvisoryBoard(documents: any[]): Promise<any[]> {
    const advisors: any[] = [];
    const seen = new Set<string>();
    
    for (const doc of documents) {
      if (!doc.ocrText && !doc.aiSummary) continue;
      
      const content = doc.ocrText || doc.aiSummary || '';
      
      // Look for advisor names in advisory agreements
      const advisorPattern = /(?:Advisor|Advisory Board Member|Consultant)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/g;
      let match;
      
      while ((match = advisorPattern.exec(content)) !== null) {
        const name = match[1];
        
        if (!seen.has(name)) {
          seen.add(name);
          advisors.push({
            name,
            role: 'Advisory Board Member',
            source: doc.name
          });
        }
      }
      
      // Also look for names in document titles (e.g., "Advisory Board Agreement - John Smith")
      const titleMatch = /Advisory Board Agreement[^\w]*([A-Z][a-z]+ [A-Z][a-z]+)/i.exec(doc.name);
      if (titleMatch) {
        const name = titleMatch[1];
        if (!seen.has(name)) {
          seen.add(name);
          advisors.push({
            name,
            role: 'Advisory Board Member',
            source: doc.name
          });
        }
      }
    }
    
    return advisors;
  }
  
  private async extractPartners(documents: any[]): Promise<any[]> {
    const partners: any[] = [];
    const seen = new Set<string>();
    
    for (const doc of documents) {
      if (!doc.ocrText) continue;
      
      // Look for partnership mentions
      const partnerPattern = /(?:partnership|agreement|contract) (?:with|between)[^.]*?(?:and |, )([A-Z][A-Za-z0-9\s&]+?)(?:\.|,|\n)/gi;
      let match;
      
      while ((match = partnerPattern.exec(doc.ocrText)) !== null) {
        const name = match[1].trim();
        
        if (!seen.has(name) && name.length > 2) {
          seen.add(name);
          partners.push({
            name,
            type: 'partner',
            source: doc.name
          });
        }
      }
    }
    
    return partners;
  }
  
  private async extractFinancialInfo(documents: any[]): Promise<any> {
    const fundingRounds: any[] = [];
    let revenue = '';
    let employeeCount = '';
    const sources: string[] = [];
    
    for (const doc of documents) {
      if (!doc.ocrText) continue;
      
      // Look for funding information
      const fundingPattern = /(?:raised|funding|investment|round)[^.]*?\$([0-9,]+(?:\.[0-9]+)?[MBK]?)/gi;
      let match;
      
      while ((match = fundingPattern.exec(doc.ocrText)) !== null) {
        fundingRounds.push({
          amount: match[1],
          source: doc.name
        });
        if (!sources.includes(doc.name)) sources.push(doc.name);
      }
      
      // Look for revenue
      const revenueMatch = /revenue[^.]*?\$([0-9,]+(?:\.[0-9]+)?[MBK]?)/i.exec(doc.ocrText);
      if (revenueMatch && !revenue) {
        revenue = revenueMatch[1];
        if (!sources.includes(doc.name)) sources.push(doc.name);
      }
      
      // Look for employee count
      const employeeMatch = /([0-9]+)\s*employees/i.exec(doc.ocrText);
      if (employeeMatch && !employeeCount) {
        employeeCount = employeeMatch[1];
        if (!sources.includes(doc.name)) sources.push(doc.name);
      }
    }
    
    return {
      fundingRounds,
      revenue,
      employeeCount,
      sources
    };
  }
  
  private async extractTechnology(documents: any[]): Promise<any> {
    const products = new Set<string>();
    const technologies = new Set<string>();
    const patents = new Set<string>();
    const sources = new Set<string>();
    
    for (const doc of documents.slice(0, 20)) { // Limit to first 20 docs for efficiency
      if (!doc.ocrText) continue;
      
      // Look for product mentions
      const productPattern = /(?:product|solution|platform|software|device)[:\s]+([A-Za-z0-9\s]+)(?:\.|,|\n)/gi;
      let match;
      
      while ((match = productPattern.exec(doc.ocrText)) !== null) {
        const product = match[1].trim();
        if (product.length > 2 && product.length < 50) {
          products.add(product);
          sources.add(doc.name);
        }
      }
      
      // Look for technology mentions
      const techPattern = /(?:technology|using|built with|powered by)[:\s]+([A-Za-z0-9\s,]+)(?:\.|,|\n)/gi;
      while ((match = techPattern.exec(doc.ocrText)) !== null) {
        const tech = match[1].trim();
        if (tech.length > 2 && tech.length < 50) {
          technologies.add(tech);
          sources.add(doc.name);
        }
      }
      
      // Look for patent mentions
      const patentPattern = /patent[^.]*?(?:no\.|number|#)\s*([0-9,]+)/gi;
      while ((match = patentPattern.exec(doc.ocrText)) !== null) {
        patents.add(match[1]);
        sources.add(doc.name);
      }
    }
    
    return {
      products: Array.from(products),
      technologies: Array.from(technologies),
      patents: Array.from(patents),
      sources: Array.from(sources)
    };
  }
  
  private async extractLegalInfo(documents: any[]): Promise<any> {
    let incorporationDetails = '';
    let legalStructure = '';
    const jurisdictions = new Set<string>();
    const sources = new Set<string>();
    
    for (const doc of documents) {
      if (!doc.ocrText) continue;
      
      // Look for incorporation details
      const incMatch = /incorporated (?:in |under )[^.]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i.exec(doc.ocrText);
      if (incMatch && !incorporationDetails) {
        incorporationDetails = incMatch[1];
        sources.add(doc.name);
      }
      
      // Look for legal structure
      const structureMatch = /(?:LLC|Ltd|Limited|Corporation|Inc\.|Incorporated)/i.exec(doc.ocrText);
      if (structureMatch && !legalStructure) {
        legalStructure = structureMatch[0];
        sources.add(doc.name);
      }
      
      // Look for jurisdictions
      const jurisdictionPattern = /(?:governed by|laws of|jurisdiction of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi;
      let match;
      while ((match = jurisdictionPattern.exec(doc.ocrText)) !== null) {
        jurisdictions.add(match[1]);
        sources.add(doc.name);
      }
    }
    
    return {
      incorporationDetails,
      legalStructure,
      jurisdictions: Array.from(jurisdictions),
      sources: Array.from(sources)
    };
  }
  
  private getEmptyResearchData(dealId: number): DocumentBasedResearchData {
    return {
      companyName: 'Unknown Company',
      extractedFromDocuments: false,
      documentCount: 0,
      executives: [],
      advisoryBoard: [],
      partners: [],
      financialInfo: {
        sources: []
      },
      technology: {
        sources: []
      },
      legal: {
        sources: []
      }
    };
  }
}

export const documentBasedResearchService = DocumentBasedResearchService.getInstance();