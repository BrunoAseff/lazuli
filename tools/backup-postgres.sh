#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

backup_directory="${BACKUP_DIRECTORY:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${backup_directory}/lazuli-${timestamp}.dump"

mkdir -p "${backup_directory}"
umask 077
pg_dump --dbname="${DATABASE_URL}" --format=custom --no-owner --no-privileges --file="${backup_path}"

echo "Backup created at ${backup_path}"
