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
- **Background Processing**: Database-backed job queue with persistent progress tracking, WebSocket updates, and automatic cleanup

### Key Features
- **Investment Pipeline Management**: Kanban-style deal flow with AI-driven transitions.
- **AI-Powered Document Processing**: OCR and AI analysis for document summarization, batch processing, and WebSocket updates.
- **Multi-Agent AI Analysis**: Specialized AI agents (Clinical, Legal, Commercial, HR, Financial, IP, Research, Founder Success, Advisory) for due diligence, founder assessment, strategic guidance, and intelligent scoring. Legal agent features persistent question reruns with database-backed progress tracking that survives page refreshes and server restarts.
- **Company Intelligence Platform**: Automated company profiling, CEO background analysis, external data integration, financial intelligence, and competitor analysis.
- **Matching Intelligence System**: AI-powered organization-to-deal matching based on sector, stage, geography, check size, and thesis alignment.
- **PDF Viewer**: Inline PDF viewing with canvas-based rendering.
- **Automated AI Evaluation**: Critical scoring (PASS, INVESTIGATE, REJECT) after company research.
- **Investment Memo Generation**: Comprehensive 30-50 page investment memorandums with a robust fallback system ensuring complete information across all 26 sections.
- **Ultra-Premium PDF Export**: Enterprise-grade typography and professional formatting.
- **Multi-Pass OCR Extraction**: Processes complete OCR text from documents without character limits using a three-pass extraction strategy.
- **Large File Upload System**: Comprehensive chunked upload infrastructure supporting files up to 5GB with automatic chunking, resumable uploads, real-time progress tracking, and integration with document processing via a specialized Cloud Run upload service.

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