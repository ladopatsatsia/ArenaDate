# Database Backup Script for DatingMVP (PostgreSQL/PostGIS)
param(
    [string]$BackupDir = "artifacts/backups",
    [string]$ContainerName = "dating-mvp-prod-database-1",
    [string]$Database = "dating",
    [string]$User = "dating_prod"
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "dating_backup_$timestamp.sql.gz"

Write-Host "Starting backup for database '$Database' from container '$ContainerName'..."
docker exec $ContainerName pg_dump -U $User -d $Database --clean --if-exists --no-owner --no-privileges | gzip > $backupFile

if (Test-Path $backupFile) {
    $size = (Get-Item $backupFile).Length
    Write-Host "Backup successfully created: $backupFile ($([math]::Round($size/1KB, 2)) KB)"
} else {
    throw "Backup failed. File was not created."
}
