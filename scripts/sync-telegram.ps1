param(
    [string]$PublicUrl = "https://kits-dns-optional-pulling.trycloudflare.com"
)

$envPath = "infra/.env"
$token = $null
if (Test-Path $envPath) {
    $line = Get-Content $envPath | Where-Object { $_ -match "^TELEGRAM_BOT_TOKEN=" } | Select-Object -First 1
    if ($line) { $token = $line.Substring("TELEGRAM_BOT_TOKEN=".Length).Trim() }
}

if (-not $token) {
    Write-Host "No TELEGRAM_BOT_TOKEN found"
    exit 1
}

Write-Host "Updating Telegram Bot settings for $PublicUrl..."

# Update setChatMenuButton
try {
    $menuObj = @{
        type = "web_app"
        text = "ARENA"
        web_app = @{ url = "$PublicUrl/" }
    } | ConvertTo-Json -Compress
    $resMenu = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setChatMenuButton" -Method Post -Body @{ menu_button = $menuObj }
    Write-Host "setChatMenuButton:" ($resMenu | ConvertTo-Json)
} catch {
    Write-Host "Error setChatMenuButton:" $_.Exception.Message
}

# Update setWebhook
try {
    $webhookBody = @{ url = "$PublicUrl/api/payments/telegram-stars/webhook" } | ConvertTo-Json
    $resWebhook = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -ContentType 'application/json' -Body $webhookBody
    Write-Host "setWebhook:" ($resWebhook | ConvertTo-Json)
} catch {
    Write-Host "Error setWebhook:" $_.Exception.Message
}

# Update infra/.env
$lines = Get-Content $envPath
$newLines = @()
foreach ($l in $lines) {
    if ($l -match "^TELEGRAM_WEB_APP_URL=") {
        $newLines += "TELEGRAM_WEB_APP_URL=$PublicUrl"
    } else {
        $newLines += $l
    }
}
$newLines | Set-Content $envPath -Encoding UTF8
Write-Host "Updated TELEGRAM_WEB_APP_URL in $envPath"
