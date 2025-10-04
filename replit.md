# Aescuvest AI Investment Platform

## Overview
The Aescuvest AI Investment Platform is a venture capital investment platform that uses artificial intelligence to enhance investment analysis and decision-making. Its goal is to transform complex investment data into actionable insights through intelligent technology, comprehensive research, and automated due diligence. The platform aims to streamline the entire investment process, from managing deal flow to providing in-depth AI-powered analysis and intelligent matching.

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
- **Investment Pipeline Management**: Kanban-style deal flow across 7 stages with AI-driven transitions.
- **AI-Powered Document Processing**: OCR and AI analysis for document summarization from various formats, with batch processing and WebSocket progress updates. Supports large files up to 5GB with chunked and resumable uploads.
- **Multi-Agent AI Analysis**: Specialized AI agents (Clinical, Legal, Commercial, HR, Financial, IP, Research, Founder Success, Advisory) for due diligence, founder assessment, strategic guidance, and intelligent scoring. Agents ensure consistent architectural patterns and reliable progress tracking.
- **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration (web scraping), financial intelligence, and competitor analysis.
- **Matching Intelligence System**: AI-powered organization-to-deal matching based on sector, stage, geography, check size, and thesis alignment, with persistent background processing.
- **PDF Viewer**: Inline PDF viewing with canvas-based rendering.
- **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) automatically triggered after company research.
- **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with robust fallback systems, ensuring no "No information available" responses across 26 sections using a 263-document dataset.
- **Ultra-Premium PDF Export**: Enterprise-grade typography with consistent font sizing and professional formatting.
- **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass extraction strategy.
- **Comprehensive RAG System**: Ultra-fast document search with semantic search across 1,334+ documents, utilizing OpenAI embeddings and PostgreSQL pgvector for similarity search.
- **AI Assistant Performance Optimization**: Instant responses after initial context load through in-memory context caching and parallel loading of context types.

### Deployment
- **Development**: Replit (Node.js 20), PostgreSQL 16, Vite, Express.
- **Production**: Google Cloud Run, optimized Node.js runtime, external PostgreSQL.
- **Configuration**: Environment variables, modular service architecture.
- **Build System**: Executable shell script for Replit, Vite for frontend, esbuild for backend.
- **Size Optimization**: Deployment size under 2GB through enhanced .dockerignore, automated cleanup, Node modules optimization, and production build pipeline.

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