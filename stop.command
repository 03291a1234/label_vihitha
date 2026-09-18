#!/bin/bash
###############################################################################
#  Label_Vihitha — stop the app stack (API, static server, tunnel).
#  Leaves Docker / SQL Server running (start those from Docker Desktop).
###############################################################################
say() { printf "   \033[1;33m•\033[0m %s\n" "$1"; }
printf "\n\033[1;35m▶ Stopping Label_Vihitha\033[0m\n"

pkill -f 'cloudflared tunnel'            >/dev/null 2>&1 && say "tunnel stopped"            || say "tunnel not running"
pkill -f 'scripts/tunnel-server.js'      >/dev/null 2>&1 && say "static server stopped"     || say "static server not running"
lsof -tiTCP:5080 -sTCP:LISTEN | xargs kill >/dev/null 2>&1 && say "API stopped"             || say "API not running"

printf "\n\033[1;32m✓ Done.\033[0m  (Docker / SQL left running — stop from Docker Desktop if needed.)\n\n"
