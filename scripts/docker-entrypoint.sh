#!/bin/sh
set -e

echo "=== Starting DatingMVP All-In-One Unified Service ==="

# 1. Database detection & PostGIS verification
USE_BUILTIN_DB=1

if [ "$FORCE_BUILTIN_DB" = "true" ]; then
  echo "FORCE_BUILTIN_DB=true is set. Using built-in PostgreSQL 16 + PostGIS."
  USE_BUILTIN_DB=1
elif [ -n "$DATABASE_URL" ] || [ -n "$PGHOST" ]; then
  TARGET_CONN="${DATABASE_URL}"
  if [ -z "$TARGET_CONN" ]; then
    TARGET_CONN="Host=${PGHOST};Port=${PGPORT:-5432};Database=${PGDATABASE:-railway};Username=${PGUSER:-postgres};Password=${PGPASSWORD}"
    TARGET_URL="postgresql://${PGUSER:-postgres}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE:-railway}"
  else
    TARGET_URL="$DATABASE_URL"
  fi
  
  echo "Testing external PostgreSQL for PostGIS extension compatibility..."
  if su - postgres -c "psql \"$TARGET_URL\" -c \"CREATE EXTENSION IF NOT EXISTS postgis; SELECT postgis_version();\"" > /dev/null 2>&1; then
    echo "External PostgreSQL has verified PostGIS extension! Using external database."
    export ConnectionStrings__Database="${DATABASE_URL:-$TARGET_CONN}"
    USE_BUILTIN_DB=0
  else
    echo "=========================================================================="
    echo "NOTICE: External PostgreSQL does NOT have working PostGIS extension."
    echo "PostGIS is required for spatial coordinates and location discovery."
    echo "Automatically falling back to built-in PostgreSQL 16 + PostGIS 3 inside container!"
    echo "=========================================================================="
    USE_BUILTIN_DB=1
  fi
fi

# 2. If built-in database is selected, initialize and start local PostgreSQL 16 + PostGIS
if [ "$USE_BUILTIN_DB" = "1" ]; then
  echo "Initializing built-in PostgreSQL 16 + PostGIS..."
  unset DATABASE_URL
  unset PGHOST
  unset PGPORT
  unset PGUSER
  unset PGPASSWORD
  unset PGDATABASE
  
  DB_DIR="/var/lib/postgresql/16/main"
  if [ ! -d "$DB_DIR" ] || [ ! -f "$DB_DIR/PG_VERSION" ]; then
    mkdir -p "$DB_DIR"
    chown -R postgres:postgres "$DB_DIR"
    su - postgres -c "/usr/lib/postgresql/16/bin/initdb -D $DB_DIR"
  fi
  
  su - postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $DB_DIR -l /var/log/postgresql/server.log -w start" || \
    service postgresql start || true
  
  su - postgres -c "psql -c \"CREATE USER dating WITH SUPERUSER PASSWORD 'dating';\"" 2>/dev/null || true
  su - postgres -c "psql -c \"CREATE DATABASE dating OWNER dating;\"" 2>/dev/null || true
  su - postgres -c "psql -d dating -c \"CREATE EXTENSION IF NOT EXISTS postgis;\"" 2>/dev/null || true
  export ConnectionStrings__Database="Host=127.0.0.1;Port=5432;Database=dating;Username=dating;Password=dating"
  echo "Built-in PostgreSQL 16 + PostGIS is ready."
fi

export Auth__Issuer="${Auth__Issuer:-DatingMVP}"
export Auth__Audience="${Auth__Audience:-DatingMVP-Users}"
export Auth__KeyRingPath="/app/auth-keyring"
export Media__LocalPath="/app/private-media"
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export Telegram__BotToken="${Telegram__BotToken:-${TELEGRAM_BOT_TOKEN:-8909547232:AAEx5dJSZjYY_D1UH9ifmlyCDgaI1csUseg}}"
export Telegram__WebAppUrl="${Telegram__WebAppUrl:-https://arenadate-production.up.railway.app}"

mkdir -p /app/auth-keyring /app/private-media

# 4. Start .NET 10 API
echo "Starting .NET 10 Backend API on 127.0.0.1:5180..."
cd /app/backend
API_PORT=5180 PORT=5180 ASPNETCORE_URLS="http://127.0.0.1:5180" dotnet Dating.Api.dll &
BACKEND_PID=$!

# 5. Ensure admin account (admin@appdate.ge / AdminPassword123!) and seed data in background
(
  sleep 4
  echo "Ensuring administrator account (admin@appdate.ge)..."
  cd /app/backend
  dotnet Dating.Api.dll staff ensure-admin admin@appdate.ge AdminPassword123! || true

  if [ -f /app/scripts/seed-production.sql ]; then
    echo "Importing registered users, profiles, and questions into database..."
    su - postgres -c "psql -d dating -f /app/scripts/seed-production.sql" > /tmp/seed.log 2>&1 || true
    echo "Database seed completed."
  fi
) &

# 6. Start Web Server (serves Mini App, Admin Panel, and proxies /api to .NET 10)
echo "Starting Node Web Server on port ${PORT:-8080}..."
cd /app
export API_PORT=5180
export PORT="${PORT:-8080}"
exec node scripts/serve-web.mjs
