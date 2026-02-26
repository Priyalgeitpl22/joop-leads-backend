
# Jooper Leads Backend

Backend service for the Jooper Leads Management System.

This service handles authentication, campaign management, lead processing, email scheduling, background jobs, and database operations.

---

## Tech Stack

* Node.js
* TypeScript
* Express
* Prisma ORM
* PostgreSQL
* Redis
* BullMQ
* Docker & Docker Compose

---

## Project Structure

```
src/
 ├── controllers/
 ├── routes/
 ├── services/
 ├── middlewares/
 ├── utils/
 ├── emailScheduler/
 └── server.ts

prisma/
 └── schema.prisma

docker-compose.dev.yml
Dockerfile.dev
```

---

## Environment Setup

Create a `.env.dev` file in the root directory:

```
DATABASE_URL=postgresql://chatbot:devpassword@localhost:5432/chatbot_dev
REDIS_URL=redis://localhost:6379
PORT=5003
JWT_SECRET=your_secret_key
```

For Docker, environment variables are loaded using the `env_file` option in docker-compose.

---

## Install Dependencies

```
npm install
```

---

## Database Migrations (Prisma)

### Create a new migration

```
npx prisma migrate dev --name add-contacts-table
```

### Run existing migrations

```
npx prisma migrate dev
```

### Deploy migrations (staging/production)

```
npx prisma migrate deploy
```

### Open Prisma Studio

```
npx prisma studio
```

---

## Run the Project Without Docker

### Development mode

```
npm run dev
```

### Production mode

```
npm run build
npm start
```

---

## Docker Setup (Development)

### Stop containers and remove volumes

```
docker compose -f docker-compose.dev.yml down -v --remove-orphans
```

### Build containers

```
docker compose -f docker-compose.dev.yml build --no-cache
```

### Start containers

```
docker compose -f docker-compose.dev.yml up -d
```

### View logs

```
docker compose -f docker-compose.dev.yml logs -f
```

### Stop containers

```
docker compose -f docker-compose.dev.yml down
```

---

## Services

The backend runs multiple services using Docker:

* API Server — Main application server
* Scheduler — Handles scheduled email jobs
* Worker — Processes background jobs
* PostgreSQL — Primary database
* Redis — Queue and caching layer

All backend services use the same Docker image but run different commands.

---

## Health Check

The API exposes a health endpoint:

```
GET /health
```

Docker uses this endpoint to determine container health.

---

# Access PostgreSQL Database (Docker)

### Step 1 — Check running containers

```
docker ps
```

Find the PostgreSQL container name (example: `postgres-dev`).

---

### Step 2 — Enter the PostgreSQL container

```
docker exec -it postgres-dev sh
```

(Alpine-based images use `sh` instead of `bash`.)

---

### Step 3 — Connect to the database

```
psql -U chatbot -d chatbot_dev
```

---

### Direct one-line access (recommended)

You can skip the shell and connect directly:

```
docker exec -it postgres-dev psql -U chatbot -d chatbot_dev
```

---

### Useful PostgreSQL Commands

List databases:

```
\l
```

List tables:

```
\dt
```

Describe a table:

```
\d "User"
```

Exit PostgreSQL:

```
\q
```

---

## Scaling Workers

To scale worker containers:

```
docker compose up --scale worker=3
```

---

## Reset Database (Warning: Deletes Data)

```
docker compose -f docker-compose.dev.yml down -v
```

---

## Useful Commands

Regenerate Prisma client:

```
npx prisma generate
```

Check dependency vulnerabilities:

```
npm audit
```

Clean unused Docker resources:

```
docker system prune
```

---

## Production Notes

* Use `NODE_ENV=production`
* Run `npx prisma migrate deploy`
* Use restart policies in Docker
* Avoid running development dependencies in production
* Monitor logs and container health

 npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seedPlans.ts
