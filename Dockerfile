# ==========================================
# Stage 1: Build Web Frontends (Admin + Mobile Mini App)
# ==========================================
FROM node:22-bookworm-slim AS web-build
WORKDIR /app

COPY package*.json ./
COPY packages/ packages/
COPY mobile/package*.json ./mobile/
COPY admin/package*.json ./admin/

RUN npm ci

COPY mobile/ mobile/
COPY admin/ admin/

RUN npm run build --workspace admin
RUN cd mobile && npx expo export -p web --output-dir dist/web

# ==========================================
# Stage 2: Build Backend (.NET 10 SDK)
# ==========================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src

COPY global.json ./
COPY backend/ backend/
RUN dotnet restore backend/Dating.Api/Dating.Api.csproj --locked-mode
RUN dotnet publish backend/Dating.Api/Dating.Api.csproj -c Release --no-restore -o /app/backend

# ==========================================
# Stage 3: Unified Production Runtime (.NET 10 + Node 22 + PostgreSQL/PostGIS)
# ==========================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Install PostgreSQL 16 with PostGIS 3 as built-in fallback database
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-16 postgresql-16-postgis-3 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Node.js binary from web-build
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node

# Copy backend binaries
COPY --from=backend-build /app/backend /app/backend

# Copy web frontends
COPY --from=web-build /app/mobile/dist/web /app/mobile/dist/web
COPY --from=web-build /app/admin/dist/admin/browser /app/admin/dist/admin/browser

# Copy serving scripts
COPY scripts/serve-web.mjs /app/scripts/serve-web.mjs
COPY scripts/docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Persistent directories
RUN mkdir -p /app/auth-keyring /app/private-media

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
