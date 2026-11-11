# Production image for the Next.js frontend.
#
# Runs `next start`, the standard Next.js production server — it binds to $PORT
# (which Render injects) on 0.0.0.0 and serves the app plus its static assets.
# Base is node:20-slim (Debian/glibc) so Next's prebuilt SWC binary loads with
# no compat shims.

FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Render overrides PORT at runtime; 3000 is just the local default.
ENV PORT=3000
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
EXPOSE 3000
# Bind all interfaces on the injected port.
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
