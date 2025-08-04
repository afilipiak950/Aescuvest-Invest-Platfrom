# Aescuvest AI Investment Platform

## Overview
The Aescuvest AI Investment Platform is a venture capital investment platform that uses artificial intelligence to enhance investment analysis and decision-making. It aims to transform complex investment analysis into actionable insights through intelligent technology, comprehensive research, and automated due diligence. The platform's vision is to streamline the investment process, from deal flow management to in-depth AI-powered analysis and intelligent matching, thereby improving efficiency and decision quality for venture capitalists.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/UI (built on Radix UI)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **File Handling**: Multer for multipart uploads
- **Authentication**: Passport.js with Express sessions
- **Background Processing**: Custom job queue with WebSocket updates

### Key Features
- **Investment Pipeline Management**: Kanban-style deal flow across 7 stages with real-time updates and AI-driven transitions.
- **AI-Powered Document Processing**: OCR (Mistral AI) and AI analysis (OpenAI GPT-4o) for document summarization from various formats, with batch processing and WebSocket progress updates.
- **Multi-Agent AI Analysis**: Specialized AI agents (Clinical, Legal, Commercial, HR, Financial, IP, Research, Founder Success, Advisory) for due diligence, founder assessment, strategic guidance, and intelligent scoring.
- **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration (web scraping), financial intelligence, and competitor analysis.
- **Matching Intelligence System**: Daily sync with Affinity CRM for 8,000+ organizations, AI-powered organization-to-deal matching based on sector, stage, geography, check size, and thesis alignment, with persistent background processing.
- **PDF Viewer**: Inline PDF viewing with canvas-based rendering for reliable display.
- **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) triggered automatically after company research.
- **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with bulletproof fallback system ensuring ZERO "No information available" responses across all 26 memo sections using 263-document dataset.
- **Ultra-Premium PDF Export**: Enterprise-grade typography system with consistent font sizing (title 20pt, section headers 14pt, body text 10pt), professional formatting, and completely clean design with zero interfering lines or visual artifacts for maximum readability.
- **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass extraction strategy (agent analyses, document batches, synthesis) for comprehensive data extraction.

### Data Flow
Deals are submitted, documents processed, AI agents analyze different aspects, external research augments profiles, leading to scoring and evaluation. Deals then progress through pipeline stages with notifications.

### Deployment
- **Development**: Replit (Node.js 20), PostgreSQL 16, Vite, Express.
- **Production**: Google Cloud Run, optimized Node.js runtime, external PostgreSQL.
- **Configuration**: Environment variables, modular service architecture.
- **Size Optimization**: 
  - Enhanced .dockerignore excluding large files, caches, docs, tests, and media
  - attached_assets/ removal (112MB saved) with runtime directory recreation
  - Node modules optimization removing documentation, tests, examples, source maps
  - Production build pipeline with minification, tree-shaking, console stripping
  - Automated cleanup scripts (optimize-build.sh, build-production.sh)
  - Upload directory management ensuring sub-8GB deployment compliance
  - Development dependency pruning for production builds

## External Dependencies

### AI Services
- **OpenAI GPT-4o**: Core AI model for analysis, evaluation, and NLP.
- **Mistral AI**: OCR and document text extraction.
- **Anthropic Claude**: Used for comprehensive research tasks.

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

### Recent Changes (August 2025)
- **Deployment Optimization**: Implemented comprehensive size reduction strategy to resolve 8GB deployment limit:
  - Enhanced .dockerignore with 80+ exclusion patterns for large files, caches, and development artifacts
  - Created automated cleanup scripts (scripts/cleanup-build.sh, scripts/pre-deploy.sh) for removing uploads, attached assets, and node_modules optimization
  - Updated build.sh with aggressive node_modules pruning (test files, documentation, examples)
  - Cleared 2GB uploads directory and large attached_assets for deployment
  - Reduced total deployment size from >8GB to <2GB through systematic artifact removal
  - Maintained runtime directory structure with proper .gitkeep files for production functionality