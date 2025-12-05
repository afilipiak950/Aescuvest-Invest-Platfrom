# Aescuvest AI Investment Platform

## Overview
The Aescuvest AI Investment Platform is a venture capital investment platform that uses artificial intelligence for advanced investment analysis and decision-making. Its main goal is to streamline the entire investment process, from managing deal flow to in-depth AI-powered analysis and intelligent matching. It achieves this by converting complex investment data into useful insights through smart technology, extensive research, and automated due diligence, aiming to transform venture capital investment with a sophisticated, AI-driven solution.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The platform uses React 18 with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn/UI (built on Radix UI) for UI components. Tailwind CSS is used for styling, and Framer Motion for animations. Vite handles the build process.

### Technical Implementations
The backend is built with Node.js and Express.js, using TypeScript. PostgreSQL with Drizzle ORM is used for the database. Multer is used for multipart file uploads, and Passport.js with Express sessions manages authentication. Background processing is handled by a database-backed job queue with persistent progress tracking, WebSocket updates, and aggressive stuck job cleanup.

### Feature Specifications
- **Investment Pipeline Management**: Kanban-style deal flow with AI-driven transitions.
- **AI-Powered Document Processing**: OCR and AI analysis for document summarization, batch processing, and WebSocket updates.
- **Multi-Agent AI Analysis**: Specialized AI agents (Clinical, Legal, Commercial, HR, Financial, IP, Research, Founder Success, Advisory) conduct due diligence, founder assessment, and strategic guidance with intelligent scoring. This includes token-based batching, hierarchical timeouts, exponential backoff retries, partial result caching, centralized rate limiting, automatic cache cleanup, and **strict answer isolation** to prevent cross-question contamination in GPT-4o synthesis.
- **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration, financial intelligence, and competitor analysis.
- **Matching Intelligence System**: AI-powered organization-to-deal matching based on sector, stage, geography, check size, and thesis.
- **PDF Viewer**: Inline PDF viewing with canvas-based rendering.
- **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) with live background progress tracking, reload persistence, and race condition protection.
- **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with a robust fallback system and live progress tracking. **NEW (Dec 2025): Enhanced 100x Quality Mode** using Agent Data Fusion Layer, Claude Opus synthesis, quality validation with iterative refinement, and citation-backed content from all 7 specialized agents.
- **Ultra-Premium PDF Export**: Enterprise-grade typography and professional formatting.
- **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass extraction strategy.
- **Large File Upload System**: Hybrid upload infrastructure supporting files up to 5GB, intelligently routing files ≤30MB directly to the server and files >30MB to GCS signed URLs. Includes upload negotiation, GCS signed URL generation, callback endpoints for background ZIP extraction jobs, WebSocket progress notifications, and error handling.
- **RAG Embedding System**: Resilient vector embedding pipeline for instant document search, featuring timeout protection, retry logic, rate limiting, and robust error classification.
- **Email Inbox Integration**: Persistent email configuration system with dual authentication support (IMAP/Microsoft OAuth) for automated deal flow monitoring, including a settings UI, test connection, and API endpoints.
- **Agent Question Queue System**: Sequential FIFO question processing for AI agents with a persistent database-backed queue, WebSocket real-time progress tracking, automatic resume on server restart, and cancellation support.

### System Design Choices
- **Development Environment**: Replit (Node.js 20), PostgreSQL 16, Vite, Express.
- **Production Environment**: Google Cloud Run, optimized Node.js runtime, external PostgreSQL.
- **Configuration**: Environment variables and a modular service architecture.
- **Build System**: Executable shell script for Replit deployment, Vite for frontend, esbuild for backend.
- **Size Optimization**: Enhanced `.dockerignore`, automated cleanup, Node modules optimization, and a production build pipeline ensure deployment size under 2GB.

### Recent Major Updates (Dec 05, 2025)
- **100x Memo Quality Improvement**: Implemented comprehensive Agent Data Fusion Layer (`server/services/agentDataFusion.ts`) that transforms raw agent Q&A outputs into structured, citation-ready facts. Added **Claude Opus 4** synthesis service (`server/services/claudeOpusMemoSynthesis.ts`) for premium-quality memo section generation with deep agent integration. Created quality validation and refinement controller (`server/services/memoRefinementController.ts`) with iterative improvement passes. Key features:
  - **Structured Fact Matrix**: Extracts and categorizes facts from all 7 agents with confidence scores
  - **Quantitative Metric Extraction**: Automatically identifies currency, percentages, dates, counts
  - **Citation-Backed Content**: Every claim links to source agent analysis [AGENT Agent - Category]
  - **Quality Scoring**: 0-100 score per section based on citations, data points, specificity
  - **Iterative Refinement**: Weak sections (score <65) automatically re-generated with targeted prompts
  - **API Enhancement**: POST `/api/deals/:dealId/generate-memo` now accepts `enhanced=true` for quality mode

### Recent Critical Fixes (Dec 02, 2025)
- **Bullet Point Formatting Fix**: All 7 AI agents now produce properly formatted bullet points with each item on its own line. Created shared `server/utils/textFormatting.ts` utility with `normalizeBulletLists()` function that converts inline bullets to newline-separated format. Updated all synthesis prompts with explicit "one bullet per line" instructions and examples. Applied `formatAgentAnswer()` post-processing to all agent answer outputs for consistent, readable markdown lists.

### Previous Critical Fixes (Nov 23, 2025)
- **Answer Contamination Bug Fix**: Fixed GPT-4o synthesis prompts across all comprehensive analysis services (Legal, Clinical, Financial, Research) to prevent question text prefixing. GPT-4o was incorrectly adding wrong question headers to answers (e.g., governance_1 answers showing contracts_1 question text). Solution: Explicit synthesis prompt instructions with question ID context, wrong/correct examples, and strict "DO NOT PREFIX" rules ensure each question generates isolated, correctly-labeled answers.

## External Dependencies

### AI Services
- **OpenAI GPT-4o**: Core AI model for analysis, evaluation, and NLP.
- **Mistral AI**: OCR and document text extraction.
- **Anthropic Claude**: Comprehensive research tasks.

### Authentication & Email
- **Microsoft Graph API**: OAuth2 for email inbox monitoring.
- **SendGrid**: Transactional email delivery.
- **Azure MSAL**: Microsoft authentication.

### Document Processing Libraries
- **Sharp**: Image processing.
- **Mammoth**: .docx text extraction.
- **XLSX**: Excel spreadsheet processing.
- **Custom PDF utilities**: For text extraction.

### Infrastructure
- **PostgreSQL**: Primary database.
- **WebSocket**: Real-time communication.
- **Local File System**: For file storage.
- **Affinity CRM**: For organization data synchronization.