#!/bin/sh
set -e

echo "=== Starting DatingMVP All-In-One Unified Service ==="

# 1. Database detection & PostGIS verification
USE_BUILTIN_DB=0

if [ "$FORCE_BUILTIN_DB" = "true" ]; then
  echo "FORCE_BUILTIN_DB=true is set. Using built-in PostgreSQL 16 + PostGIS."
  USE_BUILTIN_DB=1
elif [ -n "$DATABASE_URL" ]; then
  echo "Detected external DATABASE_URL. Verifying PostGIS extension support..."
  CHECK_OUTPUT=$(psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>&1 || true)
  if echo "$CHECK_OUTPUT" | grep -qiE "not available|could not open extension|No such file|extension \"postgis\""; then
    echo "=========================================================================="
    echo "WARNING: External PostgreSQL does NOT support PostGIS (binaries missing)."
    echo "EF Core spatial queries require PostGIS."
    echo "Falling back automatically to built-in PostgreSQL 16 + PostGIS inside container!"
    echo "=========================================================================="
    USE_BUILTIN_DB=1
  else
    echo "External PostgreSQL has PostGIS verified! Connecting..."
    export ConnectionStrings__Database="$DATABASE_URL"
  fi
elif [ -n "$PGHOST" ]; then
  echo "Detected Railway PG variables. Verifying PostGIS extension support..."
  CHECK_CONN="postgresql://${PGUSER:-postgres}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE:-railway}"
  CHECK_OUTPUT=$(psql "$CHECK_CONN" -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>&1 || true)
  if echo "$CHECK_OUTPUT" | grep -qiE "not available|could not open extension|No such file|extension \"postgis\""; then
    echo "=========================================================================="
    echo "WARNING: External PostgreSQL does NOT support PostGIS."
    echo "Falling back automatically to built-in PostgreSQL 16 + PostGIS inside container!"
    echo "=========================================================================="
    USE_BUILTIN_DB=1
  else
    echo "External PostgreSQL has PostGIS verified! Connecting..."
    export ConnectionStrings__Database="Host=${PGHOST};Port=${PGPORT:-5432};Database=${PGDATABASE:-railway};Username=${PGUSER:-postgres};Password=${PGPASSWORD}"
  fi
else
  USE_BUILTIN_DB=1
fi

# 2. If built-in database is selected, initialize and start local PostgreSQL 16 + PostGIS
if [ "$USE_BUILTIN_DB" = "1" ]; then
  echo "Initializing built-in PostgreSQL 16 + PostGIS..."
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

# 3. Fallback auth key if not provided in environment
if [ -z "$Auth__SigningKeyPem" ]; then
  export Auth__SigningKeyPem="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCXoJvHGhVz4nsQ\nnSMeFsu+zdLoK9RN0Ik3dFUebKntmjhxNBUgxSXBVcZJp+loNmfBGESStOlD2lea\nThe/YByhY7SeODx7RBIcUyhV9omdCJ4kmtGVlYap+Prb0jECra45cpXmEdtJMcMW\n9oT6ieS5Dd1SVHC0pZUBXvbZ0B7iI8CoZ2/O3vA7Dt4fS1z7TkfSXjOt3aHMGSPQ\n70zxEDRBXBDL/8XBM0xvgnH7RzSE/8lgaWynf+LL4jRtpBD3V4ZtLgIVeYJZcJCc\nTTyIDZUjwJxmh1Q938W9Wd+y5HKzzbaTILHJsNStD25qnK9Hrf7KccZJysFWT+Rp\nN5EqVNy5AgMBAAECggEAA4sovNhYlkDdoqujd5dti0/k3RFyKJ/mJw5AU4HTXlbP\neSDQGhgVa+1o4Q2MLEfyOI5sQtf4yCHNEJGA51N0E9cAUH7Mtg5HFJOicpDckjeS\nd5VJLuNj1mrX1QWWaOM9ekD57RqveuhPcITSIodQubzv1lXcHPKuNu4c24YMRLlr\nOIbRrzh18FtkLXB69D4677pUdTEgEs8VcErr1MeaOL1FcPrcC6o/pYYEAx8ilkh+\nhs5YRtGZgfsnCIAKi7r+XMybi6x3UEInbhEP3rirEuNRueEbQd1yazyklPfWM4Z/\nDuWHsqfEXMb91QKDTgnmlEtDHvgfvLC84D/INz8HQQKBgQDGtnok6WgpP5fDsVxi\nIX9iaUkJlVznYHojUFDljjviLbGzc6e2T/jfXlvC5tO+EPJ0OFCB6NMyD6Vy+ldP\nk35aNIp3UFTGX7Z7p1IYQ8qBT5e3sx7rGZYP3CU7wxs882M6StIzFujGIzOsuxJs\ngdqN8MBe8Pia6VILueBLE/eXwQKBgQDDVxqy/65eDA/ISULXNkp32vzbHfvY30yk\njYMeNOWpVLTCjMFwhvhk9PXfTGtSR9RJAm2aTQnGriD3Pq3g6ek+pD3x+bqUc1Qi\nlYCIO7s5gpH3HbJj7F2NkU0S0Tu8s13fhTx9igaApdZjxauttu/Qgc1qEO3x4/BR\nUoeFbgLC+QKBgGa4cY+fMH8SJou8pXr8wfLHZkAT/ACHeNvEau0fh4k2AcQ4Jxwx\nXv9osZqg5Bg+fnbhnYxqJLKeL/KtwnCaWBidTG69EfWyCI0HQ4LTmF0cHduSNotl\noJL2RDEOfIgXcNXzU5GhaBb0n4PM+Isq3SW+rFLn0juSHR1+qplk6vqBAoGAI8Il\nPBE7/TFeDj8DAlyI40nuMbpaaQfvgsv47aWnSQkdkeOsYYoDnI+PFtJpbwWBIeBU\n6gMiQAGOPVR3Bg4ryXDNeidJ9XTrOO1/OvEcQ9nYGJGSH2KceZbYshIlSlTXYVyF\nh0GmERTKmzcLR2COo++vB7STqk0cp/ZgopdR4BkCgYBZcAPJR8LJynuwIQrIv+4m\nH5hlMRIBFh1zOFHKIG95iVN2KDhkC7Z33xjcDqCNHT+PQYgVBACUdJ4UGhiLC/hL\n9R6YFhWJNhr8+XypqQqde7j72cTsqdIDRtpm+y/zgKWCb3qbQUS5b81JwgtZ2BCe\nqDvG+l9I6q8ZXeywxJLw3Q==\n-----END PRIVATE KEY-----\n"
fi

export Auth__Issuer="${Auth__Issuer:-DatingMVP}"
export Auth__Audience="${Auth__Audience:-DatingMVP-Users}"
export Auth__KeyRingPath="/app/auth-keyring"
export Media__LocalPath="/app/private-media"
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"

mkdir -p /app/auth-keyring /app/private-media

# 4. Start .NET 10 API
echo "Starting .NET 10 Backend API on 127.0.0.1:5180..."
cd /app/backend
API_PORT=5180 PORT=5180 ASPNETCORE_URLS="http://127.0.0.1:5180" dotnet Dating.Api.dll &
BACKEND_PID=$!

# 5. Ensure admin account (admin@appdate.ge / AdminPassword123!) exists in background
(
  sleep 4
  echo "Ensuring administrator account (admin@appdate.ge)..."
  cd /app/backend
  dotnet Dating.Api.dll staff ensure-admin admin@appdate.ge AdminPassword123! || true
) &

# 6. Start Web Server (serves Mini App, Admin Panel, and proxies /api to .NET 10)
echo "Starting Node Web Server on port ${PORT:-8080}..."
cd /app
export API_PORT=5180
export PORT="${PORT:-8080}"
exec node scripts/serve-web.mjs
