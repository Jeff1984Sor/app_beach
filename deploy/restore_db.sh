#!/usr/bin/env bash
# Restaura o backup do app_beach no servidor NOVO (Linux).
# Uso:  sudo -u postgres bash deploy/restore_db.sh /caminho/app_beach_AAAAMMDD_HHMMSS.dump
set -euo pipefail

DUMP="${1:?Informe o caminho do arquivo .dump}"
DB="app_beach"
DBUSER="appbeach"
DBPASS="${APPBEACH_DB_PASSWORD:-troque_esta_senha}"

echo ">> Criando usuario e banco (se nao existirem)..."
psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DBUSER}') THEN
    CREATE ROLE ${DBUSER} LOGIN PASSWORD '${DBPASS}';
  END IF;
END \$\$;
SQL

# Recria o banco do zero para uma restauracao limpa
dropdb --if-exists "${DB}"
createdb -O "${DBUSER}" "${DB}"

echo ">> Restaurando ${DUMP} em ${DB}..."
pg_restore --no-owner --role="${DBUSER}" -d "${DB}" "${DUMP}"

echo ">> Concluido. Banco '${DB}' restaurado para o usuario '${DBUSER}'."
