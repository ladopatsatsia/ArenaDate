$json = @'
{
  "update_id": 12345,
  "pre_checkout_query": {
    "id": "q1",
    "from": {
      "id": 999,
      "first_name": "User"
    },
    "currency": "XTR",
    "total_amount": 25,
    "invoice_payload": "test"
  }
}
'@

try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:5180/api/payments/telegram-stars/webhook" -Method POST -ContentType "application/json" -Body $json
    Write-Output "SUCCESS: $($res | ConvertTo-Json -Compress)"
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Output "RESPONSE BODY: $($reader.ReadToEnd())"
    }
}
