# Build stage
FROM oven/bun:1-debian AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY prisma prisma
RUN bun --bunx prisma generate

COPY . .

# Production stage
FROM oven/bun:1-debian AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends wget && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Use the existing 'bun' user for security
# Create a writable directory for sqlite database
RUN mkdir -p /app/db && chown bun:bun /app/db
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/prisma ./prisma
COPY --from=builder --chown=bun:bun /app/src ./src
COPY --from=builder --chown=bun:bun /app/generated ./generated
COPY --from=builder --chown=bun:bun /app/package.json ./package.json

USER bun

EXPOSE 3000

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
