# Deployment Guide for Aescuvest AI Investment Platform

## Pre-deployment Size Optimization

The following optimizations have been implemented to reduce deployment size:

### 1. Files Removed
- `uploads/` directory content (runtime directory will be recreated)
- `node_modules/.cache/` directories
- Log files (`*.log`, `npm-debug.log*`, etc.)
- Development test files and documentation

### 2. Deployment Configuration
- Created `.dockerignore` to exclude large files
- Added production build optimization script
- Configured runtime directory creation

## Environment Variables Required

Set these environment variables in your deployment configuration:

```bash
# Database (Required)
DATABASE_URL=postgresql://username:password@host:port/database

# AI Services (Required)
OPENAI_API_KEY=your_openai_api_key
MISTRAL_API_KEY=your_mistral_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Microsoft Graph API (Required for email features)
MICROSOFT_CLIENT_ID=your_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=your_tenant_id

# Email Service (Required)
SENDGRID_API_KEY=your_sendgrid_api_key

# Security (Required)
SESSION_SECRET=your_secure_session_secret

# Environment (Required)
NODE_ENV=production
PORT=5000
```

## Deployment Steps

### Using the Production Build Script

1. Run the optimized build:
   ```bash
   ./build.sh
   ```

2. This script will:
   - Clean previous builds
   - Install dependencies
   - Build frontend with Vite optimizations
   - Build backend with esbuild minification
   - Remove development dependencies
   - Clean unnecessary files from node_modules
   - Create runtime directories

### Manual Deployment

If you prefer manual deployment:

1. Clean and prepare:
   ```bash
   rm -rf uploads node_modules/.cache dist
   npm ci --production=false
   ```

2. Build application:
   ```bash
   npm run build
   ```

3. Remove development dependencies:
   ```bash
   npm prune --production
   ```

## Size Reduction Results

The following optimizations reduce deployment size significantly:

- **Uploads directory**: Removed (recreated at runtime)
- **Node modules cache**: Cleaned
- **Development dependencies**: Removed in production
- **Test files and docs**: Excluded from deployment
- **Build artifacts**: Minified and tree-shaken

## Runtime Requirements

The application requires these directories at runtime:
- `uploads/` - Created automatically for file uploads
- `dist/` - Contains built application
- `node_modules/` - Production dependencies only

## Production Environment Setup

1. **Database**: PostgreSQL 16+ with connection pooling
2. **Node.js**: Version 20+ required
3. **Memory**: Minimum 2GB RAM recommended
4. **Storage**: 1GB+ for application and runtime files
5. **Network**: Outbound HTTPS access for AI APIs

## Security Configuration

Ensure these security settings:
- Use strong SESSION_SECRET (32+ characters)
- Enable HTTPS in production
- Set secure database connection strings
- Validate all environment variables are present

## Monitoring

The application includes:
- Health check endpoints
- WebSocket connection monitoring
- Background job progress tracking
- Database connection status

## Troubleshooting

Common deployment issues:
1. **Missing environment variables**: Check all required variables are set
2. **Database connection**: Verify DATABASE_URL and network access
3. **File permissions**: Ensure uploads directory can be created
4. **Memory limits**: Monitor for AI processing memory usage