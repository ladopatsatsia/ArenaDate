param([ValidateSet('api','admin-api','staff','migrate','test','build')][string]$Task = 'api', [switch]$AutoApprovePhotos, [string[]]$StaffArguments)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (Test-Path '.tools/dotnet/dotnet.exe') {
    $env:DOTNET_ROOT = Join-Path $PWD '.tools/dotnet'
    $env:PATH = "$env:DOTNET_ROOT;$env:PATH"
    $env:DOTNET_CLI_HOME = Join-Path $PWD '.tools/dotnet-home'
    $env:NUGET_PACKAGES = Join-Path $PWD '.tools/nuget'
}
if (-not $env:ConnectionStrings__Database) {
    if (-not (Test-Path 'infra/.env')) { throw 'Copy infra/.env.example to infra/.env and set a local password first.' }
    $line = Get-Content 'infra/.env' | Where-Object { $_ -match '^POSTGRES_PASSWORD=' } | Select-Object -First 1
    if (-not $line) { throw 'POSTGRES_PASSWORD is required.' }
    $password = $line.Substring('POSTGRES_PASSWORD='.Length)
    $env:ConnectionStrings__Database = "Host=127.0.0.1;Port=55432;Database=dating;Username=dating;Password=$password"
}
node scripts/auth-env.mjs --write
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare local auth settings.' }
$authConfig = Get-Content -Raw .tools/auth/config.json | ConvertFrom-Json
$env:Auth__SigningKeyPem = $authConfig.Auth.SigningKeyPem
$env:Auth__KeyRingPath = $authConfig.Auth.KeyRingPath
$env:Media__Mode = 'Local'
$env:Media__LocalPath = Join-Path $PWD '.tools/media'
$env:Media__AutoApprove = if ($AutoApprovePhotos) { 'true' } else { 'false' }
$env:Email__Mode = 'Capture'
$env:Email__Host = '127.0.0.1'
$env:Email__Port = '1025'
$env:Email__Sender = 'no-reply@dating.local'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
switch ($Task) {
    'admin-api' { dotnet run --project backend/Dating.Api --no-launch-profile --urls 'http://localhost:5180;https://localhost:5181' }
    'staff' { dotnet run --project backend/Dating.Api --no-launch-profile -- staff @StaffArguments }
    'api' { $env:ASPNETCORE_ENVIRONMENT = 'Development'; dotnet run --project backend/Dating.Api }
    'migrate' { dotnet ef database update --project backend/Dating.Api }
    'test' { $env:TEST_DATABASE_CONNECTION = $env:ConnectionStrings__Database; dotnet test backend/Dating.slnx --no-restore }
    'build' { dotnet build backend/Dating.slnx --no-restore }
}
exit $LASTEXITCODE
