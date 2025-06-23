# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Create app user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S stackblog -u 1001 -G nodejs

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=stackblog:nodejs . .

# Create necessary directories
RUN mkdir -p content/media logs && \
    chown -R stackblog:nodejs content logs

# Create health check script
COPY --chown=stackblog:nodejs healthcheck.js .

# Switch to non-root user
USER stackblog

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "app.js"]