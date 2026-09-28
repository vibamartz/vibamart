# Multi-stage production Dockerfile for ViBa Mart application

# Stage 1: Dependency & Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install package dependencies
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy source code & assets
COPY tsconfig.json vite.config.ts index.html server.ts ./
COPY public ./public
COPY src ./src
COPY api ./api

# Build Vite frontend bundle
RUN npm run build

# Stage 2: Production Lightweight Runtime Image
FROM node:20-alpine AS runner

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts && npm install tsx

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy server code
COPY server.ts ./
COPY api ./api
COPY src/backend ./src/backend
COPY src/shared ./src/shared
COPY tsconfig.json ./

# Create non-root user and assign permissions
RUN addgroup -S vibamart && adduser -S vibamart -G vibamart && \
    chown -R vibamart:vibamart /app

USER vibamart

# Expose internal HTTP port
EXPOSE 3000

# Container healthcheck probing /api/health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start ViBa Mart Production Server
CMD ["npx", "tsx", "server.ts"]
