# Migração do App Beach para um VPS Linux (Ubuntu/Debian)

Stack: FastAPI (backend, porta 8010) + Next.js (frontend, porta 3000) + PostgreSQL.
Estratégia: backup completo do banco (`pg_dump`) no servidor atual → restaura no novo.

---

## 0) Backup do banco no servidor ATUAL (GCP Ubuntu)

Conecte na instância do GCP (`gcloud compute ssh NOME_INSTANCIA --zone=ZONA` ou SSH normal) e rode:

```bash
cd ~
sudo -u postgres bash /caminho/do/repo/deploy/backup_db.sh
# (ou só: sudo -u postgres pg_dump -d app_beach -Fc -Z 9 -f ~/app_beach_$(date +%Y%m%d_%H%M%S).dump)
```

Isso gera `app_beach_AAAAMMDD_HHMMSS.dump`. Leve o arquivo para o servidor novo:

```bash
# Opção A — direto entre servidores (rode no GCP, precisa de SSH p/ o novo):
scp ~/app_beach_*.dump usuario@IP_DO_SERVIDOR_NOVO:~/

# Opção B — baixar pro seu PC e subir depois:
gcloud compute scp NOME_INSTANCIA:~/app_beach_*.dump . --zone=ZONA
scp app_beach_*.dump usuario@IP_DO_SERVIDOR_NOVO:~/
```

> Se o banco no GCP usa senha/usuário/host diferentes, ajuste:
> `pg_dump -h HOST -U USUARIO -d app_beach -Fc -Z 9 -f arquivo.dump`

---

## 1) Preparar o VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx postgresql postgresql-contrib python3-venv python3-pip curl
# Node 20 (frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
# Usuario de servico
sudo useradd -r -m -d /opt/app_beach -s /bin/bash appbeach || true
```

Clonar o projeto:

```bash
sudo git clone https://github.com/Jeff1984Sor/app_beach.git /opt/app_beach
sudo chown -R appbeach:appbeach /opt/app_beach
```

---

## 2) Restaurar o banco

Copie o `.dump` para o servidor e rode:

```bash
sudo mv /home/usuario/app_beach_*.dump /tmp/
export APPBEACH_DB_PASSWORD='UMA_SENHA_FORTE'   # guarde essa senha
sudo -u postgres APPBEACH_DB_PASSWORD="$APPBEACH_DB_PASSWORD" \
  bash /opt/app_beach/deploy/restore_db.sh /tmp/app_beach_*.dump
```

Isso cria o usuário `appbeach`, o banco `app_beach` e restaura os dados.

---

## 3) Backend

```bash
cd /opt/app_beach/backend
sudo -u appbeach python3 -m venv .venv
sudo -u appbeach .venv/bin/pip install -r requirements.txt
```

Criar o `.env` de produção (`/opt/app_beach/backend/.env`):

```env
SECRET_KEY=GERAR_UMA_CHAVE_ALEATORIA_LONGA
DATABASE_URL=postgresql+asyncpg://appbeach:UMA_SENHA_FORTE@localhost:5432/app_beach
```

> Gerar a SECRET_KEY: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`

Instalar o serviço:

```bash
sudo cp /opt/app_beach/deploy/app-beach-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now app-beach-backend
curl http://127.0.0.1:8010/health     # deve responder {"ok":true}
```

---

## 4) Frontend

O Next.js "congela" a `NEXT_PUBLIC_API_URL` **no momento do build** — então defina ANTES de buildar.
Como o Nginx serve a API em `/api/`, use caminho relativo:

```bash
cd /opt/app_beach/frontend
echo "NEXT_PUBLIC_API_URL=/api/v1" | sudo -u appbeach tee .env.production
sudo -u appbeach npm ci
sudo -u appbeach npm run build

sudo cp /opt/app_beach/deploy/app-beach-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now app-beach-frontend
```

---

## 5) Nginx + domínio + HTTPS

```bash
sudo cp /opt/app_beach/deploy/nginx-app-beach.conf /etc/nginx/sites-available/app-beach
sudo sed -i 's/SEU_DOMINIO/seu-dominio.com.br/' /etc/nginx/sites-available/app-beach
sudo ln -s /etc/nginx/sites-available/app-beach /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

HTTPS grátis (se tiver domínio apontado pro IP):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seu-dominio.com.br
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 6) Conferência final

- `curl http://127.0.0.1:8010/health` → `{"ok":true}`
- `systemctl status app-beach-backend app-beach-frontend nginx`
- Abrir `http://seu-dominio.com.br` no navegador e fazer login.
- Logs: `journalctl -u app-beach-backend -f` e `journalctl -u app-beach-frontend -f`

## Atualizações futuras

```bash
cd /opt/app_beach && sudo -u appbeach git pull
# backend (se mudou schema):
sudo -u appbeach backend/.venv/bin/alembic -c backend/alembic.ini upgrade head
sudo -u appbeach backend/.venv/bin/pip install -r backend/requirements.txt
# frontend:
cd frontend && sudo -u appbeach npm ci && sudo -u appbeach npm run build
sudo systemctl restart app-beach-backend app-beach-frontend
```
