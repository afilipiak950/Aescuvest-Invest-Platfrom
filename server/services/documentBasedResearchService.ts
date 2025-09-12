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
      // Get deal information to know the expected company name
      const deal = await storage.getDealById(dealId);
      const dealCompanyName = deal?.companyName || '';
      
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
      const companyName = await this.extractCompanyName(documents, dealCompanyName);
      
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
  
  private async extractCompanyName(documents: any[], dealCompanyName: string): Promise<string> {
    // If we have a deal company name, verify it appears in documents
    if (dealCompanyName && dealCompanyName !== 'Unknown Company') {
      // Check if the deal company name appears in documents
      const dealNamePattern = new RegExp(dealCompanyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      
      for (const doc of documents.slice(0, 5)) { // Check first 5 docs for efficiency
        const content = doc.ocrText || doc.aiSummary || '';
        const fileName = doc.name || '';
        
        if (dealNamePattern.test(content + ' ' + fileName)) {
          console.log(`✅ Confirmed company name from deal: ${dealCompanyName}`);
          return dealCompanyName;
        }
      }
    }
    
    // If deal name not found or not provided, extract from documents
    const nameFrequency = new Map<string, number>();
    const contextMatches = new Set<string>();
    
    for (const doc of documents.slice(0, 20)) { // Check first 20 docs
      const content = doc.ocrText || doc.aiSummary || '';
      const fileName = doc.name || '';
      const combinedText = content + ' ' + fileName;
      
      // Strategy 1: Look for company patterns with legal suffixes
      const companyPatterns = [
        /([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+(?:Ltd\.?|Limited|Inc\.?|Incorporated|LLC|LLP|Corp(?:oration)?|Company|Co\.?|Technologies|Tech|Systems|Solutions|Services|Group|Holdings|Ventures|Capital|Partners))(?=\s|,|\.|\)|"|'|$)/gi,
        /(?:between\s+|by\s+|from\s+|to\s+|of\s+)([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+(?:Ltd\.?|Limited|Inc\.?|LLC|Corp\.?))(?=\s+and|\s+\(|,|\.)/gi,
        /^([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+(?:Ltd\.?|Limited|Inc\.?|LLC|Corp\.?|Technologies))/gm
      ];
      
      for (const pattern of companyPatterns) {
        let match;
        while ((match = pattern.exec(combinedText)) !== null) {
          const companyName = match[1].trim();
          
          // Filter out common false positives
          const blacklist = ['The', 'This', 'That', 'These', 'Those', 'Agreement', 'Contract', 
                            'Document', 'Party', 'Company', 'Client', 'Customer', 'Vendor', 
                            'Supplier', 'Board', 'Advisory', 'Exhibit', 'Schedule', 'Appendix'];
          
          if (!blacklist.includes(companyName) && 
              companyName.length > 2 && 
              companyName.length < 50 &&
              /[A-Z]/.test(companyName[0])) {
            
            // Track frequency
            const normalizedName = companyName.replace(/\s+/g, ' ');
            nameFrequency.set(normalizedName, (nameFrequency.get(normalizedName) || 0) + 1);
          }
        }
      }
      
      // Strategy 2: Look for repeated capitalized phrases (likely company names)
      const capitalizedPhrases = combinedText.match(/[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3}/g) || [];
      for (const phrase of capitalizedPhrases) {
        if (phrase.length > 5 && phrase.length < 50) {
          nameFrequency.set(phrase, (nameFrequency.get(phrase) || 0) + 1);
        }
      }
      
      // Strategy 3: Context-based extraction from agreements
      const contextPatterns = [
        /(?:Agreement\s+between|Contract\s+with|Engagement\s+of|Services\s+by)\s+([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+and|\s+\(|,|\.)/gi,
        /(?:Client|Customer|Company):\s*([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\n|,|\.|\s{2,})/gi,
        /(?:hereby\s+engages?|agrees?\s+to\s+engage)\s+([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+to|\s+for|,|\.)/gi
      ];
      
      for (const pattern of contextPatterns) {
        let match;
        while ((match = pattern.exec(combinedText)) !== null) {
          const companyName = match[1].trim();
          if (companyName.length > 2 && companyName.length < 50) {
            contextMatches.add(companyName);
            nameFrequency.set(companyName, (nameFrequency.get(companyName) || 0) + 2); // Higher weight for context matches
          }
        }
      }
    }
    
    // Find the most frequent company name
    let mostFrequentName = '';
    let maxFrequency = 0;
    
    for (const [name, frequency] of nameFrequency.entries()) {
      // Prefer names that appear in multiple documents
      if (frequency > maxFrequency && frequency >= 2) {
        maxFrequency = frequency;
        mostFrequentName = name;
      }
    }
    
    // If we found a name through context that appears multiple times, prefer it
    for (const contextName of contextMatches) {
      const freq = nameFrequency.get(contextName) || 0;
      if (freq >= 3 && freq >= maxFrequency * 0.8) {
        mostFrequentName = contextName;
        break;
      }
    }
    
    if (mostFrequentName) {
      console.log(`🔍 Extracted company name from documents: ${mostFrequentName} (appeared ${maxFrequency} times)`);
      
      // Try to find the full company name with suffix
      for (const [fullName] of nameFrequency.entries()) {
        if (fullName.startsWith(mostFrequentName) && fullName.length > mostFrequentName.length) {
          if (/(?:Ltd\.?|Limited|Inc\.?|LLC|Corp|Technologies|Tech|Systems|Solutions|Services)$/i.test(fullName)) {
            console.log(`🔍 Found full company name: ${fullName}`);
            return fullName;
          }
        }
      }
      
      return mostFrequentName;
    }
    
    // Fallback: Use deal company name if provided, otherwise Unknown
    return dealCompanyName || 'Unknown Company';
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