$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.ServerCertificateCustomValidationCallback = { $true }
$handler.CookieContainer = [System.Net.CookieContainer]::new()
$client = [System.Net.Http.HttpClient]::new($handler)
$client.BaseAddress = [Uri]::new("https://localhost:5181")

# 1. CSRF
$r0 = $client.GetAsync("/api/moderation/csrf").GetAwaiter().GetResult()
Write-Host "CSRF status: $($r0.StatusCode)"

# 2. Login
$loginBody = [System.Net.Http.Json.JsonContent]::Create(@{
    email = "admin@appdate.ge"
    password = "AdminPassword123!"
})
$r1 = $client.PostAsync("/api/moderation/login", $loginBody).GetAwaiter().GetResult()
Write-Host "Login status: $($r1.StatusCode)"

# 3. Create user
$createBody = [System.Net.Http.Json.JsonContent]::Create(@{
    email = "admin_created_user@test.ge"
    password = "Password123!"
    displayName = "Lela Test"
    dateOfBirth = "1999-03-25"
    gender = "woman"
    city = "Tbilisi"
    initialCrystals = 150
})
$r2 = $client.PostAsync("/api/moderation/users", $createBody).GetAwaiter().GetResult()
$res2Text = $r2.Content.ReadAsStringAsync().GetAwaiter().GetResult()
Write-Host "Create user status: $($r2.StatusCode) - $res2Text"

$createdUser = $res2Text | ConvertFrom-Json
$userId = $createdUser.userId

# 4. Adjust crystals: +100
$adj1Body = [System.Net.Http.Json.JsonContent]::Create(@{
    amount = 100
    mode = "delta"
    reason = "Bonus test"
})
$r3 = $client.PostAsync("/api/moderation/users/$userId/crystals", $adj1Body).GetAwaiter().GetResult()
$res3Text = $r3.Content.ReadAsStringAsync().GetAwaiter().GetResult()
Write-Host "Adjust +100 status: $($r3.StatusCode) - $res3Text"

# 5. Adjust crystals: -50
$adj2Body = [System.Net.Http.Json.JsonContent]::Create(@{
    amount = -50
    mode = "delta"
    reason = "Deduction test"
})
$r4 = $client.PostAsync("/api/moderation/users/$userId/crystals", $adj2Body).GetAwaiter().GetResult()
$res4Text = $r4.Content.ReadAsStringAsync().GetAwaiter().GetResult()
Write-Host "Adjust -50 status: $($r4.StatusCode) - $res4Text"

# 6. Fetch profiles to check crystal balance
$r5 = $client.GetAsync("/api/moderation/profiles?search=admin_created_user").GetAwaiter().GetResult()
$res5Text = $r5.Content.ReadAsStringAsync().GetAwaiter().GetResult()
Write-Host "Profile summary search result: $res5Text"
