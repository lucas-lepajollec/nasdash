# ---- Stage 1: Build ----
FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Create data directory for build time
RUN mkdir -p data/logos
RUN npm run build

# ---- Stage 2: Production runner ----
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=2504
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy example data files into the image defaults directory (not hidden by volume mounts)
RUN mkdir -p /app/defaults
COPY --from=builder /app/data/config.example.json /app/defaults/config.example.json
COPY --from=builder /app/data/services.example.json /app/defaults/services.example.json
COPY --from=builder /app/data/topology.example.json /app/defaults/topology.example.json
COPY --from=builder /app/data/calendar.example.json /app/defaults/calendar.example.json
COPY --from=builder /app/data/custom_tabs.example.json /app/defaults/custom_tabs.example.json
COPY --from=builder /app/data/users.example.json /app/defaults/users.example.json

# Public showcase fixtures. They contain no real infrastructure data or secrets.
RUN mkdir -p /app/demo/fixtures
COPY --from=builder /app/demo/fixtures/ /app/demo/fixtures/

# Copy entrypoint script
COPY --from=builder /app/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Create directories with proper permissions
RUN mkdir -p /app/data/logos && chown -R nextjs:nodejs /app/defaults /app/demo /app/data
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next/cache

USER nextjs

EXPOSE 2504

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider "http://127.0.0.1:${PORT}/api/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
