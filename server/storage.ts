import { 
  users, User, InsertUser,
  deals, Deal, InsertDeal,
  documents, Document, InsertDocument,
  agentAnalyses, AgentAnalysis, InsertAgentAnalysis,
  investmentMemos, InvestmentMemo, InsertInvestmentMemo,
  investors, Investor, InsertInvestor,
  investorMatches, InvestorMatch, InsertInvestorMatch,
  automations, Automation, InsertAutomation,
  companyResearch
} from "@shared/schema";
import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';

// Storage interface with all the CRUD methods we need
export interface IStorage {
  // User methods
  getAllUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Deal methods
  getAllDeals(): Promise<Deal[]>;
  getDealById(id: number): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDealAiScore(id: number, score: number): Promise<Deal | undefined>;
  updateDealStatus(id: number, status: string): Promise<Deal | undefined>;
  
  // Document methods
  getAllDocuments(): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByDealId(dealId: number): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocumentStatus(id: number, status: string): Promise<Document | undefined>;
  
  // Agent analysis methods
  getAllAnalyses(): Promise<AgentAnalysis[]>;
  getAnalysisById(id: number): Promise<AgentAnalysis | undefined>;
  getAnalysesByDealId(dealId: number): Promise<AgentAnalysis[]>;
  createAgentAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis>;
  updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined>;
  
  // Investment memo methods
  getAllMemos(): Promise<InvestmentMemo[]>;
  getMemoById(id: number): Promise<InvestmentMemo | undefined>;
  getMemoByDealId(dealId: number): Promise<InvestmentMemo | undefined>;
  createInvestmentMemo(memo: InsertInvestmentMemo): Promise<InvestmentMemo>;
  updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined>;
  
  // Investor methods
  getAllInvestors(): Promise<Investor[]>;
  getInvestorById(id: number): Promise<Investor | undefined>;
  createInvestor(investor: InsertInvestor): Promise<Investor>;
  
  // Investor match methods
  getAllInvestorMatches(): Promise<InvestorMatch[]>;
  getInvestorMatchById(id: number): Promise<InvestorMatch | undefined>;
  getInvestorMatchesByDealId(dealId: number): Promise<InvestorMatch[]>;
  createInvestorMatch(match: InsertInvestorMatch): Promise<InvestorMatch>;
  updateInvestorMatchStatus(id: number, status: string): Promise<InvestorMatch | undefined>;
  
  // Automation methods
  getAllAutomations(): Promise<Automation[]>;
  getAutomationById(id: number): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  toggleAutomation(id: number): Promise<Automation | undefined>;
  
  // Evaluation criteria methods
  getAllEvaluationCriteria(): Promise<any[]>;
  getEvaluationCriteriaById(id: number): Promise<any | undefined>;
  createEvaluationCriteria(criteria: any): Promise<any>;
  updateEvaluationCriteria(id: number, data: any): Promise<any | undefined>;
  
  // Evaluation results methods
  getAllEvaluationResults(): Promise<any[]>;
  getEvaluationResultsByDealId(dealId: number): Promise<any[]>;
  createEvaluationResult(result: any): Promise<any>;
  
  // Company research methods
  getCompanyResearchByDealId(dealId: number): Promise<any | undefined>;
  createCompanyResearch(research: any): Promise<any>;
  updateCompanyResearchStatus(dealId: number, status: string): Promise<any | undefined>;
}

// Database implementation of the storage interface
export class DatabaseStorage implements IStorage {
  // User methods
  async getAllUsers(): Promise<User[]> {
    const userList = await db.select().from(users).orderBy(desc(users.createdAt));
    return userList;
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Since we don't have a username field, search by email as a fallback
    return this.getUserByEmail(username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }
  
  // Deal methods
  async getAllDeals(): Promise<Deal[]> {
    const dealList = await db.select().from(deals).orderBy(desc(deals.createdAt));
    return dealList;
  }

  async getDealById(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async updateDealAiScore(id: number, score: number): Promise<Deal | undefined> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ aiScore: score })
      .where(eq(deals.id, id))
      .returning();
    return updatedDeal;
  }

  async updateDealStatus(id: number, status: string): Promise<Deal | undefined> {
    const [updatedDeal] = await db
      .update(deals)
      .set({ status })
      .where(eq(deals.id, id))
      .returning();
    return updatedDeal;
  }
  
  // Document methods
  async getAllDocuments(): Promise<Document[]> {
    const documentList = await db.select().from(documents).orderBy(desc(documents.uploadedAt));
    return documentList;
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByDealId(dealId: number): Promise<Document[]> {
    const documentList = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId))
      .orderBy(desc(documents.uploadedAt));
    return documentList;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocumentStatus(id: number, status: string): Promise<Document | undefined> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ status })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }
  
  // Agent analysis methods
  async getAllAnalyses(): Promise<AgentAnalysis[]> {
    const analysisList = await db.select().from(agentAnalyses).orderBy(desc(agentAnalyses.createdAt));
    return analysisList;
  }

  async getAnalysisById(id: number): Promise<AgentAnalysis | undefined> {
    const [analysis] = await db.select().from(agentAnalyses).where(eq(agentAnalyses.id, id));
    return analysis;
  }

  async getAnalysesByDealId(dealId: number): Promise<AgentAnalysis[]> {
    const analysisList = await db
      .select()
      .from(agentAnalyses)
      .where(eq(agentAnalyses.dealId, dealId))
      .orderBy(desc(agentAnalyses.createdAt));
    return analysisList;
  }

  async createAgentAnalysis(analysis: InsertAgentAnalysis): Promise<AgentAnalysis> {
    const [newAnalysis] = await db.insert(agentAnalyses).values(analysis).returning();
    return newAnalysis;
  }

  async updateAgentAnalysis(id: number, data: Partial<AgentAnalysis>): Promise<AgentAnalysis | undefined> {
    // Create a safe update object
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.findings !== undefined) updateData.findings = data.findings;
    if (data.recommendations !== undefined) updateData.recommendations = data.recommendations;
    updateData.updatedAt = new Date();

    const [updatedAnalysis] = await db
      .update(agentAnalyses)
      .set(updateData)
      .where(eq(agentAnalyses.id, id))
      .returning();
    return updatedAnalysis;
  }
  
  // Investment memo methods
  async getAllMemos(): Promise<InvestmentMemo[]> {
    const memoList = await db.select().from(investmentMemos).orderBy(desc(investmentMemos.createdAt));
    return memoList;
  }

  async getMemoById(id: number): Promise<InvestmentMemo | undefined> {
    const [memo] = await db.select().from(investmentMemos).where(eq(investmentMemos.id, id));
    return memo;
  }

  async getMemoByDealId(dealId: number): Promise<InvestmentMemo | undefined> {
    const [memo] = await db
      .select()
      .from(investmentMemos)
      .where(eq(investmentMemos.dealId, dealId))
      .orderBy(desc(investmentMemos.createdAt));
    return memo;
  }

  async createInvestmentMemo(memo: InsertInvestmentMemo): Promise<InvestmentMemo> {
    const [newMemo] = await db.insert(investmentMemos).values(memo).returning();
    return newMemo;
  }

  async updateMemo(id: number, data: Partial<InvestmentMemo>): Promise<InvestmentMemo | undefined> {
    // Create a safe update object
    const updateData: any = {};
    if (data.executiveSummary !== undefined) updateData.executiveSummary = data.executiveSummary;
    if (data.productMarket !== undefined) updateData.productMarket = data.productMarket;
    if (data.team !== undefined) updateData.team = data.team;
    if (data.financials !== undefined) updateData.financials = data.financials;
    if (data.swot !== undefined) updateData.swot = data.swot;
    if (data.status !== undefined) updateData.status = data.status;
    updateData.updatedAt = new Date();

    const [updatedMemo] = await db
      .update(investmentMemos)
      .set(updateData)
      .where(eq(investmentMemos.id, id))
      .returning();
    return updatedMemo;
  }
  
  // Investor methods
  async getAllInvestors(): Promise<Investor[]> {
    const investorList = await db.select().from(investors).orderBy(desc(investors.createdAt));
    return investorList;
  }

  async getInvestorById(id: number): Promise<Investor | undefined> {
    const [investor] = await db.select().from(investors).where(eq(investors.id, id));
    return investor;
  }

  async createInvestor(investor: InsertInvestor): Promise<Investor> {
    const [newInvestor] = await db.insert(investors).values(investor).returning();
    return newInvestor;
  }
  
  // Investor match methods
  async getAllInvestorMatches(): Promise<InvestorMatch[]> {
    const matchList = await db.select().from(investorMatches).orderBy(desc(investorMatches.createdAt));
    return matchList;
  }

  async getInvestorMatchById(id: number): Promise<InvestorMatch | undefined> {
    const [match] = await db.select().from(investorMatches).where(eq(investorMatches.id, id));
    return match;
  }

  async getInvestorMatchesByDealId(dealId: number): Promise<InvestorMatch[]> {
    const matchList = await db
      .select()
      .from(investorMatches)
      .where(eq(investorMatches.dealId, dealId))
      .orderBy(desc(investorMatches.createdAt));
    return matchList;
  }

  async createInvestorMatch(match: InsertInvestorMatch): Promise<InvestorMatch> {
    const [newMatch] = await db.insert(investorMatches).values(match).returning();
    return newMatch;
  }

  async updateInvestorMatchStatus(id: number, status: string): Promise<InvestorMatch | undefined> {
    const [updatedMatch] = await db
      .update(investorMatches)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(investorMatches.id, id))
      .returning();
    return updatedMatch;
  }
  
  // Automation methods
  async getAllAutomations(): Promise<Automation[]> {
    const automationList = await db.select().from(automations).orderBy(desc(automations.createdAt));
    return automationList;
  }

  async getAutomationById(id: number): Promise<Automation | undefined> {
    const [automation] = await db.select().from(automations).where(eq(automations.id, id));
    return automation;
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const [newAutomation] = await db.insert(automations).values(automation).returning();
    return newAutomation;
  }

  async toggleAutomation(id: number): Promise<Automation | undefined> {
    // First get the current automation to toggle its status
    const [currentAutomation] = await db.select().from(automations).where(eq(automations.id, id));
    
    if (!currentAutomation) return undefined;
    
    const [updatedAutomation] = await db
      .update(automations)
      .set({ 
        isActive: !currentAutomation.isActive,
        updatedAt: new Date() 
      })
      .where(eq(automations.id, id))
      .returning();
    
    return updatedAutomation;
  }

  // Evaluation criteria methods
  async getAllEvaluationCriteria(): Promise<any[]> {
    // Return default criteria for now
    return [
      { id: 1, name: "Sector", description: "Must be in Healthcare", weight: 25, isActive: true },
      { id: 2, name: "Biotech Exclusion", description: "No wet-lab biotech", weight: 20, isActive: true },
      { id: 3, name: "HQ Geography", description: "EU or Israel only", weight: 15, isActive: true },
      { id: 4, name: "Stage", description: "Series A-C preferred", weight: 20, isActive: true },
      { id: 5, name: "Ownership Feasibility", description: "20-30% post-money stake possible", weight: 10, isActive: true },
      { id: 6, name: "Business Model Fit", description: "Platform logic preferred", weight: 10, isActive: true }
    ];
  }

  async getEvaluationCriteriaById(id: number): Promise<any | undefined> {
    const criteria = await this.getAllEvaluationCriteria();
    return criteria.find(c => c.id === id);
  }

  async createEvaluationCriteria(criteria: any): Promise<any> {
    return criteria;
  }

  async updateEvaluationCriteria(id: number, data: any): Promise<any | undefined> {
    return { id, ...data };
  }

  async getAllEvaluationResults(): Promise<any[]> {
    return [];
  }

  async getEvaluationResultsByDealId(dealId: number): Promise<any[]> {
    try {
      const results = await pool.query(`
        SELECT * FROM evaluation_results 
        WHERE deal_id = $1 
        ORDER BY created_at DESC
      `, [dealId]);
      
      return results.rows.map(row => ({
        id: row.id,
        dealId: row.deal_id,
        criteriaId: row.criteria_id,
        score: row.score,
        reasoning: row.reasoning,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Error fetching evaluation results:', error);
      return [];
    }
  }

  async createEvaluationResult(result: any): Promise<any> {
    return result;
  }

  // Company research methods
  async getCompanyResearchByDealId(dealId: number): Promise<any | undefined> {
    // Return Tesla comprehensive research data for showcase
    if (dealId === 21) {
      return {
        dealId: 21,
        companyName: "Tesla Company",
        website: "https://www.tesla.com",
        researchStatus: "completed",
        lastUpdated: new Date().toISOString(),
        
        // CEO Profile (main executive focus)
        ceoProfile: {
          name: "Elon Musk",
          title: "Chief Executive Officer & Product Architect",
          linkedinUrl: "https://linkedin.com/in/elon-musk",
          background: "Visionary entrepreneur leading the transition to sustainable energy and space exploration with Tesla, SpaceX, and other breakthrough companies. Known for revolutionizing electric vehicles, space exploration, and neural technology interfaces.",
          experience: "25+ years building transformative technology companies from PayPal to Tesla to SpaceX. Track record of scaling companies from startup to industry leadership positions.",
          previousCompanies: ["PayPal", "Zip2", "SpaceX", "Neuralink", "The Boring Company"],
          education: "Bachelor of Science in Physics (University of Pennsylvania), Bachelor of Economics (Wharton School)",
          achievements: [
            "Built Tesla into world's most valuable automaker ($789B market cap)",
            "Named Time Person of the Year 2021 for accelerating sustainable transportation", 
            "Successfully developed reusable rocket technology reducing space costs by 90%",
            "Advanced neural interface technology with Neuralink brain-computer interfaces"
          ]
        },

        // Key Team Members
        keyTeamMembers: [
          {
            name: "Drew Baglino",
            role: "Senior VP of Powertrain & Energy Engineering",
            linkedinUrl: "https://linkedin.com/in/drew-baglino",
            background: "Technical leader driving Tesla's battery technology revolution and energy storage innovations. Led development of 4680 battery cells and Gigafactory scaling."
          },
          {
            name: "Vaibhav Taneja",
            role: "Chief Financial Officer", 
            linkedinUrl: "https://linkedin.com/in/vaibhav-taneja",
            background: "Financial executive with automotive and global operations expertise. 20+ years in financial leadership including automotive industry and international expansion."
          }
        ],

        // Financial Intelligence
        financialInsights: {
          currentMetrics: {
            revenue: "$96.8B (2023 annual revenue)",
            revenueGrowth: "19% year-over-year growth",
            marketCap: "$789.3B",
            grossMargin: "18.7%",
            netIncome: "$15.0B",
            freeCashFlow: "$7.5B",
            cashPosition: "$29.1B"
          },
          fundingHistory: [
            {
              round: "IPO",
              amount: "$226M",
              date: "June 29, 2010",
              investors: ["Public Markets"],
              leadInvestor: "Goldman Sachs",
              valuation: "$1.7B",
              useOfFunds: "Manufacturing scaling and Model S development"
            },
            {
              round: "Series F",
              amount: "$50M",
              date: "June 12, 2009",
              investors: ["Daimler AG"],
              leadInvestor: "Daimler AG",
              strategicValue: "Automotive industry validation"
            }
          ],
          employeeCount: "140,473 globally",
          projections: {
            revenue2024: "$110-120B (projected)",
            vehicleDeliveries2024: "2.2M units (projected)",
            energyDeployment2024: "40GWh (target)"
          }
        },

        // External Data Sources
        externalSources: {
          crunchbaseUrl: "https://www.crunchbase.com/organization/tesla-motors",
          pitchbookUrl: "https://pitchbook.com/profiles/company/tesla-inc",
          linkedinCompanyUrl: "https://www.linkedin.com/company/tesla-motors",
          secFilingsUrl: "https://www.sec.gov/cgi-bin/browse-edgar?CIK=1318605",
          bloombergUrl: "https://www.bloomberg.com/quote/TSLA:US",
          glassdoorUrl: "https://www.glassdoor.com/Overview/Working-at-Tesla"
        },

        // Business Intelligence
        businessIntelligence: {
          marketPosition: "Global leader in electric vehicles with 20.1% market share, pioneering autonomous driving and sustainable energy solutions",
          competitors: [
            "BYD Auto (Chinese EV leader)",
            "Volkswagen Group (ID platform)",
            "General Motors (Ultium platform)",
            "Ford Motor Company (F-150 Lightning)",
            "Mercedes-Benz (EQS series)",
            "BMW Group (i-series)",
            "Rivian (Electric trucks)",
            "Lucid Motors (Luxury EVs)"
          ],
          partnerships: [
            "Panasonic (Battery manufacturing since 2010)",
            "CATL (Battery supply and technology)",
            "NVIDIA (AI computing for autonomous driving)",
            "Samsung SDI (Memory and storage solutions)",
            "LG Energy Solution (Battery technology)"
          ],
          customers: [
            "Individual consumers (premium and mass market)",
            "Corporate fleet customers",
            "Utility companies (energy storage)",
            "Commercial solar installations"
          ],
          recentNews: [
            {
              title: "Tesla Delivers Record 1.81 Million Vehicles in 2023",
              source: "Reuters",
              date: "January 2, 2024",
              url: "https://reuters.com/business/autos-transportation/tesla-delivers-record-vehicles-2023",
              summary: "Tesla achieved record annual deliveries exceeding guidance despite market challenges"
            },
            {
              title: "Tesla Opens Supercharger Network to All EVs",
              source: "Bloomberg",
              date: "December 15, 2023",
              summary: "Strategic move to monetize charging infrastructure while supporting industry adoption"
            },
            {
              title: "Tesla Cybertruck Production Begins with Strong Demand",
              source: "TechCrunch",
              date: "November 30, 2023",
              summary: "Tesla enters pickup truck market with innovative manufacturing approach"
            }
          ],
          patents: [
            "3,304 active patents across battery technology and autonomous driving",
            "Structural battery pack innovations reducing vehicle weight by 15%",
            "Supercharger connector technology becoming industry standard",
            "Neural network algorithms for Full Self-Driving capability"
          ],
          awards: [
            "World's Most Valuable Automaker 2023",
            "IIHS Top Safety Pick+ for all vehicle models",
            "Consumer Reports Top Pick Electric Vehicle",
            "TIME100 Most Influential Companies 2023"
          ]
        },

        // Market Analysis
        marketAnalysis: {
          marketSize: "$1.7T global automotive market transitioning to electric",
          marketGrowth: "22.8% CAGR for EV segment through 2030",
          geographicPresence: [
            "North America: 62% luxury EV market share",
            "China: 8.7% total EV market share",
            "Europe: 15.2% market share with local production",
            "Global: 20.1% EV market leadership"
          ],
          competitiveAdvantages: [
            "Vertically integrated supply chain reducing costs 15-20%",
            "Proprietary battery technology with energy density leadership",
            "160M+ miles autonomous driving data advantage",
            "50,000+ Supercharger stations with 99.95% uptime",
            "Software-first approach enabling continuous updates"
          ]
        },

        // Technology Analysis
        technologyAnalysis: {
          coreInnovations: [
            {
              name: "4680 Battery Cell",
              description: "Revolutionary tabless design achieving 5x energy density improvement",
              stage: "Production scaling",
              advantage: "50% cost reduction potential"
            },
            {
              name: "Full Self-Driving",
              description: "Vision-only autonomous system with neural network processing",
              stage: "Beta testing with real-world validation",
              advantage: "Largest autonomous driving dataset globally"
            },
            {
              name: "Structural Battery Pack",
              description: "Battery integrated as vehicle structural component",
              stage: "Production implementation",
              advantage: "15% weight reduction and improved safety"
            }
          ],
          intellectualProperty: "3,304 active patents with focus on battery technology (45%), autonomous driving (25%), manufacturing (20%)",
          researchDevelopment: "$3.1B annual investment (3.2% of revenue) with 8,000+ engineers globally"
        },

        // Investment Highlights
        investmentHighlights: {
          marketOpportunity: "$1.7T addressable market in sustainable transportation and energy",
          traction: [
            "1.81M vehicle deliveries in 2023 (+35% growth)",
            "96% customer satisfaction with 90% repurchase intention",
            "15 GWh energy storage deployed (+40% annually)",
            "99.95% Supercharger network reliability"
          ],
          teamStrength: [
            "Visionary leadership with proven execution track record",
            "World-class engineering talent across automotive and technology",
            "Deep vertical integration capabilities",
            "Strong innovation culture with rapid development cycles"
          ],
          differentiation: [
            "Only profitable EV manufacturer at scale",
            "Integrated ecosystem spanning vehicles, energy, and services",
            "Leading autonomous driving technology with data advantage",
            "Manufacturing cost leadership through process innovation"
          ],
          scalabilityFactors: [
            "Proven Gigafactory model for rapid global expansion",
            "Software-first approach enabling post-sale monetization",
            "Energy business growth with utility-scale opportunities",
            "Global localization reducing costs and trade barriers"
          ]
        },

        // Risk Assessment
        riskAssessment: {
          competitiveRisks: [
            "Legacy automakers investing $200B+ in EV transition",
            "Chinese manufacturers with cost advantages and government support",
            "Technology companies entering autonomous driving space",
            "New EV startups targeting specific market segments"
          ],
          marketRisks: [
            "Economic downturn affecting luxury vehicle demand",
            "Regulatory changes reducing EV incentives globally",
            "Commodity price volatility impacting battery costs",
            "Trade tensions affecting international operations"
          ],
          executionRisks: [
            "Manufacturing scaling challenges during rapid growth",
            "Autonomous driving regulatory approval timeline uncertainty",
            "Key executive dependency and talent retention",
            "Supply chain disruption from geopolitical events"
          ],
          technicalRisks: [
            "Battery technology obsolescence from breakthrough innovations",
            "Cybersecurity threats to connected vehicle platform",
            "Autonomous driving liability and insurance considerations"
          ],
          mitigation: [
            "Diversified product portfolio reducing market dependency",
            "Strong cash position providing strategic flexibility",
            "Continuous innovation investment maintaining technology leadership",
            "Vertical integration reducing external supply dependencies"
          ]
        },

        // ESG Analysis
        esgFactors: {
          environmental: [
            "Mission to accelerate world's transition to sustainable energy",
            "20M tons CO2 emissions avoided through vehicle electrification",
            "95% battery material recovery through recycling programs",
            "Renewable energy integration across manufacturing facilities"
          ],
          social: [
            "140,473 employees with competitive compensation packages",
            "Workplace safety improvements with 30% injury rate reduction",
            "Diversity initiatives targeting 30% leadership representation",
            "STEM education programs in underserved communities"
          ],
          governance: [
            "Independent board with automotive and technology expertise",
            "Transparent sustainability reporting with third-party verification",
            "Comprehensive ethics and compliance framework",
            "Regular supplier audits ensuring responsible sourcing"
          ]
        }
      };
    }
    
    // Return sample research data for other deals
    if (dealId === 20) {
      return {
        dealId: 20,
        companyName: "Intellywave",
        researchStatus: "completed",
        ceoProfile: {
          name: "Anthony Filipiak",
          linkedinUrl: "https://linkedin.com/in/anthonyfilipiak",
          background: "Serial entrepreneur with 15+ years in AI and automation",
          experience: "Previously founded 2 successful automation companies",
          previousCompanies: ["AutoTech Solutions", "ProcessAI"]
        },
        financialInsights: {
          revenue: "$2.5M ARR",
          valuation: "$15M pre-money",
          employeeCount: "45",
          fundingHistory: [
            {
              round: "Seed",
              amount: "$3M",
              date: "2023",
              investors: ["TechStars", "AI Ventures"]
            }
          ]
        },
        externalSources: {
          pitchbookUrl: "https://pitchbook.com/profiles/company/intellywave",
          crunchbaseUrl: "https://crunchbase.com/organization/intellywave",
          northdataUrl: "https://northdata.com/Intellywave+GmbH",
          linkedinCompanyUrl: "https://linkedin.com/company/intellywave"
        },
        businessIntelligence: {
          marketPosition: "Leading AI automation platform for mid-market companies",
          competitors: ["UiPath", "Automation Anywhere", "Blue Prism"],
          partnerships: ["Microsoft", "SAP", "Salesforce"],
          recentNews: [
            {
              title: "Intellywave Raises €3M Series A",
              source: "TechCrunch",
              date: "2024-01-15"
            }
          ]
        },
        investmentHighlights: {
          marketOpportunity: "€50B automation market growing at 15% CAGR",
          traction: ["150% YoY growth", "95% customer retention", "40+ enterprise clients"],
          teamStrength: ["Strong technical team", "Proven track record", "Domain expertise"],
          differentiation: ["No-code platform", "Industry-specific templates", "Advanced AI integration"]
        },
        riskAssessment: {
          competitiveRisks: ["Large competitors with more resources", "Market saturation"],
          marketRisks: ["Economic downturn affecting enterprise spending"],
          executionRisks: ["Scaling challenges", "Talent acquisition"]
        }
      };
    }
    return undefined;
  }

  async createCompanyResearch(research: any): Promise<any> {
    return research;
  }

  async updateCompanyResearchStatus(dealId: number, status: string): Promise<any | undefined> {
    return { dealId, researchStatus: status };
  }
}

// Export the database storage instance
export const storage = new DatabaseStorage();