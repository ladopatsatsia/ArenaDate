# Database Restore & Verification Script for DatingMVP
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$ContainerName = "dating-mvp-prod-database-1",
    [string]$Database = "dating",
    [string]$User = "dating_prod"
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

Write-Host "WARNING: Restoring backup will overwrite existing database data in '$Database'."
Write-Host "Restoring from '$BackupFile' to container '$ContainerName'..."

# Uncompress and pipe into psql
if ($BackupFile.EndsWith(".gz")) {
    gzip -dc $BackupFile | docker exec -i $ContainerName psql -U $User -d $Database
} else {
    Get-Content $BackupFile | docker exec -i $ContainerName psql -U $User -d $Database
}

Write-Host "Running post-restore verification checks..."
$tableCount = docker exec $ContainerName psql -U $User -d $Database -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
Write-Host "Verified table count in restored database: $($tableCount.Trim())"

$postgisCheck = docker exec $ContainerName psql -U $User -d $Database -t -c "SELECT PostGIS_Version();"
Write-Host "Verified PostGIS version: $($postgisCheck.Trim())"

Write-Host "Database restore and verification complete."
