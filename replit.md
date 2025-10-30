# Aescuvest AI Investment Platform

## Overview
The Aescuvest AI Investment Platform is a venture capital investment platform that uses artificial intelligence for advanced investment analysis and decision-making. It aims to streamline the investment process from deal flow management to in-depth AI-powered analysis and intelligent matching, transforming complex investment data into actionable insights through intelligent technology, comprehensive research, and automated due diligence.

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
- **Background Processing**: Database-backed job queue with persistent progress tracking, WebSocket updates, and aggressive stuck job cleanup (auto-removes stuck jobs after 30 minutes, checks every 5 minutes)

### Key Features
- **Investment Pipeline Management**: Kanban-style deal flow with AI-driven transitions.
- **AI-Powered Document Processing**: OCR and AI analysis for document summarization, batch processing, and WebSocket updates.
- **Multi-Agent AI Analysis**: Specialized AI agents (Clinical, Legal, Commercial, HR, Financial, IP, Research, Founder Success, Advisory) for due diligence, founder assessment, strategic guidance, and intelligent scoring. All agents use comprehensive document processing (analyzing ALL documents with AI summaries for cross-agent insights), ensuring full analysis runs match rerun quality. Features persistent question reruns with database-backed progress tracking that survives page refreshes and server restarts.
  - **Resilient Architecture (All 7 Comprehensive Agents - Oct 2025)**: Complete architectural alignment achieved. All agents (Legal, Clinical, Commercial, HR, Financial, IP, Research) now use identical batch→synthesis flow with:
    - **Token-based batching**: 6K token limit per batch for optimal API efficiency
    - **Timeout hierarchy**: 90s evidence extraction → 120s batch processing → 180s final synthesis (cleaned conflicting 10s/15s sub-timeouts Oct 13, 2025)
    - **Retry patterns**: 3-5 exponential backoff retries via resilientOpenAI wrapper
    - **Partial result caching**: Global cache persistence with automatic recovery on synthesis failures
    - **Rate limiting**: Centralized 50 calls/min semaphore shared across all agents
    - **Cache cleanup**: Automatic cleanup of partial results after successful synthesis
    - **No document limits**: All agents process ALL relevant documents (removed arbitrary limits like "top 5")
    - **Stuck Job Prevention (Oct 12, 2025)**: Aggressive cleanup service auto-terminates stuck jobs after 360 minutes (6 hours, increased from 120 min Oct 13), with 5-minute monitoring intervals to prevent indefinite processing states
    - **Promise Resilience (Oct 13, 2025)**: All agents use Promise.allSettled with type guards for error resilience, eliminating failures from single document errors
    - **Database Column Fix (Oct 13, 2025)**: Fixed critical bug where agent Q&A results weren't saving - all comprehensive agents now use correct snake_case column names (legal_answers, clinical_answers, commercial_answers, hr_answers, financial_answers, ip_answers) matching the PostgreSQL schema instead of incorrect camelCase names that were silently failing to persist data
  - **Standardized Output Formatting (Oct 2025)**: All 7 comprehensive agents use identical markdown formatting in synthesis prompts - markdown bullets (•) for evidence lists, **bold** for key terms/metrics, and structured sections with domain-appropriate examples. Ensures consistent, readable output across all agent types.
- **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration, financial intelligence, and competitor analysis.
- **Matching Intelligence System**: AI-powered organization-to-deal matching based on sector, stage, geography, check size, and thesis alignment.
- **PDF Viewer**: Inline PDF viewing with canvas-based rendering.
- **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) after company research with live background progress tracking (Oct 29, 2025).
  - **Live Progress Tracking (Oct 29, 2025)**: Real-time progress display from 0-100% during AI evaluation with granular step-by-step updates (Initializing → Gathering Data → Research → Analyzing Criteria → Complete). Progress bar shows current percentage and descriptive status text, updating every 2 seconds. Implementation includes:
    - **Background Job System**: Persistent job tracking in PostgreSQL with 12+ progress stages (5% increments from data gathering through final scoring)
    - **Reload Persistence**: Progress survives page refreshes via unconditional background job polling and auto-detection of in-progress jobs on mount
    - **Race Condition Protection**: 409 conflict errors prevent concurrent evaluations, ensuring only one evaluation runs at a time per deal
    - **Failure Recovery**: Failed jobs clear UI state, display error toasts with specific messages, invalidate cached queries, and re-enable retry button
    - **Concurrent Run Prevention**: Static jobId per deal prevents duplicate evaluations; existing processing jobs return clear "already in progress" messages
    - **Error Handling**: Route handler preserves custom HTTP status codes (409, 404, 500) for appropriate client-side handling and user feedback
- **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with a robust fallback system ensuring complete information across all 26 sections.
  - **Stale Job Auto-Recovery (Oct 22, 2025)**: Automatic detection and recovery from ghost jobs that block memo generation. Jobs stuck for 20+ minutes without heartbeat updates are automatically marked as failed, allowing new generation to proceed. Prevents permanent blocking from crashed/stuck background jobs while protecting legitimate long-running generations via 5-minute heartbeat updates.
  - **Live Progress Tracking (Oct 22, 2025)**: Real-time progress updates from 30% → 90% during section generation. Updates job status as each of 27 sections completes (e.g., "Generating section 5/27: Market Analysis - 52%"), with WebSocket broadcasts for immediate UI feedback. Eliminates "frozen at 30%" perception during 20-30 minute AI generation for deals with 300+ documents.
- **Ultra-Premium PDF Export**: Enterprise-grade typography and professional formatting.
- **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass extraction strategy.
- **Large File Upload System**: Comprehensive chunked upload infrastructure supporting files up to 5GB with automatic chunking, resumable uploads, real-time progress tracking, and integration with document processing via a specialized Cloud Run upload service.
- **RAG Embedding System (Oct 13, 2025)**: Resilient vector embedding pipeline for instant document search with:
  - **Timeout Protection**: 30s timeout per embedding API call using Promise.race
  - **Retry Logic**: 3-attempt exponential backoff (2s → 4s → 8s delays) for timeout/429/5xx errors
  - **Rate Limiting**: 500ms delay between chunk embeddings to prevent API overload
  - **Error Classification**: Distinguishes retryable (timeout, rate limit, server errors) vs non-retryable errors
  - **Prevents 95% Stuck Jobs**: Eliminates socket timeout failures that previously caused jobs to hang at "Adding to RAG system" step
- **Email Inbox Integration (Oct 30, 2025)**: Persistent email configuration system with dual authentication support for automated deal flow monitoring:
  - **Persistent Configuration Storage**: Database-backed email settings (IMAP/Microsoft OAuth) stored in system_settings table with automatic loading on server startup
  - **Dual Authentication Support**: 
    - **IMAP Configuration**: Support for Gmail (imap.gmail.com:993), Outlook (outlook.office365.com:993), and custom IMAP servers with SSL/TLS
    - **Microsoft OAuth Integration**: Azure MSAL-based OAuth2 authentication for Microsoft 365 mailboxes with automatic token refresh
  - **Configuration UI**: Comprehensive settings page (Settings → Email tab) with provider-specific setup instructions, test connection button, and real-time status display
  - **Inbox Page Integration**: Configuration status banner with one-click link to settings when email is not configured
  - **API Endpoints**: 
    - GET `/api/inbox/config/status` - Check configuration status
    - POST `/api/inbox/config` - Save IMAP configuration
    - GET `/api/inbox/test` - Test IMAP connection
    - GET `/api/microsoft/status` - Check Microsoft OAuth status
  - **Setup Wizard**: Step-by-step instructions for generating App Passwords (Gmail/Outlook) with visual guidance and inline validation
  - **Graceful Degradation**: Service handles missing configuration gracefully, allowing manual email processing as fallback

### Deployment
- **Development**: Replit (Node.js 20), PostgreSQL 16, Vite, Express.
- **Production**: Google Cloud Run, optimized Node.js runtime, external PostgreSQL.
- **Configuration**: Environment variables, modular service architecture.
- **Build System**: Executable shell script for Replit deployment, Vite for frontend, esbuild for backend.
- **Size Optimization**: Enhanced .dockerignore, automated cleanup, Node modules optimization, and production build pipeline for minification and tree-shaking, ensuring deployment size under 2GB.

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