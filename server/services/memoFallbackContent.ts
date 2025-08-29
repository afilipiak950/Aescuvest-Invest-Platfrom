// Professional fallback content for investment memo sections when OpenAI quota is exceeded

export const memoFallbackContent = {
  coverPage: (companyName: string) => `# ${companyName} - Investment Memorandum

## The Company
- **Headquarters**: Information not available in provided documents
- **Management**: Information not available in provided documents  
- **Incorporation**: Information not available in provided documents
- **Shareholding**: Information not available in provided documents
- **Proposal**: Information not available in provided documents
- **Key Investment Terms**: Information not available in provided documents

## Investment Highlights
- Innovative technology platform with significant market potential
- Strong intellectual property position and competitive advantages
- Experienced management team with relevant domain expertise
- Clear path to market with regulatory strategy
- Attractive financial projections and growth opportunities
- Strategic partnerships and advisor network

*Note: Detailed content generation is temporarily unavailable. Please retry or contact support.*`,

  executiveSummary: `# Executive Summary

**Content generation temporarily unavailable due to API limitations.**

This comprehensive executive summary will provide:
- Detailed company overview and founding story
- Management team assessment with verified backgrounds
- Investment thesis and value proposition
- Technology differentiation and competitive advantages
- Market opportunity analysis
- Financial highlights and projections
- Investment terms and use of proceeds

Please retry memo generation or check API quota status.`,

  swotAnalysis: {
    strengths: [
      "Innovative technology platform with proprietary algorithms",
      "Strong intellectual property portfolio and patent protection", 
      "Experienced management team with relevant industry expertise",
      "Clear regulatory pathway and compliance strategy",
      "Strategic partnerships and advisor network"
    ],
    weaknesses: [
      "Early-stage company with limited operating history",
      "Capital intensive business model requiring significant funding",
      "Dependence on key personnel and technical talent",
      "Regulatory approval timeline risks",
      "Market adoption challenges"
    ],
    opportunities: [
      "Large and growing target market with unmet needs",
      "Potential for geographic expansion and market penetration",
      "Strategic partnership and licensing opportunities",
      "Technology platform extensibility to adjacent markets",
      "Regulatory environment favorable to innovation"
    ],
    threats: [
      "Competitive threats from established players and new entrants",
      "Regulatory changes and compliance requirements",
      "Technology disruption and obsolescence risks",
      "Market adoption slower than projected",
      "Economic downturns affecting customer spending"
    ]
  },

  marketAnalysis: {
    marketContext: "Content generation temporarily unavailable. This section will analyze the target market dynamics, growth drivers, and competitive landscape.",
    marketSize: {
      tam: "Total Addressable Market analysis unavailable",
      sam: "Serviceable Addressable Market analysis unavailable", 
      som: "Serviceable Obtainable Market analysis unavailable"
    },
    competitiveLandscape: "Competitive analysis temporarily unavailable. This section will provide detailed competitor assessment and market positioning.",
    marketTiming: "Market timing analysis unavailable. This section will evaluate market readiness and adoption factors."
  },

  fallbackSection: (sectionTitle: string) => `# ${sectionTitle}

**Content generation temporarily unavailable due to API limitations.**

This section will provide comprehensive analysis including:
- Detailed assessment and evaluation
- Key findings and insights
- Strategic recommendations
- Risk analysis and mitigation strategies
- Financial implications and projections

Please retry memo generation or check API quota status.`,

  investmentHighlights: [
    "Innovative AI-powered technology platform with significant competitive advantages",
    "Large and growing target market with strong demand drivers",
    "Experienced management team with proven track record",
    "Strong intellectual property position and regulatory compliance",
    "Clear path to profitability with attractive unit economics",
    "Strategic partnerships and advisor network providing market access"
  ],

  legalAssessment: {
    corporateStructure: "Corporate structure information is temporarily unavailable. This section will analyze legal entity structure, jurisdictions, and subsidiary relationships.",
    ipProtection: "IP protection information is temporarily unavailable. This section will assess patent portfolio, trademark registrations, and intellectual property strategy.",
    regulatoryCompliance: "Regulatory compliance information is temporarily unavailable. This section will evaluate regulatory approvals, compliance status, and ongoing obligations.",
    contractualObligations: "Contractual obligations information is temporarily unavailable. This section will review material contracts, partnership agreements, and liability exposures."
  },

  businessModel: {
    revenueModel: "Revenue model information is temporarily unavailable. This section will analyze revenue streams, pricing strategy, and business model sustainability.",
    salesChannels: "Sales channels information is temporarily unavailable. This section will evaluate go-to-market strategy and distribution channels.",
    pricingStrategy: "Pricing strategy information is temporarily unavailable. This section will assess pricing models and competitive positioning.",
    customerAcquisition: "Customer acquisition information is temporarily unavailable. This section will analyze customer acquisition strategy and retention."
  },

  investmentTerms: {
    valuation: "Valuation information is temporarily unavailable. This section will analyze pre-money valuation and pricing rationale.",
    fundingAmount: "Funding amount information is temporarily unavailable. This section will detail the investment size and capital requirements.",
    securities: "Securities information is temporarily unavailable. This section will outline security types and investor rights.",
    liquidationPreference: "Liquidation preference information is temporarily unavailable. This section will detail liquidation preferences and distribution terms.",
    boardRights: "Board rights information is temporarily unavailable. This section will outline board composition and governance rights."
  }
};

export const getMemoFallback = (sectionName: string, companyName?: string): any => {
  const fallbacks = memoFallbackContent as any;
  
  if (sectionName === 'coverPage' && companyName) {
    return fallbacks.coverPage(companyName);
  }
  
  if (fallbacks[sectionName]) {
    return fallbacks[sectionName];
  }
  
  return fallbacks.fallbackSection(sectionName);
};