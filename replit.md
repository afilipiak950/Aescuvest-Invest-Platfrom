# Aescuvest AI Investment Platform

## Overview
The Aescuvest AI Investment Platform is a venture capital investment platform leveraging artificial intelligence for enhanced investment analysis and decision-making. Its purpose is to transform complex investment data into actionable insights, streamline the investment process from deal flow management to in-depth AI-powered analysis, and intelligent matching. The platform aims to provide comprehensive research and automated due diligence.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Components**: Shadcn/UI (built on Radix UI)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Build Tool**: Vite
- **PDF Viewer**: Inline PDF viewing with canvas-based rendering.
- **Ultra-Premium PDF Export**: Enterprise-grade typography with consistent font sizing and professional formatting for maximum readability.

### Technical Implementations
- **Backend Runtime**: Node.js with Express.js
- **Backend Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **File Handling**: Multer for multipart uploads
- **Authentication**: Passport.js with Express sessions
- **Background Processing**: Custom job queue with WebSocket updates
- **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass extraction strategy.
- **Large File Upload System**: Comprehensive chunked upload infrastructure supporting files up to 5GB with automatic chunking, resumable uploads, real-time progress tracking, and seamless integration with document processing. This includes a specialized Cloud Run upload service for handling large files.
- **Comprehensive RAG System**: Ultra-fast document search using OpenAI text-embedding-3-small, PostgreSQL pgvector for similarity search, and automatic chunking of large documents. Semantic search is performed across documents with OCR text and AI summaries, with an automatic embedding pipeline integrated into document processing.
- **AI Assistant Performance Optimization**: Implements intelligent context caching with a 5-minute in-memory cache, storing documents, analyses, and company data for instant responses after initial context load.

### Feature Specifications
- **Investment Pipeline Management**: Kanban-style deal flow across 7 stages with AI-driven transitions.
- **AI-Powered Document Processing**: OCR and AI analysis for document summarization from various formats, with batch processing and WebSocket progress updates.
- **Multi-Agent AI Analysis**: Specialized AI agents (Clinical, Legal, Commercial, HR, Financial, IP, Research, Founder Success, Advisory) for due diligence, founder assessment, strategic guidance, and intelligent scoring.
- **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration (web scraping), financial intelligence, and competitor analysis.
- **Matching Intelligence System**: AI-powered organization-to-deal matching based on sector, stage, geography, check size, and thesis alignment, with persistent background processing.
- **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) automatically triggered after company research.
- **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with a robust fallback system ensuring no "No information available" responses across all 26 sections using a 263-document dataset.

### System Design Choices
- **Data Flow**: Deals are submitted, documents processed, AI agents analyze different aspects, external research augments profiles, leading to scoring and evaluation. Deals then progress through pipeline stages with notifications.
- **Deployment**: Development uses Replit (Node.js 20), PostgreSQL 16, Vite, Express. Production uses Google Cloud Run, optimized Node.js runtime, external PostgreSQL.
- **Configuration**: Environment variables, modular service architecture.
- **Build System**: Executable shell script for Replit deployment, Vite for frontend, esbuild for backend.
- **Size Optimization**: Enhanced .dockerignore, automated cleanup scripts, Node modules optimization, and production build pipeline for minification and tree-shaking, ensuring deployment size under 2GB.
- **Error Handling**: Implemented robust error handling for uploads, including timeouts, local storage fallback, graceful degradation, and clear user feedback.
- **Rate Limiting & Memory Management**: Reduces concurrent processing, adds delays between AI API calls with exponential backoff, implements a BulletproofRateLimiter service for API quotas, and uses memory management with garbage collection hints.

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
- **Google Cloud Storage (GCS)**: Direct uploads for large files, bypassing Cloud Run limits.
- **Affinity CRM**: For organization data synchronization.