# {{PROJECT_NAME}}

Fullstack application scaffolded with `create-rapid-stack`.

## Stack Overview

- **Frontend**: Next.js (App Router) on port `3000`
- **Backend**: Express.js REST API on port `{{PORT}}`
- **Database & ORM**: Prisma ORM (`{{DATABASE_URL}}`)

## Getting Started

### 1. Environment Configuration

Copy `.env.example` to `.env` in both `backend/` and `frontend/` if not already generated:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Install Dependencies

```bash
npm run install:all
```

### 3. Run in Development

Start both the Next.js frontend (`http://localhost:3000`) and Express backend (`{{API_URL}}`):

```bash
npm run dev
```

Or run each workspace individually:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### 4. Run with Docker

If Docker was enabled during scaffolding:

```bash
docker compose up --build
```

