#!/usr/bin/env bash
# Установка сервера Джарвиса на Mac.
# Запуск из папки jarvis-server:   ./install.sh
# Повторный запуск безопасен: настройки и данные в ~/.jarvis не перезаписываются.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
JHOME="${JARVIS_HOME:-$HOME/.jarvis}"
CONFIG="$JHOME/config.toml"
LABEL="com.jarvis.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✔\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Этот установщик для macOS." >&2; exit 1
fi

mkdir -p "$JHOME/logs"
chmod 700 "$JHOME"

# ---------- 1. Что уже есть на этом Mac ----------
say "Смотрю, что уже работает на этом Mac (отчёт: $JHOME/system-report.txt)"
{
  echo "== $(date)"
  sw_vers
  sysctl -n machdep.cpu.brand_string
  echo "RAM: $(( $(sysctl -n hw.memsize) / 1073741824 )) GB"
  df -h / | tail -1
  echo "== Порты, которые уже слушаются"
  lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $1, $9}' | sort -u
  echo "== Свои службы (не Apple)"
  launchctl list | awk 'NR>1 && $3 !~ /^com\.apple\./ {print $3}'
  echo "== Docker"
  docker ps --format '{{.Names}}  {{.Image}}  {{.Ports}}' 2>/dev/null || echo "нет"
  echo "== Tailscale"
  (command -v tailscale >/dev/null && tailscale status 2>/dev/null) \
    || /Applications/Tailscale.app/Contents/MacOS/Tailscale status 2>/dev/null || echo "не найден"
} > "$JHOME/system-report.txt" 2>&1 || true
ok "$(sw_vers -productName) $(sw_vers -productVersion), $(sysctl -n machdep.cpu.brand_string)"

# ---------- 2. Python и зависимости ----------
say "Python и библиотеки"
if ! command -v uv >/dev/null 2>&1 && [[ ! -x "$HOME/.local/bin/uv" ]]; then
  echo "  Ставлю uv (менеджер Python от Astral) в ~/.local/bin…"
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
"$UV" venv --quiet --python 3.12 "$DIR/.venv"
"$UV" pip install --quiet --python "$DIR/.venv/bin/python" -r "$DIR/requirements.txt"
ok "Python $("$DIR/.venv/bin/python" -c 'import sys; print(sys.version.split()[0])'), библиотеки установлены"

# ---------- 3. Настройки ----------
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

if [[ -f "$CONFIG" ]]; then
  say "Настройки уже есть: $CONFIG (не трогаю)"
  PORT="$(awk -F'= *' '/^port *=/ {print $2; exit}' "$CONFIG")"
  PORT="${PORT:-8765}"
else
  say "Создаю настройки"
  PORT=8765
  while port_busy "$PORT"; do PORT=$((PORT + 1)); done
  ok "Порт $PORT свободен"

  echo "  Ключ Claude API: console.anthropic.com → API Keys → Create Key."
  read -r -s -p "  Вставьте ключ (sk-ant-…, при вводе не отображается): " API_KEY; echo
  if [[ "$API_KEY" != sk-ant-* ]]; then
    warn "Ключ не похож на ключ Claude API. Его можно поправить позже в $CONFIG"
  fi

  read -r -p "  Какие папки Джарвису можно читать? [~/Documents] " FOLDERS
  FOLDERS="${FOLDERS:-~/Documents}"
  FOLDERS_TOML="$(printf '%s' "$FOLDERS" | tr ',' '\n' | sed 's/^ *//; s/ *$//' | grep -v '^$' | sed 's/.*/"&"/' | paste -sd, -)"

  ACCESS_KEY="$("$DIR/.venv/bin/python" -c 'import secrets; print(secrets.token_urlsafe(32))')"
  umask 077
  cat > "$CONFIG" <<EOF
# Настройки Джарвиса. После изменений: ./jarvis.sh restart
anthropic_api_key = "$API_KEY"
access_key = "$ACCESS_KEY"
model = "claude-haiku-5-5"
effort = "low"            # low — быстрее и дешевле; medium/high — вдумчивее
port = $PORT
allowed_origins = ["https://ddfedotov-droid.github.io"]

[thermostat]
enabled = false           # включить после docs/ecobee.md
min_c = 16
max_c = 26

[blink]
enabled = false           # включить после ./jarvis.sh blink-login (docs/blink.md)
allowed_cameras = []      # пусто = все; например ["Входная дверь", "Двор"]

[network]
enabled = true
speedtest_every_min = 60  # каждый замер ≈ 35 МБ трафика

[files]
folders = [$FOLDERS_TOML]

[notify]
ntfy_topic = ""           # docs/notifications.md
EOF
  umask 022
  ok "Настройки сохранены в $CONFIG (доступ только у вас)"
fi

# ---------- 4. Автозапуск ----------
say "Автозапуск при входе в систему"
mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$DIR/.venv/bin/python</string>
    <string>-m</string>
    <string>jarvis</string>
    <string>serve</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>JARVIS_HOME</key><string>$JHOME</string>
    <key>PATH</key><string>/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$JHOME/logs/jarvis.log</string>
  <key>StandardErrorPath</key><string>$JHOME/logs/jarvis.log</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 3
if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null; then
  ok "Сервер работает: http://127.0.0.1:$PORT"
else
  warn "Сервер не ответил. Журнал: tail -50 $JHOME/logs/jarvis.log"
fi

# ---------- 5. Доступ снаружи через Tailscale ----------
say "Доступ с часов и телефона (Tailscale)"
TS="$(command -v tailscale || true)"
[[ -z "$TS" && -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]] && TS=/Applications/Tailscale.app/Contents/MacOS/Tailscale
if [[ -z "$TS" ]]; then
  warn "Tailscale не найден. Установите его (tailscale.com/download) и запустите ./jarvis.sh funnel"
else
  echo "  Tailscale Funnel даст адрес https://…ts.net, по которому часы достучатся до сервера"
  echo "  даже по LTE. Без ключа доступа сервер на запросы не отвечает."
  read -r -p "  Включить Funnel сейчас? [Y/n] " ANS
  if [[ ! "$ANS" =~ ^[Nn] ]]; then
    "$DIR/jarvis.sh" funnel || warn "Не получилось. Подробности: docs/tailscale.md"
  fi
fi

# ---------- 6. Итог ----------
say "Готово"
"$DIR/jarvis.sh" key
cat <<EOF
Что дальше (подробно — в jarvis-server/README.md):
  1. Проверка:         ./jarvis.sh doctor
  2. Вопрос из Терминала: ./jarvis.sh ask "Как интернет сегодня?"
  3. Часы и iPhone:    docs/watch.md
  4. Термостат:        docs/ecobee.md
  5. Камеры Blink:     docs/blink.md

Чтобы Mac не засыпал (выполнить один раз, попросит пароль):
  sudo pmset -a sleep 0 disksleep 0
EOF
