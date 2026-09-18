#!/bin/bash
###############################################################################
#  Label_Vihitha — one-click start for the whole stack.
#  Double-click this file (run.command) in Finder, or run:  ./run.command
#
#  Brings up:  Docker + SQL Server  →  .NET API (:5080)  →  static server (:4300)
#              →  cloudflared public tunnel, and prints the shareable link.
#  Safe to re-run: it reuses anything already up and restarts what's down.
###############################################################################
set -uo pipefail

ROOT="/Users/uchintha/Desktop/label_vihitha"
WEB="$ROOT/web"
LOGS="$ROOT/.run-logs"
DOCKER=/usr/local/bin/docker
API_PROJ="$ROOT/src/LabelVihitha.Api/LabelVihitha.Api.csproj"
mkdir -p "$LOGS"

say()  { printf "\n\033[1;35m▶ %s\033[0m\n" "$1"; }
ok()   { printf "   \033[1;32m✓\033[0m %s\n" "$1"; }
warn() { printf "   \033[1;33m!\033[0m %s\n" "$1"; }

port_up()  { lsof -tiTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
wait_tcp() { for _ in $(seq 1 "${2:-30}"); do (echo > "/dev/tcp/127.0.0.1/$1") 2>/dev/null && return 0; sleep 2; done; return 1; }

say "Label_Vihitha — starting full stack"

# 1) Docker + SQL Server ------------------------------------------------------
if ! "$DOCKER" info >/dev/null 2>&1; then
  warn "Docker daemon not running — launching Docker Desktop…"
  open -a Docker
  for _ in $(seq 1 60); do "$DOCKER" info >/dev/null 2>&1 && break; sleep 3; done
fi
"$DOCKER" info >/dev/null 2>&1 && ok "Docker is running" || { warn "Docker still not ready — start Docker Desktop manually, then re-run."; }
"$DOCKER" start lv-sql >/dev/null 2>&1 && ok "SQL container (lv-sql) started" || warn "Could not start lv-sql (already running, or container missing)"
wait_tcp 1433 30 && ok "SQL Server listening on :1433" || warn "SQL not reachable on :1433 yet"

# 2) API ----------------------------------------------------------------------
if port_up 5080; then
  ok "API already running on :5080"
else
  say "Starting API on :5080"
  ( cd "$ROOT" && nohup dotnet run --project "$API_PROJ" --urls http://localhost:5080 > "$LOGS/api.log" 2>&1 & )
  for _ in $(seq 1 45); do curl -s -o /dev/null http://localhost:5080/api/owners && break; sleep 2; done
  port_up 5080 && ok "API is up (log: .run-logs/api.log)" || warn "API did not come up — check .run-logs/api.log"
fi

# 3) Build the web app for the tunnel (production build uses /api) -------------
say "Building the web app"
( cd "$WEB" && npx ng build > "$LOGS/build.log" 2>&1 ) \
  && ok "Web build complete" || { warn "Web build FAILED — check .run-logs/build.log"; }

# 4) Static server + /api proxy on :4300 --------------------------------------
say "Starting static server on :4300"
port_up 4300 && lsof -tiTCP:4300 -sTCP:LISTEN | xargs kill >/dev/null 2>&1
( nohup node "$ROOT/scripts/tunnel-server.js" > "$LOGS/static.log" 2>&1 & )
sleep 2
port_up 4300 && ok "Static server up on http://localhost:4300" || warn "Static server did not start — check .run-logs/static.log"

# 5) Public tunnel (cloudflared) ---------------------------------------------
say "Opening public tunnel"
pkill -f 'cloudflared tunnel' >/dev/null 2>&1
: > "$LOGS/cloudflared.log"
( nohup cloudflared tunnel --url http://localhost:4300 --protocol http2 --no-autoupdate > "$LOGS/cloudflared.log" 2>&1 & )
URL=""
for _ in $(seq 1 30); do
  URL=$(grep -hoE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/cloudflared.log" | head -1)
  [ -n "$URL" ] && break; sleep 2
done

printf "\n\033[1;32m════════════════════════════════════════════════════════════\033[0m\n"
printf "  \033[1;32m✓ Label_Vihitha is running\033[0m\n\n"
printf "    Local:   http://localhost:4300\n"
printf "    Public:  %s\n" "${URL:-<not detected yet — see .run-logs/cloudflared.log>}"
printf "    Login:   owner  /  Owner#12345\n"
printf "\033[1;32m════════════════════════════════════════════════════════════\033[0m\n\n"
printf "Logs are in %s . To stop everything, run ./stop.command\n\n" "$LOGS"
