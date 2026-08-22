=======================================================
LESARGE MUSIC AI — REAL OFFLINE INSTALLATION GUIDE (v1.5.2)
=======================================================

WHAT IS IN THIS ZIP INSTALLER PACKAGE?
This installer contains the full source code, backend server engine, UI components, and automated setup launchers for Lesarge Music AI Studio.

QUICK INSTALLATION STEPS:
1. Extract all contents of this ZIP archive to any folder (e.g., C:\LesargeSetup\).
2. Double-click "Install-LesargeMusicAI.bat" (or "LesargeMusicAI-Setup.bat").
3. The setup will:
   - Verify Node.js v18+ / v20+
   - Deploy full application source code to C:\LesargeMusicAI\app\
   - Install local npm dependencies
   - Create a Desktop shortcut named "Lesarge Music AI"
   - Boot local backend on http://localhost:3000

HOW TO LAUNCH LATER:
- Double-click the "Lesarge Music AI" shortcut on your Desktop, OR
- Run "Start-LesargeMusicAI.bat" inside C:\LesargeMusicAI\app\

SYSTEM REQUIREMENTS:
- Windows 10/11 64-bit
- Node.js LTS v18.0+ or v20.0+ (download from https://nodejs.org/)
- Minimum 8GB RAM (16GB+ recommended for Qwen-Music VRAM pooling)
- Port 3000 open on localhost
