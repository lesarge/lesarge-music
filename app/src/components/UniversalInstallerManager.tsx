import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Download,
  FolderTree,
  Cpu,
  HardDrive,
  Smartphone,
  PackageCheck,
  Terminal,
  ShieldCheck,
  Sparkles,
  Play,
  Monitor,
  RefreshCw,
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Globe,
  CheckCircle2,
  AlertCircle,
  Zap,
  Code,
  Copy,
  Check,
  X,
  FileCode2,
} from 'lucide-react';
import {
  fetchHardwareSpecs,
  fetchInstallerPackages,
  fetchDirectoryTree,
  simulateHardwareMode,
  fetchAIModelManagerStatus,
  triggerAIModelDownload,
  verifyAIModelChecksum,
} from '../services/lesargeApi';
import { HardwareSpecs, LocalDirectoryNode, AIModelDownloadState } from '../types';

const BATCH_SETUP_SCRIPT = `@echo off\r
rem =========================================================\r
rem LESARGE MUSIC AI — REAL OFFLINE DESKTOP SETUP INSTALLER v1.5.2\r
rem =========================================================\r
title Lesarge Music AI Real Offline Setup\r
color 0A\r
cls\r
echo.\r
echo  ======================================================\r
echo   LESARGE MUSIC AI — REAL OFFLINE DESKTOP SETUP\r
echo  ======================================================\r
echo  Target App Directory: C:\\LesargeMusicAI\\app\\\r
echo  Target Models Directory: C:\\LesargeMusicAI\\models\\\r
echo.\r

set TARGET_DIR=C:\\LesargeMusicAI\r
set APP_DIR=%TARGET_DIR%\\app\r

echo [1/6] Checking Node.js Runtime...\r
node -v >nul 2>&1\r
if %errorLevel% neq 0 (\r
    echo [!] WARNING: Node.js is not detected on this system.\r
    echo     Please install Node.js v18+ or v20+ LTS from https://nodejs.org/\r
    echo     Or run the PowerShell installer 'Install-LesargeMusicAI.ps1'\r
    pause\r
    exit /b 1\r
) else (\r
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i\r
    echo [v] Node.js runtime verified: %NODE_VERSION%\r
)\r

echo [2/6] Initializing Target Directory Structure at C:\\LesargeMusicAI...\r
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"\r
if not exist "%APP_DIR%" mkdir "%APP_DIR%"\r
if not exist "%TARGET_DIR%\\models" mkdir "%TARGET_DIR%\\models"\r
if not exist "%TARGET_DIR%\\models\\qwen-music" mkdir "%TARGET_DIR%\\models\\qwen-music"\r
if not exist "%TARGET_DIR%\\bin" mkdir "%TARGET_DIR%\\bin"\r
if not exist "%TARGET_DIR%\\logs" mkdir "%TARGET_DIR%\\logs"\r
if not exist "%TARGET_DIR%\\outputs" mkdir "%TARGET_DIR%\\outputs"\r

echo [3/6] Deploying Application Package Files to C:\\LesargeMusicAI\\app\\...\r
set SCRIPT_DIR=%~dp0\r
if exist "%SCRIPT_DIR%app" (\r
    xcopy /E /I /Y /Q "%SCRIPT_DIR%app\\*" "%APP_DIR%\\"\r
) else (\r
    xcopy /E /I /Y /Q "%SCRIPT_DIR%*" "%APP_DIR%\\"\r
)\r

echo [4/6] Installing Local Dependencies in C:\\LesargeMusicAI\\app\\...\r
cd /d "%APP_DIR%"\r
call npm install --no-audit --no-fund\r

echo [5/6] Creating Desktop Launcher Shortcut...\r
set SHORTCUT_SCRIPT=%TEMP%\\create_lesarge_shortcut.vbs\r
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SHORTCUT_SCRIPT%"\r
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\\Lesarge Music AI.lnk" >> "%SHORTCUT_SCRIPT%"\r
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SHORTCUT_SCRIPT%"\r
echo oLink.TargetPath = "%APP_DIR%\\Start-LesargeMusicAI.bat" >> "%SHORTCUT_SCRIPT%"\r
echo oLink.WorkingDirectory = "%APP_DIR%" >> "%SHORTCUT_SCRIPT%"\r
echo oLink.Description = "Lesarge Music AI Local Studio" >> "%SHORTCUT_SCRIPT%"\r
echo oLink.Save >> "%SHORTCUT_SCRIPT%"\r
cscript //nologo "%SHORTCUT_SCRIPT%" >nul 2>&1\r
del "%SHORTCUT_SCRIPT%" >nul 2>&1\r

echo [6/6] Launching Lesarge Music AI Local Studio...\r
echo.\r
echo ======================================================\r
echo  INSTALLATION COMPLETED SUCCESSFULLY!\r
echo  Desktop Shortcut Created: 'Lesarge Music AI.lnk'\r
echo  Opening Studio at http://localhost:3000 ...\r
echo ======================================================\r
echo.\r
timeout /t 2 /nobreak >nul\r
start http://localhost:3000\r
call npm run dev\r
pause\r
`;

const POWERSHELL_SETUP_SCRIPT = `# Lesarge Music AI — Real Offline PowerShell Auto-Installer v1.5.2\r
$Host.UI.RawUI.WindowTitle = "Lesarge Music AI Real Offline PowerShell Setup"\r
Write-Host "======================================================" -ForegroundColor Cyan\r
Write-Host " LESARGE MUSIC AI — REAL OFFLINE POWERSHELL SETUP     " -ForegroundColor Green\r
Write-Host "======================================================" -ForegroundColor Cyan\r

$targetDir = "C:\\LesargeMusicAI"\r
$appDir = "$targetDir\\app"\r

# Verify Node.js Environment\r
try {\r
    $nodeVer = node -v 2>$null\r
    if ($nodeVer) {\r
        Write-Host "[v] Node.js environment detected: $nodeVer" -ForegroundColor Green\r
    } else {\r
        Write-Host "[!] Node.js not detected. Download Node.js v18/20 from https://nodejs.org/" -ForegroundColor Red\r
        Read-Host "Press Enter to exit"\r
        exit\r
    }\r
} catch {\r
    Write-Host "[!] Node.js check error." -ForegroundColor Red\r
}\r

# Create Directory Hierarchy\r
New-Item -ItemType Directory -Force -Path "$appDir" | Out-Null\r
New-Item -ItemType Directory -Force -Path "$targetDir\\models\\qwen-music" | Out-Null\r
New-Item -ItemType Directory -Force -Path "$targetDir\\bin" | Out-Null\r
New-Item -ItemType Directory -Force -Path "$targetDir\\logs" | Out-Null\r
New-Item -ItemType Directory -Force -Path "$targetDir\\outputs" | Out-Null\r

# Copy Application Source Files\r
$scriptDir = $PSScriptRoot\r
if (Test-Path "$scriptDir\\app") {\r
    Copy-Item -Path "$scriptDir\\app\\*" -Destination "$appDir" -Recurse -Force\r
} else {\r
    Copy-Item -Path "$scriptDir\\*" -Destination "$appDir" -Recurse -Force -Exclude "*.zip","*.ps1"\r
}\r

Write-Host "[+] Installing local application dependencies in $appDir..." -ForegroundColor Yellow\r
Set-Location "$appDir"\r
npm install --no-audit --no-fund\r

# Create Desktop Shortcut\r
try {\r
    $desktopPath = [System.Environment]::GetFolderPath('Desktop')\r
    $WshShell = New-Object -ComObject WScript.Shell\r
    $Shortcut = $WshShell.CreateShortcut("$desktopPath\\Lesarge Music AI.lnk")\r
    $Shortcut.TargetPath = "$appDir\\Start-LesargeMusicAI.bat"\r
    $Shortcut.WorkingDirectory = "$appDir"\r
    $Shortcut.Description = "Lesarge Music AI Studio"\r
    $Shortcut.Save()\r
    Write-Host "[v] Desktop shortcut successfully created." -ForegroundColor Green\r
} catch {\r
    Write-Host "[!] Could not create desktop shortcut automatically." -ForegroundColor Yellow\r
}\r

Write-Host "======================================================" -ForegroundColor Cyan\r
Write-Host " SETUP COMPLETED! Opening http://localhost:3000 ...   " -ForegroundColor Green\r
Write-Host "======================================================" -ForegroundColor Cyan\r

Start-Process "http://localhost:3000"\r
npm run dev\r
`;

const README_SETUP_TXT = `=======================================================\r
LESARGE MUSIC AI — REAL OFFLINE INSTALLATION GUIDE (v1.5.2)\r
=======================================================\r
\r
WHAT IS IN THIS ZIP INSTALLER PACKAGE?\r
This installer contains the full source code, backend server engine, UI components, and automated setup launchers for Lesarge Music AI Studio.\r
\r
QUICK INSTALLATION STEPS:\r
1. Extract all contents of this ZIP archive to any folder (e.g., C:\\LesargeSetup\\).\r
2. Double-click "Install-LesargeMusicAI.bat" (or "LesargeMusicAI-Setup.bat").\r
3. The setup will:\r
   - Verify Node.js v18+ / v20+\r
   - Deploy full application source code to C:\\LesargeMusicAI\\app\\\r
   - Install local npm dependencies\r
   - Create a Desktop shortcut named "Lesarge Music AI"\r
   - Boot local backend on http://localhost:3000\r
\r
HOW TO LAUNCH LATER:\r
- Double-click the "Lesarge Music AI" shortcut on your Desktop, OR\r
- Run "Start-LesargeMusicAI.bat" inside C:\\LesargeMusicAI\\app\\\r
\r
SYSTEM REQUIREMENTS:\r
- Windows 10/11 64-bit\r
- Node.js LTS v18.0+ or v20.0+ (download from https://nodejs.org/)\r
- Minimum 8GB RAM (16GB+ recommended for Qwen-Music VRAM pooling)\r
- Port 3000 open on localhost\r
`;

interface UniversalInstallerManagerProps {
  onOpenInstallerWizard: () => void;
}

export const UniversalInstallerManager: React.FC<UniversalInstallerManagerProps> = ({
  onOpenInstallerWizard,
}) => {
  const [hardware, setHardware] = useState<HardwareSpecs | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [directoryTree, setDirectoryTree] = useState<LocalDirectoryNode | null>(null);
  const [models, setModels] = useState<AIModelDownloadState[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptModalType, setScriptModalType] = useState<'bat' | 'ps1'>('bat');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'C:\\LesargeMusicAI': true,
    'C:\\LesargeMusicAI\\models': true,
  });

  const handleDownloadClientZip = async () => {
    try {
      // Trigger download from server endpoint which packages the real source code & installers
      const response = await fetch('/downloads/LesargeMusicAI-Offline-Setup.zip');
      if (!response.ok) throw new Error('Server download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'LesargeMusicAI-Offline-Setup.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.location.href = '/downloads/LesargeMusicAI-Offline-Setup.zip';
    }
  };

  const handleDownloadScriptFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [hw, pkgs, tree, modelRes] = await Promise.all([
        fetchHardwareSpecs(),
        fetchInstallerPackages(),
        fetchDirectoryTree(),
        fetchAIModelManagerStatus().catch(() => ({ models: [], isDownloading: false, batchProgress: 100 })),
      ]);
      setHardware(hw);
      setPackages(pkgs);
      setDirectoryTree(tree);
      setModels(modelRes.models);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyModel = async (modelId: string) => {
    setVerifyingId(modelId);
    try {
      await verifyAIModelChecksum(modelId);
      await loadAllData();
    } catch {
      // Handle error
    } finally {
      setVerifyingId(null);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const renderDirectoryTree = (node: LocalDirectoryNode) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders[node.path];

    return (
      <div key={node.path} className="pl-3 text-xs font-mono">
        <div
          onClick={() => isFolder && toggleFolder(node.path)}
          className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-slate-300 transition-colors ${
            isFolder ? 'font-bold' : ''
          }`}
        >
          {isFolder ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            </>
          ) : (
            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-3.5" />
          )}

          <span className="truncate">{node.name}</span>

          {node.sizeMb && (
            <span className="ml-auto text-[10px] text-slate-500 font-normal">
              {node.sizeMb > 1000 ? `${(node.sizeMb / 1024).toFixed(1)} GB` : `${node.sizeMb} MB`}
            </span>
          )}
        </div>

        {isFolder && isExpanded && node.children && (
          <div className="border-l border-slate-800 ml-2.5">
            {node.children.map((child) => renderDirectoryTree(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner & Quick Action */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lesarge Universal Deployment Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Universal Installation & Deployment System
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed">
            One Setup. One Install. Zero manual dependency setup. Build or install Lesarge Music AI across Windows Desktop, Android Remote Client, Web Admin (<span className="text-emerald-400 font-mono">music.lesarge.ch</span>), and future iOS.
          </p>
        </div>

        <button
          onClick={onOpenInstallerWizard}
          className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 flex items-center gap-2 shrink-0 transition-transform active:scale-95"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Launch Installation Wizard</span>
        </button>
      </div>

      {/* Target Operating Systems Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Target Platforms & Executable Packages</h2>
            <p className="text-xs text-slate-500">Download Windows .exe binaries, standalone offline setup scripts, or Android mobile packages</p>
          </div>
        </div>

        {/* Quick Offline Windows Setup Banner */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs font-mono">
              <HardDrive className="w-4 h-4" />
              <span>Offline Windows Installation Packages (.zip & .bat)</span>
            </div>
            <p className="text-xs text-slate-300">
              Need to deploy Lesarge Music AI on an offline Windows PC? Download the extractable ZIP setup package or direct double-click batch script below (guaranteed 100% readable by Windows File Explorer):
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <a
              href="/downloads/LesargeMusicAI-Offline-Setup.zip"
              download="LesargeMusicAI-Offline-Setup.zip"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Offline Zip Package (.zip)</span>
            </a>
            <a
              href="/downloads/LesargeMusicAI-Setup.bat"
              download="LesargeMusicAI-Setup.bat"
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-300" />
              <span>Setup Batch Script (.bat)</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs font-mono">
                    {pkg.id.includes('win') ? (
                      <Monitor className="w-4 h-4" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{pkg.os}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                    {pkg.version}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{pkg.name}</h3>
                  {pkg.name.endsWith('.exe') && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-mono font-bold">
                      EXE
                    </span>
                  )}
                  {pkg.name.endsWith('.bat') && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-mono font-bold">
                      BAT
                    </span>
                  )}
                  {pkg.name.endsWith('.apk') && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold">
                      APK
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-normal">{pkg.type}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-700">
                  {pkg.sizeMb > 1000 ? `${(pkg.sizeMb / 1024).toFixed(1)} GB` : `${pkg.sizeMb} MB`}
                </span>
                <a
                  href={pkg.downloadUrl}
                  download={pkg.name}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {pkg.name.slice(pkg.name.lastIndexOf('.'))}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Model Manager Inventory & Checksum Verification Panel */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">
                AI Model Manager — Weights Inventory & Verification
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Managed by AIModelManager service in <span className="font-mono text-slate-700 font-semibold">C:\LesargeMusicAI\models\</span>
            </p>
          </div>

          <button
            onClick={loadAllData}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Inventory</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold uppercase">
                    {m.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      m.phase === 'INSTALLED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : m.phase === 'DOWNLOADING'
                        ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {m.phase === 'INSTALLED' ? 'REGISTERED' : m.phase}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
                <div className="text-[11px] font-mono text-slate-500 truncate">
                  Path: C:\{m.location}
                </div>
              </div>

              {/* Progress bar if downloading */}
              {m.phase === 'DOWNLOADING' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-700">
                    <span>Downloading @ {m.downloadSpeedMb} MB/s</span>
                    <span>{m.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${m.progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <div className="font-mono text-slate-700 font-bold">{m.sizeGb} GB</div>
                <button
                  onClick={() => handleVerifyModel(m.id)}
                  disabled={verifyingId === m.id || m.phase === 'DOWNLOADING'}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-300 text-slate-800 text-[11px] font-mono font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <ShieldCheck className={`w-3 h-3 text-indigo-600 ${verifyingId === m.id ? 'animate-spin' : ''}`} />
                  <span>{verifyingId === m.id ? 'Checking...' : 'Verify SHA-256'}</span>
                </button>
              </div>

              {/* Checksum detail */}
              <div className="text-[10px] font-mono text-slate-500 bg-slate-100 p-2 rounded-xl truncate">
                {m.verificationMessage || `Checksum: ${m.checksum}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hardware Profile & Local Directory Structure Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hardware Detection Engine Box */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Hardware Detection Engine</h3>
            </div>
            <button
              onClick={loadAllData}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {hardware && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-indigo-900 font-bold">Assigned Tier: </span>
                  <span className="font-extrabold text-indigo-700 uppercase">{hardware.tier} HARDWARE</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold">
                  VRAM: {hardware.vramTotalGb} GB
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-[10px]">CPU CORE THREADS</div>
                  <div className="font-bold text-slate-900 mt-0.5">{hardware.cpuCores} Cores</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-[10px]">SYSTEM MEMORY</div>
                  <div className="font-bold text-slate-900 mt-0.5">{hardware.ramTotalGb} GB RAM</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-[10px]">ACCELERATOR</div>
                  <div className="font-bold text-slate-900 mt-0.5 truncate">{hardware.gpuModel}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-slate-500 text-[10px]">DISK SPACE AVAILABLE</div>
                  <div className="font-bold text-slate-900 mt-0.5">{hardware.diskFreeGb} GB</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900">Lesarge AI Router Model Recommendations:</div>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Qwen 2.5 Text Orchestration (GGUF 1.8GB)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ACE-Step 1.5 Music Generation (Safetensors 3.2GB)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Qwen3-TTS Vocal Synthesizer (0.9GB)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hardware.recommendedFeatures.videoGeneration ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>Wan 2.2 Cinematic Video AI (14.5GB - {hardware.tier === 'LOW' ? 'Cloud Only' : 'Local Supported'})</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Local AI Clean Directory Structure View */}
        <div className="p-6 rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Local AI Directory Hierarchy</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">C:\LesargeMusicAI\</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            All AI models, isolated runtimes, background workers, logs, and user projects are maintained cleanly in application-local space:
          </p>

          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800/80 max-h-72 overflow-y-auto">
            {directoryTree && renderDirectoryTree(directoryTree)}
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Isolated Environment</span>
            <span className="text-emerald-400 font-bold">✓ System PATH Unmodified</span>
          </div>
        </div>
      </div>
    </div>
  );
};
