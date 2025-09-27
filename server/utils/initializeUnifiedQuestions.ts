import { db } from "../db";
import { unifiedAgentQuestions } from "@shared/schema";

// Define questions for each agent type
const legalQuestions = [
  { text: "Are key commercial contracts clearly defined?", priority: 1 },
  { text: "What IP assignments and licenses are in place?", priority: 2 },
  { text: "Is there ongoing litigation or legal disputes?", priority: 3 },
  { text: "Are regulatory approvals and compliance certificates current?", priority: 4 },
  { text: "What warranties and indemnities exist in contracts?", priority: 5 },
  { text: "Are there restrictive covenants or non-compete clauses?", priority: 6 },
  { text: "What data privacy and GDPR compliance measures exist?", priority: 7 },
  { text: "Are there material contracts requiring consent for change of control?", priority: 8 },
  { text: "What employment agreements and contractor arrangements exist?", priority: 9 },
  { text: "Are there any contingent liabilities or guarantees?", priority: 10 },
  { text: "What insurance policies are in place and are they adequate?", priority: 11 },
  { text: "Are there any regulatory investigations or sanctions?", priority: 12 },
  { text: "What jurisdiction and governing law applies to key contracts?", priority: 13 }
];

const clinicalQuestions = [
  { text: "What is the clinical validation status and trial data?", priority: 1 },
  { text: "Are regulatory pathways clearly defined (FDA/CE Mark)?", priority: 2 },
  { text: "What is the safety profile and adverse event history?", priority: 3 },
  { text: "How strong is the clinical evidence and publication record?", priority: 4 },
  { text: "What are the reimbursement codes and coverage policies?", priority: 5 },
  { text: "Who are the key opinion leaders and clinical advisors?", priority: 6 },
  { text: "What is the competitive clinical landscape?", priority: 7 },
  { text: "Are there clear clinical endpoints and outcome measures?", priority: 8 },
  { text: "What post-market surveillance systems are in place?", priority: 9 },
  { text: "Is the clinical utility clearly demonstrated?", priority: 10 },
  { text: "What are the patient selection criteria and target populations?", priority: 11 },
  { text: "Are there clinical practice guidelines supporting adoption?", priority: 12 },
  { text: "What real-world evidence supports the technology?", priority: 13 }
];

const commercialQuestions = [
  { text: "What is the total addressable market (TAM) size?", priority: 1 },
  { text: "What is the go-to-market strategy and sales model?", priority: 2 },
  { text: "Who are the key customers and what is the pipeline?", priority: 3 },
  { text: "What are the unit economics and pricing strategy?", priority: 4 },
  { text: "What is the competitive positioning and differentiation?", priority: 5 },
  { text: "What are the customer acquisition costs (CAC) and lifetime value (LTV)?", priority: 6 },
  { text: "What distribution channels and partnerships exist?", priority: 7 },
  { text: "What is the sales cycle length and conversion rates?", priority: 8 },
  { text: "Are there expansion opportunities within existing accounts?", priority: 9 },
  { text: "What is the customer retention and churn rate?", priority: 10 },
  { text: "What marketing strategies drive demand generation?", priority: 11 },
  { text: "Are there network effects or platform dynamics?", priority: 12 },
  { text: "What are the barriers to entry and switching costs?", priority: 13 }
];

const hrQuestions = [
  { text: "What is the organizational structure and reporting lines?", priority: 1 },
  { text: "Who are the key executives and their backgrounds?", priority: 2 },
  { text: "What are the employee retention rates and turnover?", priority: 3 },
  { text: "What compensation and equity structures are in place?", priority: 4 },
  { text: "Are there key person dependencies or succession plans?", priority: 5 },
  { text: "What is the company culture and employee satisfaction?", priority: 6 },
  { text: "What skills gaps exist in the current team?", priority: 7 },
  { text: "Are there any employment disputes or HR issues?", priority: 8 },
  { text: "What is the hiring plan and talent pipeline?", priority: 9 },
  { text: "Are there adequate training and development programs?", priority: 10 },
  { text: "What diversity and inclusion initiatives exist?", priority: 11 },
  { text: "Are performance management systems effective?", priority: 12 },
  { text: "What is the remote work policy and infrastructure?", priority: 13 }
];

const financialQuestions = [
  { text: "What are the historical revenue trends and growth rates?", priority: 1 },
  { text: "What is the current burn rate and runway?", priority: 2 },
  { text: "What are the gross margins and path to profitability?", priority: 3 },
  { text: "What is the quality of revenue (recurring vs one-time)?", priority: 4 },
  { text: "What are the working capital requirements?", priority: 5 },
  { text: "What is the capital structure and previous valuations?", priority: 6 },
  { text: "Are financial controls and reporting systems adequate?", priority: 7 },
  { text: "What are the key financial metrics and KPIs?", priority: 8 },
  { text: "What is the budget vs actual performance?", priority: 9 },
  { text: "Are there any outstanding debts or liabilities?", priority: 10 },
  { text: "What are the tax obligations and compliance status?", priority: 11 },
  { text: "What is the financial forecast accuracy historically?", priority: 12 },
  { text: "Are there adequate financial reserves and contingencies?", priority: 13 }
];

const ipQuestions = [
  { text: "What patents are filed, granted, or pending?", priority: 1 },
  { text: "Are there trade secrets and know-how protections?", priority: 2 },
  { text: "Who owns the IP and are assignments clear?", priority: 3 },
  { text: "Are there freedom-to-operate considerations?", priority: 4 },
  { text: "What is the IP strategy and portfolio strength?", priority: 5 },
  { text: "Are there any IP disputes or infringement risks?", priority: 6 },
  { text: "What licensing agreements are in place?", priority: 7 },
  { text: "Are trademarks and brands properly protected?", priority: 8 },
  { text: "Is the source code and software IP documented?", priority: 9 },
  { text: "What third-party IP dependencies exist?", priority: 10 },
  { text: "Are there adequate IP management processes?", priority: 11 },
  { text: "What is the competitive IP landscape?", priority: 12 },
  { text: "Are there opportunities for IP monetization?", priority: 13 }
];

const researchQuestions = [
  { text: "What is the scientific foundation and evidence base?", priority: 1 },
  { text: "What are the R&D capabilities and pipeline?", priority: 2 },
  { text: "Who are the scientific advisors and collaborators?", priority: 3 },
  { text: "What peer-reviewed publications support the technology?", priority: 4 },
  { text: "What is the innovation potential and roadmap?", priority: 5 },
  { text: "Are there ongoing research collaborations?", priority: 6 },
  { text: "What technical risks and challenges exist?", priority: 7 },
  { text: "Is the technology scalable and reproducible?", priority: 8 },
  { text: "What is the competitive research landscape?", priority: 9 },
  { text: "Are there platform technology opportunities?", priority: 10 },
  { text: "What validation studies are planned or ongoing?", priority: 11 },
  { text: "Are there grants or research funding opportunities?", priority: 12 },
  { text: "What is the data quality and statistical rigor?", priority: 13 }
];

const allQuestions = [
  ...legalQuestions.map(q => ({ ...q, agentType: 'legal' })),
  ...clinicalQuestions.map(q => ({ ...q, agentType: 'clinical' })),
  ...commercialQuestions.map(q => ({ ...q, agentType: 'commercial' })),
  ...hrQuestions.map(q => ({ ...q, agentType: 'hr' })),
  ...financialQuestions.map(q => ({ ...q, agentType: 'financial' })),
  ...ipQuestions.map(q => ({ ...q, agentType: 'ip' })),
  ...researchQuestions.map(q => ({ ...q, agentType: 'research' }))
];

export async function initializeUnifiedQuestions() {
  console.log("🎯 Initializing unified agent questions...");
  
  try {
    // Check if questions already exist
    const existing = await db
      .select()
      .from(unifiedAgentQuestions)
      .limit(1);
    
    if (existing.length > 0) {
      console.log("✅ Unified agent questions already initialized");
      return;
    }
    
    // Insert all questions
    for (const question of allQuestions) {
      await db.insert(unifiedAgentQuestions).values({
        agentType: question.agentType,
        questionText: question.text,
        priority: question.priority,
        isActive: true,
        category: "default",
        requiresEvidence: true,
        confidenceThreshold: 0.7,
        maxRetries: 3,
        metadata: {}
      });
    }
    
    console.log(`✅ Initialized ${allQuestions.length} unified agent questions`);
  } catch (error) {
    console.error("❌ Error initializing unified agent questions:", error);
    throw error;
  }
}