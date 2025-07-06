# Aescuvest AI Investment Platform

![Aescuvest Logo](attached_assets/65693c5a89e524678d52208a_Aescuvest%20Logo%201%20(1).png)

A comprehensive AI-driven venture capital investment platform that transforms complex investment analysis into actionable insights through intelligent technology, multi-agent AI systems, and authentic real-time company research capabilities.

## 🚀 Features

### Core Platform Capabilities
- **Investment Pipeline Management** - Kanban-style deal flow with 7 investment stages and drag-and-drop functionality
- **AI-Powered Due Diligence** - Multi-agent intelligent analysis using OpenAI GPT-4o and Mistral AI
- **Advanced Document Processing** - OCR extraction, PDF viewer with canvas rendering, and intelligent document analysis
- **Email-to-Deal Automation** - Automatic deal creation from email attachments with Microsoft OAuth integration
- **Real-time Company Research** - Authentic web scraping from company websites, Google News, and external data sources
- **Multi-Agent AI Analysis** - 7 specialized agents (Clinical, Legal, Commercial, HR, Financial, IP, Research)
- **Pitch Deck Management** - Dedicated section for presentation documents with inline PDF viewing
- **Dynamic AI Scoring** - Configurable evaluation criteria with weighted scoring and real-time progress tracking

### AI Agent Teams
- **Due Diligence Team** - Clinical, Legal, Commercial, HR, Financial, IP, and Research agents
- **Founder Success Team** - Investment evaluation and founder assessment  
- **Advisory Team** - Strategic guidance and teaser generation

### Recent Platform Enhancements (June 2025)
- **PDF Viewer with Canvas Rendering** - Complete Chrome restriction bypass using PDF.js
- **Authentic Company Research** - Real web scraping with 11-second completion time
- **Email Attachment Processing** - Automatic deal creation from Microsoft Outlook emails
- **Background Job System** - Persistent AI analysis with real-time progress tracking
- **Document Assignment System** - AI-powered document categorization with fallback rules
- **User Activity Tracking** - Real database-driven activity logs and user statistics

## 🛠 Technical Architecture

### Frontend Stack
```
React 18 + TypeScript
├── Wouter (Routing)
├── TanStack Query (State Management)
├── Shadcn/UI (Component Library)
├── Tailwind CSS (Styling)
├── Framer Motion (Animations)
└── Vite (Build Tool)
```

### Backend Stack
```
Node.js + Express + TypeScript
├── PostgreSQL (Database)
├── Drizzle ORM (Database Management)
├── Multer (File Upload)
├── Passport.js (Authentication)
└── Express Session (Session Management)
```

### AI & External Services
```
AI Models
├── OpenAI GPT-4o (Primary Analysis & Company Research)
├── Mistral AI (OCR Processing & Document Extraction)
├── Anthropic Claude (Alternative Analysis Model)
└── Real-time Web Scraping & Data Aggregation

External APIs
├── Microsoft Graph API (OAuth 2.0 & Email Processing)
├── Azure MSAL (Microsoft Authentication Library)
├── SendGrid (Transactional Email Delivery)
└── Real-time Web Data Sources (Company Websites, Google News)
```

## 📋 Prerequisites

Before setting up the platform, ensure you have:

- Node.js 18+ installed
- PostgreSQL database
- Required API keys (see Environment Setup)

## 🔧 Installation & Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd aescuvest-platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration

Create `.env` file with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/aescuvest
PGHOST=localhost
PGPORT=5432
PGDATABASE=aescuvest
PGUSER=username
PGPASSWORD=password

# AI Services
OPENAI_API_KEY=your_openai_api_key
MISTRAL_API_KEY=your_mistral_api_key

# Authentication
SESSION_SECRET=your_secure_session_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Email Service
SENDGRID_API_KEY=your_sendgrid_api_key
```

### 4. Database Setup
```bash
# Push database schema
npm run db:push

# Create admin user (optional)
npm run script:create-admin-user
```

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 📊 Database Schema

### Core Tables
```sql
-- Users table for authentication
users (
  id: string (primary key)
  email: string (unique)
  first_name: string
  last_name: string
  profile_image_url: string
  created_at: timestamp
  updated_at: timestamp
)

-- Investment deals
deals (
  id: serial (primary key)
  company_name: string
  description: text
  sector: string
  stage: string
  funding_amount: bigint
  website: string
  location: string
  ai_score: string
  status: string
  created_at: timestamp
  updated_at: timestamp
)

-- Document management
documents (
  id: serial (primary key)
  deal_id: integer (foreign key)
  name: string
  type: string
  path: string
  size: integer
  status: string
  extracted_text: text
  analysis_results: jsonb
  uploaded_at: timestamp
)

-- AI Analysis results
agent_analyses (
  id: serial (primary key)
  deal_id: integer (foreign key)
  agent_type: string
  status: string
  findings: jsonb
  recommendations: string[]
  confidence: decimal
  created_at: timestamp
)

-- Investment memos
investment_memos (
  id: serial (primary key)
  deal_id: integer (foreign key)
  executive_summary: text
  investment_thesis: text
  market_analysis: text
  financial_projections: text
  risk_assessment: text
  recommendation: string
  created_at: timestamp
)

-- Evaluation criteria and results
evaluation_criteria (
  id: serial (primary key)
  name: string
  description: text
  weight: decimal
  is_active: boolean
)

evaluation_results (
  id: serial (primary key)
  deal_id: integer (foreign key)
  criterion_id: integer (foreign key)
  score: decimal
  reasoning: text
  confidence: decimal
  created_at: timestamp
)

-- Company research data
company_research (
  id: serial (primary key)
  deal_id: integer (foreign key)
  status: string
  executive_summary: text
  product_market: text
  team: jsonb
  financials: jsonb
  market_intelligence: jsonb
  competitive_landscape: jsonb
  news_sentiment: jsonb
  risk_factors: jsonb
  swot: jsonb
  created_at: timestamp
)
```

## 🔐 Authentication System

The platform uses OpenID Connect with Microsoft Azure for authentication:

### Authentication Flow
1. User clicks "Login" button
2. Redirected to Microsoft OAuth endpoint
3. User authenticates with Microsoft credentials
4. Callback processes tokens and creates session
5. User data stored in PostgreSQL with session management

### Session Management
- Sessions stored in PostgreSQL using `connect-pg-simple`
- 7-day session TTL with automatic refresh
- Secure HTTP-only cookies with HTTPS enforcement

## 🤖 AI Integration Architecture

### Primary AI Models

#### OpenAI GPT-4o Integration
```typescript
// Authentic real-time company research with web scraping
const conductCompanyResearch = async (companyName: string, website: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // Latest model as of May 2024
    messages: [
      { role: "system", content: "You are an expert investment analyst conducting authentic company research." },
      { role: "user", content: `Research company: ${companyName} at ${website}. Provide comprehensive analysis based on real data.` }
    ],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
};

// Multi-agent document analysis
const analyzeDocument = async (documentText: string, agentType: string) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: getAgentPrompt(agentType) },
      { role: "user", content: documentText }
    ],
    response_format: { type: "json_object" }
  });
  return JSON.parse(response.choices[0].message.content);
};
```

#### Mistral OCR Processing
```typescript
// Document text extraction
const extractText = async (documentPath: string) => {
  const response = await mistral.chat.complete({
    model: "mistral-ocr-latest",
    messages: [
      { role: "user", content: [
        { type: "text", text: "Extract all text from this document" },
        { type: "image_url", url: documentPath }
      ]}
    ]
  });
  return response.choices[0].message.content;
};
```

### Multi-Agent AI System

#### Due Diligence Agent Team (7 Specialized Agents)
- **Clinical Agent** - Healthcare compliance, regulatory pathways, medical device evaluation
- **Legal Agent** - Regulatory compliance, IP analysis, contract review
- **Commercial Agent** - Market analysis, business model evaluation, revenue streams
- **HR Agent** - Team assessment, organizational structure, talent evaluation
- **Financial Agent** - Revenue models, unit economics, burn rate analysis, financial projections
- **IP Agent** - Intellectual property portfolio, patent analysis, trade secrets
- **Research Agent** - Technology assessment, R&D evaluation, innovation potential

#### Background Processing System
- **Persistent Job Queue** - Background analysis continues after server restarts
- **Real-time Progress Tracking** - WebSocket-powered progress updates (0-100%)
- **Intelligent Document Assignment** - AI-powered categorization with rule-based fallback
- **Batch Processing** - Efficient handling of large document sets (263+ documents)

#### Evaluation Criteria Engine
Configurable weighted scoring system:
- Healthcare Relevance (25%)
- Geography Alignment (20%)
- Stage Appropriateness (15%)
- Business Model Fit (15%)
- Team Assessment (15%)
- Market Opportunity (10%)

## 🔄 Pipeline Management

### Investment Stages
1. **Incoming** - New submissions and leads
2. **Initial Screening** - First review and evaluation
3. **Due Diligence** - Deep analysis and investigation
4. **Negotiation** - Terms and conditions discussion
5. **Final Review** - Investment committee decision
6. **Closed Won** - Successfully invested
7. **Closed Lost** - Not proceeded with investment

### Drag & Drop Functionality
```typescript
// Status update API
PATCH /api/deals/:id/status
{
  "status": "due-diligence" | "negotiation" | "final-review" | ...
}
```

## 📁 Project Structure

```
aescuvest-platform/
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/          # Shadcn UI components
│   │   │   ├── layout/      # Layout components (Navbar, Sidebar)
│   │   │   └── ai/          # AI-specific components
│   │   ├── pages/           # Application pages
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions
│   │   └── types/           # TypeScript type definitions
├── server/                   # Backend Express application
│   ├── routes.ts            # API route definitions
│   ├── db.ts                # Database connection
│   ├── storage.ts           # Data access layer
│   ├── services/            # Business logic services
│   │   ├── aiEvaluationEngine.ts
│   │   ├── directAIEvaluation.ts
│   │   └── realCompanyResearch.ts
│   └── index.ts             # Server entry point
├── shared/                   # Shared types and schemas
│   └── schema.ts            # Drizzle database schema
├── scripts/                  # Database and setup scripts
└── uploads/                  # File upload directory
```

## 🎨 UI/UX Design System

### Color Palette
```css
:root {
  --primary: 120 100% 50%;     /* Aescuvest Green */
  --dark: 0 0% 8%;             /* Background Dark */
  --dark-light: 0 0% 12%;      /* Card Background */
  --dark-lighter: 0 0% 16%;    /* Border Color */
}
```

### Component Library
- **Shadcn/UI** - Modern, accessible components
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Consistent iconography
- **Framer Motion** - Smooth animations

### Responsive Design
- Mobile-first approach
- Collapsible sidebar on mobile
- Responsive grid layouts
- Touch-friendly drag & drop

## 🔧 Available Scripts

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production

# Database Management
npm run db:push               # Push schema changes
npm run db:studio             # Open Drizzle Studio

# Utility Scripts
npm run script:create-admin-user           # Create admin user
npm run script:add-tesla-showcase         # Add Tesla demo data
npm run script:init-evaluation-criteria   # Initialize scoring criteria
```

## 📈 Performance Optimization

### Frontend Optimizations
- Code splitting with React.lazy()
- Image optimization with proper formats
- Memoization of expensive computations
- Virtualized lists for large datasets

### Backend Optimizations
- Database connection pooling
- Query optimization with indexes
- Caching layer for frequent requests
- Background processing for AI operations

### AI Processing
- Streaming responses for real-time feedback
- Parallel processing of multiple criteria
- Caching of analysis results
- Rate limiting and queue management

## 🔒 Security Considerations

### Data Protection
- HTTPS enforcement in production
- SQL injection prevention with parameterized queries
- XSS protection with Content Security Policy
- CSRF protection with secure tokens

### API Security
- Rate limiting on API endpoints
- Input validation with Zod schemas
- Secure file upload with type validation
- Environment variable protection

### Authentication Security
- Secure session management
- Token-based authentication
- Automatic session expiration
- Secure cookie configuration

## 🚀 Deployment

### Production Environment Variables
```env
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:prod_pass@prod_host:5432/aescuvest_prod
SESSION_SECRET=ultra_secure_production_secret
REPLIT_DOMAINS=your-domain.com
```

### Deployment Steps
1. Set production environment variables
2. Install dependencies: `npm install`
3. Build production assets: `npm run build`
4. Push database schema: `npm run db:push`
5. Initialize evaluation criteria: `npm run script:init-evaluation-criteria`
6. Create admin user: `npm run script:create-admin-user`
7. Start production server: `npm start`

### Deployment Optimizations (Current Size: ~507MB)
- **Size Reduction Measures** - Removed uploads directory, cleaned node_modules cache
- **Production Build Pipeline** - Automated build script with minification and tree-shaking
- **Runtime Directory Creation** - Automatic creation of upload directories
- **Environment Validation** - Comprehensive environment variable validation

## 📞 Support & Contact

For technical support or questions about the Aescuvest platform:

- **Documentation**: This README and inline code comments
- **Issue Tracking**: GitHub Issues (if applicable)
- **Email Support**: Contact your system administrator

## 📄 License

This project is proprietary software developed for Aescuvest. All rights reserved.

---

**Built with ❤️ for intelligent investment management**