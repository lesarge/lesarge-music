# Deploying Lesarge Music AI to music.lesarge.ch (Hostpoint, FTP)

## What is deployed

The built web app is uploaded over FTP to the **web root of music.lesarge.ch**
(the FTP login lands directly in that folder):

- `dist/`            - built frontend (Vite)
- `server/`          - built backend (Express, TypeScript -> dist) + package.json

The backend now serves the built frontend itself (single port, no Vite needed).

The hosted `server/.env` is written automatically by `deploy-ftp.ps1` and points
the app at the Hostpoint MariaDB database:

- Host: `liebst2.mysql.db.internal` (internal - only reachable from Hostpoint)
- Database: `liebst2_music`  User: `liebst2_music`

On first start the app **auto-installs its schema** (creates all tables and
indexes) into `liebst2_music` - no manual SQL required.

## 1. Upload

```powershell
$env:LESARGE_FTP_PASSWORD = "nBKjhzgM!zGXjE%#"
.\deploy\deploy-ftp.ps1          # rebuild + upload
.\deploy\deploy-ftp.ps1 -SkipBuild
```

## 2. Hostpoint Control Panel - enable the Node.js app

1. Log in at https://www.hostpoint.ch (Control Panel)
2. Hosting > **Node.js apps** > create new app
3. Settings:
   - **App path**: the `server` folder inside the domain's web root
     (select the domain `music.lesarge.ch`, app dir `server`)
   - **Start command**: `npm start`
   - Port: let Hostpoint assign one (it shows the URL)
4. Save. Hostpoint runs `npm install` (installs express, better-sqlite3, ...)
   then starts `node dist/index.js` and routes `https://music.lesarge.ch/` to it.

## 3. Verify

- https://music.lesarge.ch/  -> login page
- The database schema is created automatically in `liebst2_music` on first start.

## Housekeeping

- The previous (polluted) upload was moved to `server.old/` on the FTP account.
  Once the Node.js app works, delete it (Hostpoint Control Panel > File Manager,
  or the recursive FTP cleanup script) to avoid confusion.

## Limitations on shared hosting

- **AI music generation does NOT run on shared hosting** (no GPU, no multi-GB
  model storage, strict CPU/memory limits). The ACE-Step / YuE engines stay on
  this PC. Generate here, or connect a generation backend later.
- Library, uploads, mixing editor, demucs and the UI all work on the host.
- better-sqlite3 needs a Node version with a matching prebuild; if Hostpoint's
  npm install fails on it, pin the Node.js version in the panel (>= 18).
