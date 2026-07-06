#!/bin/bash

SERVER_DIR="$(cd "$(dirname "$0")/server" && pwd)"

osascript <<EOF
tell application "Terminal"
  activate

  do script "cd \"$SERVER_DIR\" && echo '🐑 Backend iniciando...' && node index.js"

  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "cd \"$SERVER_DIR\" && echo '📡 Gateway BLE iniciando...' && node gateway.js" in front window

  tell application "System Events" to keystroke "t" using command down
  delay 0.5
  do script "echo '🌐 ngrok iniciando...' && ngrok http 3001" in front window

end tell
EOF
