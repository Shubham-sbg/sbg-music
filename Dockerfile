# Multi-stage production build for SBG MUSIC Node/Express runtime
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci || npm install

# Copy source code and build config
COPY . .

# Build frontend and bundled server (dist/server.cjs)
ENV NODE_ENV=production
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built distribution assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/sitemap.xml ./dist/sitemap.xml
COPY --from=builder /app/robots.txt ./dist/robots.txt

# Expose standard runtime port
EXPOSE 3000

# Container healthcheck using lightweight HTTP endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the compiled self-contained CommonJS server
CMD ["node", "dist/server.cjs"]
