#!/bin/bash

SERVER_DIR="$(cd "$(dirname "$0")/server" && pwd)"

osascript <<EOF
tell application "Terminal"
  activate

  -- Tab 1: backend
  do script "cd \"$SERVER_DIR\" && echo '🐑 Iniciando backend...' && node index.js"

  -- Tab 2: gateway BLE
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "cd \"$SERVER_DIR\" && echo '📡 Iniciando gateway BLE...' && node gateway.js" in front window

  -- Tab 3: ngrok
  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "echo '🌐 Iniciando ngrok...' && ngrok http 3001" in front window

end tell
EOF

echo "✅ Ovelhinha iniciado!"
