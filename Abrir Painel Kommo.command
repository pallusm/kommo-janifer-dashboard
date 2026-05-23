#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
cd "/Users/pallusmassucci/Documents/Kommo Janifer" || exit 1

if ! curl -fsS "http://127.0.0.1:8790/api/status" >/dev/null 2>&1; then
  nohup node scripts/control-panel-server.mjs >/tmp/kommo-janifer-panel.log 2>&1 &
  sleep 2
fi

open "http://127.0.0.1:8790/"
