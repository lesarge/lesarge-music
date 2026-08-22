<#
.SYNOPSIS
    First-run installer for the ACE-Step AI engine used by Lesarge Music AI.
    Creates C:\LesargeMusicAI\ACE-Step-1.5 (clone + venv + models) if missing.
    Run elevated.
#>
param(
    [string]$EngineRoot = "C:\LesargeMusicAI\ACE-Step-1.5",
    [switch]$SkipModels
)

$ErrorActionPreference = 'Stop'
$repo = "https://github.com/ACE-Step/ACE-Step-1.5.git"
$logFile = Join-Path $PSScriptRoot "engine-install.log"

function Log([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format o), $m
    Add-Content -Path $logFile -Value $line
    Write-Host $line
}

try {
    Log "Starting engine install into $EngineRoot"
    $engineDir = Split-Path $EngineRoot -Parent
    New-Item -ItemType Directory -Force -Path $engineDir | Out-Null

    if (-not (Test-Path (Join-Path $EngineRoot "acestep"))) {
        Log "Cloning $repo"
        git clone --depth 1 $repo $EngineRoot 2>&1 | ForEach-Object { Log $_ }
    }

    $py = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $py) {
        Log "ERROR: Python 3.10+ is required but not found. Install from python.org first."
        throw "Python not found"
    }

    $venvPy = Join-Path $EngineRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path $venvPy)) {
        Log "Creating virtualenv"
        & python -m venv (Join-Path $EngineRoot ".venv") 2>&1 | ForEach-Object { Log $_ }
        if (-not (Test-Path $venvPy)) { throw "venv creation failed" }
    }

    Log "Upgrading pip"
    & $venvPy -m pip install --upgrade pip 2>&1 | ForEach-Object { Log $_ }

    $req = Join-Path $EngineRoot "requirements.txt"
    if (-not (Test-Path $req)) { throw "requirements.txt missing" }

    if (-not (Test-Path (Join-Path $EngineRoot "..\..\ace-step-ui\.engine-pip-done"))) {
        Log "Installing Python requirements (this can take a while)"
        & $venvPy -m pip install -r $req 2>&1 | ForEach-Object { Log $_ }
        if ($LASTEXITCODE -ne 0) { throw "pip install failed ($LASTEXITCODE)" }
    }

    if (-not $SkipModels) {
        Log "Downloading models"
        & $venvPy -m acestep.model_downloader --base-dir $EngineRoot 2>&1 | ForEach-Object { Log $_ }
        if ($LASTEXITCODE -ne 0) { throw "model download failed ($LASTEXITCODE)" }
    }

    Log "Engine install complete."
    Write-Host "DONE"
} catch {
    Log "FATAL: $_"
    Write-Host "FAILED: $_"
    exit 1
}
