$lines = Get-Content 'C:\Users\ladop\.gemini\antigravity-ide\brain\f925f584-b6ab-4a71-8752-9cab83d34e77\.system_generated\tasks\task-771.log' -Tail 5000
foreach ($line in $lines) {
    if ($line -like "*telegram-stars/webhook*" -or $line -like "*HandleWebhook*") {
        Write-Output $line
    }
}
