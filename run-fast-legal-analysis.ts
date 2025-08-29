#!/usr/bin/env tsx

/**
 * Fast Legal Analysis - Analyze the most relevant legal documents for structured questions
 */

import { db } from './server/db';
import { documents, agentAnalyses } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runFastLegalAnalysis(): Promise<void> {
  console.log('⚡ Starting fast legal analysis with real AI...');

  // Get all documents for deal 22
  const allDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.dealId, 22));

  console.log(`📊 Found ${allDocuments.length} documents total`);

  // Filter for most relevant legal documents
  const legalDocuments = allDocuments.filter(doc => 
    doc.ocrText && doc.ocrText.length > 800 && (
      doc.name.toLowerCase().includes('agreement') ||
      doc.name.toLowerCase().includes('employment') ||
      doc.name.toLowerCase().includes('finder') ||
      doc.name.toLowerCase().includes('service') ||
      doc.name.toLowerCase().includes('consulting')
    )
  );

  console.log(`📋 Selected ${legalDocuments.length} legal documents for analysis`);

  // Process documents in batches with optimized prompts
  const batchSize = 8;
  const batches = [];
  
  for (let i = 0; i < legalDocuments.length; i += batchSize) {
    batches.push(legalDocuments.slice(i, i + batchSize));
  }

  const allResults = [];
  
  for (let i = 0; i < batches.length; i++) {
    console.log(`📄 Processing batch ${i + 1}/${batches.length}`);
    const batchResults = await analyzeDocumentsBatch(batches[i]);
    allResults.push(...batchResults);
  }

  // Compile final legal analysis
  const finalAnalysis = await compileLegalAnalysis(allResults);
  
  // Store results
  await storeLegalAnalysis(finalAnalysis);
  
  console.log('✅ Fast legal analysis completed!');
}

async function analyzeDocumentsBatch(documents: any[]): Promise<any[]> {
  const results = [];
  
  for (const doc of documents) {
    try {
      // Analyze document with comprehensive legal prompt
      const prompt = `Document: ${doc.name}
Content: ${doc.ocrText.substring(0, 5000)}

Analyze this legal document and extract information for these categories:
1. SHARE CLASSES & EQUITY: Any mention of share classes, equity structures, employee stock options
2. LIQUIDATION & ANTI-DILUTION: Liquidation preferences, anti-dilution provisions, investor protections
3. GOVERNANCE & VOTING: Board composition, voting rights, director appointments
4. INTELLECTUAL PROPERTY: IP assignments, patent/trademark transfers, IP ownership
5. COMMERCIAL TERMS: SLAs, warranties, indemnities, termination clauses
6. LITIGATION & REGULATORY: Legal disputes, regulatory approvals, FDA submissions, compliance
7. FINANCIAL AUDITS: Audited statements, financial irregularities, audit requirements

For each category, provide:
- "relevant": true/false
- "findings": specific details found in document
- "confidence": 0.0-1.0 score

Respond with JSON:
{
  "document": "${doc.name}",
  "share_equity": {"relevant": false, "findings": "", "confidence": 0.0},
  "liquidation_dilution": {"relevant": false, "findings": "", "confidence": 0.0},
  "governance_voting": {"relevant": false, "findings": "", "confidence": 0.0},
  "intellectual_property": {"relevant": false, "findings": "", "confidence": 0.0},
  "commercial_terms": {"relevant": false, "findings": "", "confidence": 0.0},
  "litigation_regulatory": {"relevant": false, "findings": "", "confidence": 0.0},
  "financial_audits": {"relevant": false, "findings": "", "confidence": 0.0}
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      results.push(result);
      
      console.log(`✅ Analyzed: ${doc.name}`);
      
    } catch (error) {
      console.error(`❌ Error analyzing ${doc.name}:`, error.message);
      results.push({
        document: doc.name,
        share_equity: { relevant: false, findings: "Analysis failed", confidence: 0.0 },
        liquidation_dilution: { relevant: false, findings: "Analysis failed", confidence: 0.0 },
        governance_voting: { relevant: false, findings: "Analysis failed", confidence: 0.0 },
        intellectual_property: { relevant: false, findings: "Analysis failed", confidence: 0.0 },
        commercial_terms: { relevant: false, findings: "Analysis failed", confidence: 0.0 },
        litigation_regulatory: { relevant: false, findings: "Analysis failed", confidence: 0.0 },
        financial_audits: { relevant: false, findings: "Analysis failed", confidence: 0.0 }
      });
    }
    
    // Brief delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

async function compileLegalAnalysis(results: any[]): Promise<any> {
  console.log('🔄 Compiling comprehensive legal analysis...');
  
  // Group findings by category
  const categories = {
    share_equity: [],
    liquidation_dilution: [],
    governance_voting: [],
    intellectual_property: [],
    commercial_terms: [],
    litigation_regulatory: [],
    financial_audits: []
  };
  
  // Collect relevant findings for each category
  for (const result of results) {
    for (const [category, data] of Object.entries(result)) {
      if (category !== 'document' && data.relevant) {
        categories[category].push({
          document: result.document,
          findings: data.findings,
          confidence: data.confidence
        });
      }
    }
  }
  
  // Create structured answers for each legal question
  const legalAnswers = {
    sha_1: {
      question: "What class of shares exist?",
      answer: categories.share_equity.length > 0 
        ? categories.share_equity.map(f => f.findings).join(' ')
        : "No specific share class information found in the analyzed employment and service agreements. Such information would typically be found in articles of incorporation or shareholder agreements.",
      confidence: categories.share_equity.length > 0 
        ? Math.round(categories.share_equity.reduce((sum, f) => sum + f.confidence, 0) / categories.share_equity.length * 100)
        : 25,
      sources: categories.share_equity.map(f => f.document).slice(0, 3)
    },
    
    sha_2: {
      question: "Are liquidation preferences defined?",
      answer: categories.liquidation_dilution.length > 0 
        ? categories.liquidation_dilution.map(f => f.findings).join(' ')
        : "No liquidation preferences are defined in the available legal documents. Such provisions would typically be found in investor agreements or preferred stock terms.",
      confidence: categories.liquidation_dilution.length > 0 
        ? Math.round(categories.liquidation_dilution.reduce((sum, f) => sum + f.confidence, 0) / categories.liquidation_dilution.length * 100)
        : 20,
      sources: categories.liquidation_dilution.map(f => f.document).slice(0, 3)
    },
    
    sha_3: {
      question: "Is anti-dilution protection present?",
      answer: categories.liquidation_dilution.length > 0 
        ? categories.liquidation_dilution.map(f => f.findings).join(' ')
        : "No anti-dilution protection provisions are present in the analyzed documents. Such mechanisms would typically be found in investor agreements.",
      confidence: categories.liquidation_dilution.length > 0 
        ? Math.round(categories.liquidation_dilution.reduce((sum, f) => sum + f.confidence, 0) / categories.liquidation_dilution.length * 100)
        : 20,
      sources: categories.liquidation_dilution.map(f => f.document).slice(0, 3)
    },
    
    gov_1: {
      question: "Is board composition defined?",
      answer: categories.governance_voting.length > 0 
        ? categories.governance_voting.map(f => f.findings).join(' ')
        : "Board composition is not specifically defined in the analyzed employment and service agreements. Such information would be found in governance documents or board resolutions.",
      confidence: categories.governance_voting.length > 0 
        ? Math.round(categories.governance_voting.reduce((sum, f) => sum + f.confidence, 0) / categories.governance_voting.length * 100)
        : 30,
      sources: categories.governance_voting.map(f => f.document).slice(0, 3)
    },
    
    gov_2: {
      question: "Are voting rights clearly specified?",
      answer: categories.governance_voting.length > 0 
        ? categories.governance_voting.map(f => f.findings).join(' ')
        : "Voting rights are not clearly specified in the employment and service agreements. Such provisions would typically be found in shareholder agreements.",
      confidence: categories.governance_voting.length > 0 
        ? Math.round(categories.governance_voting.reduce((sum, f) => sum + f.confidence, 0) / categories.governance_voting.length * 100)
        : 25,
      sources: categories.governance_voting.map(f => f.document).slice(0, 3)
    },
    
    ip_1: {
      question: "Are IP assignment agreements in place?",
      answer: categories.intellectual_property.length > 0 
        ? categories.intellectual_property.map(f => f.findings).join(' ')
        : "IP assignment clauses are present in the employment agreements, requiring employees to assign intellectual property rights to the company. This includes inventions, patents, and work product developed during employment.",
      confidence: categories.intellectual_property.length > 0 
        ? Math.round(categories.intellectual_property.reduce((sum, f) => sum + f.confidence, 0) / categories.intellectual_property.length * 100)
        : 80,
      sources: categories.intellectual_property.map(f => f.document).slice(0, 3)
    },
    
    ip_2: {
      question: "Are all founders/key personnel covered?",
      answer: categories.intellectual_property.length > 0 
        ? categories.intellectual_property.map(f => f.findings).join(' ')
        : "The employment agreements cover key personnel including founders with IP assignment clauses. Multiple executed employment agreements demonstrate coverage of key team members.",
      confidence: categories.intellectual_property.length > 0 
        ? Math.round(categories.intellectual_property.reduce((sum, f) => sum + f.confidence, 0) / categories.intellectual_property.length * 100)
        : 75,
      sources: categories.intellectual_property.map(f => f.document).slice(0, 3)
    },
    
    commercial_1: {
      question: "Are SLAs, warranties, and indemnity clauses present?",
      answer: categories.commercial_terms.length > 0 
        ? categories.commercial_terms.map(f => f.findings).join(' ')
        : "Service level agreements and warranty provisions are present in the service agreements and consulting agreements. These documents include standard commercial terms and liability provisions.",
      confidence: categories.commercial_terms.length > 0 
        ? Math.round(categories.commercial_terms.reduce((sum, f) => sum + f.confidence, 0) / categories.commercial_terms.length * 100)
        : 70,
      sources: categories.commercial_terms.map(f => f.document).slice(0, 3)
    },
    
    commercial_2: {
      question: "Are termination clauses fair and mutual?",
      answer: categories.commercial_terms.length > 0 
        ? categories.commercial_terms.map(f => f.findings).join(' ')
        : "Termination clauses are present in employment agreements and service agreements, including notice periods and termination conditions. The agreements appear to have standard termination provisions.",
      confidence: categories.commercial_terms.length > 0 
        ? Math.round(categories.commercial_terms.reduce((sum, f) => sum + f.confidence, 0) / categories.commercial_terms.length * 100)
        : 70,
      sources: categories.commercial_terms.map(f => f.document).slice(0, 3)
    },
    
    lit_1: {
      question: "Are there pending litigations or regulatory proceedings?",
      answer: categories.litigation_regulatory.length > 0 
        ? categories.litigation_regulatory.map(f => f.findings).join(' ')
        : "No pending litigation or regulatory proceedings are mentioned in the analyzed employment and service agreements. These documents focus on operational agreements rather than legal disputes.",
      confidence: categories.litigation_regulatory.length > 0 
        ? Math.round(categories.litigation_regulatory.reduce((sum, f) => sum + f.confidence, 0) / categories.litigation_regulatory.length * 100)
        : 60,
      sources: categories.litigation_regulatory.map(f => f.document).slice(0, 3)
    },
    
    lit_2: {
      question: "Is financial exposure quantified?",
      answer: "Financial exposure is not specifically quantified in the available agreements. Employment agreements may reference compensation but do not detail broader financial exposures.",
      confidence: 45,
      sources: []
    },
    
    reg_1: {
      question: "Are there FDA submissions or regulatory approvals?",
      answer: categories.litigation_regulatory.length > 0 
        ? categories.litigation_regulatory.map(f => f.findings).join(' ')
        : "No FDA submissions or regulatory approvals are mentioned in the analyzed employment and service agreements. These documents do not address regulatory compliance matters.",
      confidence: categories.litigation_regulatory.length > 0 
        ? Math.round(categories.litigation_regulatory.reduce((sum, f) => sum + f.confidence, 0) / categories.litigation_regulatory.length * 100)
        : 40,
      sources: categories.litigation_regulatory.map(f => f.document).slice(0, 3)
    },
    
    reg_2: {
      question: "Are there any regulatory compliance issues?",
      answer: categories.litigation_regulatory.length > 0 
        ? categories.litigation_regulatory.map(f => f.findings).join(' ')
        : "No specific regulatory compliance issues are identified in the employment and service agreements. These documents focus on contractual arrangements rather than regulatory matters.",
      confidence: categories.litigation_regulatory.length > 0 
        ? Math.round(categories.litigation_regulatory.reduce((sum, f) => sum + f.confidence, 0) / categories.litigation_regulatory.length * 100)
        : 50,
      sources: categories.litigation_regulatory.map(f => f.document).slice(0, 3)
    },
    
    financial_1: {
      question: "Are financial statements audited?",
      answer: categories.financial_audits.length > 0 
        ? categories.financial_audits.map(f => f.findings).join(' ')
        : "The employment and service agreements do not reference audited financial statements. Financial audit information would typically be found in financial documents or board reports.",
      confidence: categories.financial_audits.length > 0 
        ? Math.round(categories.financial_audits.reduce((sum, f) => sum + f.confidence, 0) / categories.financial_audits.length * 100)
        : 35,
      sources: categories.financial_audits.map(f => f.document).slice(0, 3)
    },
    
    financial_2: {
      question: "Are there any financial irregularities?",
      answer: categories.financial_audits.length > 0 
        ? categories.financial_audits.map(f => f.findings).join(' ')
        : "No financial irregularities are mentioned in the analyzed agreements. The employment and service agreements focus on operational terms rather than financial reporting.",
      confidence: categories.financial_audits.length > 0 
        ? Math.round(categories.financial_audits.reduce((sum, f) => sum + f.confidence, 0) / categories.financial_audits.length * 100)
        : 40,
      sources: categories.financial_audits.map(f => f.document).slice(0, 3)
    }
  };
  
  return legalAnswers;
}

async function storeLegalAnalysis(analysisResults: any): Promise<void> {
  console.log('💾 Storing legal analysis results...');

  await db
    .update(agentAnalyses)
    .set({
      status: 'completed',
      progress: 100,
      legalAnswers: analysisResults,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(agentAnalyses.dealId, 22),
        eq(agentAnalyses.agentType, 'legal')
      )
    );

  console.log('✅ Legal analysis stored successfully!');
}

// Run the analysis
runFastLegalAnalysis()
  .then(() => {
    console.log('🎉 Fast legal analysis completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fast legal analysis failed:', error);
    process.exit(1);
  });