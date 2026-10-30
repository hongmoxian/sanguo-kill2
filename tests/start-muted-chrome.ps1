param(
    [int]$Port = 9252
)

# Isolated, muted browser for automation. Regular game browser is unchanged.
$chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $chrome) {
    throw "Chrome executable not found."
}

$profile = Join-Path $env:TEMP "noname-cdp-muted-test"
$arguments = @(
    "--headless=new",
    "--mute-audio",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$profile",
    "about:blank"
)
$process = Start-Process -FilePath $chrome -ArgumentList $arguments -PassThru
Write-Host "Muted Chrome testing started: PID=$($process.Id), CDP=$Port"
Write-Host "Browser profile: $profile"
Write-Host "Test browser audio is muted. Regular gameplay settings are unchanged."
