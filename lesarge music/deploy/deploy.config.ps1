# Lesarge Music AI - SSH deploy configuration
# Adjust these values, then run:  ./deploy.ps1

# SSH endpoint (Hostpoint). sl1194.web.hostpoint.ch is the server behind music.lesarge.ch.
$SshHost = "sl1194.web.hostpoint.ch"
$SshHostAlias = "music.lesarge.ch"
$SshUser = "sh"
$SshKeyPath = "$env:USERPROFILE\.ssh\id_ed25519_hostpoint"

# Where the app is installed on the remote host (relative to the SSH home dir).
$RemoteRoot = "lesarge-music-ai"

# Hostpoint web root base. The Node app must live under ~/web/<domain>/ and bind a
# high port; the Control Panel / .htaccess proxies music.lesarge.ch to it.
$RemoteWebDir = "web"
$RemoteDomainDir = "music.lesarge.ch"

# Port the Node app binds on the remote host (Hostpoint proxies the domain to it).
$RemotePort = 3001

# FTP upload
$FtpHost = $SshHostAlias
$FtpUser = "music@music.lesarge.ch"

# Hosted database (MariaDB on Hostpoint). The app auto-installs its schema on
# first start. DB_HOST is only reachable from Hostpoint's servers.
$DbHost = "liebst2.mysql.db.internal"
$DbPort = 3306
$DbUser = "liebst2_music"
$DbPassword = "Sonja@34?"
$DbName = "liebst2_music"

# Local project paths
$AceStepUiRoot = "C:\LesargeMusicAI\ace-step-ui"
$BuildRoot = "C:\LesargeMusicAI\lesarge music\build"
$BundleDir = Join-Path $BuildRoot "bundle"
$PlinkPath = "C:\Users\lesar\AppData\Local\Temp\opencode\plink.exe"
