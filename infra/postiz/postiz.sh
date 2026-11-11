#!/usr/bin/env bash
# Operate the self-hosted Postiz stack. Used by the package scripts postiz:* and by Claude (skill: operate-postiz).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/.env"
compose() { docker compose -f "$DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"; }

need_env() {
  [[ -f "$ENV_FILE" ]] || { echo "✗ $ENV_FILE missing — run: pnpm postiz:init" >&2; exit 1; }
}

rand() { openssl rand -hex "${1:-32}"; }

case "${1:-help}" in
  init)
    if [[ -f "$ENV_FILE" ]]; then echo "✓ $ENV_FILE already exists (not overwritten)"; exit 0; fi
    cp "$DIR/.env.example" "$ENV_FILE"
    sed -i.bak \
      -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand 48)|" \
      -e "s|^POSTIZ_DB_PASSWORD=.*|POSTIZ_DB_PASSWORD=$(rand 24)|" \
      -e "s|^TEMPORAL_DB_PASSWORD=.*|TEMPORAL_DB_PASSWORD=$(rand 24)|" \
      "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    chmod 600 "$ENV_FILE"
    echo "✓ created $ENV_FILE with generated secrets"
    echo "  next: pnpm postiz:up, open the MAIN_URL, register the admin user, then set DISABLE_REGISTRATION=true"
    ;;
  up)
    need_env
    compose up -d --wait --wait-timeout 300
    echo "✓ Postiz is up at $(grep '^MAIN_URL=' "$ENV_FILE" | cut -d= -f2-)"
    echo "  public API root: $(grep '^NEXT_PUBLIC_BACKEND_URL=' "$ENV_FILE" | cut -d= -f2-)/public/v1  (→ POSTIZ_BASE_URL in the repo .env)"
    ;;
  down) need_env; compose down ;;
  restart) need_env; compose restart postiz ;;
  status) need_env; compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Image}}' ;;
  logs) need_env; shift; compose logs --tail "${TAIL:-200}" "${@:-postiz}" ;;
  pull) need_env; compose pull ;;
  backup)
    need_env
    out="$DIR/backups/postiz-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
    mkdir -p "$DIR/backups"
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    compose exec -T postiz-postgres pg_dump -U "$POSTIZ_DB_USER" "$POSTIZ_DB_NAME" | gzip > "$out"
    echo "✓ backup written to $out"
    ;;
  config) need_env; compose config --quiet && echo "✓ compose config valid" ;;
  *)
    echo "usage: postiz.sh {init|up|down|restart|status|logs [service]|pull|backup|config}"
    ;;
esac
