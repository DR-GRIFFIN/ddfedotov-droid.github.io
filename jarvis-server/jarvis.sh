#!/usr/bin/env bash
# Управление сервером Джарвиса. ./jarvis.sh help — список команд.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
export JARVIS_HOME="${JARVIS_HOME:-$HOME/.jarvis}"
LABEL="com.jarvis.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PY="$DIR/.venv/bin/python"
DOMAIN="gui/$(id -u)"

need_install() { [[ -x "$PY" ]] || { echo "Сначала запустите ./install.sh" >&2; exit 1; }; }
port() { awk -F'= *' '/^port *=/ {print $2; exit}' "$JARVIS_HOME/config.toml" 2>/dev/null || echo 8765; }
tailscale_bin() {
  command -v tailscale 2>/dev/null && return
  [[ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]] && echo /Applications/Tailscale.app/Contents/MacOS/Tailscale && return
  echo "Tailscale не найден: tailscale.com/download" >&2; return 1
}

cmd="${1:-help}"; shift || true
case "$cmd" in
  start)   launchctl bootstrap "$DOMAIN" "$PLIST" && echo "Запущен." ;;
  stop)    launchctl bootout "$DOMAIN/$LABEL" && echo "Остановлен." ;;
  restart) launchctl kickstart -k "$DOMAIN/$LABEL" && echo "Перезапущен." ;;
  status)
    if curl -fsS "http://127.0.0.1:$(port)/health"; then echo; echo "Работает на порту $(port)."
    else echo "Не отвечает. Журнал: ./jarvis.sh logs"; fi ;;
  logs)    tail -n "${1:-80}" -f "$JARVIS_HOME/logs/jarvis.log" ;;
  doctor|key|blink-login|ask)
    need_install; cd "$DIR"; exec "$PY" -m jarvis "$cmd" "$@" ;;
  funnel)
    TS="$(tailscale_bin)"
    # Если 443 уже кем-то занят в Tailscale serve, берём 8443.
    HTTPS_PORT=443
    if "$TS" serve status 2>/dev/null | grep -q ':443\|https://[^:]*/'; then HTTPS_PORT=8443; fi
    "$TS" funnel --bg --https="$HTTPS_PORT" "http://127.0.0.1:$(port)"
    echo
    "$TS" funnel status
    echo
    echo "Адрес сервера для часов и веб-страницы — строка https://…ts.net выше"
    [[ "$HTTPS_PORT" != 443 ]] && echo "(с :$HTTPS_PORT в конце)."
    true ;;
  funnel-off)
    TS="$(tailscale_bin)"; "$TS" funnel reset && echo "Funnel выключен: снаружи сервер больше не виден." ;;
  update)
    cd "$DIR" && git pull --ff-only
    UV="$(command -v uv || echo "$HOME/.local/bin/uv")"
    "$UV" pip install --quiet --python "$PY" -r requirements.txt
    launchctl kickstart -k "$DOMAIN/$LABEL" && echo "Обновлён и перезапущен." ;;
  uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Автозапуск удалён. Настройки и данные остались в $JARVIS_HOME — удалите папку сами, если они не нужны." ;;
  *)
    cat <<EOF
Команды:
  status        работает ли сервер
  logs          журнал (Ctrl+C — выход)
  restart       перезапуск после изменения config.toml
  start | stop  запустить | остановить
  doctor        проверить настройки
  ask "текст"   задать вопрос из Терминала
  key [--new]   показать ключ доступа | создать новый
  blink-login   войти в Blink
  funnel        открыть доступ с часов через Tailscale Funnel
  funnel-off    закрыть доступ снаружи
  update        обновить из GitHub и перезапустить
  uninstall     убрать автозапуск
EOF
    ;;
esac
