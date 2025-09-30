# Deploy on Vultr (Docker + Postgres)

This project is ready to self-host on a single Vultr VM. You’ll run both the web app and a Postgres database via Docker.

## 1) Prepare the server

- Recommended OS: Ubuntu 22.04+
- Install Docker and Compose:
  - curl -fsSL https://get.docker.com | sh
  - sudo usermod -aG docker $USER && newgrp docker

## 2) Copy the repo to the server

- Clone or upload the project to the server, e.g. /opt/tuushin-crm
- cd /opt/tuushin-crm

## 3) Create a server .env (used by docker compose)

Create a file named `.env` in the project root with at least:

```
POSTGRES_PASSWORD=your-strong-db-password
NEXTAUTH_URL=https://your-domain
NEXTAUTH_SECRET=your-strong-random-secret
MASTER_SYNC_SOURCE=https://burtgel.tuushin.mn/api/crm/get-options
# Optional if you protect the sync endpoint
# MASTER_SYNC_API_KEY=your-secret
```

Notes:

- The compose file will expose Postgres on port 5432 and the app on 3000.
- DATABASE_URL/DIRECT_URL are provided to the app automatically based on POSTGRES_PASSWORD.

## 4) Start services

Run:

```
docker compose -f docker-compose.prod.yml up -d --build
```

- This starts Postgres (with a persistent volume `db_data`) and the Next.js app.
- On container start, the app runs Prisma migrations automatically.

## 5) Ensure an admin user exists

Once the app is up, ensure an admin account:

```
curl -X POST https://your-domain/api/users/ensure-admin
```

- Default admin is `admin@freight.mn` with password `admin123` if a new user was created.
- Log in at `https://your-domain/login` and change the password.

## 6) HTTPS with a reverse proxy (optional but recommended)

- Put Nginx/Traefik/Caddy in front of port 3000 and terminate TLS there.
- Basic Nginx reverse proxy example (snippet):

```
server {
  listen 80;
  server_name your-domain;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Use certbot or your preferred method to enable HTTPS.

## Operations

- Logs: `docker logs -f tuushin_crm_web`
- Restart: `docker compose -f docker-compose.prod.yml restart`
- Update to latest code:
  - `git pull`
  - `docker compose -f docker-compose.prod.yml up -d --build`
- psql into DB: `docker exec -it tuushin_crm_db psql -U postgres -d tuushin_crm`

## Alternatives

- You can point the web container to a managed Postgres (Vultr Managed DB, Supabase, Neon) by setting `DATABASE_URL` and `DIRECT_URL` envs on the `web` service and removing the `db` service.
- For Vercel deployments, the project already auto-detects Vercel Postgres env vars.
