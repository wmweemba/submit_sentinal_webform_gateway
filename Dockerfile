# Submit Sentinel - Multi-Tenant Form-to-Email Gateway
# Multi-stage Docker build for minimal footprint (target: <100MB RAM)
# Based on Node.js 18 Alpine for smallest possible image size

# ==================== BUILD STAGE ====================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install production dependencies only (no dev dependencies)
# Using npm ci for reproducible builds (clean install)
RUN npm ci --omit=dev

# ==================== RUNTIME STAGE ====================
FROM node:18-alpine

# Security best practices for Alpine Node.js images:
# 1. Run as non-root user to minimize container privileges
# 2. Create dedicated user and group for the application
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source code with proper ownership
COPY --chown=nodejs:nodejs . .

# Create uploads directory with correct permissions
# This directory will store temporary file uploads
RUN mkdir -p ./uploads && \
    chown -R nodejs:nodejs ./uploads && \
    chmod 755 ./uploads

# Switch to non-root user for security
USER nodejs

# Expose the application port (default: 3000)
EXPOSE 3000

# Health check endpoint for container orchestration
# Returns 200 if server is responding to health checks
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = {host: 'localhost', port: 3000, path: '/health', timeout: 2000}; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => { process.exit(1); }); req.end();"

# Environment variables for runtime configuration
ENV NODE_ENV=production \
    PORT=3000 \
    MAX_FILE_SIZE_MB=5 \
    RATE_LIMIT_WINDOW_MS=60000 \
    RATE_LIMIT_MAX_REQUESTS=5 \
    UPLOAD_DIR=./uploads

# Start the application using ES modules support
CMD ["node", "index.js"]

# ==================== DOCKER USAGE NOTES ====================
#
# Build the image:
#   docker build -t submit-sentinel:latest .
#
# Run the container with environment variables:
#   docker run -d \
#     --name submit-sentinel \
#     -p 3000:3000 \
#     -v $(pwd)/config:/app/config:ro \
#     -v submit-sentinel-uploads:/app/uploads \
#     -e SMTP_HOST=smtp.gmail.com \
#     -e SMTP_PORT=587 \
#     -e SMTP_USER=your-email@gmail.com \
#     -e SMTP_PASS=your-app-password \
#     submit-sentinel:latest
#
# Docker Compose example (docker-compose.yml):
#   version: '3.8'
#   services:
#     submit-sentinel:
#       build: .
#       ports:
#         - "3000:3000"
#       volumes:
#         - ./config:/app/config:ro
#         - submit-sentinel-uploads:/app/uploads
#       environment:
#         - SMTP_HOST=${SMTP_HOST}
#         - SMTP_PORT=${SMTP_PORT}
#         - SMTP_USER=${SMTP_USER}
#         - SMTP_PASS=${SMTP_PASS}
#       restart: unless-stopped
#
#   volumes:
#     submit-sentinel-uploads: