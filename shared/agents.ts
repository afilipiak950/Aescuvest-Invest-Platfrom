// Agent configuration - All agents use the same engine, differing only in questions and prompts

export const AGENT_TYPES = [
  'legal',
  'clinical', 
  'commercial',
  'hr',
  'financial',
  'ip',
  'research'
] as const;

export type AgentType = typeof AGENT_TYPES[number];

// Universal agent configuration
export const AGENT_CONFIG: Record<AgentType, {
  color: string;
  focusAreas: string[];
  questions: string[];
  promptTemplate: string;
}> = {
  legal: {
    color: 'blue',
    focusAreas: [
      'Contract analysis and legal compliance',
      'Regulatory requirements and legal risks',
      'Corporate structure and governance',
      'Litigation history and legal disputes',
      'IP licensing and legal agreements'
    ],
    questions: [
      'What are the key legal risks identified in the company\'s contracts and agreements?',
      'Are there any pending litigation matters or legal disputes?',
      'Does the company comply with relevant regulatory requirements?',
      'What is the corporate structure and governance framework?',
      'Are there any material legal liabilities or contingencies?'
    ],
    promptTemplate: `You are a senior legal due diligence analyst. Analyze the provided documents for legal risks, compliance issues, and contractual obligations. 

Focus on:
- Contract terms and legal obligations
- Regulatory compliance status
- Litigation risks and legal disputes
- Corporate governance structure
- Legal liabilities and contingencies

Provide specific findings with evidence from the documents and actionable recommendations.`
  },
  
  clinical: {
    color: 'green', 
    focusAreas: [
      'Clinical trial data and regulatory status',
      'Safety profile and adverse events',
      'Efficacy endpoints and clinical outcomes',
      'Regulatory pathway and FDA interactions',
      'Clinical development strategy'
    ],
    questions: [
      'What is the current status of clinical trials and regulatory submissions?',
      'What are the key safety findings and adverse event profiles?',
      'How strong is the efficacy data across different endpoints?', 
      'What is the regulatory pathway and timeline to market?',
      'Are there any clinical development risks or challenges?'
    ],
    promptTemplate: `You are a senior clinical due diligence analyst. Analyze the provided documents for clinical data, regulatory status, and development risks.

Focus on:
- Clinical trial results and statistical significance
- Safety profile and risk-benefit analysis
- Regulatory submissions and FDA feedback
- Clinical development timeline and milestones
- Competitive clinical positioning

Provide evidence-based findings with confidence levels and regulatory insights.`
  },

  commercial: {
    color: 'purple',
    focusAreas: [
      'Market size and competitive positioning',
      'Sales strategy and go-to-market approach', 
      'Customer acquisition and retention',
      'Pricing strategy and revenue model',
      'Commercial partnerships and channels'
    ],
    questions: [
      'What is the addressable market size and growth potential?',
      'How differentiated is the product in the competitive landscape?',
      'What is the sales strategy and customer acquisition approach?',
      'How sustainable is the pricing model and revenue streams?',
      'What are the key commercial partnerships and distribution channels?'
    ],
    promptTemplate: `You are a senior commercial due diligence analyst. Analyze the provided documents for market opportunity, competitive positioning, and commercial viability.

Focus on:
- Market size, growth, and segmentation
- Competitive differentiation and positioning
- Sales and marketing effectiveness
- Revenue model sustainability
- Commercial partnerships and distribution

Provide market-driven insights with competitive intelligence and commercial recommendations.`
  },

  hr: {
    color: 'orange',
    focusAreas: [
      'Leadership team experience and track record',
      'Organizational structure and key personnel',
      'Compensation and equity arrangements',
      'Employee retention and culture',
      'Human capital risks and dependencies'
    ],
    questions: [
      'What is the experience and track record of the leadership team?',
      'Are there key person dependencies or retention risks?',
      'How competitive are the compensation and equity structures?',
      'What is the organizational structure and reporting relationships?',
      'Are there any HR compliance issues or employment risks?'
    ],
    promptTemplate: `You are a senior HR due diligence analyst. Analyze the provided documents for human capital strengths, leadership assessment, and organizational risks.

Focus on:
- Leadership team qualifications and experience
- Organizational structure and key roles
- Compensation benchmarking and equity plans
- Employee retention and culture indicators
- HR compliance and employment law issues

Provide talent-focused insights with leadership assessment and organizational recommendations.`
  },

  financial: {
    color: 'red',
    focusAreas: [
      'Revenue growth and business model sustainability',
      'Profitability metrics and cost structure',
      'Cash flow and working capital management',
      'Financial controls and accounting practices',
      'Funding requirements and capital efficiency'
    ],
    questions: [
      'What are the revenue growth trends and business model sustainability?',
      'How strong are the profitability metrics and unit economics?',
      'What is the cash flow profile and working capital requirements?',
      'Are the financial controls and accounting practices robust?',
      'What are the funding needs and capital efficiency metrics?'
    ],
    promptTemplate: `You are a senior financial due diligence analyst. Analyze the provided documents for financial performance, business model viability, and capital requirements.

Focus on:
- Revenue quality and growth sustainability
- Profitability analysis and cost structure
- Cash flow generation and working capital
- Financial reporting quality and controls
- Capital requirements and funding strategy

Provide financial insights with quantitative analysis and investment implications.`
  },

  ip: {
    color: 'cyan',
    focusAreas: [
      'Patent portfolio strength and coverage',
      'Trademark and brand protection',
      'Trade secrets and know-how',
      'IP licensing and freedom to operate',
      'IP risks and competitive landscape'
    ],
    questions: [
      'How strong and defensible is the patent portfolio?',
      'Are there freedom to operate risks or IP infringement concerns?',
      'What is the strength of trademark and brand protection?',
      'How valuable are the trade secrets and proprietary know-how?',
      'What are the IP licensing opportunities and obligations?'
    ],
    promptTemplate: `You are a senior IP due diligence analyst. Analyze the provided documents for intellectual property assets, risks, and competitive positioning.

Focus on:
- Patent portfolio quality and strategic value
- Trademark strength and brand protection
- Trade secret identification and protection
- Freedom to operate analysis
- IP competitive landscape and licensing

Provide IP-focused insights with patent analysis and strategic IP recommendations.`
  },

  research: {
    color: 'yellow',
    focusAreas: [
      'Technology platform and scientific foundation',
      'Research pipeline and innovation potential',
      'Scientific publications and thought leadership',
      'R&D capabilities and infrastructure',
      'Technology risks and competitive advantages'
    ],
    questions: [
      'How differentiated and defensible is the core technology platform?',
      'What is the strength of the research pipeline and innovation engine?',
      'How strong is the scientific foundation and publication record?',
      'What are the R&D capabilities and infrastructure requirements?',
      'What are the key technology risks and competitive advantages?'
    ],
    promptTemplate: `You are a senior research due diligence analyst. Analyze the provided documents for technology strength, research capabilities, and innovation potential.

Focus on:
- Technology platform differentiation and barriers
- Research pipeline depth and innovation
- Scientific publications and thought leadership
- R&D infrastructure and capabilities
- Technology risks and competitive moats

Provide technology-focused insights with research assessment and innovation recommendations.`
  }
};

// Helper functions
export const getAgentConfig = (agentType: AgentType) => AGENT_CONFIG[agentType];
export const getAllAgentTypes = () => AGENT_TYPES;
export const isValidAgentType = (type: string): type is AgentType => AGENT_TYPES.includes(type as AgentType);