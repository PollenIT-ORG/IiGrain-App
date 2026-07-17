# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Copy manifests + the Prisma schema BEFORE install, because the postinstall
# hook runs `prisma generate`, which needs prisma/schema.prisma to be present.
COPY package*.json ./
COPY prisma ./prisma
# --include=dev forces devDependencies (prisma CLI, typescript, tsx) to install
# even when the build platform injects NODE_ENV=production - without them the
# postinstall `prisma generate` and the later `tsc` build would fail.
RUN npm ci --include=dev

# Build: `npm run build` runs `prisma generate && tsc`, so the Prisma client is
# (re)generated against the schema, then TypeScript compiles cleanly.
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Install prod deps only. Skip lifecycle scripts so the devDependency `prisma`
# CLI (absent with --omit=dev) isn't needed here - we copy the already-generated
# client from the builder instead.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Compiled app + the generated Prisma client (and its query engine) from builder.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 5000

CMD ["node", "dist/server.js"]
