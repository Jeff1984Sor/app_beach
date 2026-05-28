#!/usr/bin/env bash
# Gera um backup COMPLETO do banco app_beach no servidor ATUAL (Linux/GCP Ubuntu).
# Uso:  sudo -u postgres bash deploy/backup_db.sh
# Saida: app_beach_AAAAMMDD_HHMMSS.dump (formato custom, compactado) no diretorio atual.
set -euo pipefail

PGDB="${PGDB:-app_beach}"
stamp="$(date +%Y%m%d_%H%M%S)"
out="app_beach_${stamp}.dump"

echo ">> Gerando backup de '${PGDB}' em ${out} ..."
# -Fc = formato custom (restaura com pg_restore); -Z 9 = compactacao maxima
pg_dump -d "${PGDB}" -Fc -Z 9 -f "${out}"

echo ">> Backup gerado: $(pwd)/${out}"
echo ">> Baixe para sua maquina ou envie direto ao servidor novo, ex.:"
echo "     # do seu PC:  gcloud compute scp NOME_INSTANCIA:~/${out} . --zone=ZONA"
echo "     # ou:         scp usuario@IP_GCP:~/${out} ."
echo "     # depois:     scp ${out} usuario@IP_SERVIDOR_NOVO:~/"
