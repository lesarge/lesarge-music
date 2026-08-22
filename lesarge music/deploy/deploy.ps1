param(
    [switch]$TestOnly,          # Only test the SSH connection
    [switch]$InstallKey,        # Authorize the local public key on the host (needs -Password)
    [string]$Password = "",     # Hostpoint SSH password (for one-time key install)
    [switch]$SkipBuild,         # Reuse an existing bundle instead of rebuilding
    [switch]$SkipRemoteSetup,   # Upload only
    [switch]$NoUpload           # Run remote setup only
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "deploy.config.ps1")

$HostKeyFingerprint = "SHA256:sMLNNjbNMjgEs2J7OzdbLo9SVYxO5jmwJ/rhIbTzGE4"
$PubKey = Get-Content "$SshKeyPath.pub" -ErrorAction SilentlyContinue

function Write-Step([string]$m) { Write-Host "==> $m" -ForegroundColor Cyan }

function Get-SshInvoke {
    # OpenSSH with the MAC fix required by sl1194.web.hostpoint.ch
    return @("ssh", "-o", "MACs=hmac-sha2-256", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=25", "-i", $SshKeyPath, "-o", "BatchMode=yes")
}

function Test-SshKey([string]$user) {
    $args = @(Get-SshInvoke) + @("$user@$SshHost", "echo OK")
    & $args 2>$null | Out-String | ForEach-Object { $_.Trim() -eq "OK" }
}

function Install-KeyViaPassword([string]$user) {
    if (-not (Test-Path $PlinkPath)) {
        Write-Host "plink not found at $PlinkPath" -ForegroundColor Red
        return $false
    }
    if (-not $Password) {
        Write-Host "Provide -Password <ssh password> to authorize the key." -ForegroundColor Red
        return $false
    }
    if (-not $PubKey) {
        Write-Host "Public key missing: $SshKeyPath.pub" -ForegroundColor Red
        return $false
    }
    Write-Step "Authorizing key for $user@$SshHost with password auth..."
    $auth = "$SshKeyPath.pub"
    $script = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && grep -qxF '$PubKey' ~/.ssh/authorized_keys 2>/dev/null || echo '$PubKey' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo KEY-INSTALLED"
    & $PlinkPath -ssh -P 22 -hostkey $HostKeyFingerprint -pw $Password -batch "$user@$SshHost" $script 2>&1
    return $LASTEXITCODE -eq 0
}

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
    Copy-Item (Join-Path $AceStepUiRoot "dist") (Join-Path $BundleDir "app\dist") -Recurse
    Copy-Item (Join-Path $AceStepUiRoot "server") (Join-Path $BundleDir "app\server") -Recurse -Exclude node_modules
    Copy-Item (Join-Path $AceStepUiRoot "server\package.json") (Join-Path $BundleDir "app\server\package.json")
    Copy-Item (Join-Path $AceStepUiRoot "server\package-lock.json") (Join-Path $BundleDir "app\server\package-lock.json") -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Path (Join-Path $BundleDir "scripts") -Force | Out-Null
    Copy-Item (Join-Path $PSScriptRoot "remote\*") (Join-Path $BundleDir "scripts") -Recurse
    Write-Host "Bundle ready: $BundleDir"
}

function Upload-Bundle([string]$user) {
    if (-not (Test-Path $BundleDir)) { throw "No bundle at $BundleDir. Run deploy.ps1 without -SkipBuild first." }
    Write-Step "Uploading bundle to $user@${SshHost}:$RemoteRoot ..."
    $cmd = @(Get-SshInvoke) + @("$user@$SshHost", "mkdir -p $RemoteRoot/app && mkdir -p $RemoteRoot/scripts")
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "remote mkdir failed" }
    tar -cf - -C (Split-Path $BundleDir) (Split-Path $BundleDir -Leaf) | & ssh @(Get-SshInvoke) "$user@$SshHost" "tar -xf - -C $RemoteRoot"
    if ($LASTEXITCODE -ne 0) { throw "upload failed" }
    Write-Host "Upload complete." -ForegroundColor Green
}

function Run-RemoteSetup([string]$user) {
    Write-Step "Running remote setup..."
    $setup = Join-Path $BundleDir "scripts\setup.sh"
    if (-not (Test-Path $setup)) { throw "setup.sh missing: $setup" }
    Get-Content $setup -Raw | & ssh @(Get-SshInvoke) "$user@$SshHost" "REMOTE_ROOT=$RemoteRoot REMOTE_WEB_DIR=$RemoteWebDir REMOTE_DOMAIN_DIR=$RemoteDomainDir REMOTE_PORT=$RemotePort bash -s"
}

# ---------------------------------------------------------------------------

$user = $SshUser
if ($InstallKey -or -not (Test-SshKey $user)) {
    Write-Step "Key auth failed for $user - attempting password-based key install..."
    if (Install-KeyViaPassword $user) {
        Write-Host "Key installed. Retrying key auth..." -ForegroundColor Green
        if (-not (Test-SshKey $user)) { throw "Key still not accepted after install." }
    } else {
        if ($InstallKey) {
            Write-Host @"

Key install FAILED. On Hostpoint you can instead:
  Control Panel > Hosting > Server & Access > SSH access
  1. Enable SSH access
  2. Set the SSH password (separate from FTP)
  3. Paste this public key (or run with -InstallKey -Password <ssh password>):

  $PubKey
"@ -ForegroundColor Yellow
            exit 1
        }
        throw "Cannot connect. Enable SSH in the Hostpoint Control Panel and set its password, then retry with -InstallKey -Password <ssh password>."
    }
}

if ($TestOnly) {
    Write-Host "SSH connection OK: $user@$SshHost" -ForegroundColor Green
    & (Get-SshInvoke) "$user@$SshHost" "whoami; pwd; uname -a; node --version 2>&1; python3 --version 2>&1; df -h ~ | tail -1"
    exit 0
}

if (-not $NoUpload) {
    if (-not $SkipBuild) { Build-Bundle }
    Upload-Bundle $user
}
if (-not $SkipRemoteSetup) { Run-RemoteSetup $user }

Write-Host @"

Deploy finished.
Next steps (Hostpoint Control Panel):
  1. Enable SSH access + register the key (or run: deploy.ps1 -InstallKey -Password <ssh password>)
  2. In Hosting > Node.js apps: create an app rooted at ~/$RemoteRoot/app/server
     with start command: npm start  (or node dist/index.js), port $RemotePort
  3. Point music.lesarge.ch at the app (Hostpoint routes the domain to it).
"@ -ForegroundColor Green
