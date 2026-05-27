# Contributing to MAGEED GROUP

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `cd backend && npm install && cd ../frontend && npm install`
3. Copy environment files: `cp backend/.env.example backend/.env`
4. Setup local MySQL database
5. Push Prisma schema: `cd backend && npx prisma db push`
6. Seed database: `cd backend && npm run seed`
7. Start development: `npm run dev` in both `backend/` and `frontend/`

## Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `hotfix/description` — Critical production fixes
- `refactor/description` — Code improvements

## Commit Messages

Use conventional commits:

```
feat: add customer export to CSV
fix: prevent double stock deduction on order accept
refactor: extract audit logging to service
docs: update deployment guide for Railway v2
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure CI passes (Prisma validate, frontend build, security scan)
4. Submit PR with description of changes
5. Request review

## Code Style

- **Backend:** CommonJS modules (`require`/`module.exports`)
- **Frontend:** ES modules (`import`/`export`)
- **Naming:** camelCase for variables/functions, PascalCase for React components
- **Files:** kebab-case for utilities, PascalCase for React pages
- **Arabic:** All user-facing strings in Arabic, code comments in English
