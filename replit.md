# Aescuvest AI Investment Platform

## Overview
The Aescuvest AI Investment Platform is a venture capital investment platform that utilizes artificial intelligence for advanced investment analysis and decision-making. Its primary purpose is to streamline the investment process, from deal flow management to in-depth AI-powered analysis and intelligent matching. The platform aims to transform complex investment data into actionable insights through intelligent technology, comprehensive research, and automated due diligence, thereby revolutionizing venture capital investment.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX
The frontend is built with React 18 and TypeScript, using Wouter for routing, TanStack Query for state management, and Shadcn/UI (based on Radix UI) for UI components. Styling is handled with Tailwind CSS, and animations with Framer Motion. Vite is used for the build process.

### Technical Implementations
The backend is developed with Node.js and Express.js, leveraging TypeScript. PostgreSQL with Drizzle ORM serves as the database. File handling uses Multer for multipart uploads, and authentication is managed via Passport.js with Express sessions. Background processing is facilitated by a database-backed job queue featuring persistent progress tracking, WebSocket updates, and aggressive stuck job cleanup.

### Feature Specifications
-   **Investment Pipeline Management**: Kanban-style deal flow with AI-driven transitions.
-   **AI-Powered Document Processing**: OCR and AI analysis for document summarization, batch processing, and WebSocket updates.
-   **Multi-Agent AI Analysis**: Specialized AI agents (e.g., Clinical, Legal, Financial) conduct due diligence, founder assessment, and strategic guidance with intelligent scoring. This includes token-based batching, hierarchical timeouts, exponential backoff retries, partial result caching, centralized rate limiting, and automatic cache cleanup.
-   **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration, and competitor analysis.
-   **Matching Intelligence System**: AI-powered organization-to-deal matching based on sector, stage, geography, and investment criteria.
-   **PDF Viewer**: Inline PDF viewing with canvas-based rendering.
-   **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) with live background progress tracking and reload persistence.
-   **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with real-time WebSocket progress tracking (auto-reconnect, exponential backoff), polling fallback, and seamless state management eliminating progress bar flicker. **Quality Gate System**: Automatic embedding pre-check generates missing embeddings before memo generation, and comprehensive placeholder detection (10 patterns) blocks memos with >30% placeholder content, ensuring high-quality output with authentic document context.
-   **Ultra-Premium PDF Export**: Enterprise-grade typography and professional formatting for exports.
-   **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass strategy.
-   **Large File Upload System**: A hybrid upload infrastructure supporting files up to 5GB, intelligently routing uploads to bypass Cloud Run limits. Files ≤30MB use direct server upload, while larger files are routed to GCS signed URLs, with background ZIP extraction jobs and WebSocket progress notifications.
-   **RAG Embedding System**: Resilient vector embedding pipeline for instant document search, featuring timeout protection, retry logic, rate limiting, and robust error classification.
-   **Email Inbox Integration**: Persistent email configuration with dual authentication (IMAP/Microsoft OAuth) for automated deal flow monitoring.

### System Design Choices
-   **Development Environment**: Replit (Node.js 20), PostgreSQL 16, Vite, Express.
-   **Production Environment**: Google Cloud Run, optimized Node.js runtime, external PostgreSQL.
-   **Configuration**: Environment variables and a modular service architecture.
-   **Build System**: Executable shell script for Replit deployment, Vite for frontend, esbuild for backend.
-   **Size Optimization**: Enhanced `.dockerignore`, automated cleanup, and production build pipeline ensure deployment size under 2GB.

## External Dependencies

### AI Services
-   **OpenAI GPT-4o**: Core AI model for analysis, evaluation, and NLP.
-   **Mistral AI**: OCR and document text extraction.
-   **Anthropic Claude**: Comprehensive research tasks.

### Authentication & Email
-   **Microsoft Graph API**: OAuth2 for email inbox monitoring.
-   **SendGrid**: Transactional email delivery.
-   **Azure MSAL**: Microsoft authentication.

### Document Processing Libraries
-   **Sharp**: Image processing.
-   **Mammoth**: .docx text extraction.
-   **XLSX**: Excel spreadsheet processing.
-   **Custom PDF utilities**: For text extraction.

### Infrastructure
-   **PostgreSQL**: Primary database.
-   **WebSocket**: Real-time communication.
-   **Local File System**: For file storage.
-   **Affinity CRM**: For organization data synchronization.