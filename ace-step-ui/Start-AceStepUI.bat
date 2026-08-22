@echo off
rem =========================================================
rem LESARGE MUSIC AI - MAIN APP LAUNCHER
rem (UI backend 3001 + frontend 3002 + ACE-Step model API 8002)
rem Stays running so Task Scheduler keeps child processes alive.
rem =========================================================
cd /d "%~dp0"
if not exist logs mkdir logs

netstat -ano | findstr /r ":3001 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  start "Lesarge Backend" /min cmd /c "cd /d C:\LesargeMusicAI\ace-step-ui\server && npm.cmd run dev > C:\LesargeMusicAI\ace-step-ui\logs\backend.log 2>&1"
  timeout /t 3 /nobreak >nul
)

netstat -ano | findstr /r ":3002 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  start "Lesarge Frontend" /min cmd /c "cd /d C:\LesargeMusicAI\ace-step-ui && npm.cmd run dev > C:\LesargeMusicAI\ace-step-ui\logs\frontend.log 2>&1"
  timeout /t 3 /nobreak >nul
)

netstat -ano | findstr /r ":8002 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  start "Lesarge Model API" /min cmd /c "cd /d C:\LesargeMusicAI\ACE-Step-1.5 && .venv\Scripts\python.exe -u -m acestep.api_server --host 0.0.0.0 --port 8002 > C:\LesargeMusicAI\ACE-Step-1.5\api8002.log 2>&1"
)

start http://localhost:3002

rem Keep this task alive so Task Scheduler does not kill the child processes.
:loop
timeout /t 300 /nobreak >nul
goto loop
