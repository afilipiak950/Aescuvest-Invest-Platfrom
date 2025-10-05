/**
 * Comprehensive Clinical Analysis Service
 * Analyzes ALL assigned clinical documents systematically for each question
 * Extracts specific evidence from documents and compiles complete answers
 */

import { db } from './db';
import { documents, agentAnalyses } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import OpenAI from 'openai';
import { storage } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Enhanced clinical questions for comprehensive analysis
export const COMPREHENSIVE_CLINICAL_QUESTIONS = [
  // Clinical Trial Protocols
  { 
    id: 'trial_1', 
    question: 'Clinical Trial/Study Characteristics', 
    category: 'Clinical Trial Protocols',
    subQuestions: [
      {
        id: 'trial_1a',
        question: 'What phase is the current trial (Phase I, II, III)?',
        expectedFormat: 'Phase [I/II/III/Pivotal/Validation] - [Study Name/ID] - [Status: Planned/Active/Completed]'
      },
      {
        id: 'trial_1b',
        question: 'Is the study design (randomized, controlled, blinded) specified?',
        expectedFormat: 'YES/NO - If YES: [Randomized Y/N], [Controlled Y/N], [Blinding: Double/Single/Open-label], [Sample Size: N=XX]'
      },
      {
        id: 'trial_1c',
        question: 'Are patient enrollment targets clearly defined?',
        expectedFormat: 'YES/NO - If YES: Target N=[number], Enrolled N=[number] ([%]% complete), Sites: [number], Timeline: [dates]'
      }
    ],
    analysisPrompt: `Extract SPECIFIC STATISTICS for each sub-question. Return structured answers with concrete numbers:

SUB-QUESTION 1: Trial Phase/Stage
- Identify exact phase: Phase I, Phase II, Phase III, Pivotal Study, Validation Study, Clinical Validation
- Extract study name/identifier (e.g., NET-MED-002, Study ABC)
- Current status: Planned, Recruiting, Active, Completed, or NOT SPECIFIED
- Format: "Phase [X] [Study Name] - Status: [X]" OR "NOT SPECIFIED in available documents"

SUB-QUESTION 2: Study Design
- Randomization: YES (ratio: X:X) or NO or NOT SPECIFIED
- Control group: YES (type: placebo/active/standard of care) or NO or NOT SPECIFIED  
- Blinding: Double-blind, Single-blind, Open-label, or NOT SPECIFIED
- Sample size: Target N=[number], Actual N=[number] or NOT SPECIFIED
- Format: "YES - Randomized 1:1, Double-blind, Placebo-controlled, N=100" OR "NO - Design not specified"

SUB-QUESTION 3: Enrollment Metrics
- Target enrollment: N=[specific number] or NOT SPECIFIED
- Current enrollment: N=[number] ([%]% of target) or NOT SPECIFIED
- Number of sites: [number] sites (list names if available) or NOT SPECIFIED
- Enrollment period: [start date] to [end date] or NOT SPECIFIED
- Enrollment rate: [number] patients/month (if calculable) or NOT SPECIFIED
- Format: "YES - Target N=100, Enrolled N=87 (87%), 3 sites, Jan-Dec 2022" OR "NO - Enrollment targets not disclosed"

CRITICAL RULES:
1. Extract ONLY concrete numbers and facts found in documents
2. Return "NOT SPECIFIED" for any missing data - DO NOT make assumptions
3. For each sub-question, start with YES/NO to indicate if information is available
4. Use exact numbers from documents (N=87, not "approximately 90")
5. Include source document names for all statistics`,
    keywords: [
      // Phase keywords
      'phase i', 'phase ii', 'phase iii', 'phase 1', 'phase 2', 'phase 3',
      'pivotal study', 'pivotal trial', 'validation study', 'clinical validation',
      'clinical study', 'clinical trial', 'study protocol',
      // Design keywords
      'randomized', 'randomised', 'controlled', 'blinded', 'double-blind', 'double blind',
      'single-blind', 'single blind', 'open-label', 'open label', 'parallel group', 'crossover',
      'placebo-controlled', 'active-controlled', 'comparative study',
      // Enrollment keywords
      'enrollment', 'enrolment', 'sample size', 'n=', 'n =', 'target enrollment',
      'recruitment', 'subjects enrolled', 'patients enrolled', 'enrollment target',
      'target sample', 'study population', 'recruitment target', 'recruitment goal'
    ]
  },
  { 
    id: 'trial_2', 
    question: 'Study Endpoints and Success Criteria', 
    category: 'Clinical Trial Protocols',
    subQuestions: [
      {
        id: 'trial_2a',
        question: 'What are the primary endpoints?',
        expectedFormat: 'YES/NO - If YES: List primary endpoints with measurement methods and target values'
      },
      {
        id: 'trial_2b',
        question: 'What are the secondary endpoints?',
        expectedFormat: 'YES/NO - If YES: List secondary endpoints with measurement methods'
      },
      {
        id: 'trial_2c',
        question: 'Are success criteria/targets specified for endpoints?',
        expectedFormat: 'YES/NO - If YES: Specify numerical targets (e.g., >90% accuracy, <5% error rate)'
      }
    ],
    analysisPrompt: `Extract SPECIFIC ENDPOINT DATA with concrete metrics:

SUB-QUESTION 1: Primary Endpoints
- List ALL primary endpoints mentioned in documents
- Include measurement method for each (e.g., heart rate accuracy, respiratory rate precision)
- Specify target values if available (e.g., "Sensitivity >95%", "Accuracy within ±3 bpm")
- Format: "YES - Primary endpoints: [1) Endpoint A (Method: X, Target: Y), 2) Endpoint B...]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Secondary Endpoints
- List ALL secondary endpoints mentioned
- Include measurement methods
- Note if exploratory vs confirmatory
- Format: "YES - Secondary endpoints: [1) Endpoint A, 2) Endpoint B...]" OR "NOT SPECIFIED"

SUB-QUESTION 3: Success Criteria
- Extract numerical success thresholds (e.g., "95% sensitivity required for approval")
- Include statistical power calculations if mentioned (e.g., "80% power to detect difference")
- Note regulatory endpoints vs clinical endpoints
- Format: "YES - Success criteria: [Endpoint A: >90%, Endpoint B: <5% error]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Extract ONLY concrete endpoints and numerical targets from documents
2. Return "NOT SPECIFIED" for missing data
3. Include source document names
4. Distinguish between primary, secondary, and exploratory endpoints`,
    keywords: [
      'primary endpoint', 'primary outcome', 'primary objective',
      'secondary endpoint', 'secondary outcome', 'secondary objective',
      'efficacy endpoint', 'clinical endpoint', 'surrogate endpoint', 'exploratory endpoint',
      'success criteria', 'target value', 'threshold', 'acceptance criteria',
      'sensitivity', 'specificity', 'accuracy', 'precision', 'ppv', 'npv',
      'performance metric', 'clinical outcome', 'endpoint definition'
    ]
  },
  { 
    id: 'trial_3', 
    question: 'Safety and Efficacy Assessment Methods', 
    category: 'Clinical Trial Protocols',
    subQuestions: [
      {
        id: 'trial_3a',
        question: 'What safety metrics and monitoring procedures are defined?',
        expectedFormat: 'YES/NO - If YES: List safety metrics (e.g., device malfunctions, user errors) and monitoring frequency'
      },
      {
        id: 'trial_3b',
        question: 'What efficacy measures and performance metrics are used?',
        expectedFormat: 'YES/NO - If YES: Specify efficacy metrics with target values (e.g., diagnostic accuracy >95%)'
      },
      {
        id: 'trial_3c',
        question: 'Are adverse event reporting procedures documented?',
        expectedFormat: 'YES/NO - If YES: Describe AE classification system and reporting timelines'
      }
    ],
    analysisPrompt: `Extract SPECIFIC SAFETY AND EFFICACY DATA:

SUB-QUESTION 1: Safety Metrics
- List all safety metrics tracked (device malfunctions, user errors, patient harm)
- Include monitoring frequency (e.g., "Daily safety checks", "Weekly review")
- Note safety committees or oversight (DSMB, Safety Monitoring Board)
- Format: "YES - Safety metrics: [1) Device malfunctions (monitored daily), 2) User errors (reviewed weekly)]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Efficacy Measures
- List performance metrics (accuracy, sensitivity, specificity, precision)
- Include target values (e.g., "Heart rate accuracy: ±3 bpm vs reference")
- Note comparison to gold standard or predicate device
- Format: "YES - Efficacy: [HR accuracy >95% vs ECG, RR precision ±2 breaths/min]" OR "NOT SPECIFIED"

SUB-QUESTION 3: Adverse Event Procedures
- Extract AE classification system (mild/moderate/severe, device-related/not related)
- Include reporting timelines (e.g., "SAEs within 24hrs", "AEs within 5 days")
- Note causality assessment methods
- Format: "YES - AE reporting: [Severity: mild/moderate/severe, Timeline: SAEs <24hrs, Device-related assessed]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Extract concrete safety and efficacy metrics with numerical targets
2. Distinguish between device safety (malfunctions) and patient safety (harm)
3. Include source documents for all metrics`,
    keywords: [
      'safety', 'safety monitoring', 'safety assessment', 'safety metrics', 'safety profile',
      'efficacy', 'effectiveness', 'performance', 'accuracy', 'precision',
      'sensitivity', 'specificity', 'ppv', 'npv', 'diagnostic accuracy',
      'adverse events', 'adverse event', 'ae', 'side effects', 'complications',
      'device malfunction', 'device failure', 'user error', 'usability',
      'dsmb', 'safety committee', 'safety monitoring board', 'safety review',
      'reporting', 'causality', 'severity', 'sae', 'serious adverse event'
    ]
  },
  // Regulatory Filings
  { 
    id: 'regulatory_1', 
    question: 'Regulatory Approval Status', 
    category: 'Regulatory Filings (FDA, EMA)',
    subQuestions: [
      {
        id: 'regulatory_1a',
        question: 'What FDA/EMA approvals or clearances have been obtained?',
        expectedFormat: 'YES/NO - If YES: List approvals with dates (e.g., "510(k) K123456 cleared March 2022")'
      },
      {
        id: 'regulatory_1b',
        question: 'What regulatory submissions are pending or in progress?',
        expectedFormat: 'YES/NO - If YES: List submissions with status and expected timelines'
      },
      {
        id: 'regulatory_1c',
        question: 'What international regulatory approvals exist (CE Mark, ISO, etc.)?',
        expectedFormat: 'YES/NO - If YES: List certifications with issuing bodies and dates'
      }
    ],
    analysisPrompt: `Extract SPECIFIC REGULATORY DATA with dates and numbers:

SUB-QUESTION 1: FDA/EMA Approvals
- List all FDA clearances (510(k), De Novo, PMA) with K-numbers and dates
- List EMA approvals or CE Mark certifications with dates
- Include indication/intended use for each approval
- Format: "YES - Approvals: [1) FDA 510(k) K234567 (cleared May 2022, indication: vital sign monitoring), 2) CE Mark (obtained June 2021)]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Pending Submissions
- List submissions in progress (IDE, PMA, 510(k) pending)
- Include submission dates and expected decision dates
- Note any FDA feedback or requests for additional information
- Format: "YES - Pending: [1) 510(k) submitted March 2023 (decision expected Q2 2024)]" OR "NOT SPECIFIED"

SUB-QUESTION 3: International Approvals
- List CE Mark, ISO certifications, Health Canada, other markets
- Include certification numbers and validity dates
- Note certification bodies (Notified Body for CE Mark)
- Format: "YES - International: [1) CE Mark (NB 1234, valid until 2025), 2) ISO 13485:2016]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Extract exact approval numbers (K-numbers, CE Mark certificate numbers)
2. Include all dates (submission, approval, expiration)
3. Return "NOT SPECIFIED" for missing information
4. Include source document names`,
    keywords: [
      'fda', 'fda clearance', 'fda approval', '510k', '510(k)', 'pma', 'de novo',
      'ide', 'ind', 'k number', 'k-number', 'premarket',
      'ema', 'ce mark', 'ce marking', 'mdd', 'mdr', 'notified body',
      'iso 13485', 'iso 14971', 'iso certification',
      'regulatory', 'approval', 'clearance', 'submission', 'filing',
      'marketing authorization', 'conformity assessment', 'regulatory pathway',
      'health canada', 'tga', 'pmda', 'cfda', 'international approval'
    ]
  },
  { 
    id: 'regulatory_2', 
    question: 'Regulatory Pathways and Designations', 
    category: 'Regulatory Filings (FDA, EMA)',
    subQuestions: [
      {
        id: 'regulatory_2a',
        question: 'What regulatory pathway was/is being used?',
        expectedFormat: 'YES/NO - If YES: Specify pathway (510(k), De Novo, PMA, Traditional) with rationale'
      },
      {
        id: 'regulatory_2b',
        question: 'Have any special designations been received?',
        expectedFormat: 'YES/NO - If YES: List designations (Breakthrough Device, Fast Track) with dates'
      }
    ],
    analysisPrompt: `Extract REGULATORY STRATEGY DATA:

SUB-QUESTION 1: Regulatory Pathway
- Identify pathway: 510(k) Traditional, 510(k) Special, De Novo, PMA, or other
- Include predicate device if 510(k) pathway
- Note pathway rationale (substantial equivalence, novel technology)
- Format: "YES - Pathway: 510(k) Traditional with predicate device XYZ (K123456)" OR "NOT SPECIFIED"

SUB-QUESTION 2: Special Designations
- List: Breakthrough Device Designation, Fast Track, Orphan Device
- Include designation dates and criteria met
- Note benefits received (expedited review, etc.)
- Format: "YES - Designations: [Breakthrough Device (granted Jan 2022, for sleep apnea monitoring)]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. For medical devices, focus on device-specific pathways (not drug pathways)
2. Include predicate devices for 510(k) submissions
3. Extract dates for all designations`,
    keywords: [
      '510k pathway', 'de novo', 'pma', 'traditional 510k', 'special 510k',
      'predicate device', 'substantial equivalence',
      'breakthrough device', 'breakthrough designation',
      'fast track', 'expedited', 'priority review',
      'orphan device', 'orphan designation', 'humanitarian device',
      'regulatory strategy', 'regulatory pathway', 'submission strategy'
    ]
  },
  { 
    id: 'regulatory_3', 
    question: 'Adverse Events and Safety Reporting', 
    category: 'Regulatory Filings (FDA, EMA)',
    subQuestions: [
      {
        id: 'regulatory_3a',
        question: 'How many adverse events have been reported?',
        expectedFormat: 'YES/NO - If YES: Total AEs: [number], SAEs: [number], Device-related: [number]'
      },
      {
        id: 'regulatory_3b',
        question: 'What is the severity distribution of adverse events?',
        expectedFormat: 'YES/NO - If YES: Mild: [number], Moderate: [number], Severe: [number]'
      },
      {
        id: 'regulatory_3c',
        question: 'Are post-market surveillance or MDR reports documented?',
        expectedFormat: 'YES/NO - If YES: Specify reporting system (MAUDE, Eudamed) and number of reports'
      }
    ],
    analysisPrompt: `Extract ADVERSE EVENT STATISTICS:

SUB-QUESTION 1: AE Counts
- Total adverse events: [exact number]
- Serious adverse events (SAEs): [exact number]
- Device-related AEs: [exact number] vs non-device-related
- Format: "YES - AEs: Total N=25 (SAEs: N=3, Device-related: N=8)" OR "NOT SPECIFIED"

SUB-QUESTION 2: Severity Distribution
- Mild AEs: [number and percentage]
- Moderate AEs: [number and percentage]
- Severe AEs: [number and percentage]
- Format: "YES - Severity: Mild N=15 (60%), Moderate N=8 (32%), Severe N=2 (8%)" OR "NOT SPECIFIED"

SUB-QUESTION 3: Post-Market Surveillance
- MAUDE reports: [number of reports]
- MDR reports to notified body: [number]
- Recall history: [any recalls with dates]
- Format: "YES - Post-market: [MAUDE reports: N=5, No recalls]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Extract EXACT numbers for all AE counts
2. Calculate percentages if totals are available
3. Distinguish between device-related and non-device-related AEs
4. Include source documents for all statistics`,
    keywords: [
      'adverse events', 'adverse event', 'ae', 'aes',
      'serious adverse event', 'sae', 'saes',
      'device-related', 'device related', 'causality',
      'mild', 'moderate', 'severe', 'severity', 'grade',
      'maude', 'mdr', 'medical device reporting', 'post-market surveillance',
      'recall', 'field safety notice', 'fsn', 'safety alert',
      'vigilance', 'safety reporting', 'periodic safety update'
    ]
  },
  // Investigator Brochures & Study Reports
  { 
    id: 'study_1', 
    question: 'Patient Selection Criteria', 
    category: 'Investigator Brochures & Study Reports',
    subQuestions: [
      {
        id: 'study_1a',
        question: 'What are the key inclusion criteria?',
        expectedFormat: 'YES/NO - If YES: List criteria (e.g., age range, diagnosis, setting)'
      },
      {
        id: 'study_1b',
        question: 'What are the key exclusion criteria?',
        expectedFormat: 'YES/NO - If YES: List criteria (e.g., contraindications, comorbidities)'
      },
      {
        id: 'study_1c',
        question: 'Are criteria consistent across studies?',
        expectedFormat: 'YES/NO - If YES: Note any variations between studies'
      }
    ],
    analysisPrompt: `Extract PATIENT SELECTION CRITERIA:

SUB-QUESTION 1: Inclusion Criteria
- List all inclusion criteria (age, diagnosis, setting, health status)
- Include specific ranges (e.g., "Age 18-65 years", "Hospitalized patients")
- Note intended use population
- Format: "YES - Inclusion: [1) Age ≥18 years, 2) Hospital in-patient setting, 3) Requires continuous monitoring]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Exclusion Criteria
- List all exclusion criteria (contraindications, pacemakers, pregnancy)
- Include medical exclusions and device incompatibilities
- Note safety-based exclusions
- Format: "YES - Exclusion: [1) Pacemaker/ICD present, 2) Pregnant/breastfeeding, 3) Severe skin conditions]" OR "NOT SPECIFIED"

SUB-QUESTION 3: Consistency
- Compare criteria across different studies if multiple exist
- Note any variations or expansions over time
- Identify if real-world use differs from study criteria
- Format: "YES - Consistent across 3 studies" OR "NO - Variations: [Study A allowed age 18+, Study B required age 21+]"

CRITICAL RULES:
1. Extract specific numerical ranges (ages, lab values)
2. Distinguish medical vs technical exclusions
3. Note if criteria match intended use population`,
    keywords: [
      'inclusion criteria', 'inclusion criterion', 'eligible', 'eligibility',
      'exclusion criteria', 'exclusion criterion', 'excluded', 'contraindication',
      'patient selection', 'subject selection', 'enrollment criteria',
      'age range', 'diagnosis', 'indication', 'setting',
      'screening', 'screen failure', 'enrollment'
    ]
  },
  { 
    id: 'study_2', 
    question: 'Patient Population Demographics', 
    category: 'Investigator Brochures & Study Reports',
    subQuestions: [
      {
        id: 'study_2a',
        question: 'What patient demographics are described?',
        expectedFormat: 'YES/NO - If YES: Age (mean/median/range), Gender (% male/female), Race/Ethnicity (%)'
      },
      {
        id: 'study_2b',
        question: 'What clinical characteristics are described?',
        expectedFormat: 'YES/NO - If YES: Disease severity, comorbidities, vital sign ranges'
      },
      {
        id: 'study_2c',
        question: 'What is the target market population size?',
        expectedFormat: 'YES/NO - If YES: Total addressable market size, prevalence data'
      }
    ],
    analysisPrompt: `Extract DEMOGRAPHIC AND CLINICAL DATA:

SUB-QUESTION 1: Demographics
- Age: mean, median, range, SD (e.g., "Mean 58.3±12.4 years, range 22-89")
- Gender: % male, % female, total N
- Race/ethnicity distribution if reported
- Format: "YES - Demographics: [Age 58.3±12.4 years, 56% male, N=87]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Clinical Characteristics
- Disease severity (mild/moderate/severe percentages)
- Comorbidity prevalence (diabetes %, hypertension %)
- Baseline vital signs or clinical measures
- Format: "YES - Clinical: [Severity: mild 40%, moderate 45%, severe 15%; Diabetes 30%]" OR "NOT SPECIFIED"

SUB-QUESTION 3: Market Size
- Total addressable market (e.g., "15M patients in US")
- Disease prevalence data
- Target segment size
- Format: "YES - Market: [Sleep apnea: 30M US adults, target hospital segment: 5,000 facilities]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Extract exact demographic numbers with standard deviations
2. Calculate and verify percentages
3. Distinguish between study population and target market`,
    keywords: [
      'demographics', 'demographic', 'patient characteristics',
      'age', 'gender', 'sex', 'male', 'female', 'race', 'ethnicity',
      'mean age', 'median age', 'age range',
      'disease severity', 'comorbidity', 'comorbidities', 'baseline',
      'prevalence', 'incidence', 'epidemiology',
      'target population', 'addressable market', 'tam', 'market size'
    ]
  },
  { 
    id: 'study_3', 
    question: 'Clinical Outcomes and Performance Data', 
    category: 'Investigator Brochures & Study Reports',
    subQuestions: [
      {
        id: 'study_3a',
        question: 'What are the key clinical outcomes or results?',
        expectedFormat: 'YES/NO - If YES: List outcomes with statistical significance (p-values, confidence intervals)'
      },
      {
        id: 'study_3b',
        question: 'What performance metrics were achieved?',
        expectedFormat: 'YES/NO - If YES: Accuracy %, Sensitivity %, Specificity % with confidence intervals'
      },
      {
        id: 'study_3c',
        question: 'Are real-world evidence or post-market data available?',
        expectedFormat: 'YES/NO - If YES: Number of devices deployed, patient-hours of use, field performance data'
      }
    ],
    analysisPrompt: `Extract CLINICAL OUTCOMES AND PERFORMANCE:

SUB-QUESTION 1: Clinical Outcomes
- List primary outcome results with p-values
- Include confidence intervals (95% CI)
- Note statistical significance
- Format: "YES - Outcomes: [HR detection accuracy 96.2% (95% CI: 94.1-98.3%, p<0.001 vs reference)]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Performance Metrics
- Sensitivity: [%] (95% CI: [range])
- Specificity: [%] (95% CI: [range])
- Accuracy, PPV, NPV with CIs
- Format: "YES - Performance: [Sensitivity 95.3% (CI: 92.1-97.8%), Specificity 94.7% (CI: 91.2-97.1%)]" OR "NOT SPECIFIED"

SUB-QUESTION 3: Real-World Evidence
- Number of devices deployed commercially
- Total patient-hours or patient-days of monitoring
- Field performance vs study performance
- Format: "YES - RWE: [>500 devices deployed, >100,000 patient-hours, field accuracy 94.1%]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Extract exact performance numbers with confidence intervals
2. Include p-values for statistical significance
3. Distinguish between study data and real-world data`,
    keywords: [
      'clinical outcomes', 'results', 'findings', 'data',
      'accuracy', 'sensitivity', 'specificity', 'ppv', 'npv',
      'performance', 'performance metrics', 'diagnostic accuracy',
      'p value', 'p-value', 'statistical significance', 'confidence interval', 'ci',
      'real-world evidence', 'rwe', 'post-market', 'field data',
      'devices deployed', 'commercial experience', 'patient-hours'
    ]
  },
  // Scientific Advisory Board Notes
  { 
    id: 'advisory_1', 
    question: 'Clinical Validation and Expert Opinion', 
    category: 'Scientific Advisory Board Notes',
    subQuestions: [
      {
        id: 'advisory_1a',
        question: 'What expert endorsements or validations exist?',
        expectedFormat: 'YES/NO - If YES: List KOLs/institutions with their credentials and endorsement details'
      },
      {
        id: 'advisory_1b',
        question: 'Are there peer-reviewed publications or presentations?',
        expectedFormat: 'YES/NO - If YES: List publications with journal names, dates, and key findings'
      },
      {
        id: 'advisory_1c',
        question: 'What advisory board feedback has been documented?',
        expectedFormat: 'YES/NO - If YES: Summarize recommendations and strategic guidance'
      }
    ],
    analysisPrompt: `Extract EXPERT VALIDATION DATA:

SUB-QUESTION 1: Expert Endorsements
- List key opinion leaders (names, titles, institutions)
- Include nature of endorsement (advisory board, investigator, consultant)
- Note prestigious affiliations (Mayo Clinic, Cleveland Clinic, etc.)
- Format: "YES - Experts: [1) Dr. John Smith, Chief of Cardiology, Mayo Clinic (Principal Investigator), 2) Dr. Jane Doe, Harvard Medical School (Advisory Board)]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Publications
- List peer-reviewed publications (journal, date, authors)
- Include conference presentations (venue, date)
- Note key findings from each publication
- Format: "YES - Publications: [1) JAMA Cardiology 2022 (Sleep monitoring accuracy), 2) ACC 2023 presentation]" OR "NOT SPECIFIED"

SUB-QUESTION 3: Advisory Board Feedback
- Summarize strategic recommendations
- Include clinical validation feedback
- Note market access or reimbursement guidance
- Format: "YES - Advisory feedback: [Recommended expanding to ICU setting, validated clinical utility, suggested CPT code strategy]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Include full credentials for KOLs
2. List exact publication citations
3. Extract actionable recommendations from advisory boards`,
    keywords: [
      'advisory board', 'scientific advisory board', 'medical advisory',
      'key opinion leader', 'kol', 'thought leader',
      'expert opinion', 'expert review', 'expert endorsement',
      'publication', 'peer-reviewed', 'journal', 'paper', 'manuscript',
      'conference', 'presentation', 'poster', 'abstract',
      'validation', 'endorsement', 'recommendation'
    ]
  },
  { 
    id: 'advisory_2', 
    question: 'Development Roadmap and Commercialization', 
    category: 'Scientific Advisory Board Notes',
    subQuestions: [
      {
        id: 'advisory_2a',
        question: 'What are the next development milestones?',
        expectedFormat: 'YES/NO - If YES: List milestones with target dates (e.g., "FDA submission Q2 2024")'
      },
      {
        id: 'advisory_2b',
        question: 'What is the commercialization timeline?',
        expectedFormat: 'YES/NO - If YES: Market launch dates, geographic expansion plans, partnership timeline'
      },
      {
        id: 'advisory_2c',
        question: 'Are reimbursement and market access strategies defined?',
        expectedFormat: 'YES/NO - If YES: CPT codes pursued, payer strategies, pricing approach'
      }
    ],
    analysisPrompt: `Extract DEVELOPMENT AND COMMERCIALIZATION PLANS:

SUB-QUESTION 1: Development Milestones
- List upcoming regulatory milestones with dates
- Include clinical study plans
- Note product development timeline
- Format: "YES - Milestones: [1) FDA 510(k) submission Q2 2024, 2) Pivotal study completion Q4 2023, 3) CE Mark renewal Q1 2024]" OR "NOT SPECIFIED"

SUB-QUESTION 2: Commercialization Timeline
- Market launch dates (US, EU, other regions)
- Partnership or distribution agreements with dates
- Manufacturing scale-up timeline
- Format: "YES - Launch: [US market Q3 2024, EU Q4 2024, Partnership with Siemens signed March 2023]" OR "NOT SPECIFIED"

SUB-QUESTION 3: Reimbursement Strategy
- CPT codes applied for or obtained (with dates)
- Payer coverage strategies (CMS, private payers)
- Pricing approach (ASP, per-patient, subscription)
- Format: "YES - Reimbursement: [CPT code application filed Jan 2024, CMS coverage decision expected Q3 2024, Pricing: $350/patient/month]" OR "NOT SPECIFIED"

CRITICAL RULES:
1. Extract specific dates for all milestones
2. Include dollar amounts for pricing or deals
3. Note partnerships with major institutions or companies`,
    keywords: [
      'roadmap', 'timeline', 'milestones', 'development plan',
      'next steps', 'future plans', 'strategy',
      'commercialization', 'launch', 'market entry', 'go-to-market',
      'reimbursement', 'cpt code', 'cms', 'payer', 'coverage',
      'pricing', 'asp', 'price point', 'business model',
      'partnership', 'distribution', 'channel', 'scale-up'
    ]
  }
];

export interface ClinicalAnalysisProgress {
  isRunning: boolean;
  progress: number;
  message: string;
  currentStep?: string;
  totalSteps?: number;
  currentQuestion?: string;
}

interface ClinicalEvidence {
  documentName: string;
  documentSummary: string;
  relevantContent: string[];
  keyFindings: string[];
  confidence: number;
}

interface ClinicalAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  detailedEvidence: ClinicalEvidence[];
  keyFindings: string[];
  evidenceSummary: string;
  clinicalAssessment: string;
  recommendations: string[];
}

export class ComprehensiveClinicalAnalysisService {
  
  /**
   * BUILD COMPREHENSIVE CONTENT FROM AI SUMMARY
   * Extracts ALL sections of AI summary for maximum context
   */
  private buildComprehensiveContent(document: any): string {
    const parts = [];
    
    // PRIORITY 1: AI Summary (FULL STRUCTURE - all sections)
    if (document.aiSummary) {
      console.log(`📝 Using AI Summary for ${document.name} - Full structure extraction`);
      
      if (document.aiSummary.executiveSummary) {
        parts.push(`=== EXECUTIVE SUMMARY ===\n${document.aiSummary.executiveSummary}`);
      }
      
      if (document.aiSummary.criticalInformation) {
        const criticalInfo = typeof document.aiSummary.criticalInformation === 'string' 
          ? document.aiSummary.criticalInformation 
          : JSON.stringify(document.aiSummary.criticalInformation, null, 2);
        parts.push(`=== CRITICAL INFORMATION ===\n${criticalInfo}`);
      }
      
      if (document.aiSummary.keyFinancialData) {
        const financialData = typeof document.aiSummary.keyFinancialData === 'string'
          ? document.aiSummary.keyFinancialData
          : JSON.stringify(document.aiSummary.keyFinancialData, null, 2);
        parts.push(`=== KEY FINANCIAL DATA ===\n${financialData}`);
      }
      
      if (document.aiSummary.riskAssessment) {
        const riskData = typeof document.aiSummary.riskAssessment === 'string'
          ? document.aiSummary.riskAssessment
          : JSON.stringify(document.aiSummary.riskAssessment, null, 2);
        parts.push(`=== RISK ASSESSMENT ===\n${riskData}`);
      }
      
      if (document.aiSummary.backgroundInformation) {
        parts.push(`=== BACKGROUND INFORMATION ===\n${document.aiSummary.backgroundInformation}`);
      }
      
      if (document.aiSummary.documentType) {
        parts.push(`=== DOCUMENT TYPE ===\n${document.aiSummary.documentType}`);
      }
    }
    
    // PRIORITY 2: OCR Text (FALLBACK ONLY - increased to 8000 chars)
    if (parts.length === 0 && document.ocrText) {
      console.log(`📝 Falling back to OCR text for ${document.name} (AI summary not available)`);
      parts.push(`=== DOCUMENT TEXT ===\n${document.ocrText.substring(0, 8000)}`);
    }
    
    const content = parts.join('\n\n');
    console.log(`📊 Content built for ${document.name}: ${content.length} characters from ${parts.length} sections`);
    return content;
  }
  
  /**
   * Run comprehensive analysis for all assigned clinical documents
   */
  async runComprehensiveAnalysis(dealId: number, storageService: any, jobId: string): Promise<any> {
    console.log(`🧬 Starting comprehensive clinical analysis for deal ${dealId}`);
    
    try {
      // Get all clinical documents
      const assignedDocuments = await this.getAssignedClinicalDocuments(dealId);
      console.log(`📄 Found ${assignedDocuments.length} clinical documents for analysis`);
      
      if (assignedDocuments.length === 0) {
        console.log('⚠️ No clinical documents found for analysis');
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          progress: 100,
          currentStep: 'No clinical documents available for analysis'
        });
        return { success: false, message: 'No clinical documents found' };
      }
      
      // Initialize progress
      await storageService.updateBackgroundJob(jobId, {
        progress: 5,
        currentStep: 'Starting clinical analysis',
        processedDocuments: 0,
        totalDocuments: COMPREHENSIVE_CLINICAL_QUESTIONS.length
      });
      
      // Process each question systematically
      const clinicalAnswers: Record<string, any> = {};
      
      for (let i = 0; i < COMPREHENSIVE_CLINICAL_QUESTIONS.length; i++) {
        const question = COMPREHENSIVE_CLINICAL_QUESTIONS[i];
        console.log(`🔍 Processing clinical question ${i + 1}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}: ${question.question}`);
        
        // Update progress - Start at 0% like Legal (removed +5 offset)
        const progress = Math.round(((i + 1) / COMPREHENSIVE_CLINICAL_QUESTIONS.length) * 100);
        await storageService.updateBackgroundJob(jobId, {
          progress,
          currentDocumentName: question.question,
          currentStep: `Analyzing: ${question.category}`,
          processedDocuments: i
        });
        
        try {
          console.log(`📊 Extracting clinical evidence for: ${question.question}`);
          
          // Extract evidence from ALL documents for this question
          const documentEvidence = await this.extractEvidenceFromAllDocuments(
            assignedDocuments, 
            question
          );
          console.log(`📊 Evidence extraction completed for question: ${question.question}`);
          
          // Compile comprehensive answer with timeout - EXACT Legal approach
          console.log(`🤖 Starting OpenAI analysis for question: ${question.question} with ${documentEvidence.length} pieces of evidence`);
          const answer = await Promise.race([
            this.compileComprehensiveAnswer(question, documentEvidence),
            new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI analysis timeout')), 60000)) // 60 second timeout
          ]);
          clinicalAnswers[question.id] = answer;
          console.log(`🤖 OpenAI analysis completed for question: ${question.question}`);
          
          console.log(`✅ Completed question ${i + 1}/${COMPREHENSIVE_CLINICAL_QUESTIONS.length}: ${question.question}`);
          
          // Brief delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (questionError) {
          console.error(`❌ Error processing question "${question.question}":`, questionError);
          
          // Store partial answer for this question
          clinicalAnswers[question.id] = {
            question: question.question,
            category: question.category,
            answer: `Error processing this question: ${questionError.message}`,
            confidence: 0,
            sources: [],
            evidence: [],
            error: true
          };
          
          // Update progress to continue processing
          await storageService.updateBackgroundJob(jobId, {
            progress: Math.round((i / COMPREHENSIVE_CLINICAL_QUESTIONS.length) * 100),
            processedDocuments: i,
            currentDocumentName: `Error: ${question.question}`,
            currentStep: `Error in: ${question.category}`
          });
          
          // Continue with next question instead of failing completely
          continue;
        }
      }
      
      try {
        // Update progress to completion
        await storageService.updateBackgroundJob(jobId, {
          progress: 100,
          processedDocuments: COMPREHENSIVE_CLINICAL_QUESTIONS.length,
          currentStep: 'Generating findings and recommendations',
          status: 'completing'
        });
        
        // Generate comprehensive findings and recommendations
        const findings = this.generateComprehensiveFindings(clinicalAnswers);
        const recommendations = this.generateComprehensiveRecommendations(clinicalAnswers);
        
        // Store the analysis results
        await this.storeComprehensiveResults(dealId, clinicalAnswers, findings, recommendations, assignedDocuments);
        
        // Mark job as completed
        await storageService.updateBackgroundJob(jobId, {
          status: 'completed',
          currentStep: 'Analysis completed'
        });
        
        console.log(`✅ Comprehensive clinical analysis completed for deal ${dealId}`);
        
        return {
          success: true,
          documentsAnalyzed: assignedDocuments.length,
          questionsAnswered: Object.keys(clinicalAnswers).length,
          findings: findings.length,
          recommendations: recommendations.length
        };
      } catch (finalError) {
        console.error(`❌ Error in final stages of clinical analysis for deal ${dealId}:`, finalError);
        
        // Still try to save what we have
        try {
          const partialFindings = this.generateComprehensiveFindings(clinicalAnswers);
          const partialRecommendations = this.generateComprehensiveRecommendations(clinicalAnswers);
          await this.storeComprehensiveResults(dealId, clinicalAnswers, partialFindings, partialRecommendations, assignedDocuments);
          
          // Mark as completed with error
          await storageService.updateBackgroundJob(jobId, {
            status: 'completed',
            currentStep: 'Completed with partial results due to errors',
            error: finalError.message
          });
          
          return {
            success: true,
            documentsAnalyzed: assignedDocuments.length,
            questionsAnswered: Object.keys(clinicalAnswers).length,
            findings: partialFindings.length,
            recommendations: partialRecommendations.length,
            warning: 'Analysis completed with some errors'
          };
        } catch (saveError) {
          // Mark job as failed
          await storageService.updateBackgroundJob(jobId, {
            status: 'failed',
            error: `Final error: ${finalError.message}, Save error: ${saveError.message}`
          });
          throw finalError;
        }
      }
    } catch (error) {
      console.error(`❌ Critical error in clinical analysis for deal ${dealId}:`, error);
      
      await storageService.updateBackgroundJob(jobId, {
        status: 'failed',
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Get all documents suitable for clinical analysis
   */
  private async getAssignedClinicalDocuments(dealId: number): Promise<any[]> {
    const allDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.dealId, dealId));
    
    console.log(`📄 Total documents found for deal ${dealId}: ${allDocuments.length}`);
    
    // First try documents explicitly assigned to clinical agent
    let clinicalDocuments = allDocuments.filter(doc => 
      (doc.assignedAgents && doc.assignedAgents.includes('clinical')) && 
      (doc.ocrText || doc.aiSummary)
    );
    
    console.log(`📄 Documents explicitly assigned to clinical: ${clinicalDocuments.length}`);
    
    // If no documents are explicitly assigned to clinical, identify clinical-related documents
    if (clinicalDocuments.length === 0) {
      console.log('📄 No documents explicitly assigned to clinical agent, identifying clinical-related documents...');
      
      clinicalDocuments = allDocuments.filter(doc => {
        if (!doc.ocrText && !doc.aiSummary) return false;
        
        const docName = doc.name.toLowerCase();
        const docContent = (doc.ocrText || '').toLowerCase();
        const aiSummary = doc.aiSummary;
        
        // Clinical document keywords
        const clinicalKeywords = [
          'clinical', 'trial', 'study', 'protocol', 'patient', 'fda', 'ema', 
          'regulatory', 'phase', 'efficacy', 'safety', 'adverse', 'endpoint',
          'enrollment', 'randomized', 'blinded', 'placebo', 'investigator',
          'brochure', 'medical', 'therapeutic', 'treatment', 'drug',
          'device', 'approval', 'submission', 'ide', 'ind', '510k',
          'orphan', 'fast-track', 'breakthrough', 'serious adverse event'
        ];
        
        // Check document name and content for clinical keywords
        const hasClinicalKeywords = clinicalKeywords.some(keyword => 
          docName.includes(keyword) || docContent.includes(keyword)
        );
        
        // Check AI summary for clinical document type
        const isClinicalDocument = aiSummary?.documentType?.toLowerCase().includes('clinical') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('clinical') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('trial') ||
                                 aiSummary?.executiveSummary?.toLowerCase().includes('study');
        
        return hasClinicalKeywords || isClinicalDocument;
      });
      
      console.log(`📄 Auto-identified clinical documents: ${clinicalDocuments.length}`);
    }
    
    // If still no clinical documents, take documents with meaningful content for analysis
    if (clinicalDocuments.length === 0) {
      console.log('📄 No clinical-related documents found, using all documents with OCR text...');
      clinicalDocuments = allDocuments.filter(doc => 
        (doc.ocrText && doc.ocrText.length > 100) || doc.aiSummary
      );
      console.log(`📄 Documents with content available: ${clinicalDocuments.length}`);
    }
    
    // 🚀 IMPROVEMENT: Remove 50-document cap - analyze ALL assigned documents
    // AI summaries are much shorter than OCR, enabling analysis of all documents
    console.log(`📊 QA CHECKPOINT: Will analyze ALL ${clinicalDocuments.length} clinical documents (no artificial limit)`);
    
    // Log AI summary vs OCR distribution for quality assurance
    const withAiSummary = clinicalDocuments.filter(doc => doc.aiSummary).length;
    const withOcrOnly = clinicalDocuments.filter(doc => !doc.aiSummary && doc.ocrText).length;
    const empty = clinicalDocuments.filter(doc => !doc.aiSummary && !doc.ocrText).length;
    
    console.log(`📊 QA CHECKPOINT - Document Quality Distribution:`);
    console.log(`  ✅ ${withAiSummary} documents with AI Summary (${Math.round(withAiSummary/clinicalDocuments.length*100)}%)`);
    console.log(`  📄 ${withOcrOnly} documents with OCR only (${Math.round(withOcrOnly/clinicalDocuments.length*100)}%)`);
    console.log(`  ⚠️  ${empty} empty documents (${Math.round(empty/clinicalDocuments.length*100)}%)`);
    
    return clinicalDocuments;
  }
  
  /**
   * Extract evidence from ALL documents for a specific question
   * 🚀 IMPROVEMENT: Increased batch size, added error resilience
   */
  private async extractEvidenceFromAllDocuments(
    documents: any[], 
    question: any
  ): Promise<any[]> {
    console.log(`📄 Starting evidence extraction from ${documents.length} documents for: ${question.question}`);
    
    // 🚀 IMPROVEMENT: Increased batch size from 10 to 20 (AI summaries are shorter)
    const BATCH_SIZE = 20;
    const evidence = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const batch = documents.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(documents.length / BATCH_SIZE);
      
      console.log(`📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} documents`);
      
      // 🚀 IMPROVEMENT: Use Promise.allSettled for error resilience
      const batchResults = await Promise.allSettled(
        batch.map(async (doc) => {
          try {
            return await this.extractEvidenceFromDocument(doc, question);
          } catch (error) {
            console.error(`❌ Failed to extract from ${doc.name}:`, error);
            return null;
          }
        })
      );
      
      // Filter successful results with relevant content
      const validEvidence = batchResults
        .filter((result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value?.relevantContent?.length > 0
        )
        .map(result => result.value);
      
      const batchSuccesses = batchResults.filter(r => r.status === 'fulfilled').length;
      const batchFailures = batchResults.filter(r => r.status === 'rejected').length;
      
      successCount += batchSuccesses;
      failureCount += batchFailures;
      
      evidence.push(...validEvidence);
      
      console.log(`✅ Batch ${batchNum} completed: ${validEvidence.length}/${batch.length} had relevant evidence (${batchFailures} failures)`);
      
      // 🚀 IMPROVEMENT: Rate limiting between batches (1 second)
      if (i + BATCH_SIZE < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`📊 QA CHECKPOINT - Extraction Results: ${evidence.length}/${documents.length} documents with evidence (${successCount} success, ${failureCount} failures)`);
    
    // Alert if >20% failure rate
    if (failureCount / documents.length > 0.2) {
      console.warn(`⚠️  HIGH FAILURE RATE: ${Math.round(failureCount/documents.length*100)}% of documents failed extraction`);
    }
    
    return evidence;
  }
  
  /**
   * Extract specific evidence from a single document
   * 🚀 IMPROVEMENT: Uses full AI summary structure + enhanced prompt
   */
  private async extractEvidenceFromDocument(document: any, question: any): Promise<any> {
    // 🚀 IMPROVEMENT: Use comprehensive content builder (AI summary priority)
    const content = this.buildComprehensiveContent(document);
    
    if (!content || content.length < 50) {
      console.log(`⚠️ Skipping ${document.name} - insufficient content`);
      return null;
    }
    
    // 🚀 IMPROVEMENT: Enhanced prompt with clinical metrics extraction
    const prompt = `You are a senior clinical development analyst conducting FDA/EMA-level due diligence. This document has been pre-analyzed with AI summary extraction.

DOCUMENT: ${document.name}

=== PRE-EXTRACTED AI SUMMARY ===
${content}

=== CLINICAL QUESTION ===
"${question.question}"

ANALYSIS TASK: ${question.analysisPrompt}

KEYWORDS TO PRIORITIZE: ${question.keywords.join(', ')}

INSTRUCTIONS:
1. **Prioritize AI Summary Sections:**
   - Critical Information section contains pre-extracted key data
   - Risk Assessment section contains pre-identified risks
   - Financial Data section contains quantified metrics
   
2. **Extract with Clinical Precision:**
   - Trial phases (Phase I/II/III/IV)
   - Patient numbers (N=X enrolled, Y completed)
   - Efficacy metrics (p-values, confidence intervals, effect sizes)
   - Safety signals (SAE rates, discontinuation rates)
   - Regulatory milestones (FDA submissions, EMA approvals)
   
3. **Confidence Scoring:**
   - 90-100: Direct clinical data with statistics
   - 70-89: Clear clinical findings without full statistics
   - 50-69: Indirect clinical relevance
   - Below 50: Minimal clinical relevance

Return JSON:
{
  "relevantContent": ["Exact quote 1 with context", "Exact quote 2 with context"],
  "hasRelevantInfo": true/false,
  "confidence": 0-100,
  "keyFindings": ["Finding 1 with specificity", "Finding 2 with numbers"],
  "documentSummary": "Clinical relevance summary",
  "clinicalMetrics": {
    "trialPhase": "Phase I/II/III/IV or null",
    "patientNumbers": "N=X or null",
    "efficacyData": "Primary endpoint result or null",
    "safetyData": "SAE rate or key safety finding or null"
  },
  "dataQuality": "high/medium/low",
  "missingCriticalInfo": ["What's missing for complete clinical assessment"]
}

Be thorough and extract specific numbers, percentages, and clinical metrics.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8000  // INCREASED: Prevent truncation
      });
      
      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // 🚀 IMPROVEMENT: Return enhanced evidence with clinical metrics
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: analysis.relevantContent || [],
        hasRelevantInfo: analysis.hasRelevantInfo || false,
        confidence: analysis.confidence || 0,
        keyFindings: analysis.keyFindings || [],
        documentSummary: analysis.documentSummary || '',
        clinicalMetrics: analysis.clinicalMetrics || {},
        dataQuality: analysis.dataQuality || 'unknown',
        missingCriticalInfo: analysis.missingCriticalInfo || [],
        fullContent: content.substring(0, 1000) // Keep sample for reference
      };
      
    } catch (error) {
      console.error(`Error extracting evidence from ${document.name}:`, error);
      return {
        documentName: document.name,
        documentId: document.id,
        relevantContent: [],
        hasRelevantInfo: false,
        confidence: 0,
        keyFindings: [],
        documentSummary: 'Analysis failed',
        clinicalMetrics: {},
        dataQuality: 'low',
        missingCriticalInfo: ['Extraction failed'],
        fullContent: ''
      };
    }
  }
  
  /**
   * Compile comprehensive answer based on all evidence
   */
  private async compileComprehensiveAnswer(question: any, evidence: any[]): Promise<any> {
    console.log(`🔍 Compiling answer for: ${question.question}`);
    console.log(`📋 Evidence count: ${evidence.length}`);
    
    if (evidence.length === 0) {
      console.log(`⚠️ No evidence found for question: ${question.question}`);
      return {
        question: question.question,
        answer: `No relevant clinical information found in the assigned clinical documents for this question.`,
        confidence: 10,
        sources: [],
        evidenceCount: 0,
        keyFindings: [],
        gaps: ['No relevant clinical information found'],
        category: question.category
      };
    }

    // 🚀 IMPROVEMENT: Enhanced evidence summary with clinical metrics
    const evidenceSummary = evidence.map(ev => ({
      document: ev.documentName,
      content: ev.relevantContent.join(' | '),
      findings: ev.keyFindings.join(' | '),
      confidence: ev.confidence,
      clinicalMetrics: ev.clinicalMetrics || {},
      dataQuality: ev.dataQuality || 'unknown',
      missingInfo: ev.missingCriticalInfo || []
    }));

    // 🚀 IMPROVEMENT: Enhanced compilation prompt with clinical metrics aggregation
    const prompt = `You are a senior clinical analyst preparing FDA-level due diligence.

QUESTION: "${question.question}"
CATEGORY: ${question.category}

EVIDENCE FROM ${evidence.length} DOCUMENTS:
${evidenceSummary.map((ev, idx) => `
[DOCUMENT ${idx + 1}]: ${ev.document}
- Relevant Content: ${ev.content}
- Key Findings: ${ev.findings}
- Clinical Metrics: ${JSON.stringify(ev.clinicalMetrics)}
- Data Quality: ${ev.dataQuality}
- Confidence: ${ev.confidence}%
- Missing Info: ${ev.missingInfo.join(', ')}
`).join('\n')}

SYNTHESIS INSTRUCTIONS:
1. **Aggregate All Evidence** - Don't miss any document or finding
2. **Quantify Clinical Data:**
   - Count: How many trials/patients/endpoints mentioned across all documents?
   - Metrics: What are the efficacy/safety numbers?
   - Timeline: What phases/milestones completed?
   
3. **Risk Assessment:**
   - Red flags: Safety signals, regulatory issues, data quality concerns
   - Yellow flags: Incomplete data, small sample sizes, missing critical info
   - Green signals: Strong efficacy, regulatory progress, high data quality
   
4. **Data Completeness:**
   - What's present across documents?
   - What's missing but should be there?
   - What additional documents are needed?

Return JSON:
{
  "answer": "Comprehensive clinical answer with specific data points and document citations",
  "confidence": 0-100,
  "sources": ["All document names"],
  "keyFindings": ["Finding 1 with numbers", "Finding 2 with specifics"],
  "clinicalSummary": {
    "trialsIdentified": 0,
    "patientsEnrolled": "N=X total across studies",
    "regulatoryStatus": "FDA/EMA status summary",
    "safetyProfile": "SAE summary with rates",
    "efficacyOutcomes": "Primary endpoint results"
  },
  "riskFactors": ["Risk 1 with severity", "Risk 2"],
  "positiveSignals": ["Positive 1", "Positive 2"],
  "gaps": ["Missing info 1", "Missing info 2"],
  "recommendations": ["Actionable recommendation 1", "Recommendation 2"],
  "evidenceStrength": "strong/moderate/weak",
  "dataQualityAssessment": "Assessment of overall data quality across documents"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 16000  // MASSIVELY INCREASED: No truncation
      });
      
      const compiledAnswer = JSON.parse(response.choices[0].message.content || '{}');
      
      // 🚀 IMPROVEMENT: Return enhanced answer with clinical summary
      return {
        question: question.question,
        category: question.category,
        answer: compiledAnswer.answer || 'Unable to compile answer from available evidence',
        confidence: compiledAnswer.confidence || 30,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: compiledAnswer.keyFindings || [],
        gaps: compiledAnswer.gaps || [],
        recommendations: compiledAnswer.recommendations || [],
        clinicalSummary: compiledAnswer.clinicalSummary || {},
        riskFactors: compiledAnswer.riskFactors || [],
        positiveSignals: compiledAnswer.positiveSignals || [],
        evidenceStrength: compiledAnswer.evidenceStrength || 'unknown',
        dataQualityAssessment: compiledAnswer.dataQualityAssessment || '',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
      
    } catch (error) {
      console.error(`Error compiling answer for "${question.question}":`, error);
      return {
        question: question.question,
        category: question.category,
        answer: `Error compiling answer: ${error.message}`,
        confidence: 0,
        sources: evidence.map(e => e.documentName), // SHOW ALL ANALYZED DOCUMENTS
        keyFindings: [],
        gaps: ['Analysis compilation failed'],
        recommendations: ['Manual review required'],
        clinicalSummary: {},
        riskFactors: ['Compilation error'],
        positiveSignals: [],
        evidenceStrength: 'unknown',
        dataQualityAssessment: 'Unable to assess due to compilation error',
        evidenceCount: evidence.length,
        detailedEvidence: evidence
      };
    }
  }

  /**
   * Generate comprehensive findings
   * 🚀 IMPROVEMENT: Enhanced to include clinical data, risk factors, and severity
   */
  private generateComprehensiveFindings(answers: Record<string, any>): any[] {
    const findings = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = COMPREHENSIVE_CLINICAL_QUESTIONS.find(q => q.id === questionId);
      if (!question) continue;
      
      // 🚀 IMPROVEMENT: High confidence findings with clinical data (>80%)
      if (answer.confidence > 80 && answer.evidenceStrength === 'strong') {
        findings.push({
          id: findings.length + 1,
          type: 'positive',
          severity: 'high',
          content: answer.answer,
          source: answer.sources.length > 0 ? answer.sources[0] : 'Clinical Documents',
          confidence: answer.confidence / 100,
          category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          evidenceCount: answer.evidenceCount || 0,
          clinicalData: answer.clinicalSummary || {},
          dataQuality: answer.dataQualityAssessment || 'unknown'
        });
      }
      
      // 🚀 IMPROVEMENT: Positive signals findings
      if (answer.positiveSignals && answer.positiveSignals.length > 0) {
        answer.positiveSignals.forEach(signal => {
          findings.push({
            id: findings.length + 1,
            type: 'positive',
            severity: 'medium',
            content: signal,
            source: answer.sources.join(', '),
            confidence: answer.confidence / 100,
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            evidenceCount: answer.evidenceCount || 0
          });
        });
      }
      
      // 🚀 IMPROVEMENT: Risk factors findings
      if (answer.riskFactors && answer.riskFactors.length > 0) {
        answer.riskFactors.forEach(risk => {
          findings.push({
            id: findings.length + 1,
            type: 'risk',
            severity: answer.confidence > 70 ? 'high' : 'medium',
            content: risk,
            source: answer.sources.join(', '),
            confidence: answer.confidence / 100,
            category: question.category.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            evidenceCount: answer.evidenceCount || 0
          });
        });
      }
      
      // 🚀 IMPROVEMENT: Data gap findings
      if (answer.gaps && answer.gaps.length > 0) {
        findings.push({
          id: findings.length + 1,
          type: 'gap',
          severity: 'medium',
          content: `Missing ${question.category} data: ${answer.gaps.join(', ')}`,
          source: 'Clinical Analysis',
          confidence: 0.3,
          category: 'data_gaps',
          evidenceCount: answer.evidenceCount || 0,
          recommendations: answer.recommendations || []
        });
      }
    }
    
    console.log(`📊 Generated ${findings.length} comprehensive clinical findings`);
    return findings;
  }
  
  /**
   * Generate comprehensive recommendations
   */
  private generateComprehensiveRecommendations(answers: Record<string, any>): any[] {
    const recommendations = [];
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer.recommendations && answer.recommendations.length > 0) {
        for (const rec of answer.recommendations) {
          recommendations.push({
            title: `Clinical Due Diligence: ${answer.question}`,
            description: rec,
            priority: answer.confidence < 60 ? 'high' : 'medium',
            category: 'clinical',
            impact: answer.confidence < 40 ? 'critical' : 'moderate'
          });
        }
      }
      
      if (answer.gaps && answer.gaps.length > 0) {
        recommendations.push({
          title: `Documentation Gap: ${answer.question}`,
          description: `Missing clinical information identified: ${answer.gaps.join(', ')}. Request additional documentation.`,
          priority: 'high',
          category: 'clinical',
          impact: 'critical'
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Store comprehensive analysis results
   */
  private async storeComprehensiveResults(
    dealId: number, 
    clinicalAnswers: Record<string, any>, 
    findings: any[], 
    recommendations: any[],
    documentsAnalyzed: any[]
  ): Promise<void> {
    // First, delete any existing clinical analysis to ensure clean replacement
    await db
      .delete(agentAnalyses)
      .where(and(
        eq(agentAnalyses.dealId, dealId),
        eq(agentAnalyses.agentType, 'clinical')
      ));
    
    console.log(`🗑️ Cleared existing clinical analysis for deal ${dealId}`);
    
    // Create the new comprehensive analysis
    const analysisData = {
      dealId,
      agentType: 'clinical' as const,
      status: 'completed' as const,
      progress: 100,
      findings: JSON.stringify(findings),
      recommendations: JSON.stringify(recommendations),
      clinicalAnswers: JSON.stringify(clinicalAnswers),
      documentSources: JSON.stringify(documentsAnalyzed.map(d => d.name)),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db
      .insert(agentAnalyses)
      .values(analysisData);
    
    console.log(`📊 Created fresh comprehensive clinical analysis for deal ${dealId} with ${Object.keys(clinicalAnswers).length} questions answered`);
  }
  
  /**
   * Get all active question progress for a deal from database
   */
  async getAllQuestionProgress(dealId: number): Promise<Record<string, number>> {
    const { backgroundJobs } = await import('../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const jobs = await db.query.backgroundJobs.findMany({
      where: and(
        eq(backgroundJobs.dealId, dealId),
        eq(backgroundJobs.jobType, 'clinical_question_rerun')
      )
    });
    
    const result: Record<string, number> = {};
    for (const job of jobs) {
      // Extract question ID from jobId format: "clinical-question-rerun-{dealId}-{questionId}"
      if (job.jobId) {
        const questionId = job.jobId.split('-').slice(4).join('-');
        // Only include in-progress jobs (not completed)
        if (job.progress < 100) {
          result[questionId] = job.progress;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Check if a question is currently being rerun in database
   */
  async isQuestionRunning(dealId: number, questionId: string): Promise<boolean> {
    const { backgroundJobs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const jobId = `clinical-question-rerun-${dealId}-${questionId}`;
    const job = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    // Consider it running if job exists and progress is not 100
    return job !== undefined && job.progress < 100;
  }
  
  /**
   * Update progress for a specific question rerun in database
   */
  async updateQuestionRerunProgress(dealId: number, questionId: string, progress: number): Promise<void> {
    const { backgroundJobs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const jobId = `clinical-question-rerun-${dealId}-${questionId}`;
    
    // Check if job exists
    const existingJob = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    
    if (existingJob) {
      // Update existing job
      await db.update(backgroundJobs)
        .set({ 
          progress,
          status: progress === 100 ? 'completed' : (progress === 0 ? 'pending' : 'processing'),
          updatedAt: new Date(),
          completedAt: progress === 100 ? new Date() : null
        })
        .where(eq(backgroundJobs.jobId, jobId));
    } else {
      // Create new job
      await db.insert(backgroundJobs).values({
        jobId,
        jobType: 'clinical_question_rerun',
        dealId,
        status: progress === 0 ? 'pending' : 'processing',
        progress,
        runId: questionId,
        currentStep: `Rerunning question: ${questionId}`
      });
    }
    
    console.log(`📊 Progress update (DB): ${questionId} = ${progress}%`);
  }
  
  /**
   * Re-run a single clinical question with full persistence
   */
  async rerunSingleQuestion(dealId: number, questionId: string): Promise<any> {
    console.log(`🔄 Re-running single clinical question ${questionId} for deal ${dealId}`);
    const jobId = `clinical-question-rerun-${dealId}-${questionId}`;
    
    // Check if already initialized by route (atomic registration pattern)
    const { backgroundJobs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const existingJob = await db.query.backgroundJobs.findFirst({
      where: eq(backgroundJobs.jobId, jobId)
    });
    const alreadyInitialized = existingJob !== undefined;
    
    // Only check for duplicates if not already initialized
    if (!alreadyInitialized && await this.isQuestionRunning(dealId, questionId)) {
      throw new Error(`Question ${questionId} is already being rerun`);
    }
    
    try {
      // Initialize progress only if not already set by route
      if (!alreadyInitialized) {
        await this.updateQuestionRerunProgress(dealId, questionId, 0);
      }
      
      // Call the standalone rerun function
      return await rerunSingleClinicalQuestion(dealId, questionId);
      
    } catch (error) {
      console.error(`❌ Failed to rerun clinical question ${questionId}:`, error);
      await this.updateQuestionRerunProgress(dealId, questionId, 100);
      throw error;
    }
  }
}

/**
 * Re-run a single Clinical question with full persistence and progress tracking
 * Uses database-backed progress tracking that survives page refreshes and server restarts
 */
export async function rerunSingleClinicalQuestion(
  dealId: number,
  questionId: string
): Promise<any> {
  const jobId = `clinical-question-rerun-${dealId}-${questionId}`;
  
  console.log(`🧬 Starting Clinical question rerun: ${questionId} for deal ${dealId}`);
  
  try {
    // Find the question definition
    const question = COMPREHENSIVE_CLINICAL_QUESTIONS.find(q => q.id === questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found in COMPREHENSIVE_CLINICAL_QUESTIONS`);
    }
    
    // Initial progress: 0% - Job started
    await storage.updateQuestionRerunProgress(jobId, 0, 'processing', {
      agentType: 'Clinical',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      processedDocuments: 0,
      totalDocuments: 0,
      currentDocument: ''
    });
    
    // Step 1: Fetch documents assigned to Clinical agent (30% progress)
    console.log(`🧬 Fetching documents for deal ${dealId}`);
    const documents = await storage.getDocumentsByDealId(dealId);
    const clinicalDocuments = documents.filter(doc => doc.assignedAgent === 'Clinical');
    
    await storage.updateQuestionRerunProgress(jobId, 30, 'processing', {
      agentType: 'Clinical',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      processedDocuments: 0,
      totalDocuments: clinicalDocuments.length,
      currentDocument: ''
    });
    
    console.log(`🧬 Found ${clinicalDocuments.length} Clinical documents`);
    
    // Step 2: Extract AI summaries from documents (60% progress)
    console.log(`🧬 Extracting AI summaries from ${clinicalDocuments.length} documents`);
    const documentSummaries = clinicalDocuments
      .filter(doc => doc.aiSummary && doc.aiSummary.trim().length > 0)
      .map(doc => ({
        name: doc.name,
        summary: doc.aiSummary
      }));
    
    await storage.updateQuestionRerunProgress(jobId, 60, 'processing', {
      agentType: 'Clinical',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      processedDocuments: documentSummaries.length,
      totalDocuments: clinicalDocuments.length,
      currentDocument: ''
    });
    
    console.log(`📊 Progress update (DB): ${questionId} = 60%`);
    
    if (documentSummaries.length === 0) {
      console.warn(`⚠️ No AI summaries found for Clinical documents`);
      await storage.updateQuestionRerunProgress(jobId, 100, 'failed', {
        agentType: 'Clinical',
        error: 'No AI summaries available for analysis'
      });
      return null;
    }
    
    // Step 3: Compile comprehensive answer using GPT-4o (70% progress)
    console.log(`🤖 Compiling answer for: ${question.question}`);
    await storage.updateQuestionRerunProgress(jobId, 70, 'processing', {
      agentType: 'Clinical',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      processedDocuments: documentSummaries.length,
      totalDocuments: clinicalDocuments.length,
      currentDocument: ''
    });
    
    console.log(`📊 Progress update (DB): ${questionId} = 70%`);
    console.log(`Compiling comprehensive answer for: ${question.question} with ${documentSummaries.length} documents`);
    
    const prompt = `You are a Clinical Due Diligence expert analyzing medical device and healthcare companies.

Question: ${question.question}
${question.subQuestions ? `Sub-questions:\n${question.subQuestions.map((sq: any) => `- ${sq.question || sq}`).join('\n')}` : ''}

Document Summaries (${documentSummaries.length} documents):
${documentSummaries.map((doc, idx) => `
Document ${idx + 1}: ${doc.name}
Summary: ${doc.summary}
`).join('\n---\n')}

Please provide a comprehensive clinical analysis that includes:
1. A detailed answer addressing the main question and all sub-questions
2. Key clinical findings from the documents (as an array)
3. Clinical assessment of the findings
4. Evidence summary
5. Specific recommendations for clinical due diligence (as an array)
6. Confidence level (0-100)
7. Source documents used (as an array of document names)

Respond in valid JSON format:
{
  "answer": "Detailed comprehensive answer...",
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "clinicalAssessment": "Clinical assessment...",
  "evidenceSummary": "Evidence summary...",
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "confidence": 85,
  "sources": ["document1.pdf", "document2.pdf", ...]
}`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    
    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }
    
    const analysisResult = JSON.parse(responseText);
    
    console.log(`✅ Answer compiled successfully`);
    
    // Step 4: Update database with new answer (85% progress)
    await storage.updateQuestionRerunProgress(jobId, 85, 'processing', {
      agentType: 'Clinical',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      processedDocuments: documentSummaries.length,
      totalDocuments: clinicalDocuments.length,
      currentDocument: ''
    });
    
    console.log(`📊 Progress update (DB): ${questionId} = 85%`);
    
    // Get existing Clinical analysis
    const existingAnalysis = await storage.getAgentAnalysisByDealAndType(dealId, 'Clinical');
    
    let clinicalAnswers: any = {};
    
    if (existingAnalysis) {
      console.log(`✅ Found Clinical analysis for deal ${dealId}: ${JSON.stringify({
        id: existingAnalysis.id,
        agentType: existingAnalysis.agentType,
        status: existingAnalysis.status,
        findingsLength: existingAnalysis.findings?.length || 0,
        recommendationsLength: existingAnalysis.recommendations?.length || 0
      })}`);
      
      // Parse existing clinicalAnswers if they exist
      if (existingAnalysis.clinicalAnswers && typeof existingAnalysis.clinicalAnswers === 'object') {
        clinicalAnswers = existingAnalysis.clinicalAnswers;
      }
    }
    
    // Update the specific question
    clinicalAnswers[questionId] = {
      answer: analysisResult.answer || '',
      confidence: analysisResult.confidence || 0,
      sources: analysisResult.sources || [],
      keyFindings: analysisResult.keyFindings || [],
      evidenceSummary: analysisResult.evidenceSummary || '',
      clinicalAssessment: analysisResult.clinicalAssessment || '',
      recommendations: analysisResult.recommendations || [],
      detailedEvidence: []
    };
    
    // Step 5: Save to database (95% progress)
    await storage.updateQuestionRerunProgress(jobId, 95, 'processing', {
      agentType: 'Clinical',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      processedDocuments: documentSummaries.length,
      totalDocuments: clinicalDocuments.length,
      currentDocument: ''
    });
    
    console.log(`📊 Progress update (DB): ${questionId} = 95%`);
    
    if (existingAnalysis) {
      // Clear existing analysis to ensure fresh data
      console.log(`🗑️ Cleared existing clinical analysis for deal ${dealId}`);
      await storage.deleteAgentAnalysis(existingAnalysis.id);
    }
    
    // Create fresh comprehensive clinical analysis
    const newAnalysis = await storage.createAgentAnalysis({
      dealId,
      agentType: 'Clinical',
      status: 'completed',
      findings: existingAnalysis?.findings || [],
      recommendations: existingAnalysis?.recommendations || [],
      clinicalAnswers
    });
    
    console.log(`📊 Created fresh comprehensive clinical analysis for deal ${dealId} with ${Object.keys(clinicalAnswers).length} questions answered`);
    console.log(`✅ Successfully updated question ${questionId} in clinical analysis`);
    
    // Step 6: Mark as complete (100% progress)
    await storage.updateQuestionRerunProgress(jobId, 100, 'completed', {
      agentType: 'Clinical',
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      processedDocuments: documentSummaries.length,
      totalDocuments: clinicalDocuments.length,
      currentDocument: ''
    });
    
    console.log(`📊 Progress update (DB): ${questionId} = 100%`);
    console.log(`✅ Background rerun completed for question ${questionId} on deal ${dealId}`);
    
    // Schedule cleanup after 1 hour
    setTimeout(async () => {
      try {
        // Check if job still exists and is completed before deleting
        const jobStatus = await storage.getQuestionRerunProgress(jobId);
        if (jobStatus && (jobStatus.progress === 100 || jobStatus.status === 'failed')) {
          await storage.deleteBackgroundJob(jobId);
          console.log(`🗑️ Cleaned up completed Clinical job: ${jobId}`);
        } else {
          console.log(`⏭️ Skipping cleanup for active Clinical job: ${jobId}`);
        }
      } catch (error) {
        console.error(`❌ Error cleaning up Clinical job ${jobId}:`, error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    return {
      success: true,
      questionId,
      answer: analysisResult,
      fullAnalysis: newAnalysis
    };
    
  } catch (error) {
    console.error(`❌ Error rerunning Clinical question ${questionId}:`, error);
    
    // Mark as failed
    await storage.updateQuestionRerunProgress(jobId, 0, 'failed', {
      agentType: 'Clinical',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Schedule cleanup after 1 hour even for failed jobs
    setTimeout(async () => {
      try {
        const jobStatus = await storage.getQuestionRerunProgress(jobId);
        if (jobStatus && jobStatus.status === 'failed') {
          await storage.deleteBackgroundJob(jobId);
          console.log(`🗑️ Cleaned up failed Clinical job: ${jobId}`);
        }
      } catch (cleanupError) {
        console.error(`❌ Error cleaning up failed Clinical job ${jobId}:`, cleanupError);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    throw error;
  }
}

// Export the service instance
export const comprehensiveClinicalAnalysisService = new ComprehensiveClinicalAnalysisService();
