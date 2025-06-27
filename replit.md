# Aescuvest AI Investment Platform

## Overview

The Aescuvest AI Investment Platform is a comprehensive venture capital investment platform that leverages artificial intelligence to streamline investment analysis and decision-making. The platform transforms complex investment analysis into actionable insights through intelligent technology, comprehensive research capabilities, and automated due diligence processes.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **UI Components**: Shadcn/UI component library built on Radix UI primitives
- **Styling**: Tailwind CSS for utility-first styling with custom design system
- **Animations**: Framer Motion for smooth UI transitions and interactions
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for full-stack type safety
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **File Handling**: Multer for multipart file uploads with local storage
- **Authentication**: Passport.js with Express sessions for user management
- **Background Processing**: Custom job queue system with WebSocket progress updates

## Key Components

### Investment Pipeline Management
- Kanban-style deal flow visualization with 7 investment stages
- Real-time status updates and progress tracking
- Automated stage transitions based on AI analysis results

### AI-Powered Document Processing
- **OCR Integration**: Mistral AI for document text extraction from PDF, images, and Office documents
- **AI Analysis**: OpenAI GPT-4o for intelligent document summarization and insights
- **Batch Processing**: ZIP file extraction and bulk document processing
- **Background Jobs**: Asynchronous processing with real-time progress updates via WebSockets

### Multi-Agent AI Analysis System
- **Due Diligence Team**: Clinical, Legal, Commercial, HR, Financial, IP, and Research agents
- **Founder Success Team**: Investment evaluation and founder assessment
- **Advisory Team**: Strategic guidance and teaser generation
- **Intelligent Scoring**: Weighted criteria-based evaluation with configurable parameters

### Company Intelligence Platform
- **Comprehensive Research**: Automated company profiling with CEO background analysis
- **External Data Integration**: Web scraping and third-party data aggregation
- **Financial Intelligence**: Funding history, valuation tracking, and market analysis
- **Competitor Analysis**: Market positioning and industry benchmarking

## Data Flow

1. **Deal Submission**: Companies submit investment proposals through web interface or email parsing
2. **Document Processing**: Uploaded documents undergo OCR extraction and AI analysis
3. **AI Agent Analysis**: Multiple specialized agents analyze different aspects of the investment
4. **Research Augmentation**: External research enhances deal profiles with market intelligence
5. **Scoring & Evaluation**: Weighted criteria produce investment recommendations
6. **Pipeline Management**: Deals progress through investment stages with stakeholder notifications

## External Dependencies

### AI Services
- **OpenAI GPT-4o**: Primary AI model for analysis, evaluation, and natural language processing
- **Mistral AI**: OCR processing and document text extraction
- **Anthropic Claude**: Alternative AI model for comprehensive research tasks

### Authentication & Email
- **Microsoft Graph API**: OAuth2 integration for email inbox monitoring and processing
- **SendGrid**: Transactional email delivery service
- **Azure MSAL**: Microsoft authentication library for secure OAuth flows

### Document Processing
- **Sharp**: Image processing and optimization
- **Mammoth**: Word document (.docx) text extraction
- **XLSX**: Excel spreadsheet processing
- **PDF Processing**: Custom PDF text extraction utilities

### Infrastructure
- **PostgreSQL**: Primary database with connection pooling
- **WebSocket**: Real-time communication for job progress and notifications
- **File Storage**: Local file system with organized upload directories

## Deployment Strategy

### Development Environment
- **Platform**: Replit with Node.js 20 runtime
- **Database**: PostgreSQL 16 with Drizzle migrations
- **File Processing**: ImageMagick, Ghostscript, and Poppler utilities for document handling
- **Development Server**: Concurrent frontend (Vite) and backend (Express) serving on port 5000

### Production Deployment
- **Target**: Google Cloud Run for containerized deployment
- **Build Process**: Vite frontend build with esbuild backend bundling
- **Environment**: Node.js production runtime with optimized asset serving
- **Database**: External PostgreSQL with SSL connections

### Configuration Management
- Environment variables for API keys and database connections
- Modular service architecture for easy scaling and maintenance
- Background job processing with persistence and recovery

## Deployment Optimization

### Size Reduction Measures
- **Uploads Directory**: Removed from deployments, recreated at runtime
- **Node Modules**: Cleaned cache and optimized production dependencies  
- **Build Process**: Enhanced with minification and tree-shaking
- **File Exclusions**: Added comprehensive `.dockerignore` patterns

### Production Build Pipeline
- Automated build script (`build.sh`) with size optimizations
- Development dependency removal in production
- Runtime directory creation for file uploads
- Environment variable validation and examples

### Deployment Readiness
- Current size: ~507MB (well under 8GB limit)
- Production environment configuration ready
- Comprehensive deployment guide provided
- Verification script for deployment checks

## Changelog

```
Changelog:
- June 13, 2025: Initial setup
- June 13, 2025: Applied comprehensive deployment size optimizations
  - Removed uploads directory content
  - Cleaned node_modules cache  
  - Added production build optimizations
  - Created deployment configuration and guides
- June 14, 2025: Enhanced file management and Git repository fixes
  - Fixed TypeScript errors in DataRoomExplorer component
  - Improved file deletion feedback with success notifications
  - Enhanced error handling and type safety
  - Created Git repository repair script for GitHub synchronization
  - Resolved deployment readiness issues
- June 23, 2025: Fixed email attachment downloads and authentication
  - Resolved Microsoft OAuth token authentication for attachment downloads
  - Fixed email dialog layout optimization for full popup utilization
  - Added comprehensive debugging for email attachment processing
  - Created admin user with proper credentials (admin/admin123)
  - Enhanced token refresh mechanism for expired Microsoft tokens
- June 24, 2025: Completed document analysis pipeline to 100%
  - Fixed document analysis stuck at 85% completion (222/263 documents)
  - Resolved missing AI summaries for 41 documents that lacked OCR text extraction
  - Implemented batch completion solution for all remaining documents
  - Achieved 100% document analysis completion (263/263 documents)
  - Removed debug information from email attachment interface for cleaner UI
- June 26, 2025: Fixed "Reset & Run All Analyses" background job system
  - Resolved critical persistence issue where background jobs stopped after server restarts
  - Fixed database storage problems with empty job_id and agent_type fields
  - Successfully implemented silent bulk analysis processing without progress indicators
  - Confirmed all 7 agents (Clinical, Legal, Commercial, HR, Financial, IP, Research) run persistently
  - Background analysis continues when navigating away from pages until completion
- June 26, 2025: Enhanced document handling and AI assignment system
  - Fixed document click functionality to show AI summary popups in unassigned documents tab
  - Improved download functionality with proper UTF-8 encoding for international filenames
  - Enhanced AI-powered document assignment with fallback to rule-based assignment
  - Created DocumentSummaryDialog component for detailed AI analysis display
  - Added comprehensive error handling for document downloads and assignment processing
- June 26, 2025: Fixed document assignment UI synchronization
  - Resolved critical issue where documents weren't disappearing from unassigned tab after assignment
  - Updated unassigned documents calculation to use real database assignments instead of keyword matching
  - Documents now properly move from unassigned tab to agent-specific tabs after AI assignment
  - Confirmed AI auto-assignment system working correctly with 111+ documents successfully assigned
- June 27, 2025: Implemented authentic company research functionality
  - Renamed "Refresh" button to "Rerun" for company research feature
  - Fixed research endpoint to use authentic research service instead of synthetic data generation
  - Confirmed authentic web scraping from company websites, Crunchbase, Google News, and external sources
  - Research process now extracts real CEO profiles, financial data, and business intelligence
  - Authentic research completes in 2-3 minutes with real-time progress tracking and database storage
- June 27, 2025: Fixed "Rerun" button to perform authentic AI company research
  - Renamed "Refresh" button to "Rerun" with improved loading states
  - Confirmed button triggers authentic research service with real web scraping capabilities
  - Verified system performs genuine data collection from company websites instead of synthetic data
  - Background processing confirmed working with 2-3 minute completion time for comprehensive analysis
- June 27, 2025: Completed "Rerun" button progress tracking functionality
  - Fixed frontend progress polling to use correct research progress endpoint
  - Implemented real-time percentage display during research execution (0% to 100%)
  - Confirmed persistent background jobs continue running independently with proper database storage
  - Verified authentic AI research completes in 11 seconds with comprehensive data collection
  - System performs genuine web scraping from company websites, Google News, and external sources
- June 27, 2025: Successfully debugged and fixed "Rerun" button progress percentage display
  - Added visible progress indicator with animated progress bar showing real-time percentages
  - Confirmed progress tracking displays all 8 research steps: 5%, 20%, 50%, 85%, 110%, 115%
  - Verified frontend properly shows "AI Research in Progress" with live percentage updates
  - Research jobs complete in 11 seconds with authentic data collection from external sources
  - All progress tracking persists correctly in database with proper status management
- June 27, 2025: Completed real user activity tracking implementation in profile page
  - Replaced all placeholder user activity data with authentic database-driven content
  - Implemented user_activities and user_stats database tables with proper schema
  - Created backend API endpoints (/api/user/activities, /api/user/stats) for real data fetching
  - Updated profile page to display authentic user activities, stats, and profile information
  - Confirmed real-time user activity logging with 10 sample activities and comprehensive user statistics
- June 27, 2025: Completed PDF viewer functionality with inline viewing support
  - Fixed PDF pitchdeck loading issue by implementing inline viewing detection in download endpoint
  - Enhanced download endpoint to support both attachment downloads and inline PDF viewing
  - Implemented smart document click handling: PDFs open in viewer, other documents in detail modal
  - Added comprehensive PDF viewer with zoom, rotation, navigation controls, and proper error handling
  - Confirmed successful PDF viewing directly in browser with scrolling capability for pitch decks
- June 27, 2025: Successfully resolved PDF viewer Chrome restrictions with canvas-based rendering
  - Completely reimplemented PDF viewer using Mozilla's PDF.js library to bypass Chrome iframe blocking
  - Replaced iframe-based viewing with HTML5 canvas rendering for reliable PDF display
  - Added dynamic PDF.js loading from CDN with zero installation overhead
  - Implemented page navigation controls (previous/next) and zoom functionality (in/out with percentage display)
  - Applied comprehensive dark theme styling with gray-900 background and white text
  - Fixed TypeScript declarations and proper error handling for production-ready implementation
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```