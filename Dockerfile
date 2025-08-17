# 🚨 CRITICAL: Enhanced Dockerfile for massive file uploads
FROM node:20-slim

# Install system dependencies for large file handling
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chmod 755 uploads

# Set environment variables for large uploads
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=32768"
ENV UV_THREADPOOL_SIZE=128

# Expose port
EXPOSE 5000

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/test-route || exit 1

# Start the application
CMD ["npm", "start"]