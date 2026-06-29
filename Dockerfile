# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ---- Stage 2: Build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Create data directory for build time
RUN mkdir -p data/logos
RUN npm run build

# ---- Stage 3: Production runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=2504
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy example data files into the image (used by entrypoint to init on first start)
COPY --from=builder /app/data/config.example.json /app/data/config.example.json
COPY --from=builder /app/data/services.example.json /app/data/services.example.json
COPY --from=builder /app/data/topology.example.json /app/data/topology.example.json
COPY --from=builder /app/data/calendar.example.json /app/data/calendar.example.json
COPY --from=builder /app/data/custom_tabs.example.json /app/data/custom_tabs.example.json

# Copy entrypoint script
COPY --from=builder /app/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create directories with proper permissions
RUN mkdir -p /app/data/logos && chown -R nextjs:nodejs /app/data
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache

USER nextjs

EXPOSE 2504

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]

