$payloads = @(
    @{ name = "empty"; body = "{}" },
    @{ name = "null_body"; body = "" },
    @{ name = "update_only"; body = '{"update_id":12345}' },
    @{ name = "pre_checkout_1"; body = '{"update_id":12345,"pre_checkout_query":{"id":"q1","from":{"id":999,"first_name":"User"},"currency":"XTR","total_amount":25,"invoice_payload":"crystals:dating.crystals.100:00000000000000000000000000000000:nonce"}}' },
    @{ name = "pre_checkout_with_extra"; body = '{"update_id":12345,"pre_checkout_query":{"id":"q1","from":{"id":999,"is_bot":false,"first_name":"User","username":"test","language_code":"en"},"currency":"XTR","total_amount":25,"invoice_payload":"crystals:dating.crystals.100:00000000000000000000000000000000:nonce"}}' },
    @{ name = "message_successful_payment"; body = '{"update_id":12345,"message":{"message_id":1,"date":1700000000,"chat":{"id":123,"type":"private"},"from":{"id":999,"is_bot":false,"first_name":"User"},"successful_payment":{"currency":"XTR","total_amount":25,"invoice_payload":"crystals:dating.crystals.100:00000000000000000000000000000000:nonce","telegram_payment_charge_id":"ch_123"}}}' }
)

foreach ($p in $payloads) {
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:5180/api/payments/telegram-stars/webhook" -Method POST -ContentType "application/json" -Body $p.body -UseBasicParsing
        Write-Output "$($p.name): SUCCESS (StatusCode=$($res.StatusCode)) -> $($res.Content)"
    } catch {
        Write-Output "$($p.name): ERROR (StatusCode=$($_.Exception.Response.StatusCode.value__))"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Output "   Response: $($reader.ReadToEnd())"
        }
    }
}
