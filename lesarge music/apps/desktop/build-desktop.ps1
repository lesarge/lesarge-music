<#
.SYNOPSIS
    Builds the Lesarge Music AI desktop app.
    -Build : assemble resources/ (frontend, backend, portable node, scripts)
    -Dist  : run electron-builder to produce the NSIS installer
    -InstallDeps : npm install electron + electron-builder first
#>
param(
    [switch]$Build,
    [switch]$Dist,
    [switch]$InstallDeps
)

$ErrorActionPreference = 'Stop'
$root = 'C:\LesargeMusicAI'
$ui = Join-Path $root 'ace-step-ui'
$desktop = 'C:\LesargeMusicAI\lesarge music\apps\desktop'
$desktop = $PSScriptRoot
$res = Join-Path $desktop 'resources'
$cache = Join-Path $desktop 'build\cache'
$nodeVer = 'v24.18.0'
$nodeZip = Join-Path $cache "node-$nodeVer-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/$nodeVer/node-$nodeVer-win-x64.zip"

function Log([string]$m) { Write-Host "[build] $m" }

function Reset-Dir([string]$d) {
    if (Test-Path $d) { Remove-Item -Recurse -Force $d }
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}

if ($InstallDeps) {
    Log "npm install (electron + electron-builder)"
    Push-Location $desktop
    npm.cmd install
    Pop-Location
}

if ($Build) {
    Log "Assembling resources at $res"
    Reset-Dir $res

    # 1. Frontend (uses the existing vite build at ace-step-ui\dist)
    $frontendDist = Join-Path $ui 'dist'
    if (-not (Test-Path (Join-Path $frontendDist 'index.html'))) {
        throw "Frontend not built: $frontendDist\index.html missing. Run the UI build first."
    }
    Log "Copying frontend dist"
    Copy-Item -Recurse $frontendDist (Join-Path $res 'dist')

    # 2. Backend
    $server = Join-Path $ui 'server'
    $serverDist = Join-Path $server 'dist\index.js'
    if (-not (Test-Path $serverDist)) { throw "Backend not built: $serverDist missing." }
    if (-not (Test-Path (Join-Path $server 'node_modules'))) { throw "server/node_modules missing." }
    Log "Copying backend (dist, static dirs, node_modules)"
    New-Item -ItemType Directory -Force -Path (Join-Path $res 'server') | Out-Null
    Copy-Item -Recurse (Join-Path $server 'dist') (Join-Path $res 'server\dist')
    Copy-Item -Recurse (Join-Path $server 'audio-editor') (Join-Path $res 'server\audio-editor')
    Copy-Item -Recurse (Join-Path $server 'public') (Join-Path $res 'server\public')
    Copy-Item -Recurse (Join-Path $server 'scripts') (Join-Path $res 'server\scripts')
    Copy-Item (Join-Path $server 'package.json') (Join-Path $res 'server\package.json')
    Copy-Item (Join-Path $server 'package-lock.json') (Join-Path $res 'server\package-lock.json') -ErrorAction SilentlyContinue
    Copy-Item -Recurse (Join-Path $server 'node_modules') (Join-Path $res 'server\node_modules')

    # 3. Portable Node
    if (-not (Test-Path (Join-Path $res 'node\node.exe'))) {
        if (-not (Test-Path $nodeZip)) {
            Log "Downloading portable node $nodeVer"
            New-Item -ItemType Directory -Force -Path $cache | Out-Null
            curl.exe -L -o $nodeZip $nodeUrl
        }
        Log "Extracting portable node"
        New-Item -ItemType Directory -Force -Path (Join-Path $res 'node') | Out-Null
        Expand-Archive -Path $nodeZip -DestinationPath $cache -Force
        $unzipNode = Join-Path $cache "node-$nodeVer-win-x64"
        Get-ChildItem $unzipNode | Move-Item -Destination (Join-Path $res 'node')
        Remove-Item -Recurse -Force $unzipNode
    }

    # 4. Scripts
    Log "Copying scripts"
    Copy-Item -Recurse (Join-Path $desktop 'scripts') (Join-Path $res 'scripts')

    # 5. Video service
    $videoSrc = Join-Path $root 'lesarge music\engines\video\video_service.py'
    if (Test-Path $videoSrc) {
        Log "Copying video service"
        New-Item -ItemType Directory -Force -Path (Join-Path $res 'video') | Out-Null
        Copy-Item $videoSrc (Join-Path $res 'video\video_service.py')
    }

    Log "Resources ready:"
    Get-ChildItem $res | Select-Object -ExpandProperty Name
}

if ($Dist) {
    if (-not (Test-Path (Join-Path $res 'dist\index.html'))) {
        throw "resources not assembled. Run with -Build first."
    }
    Log "electron-builder --win nsis"
    Push-Location $desktop
    npx.cmd electron-builder --win nsis
    Pop-Location
}
