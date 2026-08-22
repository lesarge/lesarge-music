#!/usr/bin/env bash
# Lesarge Music AI - remote setup (runs on Hostpoint over SSH)
# Invoked by deploy.ps1; environment supplies REMOTE_ROOT / REMOTE_WEB_DIR /
# REMOTE_DOMAIN_DIR / REMOTE_PORT.

set -u

REMOTE_ROOT="${REMOTE_ROOT:-lesarge-music-ai}"
REMOTE_WEB_DIR="${REMOTE_WEB_DIR:-web}"
REMOTE_DOMAIN_DIR="${REMOTE_DOMAIN_DIR:-music.lesarge.ch}"
REMOTE_PORT="${REMOTE_PORT:-3001}"

echo "==> Remote setup for Lesarge Music AI"
echo "    root: $HOME/$REMOTE_ROOT"
echo "    domain dir: $HOME/$REMOTE_WEB_DIR/$REMOTE_DOMAIN_DIR"

which node && node --version
which npm && npm --version
which python3 && python3 --version

APP_DIR="$HOME/$REMOTE_ROOT/app"
SERVER_DIR="$APP_DIR/server"
WEBROOT="$HOME/$REMOTE_WEB_DIR/$REMOTE_DOMAIN_DIR"

mkdir -p "$SERVER_DIR"
cd "$SERVER_DIR" || exit 1

if [ -f package.json ]; then
  echo "==> npm install (production deps only)"
  npm install --omit=dev --no-audit --no-fund
else
  echo "!! package.json missing in $SERVER_DIR - upload failed?"
fi

cat > "$SERVER_DIR/.env" <<EOF
PORT=$REMOTE_PORT
NODE_ENV=production
DATABASE_PATH=./data/acestep.db
ACESTEP_API_URL=http://localhost:8002
AUDIO_DIR=./public/audio
FRONTEND_URL=http://$REMOTE_DOMAIN_DIR
JWT_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' )
EOF

cat > "$SERVER_DIR/start.sh" <<EOF
#!/usr/bin/env bash
cd "$SERVER_DIR" || exit 1
export PORT=$REMOTE_PORT
export NODE_ENV=production
nohup node dist/index.js > "$SERVER_DIR/server.log" 2>&1 &
echo "started pid \$! -> http://localhost:$REMOTE_PORT  log: $SERVER_DIR/server.log"
EOF
chmod +x "$SERVER_DIR/start.sh"

cat > "$SERVER_DIR/stop.sh" <<'EOF'
#!/usr/bin/env bash
pkill -f "node dist/index.js" 2>/dev/null && echo "stopped" || echo "not running"
EOF
chmod +x "$SERVER_DIR/stop.sh"

echo "==> done"
echo ""
echo "Run the app:  cd $SERVER_DIR && ./start.sh"
echo ""
echo "Hostpoint Control Panel (recommended instead of nohup):"
echo "  Hosting > Node.js apps > create app:"
echo "    App path   : $SERVER_DIR"
echo "    Start cmd  : npm start"
echo "    Port       : $REMOTE_PORT"
echo "  then point $REMOTE_DOMAIN_DIR at the Node.js app."
