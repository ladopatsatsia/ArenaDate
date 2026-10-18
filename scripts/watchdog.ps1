# ARENA 24/7 Production Watchdog & Self-Healing Service
$ErrorActionPreference = 'Continue'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$LogDir = Join-Path $Root '.tools'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogFile = Join-Path $LogDir 'watchdog.log'
$TunnelLog = Join-Path $LogDir 'cloudflared.log'

function Write-WatchdogLog {
    param([string]$Message)
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$ts] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

Write-WatchdogLog "Starting ARENA 24/7 Production Watchdog..."

# Ensure Windows never sleeps on AC power
try {
    powercfg /change standby-timeout-ac 0 | Out-Null
    powercfg /change hibernate-timeout-ac 0 | Out-Null
} catch { }

function Get-EnvVar {
    param([string]$Key)
    $envPath = Join-Path $Root 'infra/.env'
    if (Test-Path $envPath) {
        $line = Get-Content $envPath | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
        if ($line) { return $line.Substring("$Key=".Length).Trim() }
    }
    return $null
}

function Set-EnvVar {
    param([string]$Key, [string]$Value)
    $envPath = Join-Path $Root 'infra/.env'
    if (Test-Path $envPath) {
        $lines = Get-Content $envPath
        $found = $false
        $newLines = @()
        foreach ($l in $lines) {
            if ($l -match "^$Key=") {
                $newLines += "$Key=$Value"
                $found = $true
            } else {
                $newLines += $l
            }
        }
        if (-not $found) {
            $newLines += "$Key=$Value"
        }
        $newLines | Set-Content $envPath -Encoding UTF8
    }
}

function Update-TelegramBot {
    param([string]$PublicUrl)
    $token = Get-EnvVar 'TELEGRAM_BOT_TOKEN'
    if (-not $token) {
        Write-WatchdogLog "[Telegram] No TELEGRAM_BOT_TOKEN found in infra/.env"
        return
    }

    $webhookUrl = "$PublicUrl/api/payments/telegram-stars/webhook"
    try {
        $res = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -ContentType 'application/json' -Body (@{ url = $webhookUrl } | ConvertTo-Json)
        Write-WatchdogLog "[Telegram] setWebhook result: $($res.ok) -> $webhookUrl"
    } catch {
        Write-WatchdogLog "[Telegram] Failed to setWebhook: $($_.Exception.Message)"
    }

    try {
        $menuObj = @{
            type = "web_app"
            text = "ARENA"
            web_app = @{ url = "$PublicUrl/" }
        } | ConvertTo-Json -Compress
        $res2 = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setChatMenuButton" -Method Post -Body @{ menu_button = $menuObj }
        Write-WatchdogLog "[Telegram] setChatMenuButton result: $($res2.ok) -> $PublicUrl/"
    } catch {
        Write-WatchdogLog "[Telegram] Failed to setChatMenuButton: $($_.Exception.Message)"
    }

    Set-EnvVar 'TELEGRAM_WEB_APP_URL' $PublicUrl
}

# --- Service check routines ---

function Check-Database {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", 54432, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne(2000, $false)
        if ($success) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
    } catch { }

    Write-WatchdogLog "[Database] Postgres (port 54432) is not responding. Starting via docker compose..."
    try {
        docker compose -f (Join-Path $Root 'infra/compose.yaml') up -d database | Out-Null
        Start-Sleep -Seconds 3
        return $true
    } catch {
        Write-WatchdogLog "[Database] Error starting database container: $($_.Exception.Message)"
        return $false
    }
}

function Check-BackendApi {
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:5180/api/health/live" -TimeoutSec 3 -ErrorAction Stop
        if ($res.status -eq 'ok') {
            return $true
        }
    } catch { }

    Write-WatchdogLog "[Backend] Dating.Api (port 5180) is down. Restarting..."
    try {
        $conns = Get-NetTCPConnection -LocalPort 5180 -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                if ($c.OwningProcess) {
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch { }

    Start-Sleep -Seconds 1
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-ExecutionPolicy Bypass -File `"$Root/scripts/dev.ps1`" -Task api"
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null

    Write-WatchdogLog "[Backend] Launched Dating.Api daemon."
    Start-Sleep -Seconds 5
    return $true
}

function Check-WebServer {
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:8081/" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            return $true
        }
    } catch { }

    Write-WatchdogLog "[Web] Web server (port 8081) is down. Restarting..."
    try {
        $conns = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($c in $conns) {
                if ($c.OwningProcess) {
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch { }

    Start-Sleep -Seconds 1
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "node.exe"
    $psi.Arguments = "`"$Root/scripts/serve-web.mjs`""
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null

    Write-WatchdogLog "[Web] Launched serve-web.mjs daemon."
    Start-Sleep -Seconds 2
    return $true
}

function Check-Tunnel {
    $running = Get-Process -Name cloudflared -ErrorAction SilentlyContinue
    if (-not $running) {
        Write-WatchdogLog "[Tunnel] cloudflared is not running. Starting tunnel..."
        if (Test-Path $TunnelLog) { Remove-Item $TunnelLog -Force -ErrorAction SilentlyContinue }

        $token = Get-EnvVar 'CLOUDFLARE_TUNNEL_TOKEN'
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "cloudflared.exe"
        if ($token) {
            $psi.Arguments = "tunnel run --token $token"
        } else {
            $psi.Arguments = "tunnel --url http://localhost:8081 --logfile `"$TunnelLog`""
        }
        $psi.WorkingDirectory = $Root
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        [System.Diagnostics.Process]::Start($psi) | Out-Null

        Write-WatchdogLog "[Tunnel] cloudflared process spawned."
        Start-Sleep -Seconds 5
    }

    # If using quick tunnel, detect URL and sync with Telegram bot
    $token = Get-EnvVar 'CLOUDFLARE_TUNNEL_TOKEN'
    if (-not $token -and (Test-Path $TunnelLog)) {
        $content = Get-Content $TunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match '(https://[a-zA-Z0-9-]+\.trycloudflare\.com)') {
            $currentUrl = $Matches[1]
            $savedUrl = Get-EnvVar 'TELEGRAM_WEB_APP_URL'
            if ($currentUrl -ne $savedUrl) {
                Write-WatchdogLog "[Tunnel] New Cloudflare Tunnel URL detected: $currentUrl (was: $savedUrl)"
                Update-TelegramBot -PublicUrl $currentUrl
            }
        }
    }
}

# --- Main Watchdog Loop ---
Write-WatchdogLog "ARENA Watchdog active. Monitoring every 15 seconds. Press Ctrl+C to stop."

while ($true) {
    try {
        Check-Database | Out-Null
        Check-BackendApi | Out-Null
        Check-WebServer | Out-Null
        Check-Tunnel | Out-Null
    } catch {
        Write-WatchdogLog "[Watchdog Loop Error]: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 15
}
