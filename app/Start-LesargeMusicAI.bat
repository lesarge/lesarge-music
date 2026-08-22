@echo off
rem =========================================================
rem LESARGE MUSIC AI — LOCAL LAUNCHER SCRIPT
rem =========================================================
title Lesarge Music AI Local Studio Launcher
color 0B
cls
echo ======================================================
echo  STARTING LESARGE MUSIC AI LOCAL STUDIO...
echo ======================================================
cd /d "%~dp0"
if exist "app" cd app
echo Booting backend service on http://localhost:3000 ...
timeout /t 2 /nobreak >nul
start http://localhost:3000
npm run dev
pause
