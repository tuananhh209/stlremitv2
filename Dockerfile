# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env vars (passed from Railway as build args)
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Provide dummy values for server-side vars so Next.js build doesn't crash.
# Real values are injected at runtime via Railway environment variables.
ARG DATABASE_URL="postgresql://placeholder:placeholder@placeholder/placeholder"
ARG ESCROW_CONTRACT_ID="CPLACEHOLDER"
ARG AGENT_SECRET_KEY="SPLACEHOLDER"
ARG AGENT_PUBLIC_KEY="GPLACEHOLDER"
ARG CLOUDINARY_CLOUD_NAME="placeholder"
ARG CLOUDINARY_API_KEY="placeholder"
ARG CLOUDINARY_API_SECRET="placeholder"
ARG USDC_TOKEN_ID="CPLACEHOLDER"

ENV DATABASE_URL=${DATABASE_URL}
ENV ESCROW_CONTRACT_ID=${ESCROW_CONTRACT_ID}
ENV AGENT_SECRET_KEY=${AGENT_SECRET_KEY}
ENV AGENT_PUBLIC_KEY=${AGENT_PUBLIC_KEY}
ENV CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
ENV CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
ENV CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
ENV USDC_TOKEN_ID=${USDC_TOKEN_ID}

RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", "server.js"]
