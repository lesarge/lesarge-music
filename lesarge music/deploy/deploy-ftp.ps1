param(
    [string]$Password = "",                 # FTP password (defaults to env LESARGE_FTP_PASSWORD)
    [switch]$SkipBuild,                     # Reuse existing bundle
    [string[]]$Exclude = @(                 # paths (relative, / separators) to skip
        "server/data",
        "server/public/audio/reference-tracks"
    )
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "deploy.config.ps1")

if (-not $Password) { $Password = $env:LESARGE_FTP_PASSWORD }
if (-not $Password) {
    $sec = Read-Host "FTP password for $FtpUser" -AsSecureString
    $Password = [System.Net.NetworkCredential]::new("", $sec).Password
}
$FtpUrl = "ftp://$FtpHost/"

function Write-Step([string]$m) { Write-Host "==> $m" -ForegroundColor Cyan }

function Test-FtpLogin {
    $r = curl.exe -sS --ftp-pasv --connect-timeout 25 --user "$FtpUser`:$Password" --list-only $FtpUrl 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host "FTP login FAILED: $r" -ForegroundColor Red; exit 1 }
    Write-Host "FTP login OK. Remote root listing: $($r -join ', ')" -ForegroundColor Green
}

function New-FtpDir([string]$rel) {
    $rel = $rel -replace '\\', '/'
    curl.exe -sS --ftp-pasv --connect-timeout 25 --user "$FtpUser`:$Password" --ftp-create-dirs -Q "MKD $rel" $FtpUrl | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # MKD may return an error if the dir already exists - that is fine.
        Write-Verbose "MKD $rel exit=$LASTEXITCODE"
    }
}

# Write the hosted .env into the bundle (auto-installation: app migrates MariaDB on first start)
function Write-HostedEnv {
    $envFile = Join-Path $BundleDir "server\.env"
    $jwt = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
    $content = @"
PORT=$RemotePort
NODE_ENV=production
DATABASE_PATH=./data/acestep.db
DB_HOST=$DbHost
DB_PORT=$DbPort
DB_USER=$DbUser
DB_PASSWORD=$DbPassword
DB_NAME=$DbName
ACESTEP_API_URL=http://localhost:8002
AUDIO_DIR=./public/audio
FRONTEND_URL=http://$FtpHost
JWT_SECRET=$jwt
"@
    Set-Content -Path $envFile -Value $content -Encoding ASCII
    Write-Host "Hosted .env written (database: $DbUser @ $DbHost/$DbName)" -ForegroundColor Cyan
}

function Upload-File([string]$local, [string]$rel) {
    $rel = $rel -replace '\\', '/'
    curl.exe -sS --ftp-pasv --connect-timeout 25 --user "$FtpUser`:$Password" --ftp-create-dirs -T $local "$FtpUrl$rel" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "FAILED: $rel (exit $LASTEXITCODE)" -ForegroundColor Red }
    else { Write-Verbose "ok: $rel" }
}

Test-FtpLogin

function Build-Bundle {
    if (Test-Path $BundleDir) { Remove-Item $BundleDir -Recurse -Force }
    New-Item -ItemType Directory -Path (Join-Path $BundleDir "app") -Force | Out-Null

    Write-Step "Building frontend..."
    Push-Location $AceStepUiRoot
    try { npm.cmd run build } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }

    Write-Step "Building backend..."
    Push-Location (Join-Path $AceStepUiRoot "server")
    try { npm.cmd run build } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "backend build failed" }

    Write-Step "Assembling bundle..."
    Copy-Item (Join-Path $AceStepUiRoot "dist") (Join-Path $BundleDir "dist") -Recurse
    Copy-Item (Join-Path $AceStepUiRoot "server") (Join-Path $BundleDir "server") -Recurse
    # Copy-Item -Exclude does not reliably exclude dirs with -Recurse; strip after copy.
    Remove-Item (Join-Path $BundleDir "server\node_modules") -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $BundleDir "server\.env") -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $AceStepUiRoot "server\package.json") (Join-Path $BundleDir "server\package.json")
    Copy-Item (Join-Path $AceStepUiRoot "server\package-lock.json") (Join-Path $BundleDir "server\package-lock.json") -ErrorAction SilentlyContinue
    Write-Host "Bundle ready: $BundleDir"
}

if (-not $SkipBuild) { Build-Bundle }
if (-not (Test-Path $BundleDir)) { throw "No bundle at $BundleDir. Run without -SkipBuild first." }
Write-HostedEnv

$excludeSet = @()
foreach ($e in $Exclude) { $excludeSet += ($e -replace '\\', '/').TrimEnd('/') }

$all = Get-ChildItem $BundleDir -Recurse -File
$todo = @()
foreach ($f in $all) {
    $rel = ($f.FullName.Substring($BundleDir.Length + 1)) -replace '\\', '/'
    $skip = $false
    foreach ($e in $excludeSet) {
        if ($rel -eq $e -or $rel.StartsWith("$e/")) { $skip = $true; break }
    }
    if (-not $skip) { $todo += [pscustomobject]@{ Local = $f.FullName; Rel = $rel } }
}

Write-Host "Uploading $($todo.Count) files (skipping $($all.Count - $todo.Count)) to $FtpHost ..." -ForegroundColor Cyan
$i = 0
foreach ($t in $todo) {
    $i++
    if ($i % 20 -eq 0) { Write-Host "  $i / $($todo.Count)" }
    Upload-File $t.Local $t.Rel
}
$failed = $todo.Count - $i
Write-Host "Upload complete: $i files." -ForegroundColor Green

Write-Host @"

Uploaded. Do NOT browse to https://music.lesarge.ch/ expecting the app yet:
the backend still needs its npm dependencies, which Hostpoint installs.
See DEPLOY-FTP.md for the Control Panel steps.
"@ -ForegroundColor Yellow
