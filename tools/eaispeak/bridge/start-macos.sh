#!/usr/bin/env bash
# Run on a Mac with Apple Silicon. This launches model and bridge locally.
set -euo pipefail
if [[ $# -ne 1 ]]; then
  echo 'Gebruik: bash tools/eaispeak/bridge/start-macos.sh moshi|hibiki' >&2
  exit 2
fi
ENGINE="$1"
case "$ENGINE" in
  moshi) REPO="kyutai/moshiko-mlx-q4" ;;
  hibiki) REPO="kyutai/hibiki-1b-mlx-bf16" ;;
  *) echo 'Kies moshi of hibiki.' >&2; exit 2 ;;
esac

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo 'Dit script werkt alleen op een Mac met Apple Silicon.' >&2
  exit 2
fi
command -v python3.12 >/dev/null || {
  echo 'Python 3.12 ontbreekt. Installeer die eerst op deze Mac.' >&2
  exit 2
}

DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL_ENV="$DIR/.venv-model"
BRIDGE_ENV="$DIR/.venv-bridge"
[[ -x "$MODEL_ENV/bin/python" ]] || python3.12 -m venv "$MODEL_ENV"
[[ -x "$BRIDGE_ENV/bin/python" ]] || python3.12 -m venv "$BRIDGE_ENV"

echo 'Moshi MLX installeren in eigen Python-omgeving...'
"$MODEL_ENV/bin/python" -m pip install --disable-pip-version-check --upgrade moshi_mlx
echo 'EAIspeak-bridge installeren in eigen Python-omgeving...'
"$BRIDGE_ENV/bin/python" -m pip install --disable-pip-version-check -r "$DIR/requirements.txt"

if curl --max-time 2 -sSf http://127.0.0.1:8998/ >/dev/null 2>&1; then
  echo 'Poort 8998 is al in gebruik. Stop de bestaande modelserver.' >&2
  exit 2
fi
if curl --max-time 2 -sSf http://127.0.0.1:8765/health >/dev/null 2>&1; then
  echo 'Poort 8765 is al in gebruik. Stop de bestaande bridge.' >&2
  exit 2
fi

MODEL_PID=''
BRIDGE_PID=''
cleanup() {
  [[ -z "$BRIDGE_PID" ]] || kill "$BRIDGE_PID" 2>/dev/null || true
  [[ -z "$MODEL_PID" ]] || kill "$MODEL_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ "$ENGINE" == 'moshi' ]]; then
  export EAISPEAK_MOSHI_WS='ws://127.0.0.1:8998/api/chat'
else
  export EAISPEAK_HIBIKI_WS='ws://127.0.0.1:8998/api/chat'
fi
if [[ -z "${EAISPEAK_ALLOWED_ORIGINS:-}" ]]; then
  export EAISPEAK_ALLOWED_ORIGINS='https://eaimodel.nl,https://www.eaimodel.nl,http://localhost:5173,http://127.0.0.1:5173'
fi

echo "Model starten: $ENGINE ($REPO). Eerste download kan meerdere gigabytes zijn."
"$MODEL_ENV/bin/python" -m moshi_mlx.local_web \
  --hf-repo "$REPO" --host 127.0.0.1 --port 8998 &
MODEL_PID=$!
"$BRIDGE_ENV/bin/python" "$DIR/server.py" --host 127.0.0.1 --port 8765 &
BRIDGE_PID=$!

cat <<'INFO'
EAIspeak-server lokaal:
  Model:       http://127.0.0.1:8998/
  Bridge:      ws://127.0.0.1:8765/eaispeak
  Gezondheid:  http://127.0.0.1:8765/health
  EAIspeak:    https://eaimodel.nl/tools/eaispeak/

Kies Moshi of Hibiki, daarna Controleer modelverbinding.
Dit test de model-handshake, niet de audiokwaliteit.
Bij sommige browsers blokkeert de HTTPS-website de lokale WebSocket.
Voor een andere telefoon/computer is een afgeschermde WSS-verbinding nodig.
Sluit de terminal of druk Ctrl-C om beide processen te stoppen.
INFO

while kill -0 "$MODEL_PID" 2>/dev/null && kill -0 "$BRIDGE_PID" 2>/dev/null; do
  sleep 3
done
echo 'Een proces is gestopt; beide processen worden afgesloten.' >&2
exit 1
