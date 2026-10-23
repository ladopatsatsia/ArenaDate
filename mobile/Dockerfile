# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY packages/ packages/
COPY mobile/package*.json ./mobile/
COPY admin/package*.json ./admin/

# Install dependencies for all workspaces
RUN npm ci

# Copy source code
COPY mobile/ mobile/
COPY admin/ admin/

# Build Admin and Expo web bundle
RUN npm run build --workspace admin
RUN cd mobile && npx expo export -p web --output-dir dist/web

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

COPY scripts/serve-web.mjs ./scripts/serve-web.mjs
COPY --from=build /app/mobile/dist/web ./mobile/dist/web
COPY --from=build /app/admin/dist/admin/browser ./admin/dist/admin/browser

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "scripts/serve-web.mjs"]
