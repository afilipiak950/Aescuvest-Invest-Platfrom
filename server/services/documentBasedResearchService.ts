import { storage } from "../storage";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface DocumentBasedResearchData {
  companyName: string;
  extractedFromDocuments: boolean;
  documentCount: number;
  confidenceScore: number; // NEW: Overall confidence in extracted data
  
  // Executive Information extracted from documents
  executives: Array<{
    name: string;
    title: string;
    source: string; // Which document this came from
    confidence: 'extracted' | 'estimated'; // NEW: Track if data is extracted or estimated
  }>;
  
  // Advisory Board from documents
  advisoryBoard: Array<{
    name: string;
    role: string;
    agreementDate?: string;
    source: string;
    confidence: 'extracted' | 'estimated'; // NEW: Track if data is extracted or estimated
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
    console.log(`🔍 CRITICAL DEBUG: Extracting research from documents for deal ${dealId}`);
    
    try {
      // Get deal information to know the expected company name
      const deal = await storage.getDealById(dealId);
      const dealCompanyName = deal?.companyName || '';
      console.log(`🔍 CRITICAL DEBUG: Deal company name: "${dealCompanyName}"`);
      
      // Get all documents with OCR content for this deal
      const documents = await storage.getDocumentsWithOCRByDealId(dealId);
      console.log(`📄 Found ${documents.length} documents with OCR content`);
      console.log(`🔍 CRITICAL DEBUG: Document count for deal ${dealId}: ${documents.length}`);
      
      if (documents.length > 0) {
        console.log(`🔍 CRITICAL DEBUG: First 3 document names:`, documents.slice(0, 3).map(d => d.name));
        console.log(`🔍 CRITICAL DEBUG: First document has OCR text:`, documents[0].ocrText ? 'YES' : 'NO');
        console.log(`🔍 CRITICAL DEBUG: First document OCR length:`, documents[0].ocrText?.length || 0);
      }
      
      if (documents.length === 0) {
        console.log(`⚠️ No documents found for deal ${dealId}`);
        console.log(`🔍 CRITICAL DEBUG: Returning empty research data for deal ${dealId}`);
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
      console.log(`🔍 CRITICAL DEBUG: Starting extraction of executives, advisors, partners, etc.`);
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
      
      console.log(`🔍 CRITICAL DEBUG: Extracted executives:`, executives.length);
      console.log(`🔍 CRITICAL DEBUG: Extracted advisory board:`, advisoryBoard.length);
      console.log(`🔍 CRITICAL DEBUG: Extracted partners:`, partners.length);
      console.log(`🔍 CRITICAL DEBUG: Financial info found:`, !!financialInfo.revenue || !!financialInfo.fundingRounds?.length);
      
      // Determine the real company name from documents
      const companyName = await this.extractCompanyName(documents, dealCompanyName);
      console.log(`🔍 CRITICAL DEBUG: Final extracted company name: "${companyName}"`);
      
      // Calculate confidence score based on extracted data
      const confidenceScore = this.calculateConfidenceScore({
        executives,
        advisoryBoard,
        partners,
        financialInfo,
        documentCount: documents.length
      });
      
      return {
        companyName,
        extractedFromDocuments: true,
        documentCount: documents.length,
        confidenceScore,
        executives,
        advisoryBoard,
        partners,
        financialInfo,
        technology,
        legal
      };
      
    } catch (error) {
      console.error(`❌ Error extracting research from documents:`, error);
      console.log(`🔍 CRITICAL DEBUG: Document extraction failed for deal ${dealId}, returning empty data`);
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
        // Standard company name patterns with expanded suffixes
        /([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+(?:Ltd\.?|Limited|Inc\.?|Incorporated|LLC|LLP|Corp(?:oration)?|Company|Co\.?|Technologies|Tech|Systems|Solutions|Services|Group|Holdings|Ventures|Capital|Partners|Medical|Health|Bio|Pharma))(?=\s|,|\.|\)|"|'|$)/gi,
        
        // Context-based patterns
        /(?:between\s+|by\s+|from\s+|to\s+|of\s+)([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+(?:Ltd\.?|Limited|Inc\.?|LLC|Corp\.?))(?=\s+and|\s+\(|,|\.)/gi,
        
        // Start of line patterns
        /^([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+(?:Ltd\.?|Limited|Inc\.?|LLC|Corp\.?|Technologies))/gm,
        
        // Quoted company names
        /["']([A-Z][A-Za-z0-9\s&\-\.]+(?:Ltd\.?|Limited|Inc\.?|LLC|Corp\.?|Technologies)?)["']/gi,
        
        // Company registration patterns
        /(?:incorporated as|registered as|doing business as|d\/b\/a)\s+([A-Z][A-Za-z0-9\s&\-\.]+)/gi
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
        /(?:hereby\s+engages?|agrees?\s+to\s+engage)\s+([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+to|\s+for|,|\.)/gi,
        
        // Additional patterns for company identification
        /(?:Employer|Party|Vendor|Supplier):\s*([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\n|,|\.|\s{2,})/gi,
        /(?:on behalf of)\s+([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+\(|,|\.)/gi,
        /(?:WHEREAS,?\s+)([A-Z][A-Za-z0-9\s&\-\.]+?)(?:\s+is|\s+has|\s+desires)/gi
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
    
    for (const [name, frequency] of Array.from(nameFrequency.entries())) {
      // Prefer names that appear in multiple documents
      if (frequency > maxFrequency && frequency >= 2) {
        maxFrequency = frequency;
        mostFrequentName = name;
      }
    }
    
    // If we found a name through context that appears multiple times, prefer it
    for (const contextName of Array.from(contextMatches)) {
      const freq = nameFrequency.get(contextName) || 0;
      if (freq >= 3 && freq >= maxFrequency * 0.8) {
        mostFrequentName = contextName;
        break;
      }
    }
    
    if (mostFrequentName) {
      console.log(`🔍 Extracted company name from documents: ${mostFrequentName} (appeared ${maxFrequency} times)`);
      
      // Try to find the full company name with suffix
      for (const [fullName] of Array.from(nameFrequency.entries())) {
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
      if (!doc.ocrText && !doc.aiSummary) continue;
      
      const content = doc.ocrText || doc.aiSummary || '';
      
      // Multiple patterns to catch different variations of executive mentions
      const executivePatterns = [
        // Pattern 1: Title followed by colon/dash and name
        /(?:CEO|Chief Executive Officer|CTO|Chief Technology Officer|CFO|Chief Financial Officer|COO|Chief Operating Officer|President|VP|Vice President|Director|Founder|Co-Founder)[:\s\-–]+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/gi,
        
        // Pattern 2: Name followed by comma and title
        /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})\s*,\s*(?:CEO|Chief Executive Officer|CTO|Chief Technology Officer|CFO|Chief Financial Officer|COO|Chief Operating Officer|President|Founder|Co-Founder)/gi,
        
        // Pattern 3: Name followed by title in parentheses
        /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})\s*\((?:CEO|Chief Executive Officer|CTO|Chief Technology Officer|CFO|Chief Financial Officer|COO|President|Founder)\)/gi,
        
        // Pattern 4: "led by" or "founded by" pattern
        /(?:led by|founded by|headed by|managed by|run by)\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/gi,
        
        // Pattern 5: Specific pattern for "Name is the CEO/CTO/etc"
        /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})\s+(?:is|serves as|acts as)\s+(?:the\s+)?(?:CEO|Chief Executive Officer|CTO|Chief Technology Officer|CFO|President|Founder)/gi,
        
        // Pattern 6: Table or list format "CEO: Name" or "CEO Name"
        /CEO[:\s]+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})(?:\s|$|,|\.|;)/gi,
        /CTO[:\s]+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})(?:\s|$|,|\.|;)/gi,
        /CFO[:\s]+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})(?:\s|$|,|\.|;)/gi,
        /President[:\s]+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})(?:\s|$|,|\.|;)/gi
      ];
      
      const titleMap: { [key: string]: string } = {
        'ceo': 'CEO',
        'chief executive officer': 'CEO',
        'cto': 'CTO',
        'chief technology officer': 'CTO',
        'cfo': 'CFO',
        'chief financial officer': 'CFO',
        'coo': 'COO',
        'chief operating officer': 'COO',
        'president': 'President',
        'vp': 'VP',
        'vice president': 'VP',
        'director': 'Director',
        'founder': 'Founder',
        'co-founder': 'Co-Founder'
      };
      
      for (const pattern of executivePatterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex state
        
        while ((match = pattern.exec(content)) !== null) {
          let name = match[1]?.trim();
          if (!name) continue;
          
          // Clean up the name
          name = name.replace(/\s+/g, ' ').trim();
          
          // Skip if name is too short or too long
          if (name.length < 5 || name.length > 50) continue;
          
          // Skip common false positives
          const blacklist = ['The Company', 'Company', 'Client', 'Customer', 'Vendor', 'Board', 'Executive', 'Officer', 'Management'];
          if (blacklist.some(word => name.toLowerCase().includes(word.toLowerCase()))) continue;
          
          // Try to extract the title from the match
          let title = 'Executive';
          const fullMatch = match[0].toLowerCase();
          
          for (const [key, value] of Object.entries(titleMap)) {
            if (fullMatch.includes(key)) {
              title = value;
              break;
            }
          }
          
          const key = `${name}-${title}`;
          
          if (!seen.has(key)) {
            seen.add(key);
            executives.push({
              name,
              title,
              source: doc.name,
              confidence: 'extracted'
            });
            console.log(`✅ Extracted executive: ${name} - ${title} from ${doc.name}`);
          }
        }
      }
      
      // Additional pattern specifically for document names containing executive info
      if (doc.name) {
        const namePatterns = [
          /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3}).*CEO/i,
          /CEO.*([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/i
        ];
        
        for (const pattern of namePatterns) {
          const match = pattern.exec(doc.name);
          if (match) {
            const name = match[1]?.trim();
            if (name && name.length > 5 && name.length < 50) {
              const key = `${name}-CEO`;
              if (!seen.has(key)) {
                seen.add(key);
                executives.push({
                  name,
                  title: 'CEO',
                  source: doc.name,
                  confidence: 'extracted'
                });
                console.log(`✅ Extracted CEO from filename: ${name} from ${doc.name}`);
              }
            }
          }
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
      
      // Multiple patterns for advisory board members
      const advisorPatterns = [
        // Pattern 1: Title followed by name
        /(?:Advisor|Advisory Board Member|Board Member|Consultant|Independent Director)[:\s\-–]+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/gi,
        
        // Pattern 2: Name followed by advisor title
        /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})\s*,\s*(?:Advisor|Advisory Board Member|Board Member|Independent Director)/gi,
        
        // Pattern 3: Advisory Board list
        /Advisory Board[:\s]*(?:[\s\S]{0,50}?)([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/gi,
        
        // Pattern 4: Board of Directors/Advisors
        /Board of (?:Directors|Advisors)[:\s]*(?:[\s\S]{0,50}?)([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/gi,
        
        // Pattern 5: Agreement patterns
        /Advisory Agreement with ([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/gi,
        /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3}) Advisory Agreement/gi
      ];
      
      for (const pattern of advisorPatterns) {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(content)) !== null) {
          const name = match[1]?.trim();
          if (!name || name.length < 5 || name.length > 50) continue;
          
          // Skip common false positives
          const blacklist = ['The Company', 'Company', 'Board', 'Advisory', 'Agreement', 'Contract'];
          if (blacklist.some(word => name.toLowerCase() === word.toLowerCase())) continue;
          
          if (!seen.has(name)) {
            seen.add(name);
            advisors.push({
              name,
              role: 'Advisory Board Member',
              source: doc.name,
              confidence: 'extracted'
            });
            console.log(`✅ Extracted advisor: ${name} from ${doc.name}`);
          }
        }
      }
      
      // Check document names for advisor information
      if (doc.name) {
        const namePatterns = [
          /Advisory Board Agreement[^\w]*([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/i,
          /([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})[^\w]*Advisory/i,
          /Advisory[^\w]*([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){1,3})/i
        ];
        
        for (const pattern of namePatterns) {
          const match = pattern.exec(doc.name);
          if (match) {
            const name = match[1]?.trim();
            if (name && name.length > 5 && name.length < 50 && !seen.has(name)) {
              seen.add(name);
              advisors.push({
                name,
                role: 'Advisory Board Member',
                source: doc.name,
                confidence: 'extracted'
              });
              console.log(`✅ Extracted advisor from filename: ${name}`);
            }
          }
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
    let valuation = '';
    const sources: string[] = [];
    const seenFunding = new Set<string>();
    
    for (const doc of documents) {
      if (!doc.ocrText && !doc.aiSummary) continue;
      
      const content = doc.ocrText || doc.aiSummary || '';
      
      // Enhanced funding patterns
      const fundingPatterns = [
        /(?:raised|secured|closed|completed|announced)[^.]{0,50}?\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B|thousand|K)?)/gi,
        /\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B|thousand|K)?)\s*(?:funding|investment|round|raised)/gi,
        /(?:Series\s+[A-Z]|Seed|Pre-seed)[^.]{0,50}?\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi,
        /funding\s+of\s+\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi,
        /investment\s+of\s+\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi
      ];
      
      for (const pattern of fundingPatterns) {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(content)) !== null) {
          const amount = this.normalizeAmount(match[1]);
          const fundingKey = `${amount}-${doc.name}`;
          
          if (!seenFunding.has(fundingKey)) {
            seenFunding.add(fundingKey);
            fundingRounds.push({
              amount,
              source: doc.name,
              date: this.extractDateNearMatch(content, match.index) || ''
            });
            if (!sources.includes(doc.name)) sources.push(doc.name);
            console.log(`💰 Extracted funding: ${amount} from ${doc.name}`);
          }
        }
      }
      
      // Enhanced revenue patterns
      const revenuePatterns = [
        /revenue[^.]{0,50}?\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi,
        /\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)\s*(?:in\s+)?revenue/gi,
        /annual\s+revenue[^.]{0,50}?\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi,
        /sales\s+of\s+\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi
      ];
      
      for (const pattern of revenuePatterns) {
        const match = pattern.exec(content);
        if (match && !revenue) {
          revenue = this.normalizeAmount(match[1]);
          if (!sources.includes(doc.name)) sources.push(doc.name);
          console.log(`💵 Extracted revenue: ${revenue} from ${doc.name}`);
          break;
        }
      }
      
      // Enhanced valuation patterns
      const valuationPatterns = [
        /valued\s+at\s+\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi,
        /valuation\s+of\s+\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi,
        /\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)\s+valuation/gi,
        /worth\s+\$([0-9,]+(?:\.[0-9]+)?\s*(?:million|Million|M|billion|Billion|B)?)/gi
      ];
      
      for (const pattern of valuationPatterns) {
        const match = pattern.exec(content);
        if (match && !valuation) {
          valuation = this.normalizeAmount(match[1]);
          if (!sources.includes(doc.name)) sources.push(doc.name);
          console.log(`💎 Extracted valuation: ${valuation} from ${doc.name}`);
          break;
        }
      }
      
      // Enhanced employee count patterns
      const employeePatterns = [
        /([0-9,]+)\s*(?:employees|staff|people|team members)/i,
        /team\s+of\s+([0-9,]+)/i,
        /([0-9,]+)[\s\-]*person\s+(?:team|company)/i,
        /workforce\s+of\s+([0-9,]+)/i,
        /headcount[:\s]+([0-9,]+)/i
      ];
      
      for (const pattern of employeePatterns) {
        const match = pattern.exec(content);
        if (match && !employeeCount) {
          const count = match[1].replace(/,/g, '');
          // Only accept reasonable employee counts
          if (parseInt(count) > 0 && parseInt(count) < 1000000) {
            employeeCount = count;
            if (!sources.includes(doc.name)) sources.push(doc.name);
            console.log(`👥 Extracted employee count: ${employeeCount} from ${doc.name}`);
            break;
          }
        }
      }
    }
    
    return {
      fundingRounds,
      revenue,
      employeeCount,
      valuation,
      sources
    };
  }
  
  private normalizeAmount(amount: string): string {
    // Normalize financial amounts to consistent format
    let normalized = amount.trim();
    
    // Convert M/Million to million, B/Billion to billion, K to thousand
    normalized = normalized.replace(/\s*M$/i, ' million');
    normalized = normalized.replace(/\s*B$/i, ' billion');
    normalized = normalized.replace(/\s*K$/i, ' thousand');
    
    // Ensure consistent capitalization
    normalized = normalized.replace(/million/i, 'million');
    normalized = normalized.replace(/billion/i, 'billion');
    normalized = normalized.replace(/thousand/i, 'thousand');
    
    return '$' + normalized.replace(/^\$/, '');
  }
  
  private extractDateNearMatch(content: string, matchIndex: number): string | null {
    // Try to find a date near the funding mention
    const windowSize = 100;
    const start = Math.max(0, matchIndex - windowSize);
    const end = Math.min(content.length, matchIndex + windowSize);
    const nearbyText = content.substring(start, end);
    
    const datePatterns = [
      /(\d{4})/,  // Year only
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i,  // Month Year
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,  // MM/DD/YYYY
      /(Q[1-4]\s+\d{4})/i  // Quarter Year
    ];
    
    for (const pattern of datePatterns) {
      const match = pattern.exec(nearbyText);
      if (match) {
        return match[0];
      }
    }
    
    return null;
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
  
  private calculateConfidenceScore(data: any): number {
    let score = 0;
    let maxScore = 0;
    
    // Score based on executives found
    maxScore += 30;
    if (data.executives && data.executives.length > 0) {
      score += Math.min(30, data.executives.length * 10);
    }
    
    // Score based on advisory board
    maxScore += 20;
    if (data.advisoryBoard && data.advisoryBoard.length > 0) {
      score += Math.min(20, data.advisoryBoard.length * 5);
    }
    
    // Score based on partners
    maxScore += 20;
    if (data.partners && data.partners.length > 0) {
      score += Math.min(20, data.partners.length * 4);
    }
    
    // Score based on financial info
    maxScore += 20;
    if (data.financialInfo) {
      if (data.financialInfo.revenue) score += 5;
      if (data.financialInfo.fundingRounds?.length > 0) score += 10;
      if (data.financialInfo.employeeCount) score += 5;
    }
    
    // Score based on document count
    maxScore += 10;
    if (data.documentCount > 0) {
      score += Math.min(10, data.documentCount);
    }
    
    return Math.round((score / maxScore) * 100);
  }
  
  private getEmptyResearchData(dealId: number): DocumentBasedResearchData {
    return {
      companyName: 'Unknown Company',
      extractedFromDocuments: false,
      documentCount: 0,
      confidenceScore: 0,
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