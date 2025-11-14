# Aescuvest AI Investment Platform

## Overview
The Aescuvest AI Investment Platform is a venture capital investment platform leveraging artificial intelligence for advanced investment analysis and decision-making. Its primary purpose is to streamline the investment process, from deal flow management to in-depth AI-powered analysis and intelligent matching, by transforming complex investment data into actionable insights through intelligent technology, comprehensive research, and automated due diligence. The platform aims to revolutionize venture capital investment by providing a sophisticated, AI-driven solution.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The platform utilizes React 18 with TypeScript, Wouter for routing, TanStack Query for state management, and Shadcn/UI (built on Radix UI) for UI components. Styling is managed with Tailwind CSS, and animations are handled by Framer Motion. The build process uses Vite.

### Technical Implementations
The backend is built with Node.js and Express.js, leveraging TypeScript. PostgreSQL with Drizzle ORM is used for the database. File handling incorporates Multer for multipart uploads, and authentication is managed via Passport.js with Express sessions. Background processing is handled by a database-backed job queue with persistent progress tracking, WebSocket updates, and aggressive stuck job cleanup.

### Feature Specifications
- **Investment Pipeline Management**: Kanban-style deal flow with AI-driven transitions.
- **AI-Powered Document Processing**: OCR and AI analysis for document summarization, batch processing, and WebSocket updates.
- **Multi-Agent AI Analysis**: Specialized AI agents (Clinical, Legal, Commercial, HR, Financial, IP, Research, Founder Success, Advisory) for due diligence, founder assessment, strategic guidance, and intelligent scoring. These agents comprehensively process all documents, ensuring full analysis runs and offering persistent question reruns with database-backed progress tracking. The architecture includes token-based batching, a hierarchical timeout system, exponential backoff retries, partial result caching, centralized rate limiting, and automatic cache cleanup. Robust error handling, including Promise.allSettled with type guards and proper database column mapping, ensures resilience.
- **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration, financial intelligence, and competitor analysis.
- **Matching Intelligence System**: AI-powered organization-to-deal matching based on various criteria (sector, stage, geography, check size, thesis).
- **PDF Viewer**: Inline PDF viewing with canvas-based rendering.
- **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) with live background progress tracking, reload persistence, and race condition protection.
- **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with a robust fallback system and live progress tracking with stale job auto-recovery.
- **Ultra-Premium PDF Export**: Enterprise-grade typography and professional formatting.
- **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass extraction strategy.
- **Large File Upload System**: Hybrid upload infrastructure supporting files up to 5GB using intelligent routing to bypass Cloud Run's 32MB load balancer limit. Files ≤30MB use direct server upload; files >30MB automatically route to GCS signed URLs. The system includes: (1) upload negotiation endpoint that determines optimal upload method based on file size, (2) GCS signed URL generation with 15-minute expiration for large file uploads, (3) callback endpoint that triggers background ZIP extraction jobs after successful GCS upload, (4) background job architecture with persistent progress tracking (downloading→extracting→completed), (5) WebSocket real-time progress notifications, and (6) graceful error handling with clear infrastructure limit guidance. Endpoints are registered early in server/index.ts before Vite middleware to ensure proper execution.
- **RAG Embedding System**: Resilient vector embedding pipeline for instant document search, featuring timeout protection, retry logic, rate limiting, and robust error classification to prevent stuck jobs.
- **Email Inbox Integration**: Persistent email configuration system with dual authentication support (IMAP/Microsoft OAuth) for automated deal flow monitoring. It includes a comprehensive settings UI, test connection functionality, and API endpoints for configuration management.

### System Design Choices
- **Development Environment**: Replit (Node.js 20), PostgreSQL 16, Vite, Express.
- **Production Environment**: Google Cloud Run, optimized Node.js runtime, external PostgreSQL.
- **Configuration**: Environment variables and a modular service architecture.
- **Build System**: Executable shell script for Replit deployment, Vite for frontend, esbuild for backend.
- **Size Optimization**: Enhanced `.dockerignore`, automated cleanup, Node modules optimization, and a production build pipeline for minification and tree-shaking ensure deployment size under 2GB.

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