$lines = Get-Content 'C:\Users\ladop\.gemini\antigravity-ide\brain\f925f584-b6ab-4a71-8752-9cab83d34e77\.system_generated\tasks\task-771.log'
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -like "*StatusCode`":400*" -and $lines[$i] -like "*telegram-stars/webhook*") {
        Write-Output "--- FOUND 400 AT LINE $i ---"
        $start = [Math]::Max(0, $i - 10)
        $end = [Math]::Min($lines.Length - 1, $i + 5)
        for ($j = $start; $j -le $end; $j++) {
            Write-Output "$j : $($lines[$j])"
        }
    }
}
