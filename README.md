# Nexora

Nexora is a lightweight customer relationship management workspace for teams that need one place to manage customers, projects, tasks, documents and operational activity.

## Product areas

- **Overview** — activity summary, pipeline metrics and recent work.
- **Customers** — company and contact records with notes and ownership.
- **Projects** — project tracking, task assignments and status updates.
- **Documents** — upload and retrieve customer and project files.
- **Reports** — operational summaries and CSV exports.
- **Workspace** — team members, roles, integrations and account settings.

## Technology

- Node.js 20+
- Express 4
- SQLite with better-sqlite3
- Express sessions and bcrypt
- Vanilla JavaScript, HTML and CSS
- Jest and Supertest

## Quick start

### Requirements

- Node.js 20 or newer
- npm 10 or newer

### Local development

```bash
git clone https://github.com/kan0n1r/Nexora.git
cd Nexora
cp .env.example .env
npm install
npm run db:init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database is created at `data/nexora.sqlite`. Set `DATABASE_PATH` to change its location. Uploaded files are stored in `uploads/`; set `UPLOAD_DIR` to change that directory.

## Demo accounts

The development database is seeded with these accounts:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@nexora.local | NexoraDemo!2026 |
| Sales | alex@nexora.local | NexoraDemo!2026 |
| Member | sam@nexora.local | NexoraDemo!2026 |

Use demo accounts only in a local development environment. Change all credentials and configuration before any shared deployment.

## Docker

Build and start the application:

```bash
cp .env.example .env
docker compose up --build
```

The service listens on port 3000 by default. Persistent SQLite data and uploaded files are stored in named Docker volumes.

To stop the service:

```bash
docker compose down
```

To remove the application and its persistent data:

```bash
docker compose down -v
```

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| NODE_ENV | Runtime environment | development |
| PORT | HTTP listen port | 3000 |
| SESSION_SECRET | Session signing secret | development fallback |
| DATABASE_PATH | SQLite database file | ./data/nexora.sqlite |
| UPLOAD_DIR | Uploaded file directory | ./uploads |

Always provide a unique, high-entropy `SESSION_SECRET` outside local development.

## API overview

The JSON API is rooted at `/api`. It includes endpoints for the current user, customers, projects, tasks, documents, reports, team members and integrations. Requests that create or modify records use JSON bodies unless they upload a document.

## Tests

```bash
npm test
```

## Troubleshooting

- **Native SQLite module fails to install:** use Node.js 20 LTS and ensure Python, make and a C++ compiler are available.
- **Port is already in use:** set another value for `PORT` in `.env`.
- **Database cannot be opened:** ensure the parent directory of `DATABASE_PATH` exists and is writable.
- **Uploads fail:** ensure `UPLOAD_DIR` exists and is writable by the application user.

## Reset local demo data

Stop the server, remove the SQLite database and initialize it again:

```bash
rm -f data/nexora.sqlite data/nexora.sqlite-shm data/nexora.sqlite-wal
npm run db:init
```

## Project structure

```text
src/
  db.js
  server.js
  routes/
    api.js
  middleware/
    auth.js
  public/
    app.js
    styles.css
  views/
    index.html
scripts/
  init-db.js
tests/
  app.test.js
```

Nexora is a development reference application. Review configuration, authentication, authorization, data handling and operational controls before using it with real customer information.
