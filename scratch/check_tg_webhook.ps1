$botToken = $env:Telegram__BotToken
if (-not $botToken) {
    if (Test-Path 'infra/.env') {
        $tgLine = Get-Content 'infra/.env' | Where-Object { $_ -match '^TELEGRAM_BOT_TOKEN=' } | Select-Object -First 1
        if ($tgLine) {
            $botToken = $tgLine.Substring('TELEGRAM_BOT_TOKEN='.Length).Trim()
        }
    }
}

Write-Output "Checking Telegram getWebhookInfo..."
$info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/getWebhookInfo"
Write-Output ($info | ConvertTo-Json -Depth 5)
