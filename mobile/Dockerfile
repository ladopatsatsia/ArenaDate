# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY packages/ packages/
COPY mobile/package*.json ./mobile/
COPY admin/package*.json ./admin/

# Install dependencies for mobile and contract
RUN npm ci --workspace @dating/mobile --workspace @dating/api-contract

# Copy mobile source code
COPY mobile/ mobile/

# Build Expo web bundle
RUN cd mobile && npx expo export -p web --output-dir dist/web

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY scripts/serve-web.mjs ./scripts/serve-web.mjs
COPY --from=build /app/mobile/dist/web ./mobile/dist/web

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "scripts/serve-web.mjs"]
